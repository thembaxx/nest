import { databaseConfigured, getSql, initDb, vaultFromRequest } from "@/lib/db";
import { librarySchema } from "@/lib/types";
import { rateLimit } from "@/lib/rate-limit";
export const maxDuration = 30;
export async function POST(request: Request) {
  if (!databaseConfigured())
    return Response.json(
      {
        error:
          "Cloud sync needs a connected Neon database. Your bookmarks are saved on this device.",
      },
      { status: 503 },
    );
  const vault = vaultFromRequest(request);
  if (!vault) return Response.json({ error: "Invalid recovery key." }, { status: 401 });
  if (!rateLimit(request, "sync", 60))
    return Response.json({ error: "Please retry shortly." }, { status: 429 });
  try {
    const body = await request.text();
    if (body.length > 4_000_000)
      return Response.json({ error: "Library is too large for one sync." }, { status: 413 });
    const raw = JSON.parse(body);
    const parsed = librarySchema.safeParse(raw);
    if (!parsed.success) return Response.json({ error: "Invalid library data." }, { status: 400 });
    await initDb();
    const sql = getSql();
    const now = Date.now();
    await sql`INSERT INTO nest_vaults (id,updated_at,health_enabled) VALUES (${vault},${now},${raw.healthChecks !== false}) ON CONFLICT(id) DO UPDATE SET updated_at=EXCLUDED.updated_at, health_enabled=EXCLUDED.health_enabled`;
    const records = [
      ...parsed.data.bookmarks
        .filter((b) => !b.demo)
        .map((data) => ({
          id: data.id,
          kind: "bookmark",
          data: { ...data, updatedAt: Math.min(data.updatedAt, now) },
          updated_at: Math.min(data.updatedAt, now),
        })),
      ...parsed.data.lists.map((data) => ({
        id: data.id,
        kind: "list",
        data: { ...data, updatedAt: Math.min(data.updatedAt, now) },
        updated_at: Math.min(data.updatedAt, now),
      })),
    ];
    if (records.length)
      await sql`INSERT INTO nest_records(vault_id,id,kind,data,updated_at) SELECT ${vault},r.id,r.kind,r.data,r.updated_at FROM jsonb_to_recordset(${JSON.stringify(records)}::jsonb) AS r(id text,kind text,data jsonb,updated_at bigint) ON CONFLICT(vault_id,id) DO UPDATE SET data=EXCLUDED.data,updated_at=EXCLUDED.updated_at WHERE nest_records.updated_at<=EXCLUDED.updated_at`;
    const rows = await sql`SELECT kind,data FROM nest_records WHERE vault_id=${vault}`;
    return Response.json(
      {
        bookmarks: rows.filter((r) => r.kind === "bookmark").map((r) => r.data),
        lists: rows.filter((r) => r.kind === "list").map((r) => r.data),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    console.error("Sync failed:", e instanceof Error ? e.message : "unknown");
    return Response.json(
      { error: "Could not sync right now. Your device copy is safe." },
      { status: 500 },
    );
  }
}
