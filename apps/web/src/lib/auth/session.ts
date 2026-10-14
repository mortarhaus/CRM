import { headers } from "next/headers";
import { cache } from "react";
import { getAuth } from "./server";

export const getCurrentSession = cache(async () => getAuth().api.getSession({ headers: await headers() }));

export const listWorkspaces = cache(async () => getAuth().api.listOrganizations({ headers: await headers() }));
