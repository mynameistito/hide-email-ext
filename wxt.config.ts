import { createPublicKey } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { defineConfig } from "wxt";

const pkg = JSON.parse(
  readFileSync(path.resolve(import.meta.dirname, "package.json"), "utf-8")
) as { version: string };

const loadKey = (): string | undefined => {
  const keyPath = path.resolve(import.meta.dirname, "key.pem");
  if (!existsSync(keyPath)) {
    return undefined;
  }
  const privateKey = readFileSync(keyPath, "utf-8");
  const publicKey = createPublicKey(privateKey);
  const der = publicKey.export({ format: "der", type: "spki" });
  return Buffer.from(der).toString("base64");
};

const key = loadKey();
if (!key) {
  console.warn(
    "[wxt] key.pem not found — extension ID will be random. Run `bun run generate-key`."
  );
}

export default defineConfig({
  manifest: {
    action: {
      default_icon: {
        "128": "icon-128.png",
        "16": "icon-16.png",
        "32": "icon-32.png",
        "48": "icon-48.png",
      },
      default_popup: "popup/index.html",
    },
    description: "Redacts user-specified email addresses on every page.",
    host_permissions: ["<all_urls>"],
    icons: {
      "128": "icon-128.png",
      "16": "icon-16.png",
      "32": "icon-32.png",
      "48": "icon-48.png",
      "96": "icon-96.png",
    },
    name: "Hide Email",
    permissions: ["storage"],
    version: pkg.version,
    ...(key ? { key } : {}),
  },
  srcDir: ".",
  suppressWarnings: {
    firefoxDataCollection: true,
  },
});
