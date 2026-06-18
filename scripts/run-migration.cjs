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

  const sqlPath = path.join(__dirname, "..", "sql", "002_messenger_leads.sql");
  const sql = fs.readFileSync(sqlPath, "utf8");

  const client = new Client({
    connectionString: databaseUrl.replace(/\r?\n/g, "").trim(),
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  try {
    await client.query(sql);
    const { rows } = await client.query(
      "select to_regclass('public.messenger_leads') as tbl",
    );
    console.log("OK: messenger_leads =", rows[0]?.tbl || "missing");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("Migration failed:", err.message);
  process.exit(1);
});
