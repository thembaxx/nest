import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { makeBookmark } from "../src/lib/bookmarks";
import type { Library } from "../src/lib/types";

test.use({ serviceWorkers: "block" });
const saved = makeBookmark("https://example.com/field-notes", {
  id: "field-notes",
  title: "My field notes",
  note: "Keep the whole note",
  tags: ["research"],
  favorite: true,
  listIds: ["research"],
  updatedAt: 100,
});
const removed = makeBookmark("https://example.com/removed", {
  id: "removed",
  deletedAt: 120,
  updatedAt: 120,
});
const fixture: Library = {
  bookmarks: [saved, removed],
  lists: [
    { id: "research", name: "Research", color: "green", updatedAt: 100 },
    { id: "empty", name: "Empty folder", color: "lilac", updatedAt: 100 },
  ],
};
// This is the version-1 shape already shipped on main before encrypted backups were merged.
const backup = JSON.stringify({
  format: "nest-backup",
  version: 1,
  exportedAt: "2026-10-17T00:00:00.000Z",
  ...fixture,
  preferences: { theme: "dark", effects: false },
});
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
  await page.getByLabel("Choose a Nest backup").setInputFiles({
    name: "nest-backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(content),
  });
  await page.getByRole("button", { name: "Preview backup", exact: true }).click();
}
async function stored(page: Page): Promise<Library> {
  return page.evaluate(
    () =>
      new Promise<Library>((resolve, reject) => {
        const open = indexedDB.open("nest-library", 1);
        // A read must not create an empty database ahead of the app's first write.
        open.onupgradeneeded = () => open.transaction?.abort();
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          if (!db.objectStoreNames.contains("library")) {
            db.close();
            reject(Error("Library storage is not ready yet."));
            return;
          }
          const request = db.transaction("library").objectStore("library").get("current");
          request.onerror = () => {
            db.close();
            reject(request.error);
          };
          request.onsuccess = () => {
            resolve(request.result);
            db.close();
          };
        };
      }),
  );
}

test("previously shipped JSON backups transfer between profiles and repeated restores preserve IDs", async ({
  page,
  browser,
}) => {
  await openSettings(page);
  await choose(page);
  await expect(page.getByRole("region", { name: "Backup preview" })).toContainText("1 bookmarks");
  expect((await stored(page)).bookmarks.filter((item) => !item.demo)).toHaveLength(0);
  await page.getByRole("button", { name: "Restore backup", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "JSON", exact: true }).click();
  const exported = await readFile((await (await downloaded).path())!, "utf8");
  const data = JSON.parse(exported);
  expect(data.version).toBe(1);
  expect(data.library.bookmarks).toHaveLength(2);
  expect(
    data.library.bookmarks.find((item: { id: string }) => item.id === removed.id).deletedAt,
  ).toBe(120);
  expect(data.preferences.theme).toBe("dark");
  expect(exported).not.toContain("syncKey");
  const nextDevice = await browser.newContext({ serviceWorkers: "block" });
  try {
    const next = await nextDevice.newPage();
    await openSettings(next);
    for (let i = 0; i < 2; i++) {
      await choose(next, exported);
      await next.getByRole("button", { name: "Restore backup", exact: true }).click();
      await expect
        .poll(async () => (await stored(next)).bookmarks.filter((item) => !item.demo).length)
        .toBe(2);
    }
    const personal = (await stored(next)).bookmarks.filter((item) => !item.demo);
    expect(personal.find((item) => item.id === saved.id)?.note).toBe(saved.note);
    expect(personal.find((item) => item.id === removed.id)?.deletedAt).toBe(120);
    expect((await stored(next)).lists.some((list) => list.id === "empty")).toBe(true);
    await expect(next.locator("html")).toHaveAttribute("data-theme", "dark");
    await next.reload();
    await expect
      .poll(async () => (await stored(next)).bookmarks.filter((item) => !item.demo).length)
      .toBe(2);
  } finally {
    await nextDevice.close();
  }
});

test("offline restore rejects invalid files and can keep this device’s appearance", async ({
  page,
  context,
}) => {
  await openSettings(page);
  await context.setOffline(true);
  await choose(page, "not JSON");
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "Could not open this backup",
  );
  await expect(page.getByRole("region", { name: "Backup preview" })).toHaveCount(0);
  expect((await stored(page)).bookmarks.filter((item) => !item.demo)).toHaveLength(0);
  await choose(page);
  await page.getByLabel("Restore appearance and preferences").uncheck();
  await page.getByRole("button", { name: "Restore backup", exact: true }).click();
  await expect
    .poll(async () => (await stored(page)).bookmarks.filter((item) => !item.demo).length)
    .toBe(2);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

test("local backup remains available on a 320px phone when legacy sync is unconfigured", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.route("**/api/health", (route) => route.fulfill({ json: { sync: false } }));
  await openSettings(page);
  expect(
    await page
      .getByRole("dialog")
      .evaluate((element) => element.scrollWidth <= element.clientWidth),
  ).toBe(true);
  await page.getByText("Legacy Nest cloud sync", { exact: true }).click();
  await page.getByRole("button", { name: "Enable legacy sync", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText("unavailable");
  await expect(page.getByLabel("Choose a Nest backup")).toBeEnabled();
});

test("upgrading a Google-synced device reads older Drive snapshots and creates an encrypted copy", async ({
  page,
  context,
}) => {
  test.skip(
    !process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
    "Mocked OAuth requires a public test client ID in the build.",
  );
  await page.addInitScript(() =>
    localStorage.setItem(
      "nest-settings",
      JSON.stringify({
        onboarded: true,
        effects: false,
        theme: "light",
        syncProvider: "google",
        syncKey: "a".repeat(64),
      }),
    ),
  );
  const legacyName = "nest-library-11111111-1111-4111-8111-111111111111.json";
  const files = new Map<string, { id: string; name: string; content: string }>([
    ["legacy", { id: "legacy", name: legacyName, content: backup }],
  ]);
  const serverRequests: string[] = [];
  const uploads: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/sync")) serverRequests.push(request.url());
  });
  await context.route("https://accounts.google.com/gsi/client", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: `window.google={accounts:{oauth2:{initTokenClient:(config)=>({requestAccessToken:()=>config.callback({access_token:"browser-test-token",expires_in:3600,scope:config.scope})})}}};`,
    }),
  );
  await context.route("https://www.googleapis.com/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname.startsWith("/upload/")) {
      const body = request.postData()!;
      uploads.push(body);
      const boundary = request.headers()["content-type"].split("boundary=")[1];
      const parts = body.split(`--${boundary}`);
      const metadata = JSON.parse(parts[1].split("\r\n\r\n")[1].trim());
      const id = "encrypted";
      files.set(id, { id, name: metadata.name, content: parts[2].split("\r\n\r\n")[1].trim() });
      await route.fulfill({ json: { id } });
      return;
    }
    if (url.searchParams.has("spaces")) {
      expect(url.searchParams.get("q")).toContain("value='nest'");
      await route.fulfill({
        json: { files: [...files.values()].map(({ id, name }) => ({ id, name })) },
      });
      return;
    }
    await route.fulfill({
      body: files.get(url.pathname.split("/").at(-1)!)!.content,
      contentType: "application/json",
    });
  });
  await openSettings(page);
  await expect(page.locator(".sync-status")).toContainText("Reconnect Google Drive");
  expect(serverRequests).toEqual([]);
  await page.getByRole("button", { name: "Set up Google Drive", exact: true }).click();
  await expect(page.getByText("Up to date", { exact: true })).toBeVisible();
  await expect
    .poll(async () => (await stored(page)).bookmarks.filter((item) => !item.demo).length)
    .toBe(2);
  expect(files.get("legacy")!.content).toBe(backup);
  expect(JSON.parse(files.get("encrypted")!.content).format).toBe("nest-encrypted");
  expect(uploads.join("")).not.toContain(saved.note!);
  expect(serverRequests).toEqual([]);
  expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain(
    "browser-test-token",
  );
});
