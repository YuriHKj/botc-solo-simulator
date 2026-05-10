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
const sourceAudioRoot = path.join(root, "assets", "audio");
const unityAudioRoot = path.join(root, "unity-prototype", "Assets", "Resources", "Botc", "audio");

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

testUnityHasEveryScriptRoleIcon();
testUnityHasEveryUiAsset();
testUnityHasEveryAudioAsset();

console.log("unity asset contracts ok");
