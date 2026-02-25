"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("electronAPI", {
  platform: process.platform,
  openMcpJson: () => electron.ipcRenderer.invoke("dialog:open-mcp-json")
});
