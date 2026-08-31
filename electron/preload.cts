const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("modelCodex", {
  getAppInfo: () => ipcRenderer.invoke("app:info"),
  loadState: () => ipcRenderer.invoke("state:load"),
  saveState: (state: unknown) => ipcRenderer.invoke("state:save", state),
  chooseTextFiles: () => ipcRenderer.invoke("files:choose-text"),
  listModels: (provider: unknown, apiKey: unknown) => ipcRenderer.invoke("provider:list-models", provider, apiKey),
  runChat: (request: unknown) => ipcRenderer.invoke("agent:run-chat", request),
  synthesizeConnector: (request: unknown) => ipcRenderer.invoke("connector:synthesize", request),
  openExternal: (url: unknown) => ipcRenderer.invoke("app:open-external", url),
});
