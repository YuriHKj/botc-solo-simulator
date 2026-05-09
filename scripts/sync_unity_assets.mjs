import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { getAllRoles } from "./data.js";

const ROLE_SCRIPTS = ["tb", "bmr", "snv"];
const root = process.cwd();
const sourceRoleRoot = path.join(root, "assets", "roles");
const sourceUiRoot = path.join(root, "assets", "ui");
const unityRoleRoot = path.join(root, "unity-prototype", "Assets", "Resources", "Botc", "roles");
const unityUiRoot = path.join(root, "unity-prototype", "Assets", "Resources", "Botc", "ui");
const checkOnly = process.argv.includes("--check");

function sha256(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function listPngFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".png"))
    .map((entry) => entry.name)
    .sort();
}

function copyOrCheck(sourcePath, targetPath, changes, failures) {
  if (!fs.existsSync(sourcePath)) {
    failures.push(`missing source: ${path.relative(root, sourcePath)}`);
    return;
  }
  const targetExists = fs.existsSync(targetPath);
  const same = targetExists && sha256(sourcePath) === sha256(targetPath);
  if (same) return;

  const label = `${path.relative(root, sourcePath)} -> ${path.relative(root, targetPath)}`;
  if (checkOnly) {
    failures.push(targetExists ? `out of sync: ${label}` : `missing target: ${label}`);
    return;
  }

  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.copyFileSync(sourcePath, targetPath);
  changes.push(label);
}

function expectedRoleIconIds() {
  const ids = new Set();
  for (const scriptId of ROLE_SCRIPTS) {
    for (const role of getAllRoles(scriptId)) {
      ids.add(role.id);
    }
  }
  return [...ids].sort();
}

function syncRoleIcons(changes, failures) {
  for (const scriptId of ROLE_SCRIPTS) {
    for (const role of getAllRoles(scriptId)) {
      const sourcePath = path.join(sourceRoleRoot, scriptId, `${role.id}.png`);
      const targetPath = path.join(unityRoleRoot, `${role.id}.png`);
      copyOrCheck(sourcePath, targetPath, changes, failures);
    }
  }
}

function syncUiAssets(changes, failures) {
  for (const fileName of listPngFiles(sourceUiRoot)) {
    copyOrCheck(path.join(sourceUiRoot, fileName), path.join(unityUiRoot, fileName), changes, failures);
  }
}

function assertNoMissingRoleFiles(failures) {
  for (const roleId of expectedRoleIconIds()) {
    const targetPath = path.join(unityRoleRoot, `${roleId}.png`);
    if (!fs.existsSync(targetPath)) failures.push(`Unity role resource missing after sync: ${path.relative(root, targetPath)}`);
  }
}

const changes = [];
const failures = [];

syncRoleIcons(changes, failures);
syncUiAssets(changes, failures);
if (!checkOnly) assertNoMissingRoleFiles(failures);

if (failures.length > 0) {
  console.error(`Unity asset sync ${checkOnly ? "check" : "run"} failed:`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  checkOnly
    ? "Unity assets are in sync."
    : `Unity asset sync complete. ${changes.length} file${changes.length === 1 ? "" : "s"} copied.`
);
if (changes.length > 0) {
  for (const change of changes) console.log(`- ${change}`);
}
