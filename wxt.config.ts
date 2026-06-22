import { createPublicKey } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { defineConfig } from "wxt";

const pkg = JSON.parse(
  readFileSync(path.resolve(import.meta.dirname, "package.json"), "utf-8")
) as { version: string };

/**
 * Derive the Chromium-compatible `manifest.key` (base64 SPKI public key) from
 * the local `key.pem` or CI-provided `WXT_CHROME_KEY` private-key PEM so local
 * and release builds keep the same persistent Chromium extension ID.
 */
const loadPemSource = (): string | undefined => {
  const fromEnv = process.env.WXT_CHROME_KEY;
  if (fromEnv && fromEnv.length > 0) {
    return fromEnv;
  }

  const keyPath = path.resolve(import.meta.dirname, "key.pem");
  if (existsSync(keyPath)) {
    return readFileSync(keyPath, "utf-8");
  }
};

const loadManifestKey = (): string | undefined => {
  const pem = loadPemSource();
  if (!pem) {
    return;
  }

  const spkiPem = createPublicKey(pem).export({
    format: "pem",
    type: "spki",
  }) as string;

  return spkiPem
    .replaceAll("-----BEGIN PUBLIC KEY-----", "")
    .replaceAll("-----END PUBLIC KEY-----", "")
    .replaceAll(/\s+/gu, "");
};

export default defineConfig({
  manifest: ({ browser }) => {
    const base = {
      action: {
        default_icon: {
          "128": "icon/128.png",
          "16": "icon/16.png",
          "32": "icon/32.png",
          "48": "icon/48.png",
        },
        default_popup: "popup/index.html",
      },
      description: "Redacts user-specified email addresses on every page.",
      host_permissions: ["<all_urls>"],
      icons: {
        "128": "icon/128.png",
        "16": "icon/16.png",
        "32": "icon/32.png",
        "48": "icon/48.png",
        "96": "icon/96.png",
      },
      name: "Hide Email",
      permissions: ["storage"],
      version: pkg.version,
    };

    if (browser === "firefox") {
      return base;
    }

    const key = loadManifestKey();
    if (!key) {
      if (process.env.REQUIRE_CHROME_KEY === "1") {
        throw new Error(
          "WXT_CHROME_KEY or key.pem is required when REQUIRE_CHROME_KEY=1."
        );
      }

      console.warn(
        "[wxt] key.pem not found and WXT_CHROME_KEY is unset - extension ID will be random. Run `bun run generate-key`."
      );
    }

    return {
      ...base,
      ...(key ? { key } : {}),
    };
  },
  srcDir: ".",
  suppressWarnings: {
    firefoxDataCollection: true,
  },
});
