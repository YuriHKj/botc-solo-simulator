const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("botcBridge", {
  writeUnityViewModel: (viewModel) => ipcRenderer.invoke("botc:write-unity-viewmodel", viewModel),
});
