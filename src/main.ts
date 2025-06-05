import {
  app,
  BrowserWindow,
  Menu,
  Tray,
  ipcMain,
  globalShortcut,
} from "electron";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
// Removed child_process import - no longer needed
// Removed ClipboardHandler import - no longer needed
import { SmartClipboard } from "./smart-clipboard.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isFirstLaunch = true;
let launchedAtLogin = false;
let smartClipboard: SmartClipboard | null = null;

const createWindow = (): void => {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    titleBarStyle: "hiddenInset",
    resizable: false,
    minimizable: true,
    maximizable: false,
    show: false,
    backgroundColor: "#fafbfc",
  });

  mainWindow.loadFile("index.html");

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
};

// Setup IPC handlers once (outside of createWindow)
const setupIpcHandlers = (): void => {
  // Handle window events from renderer
  ipcMain.handle("hide-window", () => {
    if (mainWindow) {
      mainWindow.hide();
    }
  });

  // Handle manual trigger request
  ipcMain.handle("manual-trigger", async () => {
    try {
      if (!smartClipboard) {
        throw new Error("Smart clipboard not initialized");
      }

      await smartClipboard.manualTrigger();
    } catch (error) {
      console.error("Manual trigger failed:", error);
      throw error;
    }
  });

  // Handle content choice
  ipcMain.handle(
    "handle-content-choice",
    async (_, choice: "original" | "formatted" | "both") => {
      try {
        if (!smartClipboard) {
          throw new Error("Smart clipboard not initialized");
        }

        await smartClipboard.handleContentChoice(choice);
      } catch (error) {
        console.error("Content choice handling failed:", error);
        throw error;
      }
    }
  );
};

// Removed permission checking - handled by smart-context when needed

// Removed manual hotkey listener - now using clipboard monitoring

const createTray = (): void => {
  // Create a simple tray icon
  try {
    const trayIconPath = join(__dirname, "../assets/tray-icon.png");
    tray = new Tray(trayIconPath);
  } catch (error) {
    // Fallback: Create a minimal tray without icon if asset not found
    console.log("Tray icon not found, creating without icon");
  }

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Show scopyy",
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        } else {
          createWindow();
          // mainWindow is now assigned in createWindow()
          setTimeout(() => {
            if (mainWindow) {
              mainWindow.show();
            }
          }, 100);
        }
      },
    },
    { type: "separator" },
    {
      label: "Format Selected Text (⌘⇧V)",
      click: async () => {
        if (smartClipboard) {
          await smartClipboard.manualTrigger();
        }
      },
    },
    {
      label: "Start at Login",
      type: "checkbox",
      checked: app.getLoginItemSettings().openAtLogin,
      click: (menuItem) => {
        app.setLoginItemSettings({
          openAtLogin: menuItem.checked,
          openAsHidden: true,
        });
      },
    },
    {
      label: "Restart Services",
      click: () => {
        // Re-register hotkey
        globalShortcut.unregisterAll();
        globalShortcut.register("CommandOrControl+Shift+V", async () => {
          console.log("⌨️ Manual trigger hotkey pressed");
          if (smartClipboard) {
            await smartClipboard.manualTrigger();
          }
        });

        console.log("🔄 Services restarted - hotkey re-registered");
      },
    },
    { type: "separator" },
    {
      label: "Quit scopyy",
      click: () => {
        app.quit();
      },
    },
  ]);

  if (tray) {
    tray.setContextMenu(contextMenu);
    tray.setToolTip("scopyy - Smart Clipboard Monitor");
  }
};

// Check if app was launched at login
launchedAtLogin = app.getLoginItemSettings().wasOpenedAtLogin;

// App event handlers
app.whenReady().then(() => {
  // Setup IPC handlers first
  setupIpcHandlers();

  createWindow();
  createTray();

  // Initialize smart clipboard (hotkey-only mode)
  smartClipboard = new SmartClipboard(mainWindow || undefined);
  smartClipboard.initialize();

  // Register global hotkey for manual trigger
  const hotkeyRegistered = globalShortcut.register(
    "CommandOrControl+Shift+V",
    async () => {
      console.log("⌨️ Manual trigger hotkey pressed");
      if (smartClipboard) {
        await smartClipboard.manualTrigger();
      } else {
        console.log("❌ Smart clipboard not available");
      }
    }
  );

  if (hotkeyRegistered) {
    console.log("✅ Hotkey ⌘⇧V registered successfully");
  } else {
    console.log("❌ Failed to register hotkey ⌘⇧V");
  }

  // Log ready state instead of showing notification
  if (!launchedAtLogin) {
    console.log("🚀 scopyy Ready - Select text and use ⌘⇧V to format it");
  }

  // Show window only on first launch or manual launch
  if (!launchedAtLogin && isFirstLaunch) {
    setTimeout(() => {
      if (mainWindow) {
        mainWindow.show();
      }
    }, 100);
  }

  isFirstLaunch = false;
});

app.on("window-all-closed", () => {
  // Keep the app running even when all windows are closed (tray app behavior)
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on("before-quit", () => {
  // Unregister all global shortcuts
  globalShortcut.unregisterAll();
});
