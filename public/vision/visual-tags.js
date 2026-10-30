// A deterministic, offline suggestion list. No model-generated text changes the library automatically.
const vocabulary = [
  ["design", ["design", "visual", "graphic", "mockup", "layout"]],
  ["typography", ["typography", "font", "lettering", "typeface"]],
  ["color", ["palette", "colour", "color", "gradient"]],
  ["animation", ["animation", "animated", "motion", "transition"]],
  ["accessibility", ["accessibility", "accessible", "a11y", "screen reader"]],
  ["react", ["react", "jsx", "tsx"]],
  ["nextjs", ["next.js", "nextjs", "next js"]],
  ["typescript", ["typescript", "type script"]],
  ["javascript", ["javascript", "js code"]],
  ["css", ["css", "stylesheet", "styles"]],
  ["dashboard", ["dashboard", "analytics", "metrics"]],
  ["mobile", ["mobile", "iphone", "android", "smartphone"]],
  ["illustration", ["illustration", "drawing", "sketch"]],
  ["3d", ["3d", "three-dimensional", "webgl"]],
  ["photography", ["photography", "photo", "camera"]],
  ["nature", ["plants", "nature", "flower", "trees"]],
  ["architecture", ["architecture", "buildings", "house"]],
  ["food", ["food", "recipe", "cooking", "meal"]],
  ["education", ["learning", "study", "classroom", "lesson"]],
  ["commerce", ["shop", "checkout", "storefront", "product catalog"]],
];
export function suggestVisualTags(text) {
  const normalized =
    " " +
    String(text || "")
      .normalize("NFKC")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}. ]/gu, " ") +
    " ";
  return vocabulary
    .filter(([, words]) => words.some((word) => normalized.includes(" " + word + " ")))
    .map(([tag]) => tag)
    .slice(0, 12);
}
export function validateVisionDraft(value, now = Date.now()) {
  if (
    !value ||
    typeof value !== "object" ||
    value.version !== 1 ||
    typeof value.createdAt !== "number" ||
    Math.abs(now - value.createdAt) > 15 * 60 * 1000
  )
    return null;
  if (
    typeof value.note !== "string" ||
    value.note.length > 2000 ||
    !Array.isArray(value.tags) ||
    value.tags.length > 20
  )
    return null;
  if (
    value.tags.some(
      (tag) => typeof tag !== "string" || tag.length > 80 || !/^[-a-z0-9. ]+$/.test(tag),
    )
  )
    return null;
  return {
    version: 1,
    createdAt: value.createdAt,
    note: value.note.trim(),
    tags: [...new Set(value.tags.map((tag) => tag.trim()).filter(Boolean))].slice(0, 12),
  };
}
export function createVisionDraft(note, tags, createdAt = Date.now()) {
  const normalized = String(note || "")
    .trim()
    .slice(0, 1400);
  const cleaned = [
    ...new Set(
      String(tags || "")
        .toLowerCase()
        .split(",")
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0 && tag.length <= 80 && /^[-a-z0-9. ]+$/.test(tag)),
    ),
  ].slice(0, 12);
  return validateVisionDraft({ version: 1, createdAt, note: normalized, tags: cleaned }, createdAt);
}
