import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const expected = request.cookies.get("nest_raindrop_state")?.value;
  const state = searchParams.get("state");
  if (!expected || !state || state !== expected || searchParams.get("error"))
    return NextResponse.json({ error: "Raindrop authorization failed or expired." }, { status: 400 });
  const code = searchParams.get("code");
  if (!code) return NextResponse.json({ error: "Missing authorization code." }, { status: 400 });
  const redirect = new URL("/api/import/raindrop/callback", request.url);
  const response = await fetch("https://raindrop.io/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: process.env.RAINDROP_CLIENT_ID, client_secret: process.env.RAINDROP_CLIENT_SECRET, code, redirect_uri: redirect.href, grant_type: "authorization_code" }),
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) return NextResponse.json({ error: "Raindrop token exchange failed." }, { status: 502 });
  const token = await response.json() as { access_token?: string };
  if (!token.access_token) return NextResponse.json({ error: "Raindrop did not return an access token." }, { status: 502 });
  const result = NextResponse.redirect(new URL("/?raindrop=connected", request.url));
  result.cookies.delete("nest_raindrop_state");
  result.cookies.set("nest_raindrop_token", token.access_token, { httpOnly: true, secure: redirect.protocol === "https:", sameSite: "lax", path: "/api/import/raindrop", maxAge: 600 });
  return result;
}
