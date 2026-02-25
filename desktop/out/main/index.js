"use strict";
const electron = require("electron");
const path = require("path");
const fs = require("fs");
const child_process = require("child_process");
const is = {
  dev: !electron.app.isPackaged
};
({
  isWindows: process.platform === "win32",
  isMacOS: process.platform === "darwin",
  isLinux: process.platform === "linux"
});
const MCP0NE_DIR = "C:\\Projects\\mcp-0ne";
const MCP0NE_PORT = 8150;
let serverProc = null;
let weOwnServer = false;
function checkServerRunning() {
  return new Promise((resolve) => {
    const req = electron.net.request(`http://localhost:${MCP0NE_PORT}/health`);
    req.on("response", () => resolve(true));
    req.on("error", () => resolve(false));
    req.end();
  });
}
async function ensureServer() {
  const alreadyRunning = await checkServerRunning();
  if (alreadyRunning) {
    console.log("mcp-0ne server already running, skipping spawn");
    return;
  }
  console.log("Starting mcp-0ne server...");
  serverProc = child_process.spawn("python", ["-m", "mcp_0ne.server"], {
    cwd: MCP0NE_DIR,
    stdio: "ignore",
    windowsHide: true
  });
  weOwnServer = true;
  serverProc.on("error", (err) => {
    console.error("Failed to start mcp-0ne server:", err.message);
    serverProc = null;
    weOwnServer = false;
  });
  serverProc.on("exit", (code) => {
    console.log(`mcp-0ne server exited (code ${code})`);
    serverProc = null;
    weOwnServer = false;
  });
}
function stopServer() {
  if (weOwnServer && serverProc && !serverProc.killed) {
    serverProc.kill();
    serverProc = null;
    weOwnServer = false;
  }
}
function createWindow() {
  const win = new electron.BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 500,
    minHeight: 400,
    frame: false,
    titleBarStyle: "hidden",
    titleBarOverlay: {
      color: "#0a0a16",
      symbolColor: "#00f0ff",
      height: 36
    },
    backgroundColor: "#03030a",
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    electron.shell.openExternal(url);
    return { action: "deny" };
  });
  if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    win.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    win.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
}
electron.ipcMain.handle("dialog:open-mcp-json", async () => {
  const win = electron.BrowserWindow.getFocusedWindow();
  if (!win) return { cancelled: true };
  const result = await electron.dialog.showOpenDialog(win, {
    title: "Import .mcp.json",
    filters: [
      { name: "MCP Config", extensions: ["json"] },
      { name: "All Files", extensions: ["*"] }
    ],
    properties: ["openFile"]
  });
  if (result.canceled || result.filePaths.length === 0) {
    return { cancelled: true };
  }
  try {
    const raw = fs.readFileSync(result.filePaths[0], "utf-8");
    const parsed = JSON.parse(raw);
    return { cancelled: false, path: result.filePaths[0], data: parsed };
  } catch (e) {
    return { cancelled: false, error: e.message };
  }
});
electron.app.whenReady().then(async () => {
  if (process.env.NODE_ENV !== "test") {
    await ensureServer();
  }
  createWindow();
  electron.app.on("activate", () => {
    if (electron.BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});
electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    electron.app.quit();
  }
});
electron.app.on("before-quit", () => {
  stopServer();
});
