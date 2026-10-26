import { z } from "zod";

export const MAX_BACKUP_BYTES = 20_000_000;
const encoder = new TextEncoder();
const base64 = z.string().regex(/^[A-Za-z0-9+/]*={0,2}$/);
const envelopeSchema = z.object({
  format: z.literal("nest-encrypted"),
  version: z.literal(1),
  algorithm: z.literal("AES-GCM"),
  purpose: z.enum(["drive", "backup"]),
  iv: base64.length(16),
  ciphertext: base64.min(24).max(MAX_BACKUP_BYTES),
});
type Purpose = z.infer<typeof envelopeSchema>["purpose"];

function encode(bytes: Uint8Array) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 32768)
    binary += String.fromCharCode(...bytes.subarray(i, i + 32768));
  return btoa(binary);
}
function decode(value: string) {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}
export function recoveryKey() {
  return [...crypto.getRandomValues(new Uint8Array(32))]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
// Accept visually grouped keys when pairing a second device; store only the canonical form.
export function normalizeRecoveryKey(value: string) {
  return value.replace(/[\s-]/g, "").toLowerCase();
}
export function validRecoveryKey(value: string) {
  return /^[a-f0-9]{64}$/i.test(value);
}
export async function importRecoveryKey(value: string) {
  if (!validRecoveryKey(value)) throw Error("Enter the complete 64-character recovery key.");
  const bytes = Uint8Array.from(value.match(/../g)!, (pair) => parseInt(pair, 16));
  return crypto.subtle.importKey("raw", bytes, "AES-GCM", false, ["encrypt", "decrypt"]);
}
export async function passwordKey(password: string, salt?: string) {
  if (password.length < 12) throw Error("Use a backup password of at least 12 characters.");
  const saltBytes = salt ? decode(salt) : crypto.getRandomValues(new Uint8Array(16));
  if (saltBytes.length !== 16) throw Error("Invalid backup salt.");
  const material = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, [
    "deriveKey",
  ]);
  const key = await crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt: saltBytes, iterations: 600000 },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
  return { key, salt: encode(saltBytes) };
}
export async function encryptData(value: unknown, key: CryptoKey, purpose: Purpose) {
  const plaintext = encoder.encode(JSON.stringify(value));
  // Leave room for base64, the authentication tag, and envelope metadata.
  if (plaintext.byteLength > 14_000_000) throw Error("This library exceeds the 20 MB file limit.");
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: encoder.encode(`nest:${purpose}:v1`) },
    key,
    plaintext,
  );
  return {
    format: "nest-encrypted" as const,
    version: 1 as const,
    algorithm: "AES-GCM" as const,
    purpose,
    iv: encode(iv),
    ciphertext: encode(new Uint8Array(ciphertext)),
  };
}
export async function decryptData(
  value: unknown,
  key: CryptoKey,
  purpose: Purpose,
): Promise<unknown> {
  const envelope = envelopeSchema.parse(value);
  if (envelope.purpose !== purpose) throw Error("This encrypted file is for a different purpose.");
  const plaintext = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: decode(envelope.iv),
      additionalData: encoder.encode(`nest:${purpose}:v1`),
    },
    key,
    decode(envelope.ciphertext),
  );
  return JSON.parse(new TextDecoder().decode(plaintext));
}
