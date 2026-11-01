import { isIP, isIPv4 } from "node:net";
import { getEnv, type TrustedClientIpHeader, trustedClientIpHeader } from "../env";

// Spec "Authentication and sessions" → "Rate limits" → "Client IP (one derivation for every path)"; plan Task 22.
// The only source of an IP key. Both auth entry paths (the /api/auth route and postToAuth) hand Better Auth a request
// from prepareAuthRequest, and Better Auth reads only CLIENT_IP_HEADER (advanced.ipAddress.ipAddressHeaders).

export const CLIENT_IP_HEADER = "x-crm-client-ip";
// TEST-NET-1 (RFC 5737): a valid address that is never a real client. Every fallback shares it (fail closed).
export const PLACEHOLDER_CLIENT_IP = "192.0.2.1";

const FORWARDING_HEADERS = ["x-forwarded-for", "forwarded", "x-real-ip", "cf-connecting-ip"] as const;

export interface ClientIp {
  readonly ip: string;
  readonly fallback: boolean;
}

// The first four 16-bit groups of an IPv6 address, expanded, with the rest zero: the /64 prefix as an address.
function ipv6Prefix64(address: string): string {
  const [head = "", tail] = address.toLowerCase().split("::");
  const left = head === "" ? [] : head.split(":");
  const right = tail === undefined || tail === "" ? [] : tail.split(":");
  const groups = tail === undefined ? left : [...left, ...Array<string>(8 - left.length - right.length).fill("0"), ...right];
  return [...groups.slice(0, 4), "0", "0", "0", "0"].map((group) => group.padStart(4, "0")).join(":");
}

function keyOf(value: string): string | null {
  const family = isIP(value);
  if (family === 4) return value;
  if (family !== 6) return null;
  // An IPv4-mapped address (::ffff:a.b.c.d) is that IPv4 client.
  const mapped = /^::ffff:(.+)$/i.exec(value)?.[1];
  if (mapped !== undefined && isIPv4(mapped)) return mapped;
  // Embedded IPv4 forms other than the mapped one are not client addresses here.
  if (value.includes(".")) return null;
  return ipv6Prefix64(value);
}

// Reads only the configured header and accepts exactly one valid address; anything else is the placeholder,
// logged without the value (UNI-09).
export function deriveClientIp(headers: Headers, setting: TrustedClientIpHeader): ClientIp {
  const value = setting === "none" ? null : headers.get(setting);
  const ip = value === null ? null : keyOf(value.trim());
  if (ip !== null) return { ip, fallback: false };
  console.warn(JSON.stringify({ level: "warn", msg: "client ip fallback" }));
  return { ip: PLACEHOLDER_CLIENT_IP, fallback: true };
}

// The request Better Auth receives: every forwarding header and any caller copy of CLIENT_IP_HEADER removed, then
// CLIENT_IP_HEADER set to the derived address. Method, URL, body and every other header are kept.
export function prepareAuthRequest(
  request: Request,
  setting: TrustedClientIpHeader = trustedClientIpHeader(getEnv()),
): Request {
  const { ip } = deriveClientIp(request.headers, setting);
  const headers = new Headers(request.headers);
  for (const name of FORWARDING_HEADERS) headers.delete(name);
  headers.set(CLIENT_IP_HEADER, ip);
  // Built from the request's parts, not `new Request(request, …)`: under `next start` the route's request is not an
  // instance of this realm's Request, and the copy constructor then throws (rate-limit.test.ts runs the build).
  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  return new Request(request.url, {
    method: request.method,
    headers,
    signal: request.signal,
    ...(hasBody ? { body: request.body, duplex: "half" } : {}),
  } as RequestInit);
}
