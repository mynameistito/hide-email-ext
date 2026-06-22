import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");

interface PackageJson {
  readonly name: string;
  readonly version: string;
}

const run = (command: string, args: string[]): string =>
  execFileSync(command, args, {
    cwd: root,
    encoding: "utf-8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();

const runInherited = (command: string, args: string[]): void => {
  execFileSync(command, args, { cwd: root, stdio: "inherit" });
};

const expectedAssets = (name: string, version: string): string[] => [
  `${name}-${version}-chrome.zip`,
  `${name}-${version}-firefox.zip`,
];

const fetchReleaseAssetNames = (tag: string): string[] => {
  const output = run("gh", [
    "release",
    "view",
    tag,
    "--json",
    "assets",
    "--jq",
    ".assets[].name",
  ]);

  return output ? output.split("\n") : [];
};

const releaseHasExpectedAssets = (
  tag: string,
  name: string,
  version: string
): boolean => {
  try {
    const names = fetchReleaseAssetNames(tag);
    return expectedAssets(name, version).every((asset) =>
      names.includes(asset)
    );
  } catch {
    return false;
  }
};

const requireStableChromeKey = (): void => {
  if (!process.env.REQUIRE_CHROME_KEY) {
    return;
  }

  const keyPath = path.resolve(root, "key.pem");
  if (existsSync(keyPath) || process.env.WXT_CHROME_KEY) {
    return;
  }

  console.error(
    "WXT_CHROME_KEY secret is missing - cannot publish without a stable Chrome extension ID."
  );
  process.exit(1);
};

const readReleaseNotes = (version: string): string => {
  const changelogPath = path.resolve(root, "CHANGELOG.md");
  if (!existsSync(changelogPath)) {
    return `Release v${version}`;
  }

  const changelog = readFileSync(changelogPath, "utf-8");
  const escapedVersion = version.replaceAll(".", "\\.");
  const sectionRegex = new RegExp(
    `## ${escapedVersion}\n([\\s\\S]*?)(?=\n## |$)`,
    "u"
  );
  const match = changelog.match(sectionRegex);

  return match?.[1]?.trim() || `Release v${version}`;
};

const pkg = JSON.parse(
  readFileSync(path.resolve(root, "package.json"), "utf-8")
) as PackageJson;
const tag = `v${pkg.version}`;

if (releaseHasExpectedAssets(tag, pkg.name, pkg.version)) {
  console.log(`Release ${tag} already exists with all expected assets.`);
  process.exit(0);
}

requireStableChromeKey();

runInherited("bun", ["run", "check"]);
runInherited("bun", ["run", "typecheck"]);
runInherited("bun", ["run", "test"]);
runInherited("bun", ["run", "knip"]);
runInherited("bun", ["run", "build"]);
runInherited("bun", ["run", "build:firefox"]);
runInherited("bun", ["run", "zip"]);
runInherited("bun", ["run", "zip:firefox"]);

const chromeZip = path.resolve(
  root,
  ".output",
  `${pkg.name}-${pkg.version}-chrome.zip`
);
const firefoxZip = path.resolve(
  root,
  ".output",
  `${pkg.name}-${pkg.version}-firefox.zip`
);

for (const zip of [chromeZip, firefoxZip]) {
  if (!existsSync(zip)) {
    throw new Error(`Missing build artifact: ${zip}`);
  }
}

const notesPath = path.resolve(root, ".changeset", "RELEASE_NOTES.md");
writeFileSync(notesPath, readReleaseNotes(pkg.version));

const target = run("git", ["rev-parse", "HEAD"]);

try {
  runInherited("gh", [
    "release",
    "create",
    tag,
    chromeZip,
    firefoxZip,
    "--title",
    tag,
    "--notes-file",
    notesPath,
    "--target",
    target,
  ]);
} catch {
  const present = fetchReleaseAssetNames(tag);
  const missing = expectedAssets(pkg.name, pkg.version).filter(
    (asset) => !present.includes(asset)
  );

  if (missing.length > 0) {
    console.error(`Release ${tag} is missing assets: ${missing.join(", ")}`);
    process.exit(1);
  }

  console.log(`Release ${tag} has all expected assets.`);
}
