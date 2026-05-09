const assert = require("node:assert/strict");
const path = require("node:path");
const {
  hasAsarSegment,
  resolveUnityViewModelOutputPath,
} = require("../electron/path_helpers.cjs");

function normalizePath(filePath) {
  return filePath.replaceAll("\\", "/");
}

assert.equal(hasAsarSegment("C:\\Program Files\\BOTC\\resources\\app.asar"), true);
assert.equal(hasAsarSegment("C:\\Users\\11507\\Documents\\Playground"), false);

const devPath = resolveUnityViewModelOutputPath({
  appPath: "C:\\Users\\11507\\Documents\\Playground",
  userDataPath: "C:\\Users\\11507\\AppData\\Roaming\\BOTC Solo Simulator",
});
assert.equal(
  normalizePath(devPath),
  normalizePath(
    path.join(
      "C:\\Users\\11507\\Documents\\Playground",
      "unity-prototype",
      "Assets",
      "StreamingAssets",
      "unity_viewmodel.json",
    ),
  ),
);

const packagedPath = resolveUnityViewModelOutputPath({
  appPath: "C:\\Program Files\\BOTC Solo Simulator\\resources\\app.asar",
  userDataPath: "C:\\Users\\11507\\AppData\\Roaming\\BOTC Solo Simulator",
});
assert.equal(
  normalizePath(packagedPath),
  normalizePath(
    path.join(
      "C:\\Users\\11507\\AppData\\Roaming\\BOTC Solo Simulator",
      "unity",
      "unity_viewmodel.json",
    ),
  ),
);

const envPath = resolveUnityViewModelOutputPath({
  envPath: "C:\\custom\\unity_viewmodel.json",
  appPath: "C:\\Users\\11507\\Documents\\Playground",
  userDataPath: "C:\\Users\\11507\\AppData\\Roaming\\BOTC Solo Simulator",
});
assert.equal(normalizePath(envPath), normalizePath(path.resolve("C:\\custom\\unity_viewmodel.json")));

console.log("Electron path contracts passed.");
