import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const sharp = require("sharp");
const root = process.cwd();
const master = path.join(root, "public/brand/nest-icon-master.png");
const symbol = await fs.readFile(path.join(root, "public/brand/nest-symbol.svg"), "utf8");
const type = JSON.parse(
  await fs.readFile(path.join(root, "scripts/brand-type-paths.json"), "utf8"),
);
const vector = await fs.readFile(path.join(root, "public/brand/nest-icon-vector.svg"), "utf8");
await fs.mkdir(path.join(root, "public/icons"), { recursive: true });
await Promise.all([
  ...[128, 512].map((size) =>
    sharp(master)
      .resize(size, size)
      .webp({ quality: 90 })
      .toFile(path.join(root, `public/brand/nest-app-icon-${size}.webp`)),
  ),
  ...[192, 512].map((size) =>
    sharp(master)
      .resize(size, size)
      .png({ compressionLevel: 9 })
      .toFile(path.join(root, `public/icons/icon-${size}.png`)),
  ),
  sharp(master)
    .resize(180, 180)
    .png({ compressionLevel: 9 })
    .toFile(path.join(root, "public/icons/apple-touch-icon.png")),
  sharp(Buffer.from(vector))
    .resize(32, 32)
    .png()
    .toFile(path.join(root, "public/icons/favicon-32.png")),
]);
// A full-bleed vector variant keeps the complete mark inside Android's safe circle.
const maskable = vector
  .replace('rx="15"', 'rx="0"')
  .replace(/<rect x="1"[^>]+\/>/, "")
  .replace("translate(3 1) scale(.91)", "translate(7.7 6) scale(.76)");
await sharp(Buffer.from(maskable))
  .resize(512, 512)
  .png()
  .toFile(path.join(root, "public/icons/icon-maskable.png"));
await fs.writeFile(path.join(root, "public/icons/icon.svg"), vector);
await fs.writeFile(
  path.join(root, "public/brand/nest-symbol-light.svg"),
  symbol.replace("#24452a", "#f7f6f2"),
);
for (const [name, ink] of [
  ["nest-wordmark", "#24452a"],
  ["nest-wordmark-light", "#f7f6f2"],
]) {
  const paths = symbol.match(/<g[^>]*>([\s\S]+)<\/g>/)[1];
  const wordmark = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="96" viewBox="0 0 300 96"><g transform="translate(0 6) scale(1.3)" fill="${ink}">${paths}</g><g transform="translate(99 71)"><path d="${type.word.path}" fill="${ink}"/><path d="${type.dot.path}" transform="translate(${type.word.width - 1} 0)" fill="#b39b47"/></g></svg>`;
  await fs.writeFile(path.join(root, `public/brand/${name}.svg`), wordmark);
}
// PNG-backed ICO entries are understood by modern browsers and Windows.
const sizes = [16, 32, 48];
const images = await Promise.all(
  sizes.map((size) => sharp(Buffer.from(vector)).resize(size, size).png().toBuffer()),
);
const header = Buffer.alloc(6 + 16 * sizes.length);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(sizes.length, 4);
let offset = header.length;
images.forEach((buffer, i) => {
  const p = 6 + 16 * i;
  header[p] = sizes[i];
  header[p + 1] = sizes[i];
  header.writeUInt16LE(1, p + 4);
  header.writeUInt16LE(32, p + 6);
  header.writeUInt32LE(buffer.length, p + 8);
  header.writeUInt32LE(offset, p + 12);
  offset += buffer.length;
});
await fs.writeFile(path.join(root, "public/icons/favicon.ico"), Buffer.concat([header, ...images]));
console.log("Generated Nest icon, wordmark, favicon, and PWA variants.");

const textPath = (name, x, y, color = "#24452a") =>
  `<path d="${type[name].path}" transform="translate(${x} ${y})" fill="${color}"/>`;
const iconData = "data:image/png;base64," + (await fs.readFile(master)).toString("base64");
const social = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1200" height="630" viewBox="0 0 1200 630"><defs><radialGradient id="halo"><stop stop-color="#e0e7b6"/><stop offset="1" stop-color="#f7f6f2"/></radialGradient><filter id="shadow" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="0" dy="22" stdDeviation="21" flood-color="#1e3a24" flood-opacity=".16"/></filter><clipPath id="iconclip"><rect x="0" y="0" width="282" height="282" rx="68"/></clipPath></defs><rect width="1200" height="630" fill="#f7f6f2"/><ellipse cx="962" cy="320" rx="252" ry="260" fill="url(#halo)"/><line x1="60" y1="119" x2="1140" y2="119" stroke="#dedfd4"/><g transform="translate(55 36) scale(.76)" fill="#24452a">${symbol.match(/<g[^>]*>([\s\S]+)<\/g>/)[1]}</g>${textPath("wordSmall", 112, 83)}${textPath("eyebrow", 64, 170, "#7d826e")}${textPath("headline1", 60, 282)}${textPath("headline2", 62, 381)}${textPath("subtitle", 66, 438, "#6b7465")}${textPath("socialFooter", 66, 556, "#7d826e")}<circle cx="1140" cy="556" r="7" fill="#e9be52"/><g transform="translate(823 163) rotate(-8 141 141)" filter="url(#shadow)"><image xlink:href="${iconData}" width="282" height="282" clip-path="url(#iconclip)"/></g><g transform="translate(790 446) rotate(4)"><rect width="275" height="71" rx="17" fill="#fffdf4" stroke="#e5e5d9"/>${textPath("note", 23, 42)}<path d="m239 31 6 6 10-12" fill="none" stroke="#78905f" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></g></svg>`;
await fs.writeFile(path.join(root, "public/brand/nest-social.svg"), social);
await sharp(Buffer.from(social))
  .png({ compressionLevel: 9 })
  .toFile(path.join(root, "public/brand/nest-social.png"));
const lockup = await fs.readFile(path.join(root, "public/brand/nest-wordmark.svg"), "utf8");
const lockupData = "data:image/svg+xml;base64," + Buffer.from(lockup).toString("base64");
const symbolData = "data:image/svg+xml;base64," + Buffer.from(symbol).toString("base64");
const swatches = [
  ["Forest", "#24452A"],
  ["Chartreuse", "#D5EA70"],
  ["Golden", "#E9BE52"],
  ["Warm ivory", "#F7F6F2"],
];
const sheet = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1440" height="1000" viewBox="0 0 1440 1000"><defs><clipPath id="sheet-icon"><rect x="145" y="184" width="245" height="245" rx="59"/></clipPath></defs><rect width="1440" height="1000" fill="#f7f6f2"/><style>text{font-family:Arial,sans-serif;fill:#6b7465;font-size:15px}.label{font-size:11px;letter-spacing:2px}</style><image xlink:href="${lockupData}" x="65" y="35" width="175" height="56"/><text x="1150" y="71" class="label">THE NEST IDENTITY / 01</text><path d="M65 116h1310" stroke="#dedfd4"/><rect x="65" y="151" width="405" height="374" rx="25" fill="#e8ecde"/><image xlink:href="${iconData}" x="145" y="184" width="245" height="245" clip-path="url(#sheet-icon)"/><text x="93" y="491" class="label">THE SCULPTED APP ICON</text><rect x="490" y="151" width="470" height="374" rx="25" fill="#fffdf8" stroke="#e1e2d8"/><image xlink:href="${lockupData}" x="560" y="273" width="330" height="106"/><text x="520" y="491" class="label">THE SIGNATURE</text><rect x="980" y="151" width="395" height="374" rx="25" fill="#eddfa4"/><image xlink:href="${symbolData}" x="1092" y="221" width="170" height="170"/><text x="1009" y="491" class="label">THE SIMPLE SYMBOL</text>${swatches
  .map(([name, color], i) => {
    const x = 65 + i * 332;
    return `<rect x="${x}" y="560" width="314" height="110" rx="13" fill="${color}" stroke="#dfe0d6"/><text x="${x}" y="700">${name}</text><text x="${x}" y="726" class="label">${color}</text>`;
  })
  .join(
    "",
  )}<path d="M65 766h1310" stroke="#dedfd4"/><text x="65" y="808" class="label">INSTRUMENT SERIF / THE BIG IDEAS</text>${textPath("typeSerif", 65, 875)}<text x="785" y="808" class="label">DM SANS / THE LITTLE DETAILS</text>${textPath("typeSans", 785, 862)}<text x="785" y="899">Warm. Curious. Clear. A little less lost. A little more found.</text><text x="65" y="960" class="label">GOOD THINGS, KEPT CLOSE.</text><text x="1140" y="960" class="label">NEST / BRAND ASSETS</text></svg>`;
await fs.writeFile(path.join(root, "public/brand/nest-brand-sheet.svg"), sheet);
await sharp(Buffer.from(sheet))
  .resize(1440, 1000)
  .png()
  .toFile(path.join(root, "public/brand/nest-brand-sheet.png"));
console.log("Generated outlined wordmarks, social preview, and brand sheet.");
