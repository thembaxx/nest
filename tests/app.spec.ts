import { test, expect } from "@playwright/test";
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "nest-settings",
      JSON.stringify({ onboarded: true, theme: "light", effects: false }),
    ),
  );
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Good things, kept close." })).toBeVisible();
});
test("search, topic filters, favorites, and collection navigation", async ({ page }) => {
  await expect(page.locator(".bookmark-card")).toHaveCount(9);
  await page.getByRole("button", { name: "Design", exact: true }).first().click();
  await expect(page.locator(".bookmark-card")).toHaveCount(2);
  await page.getByRole("button", { name: "Everything", exact: false }).click();
  await page.getByRole("textbox", { name: "Search bookmarks" }).fill("gardening");
  await expect(page.locator(".bookmark-card")).toHaveCount(1);
  await page.getByRole("button", { name: "Clear search" }).click();
  await page
    .getByRole("button", { name: /^Favorites/ })
    .first()
    .click();
  await expect(page.locator(".bookmark-card")).toHaveCount(3);
  await page
    .getByRole("button", { name: /^Design things/ })
    .first()
    .click();
  await expect(page.locator(".bookmark-card")).toHaveCount(5);
});
test.describe("metadata import with deterministic network responses", () => {
  // Service-worker-owned requests bypass page.route(); offline behavior has separate coverage.
  test.use({ serviceWorkers: "block" });
  test("bulk paste, deduplication, automatic topic, and persistence", async ({ page }) => {
    await page.route("**/api/metadata", (route) =>
      route.fulfill({
        json: {
          title: "Typescript testing guide",
          description: "A guide to better code",
          status: "healthy",
        },
      }),
    );
    await page.getByRole("button", { name: "Add bookmark", exact: true }).click();
    await page
      .getByLabel("Links or any text with links in it")
      .fill(
        "Keep https://example.com/typescript and https://example.org/guide plus https://www.are.na/",
      );
    await page.getByRole("button", { name: "Save 3 bookmarks" }).click();
    await expect(page.locator(".bookmark-card")).toHaveCount(11);
    await page.getByRole("textbox", { name: "Search bookmarks" }).fill("typescript");
    await expect(page.locator(".bookmark-card")).toHaveCount(2);
    await expect(page.locator(".bookmark-card .topic-tag").first()).toHaveText("Development");
    await page.waitForTimeout(400);
    await page.reload();
    await expect(page.locator(".bookmark-card")).toHaveCount(11);
  });
});
test("browser HTML import preserves folders and skips duplicates", async ({ page }) => {
  await page.getByRole("button", { name: "Import", exact: true }).click();
  await page.getByLabel("Choose bookmark import file").setInputFiles({
    name: "bookmarks.html",
    mimeType: "text/html",
    buffer: Buffer.from(
      '<!DOCTYPE NETSCAPE-Bookmark-file-1><DL><p><DT><H3>Research notes</H3><DL><p><DT><A HREF="https://example.net/research">A research note</A><DT><A HREF="https://example.net/research?utm_source=browser">Same bookmark</A></DL><p></DL>',
    ),
  });
  await expect(page.getByText("Ready to import 2 bookmarks")).toBeVisible();
  await page.getByRole("button", { name: "Confirm import" }).click();
  await expect(page.locator(".bookmark-card")).toHaveCount(1);
  await expect(page.getByRole("button", { name: /Research notes/ }).first()).toBeVisible();
  await page.getByRole("textbox", { name: "Search bookmarks" }).fill("research");
  await expect(page.locator(".bookmark-card")).toHaveCount(1);
});
test("create a collection and edit bookmark notes, tags, and membership", async ({ page }) => {
  await page.getByRole("button", { name: "Create collection", exact: true }).click();
  await page.getByLabel("Collection name").fill("Weekend ideas");
  await page.getByRole("button", { name: "Create collection", exact: false }).last().click();
  await expect(page.getByRole("heading", { name: "Weekend ideas" })).toBeVisible();
  await page
    .getByRole("button", { name: /All bookmarks/ })
    .first()
    .click();
  await page.getByRole("button", { name: "Edit A place for connecting ideas" }).click();
  await page.getByLabel("A note to your future self").fill("Remember this for the next project");
  await page.getByLabel("Tags", { exact: false }).fill("ideas, next project");
  await page.getByRole("checkbox", { name: "Weekend ideas", exact: true }).check();
  await page.getByRole("button", { name: "Save changes" }).click();
  await page
    .getByRole("button", { name: /Weekend ideas/ })
    .first()
    .click();
  await expect(page.locator(".bookmark-card")).toHaveCount(1);
});
test("PWA manifest, service worker, and offline reload keep the library usable", async ({
  page,
  context,
}) => {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller)
      await new Promise<void>((resolve) =>
        navigator.serviceWorker.addEventListener("controllerchange", () => resolve(), {
          once: true,
        }),
      );
  });
  await page.waitForTimeout(700);
  const manifest = await page.request.get("/manifest.webmanifest");
  expect((await manifest.json()).share_target.params.url).toBe("url");
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Good things, kept close." })).toBeVisible();
  await expect(page.locator(".bookmark-card")).toHaveCount(9);
  await page.getByRole("textbox", { name: "Search bookmarks" }).fill("garden");
  await expect(page.locator(".bookmark-card")).toHaveCount(1);
  await context.setOffline(false);
});
test("mobile layout and dark theme remain usable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".mobile-bottom-nav")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page
    .locator(".mobile-bottom-nav")
    .getByRole("button", { name: "Settings", exact: true })
    .click();
  await page.getByRole("button", { name: "Dark", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.waitForTimeout(650);
  await page.screenshot({ path: "/workspace/scratch/nest-mobile-dark.png", fullPage: true });
});
test("desktop visual capture", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1050 });
  await page.waitForTimeout(650);
  await page.screenshot({ path: "/workspace/scratch/nest-desktop.png", fullPage: true });
});
