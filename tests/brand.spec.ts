import { test, expect } from "@playwright/test";
import sharp from "sharp";
const origin = "https://nest-iota-three.vercel.app";
test("public pages expose useful content and correct canonical and social metadata without JavaScript", async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  const titles = new Set<string>();
  for (const [path, heading] of [
    ["/about", "Good things, kept close."],
    ["/guide", "Make yourself at home."],
    ["/brand", "An idea, tucked in."],
    ["/privacy", "Your library, your business."],
  ]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", origin + path);
    await expect(page.locator('meta[property="og:image"]').first()).toHaveAttribute(
      "content",
      origin + "/brand/nest-social.png",
    );
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
      "content",
      "summary_large_image",
    );
    expect(await page.locator('meta[name="description"]').getAttribute("content")).toBeTruthy();
    const title = await page.title();
    expect(titles.has(title)).toBe(false);
    titles.add(title);
  }
  await page.goto("/about");
  const faq = await page.locator('script[type="application/ld+json"]').textContent();
  expect(JSON.parse(faq!).mainEntity).toHaveLength(6);
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "A smarter home for your bookmarks." }),
  ).toBeVisible();
  const rootData = await page.locator('script[type="application/ld+json"]').textContent();
  expect(
    JSON.parse(rootData!)["@graph"].some(
      (entry: { "@type": string }) => entry["@type"] === "WebApplication",
    ),
  ).toBe(true);
  await context.close();
});
test("robots, sitemap, and LLM discovery describe public routes without exposing private APIs", async ({
  request,
}) => {
  const robots = await request.get("/robots.txt");
  expect(robots.status()).toBe(200);
  expect(await robots.text()).toContain("Disallow: /api/");
  expect(await robots.text()).toContain(origin + "/sitemap.xml");
  const sitemap = await request.get("/sitemap.xml");
  const xml = await sitemap.text();
  for (const path of ["/about", "/guide", "/brand", "/privacy"])
    expect(xml).toContain(origin + path);
  expect(xml).not.toContain("/api/");
  const index = await request.get("/llms.txt");
  const alias = await request.get("/llm.txt");
  expect(index.status()).toBe(200);
  expect(index.headers()["content-type"]).toContain("text/plain");
  expect(await index.text()).toBe(await alias.text());
  expect(await index.text()).toContain("up to 24");
  const full = await request.get("/llms-full.txt");
  expect(full.status()).toBe(200);
  expect(await full.text()).toContain("not end-to-end encrypted");
  expect(await full.text()).toContain("does not grant access");
});
test("brand downloads, social preview, and versioned install icons are complete", async ({
  request,
}) => {
  const social = await request.get("/brand/nest-social.png");
  expect(social.status()).toBe(200);
  const dimensions = await sharp(await social.body()).metadata();
  expect([dimensions.width, dimensions.height]).toEqual([1200, 630]);
  const manifest = await (await request.get("/manifest.webmanifest")).json();
  for (const icon of manifest.icons) {
    expect(icon.src).toContain("?v=2");
    const asset = await request.get(icon.src);
    expect(asset.status()).toBe(200);
    const meta = await sharp(await asset.body()).metadata();
    expect(`${meta.width}x${meta.height}`).toBe(icon.sizes);
  }
  for (const asset of [
    "/brand/nest-symbol.svg",
    "/brand/nest-symbol-light.svg",
    "/brand/nest-wordmark.svg",
    "/brand/nest-wordmark-light.svg",
    "/brand/nest-brand-sheet.svg",
    "/brand/nest-brand-kit.zip",
    "/icons/favicon.ico",
  ])
    expect((await request.get(asset)).status()).toBe(200);
  const zip = await request.get("/brand/nest-brand-kit.zip");
  expect((await zip.body()).subarray(0, 2).toString()).toBe("PK");
});
test("about and brand layouts fit a phone and the app uses the new identity", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of ["/about", "/brand", "/guide"]) {
    await page.goto(path);
    await page.locator("h1").waitFor();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
  await page.goto("/brand");
  await page.screenshot({ path: "/workspace/scratch/nest-brand-mobile.png", fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1050 });
  await page.goto("/about");
  await page.screenshot({ path: "/workspace/scratch/nest-about.png", fullPage: true });
  await page.goto("/brand");
  await page.screenshot({ path: "/workspace/scratch/nest-brand.png", fullPage: true });
});
test("visiting a public page does not replace the offline bookmark library shell", async ({
  page,
  context,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "nest-settings",
      JSON.stringify({ onboarded: true, theme: "light", effects: false }),
    ),
  );
  await page.goto("/");
  await expect(page.locator(".bookmark-card")).toHaveCount(9);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller)
      await new Promise<void>((resolve) =>
        navigator.serviceWorker.addEventListener("controllerchange", () => resolve(), {
          once: true,
        }),
      );
  });
  await page.goto("/about");
  await expect(
    page.getByRole("heading", { level: 1, name: "Good things, kept close." }),
  ).toBeVisible();
  await context.setOffline(true);
  await page.goto("/");
  await expect(page.locator(".bookmark-card")).toHaveCount(9);
  await expect(page.locator(".brand img")).toHaveAttribute("src", "/brand/nest-app-icon-128.webp");
  await context.setOffline(false);
});
