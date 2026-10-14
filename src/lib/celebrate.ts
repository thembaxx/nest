export async function celebrate() {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  try {
    const { Application, Graphics } = await import("pixi.js");
    const app = new Application();
    await app.init({
      width: window.innerWidth,
      height: window.innerHeight,
      backgroundAlpha: 0,
      antialias: true,
      preference: "webgl",
      resolution: devicePixelRatio,
      autoDensity: true,
    });
    const canvas = app.canvas;
    Object.assign(canvas.style, {
      position: "fixed",
      inset: "0",
      pointerEvents: "none",
      zIndex: "200",
    });
    canvas.setAttribute("aria-hidden", "true");
    document.body.appendChild(canvas);
    const leaves = Array.from({ length: 22 }, (_, i) => {
      const g = new Graphics()
        .ellipse(0, 0, 4, 8)
        .fill(["#9cae88", "#e7dc8b", "#c4b5d7", "#e4b49b"][i % 4]);
      g.x = innerWidth * 0.7;
      g.y = innerHeight * 0.55;
      app.stage.addChild(g);
      return { g, vx: (Math.random() - 0.5) * 9, vy: -Math.random() * 8 - 3 };
    });
    const start = performance.now();
    app.ticker.add((t) => {
      for (const p of leaves) {
        p.g.x += p.vx * t.deltaTime;
        p.g.y += p.vy * t.deltaTime;
        p.vy += 0.12 * t.deltaTime;
        p.g.rotation += 0.03 * t.deltaTime;
        p.g.alpha = Math.max(0, 1 - (performance.now() - start) / 1800);
      }
      if (performance.now() - start > 1800) app.destroy(true, { children: true });
    });
  } catch {
    /* Saving is independent of decorative effects. */
  }
}
