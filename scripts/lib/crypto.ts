import { createPublicKey } from "node:crypto";

/**
 * Convert a PEM-encoded key (public or private) to the base64 SPKI public-key
 * string Chromium expects in `manifest.key` (PEM headers stripped, whitespace
 * removed). Shared by `wxt.config.ts` and `scripts/generate-key.ts` so the
 * derivation cannot silently diverge between the two.
 */
export const pemToSpkiBase64 = (pem: string): string => {
  const spkiPem = createPublicKey(pem).export({
    format: "pem",
    type: "spki",
  }) as string;

  return spkiPem
    .replaceAll("-----BEGIN PUBLIC KEY-----", "")
    .replaceAll("-----END PUBLIC KEY-----", "")
    .replaceAll(/\s+/gu, "");
};
