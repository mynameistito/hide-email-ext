import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dir, "..");

const run = (cmd: string) => {
  console.log(`> ${cmd}`);
  execSync(cmd, { cwd: ROOT, stdio: "inherit" });
};

const pkg = JSON.parse(
  readFileSync(path.resolve(ROOT, "package.json"), "utf-8")
);
const version = pkg.version as string;
const tag = `v${version}`;

const remoteTag = execSync(`git ls-remote --tags origin refs/tags/${tag}`, {
  cwd: ROOT,
  encoding: "utf-8",
}).trim();
if (remoteTag) {
  console.log(
    `Tag ${tag} exists on origin — will ensure release assets are uploaded.`
  );
}

const keyPath = path.resolve(ROOT, "key.pem");
if (process.env.REQUIRE_CHROME_KEY && !existsSync(keyPath)) {
  if (!process.env.EXTENSION_KEY_PEM) {
    console.error(
      "EXTENSION_KEY_PEM secret is missing — cannot publish without a stable extension ID"
    );
    process.exit(1);
  }
  writeFileSync(keyPath, process.env.EXTENSION_KEY_PEM);
}

run("bunx wxt prepare");
run("bun run build");
run("bun run build:firefox");
run("bun run zip");
run("bun run zip:firefox");

const chromeZip = path.resolve(
  ROOT,
  `.output/hide-email-ext-${version}-chrome.zip`
);
const firefoxZip = path.resolve(
  ROOT,
  `.output/hide-email-ext-${version}-firefox.zip`
);

if (!existsSync(chromeZip)) {
  console.error(`Chrome zip not found at ${chromeZip}`);
  process.exit(1);
}
if (!existsSync(firefoxZip)) {
  console.error(`Firefox zip not found at ${firefoxZip}`);
  process.exit(1);
}

try {
  execSync(`git rev-parse ${tag}`, { cwd: ROOT, stdio: "pipe" });
} catch {
  execSync(`git tag ${tag}`, { cwd: ROOT });
}
if (!remoteTag) {
  execSync(`git push origin ${tag}`, { cwd: ROOT });
}

let body = `Release ${tag}`;
const changelogPath = path.resolve(ROOT, "CHANGELOG.md");
if (existsSync(changelogPath)) {
  const changelog = readFileSync(changelogPath, "utf-8");
  const sectionRegex = new RegExp(
    `## ${version.replaceAll(".", "\\.")}\\n([\\s\\S]*?)(?=\\n## |$)`,
    "u"
  );
  const match = changelog.match(sectionRegex);
  if (match?.[1]?.trim()) {
    body = match[1].trim();
  }
}

const notesPath = path.resolve(ROOT, ".changeset", "RELEASE_NOTES.md");
writeFileSync(notesPath, body);

try {
  run(
    `gh release create ${tag} --title "${tag}" --notes-file "${notesPath}" "${chromeZip}" "${firefoxZip}"`
  );
} catch {
  run(`gh release upload ${tag} "${chromeZip}" "${firefoxZip}" --clobber`);
}
