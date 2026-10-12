import { readFileSync, writeFileSync } from "node:fs";
import { toTimestamptz } from "./timestamptz";

const file = process.argv[2];
if (!file) {
  console.error("usage: tsx scripts/apply-timestamptz.ts <schema-file>");
  process.exit(1);
}
writeFileSync(file, toTimestamptz(readFileSync(file, "utf8")));
