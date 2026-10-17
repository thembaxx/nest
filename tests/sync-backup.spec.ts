import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { createBackup } from "../src/lib/backup";
import { makeBookmark } from "../src/lib/bookmarks";
import { defaultSettings, type Library } from "../src/lib/types";

test.use({ serviceWorkers: "block" });
const saved = makeBookmark("https://example.com/field-notes", {
  title: "My field notes",
  note: "Keep the whole note",
  tags: ["research"],
  favorite: true,
  listIds: ["research"],
  updatedAt: 100,
});
const removed = makeBookmark("https://example.com/removed", { deletedAt: 120, updatedAt: 120 });
const fixture: Library = {
  bookmarks: [saved, removed],
  lists: [
    { id: "research", name: "Research", color: "green", updatedAt: 100 },
    { id: "empty", name: "Empty folder", color: "lilac", updatedAt: 100 },
  ],
};
const backup = createBackup(fixture, { ...defaultSettings, theme: "dark", effects: false });
async function openSettings(page: Page) {
  await page.addInitScript(() => {
    if (!localStorage.getItem("nest-settings"))
      localStorage.setItem(
        "nest-settings",
        JSON.stringify({ onboarded: true, effects: false, theme: "light" }),
      );
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Open your preferences" }).click();
  await page.getByRole("button", { name: "Sync & data", exact: true }).click();
}
async function choose(page: Page, content = backup) {
  await page.getByLabel("Choose Nest backup to restore").setInputFiles({
    name: "nest-backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(content),
  });
}
async function stored(page: Page): Promise<Library> {
  return page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const request = indexedDB.open("nest-library", 1);
        request.onsuccess = () => {
          const db = request.result;
          const get = db.transaction("library").objectStore("library").get("current");
          get.onsuccess = () => {
            resolve(get.result);
            db.close();
          };
          get.onerror = () => {
            reject(get.error);
            db.close();
          };
        };
      }),
  );
}

test("a complete downloaded backup restores on a new device and repeated restores keep IDs", async ({
  page,
  browser,
}) => {
  await openSettings(page);
  await choose(page);
  await expect(page.getByRole("region", { name: "Backup preview" })).toContainText("1 bookmark");
  await expect
    .poll(async () => (await stored(page))?.bookmarks.filter((b) => !b.demo).length)
    .toBe(0);
  await page.getByRole("button", { name: "Restore backup", exact: true }).click();
  await expect
    .poll(async () => (await stored(page)).bookmarks.filter((b) => !b.demo).length)
    .toBe(2);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "JSON", exact: true }).click();
  const download = await downloadEvent;
  const exported = await readFile((await download.path())!, "utf8");
  const data = JSON.parse(exported);
  expect(data.version).toBe(1);
  expect(data.bookmarks).toHaveLength(2);
  expect(data.bookmarks.find((b: { id: string }) => b.id === removed.id).deletedAt).toBe(120);
  expect(data.preferences.theme).toBe("dark");
  expect(data).not.toHaveProperty("syncKey");
  const nextDevice = await browser.newContext({ serviceWorkers: "block" });
  try {
    const next = await nextDevice.newPage();
    await openSettings(next);
    for (let i = 0; i < 2; i++) {
      await choose(next, exported);
      await next.getByRole("button", { name: "Restore backup", exact: true }).click();
      await expect
        .poll(async () => (await stored(next)).bookmarks.filter((b) => !b.demo).length)
        .toBe(2);
    }
    const personal = (await stored(next)).bookmarks.filter((b) => !b.demo);
    expect(personal.find((b) => b.id === saved.id)?.note).toBe(saved.note);
    expect(personal.find((b) => b.id === removed.id)?.deletedAt).toBe(120);
    await expect(next.locator("html")).toHaveAttribute("data-theme", "dark");
    await next.reload();
    await expect
      .poll(async () => (await stored(next)).bookmarks.filter((b) => !b.demo).length)
      .toBe(2);
  } finally {
    await nextDevice.close();
  }
});

test("offline restore works and invalid files leave the device library unchanged", async ({
  page,
  context,
}) => {
  await openSettings(page);
  await context.setOffline(true);
  await choose(page, "not JSON");
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText("not valid JSON");
  await expect(page.getByRole("region", { name: "Backup preview" })).toHaveCount(0);
  await expect
    .poll(async () => (await stored(page))?.bookmarks.filter((b) => !b.demo).length)
    .toBe(0);
  await choose(page);
  await page.getByLabel("Restore appearance and preferences").uncheck();
  await page.getByRole("button", { name: "Restore backup", exact: true }).click();
  await expect
    .poll(async () => (await stored(page)).bookmarks.filter((b) => !b.demo).length)
    .toBe(2);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

test("sync settings stay usable on a narrow phone", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.route("**/api/health", (route) => route.fulfill({ json: { sync: false } }));
  await openSettings(page);
  const modal = page.getByRole("dialog");
  expect(await modal.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await expect(page.getByRole("button", { name: "Choose backup", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Enable sync", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText("not configured");
  await expect(page.getByRole("button", { name: "Choose backup", exact: true })).toBeEnabled();
});

test("Google Drive pairs devices, keeps access tokens out of storage, and requests reconnect after reload", async ({
  page,
  context,
  browser,
}) => {
  test.skip(
    !process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
    "Build and run with a test Google client ID to exercise mocked OAuth.",
  );
  const files = new Map<string, { id: string; name: string; content: string }>();
  async function googleRoutes(target: BrowserContext) {
    await target.route("https://accounts.google.com/gsi/client", (route) =>
      route.fulfill({
        contentType: "application/javascript",
        body: `window.google={accounts:{oauth2:{initTokenClient:(config)=>({requestAccessToken:()=>config.callback({access_token:"browser-test-token",expires_in:3600,scope:config.scope})})}}};`,
      }),
    );
    await target.route("https://www.googleapis.com/**", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Authorization,Content-Type",
        "Access-Control-Allow-Methods": "GET,POST,PATCH,OPTIONS",
      };
      if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers });
      if (url.pathname.startsWith("/upload/")) {
        if (request.method() === "POST") {
          const parts = request
            .postData()!
            .split(/--nest-[a-f0-9-]+/)
            .filter((part) => part.includes("Content-Type"));
          const metadata = JSON.parse(parts[0].split("\r\n\r\n")[1].trim());
          const id = `file-${files.size + 1}`;
          files.set(id, { id, name: metadata.name, content: parts[1].split("\r\n\r\n")[1].trim() });
          return route.fulfill({ headers, json: { id } });
        }
        const file = files.get(url.pathname.split("/").pop()!)!;
        file.content = request.postData()!;
        return route.fulfill({ headers, json: { id: file.id } });
      }
      if (url.searchParams.has("spaces"))
        return route.fulfill({
          headers,
          json: {
            files: [...files.values()].map(({ id, name, content }) => ({
              id,
              name,
              size: String(content.length),
            })),
          },
        });
      return route.fulfill({ headers, body: files.get(url.pathname.split("/").pop()!)!.content });
    });
  }
  await googleRoutes(context);
  await openSettings(page);
  await choose(page);
  await page.getByRole("button", { name: "Restore backup", exact: true }).click();
  await page.getByRole("button", { name: "Connect Google Drive", exact: true }).click();
  await expect(page.locator(".sync-panel")).toContainText("Up to date");
  expect(files.size).toBe(1);
  expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain(
    "browser-test-token",
  );
  const second = await browser.newContext({ serviceWorkers: "block" });
  try {
    await googleRoutes(second);
    const other = await second.newPage();
    await openSettings(other);
    await other.getByRole("button", { name: "Connect Google Drive", exact: true }).click();
    await expect(other.locator(".sync-panel")).toContainText("Up to date");
    await expect
      .poll(async () => (await stored(other)).bookmarks.filter((b) => !b.demo).length)
      .toBe(2);
    expect(files.size).toBe(2);
    await other.reload();
    await other.getByRole("button", { name: "Open your preferences" }).click();
    await other.getByRole("button", { name: "Sync & data", exact: true }).click();
    await expect(
      other
        .getByRole("dialog")
        .getByRole("button", { name: "Reconnect Google Drive", exact: true }),
    ).toBeEnabled();
    await other
      .getByRole("dialog")
      .getByRole("button", { name: "Reconnect Google Drive", exact: true })
      .click();
    await expect(other.locator(".sync-panel")).toContainText("Up to date");
    await other.getByRole("button", { name: "Disconnect this device" }).click();
    await expect(other.locator(".sync-panel")).toHaveCount(0);
    await expect
      .poll(async () => (await stored(other)).bookmarks.filter((b) => !b.demo).length)
      .toBe(2);
  } finally {
    await second.close();
  }
});
