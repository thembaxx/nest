import { test, expect, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { makeBookmark } from "../src/lib/bookmarks";
import type { Library } from "../src/lib/types";

test.use({ serviceWorkers: "block" });
const personal = makeBookmark("https://example.com/private-notes", {
  id: "personal",
  title: "Private field notes",
  note: "A private note for another device",
  listIds: ["notes"],
  updatedAt: 10,
});
const library: Library = {
  bookmarks: [
    personal,
    { ...personal, id: "removed", title: "Removed note", deletedAt: 20, updatedAt: 20 },
  ],
  lists: [{ id: "notes", name: "Field notes", color: "sage", updatedAt: 10 }],
};
async function device(browser: Browser, initial: Library) {
  const context = await browser.newContext({ serviceWorkers: "block" });
  await context.addInitScript((initial) => {
    if (!localStorage.getItem("nest-settings")) {
      localStorage.setItem(
        "nest-settings",
        JSON.stringify({ onboarded: true, theme: "light", effects: false }),
      );
      localStorage.setItem("nest-fallback", JSON.stringify(initial));
    }
  }, initial);
  return context;
}
async function settings(page: Page) {
  await page.getByRole("button", { name: "Open your preferences" }).click();
  await page.getByRole("button", { name: "Sync & data", exact: true }).click();
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

test("an encrypted download restores on a new device only after password validation and preview", async ({
  browser,
}) => {
  const original = await device(browser, library);
  const nextLibrary = {
    bookmarks: [makeBookmark("https://example.org/already-here", { id: "existing" })],
    lists: [],
  };
  const destination = await device(browser, nextLibrary);
  try {
    const page = await original.newPage();
    await page.goto("/");
    await settings(page);
    await page
      .getByLabel("Backup password (at least 12 characters)")
      .fill("my safe transfer password");
    await page.getByLabel("Confirm backup password").fill("my safe transfer password");
    const downloaded = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download encrypted backup" }).click();
    const file = await downloaded;
    const buffer = await readFile((await file.path())!);
    expect(buffer.toString()).not.toContain(personal.url);
    expect(buffer.toString()).not.toContain(personal.note!);
    expect(file.suggestedFilename()).toMatch(/\.nest$/);
    const next = await destination.newPage();
    await next.goto("/");
    await settings(next);
    await next
      .getByLabel("Choose a Nest backup")
      .setInputFiles({ name: "transfer.nest", mimeType: "application/json", buffer });
    await next.getByLabel("Backup password (for encrypted files)").fill("an incorrect password");
    await next.getByRole("button", { name: "Preview backup" }).click();
    await expect(next.getByRole("dialog").getByRole("alert")).toContainText(
      "Could not open this backup",
    );
    expect((await stored(next)).bookmarks.map((bookmark) => bookmark.id)).toEqual(["existing"]);
    await next
      .getByLabel("Backup password (for encrypted files)")
      .fill("my safe transfer password");
    await next.getByRole("button", { name: "Preview backup" }).click();
    await expect(next.getByRole("button", { name: "Restore backup", exact: true })).toBeVisible();
    await expect(next.locator(".backup-section .note-box")).toContainText(
      "1 bookmarks · 1 collections · 1 in trash",
    );
    expect((await stored(next)).bookmarks).toHaveLength(1);
    await next.getByRole("button", { name: "Restore backup", exact: true }).click();
    await expect.poll(async () => (await stored(next)).bookmarks.length).toBe(3);
    const restored = await stored(next);
    expect(restored.bookmarks.find((bookmark) => bookmark.id === "personal")?.note).toBe(
      personal.note,
    );
    expect(restored.bookmarks.find((bookmark) => bookmark.id === "removed")?.deletedAt).toBe(20);
    await next.reload();
    await expect(next.locator(".bookmark-card")).toHaveCount(2);
  } finally {
    await original.close();
    await destination.close();
  }
});

test("sync and restore controls fit a phone and recover the localStorage fallback", async ({
  browser,
}) => {
  const context = await device(browser, library);
  try {
    const page = await context.newPage();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await expect(page.locator(".bookmark-card")).toHaveCount(1);
    await expect.poll(async () => (await stored(page)).bookmarks.length).toBe(2);
    expect(await page.evaluate(() => localStorage.getItem("nest-fallback"))).toBeNull();
    await settings(page);
    expect(
      await page.getByRole("dialog").evaluate((dialog) => dialog.scrollWidth <= dialog.clientWidth),
    ).toBe(true);
    expect(
      await page
        .getByLabel("Backup password (at least 12 characters)")
        .evaluate((input) => getComputedStyle(input).fontSize),
    ).toBe("16px");
    await page.screenshot({ path: "/workspace/scratch/nest-sync-mobile.png" });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page
      .getByRole("heading", { name: "Your library, wherever you land." })
      .scrollIntoViewIfNeeded();
    await page.screenshot({ path: "/workspace/scratch/nest-sync-desktop.png" });
  } finally {
    await context.close();
  }
});

async function google(
  context: BrowserContext,
  files: Map<string, { id: string; name: string; data: unknown }>,
  uploads: string[],
  loseFirstResponse = false,
) {
  await context.addInitScript(() => {
    window.google = {
      accounts: {
        oauth2: {
          initTokenClient: (config) => ({
            requestAccessToken: () => {
              if (config.scope !== "https://www.googleapis.com/auth/drive.appdata")
                throw Error("Unexpected Google scope");
              config.callback({
                access_token: "memory-only-token",
                expires_in: 3600,
                scope: config.scope,
              });
            },
          }),
        },
      },
    };
  });
  await context.route("https://www.googleapis.com/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    expect(request.headers().authorization).toBe("Bearer memory-only-token");
    if (request.method() === "POST") {
      const body = request.postData()!;
      const boundary = request.headers()["content-type"].split("boundary=")[1];
      const parts = body.split(`--${boundary}`);
      const metadata = JSON.parse(parts[1].split("\r\n\r\n")[1].trim());
      const data = JSON.parse(parts[2].split("\r\n\r\n")[1].trim());
      expect(metadata.parents).toEqual(["appDataFolder"]);
      const id = `file${files.size + 1}`;
      files.set(id, { id, name: metadata.name, data });
      uploads.push(body);
      if (loseFirstResponse) {
        loseFirstResponse = false;
        await route.abort("failed");
        return;
      }
      await route.fulfill({ json: { id } });
    } else if (request.method() === "PATCH") {
      const id = url.pathname.split("/").at(-1)!;
      const body = request.postData()!;
      files.get(id)!.data = JSON.parse(body);
      uploads.push(body);
      await route.fulfill({ json: { id } });
    } else if (url.searchParams.get("alt") === "media") {
      await route.fulfill({ json: files.get(url.pathname.split("/").at(-1)!)!.data });
    } else {
      expect(url.searchParams.get("spaces")).toBe("appDataFolder");
      await route.fulfill({
        json: { files: [...files.values()].map(({ id, name }) => ({ id, name })) },
      });
    }
  });
}

test("Google pairing merges devices, never sends plaintext, and asks to reconnect after reload", async ({
  browser,
}) => {
  test.skip(
    !process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
    "Run with a public test Google client ID; Google responses are mocked.",
  );
  const first = await device(browser, library);
  const second = await device(browser, {
    bookmarks: [makeBookmark("https://example.org/second-device", { id: "second" })],
    lists: [],
  });
  const files = new Map<string, { id: string; name: string; data: unknown }>();
  const uploads: string[] = [];
  const serverRequests: string[] = [];
  for (const context of [first, second]) {
    await google(context, files, uploads);
    context.on("request", (request) => {
      if (request.url().includes("/api/sync")) serverRequests.push(request.url());
    });
  }
  try {
    const phone = await first.newPage();
    await phone.goto("/");
    await settings(phone);
    await phone.getByRole("button", { name: "Set up Google Drive", exact: true }).click();
    await expect(phone.getByText("Up to date", { exact: true })).toBeVisible();
    await expect(phone.getByText("Next: connect another device")).toBeVisible();
    await expect(phone.getByRole("button", { name: "Copy recovery key" })).toBeVisible();
    const key = await phone.evaluate(
      () => JSON.parse(localStorage.getItem("nest-settings")!).driveKey as string,
    );
    expect(key).toMatch(/^[a-f0-9]{64}$/);
    const laptop = await second.newPage();
    await laptop.goto("/");
    await settings(laptop);
    // The recovery key can be pasted in easy-to-read groups.
    await laptop.getByLabel("Already syncing on another device?").fill(key.match(/.{8}/g)!.join(" "));
    await laptop.getByRole("button", { name: "Connect Google Drive", exact: true }).click();
    await expect(laptop.getByText("Up to date", { exact: true })).toBeVisible();
    await expect.poll(async () => (await stored(laptop)).bookmarks.length).toBe(3);
    await phone.getByRole("button", { name: "Sync now", exact: true }).click();
    await expect.poll(async () => (await stored(phone)).bookmarks.length).toBe(3);
    expect(files.size).toBe(2);
    const previousUploads = uploads.length;
    await laptop.getByRole("button", { name: "Close dialog", exact: true }).click();
    await second.setOffline(true);
    await laptop.getByRole("button", { name: "Favorite Private field notes", exact: true }).click();
    await expect
      .poll(
        async () =>
          (await stored(laptop)).bookmarks.find((bookmark) => bookmark.id === "personal")?.favorite,
      )
      .toBe(true);
    await second.setOffline(false);
    await expect.poll(() => uploads.length).toBeGreaterThan(previousUploads);
    await phone.getByRole("button", { name: "Sync now", exact: true }).click();
    await expect
      .poll(
        async () =>
          (await stored(phone)).bookmarks.find((bookmark) => bookmark.id === "personal")?.favorite,
      )
      .toBe(true);
    for (const upload of uploads) {
      expect(upload).not.toContain(personal.url);
      expect(upload).not.toContain(personal.note!);
      expect(upload).not.toContain(key);
    }
    expect(await phone.evaluate(() => JSON.stringify(localStorage))).not.toContain(
      "memory-only-token",
    );
    expect(serverRequests).toEqual([]);
    await laptop.reload();
    await settings(laptop);
    await expect(
      laptop.getByRole("button", { name: "Reconnect Google", exact: true }),
    ).toBeVisible();
    await laptop.getByRole("button", { name: "Reconnect Google", exact: true }).click();
    await expect(laptop.getByText("Up to date", { exact: true })).toBeVisible();
    await laptop.getByRole("button", { name: "Disconnect Google on this device" }).click();
    expect((await stored(laptop)).bookmarks).toHaveLength(3);
    expect(files.size).toBe(2);
    expect(
      await laptop.evaluate(() => JSON.parse(localStorage.getItem("nest-settings")!).driveKey),
    ).toBeUndefined();
  } finally {
    await first.close();
    await second.close();
  }
});

test("a lost first upload response keeps its recovery key and retries without creating another snapshot", async ({
  browser,
}) => {
  test.skip(
    !process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
    "Google responses require a public test client ID in the build.",
  );
  const context = await device(browser, library);
  const files = new Map<string, { id: string; name: string; data: unknown }>();
  await google(context, files, [], true);
  try {
    const page = await context.newPage();
    await page.goto("/");
    await settings(page);
    await page.getByRole("button", { name: "Set up Google Drive", exact: true }).click();
    await expect(
      page.getByText("A recovery key is saved for your pending connection.", { exact: false }),
    ).toBeVisible();
    await expect(page.getByRole("dialog").getByRole("alert").last()).toBeVisible();
    const pending = await page.evaluate(
      () => JSON.parse(localStorage.getItem("nest-settings")!).drivePendingKey,
    );
    expect(pending).toMatch(/^[a-f0-9]{64}$/);
    expect(files.size).toBe(1);
    await page.reload();
    await settings(page);
    await page.getByRole("button", { name: "Set up Google Drive", exact: true }).click();
    await expect(page.getByText("Up to date", { exact: true })).toBeVisible();
    expect(
      await page.evaluate(() => JSON.parse(localStorage.getItem("nest-settings")!).driveKey),
    ).toBe(pending);
    expect(files.size).toBe(1);
  } finally {
    await context.close();
  }
});
