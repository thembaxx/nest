import { pagePalettes, type PagePalette } from "./page-palette";

/** Own document changes for one route; callers must dispose when that route leaves. */
export function installPageEdges(top: HTMLElement, bottom: HTMLElement) {
  const root = document.documentElement;
  const body = document.body;
  const view = window.visualViewport;
  const media = matchMedia("(prefers-color-scheme: dark)");
  const rootProperties = [
    "--page-background",
    "--page-surface-background",
    "--page-sidebar-background",
    "--edge-top-background",
    "--edge-bottom-background",
    "--visual-edge-top",
    "--visual-edge-bottom",
    "--visual-viewport-height",
    "background-color",
  ];
  const snapshot = (style: CSSStyleDeclaration, properties: string[]) =>
    properties.map((property) => ({
      property,
      value: style.getPropertyValue(property),
      priority: style.getPropertyPriority(property),
    }));
  const originalRoot = snapshot(root.style, rootProperties);
  const originalBody = snapshot(body.style, ["background-color"]);
  const originalMetas = new Map<HTMLMetaElement, string | null>();
  const originalRegions = new Map<HTMLElement, { value: string; priority: string }>();
  let frame = 0;
  let restorationFrame = 0;
  let disposed = false;
  let lastPalette = "";
  const set = (style: CSSStyleDeclaration, property: string, value: string) => {
    if (style.getPropertyValue(property) !== value) style.setProperty(property, value);
  };
  function regionColor(region: HTMLElement, palette: PagePalette) {
    const key = region.dataset.edgeBackground || "page";
    if (key === "page" || key === "surface" || key === "sidebar") return palette[key];
    return CSS.supports("color", key) ? key : palette.page;
  }
  function colorAt(x: number, y: number, palette: PagePalette) {
    for (const element of document.elementsFromPoint(x, y)) {
      if (element.closest(".edge-top, .edge-bottom")) continue;
      const region = element.closest<HTMLElement>("[data-edge-background]");
      if (!region) continue;
      const rect = region.getBoundingClientRect();
      if (rect.top <= y && rect.bottom >= y && rect.left <= x && rect.right >= x)
        return regionColor(region, palette);
    }
    return palette.page;
  }
  function update() {
    frame = 0;
    if (disposed) return;
    const palette = root.dataset.theme === "dark" ? pagePalettes.dark : pagePalettes.light;
    for (const region of document.querySelectorAll<HTMLElement>("[data-edge-background]")) {
      if (!originalRegions.has(region))
        originalRegions.set(region, {
          value: region.style.getPropertyValue("--section-background"),
          priority: region.style.getPropertyPriority("--section-background"),
        });
      set(region.style, "--section-background", regionColor(region, palette));
    }
    const offsetTop = Math.max(0, view?.offsetTop || 0);
    const height = view?.height || innerHeight;
    const offsetBottom = Math.max(0, innerHeight - height - offsetTop);
    set(root.style, "--visual-edge-top", `${offsetTop}px`);
    set(root.style, "--visual-edge-bottom", `${offsetBottom}px`);
    set(root.style, "--visual-viewport-height", `${height}px`);
    const x = Math.min(
      innerWidth - 1,
      Math.max(1, (view?.offsetLeft || 0) + (view?.width || innerWidth) / 2),
    );
    const topY = Math.min(innerHeight - 1, offsetTop + top.getBoundingClientRect().height + 1);
    const bottomY = Math.max(
      topY,
      Math.min(innerHeight - 1, offsetTop + height - bottom.getBoundingClientRect().height - 1),
    );
    // Resolve once per frame, then share these exact values across all paint surfaces.
    const colors = {
      ...palette,
      top: colorAt(x, topY, palette),
      bottom: colorAt(x, bottomY, palette),
    };
    const signature = JSON.stringify(colors);
    if (signature !== lastPalette) {
      set(root.style, "--page-background", colors.page);
      set(root.style, "--page-surface-background", colors.surface);
      set(root.style, "--page-sidebar-background", colors.sidebar);
      set(root.style, "--edge-top-background", colors.top);
      set(root.style, "--edge-bottom-background", colors.bottom);
      lastPalette = signature;
    }
    for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
      if (!originalMetas.has(meta)) originalMetas.set(meta, meta.getAttribute("content"));
      if (meta.content !== colors.top) meta.content = colors.top;
    }
  }
  function schedule() {
    if (!disposed && !frame) frame = requestAnimationFrame(update);
  }
  function systemTheme() {
    let theme = "system";
    try {
      theme = JSON.parse(localStorage.getItem("nest-settings") || "{}").theme || "system";
    } catch {}
    if (theme === "system") {
      const next = media.matches ? "dark" : "light";
      if (root.dataset.theme !== next) root.dataset.theme = next;
    }
    schedule();
  }
  function restored() {
    schedule();
    // Scroll restoration and Safari toolbar geometry can settle after pageshow.
    cancelAnimationFrame(restorationFrame);
    restorationFrame = requestAnimationFrame(() => {
      restorationFrame = 0;
      schedule();
    });
  }
  root.style.backgroundColor = "var(--edge-top-background)";
  body.style.backgroundColor = "var(--edge-bottom-background)";
  window.addEventListener("scroll", schedule, { passive: true, capture: true });
  window.addEventListener("resize", schedule, { passive: true });
  window.addEventListener("orientationchange", restored);
  window.addEventListener("pageshow", restored);
  window.addEventListener("load", restored);
  document.addEventListener("visibilitychange", schedule);
  view?.addEventListener("resize", schedule, { passive: true });
  view?.addEventListener("scroll", schedule, { passive: true });
  media.addEventListener("change", systemTheme);
  const mutations = new MutationObserver(schedule);
  mutations.observe(root, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["data-theme", "data-edge-background", "class", "open"],
  });
  const sizes = new ResizeObserver(schedule);
  sizes.observe(body);
  update();
  restored();
  void document.fonts.ready.then(schedule);
  return () => {
    disposed = true;
    cancelAnimationFrame(frame);
    cancelAnimationFrame(restorationFrame);
    window.removeEventListener("scroll", schedule, true);
    window.removeEventListener("resize", schedule);
    window.removeEventListener("orientationchange", restored);
    window.removeEventListener("pageshow", restored);
    window.removeEventListener("load", restored);
    document.removeEventListener("visibilitychange", schedule);
    view?.removeEventListener("resize", schedule);
    view?.removeEventListener("scroll", schedule);
    media.removeEventListener("change", systemTheme);
    mutations.disconnect();
    sizes.disconnect();
    for (const { property, value, priority } of originalRoot) {
      if (value) root.style.setProperty(property, value, priority);
      else root.style.removeProperty(property);
    }
    for (const { property, value, priority } of originalBody) {
      if (value) body.style.setProperty(property, value, priority);
      else body.style.removeProperty(property);
    }
    for (const [region, { value, priority }] of originalRegions) {
      if (value) region.style.setProperty("--section-background", value, priority);
      else region.style.removeProperty("--section-background");
    }
    for (const [meta, value] of originalMetas)
      if (meta.isConnected) {
        if (value === null) meta.removeAttribute("content");
        else meta.content = value;
      }
  };
}
