/**
 * LCKY HUB - Electron Preload Script
 * Secure IPC bridge for renderer process with context isolation
 * 
 * @version 1.0
 */

const { contextBridge, ipcRenderer } = require('electron');

// Secure IPC bridge for renderer process
contextBridge.exposeInMainWorld('electronAPI', {
    // Window controls
    minimize: () => ipcRenderer.invoke('minimize'),
    maximize: () => ipcRenderer.invoke('maximize'),
    close: () => ipcRenderer.invoke('close'),
    restore: () => ipcRenderer.invoke('restore'),
    
    // Window state
    getWindowState: () => ipcRenderer.invoke('get-window-state'),
    getPosition: () => ipcRenderer.invoke('get-position'),
    setPosition: (x, y) => ipcRenderer.invoke('set-position', x, y),
    
    // Firebase operations (secure, server-side)
    firebaseSignup: (data) => ipcRenderer.invoke('firebase-signup', data),
    firebaseSignin: (data) => ipcRenderer.invoke('firebase-signin', data),
    firebaseSignout: () => ipcRenderer.invoke('firebase-signout'),
    
    // Firestore operations
    firestoreGet: (data) => ipcRenderer.invoke('firestore-get', data),
    firestoreSet: (data) => ipcRenderer.invoke('firestore-set', data),
    firestoreUpdate: (data) => ipcRenderer.invoke('firestore-update', data),
    
    // Config
    getConfig: () => ipcRenderer.invoke('get-config'),
    saveConfig: (config) => ipcRenderer.invoke('save-config', config),
    
    // Platform info
    platform: process.platform,
    
    // App version
    appVersion: () => require('electron').app.getVersion(),
    
    // Update
    checkForUpdates: (manual = false) => ipcRenderer.invoke('check-updates', manual),
    
    // Focus/blur events
    onFocus: (callback) => ipcRenderer.on('window-focus', callback),
    onBlur: (callback) => ipcRenderer.on('window-blur', callback)
});

// Safe clipboard access
contextBridge.exposeInMainWorld('clipboardAPI', {
    writeText: (text) => require('electron').clipboard.writeText(text),
    readText: () => require('electron').clipboard.readText(),
    writeHTML: (html) => require('electron').clipboard.writeHTML(html),
    readHTML: () => require('electron').clipboard.readHTML()
});

// Notification (with permission check)
contextBridge.exposeInMainWorld('notificationAPI', {
    show: (options) => {
        if (Notification.permission === 'granted') {
            new Notification(options.title, { 
                body: options.body,
                icon: options.icon,
                silent: options.silent
            });
        } else if (Notification.permission !== 'denied') {
            Notification.requestPermission().then(permission => {
                if (permission === 'granted') {
                    new Notification(options.title, { 
                        body: options.body,
                        icon: options.icon,
                        silent: options.silent
                    });
                }
            });
        }
    },
    permission: () => Notification.permission,
    requestPermission: () => Notification.requestPermission()
});

// Shell integration
contextBridge.exposeInMainWorld('shellAPI', {
    openExternal: (url) => require('electron').shell.openExternal(url),
    openPath: (path) => require('electron').shell.openPath(path),
    showItemInFolder: (fullPath) => require('electron').shell.showItemInFolder(fullPath),
    trashItem: (path) => require('electron').shell.trashItem(path)
});

// Native dialogs
contextBridge.exposeInMainWorld('dialogAPI', {
    openFile: (options) => ipcRenderer.invoke('dialog-open-file', options),
    openDirectory: (options) => ipcRenderer.invoke('dialog-open-directory', options),
    saveFile: (options) => ipcRenderer.invoke('dialog-save-file', options),
    messageBox: (options) => ipcRenderer.invoke('dialog-message-box', options),
    errorBox: (options) => ipcRenderer.invoke('dialog-error-box', options)
});

// Screen info
contextBridge.exposeInMainWorld('screenAPI', {
    getDisplay: () => {
        const { screen } = require('electron');
        const primaryDisplay = screen.getPrimaryDisplay();
        return {
            bounds: primaryDisplay.bounds,
            workArea: primaryDisplay.workArea,
            scaleFactor: primaryDisplay.scaleFactor,
            size: primaryDisplay.size,
            width: primaryDisplay.bounds.width,
            height: primaryDisplay.bounds.height
        };
    },
    getAllDisplays: () => {
        const { screen } = require('electron');
        return screen.getAllDisplays().map(d => ({
            id: d.id,
            bounds: d.bounds,
            size: d.size
        }));
    }
});

// Power monitor
contextBridge.exposeInMainWorld('powerAPI', {
    onSuspend: (callback) => ipcRenderer.on('power-suspend', callback),
    onResume: (callback) => ipcRenderer.on('power-resume', callback),
    preventSuspend: () => ipcRenderer.invoke('power-prevent-suspend')
});

// Request notification permission on app start
if (typeof Notification !== 'undefined') {
    Notification.requestPermission();
}

// Log to main process (for debugging)
contextBridge.exposeInMainWorld('logger', {
    log: (...args) => ipcRenderer.invoke('log', { level: 'log', args }),
    info: (...args) => ipcRenderer.invoke('log', { level: 'info', args }),
    warn: (...args) => ipcRenderer.invoke('log', { level: 'warn', args }),
    error: (...args) => ipcRenderer.invoke('log', { level: 'error', args })
});

// WebRTC support in Electron
contextBridge.exposeInMainWorld('webrtcAPI', {
    getUserMedia: (constraints) => navigator.mediaDevices.getUserMedia(constraints),
    getDisplayMedia: (constraints) => navigator.mediaDevices.getDisplayMedia(constraints),
    enumerateDevices: () => navigator.mediaDevices.enumerateDevices()
});

// Touch bar support (macOS only)
contextBridge.exposeInMainWorld('touchBarAPI', {
    setTouchBar: (items) => {
        if (process.platform === 'darwin') {
            const { TouchBar } = require('electron');
            // TouchBar setup would go here
        }
    }
});
