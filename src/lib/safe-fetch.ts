import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { Agent, fetch as request } from "undici";
export function publicIp(ip: string): boolean {
  if (ip.includes(":")) {
    const value = ip.toLowerCase();
    if (value.startsWith("::ffff:")) return publicIp(value.slice(7));
    return !/^(::|fc|fd|fe[89ab]|ff|2001:db8)/.test(value) && value !== "::1";
  }
  const p = ip.split(".").map(Number);
  return (
    p.length === 4 &&
    !(
      [0, 10, 127].includes(p[0]) ||
      p[0] >= 224 ||
      (p[0] === 169 && p[1] === 254) ||
      (p[0] === 172 && p[1] >= 16 && p[1] <= 31) ||
      (p[0] === 192 && (p[1] === 168 || p[1] === 0)) ||
      (p[0] === 100 && p[1] >= 64 && p[1] <= 127) ||
      (p[0] === 198 && (p[1] === 18 || p[1] === 19))
    )
  );
}
export async function safeFetch(input: string, method: "HEAD" | "GET" = "GET", maxBytes = 262144) {
  let url = new URL(input);
  for (let redirect = 0; redirect < 4; redirect++) {
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      (url.port && !["80", "443"].includes(url.port))
    )
      throw Error("Only public web addresses are supported.");
    const host = url.hostname.replace(/^\[|\]$/g, "");
    const records = isIP(host)
      ? [{ address: host, family: isIP(host) }]
      : await lookup(host, { all: true });
    if (!records.length || records.some((r) => !publicIp(r.address)))
      throw Error("Private addresses are not supported.");
    const agent = new Agent({
      connect: {
        lookup: (_h, options, cb) => {
          const r =
            records.find((r) => !options.family || r.family === options.family) || records[0];
          if (options.all) cb(null, records);
          else cb(null, r.address, r.family);
        },
      },
    });
    try {
      const response = await request(url, {
        method,
        dispatcher: agent,
        redirect: "manual",
        signal: AbortSignal.timeout(7000),
        headers: {
          "User-Agent": "NestBookmarkBot/1.0 (+link health and metadata)",
          Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        },
      });
      const location = response.headers.get("location");
      if (response.status >= 300 && response.status < 400 && location) {
        await response.body?.cancel();
        url = new URL(location, url);
        continue;
      }
      let text = "";
      if (method === "GET" && response.body) {
        const reader = response.body.getReader();
        let size = 0;
        const decoder = new TextDecoder();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            size += value.byteLength;
            if (size > maxBytes) break;
            text += decoder.decode(value, { stream: true });
          }
        } finally {
          await reader.cancel();
        }
      } else await response.body?.cancel();
      return { status: response.status, text, url: url.href };
    } finally {
      await agent.close();
    }
  }
  throw Error("Too many redirects.");
}
