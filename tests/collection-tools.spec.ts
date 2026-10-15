import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
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
});
async function readLibrary(page: Page): Promise<Library> {
  return page.evaluate(
    () =>
      new Promise((resolve) => {
        const request = indexedDB.open("nest-library", 1);
        request.onsuccess = () => {
          const db = request.result;
          const read = db.transaction("library").objectStore("library").get("current");
          read.onsuccess = () => {
            resolve(read.result);
            db.close();
          };
        };
      }),
  );
}
async function create(page: Page, name: string) {
  await page.getByRole("button", { name: "Create collection", exact: true }).click();
  await page.getByLabel("Collection name").fill(name);
  await page.getByRole("button", { name: "Create collection", exact: false }).last().click();
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
}
test("every collection appears, with search, sorting, and a phone-friendly grid", async ({
  page,
}) => {
  for (const name of ["Field notes", "Future reads", "Tiny projects", "Weekend walks"])
    await create(page, name);
  await page
    .getByRole("button", { name: /^All bookmarks/ })
    .first()
    .click();
  await expect(page.locator(".collection-card")).toHaveCount(7);
  await expect(page.locator(".collection-card").filter({ hasText: "Weekend walks" })).toBeVisible();
  await page.getByLabel("Search collections").fill("weekend");
  await expect(page.locator(".collection-card")).toHaveCount(1);
  await page.getByLabel("Search collections").fill("");
  await page.getByLabel("Sort collections").selectOption("count");
  await expect(page.locator(".collection-card").first()).toContainText("Design things");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.locator(".collection-card")).toHaveCount(7);
  expect(
    await page
      .getByLabel("Search collections")
      .evaluate((input) => getComputedStyle(input).fontSize),
  ).toBe("16px");
  await page.waitForTimeout(500);
  await page.screenshot({ path: "/workspace/scratch/nest-collections-mobile.png", fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1050 });
  await page.waitForTimeout(500);
  await page.screenshot({
    path: "/workspace/scratch/nest-collections-desktop.png",
    fullPage: true,
  });
});
test("rename, color, export, and removal keep the original bookmarks", async ({ page }) => {
  await page.getByRole("button", { name: "Manage Design things", exact: true }).click();
  await page.getByLabel("Collection name").fill("Creative field notes");
  await page.getByRole("button", { name: "peach collection color" }).click();
  await page.getByRole("button", { name: "Save collection", exact: true }).click();
  await expect(page.locator(".collection-card.collection-peach")).toContainText(
    "Creative field notes",
  );
  await page.getByRole("button", { name: "Manage Creative field notes", exact: true }).click();
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export collection", exact: true }).click();
  const path = await (await downloaded).path();
  const exported = JSON.parse(await readFile(path!, "utf8"));
  expect(exported.bookmarks).toHaveLength(5);
  expect(exported.lists[0].name).toBe("Creative field notes");
  await page.getByRole("button", { name: "Remove collection", exact: true }).click();
  await page
    .getByRole("button", { name: "Remove collection, keep bookmarks", exact: true })
    .click();
  await expect(page.locator(".collection-card")).toHaveCount(2);
  await expect(page.locator(".bookmark-card")).toHaveCount(9);
  await expect
    .poll(
      async () => !!(await readLibrary(page)).lists.find((list) => list.id === "design")?.deletedAt,
    )
    .toBe(true);
  const stored = await readLibrary(page);
  expect(stored.bookmarks.filter((bookmark) => bookmark.listIds.includes("design"))).toHaveLength(
    0,
  );
  await page.reload();
  await expect(page.locator(".collection-card")).toHaveCount(2);
  await expect(page.locator(".bookmark-card")).toHaveCount(9);
});
test("saved bookmark picker moves selections across searches without fetching URLs", async ({
  page,
}) => {
  const metadata: string[] = [];
  page.on("request", (request) => {
    if (request.url().endsWith("/api/metadata")) metadata.push(request.url());
  });
  await create(page, "Weekend discoveries");
  await page.getByRole("button", { name: "Add saved bookmarks", exact: true }).click();
  await page.getByLabel("Search saved bookmarks").fill("gardening");
  await page.getByRole("checkbox", { name: "Select A little more green in your day" }).check();
  await page.getByLabel("Search saved bookmarks").fill("fonts");
  await page.getByRole("checkbox", { name: "Select Find your type" }).check();
  await expect(page.getByText("2 selected", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Move 2 bookmarks", exact: true }).click();
  await expect(page.locator(".bookmark-card")).toHaveCount(2);
  await expect
    .poll(
      async () => (await readLibrary(page)).bookmarks.filter((bookmark) => !bookmark.demo).length,
    )
    .toBe(2);
  const stored = await readLibrary(page);
  const id = stored.lists.find((list) => list.name === "Weekend discoveries")!.id;
  expect(
    stored.bookmarks
      .filter((bookmark) => bookmark.listIds.includes(id))
      .map((bookmark) => bookmark.id)
      .sort(),
  ).toEqual(["s4", "s8"]);
  expect(stored.bookmarks.find((bookmark) => bookmark.id === "s4")!.listIds).toEqual([id]);
  expect(stored.bookmarks).toHaveLength(9);
  expect(metadata).toEqual([]);
});
test("local collection instructions preview changes and work without downloading a model", async ({
  page,
}) => {
  await page.locator(".ask-search").click();
  await page.getByLabel("Instructions for Nest").fill('Move my design bookmarks to "Research"');
  await page.getByRole("dialog").getByRole("button", { name: "Ask Nest", exact: true }).click();
  await expect(page.locator(".ai-plan li")).toHaveCount(2);
  await expect(page.locator(".ai-plan")).toContainText("replacing previous collection memberships");
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem("nest-settings")!).model),
  ).toBeUndefined();
  await expect(page.getByRole("button", { name: /^Research/ })).toHaveCount(0);
  await page.getByRole("button", { name: "Apply to 2 bookmarks", exact: true }).click();
  await expect(page.locator(".collection-card")).toHaveCount(4);
  await page
    .getByRole("button", { name: /^Research/ })
    .first()
    .click();
  await expect(page.locator(".bookmark-card")).toHaveCount(2);
  await expect
    .poll(async () => (await readLibrary(page)).lists.some((list) => list.name === "Research"))
    .toBe(true);
  const stored = await readLibrary(page);
  const id = stored.lists.find((list) => list.name === "Research")!.id;
  expect(
    stored.bookmarks
      .filter((bookmark) => bookmark.listIds.includes(id))
      .map((bookmark) => bookmark.id)
      .sort(),
  ).toEqual(["s2", "s8"]);
});
