// Better Auth 1.7.6's schema generator cannot reference a table it does not own (it throws "Model not found"),
// so organization.billing_account_id is declared to Better Auth as a plain field and turned into the uuid
// foreign key to billing_account here, after every `auth generate`.
const GENERATED_COLUMN = 'billingAccountId: text("billing_account_id")';
const REFERENCE_COLUMN =
  'billingAccountId: uuid("billing_account_id").references(() => billingAccount.id, { onDelete: "restrict" })';
const PG_CORE_IMPORT = /^import \{[^}]*\} from "drizzle-orm\/pg-core";$/m;
const SYSTEM_IMPORT = 'import { billingAccount } from "./system";';

export function withBillingAccountReference(source: string): string {
  if (source.includes(REFERENCE_COLUMN)) return source;
  if (source.split(GENERATED_COLUMN).length !== 2 || !PG_CORE_IMPORT.test(source)) {
    throw new Error("expected one generated billing_account_id column and the pg-core import in the auth schema");
  }
  return source
    .replace(GENERATED_COLUMN, REFERENCE_COLUMN)
    .replace(PG_CORE_IMPORT, (line) => `${line}\n${SYSTEM_IMPORT}`);
}
