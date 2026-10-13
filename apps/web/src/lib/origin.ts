const LOOPBACK_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]"]);

export function isLoopbackUrl(url: string): boolean {
  return LOOPBACK_HOSTNAMES.has(new URL(url).hostname);
}

export function isHttpsUrl(url: string): boolean {
  return new URL(url).protocol === "https:";
}
