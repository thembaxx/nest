/** Shared by the initial HTML, CSS tokens, and the viewport edge controller. */
export const pagePalettes = {
  light: { page: "#f7f6f2", surface: "#fffefa", sidebar: "#efeee8" },
  dark: { page: "#1b211d", surface: "#252d26", sidebar: "#181e1a" },
} as const;
export type PagePalette = { page: string; surface: string; sidebar: string };
export const pagePaletteCSS = Object.entries(pagePalettes)
  .map(
    ([theme, palette]) =>
      `:root{${Object.entries(palette)
        .map(([key, value]) => `--palette-${theme}-${key}:${value}`)
        .join(";")}}`,
  )
  .join("\n");
export const initialThemeScript = `try{var s=JSON.parse(localStorage.getItem('nest-settings')||'{}');var d=s.theme==='dark'||(s.theme!=='light'&&matchMedia('(prefers-color-scheme:dark)').matches);var p=${JSON.stringify(pagePalettes)}[d?'dark':'light'];var r=document.documentElement;r.dataset.theme=d?'dark':'light';r.style.setProperty('--page-background',p.page);r.style.setProperty('--page-surface-background',p.surface);r.style.setProperty('--page-sidebar-background',p.sidebar);r.style.setProperty('--edge-top-background',p.page);r.style.setProperty('--edge-bottom-background',p.page);document.querySelectorAll('meta[name="theme-color"]').forEach(function(m){m.content=p.page})}catch(e){}`;
