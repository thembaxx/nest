import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

test.use({ serviceWorkers: "block" });

async function settings(page: Page) {
  await page.getByRole("button", { name: "Open your preferences" }).click();
  await page.getByRole("button", { name: "Sync & data", exact: true }).click();
}

test("first visit imports, organizes, retrieves, exports and restores on a phone", async ({
  page,
  browser,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 320, height: 740 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByRole("button", { name: "Import my bookmarks", exact: true }).click();
  await page.getByLabel("Choose bookmark import file").setInputFiles({
    name: "bad.json",
    mimeType: "application/json",
    buffer: Buffer.from("{broken"),
  });
  await expect(page.getByRole("dialog").getByRole("alert")).toBeVisible();
  await page.getByLabel("Choose bookmark import file").setInputFiles({
    name: "browser.html",
    mimeType: "text/html",
    buffer: Buffer.from(
      '<!DOCTYPE NETSCAPE-Bookmark-file-1><DL><DT><H3>Design things</H3><DL><DT><A HREF="https://www.are.na/">My actual reference</A><DT><A HREF="https://example.com/notes">Field notes</A><DT><A HREF="https://example.com/notes?utm_source=browser">Duplicate</A></DL></DL>',
    ),
  });
  await expect(page.getByText("Ready to import 3 bookmarks")).toBeVisible();
  await expect(page.getByRole("checkbox", { name: /Remove untouched samples/ })).toBeChecked();
  await page.getByRole("button", { name: "Confirm import" }).click();
  await expect(page.locator(".bookmark-card")).toHaveCount(2);
  await expect(page.getByRole("region", { name: "Sample library" })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole("button", { name: "Edit Field notes" }).click();
  await page.getByLabel("A note to your future self").fill("Mountain trail research");
  await page.getByRole("button", { name: "Save changes" }).click();
  await page.keyboard.press("Control+k");
  await expect(page.getByRole("textbox", { name: "Search bookmarks" })).toBeFocused();
  await page.keyboard.type("mountain trail");
  await expect(page.locator(".bookmark-card")).toHaveCount(1);
  await page.getByRole("button", { name: "Clear search" }).click();
  await expect(page.locator(".sync-status")).toContainText("Saved on this device");
  await page.reload();
  await expect(page.locator(".bookmark-card")).toHaveCount(2);
  await settings(page);
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "JSON", exact: true }).click();
  const content = await readFile((await (await downloading).path())!, "utf8");
  const backup = JSON.parse(content);
  expect(backup.library.bookmarks).toHaveLength(2);
  expect(backup.library.lists.map((list: { name: string }) => list.name)).toEqual([
    "Design things",
  ]);
  expect(content).toContain("Mountain trail research");
  expect(content).not.toContain('"demo":true');
  const transfer = await browser.newContext({ serviceWorkers: "block" });
  try {
    const restored = await transfer.newPage();
    await restored.addInitScript(() =>
      localStorage.setItem("nest-settings", JSON.stringify({ onboarded: true, effects: false })),
    );
    await restored.goto("/");
    await settings(restored);
    await restored.getByLabel("Choose a Nest backup").setInputFiles({
      name: "backup.json",
      mimeType: "application/json",
      buffer: Buffer.from(content),
    });
    await restored.getByRole("button", { name: "Preview backup", exact: true }).click();
    await restored.getByRole("button", { name: "Restore backup", exact: true }).click();
    await restored.getByRole("button", { name: "Close dialog" }).click();
    await restored.getByRole("textbox", { name: "Search bookmarks" }).fill("mountain trail");
    await expect(restored.locator(".bookmark-card")).toHaveCount(1);
    await restored.reload();
    await restored.getByRole("textbox", { name: "Search bookmarks" }).fill("mountain trail");
    await expect(restored.locator(".bookmark-card")).toHaveCount(1);
  } finally {
    await transfer.close();
  }
  expect(errors).toEqual([]);
});

test("corrupt fallback is preserved, downloadable, and can be retried", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("nest-fallback", "my unreadable original library");
    localStorage.setItem(
      "nest-settings",
      JSON.stringify({ onboarded: true, driveKey: "private-key-must-not-export" }),
    );
  });
  await page.goto("/");
  await expect(page.getByRole("region", { name: "Library recovery" })).toBeVisible();
  await expect(page.locator(".bookmark-card")).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem("nest-fallback"))).toBe(
    "my unreadable original library",
  );
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download stored copy" }).click();
  const content = await readFile((await (await downloading).path())!, "utf8");
  expect(content).toContain("my unreadable original library");
  expect(content).not.toContain("private-key-must-not-export");
  await page.evaluate(() =>
    localStorage.setItem("nest-fallback", JSON.stringify({ bookmarks: [], lists: [] })),
  );
  await page.getByRole("button", { name: "Try opening again" }).click();
  await expect(
    page.getByRole("heading", { name: "A little space for something good." }),
  ).toBeVisible();
});

test("a corrupt IndexedDB copy cannot be replaced with sample data", async ({ page }) => {
  await page.goto("/about");
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open("nest-library", 1);
        request.onupgradeneeded = () => request.result.createObjectStore("library");
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const transaction = db.transaction("library", "readwrite");
          transaction
            .objectStore("library")
            .put({ bookmarks: "original damaged copy", lists: [] }, "current");
          transaction.oncomplete = () => {
            db.close();
            resolve();
          };
        };
      }),
  );
  await page.goto("/");
  await expect(page.getByRole("region", { name: "Library recovery" })).toBeVisible();
  await page.getByRole("button", { name: "Try opening again" }).click();
  await expect(
    page.getByRole("region", { name: "Library recovery" }).getByRole("alert"),
  ).toContainText("stored copy has been kept");
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download stored copy" }).click();
  expect(await readFile((await (await downloading).path())!, "utf8")).toContain(
    "original damaged copy",
  );
});

test("quota failure remains visible with backup and retry while the tab keeps changes", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem("nest-settings", JSON.stringify({ onboarded: true, effects: false })),
  );
  await page.goto("/");
  await expect(page.locator(".sync-status")).toContainText("Saved on this device");
  await page.evaluate(() => {
    const put = IDBObjectStore.prototype.put;
    const set = Storage.prototype.setItem;
    IDBObjectStore.prototype.put = () => {
      throw new DOMException("Test quota", "QuotaExceededError");
    };
    Storage.prototype.setItem = function (key, value) {
      if (key === "nest-fallback") throw new DOMException("Test quota", "QuotaExceededError");
      return set.call(this, key, value);
    };
    (window as unknown as { restoreStorage: () => void }).restoreStorage = () => {
      IDBObjectStore.prototype.put = put;
      Storage.prototype.setItem = set;
    };
  });
  await page.getByRole("button", { name: "Unfavorite A place for connecting ideas" }).click();
  await expect(page.getByRole("region", { name: "Unsaved changes" })).toContainText(
    "only in this tab",
  );
  await expect(page.locator(".sync-status")).toContainText("Changes not saved");
  await page.getByRole("button", { name: "Back up my library" }).click();
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "JSON", exact: true }).click();
  const content = JSON.parse(await readFile((await (await downloading).path())!, "utf8"));
  expect(content.library.bookmarks[0].favorite).toBe(false);
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.evaluate(() => (window as unknown as { restoreStorage: () => void }).restoreStorage());
  await page.getByRole("button", { name: "Retry saving" }).click();
  await expect(page.getByRole("region", { name: "Unsaved changes" })).toHaveCount(0);
  await expect(page.locator(".sync-status")).toContainText("Saved on this device");
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Favorite A place for connecting ideas", exact: true }),
  ).toBeVisible();
});

test("sample exploration, empty start, dialogs and public help work with keyboard and reduced motion", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByRole("button", { name: "A little look around" }).click();
  await page.getByRole("button", { name: "Start with an empty Nest" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".bookmark-card")).toHaveCount(0);
  await expect(page.locator(".collection-card:not(.collection-create)")).toHaveCount(0);
  await page.getByRole("button", { name: "Add bookmark", exact: true }).first().focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Tab");
  expect(
    await page.getByRole("dialog").evaluate((dialog) => dialog.contains(document.activeElement)),
  ).toBe(true);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  for (const width of [320, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
  await page.getByRole("link", { name: "Case study", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Good finds deserve a way back.",
  );
  await page.getByRole("link", { name: "Follow the guide" }).click();
  await expect(
    page.getByRole("heading", { name: "When something needs a little care." }),
  ).toBeVisible();
});
