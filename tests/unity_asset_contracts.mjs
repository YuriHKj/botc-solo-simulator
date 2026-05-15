import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { getAllRoles, getRoleById, SCRIPT_MAP } from "../scripts/data.js";

const root = process.cwd();
const roleScripts = ["tb", "bmr", "snv"];
const sourceRoleRoot = path.join(root, "assets", "roles");
const unityRoleRoot = path.join(root, "unity-prototype", "Assets", "Resources", "Botc", "roles");
const sourceUiRoot = path.join(root, "assets", "ui");
const unityUiRoot = path.join(root, "unity-prototype", "Assets", "Resources", "Botc", "ui");
const sourceAudioRoot = path.join(root, "assets", "audio");
const unityAudioRoot = path.join(root, "unity-prototype", "Assets", "Resources", "Botc", "audio");
const menuSetupSourcePath = path.join(root, "assets", "data", "unity_menu_setup.json");
const menuSetupUnityPath = path.join(root, "unity-prototype", "Assets", "Resources", "Botc", "data", "menu_setup.json");

function fileExists(filePath) {
  return fs.existsSync(filePath) && fs.statSync(filePath).isFile();
}

function listPngFiles(dir) {
  return listFilesByExtension(dir, ".png");
}

function listMp3Files(dir) {
  return listFilesByExtension(dir, ".mp3");
}

function listFilesByExtension(dir, extension) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(extension))
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

function testUnityHasEveryAudioAsset() {
  for (const fileName of listMp3Files(sourceAudioRoot)) {
    assert.ok(fileExists(path.join(unityAudioRoot, fileName)), `Unity Resources should include audio asset ${fileName}`);
  }
}

function testUnityMenuSetupUsesCoreRoleIds() {
  for (const filePath of [menuSetupSourcePath, menuSetupUnityPath]) {
    assert.ok(fileExists(filePath), `Unity menu setup should exist: ${path.relative(root, filePath)}`);
    const catalog = JSON.parse(fs.readFileSync(filePath, "utf8"));
    assert.ok(Array.isArray(catalog.scripts) && catalog.scripts.length > 0, "menu setup should list scripts");
    for (const script of catalog.scripts) {
      assert.ok(SCRIPT_MAP[script.id], `menu setup script id should be known by JS Core: ${script.id}`);
      assert.ok(Array.isArray(script.roles) && script.roles.length > 0, `menu setup should list roles for ${script.id}`);
      for (const role of script.roles) {
        assert.ok(
          getRoleById(script.id, role.id),
          `menu setup role id should be a JS Core role id: ${script.id}/${role.id}`
        );
      }
    }
  }
}

testUnityHasEveryScriptRoleIcon();
testUnityHasEveryUiAsset();
testUnityHasEveryAudioAsset();
testUnityMenuSetupUsesCoreRoleIds();

console.log("unity asset contracts ok");
