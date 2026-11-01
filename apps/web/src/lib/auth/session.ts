import { headers } from "next/headers";
import { cache } from "react";
import { CLIENT_IP_HEADER } from "./client-ip";
import { getAuth } from "./server";

// Read the request headers before getAuth(): that read is where `next build` stops prerendering, so
// auth and env validation only run for real requests, never in a build without runtime secrets.

// Only prepareAuthRequest sets the internal client-IP header; a caller's copy never reaches Better Auth (plan
// Task 22). These calls write no IP today, the strip keeps it that way if one ever does.
async function callerHeaders(): Promise<Headers> {
  const requestHeaders = new Headers(await headers());
  requestHeaders.delete(CLIENT_IP_HEADER);
  return requestHeaders;
}

export const getCurrentSession = cache(async () => {
  const requestHeaders = await callerHeaders();
  return getAuth().api.getSession({ headers: requestHeaders });
});

export const listWorkspaces = cache(async () => {
  const requestHeaders = await callerHeaders();
  return getAuth().api.listOrganizations({ headers: requestHeaders });
});
