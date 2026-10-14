import { databaseConfigured } from "@/lib/db";
export function GET() {
  return Response.json(
    { ok: true, sync: databaseConfigured(), version: "1.0.0" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
