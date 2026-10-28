import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const token = request.cookies.get("nest_raindrop_token")?.value;
  if (!token)
    return NextResponse.json({ error: "Connect Raindrop before importing." }, { status: 401 });
  const headers = { Authorization: `Bearer ${token}` };
  async function get(path: string) {
    const response = await fetch(`https://api.raindrop.io/rest/v1/${path}`, {
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw Error("Raindrop API request failed.");
    return response.json();
  }
  try {
    const collectionsResponse = await get("collections");
    const collections = (collectionsResponse.items || []).map(
      (c: { _id: number; title: string }) => ({ id: c._id, title: c.title }),
    );
    const items: unknown[] = [];
    for (let page = 0; page < 200; page++) {
      const data = await get(`raindrops/0?perpage=50&page=${page}`);
      if (!Array.isArray(data.items) || !data.items.length) break;
      items.push(...data.items);
      if (items.length > 10000)
        throw Error("Raindrop collection exceeds Nest's 10,000 bookmark limit.");
      if (data.items.length < 50) break;
    }
    const response = NextResponse.json({ items, collections });
    response.cookies.delete("nest_raindrop_token");
    return response;
  } catch {
    return NextResponse.json(
      { error: "Unable to retrieve Raindrop bookmarks. Try reconnecting." },
      { status: 502 },
    );
  }
}
