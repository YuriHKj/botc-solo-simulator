import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const sourceRoot = path.join(root, "unity-prototype", "Assets", "StreamingAssets", "BotcJsCore");
const targetRoot = path.join(root, "unity-build", "BOTC_Unity_Prototype_Data", "StreamingAssets", "BotcJsCore");
const checkOnly = process.argv.includes("--check");

function sha256(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function relativePath(filePath, basePath) {
  return path.relative(basePath, filePath).replaceAll(path.sep, "/");
}

function listFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listFiles(fullPath));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }
  return files.sort();
}

function copyOrCheck(sourcePath, targetPath, changes, failures) {
  const sourceRelative = relativePath(sourcePath, root);
  const targetRelative = relativePath(targetPath, root);
  const targetExists = fs.existsSync(targetPath);
  const same = targetExists && sha256(sourcePath) === sha256(targetPath);
  if (same) return;

  const label = `${sourceRelative} -> ${targetRelative}`;
  if (checkOnly) {
    failures.push(targetExists ? `out of sync: ${label}` : `missing target: ${label}`);
    return;
  }

  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.copyFileSync(sourcePath, targetPath);
  changes.push(label);
}

if (!fs.existsSync(sourceRoot)) {
  console.error(`Unity project JS core not found: ${relativePath(sourceRoot, root)}`);
  process.exit(1);
}

if (!fs.existsSync(targetRoot)) {
  if (checkOnly) {
    console.error(`Unity build JS core not found: ${relativePath(targetRoot, root)}`);
    process.exit(1);
  }
  fs.mkdirSync(targetRoot, { recursive: true });
}

const changes = [];
const failures = [];
for (const sourcePath of listFiles(sourceRoot)) {
  const rel = path.relative(sourceRoot, sourcePath);
  copyOrCheck(sourcePath, path.join(targetRoot, rel), changes, failures);
}

if (failures.length > 0) {
  console.error(`Unity build JS core sync ${checkOnly ? "check" : "run"} failed:`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  checkOnly
    ? "Unity build JS core is in sync."
    : `Unity build JS core sync complete. ${changes.length} file${changes.length === 1 ? "" : "s"} copied.`
);
if (changes.length > 0) {
  for (const change of changes) console.log(`- ${change}`);
}
