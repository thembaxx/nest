import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeRecoveryKey, validRecoveryKey } from "../src/lib/encryption";

test("recovery keys accept grouped pasted values without weakening validation", () => {
  const key = "01234567".repeat(8);
  assert.equal(validRecoveryKey(key), true);
  assert.equal(normalizeRecoveryKey(key.match(/.{8}/g)!.join(" - ")), key);
  assert.equal(validRecoveryKey(normalizeRecoveryKey(key.match(/.{8}/g)!.join(" - "))), true);
  assert.equal(validRecoveryKey(normalizeRecoveryKey("incorrect key")), false);
});
