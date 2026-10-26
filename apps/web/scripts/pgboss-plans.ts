import { pgbossInstallSql } from "../src/jobs/install-sql";

// Prints the body of the pg-boss install migration for the installed version (plan Task 16 Step 2).
// install.test.ts checks the committed migration still equals this output.
process.stdout.write(pgbossInstallSql());
