import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import ts from "typescript";

declare global {
  interface Window {
    installEdgesForTest: (top: HTMLElement, bottom: HTMLElement) => () => void;
    cleanEdgesForTest: () => void;
  }
}
const compiled = (path: string) =>
  ts.transpileModule(readFileSync(path, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
const installer = `(()=>{const palette={exports:{}};((exports)=>{${compiled("src/lib/page-palette.ts")}})(palette.exports);const edges={exports:{}};((exports,require)=>{${compiled("src/lib/page-edges.ts")}})(edges.exports,()=>palette.exports);window.installEdgesForTest=edges.exports.installPageEdges;})();`;
async function colors(page: Page) {
  return page.evaluate(() => {
    const root = document.documentElement;
    const top = document.querySelector<HTMLElement>(".edge-top")!;
    const bottom = document.querySelector<HTMLElement>(".edge-bottom")!;
    return {
      html: getComputedStyle(root).backgroundColor,
      body: getComputedStyle(document.body).backgroundColor,
      top: getComputedStyle(top, "::after").backgroundColor,
      bottom: getComputedStyle(bottom, "::after").backgroundColor,
      topValue: root.style.getPropertyValue("--edge-top-background"),
      metas: [...document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')].map(
        (meta) => meta.content,
      ),
      viewportHeight: parseFloat(root.style.getPropertyValue("--visual-viewport-height")),
      actualViewportHeight: visualViewport?.height || innerHeight,
    };
  });
}
async function coherent(page: Page) {
  await expect
    .poll(async () => {
      const value = await colors(page);
      return (
        value.html === value.top &&
        value.body === value.bottom &&
        value.metas.length > 0 &&
        value.metas.every((meta) => meta === value.topValue) &&
        Math.abs(value.viewportHeight - value.actualViewportHeight) < 1
      );
    })
    .toBe(true);
}
test.describe("page edges", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    serviceWorkers: "block",
  });
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() =>
      localStorage.setItem(
        "nest-settings",
        JSON.stringify({ onboarded: true, theme: "light", effects: false }),
      ),
    );
  });
  test("fixed edge strips share document and theme colors without covering controls", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.locator(".bookmark-card")).toHaveCount(9);
    await coherent(page);
    const light = await colors(page);
    const geometry = await page.locator(".edge-top,.edge-bottom").evaluateAll((edges) =>
      edges.map((edge) => ({
        direct: edge.parentElement === document.body,
        hidden: edge.getAttribute("aria-hidden"),
        events: getComputedStyle(edge).pointerEvents,
        position: getComputedStyle(edge).position,
        width: edge.getBoundingClientRect().width,
        height: edge.getBoundingClientRect().height,
        transform: getComputedStyle(edge.parentElement!).transform,
      })),
    );
    expect(geometry).toHaveLength(2);
    for (const edge of geometry) {
      expect(edge.direct).toBe(true);
      expect(edge.hidden).toBe("true");
      expect(edge.events).toBe("none");
      expect(edge.position).toBe("fixed");
      expect(edge.width).toBe(390);
      expect(edge.height).toBeGreaterThanOrEqual(12);
      expect(edge.transform).toBe("none");
    }
    expect(
      await page.locator(".mobile-bottom-nav").evaluate((nav) => {
        const edge = document.querySelector(".edge-bottom")!.getBoundingClientRect();
        return [...nav.querySelectorAll("button")].every(
          (button) => button.getBoundingClientRect().bottom <= edge.top + 1,
        );
      }),
    ).toBe(true);
    await page.getByRole("button", { name: "Open your preferences", exact: true }).click();
    await page.getByRole("button", { name: "Dark", exact: true }).click();
    await page.getByRole("button", { name: "Close dialog", exact: true }).click();
    await coherent(page);
    await expect.poll(async () => (await colors(page)).top).not.toBe(light.top);
    expect((await colors(page)).top).toBe(
      await page.locator(".app-shell").evaluate((app) => getComputedStyle(app).backgroundColor),
    );
    const viewport = await page.locator('meta[name="viewport"]').getAttribute("content");
    expect(viewport).toContain("viewport-fit=cover");
  });
  test("scrolling, restored positions, and visual viewport resizes track adjacent backgrounds", async ({
    page,
    browserName,
  }) => {
    await page.goto("/guide");
    await coherent(page);
    await page.evaluate(() =>
      scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }),
    );
    await expect
      .poll(async () => (await colors(page)).bottom)
      .toBe(
        await page
          .locator(".public-footer")
          .evaluate((footer) => getComputedStyle(footer).backgroundColor),
      );
    const end = await colors(page);
    expect(end.top).not.toBe(end.bottom);
    const savedPosition = await page.evaluate(() => scrollY);
    await page.reload();
    if (browserName === "webkit") {
      // Headless WebKit resets even plain HTML on reload. Supply Safari's
      // restored position and pageshow event after the new document is ready.
      await coherent(page);
      await page.evaluate((position) => {
        scrollTo({ top: position, behavior: "instant" });
        dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true }));
      }, savedPosition);
    }
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(100);
    await coherent(page);
    await expect.poll(async () => (await colors(page)).bottom).toBe(end.bottom);
    await page.evaluate(() => {
      const region = document.createElement("section");
      region.id = "scroll-palette-fixture";
      region.dataset.edgeBackground = "#42533a";
      region.style.height = "220vh";
      document.querySelector(".public-footer")!.before(region);
      scrollTo({ top: region.getBoundingClientRect().top + scrollY, behavior: "instant" });
      dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true }));
    });
    await expect.poll(async () => (await colors(page)).top).toBe("rgb(66, 83, 58)");
    await coherent(page);
    expect((await colors(page)).bottom).toBe("rgb(66, 83, 58)");
    await page.setViewportSize({ width: 390, height: 600 });
    await coherent(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await coherent(page);
    await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
    await expect.poll(async () => (await colors(page)).top).not.toBe("rgb(66, 83, 58)");
    await coherent(page);
  });
  test("disposing a page restores shared styles, region styles, and metadata", async ({ page }) => {
    await page.goto("about:blank");
    await page.setContent(
      '<html style="background-color:rgb(11, 22, 33)!important;--edge-top-background:#abcdef;--unrelated:keep"><head><meta name="theme-color" content="#123456"></head><body style="background-color:rgb(44,55,66);margin:0"><div class="edge-top" style="position:fixed;top:0;height:12px;pointer-events:none"></div><div class="edge-bottom" style="position:fixed;bottom:0;height:12px;pointer-events:none"></div><main data-edge-background="page" style="height:2200px;--section-background:#beaded">Fixture</main></body></html>',
    );
    await page.addScriptTag({ content: installer });
    const original = await page.evaluate(() => ({
      root: document.documentElement.style.cssText,
      body: document.body.style.cssText,
      section: document.querySelector("main")!.style.cssText,
      meta: document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')!.content,
    }));
    await page.evaluate(() => {
      window.cleanEdgesForTest = window.installEdgesForTest(
        document.querySelector(".edge-top")!,
        document.querySelector(".edge-bottom")!,
      );
    });
    await expect
      .poll(() => page.evaluate(() => document.documentElement.style.cssText))
      .not.toBe(original.root);
    await page.evaluate(() => window.cleanEdgesForTest());
    const restored = () =>
      page.evaluate(() => ({
        root: document.documentElement.style.cssText,
        body: document.body.style.cssText,
        section: document.querySelector("main")!.style.cssText,
        meta: document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')!.content,
      }));
    expect(await restored()).toEqual(original);
    await page.evaluate(() => {
      document.documentElement.dataset.theme = "dark";
      document.querySelector<HTMLElement>("main")!.dataset.edgeBackground = "surface";
      scrollTo({ top: 200, behavior: "instant" });
      dispatchEvent(new Event("resize"));
      visualViewport?.dispatchEvent(new Event("resize"));
      dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true }));
    });
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
    expect(await restored()).toEqual(original);
  });
});
