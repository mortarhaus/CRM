import { readFileSync, writeFileSync } from "node:fs";
import { withBillingAccountReference } from "./billing-account-reference";
import { toTimestamptz } from "./timestamptz";

const file = process.argv[2];
if (!file) {
  console.error("usage: tsx scripts/postprocess-auth-schema.ts <schema-file>");
  process.exit(1);
}
writeFileSync(file, withBillingAccountReference(toTimestamptz(readFileSync(file, "utf8"))));
