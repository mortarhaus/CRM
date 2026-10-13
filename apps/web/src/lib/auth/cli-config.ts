import { createDb } from "../../db/client";
import { createAuth } from "./config";

// Loaded only by `auth generate` to read the options; postgres.js connects lazily, so this never opens a socket.
export const auth = createAuth({
  db: createDb("postgres://schema-generation@127.0.0.1:1/schema-generation").db,
  secret: "schema-generation-only-not-a-real-secret",
  baseURL: "http://localhost:3000",
});
