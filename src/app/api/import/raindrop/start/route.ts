import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";

export async function GET(request: Request) {
  const id = process.env.RAINDROP_CLIENT_ID;
  const secret = process.env.RAINDROP_CLIENT_SECRET;
  if (!id || !secret) return NextResponse.json({ error: "Raindrop integration is not configured." }, { status: 503 });
  const state = randomBytes(24).toString("hex");
  const redirect = new URL("/api/import/raindrop/callback", request.url);
  const url = new URL("https://raindrop.io/oauth/authorize");
  url.searchParams.set("client_id", id);
  url.searchParams.set("redirect_uri", redirect.href);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", state);
  const response = NextResponse.redirect(url);
  response.cookies.set("nest_raindrop_state", state, { httpOnly: true, secure: redirect.protocol === "https:", sameSite: "lax", path: "/api/import/raindrop", maxAge: 600 });
  return response;
}
