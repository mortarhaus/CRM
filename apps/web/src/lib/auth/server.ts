import { getDb } from "../../db";
import { getEnv } from "../env";
import { createAuth, type Auth } from "./config";

let instance: Auth | undefined;

export function getAuth(): Auth {
  if (!instance) {
    const env = getEnv();
    instance = createAuth({ db: getDb().db, secret: env.AUTH_SECRET, baseURL: env.APP_URL });
  }
  return instance;
}
