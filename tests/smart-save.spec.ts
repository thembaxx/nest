import { test, expect, type Page } from "@playwright/test";
import type { Library } from "../src/lib/types";

test.use({ serviceWorkers: "block" });
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "nest-settings",
      JSON.stringify({ onboarded: true, theme: "light", effects: false }),
    ),
  );
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Good things, kept close." })).toBeVisible();
  await page.route("**/api/metadata", (route) =>
    route.fulfill({
      json: {
        title: "A new Typescript guide",
        description: "Practical programming notes",
        status: "healthy",
      },
    }),
  );
});
async function library(page: Page): Promise<Library> {
  return page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const request = indexedDB.open("nest-library", 1);
        request.onsuccess = () => {
          const db = request.result;
          const read = db.transaction("library").objectStore("library").get("current");
          read.onsuccess = () => {
            resolve(read.result);
            db.close();
          };
          read.onerror = () => {
            reject(read.error);
            db.close();
          };
        };
        request.onerror = () => reject(request.error);
      }),
  );
}
async function paste(page: Page, value: string) {
  await page.getByRole("button", { name: "Add bookmark", exact: true }).click();
  await page.getByLabel("Links or any text with links in it").fill(value);
}
test("bare links create a requested folder, reuse its name, and move an existing bookmark", async ({
  page,
}) => {
  await paste(page, 'Save example.com/one and example.org/two under "Weekend ideas"');
  await expect(page.getByLabel("Folder", { exact: false }).first()).toHaveValue("Weekend ideas");
  await expect(page.locator(".paste-preview-row")).toHaveCount(2);
  await page.getByRole("button", { name: "Save 2 bookmarks" }).click();
  await expect(page.locator(".bookmark-card")).toHaveCount(11);
  await expect.poll(async () => (await library(page)).bookmarks.length).toBe(11);
  let saved = await library(page);
  const folder = saved.lists.find((list) => list.name === "Weekend ideas")!;
  expect(saved.bookmarks.filter((bookmark) => bookmark.listIds.includes(folder.id))).toHaveLength(
    2,
  );
  await paste(page, "Add example.net/three to my WEEKEND IDEAS folder");
  await expect(page.getByText("Uses your existing folder")).toBeVisible();
  await page.getByRole("button", { name: "Save bookmark", exact: true }).click();
  await expect(page.locator(".bookmark-card")).toHaveCount(12);
  await paste(page, 'Put example.com/one under "Research"');
  await expect(page.getByText(/1 already saved/)).toBeVisible();
  await page.getByRole("button", { name: "Save bookmark", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".toast")).toHaveText("Moved 1 existing bookmark");
  await expect
    .poll(async () => (await library(page)).lists.some((list) => list.name === "Research"))
    .toBe(true);
  saved = await library(page);
  expect(saved.lists.filter((list) => list.name.toLowerCase() === "weekend ideas")).toHaveLength(1);
  expect(saved.bookmarks).toHaveLength(12);
  const one = saved.bookmarks.find((bookmark) => bookmark.url === "https://example.com/one")!;
  expect(one.listIds).toEqual([saved.lists.find((list) => list.name === "Research")!.id]);
  await page.reload();
  await page
    .getByRole("button", { name: /^Research/ })
    .first()
    .click();
  await expect(page.locator(".bookmark-card")).toHaveCount(1);
});
test("automatic organization uses metadata and existing topic folders", async ({ page }) => {
  await paste(page, "example.com/programming");
  await page.getByRole("button", { name: "Save bookmark", exact: true }).click();
  await expect(page.locator(".bookmark-card")).toHaveCount(10);
  await expect.poll(async () => (await library(page)).bookmarks.length).toBe(10);
  const saved = await library(page);
  const bookmark = saved.bookmarks.find((item) => item.url.endsWith("/programming"))!;
  expect(bookmark.topic).toBe("Development");
  expect(bookmark.listIds).toEqual(["web"]);
  expect(saved.lists).toHaveLength(3);
});
test("section headings file one URL in multiple folders without duplicating the bookmark", async ({
  page,
}) => {
  await paste(
    page,
    "Design:\nfigma.com/project\nCode:\ngithub.com/project\nBoth:\nfigma.com/project",
  );
  await expect(page.locator(".paste-preview-row")).toHaveCount(3);
  await page.getByRole("button", { name: "Save 2 bookmarks" }).click();
  await expect(page.locator(".bookmark-card")).toHaveCount(11);
  await expect.poll(async () => (await library(page)).bookmarks.length).toBe(11);
  const saved = await library(page);
  expect(
    saved.bookmarks.find((item) => item.url.includes("figma.com/project"))!.listIds,
  ).toHaveLength(2);
  expect(saved.lists.filter((list) => ["Design", "Code", "Both"].includes(list.name))).toHaveLength(
    3,
  );
});
test("a manual folder overrides instructions and automatic organization can be disabled", async ({
  page,
}) => {
  await paste(page, 'Save example.net/unsorted under "Inferred folder"');
  await page.getByLabel("Folder", { exact: false }).first().fill("My chosen folder");
  await page.getByLabel("Organize automatically").uncheck();
  await page.getByRole("button", { name: "Save bookmark", exact: true }).click();
  await expect(page.locator(".bookmark-card")).toHaveCount(10);
  await expect.poll(async () => (await library(page)).bookmarks.length).toBe(10);
  const saved = await library(page);
  expect(saved.lists.some((list) => list.name === "Inferred folder")).toBe(false);
  const bookmark = saved.bookmarks.find((item) => item.url.endsWith("/unsorted"))!;
  expect(bookmark.topic).toBe("Unsorted");
  expect(bookmark.listIds).toEqual([
    saved.lists.find((list) => list.name === "My chosen folder")!.id,
  ]);
});
test("Ask Nest routes pasted links to the folder preview without a model", async ({ page }) => {
  await page.locator(".ask-search").click();
  await page.getByLabel("Instructions for Nest").fill('Save github.com/example under "Learning"');
  await page.getByRole("dialog").getByRole("button", { name: "Ask Nest", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Something worth keeping." })).toBeVisible();
  await expect(page.getByLabel("Links or any text with links in it")).toHaveValue(
    'Save github.com/example under "Learning"',
  );
  await expect(page.locator(".paste-preview-row")).toContainText("Learning");
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.locator(".ask-search").click();
  await page.getByLabel("Instructions for Nest").fill("Find github.com bookmarks");
  await page.getByRole("dialog").getByRole("button", { name: "Ask Nest", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByLabel("Search bookmarks")).toHaveValue("Find github.com bookmarks");
});
test("all input fields stay at 16px in desktop and mobile flows", async ({ page }) => {
  async function checkFields() {
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      expect(
        await page
          .locator("input, textarea, select")
          .evaluateAll((fields) =>
            fields
              .filter((field) => getComputedStyle(field).fontSize !== "16px")
              .map((field) => ({ id: field.id, size: getComputedStyle(field).fontSize })),
          ),
      ).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      if (await page.getByRole("dialog").count())
        expect(
          await page
            .getByRole("dialog")
            .evaluate((dialog) => dialog.scrollWidth <= dialog.clientWidth + 1),
        ).toBe(true);
    }
    await page.setViewportSize({ width: 1440, height: 900 });
  }
  await checkFields();
  await paste(page, 'Save example.com under "A folder"');
  await checkFields();
  await page.screenshot({ path: "/workspace/scratch/nest-paste-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "/workspace/scratch/nest-paste-mobile.png", fullPage: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("button", { name: "Edit A place for connecting ideas" }).click();
  await checkFields();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("button", { name: "Create collection", exact: true }).click();
  await checkFields();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.locator(".ask-search").click();
  await checkFields();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("button", { name: "Settings & preferences", exact: true }).first().click();
  await checkFields();
  await page.getByRole("button", { name: "Sync & data", exact: true }).click();
  await checkFields();
});

test("adding links from a collection saves new links and moves existing bookmarks without copies", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Edit A place for connecting ideas" }).click();
  await page.getByLabel("A note to your future self").fill("My collection move note");
  await page.getByRole("button", { name: "Save changes" }).click();
  await page.getByRole("button", { name: "Create collection", exact: true }).click();
  await page.getByLabel("Collection name").fill("Study queue");
  await page.getByRole("button", { name: "Create collection", exact: false }).last().click();
  await expect(page.getByRole("heading", { name: "Study queue" })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Add links", exact: true }).click();
  await expect(page.locator("#collection")).toHaveValue("Study queue");
  await page.getByLabel("Links or any text with links in it").fill("are.na\nexample.com/new-link");
  await expect(page.getByText("Existing links move out", { exact: false })).toBeVisible();
  const metadataUrls: string[] = [];
  page.on("request", (request) => {
    if (request.url().endsWith("/api/metadata")) metadataUrls.push(request.postDataJSON().url);
  });
  await page.getByRole("button", { name: "Save 2 bookmarks" }).click();
  await expect(page.locator(".bookmark-card")).toHaveCount(2);
  await expect.poll(async () => (await library(page)).bookmarks.length).toBe(10);
  let saved = await library(page);
  const target = saved.lists.find((list) => list.name === "Study queue")!;
  const original = saved.bookmarks.find((bookmark) => bookmark.id === "s1")!;
  expect(original.listIds).toEqual([target.id]);
  expect(original.note).toBe("My collection move note");
  expect(original.favorite).toBe(true);
  expect(original.tags).toEqual(["creativity", "community"]);
  expect(original.demo).toBe(false);
  expect(metadataUrls).toEqual(["https://example.com/new-link"]);
  await page.reload();
  await expect(page.locator(".bookmark-card")).toHaveCount(10);
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page
    .getByRole("button", { name: /^Study queue/ })
    .first()
    .click();
  await expect(page.locator(".bookmark-card")).toHaveCount(2);
  await page
    .locator(".mobile-bottom-nav")
    .getByRole("button", { name: "Add bookmark", exact: true })
    .click();
  await expect(page.locator("#collection")).toHaveValue("Study queue");
  await page.getByLabel("Links or any text with links in it").fill("are.na");
  await page.getByRole("button", { name: "Save bookmark", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  saved = await library(page);
  expect(saved.bookmarks).toHaveLength(10);
  expect(saved.bookmarks.find((bookmark) => bookmark.id === "s1")!.listIds).toEqual([target.id]);
});
