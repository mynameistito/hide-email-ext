import { generateKeyPairSync } from "node:crypto";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const outPath = resolve(import.meta.dirname, "..", "key.pem");

const { privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { format: "pem", type: "pkcs8" },
});

writeFileSync(outPath, privateKey, { mode: 0o600 });
console.log(`key.pem written to ${outPath}`);
console.log("Add this file to .gitignore — it must never be committed.");
