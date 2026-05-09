const path = require("path");

const UNITY_VIEWMODEL_RELATIVE = path.join("unity-prototype", "Assets", "StreamingAssets", "unity_viewmodel.json");

function hasAsarSegment(filePath) {
  return `${filePath ?? ""}`
    .split(/[\\/]+/)
    .some((segment) => segment.toLowerCase().endsWith(".asar"));
}

function resolveUnityViewModelOutputPath({ envPath = "", appPath = "", userDataPath = "" } = {}) {
  if (envPath && `${envPath}`.trim()) {
    return path.resolve(`${envPath}`.trim());
  }

  if (appPath && !hasAsarSegment(appPath)) {
    return path.join(appPath, UNITY_VIEWMODEL_RELATIVE);
  }

  if (userDataPath && `${userDataPath}`.trim()) {
    return path.join(userDataPath, "unity", "unity_viewmodel.json");
  }

  return path.resolve(UNITY_VIEWMODEL_RELATIVE);
}

module.exports = {
  UNITY_VIEWMODEL_RELATIVE,
  hasAsarSegment,
  resolveUnityViewModelOutputPath,
};
