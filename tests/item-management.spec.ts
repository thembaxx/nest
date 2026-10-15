import { test, expect } from "@playwright/test";
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "nest-settings",
      JSON.stringify({ onboarded: true, theme: "light", effects: false }),
    ),
  );
  await page.goto("/");
  await expect(page.locator(".bookmark-card")).toHaveCount(9);
});
test("sidebar options rename or remove a collection while retaining all links", async ({
  page,
}) => {
  await page
    .getByRole("button", { name: "Collection options for Design things", exact: true })
    .click();
  await expect(page.getByRole("heading", { name: "Edit collection", exact: true })).toBeVisible();
  await page.getByLabel("Collection name").fill("Visual references");
  await page.getByRole("button", { name: "Save collection", exact: true }).click();
  await page
    .getByRole("button", { name: "Collection options for Visual references", exact: true })
    .click();
  await page.getByRole("button", { name: "Remove collection", exact: true }).click();
  await page
    .getByRole("button", { name: "Remove collection, keep bookmarks", exact: true })
    .click();
  await expect(page.locator(".collection-card")).toHaveCount(2);
  await expect(page.locator(".bookmark-card")).toHaveCount(9);
});
test("a bookmark can leave one collection and be renamed, trashed, and restored", async ({
  page,
}) => {
  await page
    .getByRole("button", { name: /^Design things/ })
    .first()
    .click();
  await expect(page.locator(".bookmark-card")).toHaveCount(5);
  await page
    .getByRole("button", {
      name: "Remove A place for connecting ideas from Design things",
      exact: true,
    })
    .click();
  await expect(page.locator(".bookmark-card")).toHaveCount(4);
  await page
    .getByRole("button", { name: /^All bookmarks/ })
    .first()
    .click();
  await expect(page.locator(".bookmark-card")).toHaveCount(9);
  await page
    .getByRole("button", { name: "Edit A place for connecting ideas", exact: true })
    .click();
  await page.getByLabel("Title", { exact: true }).fill("My inspiration shelf");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await page.getByRole("button", { name: "Edit My inspiration shelf", exact: true }).click();
  await page.getByRole("button", { name: "Move to trash", exact: true }).click();
  await expect(page.locator(".bookmark-card")).toHaveCount(8);
  await page.getByRole("button", { name: "Open your preferences", exact: true }).click();
  await page.getByRole("button", { name: "Sync & data", exact: true }).click();
  await expect(page.locator(".trash-list")).toContainText("My inspiration shelf");
  await page.locator(".trash-list").getByRole("button", { name: "Restore", exact: true }).click();
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await expect(page.locator(".bookmark-card")).toHaveCount(9);
  await expect(
    page.getByRole("button", { name: "Edit My inspiration shelf", exact: true }),
  ).toBeVisible();
});
