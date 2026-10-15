import { headers } from "next/headers";
import { cache } from "react";
import { getAuth } from "./server";

// Read the request headers before getAuth(): that read is where `next build` stops prerendering, so
// auth and env validation only run for real requests, never in a build without runtime secrets.

export const getCurrentSession = cache(async () => {
  const requestHeaders = await headers();
  return getAuth().api.getSession({ headers: requestHeaders });
});

export const listWorkspaces = cache(async () => {
  const requestHeaders = await headers();
  return getAuth().api.listOrganizations({ headers: requestHeaders });
});
