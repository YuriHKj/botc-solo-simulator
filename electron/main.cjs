const { app, BrowserWindow, ipcMain } = require("electron");
const fs = require("fs/promises");
const path = require("path");
const { resolveUnityViewModelOutputPath } = require("./path_helpers.cjs");

function unityViewModelOutputPath() {
  return resolveUnityViewModelOutputPath({
    envPath: process.env.BOTC_UNITY_VIEWMODEL_PATH,
    appPath: app.getAppPath(),
    userDataPath: app.getPath("userData"),
  });
}

ipcMain.handle("botc:write-unity-viewmodel", async (_event, viewModel) => {
  const outputPath = unityViewModelOutputPath();
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(viewModel, null, 2)}\n`, "utf8");
  return { ok: true, outputPath };
});

function createWindow() {
  const win = new BrowserWindow({
    width: 1600,
    height: 960,
    minWidth: 1200,
    minHeight: 760,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, "preload.cjs"),
    },
  });

  const entry = path.join(__dirname, "..", "index.html");
  win.loadFile(entry);
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
