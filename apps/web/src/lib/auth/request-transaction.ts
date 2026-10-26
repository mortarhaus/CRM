import type { BetterAuthOptions } from "better-auth";
import { getIP, isAPIError } from "better-auth/api";
import type { AuthTransactions } from "../../db/system";
import { AuthRequestFailed, logAuthFailure } from "./log";

// The organization plugin's hooks write through the pool on other connections (billing account, workspace
// settings) and would wait for rows this transaction has not committed; its endpoints keep Better Auth's statements.
const OUTSIDE_TRANSACTION = "/organization/";

interface WrappableAuth {
  handler(request: Request): Promise<Response>;
  api: Record<string, unknown>;
  options: BetterAuthOptions;
}

type Endpoint = ((input?: { headers?: HeadersInit }) => Promise<unknown>) & {
  path?: string;
  options?: { method?: string | string[] };
};

function isPost(method: string | string[] | undefined): boolean {
  return Array.isArray(method) ? method.includes("POST") : method === "POST";
}

function inTransaction(path: string | undefined, method: string | string[] | undefined): boolean {
  return path !== undefined && isPost(method) && !path.startsWith(OUTSIDE_TRANSACTION);
}

function serverError(): Response {
  return new Response(null, { status: 500, statusText: "Internal Server Error" });
}

// A rolled-back request sets no cookie: whatever it issued no longer exists (plan Task 31 R2).
function withoutCookies(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.delete("set-cookie");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

// Every POST endpoint outside the organization plugin runs as one database transaction, through the HTTP handler
// and through `auth.api` alike: a response below 500 commits, anything else rolls the whole request back. So a
// sign-in, a 2FA change and the sessions and audit rows they write commit together or not at all (plan Task 31).
export function withRequestTransactions<A extends WrappableAuth>(auth: A, transactions: AuthTransactions): A {
  const basePath = auth.options.basePath ?? "/api/auth";
  const clientIp = (headers: Headers) => getIP(headers, auth.options);

  async function handler(request: Request): Promise<Response> {
    const { pathname } = new URL(request.url);
    const path = pathname.startsWith(`${basePath}/`) ? pathname.slice(basePath.length) : undefined;
    try {
      if (!inTransaction(path, request.method)) return await auth.handler(request);
      const { result, committed } = await transactions.run(
        clientIp(request.headers),
        () => auth.handler(request),
        (response) => response.status < 500,
      );
      return committed ? result : withoutCookies(result);
    } catch (error) {
      logAuthFailure(error);
      return serverError();
    }
  }

  function failed(error: unknown): never {
    if (isAPIError(error)) throw error;
    logAuthFailure(error);
    throw new AuthRequestFailed(error);
  }

  function wrap(endpoint: Endpoint): Endpoint {
    const wrapped = async (input?: { headers?: HeadersInit }) => {
      const outcome = await transactions
        .run(
          clientIp(new Headers(input?.headers)),
          async () => {
            try {
              return { value: await endpoint(input) };
            } catch (error) {
              return { error };
            }
          },
          (attempt) =>
            "error" in attempt
              ? isAPIError(attempt.error) && attempt.error.statusCode < 500
              : !(attempt.value instanceof Response && attempt.value.status >= 500),
        )
        .catch(failed);
      if ("error" in outcome.result) failed(outcome.result.error);
      const { value } = outcome.result;
      return !outcome.committed && value instanceof Response ? withoutCookies(value) : value;
    };
    return Object.assign(wrapped, { path: endpoint.path, options: endpoint.options });
  }

  const api = Object.fromEntries(
    Object.entries(auth.api).map(([key, value]) => {
      const endpoint = value as Endpoint;
      return [key, inTransaction(endpoint.path, endpoint.options?.method) ? wrap(endpoint) : endpoint];
    }),
  );
  return { ...auth, handler, fetch: handler, api };
}
