import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(new URL("../" + path, import.meta.url), "utf8");

test("Nest stays standalone with browser fallback and bookmark sharing", () => {
  const manifest = read("src/app/manifest.ts");
  assert.match(manifest, /display:\s*"standalone"/);
  assert.match(manifest, /display_override:\s*\["standalone", "minimal-ui"\]/);
  assert.ok(manifest.includes("share_target:"));
  assert.ok(manifest.includes("/?action=add"));
});

test("Nest installed dialogs and navigation remain clear of safe areas", () => {
  const css = read("src/app/native-shell.css");
  assert.ok(css.includes("display-mode: standalone"));
  assert.ok(css.includes("100dvh"));
  assert.ok(css.includes("safe-area-inset-bottom"));
  assert.ok(css.includes(".modal[open]"));
});
