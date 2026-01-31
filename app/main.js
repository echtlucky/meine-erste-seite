/**
 * LCKY HUB - Electron Main Process v2.1
 * Production-ready with Auto-Updater and proper error handling
 * 
 * @version 2.1.0
 */

const { 
    app, 
    BrowserWindow, 
    ipcMain, 
    shell, 
    dialog, 
    Menu,
    globalShortcut,
    Tray,
    nativeImage
} = require('electron');
const path = require('path');
const fs = require('fs');
const isDev = process.env.NODE_ENV === 'development';

// ============================================
// GPU & CACHE FIXES
// ============================================

// Disable GPU warnings and hardware acceleration issues
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-software-rasterizer');
app.commandLine.appendSwitch('disable-dev-shm-usage');
app.commandLine.appendSwitch('no-sandbox');
app.disableHardwareAcceleration();

// Suppress GPU crash warnings
process.on('warning', (warning) => {
    if (warning.message.includes('GPU') || warning.message.includes('WebGL')) {
        return;
    }
    console.warn('Warning:', warning.message);
});

// ============================================
// CACHE DIRECTORY SETUP
// ============================================

function getCachePath() {
    const basePath = process.env.XDG_CACHE_HOME || path.join(app.getPath('home'), '.cache');
    const cacheDir = isDev ? path.join(process.cwd(), '.cache') : path.join(basePath, 'lcky-hub');
    
    try {
        if (!fs.existsSync(cacheDir)) {
            fs.mkdirSync(cacheDir, { recursive: true });
        }
        return cacheDir;
    } catch (e) {
        console.warn('Could not create cache directory:', e.message);
        return app.getPath('temp');
    }
}

// Set custom cache path
try {
    const cachePath = getCachePath();
    app.setPath('cache', cachePath);
    app.setPath('userData', path.join(path.dirname(cachePath), 'lcky-hub-data'));
} catch (e) {
    console.warn('Could not set custom cache path:', e.message);
}

// Clear old cache on startup if needed
const CACHE_VERSION_FILE = path.join(app.getPath('userData'), '.cache_version');
const CURRENT_CACHE_VERSION = '2.1';

function clearOldCache() {
    try {
        const oldVersion = fs.readFileSync(CACHE_VERSION_FILE, 'utf8').trim();
        if (oldVersion !== CURRENT_CACHE_VERSION) {
            const cacheDir = app.getPath('cache');
            if (fs.existsSync(cacheDir)) {
                fs.rmSync(cacheDir, { recursive: true, force: true });
                fs.mkdirSync(cacheDir, { recursive: true });
            }
            fs.writeFileSync(CACHE_VERSION_FILE, CURRENT_CACHE_VERSION);
            console.log('Cache cleared for new version');
        }
    } catch (e) {
        // First run or no version file
        try {
            fs.writeFileSync(CACHE_VERSION_FILE, CURRENT_CACHE_VERSION);
        } catch (e2) {
            // Ignore
        }
    }
}

if (!isDev) {
    clearOldCache();
}

// ============================================
// AUTO-UPDATER SETUP (Safe)
// ============================================

let autoUpdater = null;
let updateCheckDone = false;

if (!isDev) {
    try {
        const { autoUpdater: updater } = require('electron-updater');
        autoUpdater = updater;
        autoUpdater.autoDownload = false;
        autoUpdater.autoInstallOnAppQuit = true;
        autoUpdater.allowDowngrade = false;
        
        // Set feed URL
        autoUpdater.setFeedURL({
            provider: 'github',
            owner: 'echtlucky',
            repo: 'lucky-hub'
        });
        
        // Update check events
        autoUpdater.on('error', (error) => {
            console.log('Updater error (non-critical):', error.message);
        });
        
        autoUpdater.on('update-available', (info) => {
            console.log('Update available:', info.version);
        });
        
        autoUpdater.on('update-not-available', (info) => {
            console.log('No update available');
        });
        
        console.log('Auto-updater initialized');
    } catch (e) {
        console.log('Auto-updater not available:', e.message);
        autoUpdater = null;
    }
}

// ============================================
// WINDOW SETUP
// ============================================

let mainWindow = null;
let splashWindow = null;
let tray = null;
let isQuitting = false;

const WINDOW_DEFAULTS = {
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    titleBarHeight: 40
};

function createSplashWindow() {
    splashWindow = new BrowserWindow({
        width: 420,
        height: 320,
        frame: false,
        show: true,
        alwaysOnTop: true,
        skipTaskbar: false,
        resizable: false,
        minimizable: false,
        maximizable: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        },
        backgroundColor: '#020403',
        icon: path.join(__dirname, 'assets/img/logo.png')
    });
    
    splashWindow.loadFile(path.join(__dirname, 'splash.html'));
    splashWindow.setMenuBarVisibility(false);
}

function createWindow() {
    createSplashWindow();

    mainWindow = new BrowserWindow({
        ...WINDOW_DEFAULTS,
        frame: false,
        show: false,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
            spellcheck: true,
            webSecurity: true,
            allowRunningInsecureContent: false
        },
        backgroundColor: '#0D0B14',
        titleBarStyle: 'hidden',
        titleBarOverlay: {
            color: '#0D0B14',
            symbolColor: '#A78BFA',
            height: WINDOW_DEFAULTS.titleBarHeight
        },
        icon: path.join(__dirname, 'assets/img/logo-icon.png')
    });

    // Suppress GPU warnings
    mainWindow.webContents.on('console-message', (event, level, message) => {
        if (message.includes('GPU') || message.includes('GPU cache')) {
            event.preventDefault();
        }
    });

    if (isDev) {
        mainWindow.loadURL('http://localhost:3000');
        mainWindow.webContents.openDevTools({ mode: 'detach' });
    } else {
        mainWindow.loadFile(path.join(__dirname, 'index.html'));
    }

    mainWindow.once('ready-to-show', () => {
        setTimeout(() => {
            mainWindow.show();
            if (splashWindow) {
                splashWindow.close();
                splashWindow = null;
            }
            // Only check for updates in production after window is shown
            if (!updateCheckDone && autoUpdater && !isDev) {
                updateCheckDone = true;
                checkForUpdates();
            }
        }, 500);
    });

    setupWindowEvents(mainWindow);
    createMenu();
    createTray();
    registerShortcuts();
}

// ============================================
// WINDOW EVENTS
// ============================================

function setupWindowEvents(win) {
    ipcMain.handle('minimize', () => win.minimize());
    ipcMain.handle('maximize', () => {
        if (win.isMaximized()) win.unmaximize();
        else win.maximize();
    });
    ipcMain.handle('close', () => {
        if (process.platform === 'darwin') {
            app.hide();
        } else if (!isDev) {
            win.hide();
        } else {
            win.close();
        }
    });
    ipcMain.handle('get-position', () => win.getPosition());
    win.on('focus', () => win.webContents.send('window-focus'));
    win.on('blur', () => win.webContents.send('window-blur'));
    win.on('maximize', () => win.webContents.send('window-maximize'));
    win.on('unmaximize', () => win.webContents.send('window-unmaximize'));
    win.on('close', (e) => {
        if (!isQuitting && !isDev) {
            e.preventDefault();
            win.hide();
        }
    });
}

// ============================================
// MENU & TRAY
// ============================================

function createMenu() {
    const template = [
        { label: app.name, submenu: [{ role: 'about' }, { type: 'separator' }, { role: 'quit' }] },
        { label: 'Bearbeiten', submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }] },
        { label: 'Ansicht', submenu: [{ role: 'reload' }, { role: 'toggleDevTools' }, { type: 'separator' }, { role: 'togglefullscreen' }] },
        { label: 'Fenster', submenu: [{ role: 'minimize' }, { role: 'zoom' }] },
        { label: 'Hilfe', submenu: [{ label: 'Auf Updates prüfen', click: () => checkForUpdates() }] }
    ];
    Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createTray() {
    const icon = nativeImage.createEmpty();
    tray = new Tray(icon);
    tray.setToolTip('LCKY HUB');
    tray.setContextMenu(Menu.buildFromTemplate([
        { label: 'Öffnen', click: () => mainWindow?.show() },
        { type: 'separator' },
        { label: 'Beenden', click: () => { isQuitting = true; app.quit(); } }
    ]));
}

function registerShortcuts() {
    globalShortcut.register('CommandOrControl+Shift+L', () => mainWindow?.show());
}

// ============================================
// UPDATE CHECKING (Safe)
// ============================================

function checkForUpdates() {
    if (!autoUpdater) return;
    
    autoUpdater.checkForUpdates()
        .then((result) => {
            // Safely check for updateInfo
            if (result && result.updateInfo && result.updateInfo.version !== app.getVersion()) {
                mainWindow?.webContents.send('update-available', result.updateInfo);
            }
        })
        .catch(err => {
            // Silently handle update check failures
            console.log('Update check skipped:', err.message);
        });
}

function downloadUpdate() {
    if (!autoUpdater) return;
    
    dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Update verfügbar',
        message: 'Update herunterladen?',
        detail: 'Wird beim Beenden installiert.',
        buttons: ['Ja', 'Nein']
    }).then((result) => {
        if (result.response === 0) {
            autoUpdater.downloadUpdate()
                .then(() => mainWindow?.webContents.send('update-downloaded'))
                .catch(err => console.error('Download failed:', err));
        }
    });
}

// ============================================
// IPC HANDLERS
// ============================================

ipcMain.handle('check-for-updates', () => checkForUpdates());
ipcMain.handle('download-update', () => downloadUpdate());
ipcMain.handle('get-app-version', () => app.getVersion());
ipcMain.handle('open-external', (e, url) => shell.openExternal(url));

// ============================================
// APP LIFECYCLE
// ============================================

app.whenReady().then(() => {
    createWindow();
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
        else mainWindow?.show();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
    isQuitting = true;
});

// Handle uncaught exceptions gracefully
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    if (mainWindow) {
        mainWindow.webContents.send('app-error', error.message);
    }
});

process.on('unhandledRejection', (reason) => {
    console.warn('Unhandled Rejection:', reason);
});
