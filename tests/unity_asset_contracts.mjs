import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { getAllRoles } from "../scripts/data.js";

const root = process.cwd();
const roleScripts = ["tb", "bmr", "snv"];
const sourceRoleRoot = path.join(root, "assets", "roles");
const unityRoleRoot = path.join(root, "unity-prototype", "Assets", "Resources", "Botc", "roles");
const sourceUiRoot = path.join(root, "assets", "ui");
const unityUiRoot = path.join(root, "unity-prototype", "Assets", "Resources", "Botc", "ui");

function fileExists(filePath) {
  return fs.existsSync(filePath) && fs.statSync(filePath).isFile();
}

function listPngFiles(dir) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".png"))
    .map((entry) => entry.name)
    .sort();
}

function testUnityHasEveryScriptRoleIcon() {
  for (const scriptId of roleScripts) {
    for (const role of getAllRoles(scriptId)) {
      assert.ok(
        fileExists(path.join(sourceRoleRoot, scriptId, `${role.id}.png`)),
        `Electron asset source should include ${scriptId}/${role.id}.png`
      );
      assert.ok(
        fileExists(path.join(unityRoleRoot, `${role.id}.png`)),
        `Unity Resources should include role icon ${role.id}.png`
      );
    }
  }
}

function testUnityHasEveryUiAsset() {
  for (const fileName of listPngFiles(sourceUiRoot)) {
    assert.ok(fileExists(path.join(unityUiRoot, fileName)), `Unity Resources should include ui asset ${fileName}`);
  }
}

testUnityHasEveryScriptRoleIcon();
testUnityHasEveryUiAsset();

console.log("unity asset contracts ok");
