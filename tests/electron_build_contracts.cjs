const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const packageJson = require("../package.json");

const files = packageJson.build?.files ?? [];

for (const requiredPattern of ["index.html", "styles.css", "assets/**/*", "scripts/**/*", "electron/**/*"]) {
  assert.ok(files.includes(requiredPattern), `electron build.files must include ${requiredPattern}`);
}

assert.equal(packageJson.build?.asar, true, "electron build should keep asar enabled");
assert.equal(packageJson.main, "electron/main.cjs", "electron main entry should point to electron/main.cjs");
assert.equal(packageJson.scripts?.["electron:pack"], "electron-builder --win --dir", "electron:pack should build a fast unpacked Windows package");

for (const requiredPath of ["electron/main.cjs", "electron/preload.cjs", "electron/path_helpers.cjs"]) {
  assert.ok(fs.existsSync(path.join(__dirname, "..", requiredPath)), `${requiredPath} must exist for packaged Electron`);
}

console.log("Electron build contracts passed.");
