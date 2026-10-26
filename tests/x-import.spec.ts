import { test, expect } from "@playwright/test";

test.use({ serviceWorkers: "block" });

test("X bookmark import is opt-in and guided without an X sign-in", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      "nest-settings",
      JSON.stringify({ onboarded: true, theme: "light", effects: false }),
    );
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Import", exact: true }).click();
  await expect(page.getByRole("button", { name: "Open X import guide" })).toHaveCount(0);
  await page.getByRole("button", { name: "Close dialog" }).click();

  await page.getByRole("button", { name: "Open your preferences" }).click();
  await page.getByRole("button", { name: "Sync & data", exact: true }).click();
  const enable = page.getByRole("switch", { name: "Import from X (Twitter)" });
  await expect(enable).toHaveAttribute("aria-checked", "false");
  await enable.click();

  const wizard = page.getByRole("dialog");
  await expect(wizard.getByRole("heading", { name: "Bring your X bookmarks home." })).toBeVisible();
  await expect(wizard.getByRole("link", { name: /Open X bookmarks/ })).toHaveAttribute(
    "href",
    "https://x.com/i/bookmarks",
  );
  await wizard.getByRole("button", { name: "Continue" }).click();
  await expect(wizard.getByRole("heading", { name: "Save a CSV you can review" })).toBeVisible();
  await wizard.getByRole("button", { name: "Continue" }).click();
  await wizard.getByRole("button", { name: "Choose CSV in Nest" }).click();

  await expect(page.getByText("Your X bookmarks, coming home.")).toBeVisible();
  await page.getByLabel("Choose bookmark import file").setInputFiles({
    name: "x-bookmarks.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "author,handle,tweet text,URL,date\nA Writer,writer,Useful design tips,https://x.com/writer/status/998877,2026-10-25\n",
    ),
  });
  await expect(page.getByText(/Ready to import 1 bookmarks/)).toBeVisible();
  await page.getByRole("button", { name: "Confirm import" }).click();
  await expect(page.getByText("Useful design tips").first()).toBeVisible();

  await page.getByRole("button", { name: "Open your preferences" }).click();
  await page.getByRole("button", { name: "Sync & data", exact: true }).click();
  await expect(page.getByRole("switch", { name: "Import from X (Twitter)" })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await page.getByRole("switch", { name: "Import from X (Twitter)" }).click();
  await expect(page.getByRole("switch", { name: "Import from X (Twitter)" })).toHaveAttribute(
    "aria-checked",
    "false",
  );
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("button", { name: "Import", exact: true }).click();
  await expect(page.getByRole("button", { name: "Open X import guide" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Confirm import" })).toHaveCount(0);
  await page.getByRole("button", { name: "Close dialog" }).click();
  await expect(page.getByText("Useful design tips").first()).toBeVisible();
});

test("enabled X import can be reopened from Settings after reload", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      "nest-settings",
      JSON.stringify({ onboarded: true, theme: "light", xImportEnabled: true }),
    );
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Open your preferences" }).click();
  await page.getByRole("button", { name: "Sync & data", exact: true }).click();
  await page.getByRole("button", { name: "Open guide", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Bring your X bookmarks home." })).toBeVisible();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("button", { name: "Import", exact: true }).click();
  await expect(page.getByRole("button", { name: "Open X import guide" })).toBeVisible();
});
