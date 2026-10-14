import { neon } from "@neondatabase/serverless";
import { createHash } from "node:crypto";
let initialized: Promise<void> | undefined;
export function databaseConfigured() {
  return !!(process.env.DATABASE_URL || process.env.POSTGRES_URL);
}
export function getSql() {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) throw Error("Connect a Neon database to enable sync.");
  return neon(url);
}
export async function initDb() {
  if (!initialized)
    initialized = (async () => {
      const sql = getSql();
      await sql`CREATE TABLE IF NOT EXISTS nest_vaults (id TEXT PRIMARY KEY, health_enabled BOOLEAN NOT NULL DEFAULT true, updated_at BIGINT NOT NULL)`;
      await sql`CREATE TABLE IF NOT EXISTS nest_records (vault_id TEXT NOT NULL REFERENCES nest_vaults(id) ON DELETE CASCADE, id TEXT NOT NULL, kind TEXT NOT NULL, data JSONB NOT NULL, updated_at BIGINT NOT NULL, PRIMARY KEY (vault_id,id))`;
      await sql`CREATE INDEX IF NOT EXISTS nest_records_vault_idx ON nest_records(vault_id)`;
    })().catch((e) => {
      initialized = undefined;
      throw e;
    });
  return initialized;
}
export function vaultFromRequest(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer /, "") || "";
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  return createHash("sha256").update(token).digest("hex");
}
