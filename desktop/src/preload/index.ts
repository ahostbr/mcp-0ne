import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  openMcpJson: () => ipcRenderer.invoke('dialog:open-mcp-json')
})
