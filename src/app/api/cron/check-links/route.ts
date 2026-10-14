import { timingSafeEqual } from "node:crypto";
import { databaseConfigured, getSql, initDb } from "@/lib/db";
import { checkLink } from "@/lib/check-links";
import type { Bookmark } from "@/lib/types";
export const maxDuration = 60;
export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET;
  const token = request.headers.get("authorization")?.replace(/^Bearer /, "") || "";
  if (
    !expected ||
    Buffer.byteLength(token) !== Buffer.byteLength(expected) ||
    !timingSafeEqual(Buffer.from(token), Buffer.from(expected))
  )
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!databaseConfigured())
    return Response.json({ error: "Database not connected" }, { status: 503 });
  await initDb();
  const sql = getSql();
  const cutoff = Date.now() - 7 * 86400000;
  const rows =
    await sql`SELECT r.vault_id,r.id,r.data FROM nest_records r JOIN nest_vaults v ON v.id=r.vault_id WHERE r.kind='bookmark' AND v.health_enabled=true AND r.data->>'deletedAt' IS NULL AND COALESCE((r.data->>'demo')::boolean,false)=false AND COALESCE((r.data->>'lastChecked')::bigint,0)<${cutoff} ORDER BY COALESCE((r.data->>'lastChecked')::bigint,0) ASC LIMIT 20`;
  let checked = 0;
  for (let i = 0; i < rows.length; i += 4) {
    await Promise.all(
      rows.slice(i, i + 4).map(async (row) => {
        const b = await checkLink(row.data as Bookmark);
        await sql`UPDATE nest_records SET data=${JSON.stringify(b)}::jsonb,updated_at=${b.updatedAt} WHERE vault_id=${row.vault_id} AND id=${row.id} AND updated_at<=${(row.data as Bookmark).updatedAt}`;
        checked++;
      }),
    );
  }
  return Response.json({ checked });
}
