#!/usr/bin/env bun
/**
 * Generates a fresh PKCS8 RSA-2048 private key (`key.pem`) using openssl.
 *
 * Run once per repo. The file is gitignored.
 */
import { createHash, createPublicKey } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

const KEY_PATH = "key.pem";
const args = process.argv.slice(2).filter((arg) => arg !== "--");
const invalidArgs = args.filter((arg) => arg !== "-f" && arg !== "--force");
const force = args.some((arg) => arg === "-f" || arg === "--force");

if (invalidArgs.length > 0) {
  console.error(`Unknown option: ${invalidArgs.join(", ")}`);
  console.error("Usage: bun run generate-key [--force|-f]");
  process.exit(1);
}

if (existsSync(KEY_PATH) && !force) {
  console.error(
    `Refusing to overwrite existing ${KEY_PATH}. Pass --force if you really mean to rotate the extension ID.`
  );
  process.exit(1);
}

const proc = Bun.spawnSync({
  cmd: [
    "openssl",
    "genpkey",
    "-algorithm",
    "RSA",
    "-out",
    KEY_PATH,
    "-pkeyopt",
    "rsa_keygen_bits:2048",
  ],
  stderr: "pipe",
  stdout: "ignore",
});

if (proc.exitCode !== 0) {
  console.error(proc.stderr.toString());
  console.error("openssl failed. Is it on PATH? (try a new shell)");
  process.exit(proc.exitCode ?? 1);
}

const pem = readFileSync(KEY_PATH, "utf-8");
const spkiPem = createPublicKey(pem).export({
  format: "pem",
  type: "spki",
}) as string;

const spkiB64 = spkiPem
  .replaceAll("-----BEGIN PUBLIC KEY-----", "")
  .replaceAll("-----END PUBLIC KEY-----", "")
  .replaceAll(/\s+/gu, "");

// Chromium extension ID: sha256(SPKI DER) -> take first 16 bytes -> map 0-f to a-p
const spkiDer = Buffer.from(spkiB64, "base64");
const digest = createHash("sha256").update(spkiDer).digest("hex").slice(0, 32);
const extensionId = [...digest]
  .map((c) => String.fromCodePoint(97 + Number.parseInt(c, 16)))
  .join("");
const secretCommand =
  process.platform === "win32"
    ? `Get-Content ${KEY_PATH} -Raw | gh secret set WXT_CHROME_KEY`
    : `gh secret set WXT_CHROME_KEY < ${KEY_PATH}`;

console.log(`\n✔ Generated ${KEY_PATH}\n`);
console.log(`Extension ID: ${extensionId}\n`);
console.log(
  "To register the key with GitHub Actions (requires gh CLI logged in):\n"
);
console.log(`${secretCommand}\n`);
