/**
 * Apply sql/*.sql via DATABASE_URL from monorepo env (shared Supabase).
 */
const fs = require("fs");
const path = require("path");

process.chdir(path.join(__dirname, ".."));

const { bootstrapEnv } = require("../src/config/env-bootstrap");

const PG_ROOT = path.join(
  process.env.MONOREPO_ROOT || "D:\\0.PROJECTS",
  "00-MASTER-ADMIN",
  "admin",
  "node_modules",
  "pg",
);

async function main() {
  await bootstrapEnv();
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL missing — check admin/supabase/.env or long-sang-ai/.env");
    process.exit(1);
  }

  let Client;
  try {
    Client = require(PG_ROOT).Client;
  } catch {
    console.error("pg not found — run npm install in 00-MASTER-ADMIN/admin");
    process.exit(1);
  }

  const sqlFiles = [
    "001_messenger_threads.sql",
    "002_messenger_leads.sql",
    "003_messenger_threads_lead_meta.sql",
  ];
  const client = new Client({
    connectionString: databaseUrl.replace(/\r?\n/g, "").trim(),
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  try {
    for (const file of sqlFiles) {
      const sqlPath = path.join(__dirname, "..", "sql", file);
      const sql = fs.readFileSync(sqlPath, "utf8");
      await client.query(sql);
      console.log(`OK: applied ${file}`);
    }
    const { rows } = await client.query(
      `select
        to_regclass('public.messenger_leads') as leads_tbl,
        (select count(*) from information_schema.columns
         where table_name = 'messenger_threads' and column_name in ('lead', 'meta')) as thread_meta_cols`,
    );
    console.log("OK: messenger_leads =", rows[0]?.leads_tbl || "missing");
    console.log("OK: messenger_threads lead/meta cols =", rows[0]?.thread_meta_cols, "/ 2");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("Migration failed:", err.message);
  process.exit(1);
});
