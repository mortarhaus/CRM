import { getDb, getLimiterDb } from "../../db";
import { getEnv } from "../env";
import { createAuth, type Auth } from "./config";
import { authRequestHandler } from "./request-handler";

let instance: Auth | undefined;

export function getAuth(): Auth {
  if (!instance) {
    const env = getEnv();
    instance = createAuth({
      db: getDb().db,
      limiterDb: getLimiterDb().db,
      secret: env.AUTH_SECRET,
      baseURL: env.APP_URL,
    });
  }
  return instance;
}

let handler: ((request: Request) => Promise<Response>) | undefined;

// Better Auth's handler behind the per-account sign-in limit and the one 429 (request-handler.ts), on the same
// limiter pool and secret as the instance.
export function getAuthHandler(): (request: Request) => Promise<Response> {
  if (!handler) {
    const auth = getAuth();
    handler = authRequestHandler({
      handler: (request) => auth.handler(request),
      limiterDb: getLimiterDb().db,
      secret: getEnv().AUTH_SECRET,
    });
  }
  return handler;
}
