/**
 * LCKY HUB - Main Application Logic v2.1
 * Production-ready with comprehensive settings, error handling, and persistence
 */

// ============================================
// ERROR HANDLING SYSTEM
// ============================================

class ErrorHandler {
    constructor() {
        this.errors = [];
        this.maxErrors = 100;
        this.init();
    }

    init() {
        // Global error handlers
        window.addEventListener('error', (e) => this.handleError(e));
        window.addEventListener('unhandledrejection', (e) => this.handlePromiseError(e));
        
        // Console error override for tracking
        this.originalError = console.error;
        console.error = (...args) => this.logError(args);
    }

    handleError(event) {
        const error = {
            message: event.message,
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno,
            stack: event.error?.stack,
            timestamp: new Date().toISOString(),
            type: 'runtime'
        };
        this.logError([error.message]);
        this.sendToMainProcess(error);
    }

    handlePromiseError(event) {
        const error = {
            message: event.reason?.message || 'Unknown Promise Error',
            stack: event.reason?.stack,
            timestamp: new Date().toISOString(),
            type: 'promise'
        };
        this.logError([event.reason]);
        this.sendToMainProcess(error);
    }

    logError(args) {
        // Call original console.error
        this.originalError.apply(console, args);
        
        // Store error
        const errorEntry = {
            message: args.join(' '),
            timestamp: new Date().toISOString()
        };
        
        this.errors.push(errorEntry);
        
        // Trim old errors
        if (this.errors.length > this.maxErrors) {
            this.errors.shift();
        }
    }

    sendToMainProcess(error) {
        // Send to Electron main process if available
        if (window.electronAPI?.sendError) {
            window.electronAPI.sendError(error);
        }
    }

    getErrors() {
        return this.errors;
    }

    clearErrors() {
        this.errors = [];
    }

    reportError(message, context = {}) {
        const error = {
            message,
            context,
            timestamp: new Date().toISOString(),
            type: 'reported'
        };
        this.logError([message]);
        return error;
    }
}

// ============================================
// STATE MANAGEMENT
// ============================================

const state = {
    user: null,
    currentServer: 'home',
    currentChannel: null,
    servers: [],
    friends: [],
    messages: {},
    audio: {
        masterVolume: 1.0,
        musicVolume: 0.7,
        sfxVolume: 0.8,
        micMuted: false,
        fullMuted: false,
        sounds: true
    },
    settings: {
        // Profile
        username: '',
        displayName: '',
        email: '',
        phone: '',
        status: 'online',
        statusText: '',
        
        // Appearance
        language: 'de',
        theme: 'dark',
        themeAccent: 'purple',
        chatFontSize: 'medium',
        compactMode: false,
        
        // Accessibility
        reduceMotion: false,
        highContrast: false,
        colorBlindMode: false,
        screenReader: false,
        
        // Audio/Video
        inputDevice: '',
        outputDevice: '',
        inputVolume: 1.0,
        outputVolume: 1.0,
        noiseSuppression: true,
        echoCancellation: true,
        
        // Notifications
        notifications: true,
        desktopNotifications: true,
        notificationSound: true,
        mentionSound: true,
        friendRequestSound: true,
        
        // Privacy
        shareStatus: true,
        showActivity: true,
        allowDirectMessages: true,
        
        // Advanced
        devMode: false,
        autostart: false,
        hardwareAcceleration: true,
        analytics: true
    }
};

// ============================================
// SETTINGS MANAGER (Persistence)
// ============================================

class SettingsManager {
    constructor() {
        this.storageKey = 'lcky_hub_settings';
        this.audioKey = 'lcky_hub_audio';
        this.debounceTimer = null;
        this.init();
    }

    init() {
        this.loadSettings();
        this.loadAudioSettings();
        this.applyAllSettings();
    }

    // Settings Persistence
    loadSettings() {
        try {
            const saved = localStorage.getItem(this.storageKey);
            if (saved) {
                const parsed = JSON.parse(saved);
                state.settings = { ...state.settings, ...parsed };
            }
        } catch (e) {
            console.error('Failed to load settings:', e);
            this.reportError('loadSettings', { error: e.message });
        }
    }

    saveSettings() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(state.settings));
            return true;
        } catch (e) {
            console.error('Failed to save settings:', e);
            this.reportError('saveSettings', { error: e.message });
            return false;
        }
    }

    // Audio Settings Persistence
    loadAudioSettings() {
        try {
            const saved = localStorage.getItem(this.audioKey);
            if (saved) {
                const parsed = JSON.parse(saved);
                state.audio = { ...state.audio, ...parsed };
            }
        } catch (e) {
            console.error('Failed to load audio settings:', e);
        }
    }

    saveAudioSettings() {
        try {
            localStorage.setItem(this.audioKey, JSON.stringify(state.audio));
            return true;
        } catch (e) {
            console.error('Failed to save audio settings:', e);
            return false;
        }
    }

    // Debounced save for real-time changes
    debouncedSave() {
        clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(() => {
            this.saveSettings();
            this.saveAudioSettings();
        }, 500);
    }

    // Update single setting with persistence
    setSetting(key, value) {
        if (key in state.settings) {
            state.settings[key] = value;
            this.debouncedSave();
            this.applySetting(key, value);
            return true;
        }
        return false;
    }

    // Update audio setting
    setAudioSetting(key, value) {
        if (key in state.audio) {
            state.audio[key] = value;
            this.saveAudioSettings();
            this.applyAudioSetting(key, value);
            return true;
        }
        return false;
    }

    // Apply all settings on load
    applyAllSettings() {
        // Apply theme
        this.applyTheme(state.settings.theme, state.settings.themeAccent);
        
        // Apply accessibility
        if (state.settings.reduceMotion) {
            document.body.classList.add('reduce-motion');
        }
        if (state.settings.highContrast) {
            document.body.classList.add('high-contrast');
        }
        if (state.settings.colorBlindMode) {
            document.body.classList.add('color-blind-mode');
        }
        
        // Apply language
        if (window.i18nInstance) {
            window.i18nInstance.setLanguage(state.settings.language);
        }
        
        // Apply audio
        this.applyAllAudioSettings();
    }

    // Apply specific setting
    applySetting(key, value) {
        switch (key) {
            case 'theme':
                this.applyTheme(value, state.settings.themeAccent);
                break;
            case 'themeAccent':
                this.applyTheme(state.settings.theme, value);
                break;
            case 'reduceMotion':
                document.body.classList.toggle('reduce-motion', value);
                break;
            case 'highContrast':
                document.body.classList.toggle('high-contrast', value);
                break;
            case 'colorBlindMode':
                document.body.classList.toggle('color-blind-mode', value);
                break;
            case 'language':
                if (window.i18nInstance) {
                    window.i18nInstance.setLanguage(value);
                }
                break;
            case 'compactMode':
                document.body.classList.toggle('compact-mode', value);
                break;
        }
    }

    // Theme Application
    applyTheme(theme, accent = 'purple') {
        document.body.setAttribute('data-theme', theme);
        document.body.setAttribute('data-accent', accent);
        
        // Update CSS custom properties for custom theme
        if (theme === 'custom') {
            const accentColors = {
                purple: '#8B5CF6',
                cyan: '#00FFFF',
                pink: '#FF00FF',
                green: '#00FF88',
                orange: '#FF9500'
            };
            document.documentElement.style.setProperty('--color-primary', accentColors[accent] || accentColors.purple);
        }
    }

    // Audio Application
    applyAudioSetting(key, value) {
        // Audio settings are applied in real-time to audio elements
        switch (key) {
            case 'fullMuted':
                document.body.classList.toggle('audio-muted', value);
                break;
        }
    }

    applyAllAudioSettings() {
        document.body.classList.toggle('audio-muted', state.audio.fullMuted);
    }

    // Export/Import settings
    exportSettings() {
        return {
            settings: state.settings,
            audio: state.audio,
            exportedAt: new Date().toISOString()
        };
    }

    importSettings(data) {
        try {
            if (data.settings) {
                state.settings = { ...state.settings, ...data.settings };
            }
            if (data.audio) {
                state.audio = { ...state.audio, ...data.audio };
            }
            this.saveSettings();
            this.saveAudioSettings();
            this.applyAllSettings();
            return true;
        } catch (e) {
            console.error('Failed to import settings:', e);
            return false;
        }
    }

    resetSettings() {
        // Reset to defaults
        localStorage.removeItem(this.storageKey);
        localStorage.removeItem(this.audioKey);
        
        // Reload page to apply defaults
        location.reload();
    }

    reportError(context, data = {}) {
        const error = {
            context,
            data,
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
            url: window.location.href
        };
        console.error('Settings Error:', context, data);
    }
}

// ============================================
// AUDIO MANAGER
// ============================================

class AudioManager {
    constructor() {
        this.audioContext = null;
        this.sounds = {};
        this.init();
    }

    init() {
        // Initialize audio context on user interaction
        document.addEventListener('click', () => this.ensureAudioContext(), { once: true });
        document.addEventListener('keydown', () => this.ensureAudioContext(), { once: true });
    }

    ensureAudioContext() {
        if (!this.audioContext) {
            try {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            } catch (e) {
                console.warn('Web Audio API not supported');
            }
        }
    }

    playSound(type) {
        if (!state.audio.sounds || state.audio.fullMuted) return;
        
        const volume = state.audio.sfxVolume * state.audio.masterVolume;
        this.playTone(this.getSoundFrequency(type), volume);
    }

    getSoundFrequency(type) {
        const frequencies = {
            click: 800,
            success: 1200,
            error: 400,
            notification: 600,
            hover: 400
        };
        return frequencies[type] || 500;
    }

    playTone(frequency, volume = 0.5, duration = 0.1) {
        if (!this.audioContext || volume <= 0) return;
        
        try {
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            oscillator.frequency.value = frequency;
            oscillator.type = 'sine';
            
            gainNode.gain.setValueAtTime(volume, this.audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);
            
            oscillator.start();
            oscillator.stop(this.audioContext.currentTime + duration);
        } catch (e) {
            // Ignore audio errors
        }
    }

    playNotification() {
        if (!state.audio.notifications || state.audio.fullMuted) return;
        this.playTone(800, state.audio.sfxVolume * state.audio.masterVolume * 0.5, 0.15);
        setTimeout(() => this.playTone(1200, state.audio.sfxVolume * state.audio.masterVolume * 0.5, 0.15), 150);
    }

    playMention() {
        if (!state.audio.mentionSound || state.audio.fullMuted) return;
        this.playTone(1000, state.audio.sfxVolume * state.audio.masterVolume * 0.6, 0.1);
    }
}

// ============================================
// TOAST NOTIFICATIONS
// ============================================

class ToastManager {
    constructor() {
        this.container = null;
        this.init();
    }

    init() {
        // Create toast container
        this.container = document.createElement('div');
        this.container.className = 'toast-container';
        this.container.innerHTML = `
            <style>
                .toast-container {
                    position: fixed;
                    bottom: 24px;
                    right: 24px;
                    z-index: var(--z-toast, 800);
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                    pointer-events: none;
                }
                .toast {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 14px 20px;
                    background: var(--bg-card);
                    border: 1px solid var(--border-light);
                    border-radius: var(--radius-md);
                    box-shadow: var(--shadow-elevation-high);
                    color: var(--text-primary);
                    font-size: var(--font-size-sm);
                    min-width: 280px;
                    max-width: 400px;
                    pointer-events: auto;
                    animation: toastSlideIn 0.3s ease;
                }
                .toast.success { border-color: var(--color-success); }
                .toast.error { border-color: var(--color-error); }
                .toast.warning { border-color: var(--color-warning); }
                .toast.info { border-color: var(--color-info); }
                .toast-icon {
                    width: 20px;
                    height: 20px;
                    flex-shrink: 0;
                }
                .toast.success .toast-icon { color: var(--color-success); }
                .toast.error .toast-icon { color: var(--color-error); }
                .toast.warning .toast-icon { color: var(--color-warning); }
                .toast.info .toast-icon { color: var(--color-info); }
                .toast-message {
                    flex: 1;
                }
                .toast-close {
                    width: 20px;
                    height: 20px;
                    background: none;
                    border: none;
                    color: var(--text-muted);
                    cursor: pointer;
                    padding: 0;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .toast-close:hover {
                    color: var(--text-primary);
                }
                @keyframes toastSlideIn {
                    from {
                        opacity: 0;
                        transform: translateX(100px);
                    }
                    to {
                        opacity: 1;
                        transform: translateX(0);
                    }
                }
                @keyframes toastSlideOut {
                    from {
                        opacity: 1;
                        transform: translateX(0);
                    }
                    to {
                        opacity: 0;
                        transform: translateX(100px);
                    }
                }
            </style>
        `;
        document.body.appendChild(this.container);
    }

    show(message, type = 'info', duration = 4000) {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const icons = {
            success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>',
            error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
            warning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
            info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
        };
        
        toast.innerHTML = `
            <span class="toast-icon">${icons[type] || icons.info}</span>
            <span class="toast-message">${message}</span>
            <button class="toast-close" onclick="this.parentElement.remove()">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
            </button>
        `;
        
        this.container.appendChild(toast);
        
        // Auto remove
        if (duration > 0) {
            setTimeout(() => {
                toast.style.animation = 'toastSlideOut 0.3s ease forwards';
                setTimeout(() => toast.remove(), 300);
            }, duration);
        }
    }

    success(message, duration) {
        this.show(message, 'success', duration);
    }

    error(message, duration) {
        this.show(message, 'error', duration);
    }

    warning(message, duration) {
        this.show(message, 'warning', duration);
    }

    info(message, duration) {
        this.show(message, 'info', duration);
    }
}

// ============================================
// GLOBAL INSTANCES
// ============================================

let errorHandler;
let settingsManager;
let audioManager;
let toastManager;

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
    // Initialize managers
    errorHandler = new ErrorHandler();
    settingsManager = new SettingsManager();
    audioManager = new AudioManager();
    toastManager = new ToastManager();
    
    // Load user session
    await loadUser();
    
    // Load data
    loadSettings();
    loadServers();
    loadFriends();
    
    // Initialize UI
    initAudioControls();
    renderDashboard();
    updateTime();
    setInterval(updateTime, 1000);
    setupEventListeners();
    setupSettingsNavigation();
    
    console.log('LCKY HUB initialized successfully');
});

// ============================================
// EVENT LISTENERS
// ============================================

function setupEventListeners() {
    // Close modals on escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeCreateServerModal();
            closeSettingsModal();
        }
    });

    // Close modals on backdrop click
    document.querySelectorAll('.modal-overlay, .settings-overlay').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('show');
            }
        });
    });

    // Settings change listeners
    setupSettingsListeners();
}

function setupSettingsListeners() {
    // Auto-save on setting changes (selects)
    document.querySelectorAll('[data-setting]').forEach(element => {
        element.addEventListener('change', (e) => {
            const setting = e.target.dataset.setting;
            const value = getElementValue(e.target);
            settingsManager.setSetting(setting, value);
        });
    });

    // Audio settings sliders
    document.querySelectorAll('[data-audio]').forEach(element => {
        element.addEventListener('input', (e) => {
            const setting = e.target.dataset.audio;
            const value = parseFloat(e.target.value);
            settingsManager.setAudioSetting(setting, value / 100);
            
            // Update value display
            const valueDisplay = e.target.parentElement?.querySelector('.settings-slider-value');
            if (valueDisplay) {
                valueDisplay.textContent = Math.round(e.target.value) + '%';
            }
        });
    });

    // Toggle switches
    document.querySelectorAll('.toggle-switch').forEach(toggle => {
        toggle.addEventListener('click', (e) => {
            const setting = toggle.dataset.setting;
            if (setting) {
                const currentValue = settingsManager.getSetting(setting);
                const newValue = !currentValue;
                toggle.classList.toggle('active', newValue);
                settingsManager.setSetting(setting, newValue);
                
                // Play sound feedback
                if (state.audio.sounds && !state.audio.fullMuted) {
                    audioManager.playTone(400, 0.1);
                }
            }
            
            const audioSetting = toggle.dataset.audio;
            if (audioSetting) {
                const currentValue = settingsManager.getAudioSetting(audioSetting);
                const newValue = !currentValue;
                toggle.classList.toggle('active', newValue);
                settingsManager.setAudioSetting(audioSetting, newValue);
            }
        });
    });
}

function getElementValue(element) {
    if (element.type === 'checkbox') {
        return element.checked;
    }
    if (element.type === 'range') {
        return parseFloat(element.value);
    }
    return element.value;
}

// ============================================
// SETTINGS UI
// ============================================

function setupSettingsNavigation() {
    const navItems = document.querySelectorAll('.settings-nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const section = item.dataset.section;
            
            // Update active nav
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');
            
            // Update content
            document.querySelectorAll('.settings-section-content').forEach(content => {
                content.classList.remove('active');
            });
            document.getElementById('section-' + section)?.classList.add('active');
            
            // Update title
            const titleEl = document.getElementById('settings-title');
            const titles = {
                account: 'Account',
                security: 'Sicherheit',
                appearance: 'Erscheinung',
                accessibility: 'Barrierefreiheit',
                'audio-video': 'Audio & Video',
                notifications: 'Benachrichtigungen',
                privacy: 'Datenschutz',
                advanced: 'Erweitert'
            };
            if (titleEl) titleEl.textContent = titles[section] || section;
        });
    });
}

function openSettings() {
    // Populate current values
    populateSettingsForm();
    
    document.getElementById('settings-modal')?.classList.add('show');
}

function closeSettingsModal() {
    document.getElementById('settings-modal')?.classList.remove('show');
}

function populateSettingsForm() {
    // Profile fields
    const profileFields = ['username', 'displayName', 'email', 'phone', 'statusText'];
    profileFields.forEach(field => {
        const input = document.getElementById('settings-' + field);
        if (input) {
            input.value = state.user?.[field] || state.settings[field] || '';
        }
    });
    
    // Settings dropdowns
    const dropdowns = [
        { id: 'settings-language', value: state.settings.language },
        { id: 'settings-theme', value: state.settings.theme },
        { id: 'settings-theme-accent', value: state.settings.themeAccent },
        { id: 'settings-chat-font-size', value: state.settings.chatFontSize },
        { id: 'settings-status', value: state.settings.status }
    ];
    
    dropdowns.forEach(({ id, value }) => {
        const select = document.getElementById(id);
        if (select) select.value = value;
    });
    
    // Toggle settings
    const toggles = [
        'settings-sounds', 'settings-notifications', 'settings-desktop-notifications',
        'settings-reduce-motion', 'settings-high-contrast', 'settings-color-blind-mode',
        'settings-share-status', 'settings-show-activity', 'settings-dev-mode',
        'settings-autostart', 'settings-noise-suppression', 'settings-echo-cancellation',
        'settings-notification-sound', 'settings-mention-sound', 'settings-friend-request-sound'
    ];
    
    toggles.forEach(id => {
        const toggle = document.getElementById(id);
        if (toggle) {
            const setting = toggle.dataset.setting;
            if (setting) {
                const value = state.settings[setting] ?? state.audio[setting];
                toggle.classList.toggle('active', !!value);
            }
        }
    });
    
    // Slider values
    const sliders = [
        { id: 'settings-master-volume', value: state.audio.masterVolume * 100 },
        { id: 'settings-music-volume', value: state.audio.musicVolume * 100 },
        { id: 'settings-sfx-volume', value: state.audio.sfxVolume * 100 }
    ];
    
    sliders.forEach(({ id, value }) => {
        const slider = document.getElementById(id);
        if (slider) {
            slider.value = value;
            const valueDisplay = slider.parentElement?.querySelector('.settings-slider-value');
            if (valueDisplay) valueDisplay.textContent = Math.round(value) + '%';
        }
    });
}

function saveSettings() {
    // Collect all form values
    const updates = {};
    
    // Text inputs
    document.querySelectorAll('#settings-modal input[type=\"text\"], #settings-modal input[type=\"email\"], #settings-modal input[type=\"tel\"]').forEach(input => {
        const setting = input.dataset.setting;
        if (setting) {
            updates[setting] = input.value.trim();
        }
    });
    
    // Selects
    document.querySelectorAll('#settings-modal select').forEach(select => {
        const setting = select.dataset.setting;
        if (setting) {
            updates[setting] = select.value;
        }
    });
    
    // Toggles
    document.querySelectorAll('#settings-modal .toggle-switch').forEach(toggle => {
        const setting = toggle.dataset.setting;
        if (setting) {
            updates[setting] = toggle.classList.contains('active');
        }
    });
    
    // Apply updates
    Object.entries(updates).forEach(([key, value]) => {
        settingsManager.setSetting(key, value);
    });
    
    // Show feedback
    toastManager.success('Einstellungen gespeichert');
    closeSettingsModal();
}

function cancelSettings() {
    closeSettingsModal();
}

function resetSettings() {
    if (confirm('Möchten Sie wirklich alle Einstellungen zurücksetzen?')) {
        settingsManager.resetSettings();
    }
}

// ============================================
// SETTINGS GETTERS (for UI binding)
// ============================================

SettingsManager.prototype.getSetting = function(key) {
    return state.settings[key];
};

SettingsManager.prototype.getAudioSetting = function(key) {
    return state.audio[key];
};

// ============================================
// USER MANAGEMENT
// ============================================

async function loadUser() {
    const sessionData = localStorage.getItem('lucky_hub_session');
    
    if (sessionData) {
        try {
            state.user = JSON.parse(sessionData);
            updateUserDisplay();
        } catch (e) {
            errorHandler.reportError('loadUser', { error: e.message });
            redirectToLogin();
        }
    } else {
        redirectToLogin();
    }
}

function redirectToLogin() {
    window.location.href = 'app/login.html';
}

function updateUserDisplay() {
    if (!state.user) return;
    
    const nameEl = document.getElementById('user-name');
    const initialsEl = document.getElementById('user-initials');
    const statusTextEl = document.getElementById('user-status-text');
    
    const displayName = state.user.displayName || state.user.email?.split('@')[0] || 'User';
    
    if (nameEl) nameEl.textContent = displayName;
    if (initialsEl) initialsEl.textContent = displayName.substring(0, 2).toUpperCase();
    if (statusTextEl) {
        const statusTexts = {
            online: 'Online',
            idle: 'Idle',
            dnd: 'Do Not Disturb',
            invisible: 'Invisible'
        };
        statusTextEl.textContent = statusTexts[state.settings.status] || 'Online';
    }
    
    // Update avatar status indicator
    const statusIndicator = document.querySelector('.user-avatar .status-dot');
    if (statusIndicator) {
        statusIndicator.className = 'status-dot ' + state.settings.status;
    }
}

// ============================================
// SETTINGS LOAD/SAVE (Legacy compatibility)
// ============================================

function loadSettings() {
    // Settings are already loaded by SettingsManager
    // Just update UI elements
    populateSettingsForm();
}

function applyTheme(theme) {
    settingsManager.applyTheme(theme, state.settings.themeAccent);
}

// ============================================
// SERVER MANAGEMENT
// ============================================

function loadServers() {
    const savedServers = localStorage.getItem('lcky_servers');
    if (savedServers) {
        try {
            state.servers = JSON.parse(savedServers);
        } catch (e) {
            state.servers = [
                { id: 'reflex-lab', name: 'Reflex Lab', icon: 'R' },
                { id: 'community', name: 'Community', icon: 'C' }
            ];
        }
    } else {
        state.servers = [
            { id: 'reflex-lab', name: 'Reflex Lab', icon: 'R' },
            { id: 'community', name: 'Community', icon: 'C' }
        ];
        localStorage.setItem('lcky_servers', JSON.stringify(state.servers));
    }
    renderServerList();
}

function saveServers() {
    localStorage.setItem('lcky_servers', JSON.stringify(state.servers));
}

function renderServerList() {
    const container = document.getElementById('server-list');
    if (!container) return;
    
    container.innerHTML = state.servers.map(server => `
        <div class="sidebar-item ${state.currentServer === server.id ? 'active' : ''}" 
             data-server="${server.id}" 
             onclick="switchServer('${server.id}')"
             title="${server.name}">
            <span class="icon-placeholder">${server.icon}</span>
        </div>
    `).join('');
}

function switchServer(serverId) {
    state.currentServer = serverId;
    
    // Update UI
    document.querySelectorAll('.sidebar-item').forEach(el => {
        el.classList.remove('active');
    });
    document.querySelector(`[data-server="${serverId}"]`)?.classList.add('active');
    
    // Update titlebar
    const server = state.servers.find(s => s.id === serverId);
    const serverNameEl = document.getElementById('current-server-name');
    if (serverNameEl) serverNameEl.textContent = server?.name || 'Home';
    
    // Load server content
    loadServerContent(serverId);
}

function loadServerContent(serverId) {
    const mainContent = document.getElementById('main-content');
    if (!mainContent) return;
    
    if (serverId === 'home') {
        renderDashboard();
    } else {
        renderServerView(serverId);
    }
}

function showCreateServerModal() {
    document.getElementById('create-server-modal')?.classList.add('show');
    document.getElementById('server-name-input')?.focus();
}

function closeCreateServerModal() {
    document.getElementById('create-server-modal')?.classList.remove('show');
    const input = document.getElementById('server-name-input');
    if (input) input.value = '';
}

function createServer() {
    const name = document.getElementById('server-name-input')?.value.trim();
    if (!name) {
        toastManager.warning('Bitte Servername eingeben');
        return;
    }
    
    const newServer = {
        id: 'server-' + Date.now(),
        name: name,
        icon: name.substring(0, 1).toUpperCase(),
        owner: state.user.uid,
        members: [state.user.uid],
        channels: [
            { id: 'general', name: 'General', type: 'text' },
            { id: 'voice-lobby', name: 'Lobby', type: 'voice' }
        ]
    };
    
    state.servers.push(newServer);
    saveServers();
    renderServerList();
    switchServer(newServer.id);
    closeCreateServerModal();
    toastManager.success('Server erstellt');
}

// ============================================
// FRIENDS MANAGEMENT
// ============================================

function loadFriends() {
    const savedFriends = localStorage.getItem('lcky_friends');
    if (savedFriends) {
        try {
            state.friends = JSON.parse(savedFriends);
        } catch (e) {
            state.friends = getDefaultFriends();
        }
    } else {
        state.friends = getDefaultFriends();
    }
    renderFriendsList();
}

function getDefaultFriends() {
    return [
        { id: '1', name: 'Alex Gaming', status: 'online', activity: 'Playing Reflex Test' },
        { id: '2', name: 'Sarah Pro', status: 'idle', activity: 'Idle' },
        { id: '3', name: 'Mike FPS', status: 'dnd', activity: 'Do Not Disturb' },
        { id: '4', name: 'Emma Chill', status: 'offline', activity: 'Offline' }
    ];
}

function renderFriendsList(tab = 'friends') {
    const container = document.getElementById('friends-list');
    if (!container) return;
    
    const onlineFriends = state.friends.filter(f => f.status === 'online' && !f.pending).length;
    const pendingFriends = state.friends.filter(f => f.pending);
    
    if (tab === 'pending') {
        container.innerHTML = pendingFriends.length > 0 ? `
            <div class="friends-section">
                <h2>Ausstehend - ${pendingFriends.length}</h2>
                ${pendingFriends.map(friend => renderFriendItem(friend, true)).join('')}
            </div>
        ` : '<div class="friends-empty">Keine ausstehenden Anfragen</div>';
    } else {
        container.innerHTML = `
            <div class="friends-section">
                <h2>Online - ${onlineFriends}</h2>
                ${state.friends.filter(f => f.status === 'online' && !f.pending).map(friend => renderFriendItem(friend)).join('')}
            </div>
            <div class="friends-section">
                <h2>Offline - ${state.friends.filter(f => f.status !== 'online' && !f.pending).length}</h2>
                ${state.friends.filter(f => f.status !== 'online' && !f.pending).map(friend => renderFriendItem(friend)).join('')}
            </div>
        `;
    }
    
    renderFriendSuggestions();
}

function renderFriendItem(friend, showActions = false) {
    const statusClass = friend.pending ? 'pending' : friend.status;
    
    return `
        <div class="friend-item" data-friend-id="${friend.id}" onclick="openChat('${friend.id}')">
            <div class="avatar">
                <span class="avatar-placeholder">${friend.name.substring(0, 2).toUpperCase()}</span>
                <span class="status-dot ${statusClass}"></span>
            </div>
            <div class="friend-info">
                <div class="friend-name">${friend.name}</div>
                <div class="friend-status">${friend.activity}</div>
            </div>
            ${showActions ? `
                <div class="friend-actions">
                    <button class="suggestion-btn" onclick="acceptFriendRequest('${friend.id}')" title="Akzeptieren">✓</button>
                    <button class="suggestion-btn decline" onclick="declineFriendRequest('${friend.id}')" title="Ablehnen">✕</button>
                </div>
            ` : ''}
        </div>
    `;
}

function renderFriendSuggestions() {
    const container = document.getElementById('friend-suggestions');
    if (!container) return;
    
    const suggestions = [
        { id: 'sug1', name: 'Neuer Spieler', mutual: '3 gemeinsame Freunde' },
        { id: 'sug2', name: 'AimGod', mutual: '1 gemeinsamer Freund' }
    ];
    
    container.innerHTML = suggestions.length > 0 ? `
        <div class="suggestions-header">Vorschläge</div>
        ${suggestions.map(s => `
            <div class="suggestion-item">
                <div class="avatar">
                    <span class="avatar-placeholder">${s.name.substring(0, 2).toUpperCase()}</span>
                </div>
                <div class="suggestion-info">
                    <div class="suggestion-name">${s.name}</div>
                    <div class="suggestion-mutual">${s.mutual}</div>
                </div>
                <div class="suggestion-actions">
                    <button class="suggestion-btn" onclick="openAddFriendModal()" title="Hinzufügen">+</button>
                </div>
            </div>
        `).join('')}
    ` : '';
}

function filterFriends() {
    const query = document.getElementById('friend-search')?.value.toLowerCase();
    if (!query) return;
    
    document.querySelectorAll('.friend-item').forEach(item => {
        const name = item.querySelector('.friend-name')?.textContent.toLowerCase();
        item.style.display = name?.includes(query) ? 'flex' : 'none';
    });
}

function switchFriendsTab(tab) {
    document.querySelectorAll('.friends-tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`[data-tab="${tab}"]`)?.classList.add('active');
    renderFriendsList(tab);
}

function openAddFriendModal() {
    const email = prompt('Freund per E-Mail hinzufügen:');
    if (email && email.includes('@')) {
        toastManager.success('Freundschaftsanfrage gesendet an ' + email);
    }
}

function acceptFriendRequest(id) {
    const friend = state.friends.find(f => f.id === id);
    if (friend) {
        friend.pending = false;
        friend.status = 'online';
        localStorage.setItem('lcky_friends', JSON.stringify(state.friends));
        renderFriendsList();
        toastManager.success('Freundschaftsanfrage akzeptiert');
    }
}

function declineFriendRequest(id) {
    state.friends = state.friends.filter(f => f.id !== id);
    localStorage.setItem('lcky_friends', JSON.stringify(state.friends));
    renderFriendsList();
    toastManager.info('Freundschaftsanfrage abgelehnt');
}

function openChat(friendId) {
    toastManager.info('Chat wird geöffnet...');
}

// ============================================
// AUDIO CONTROLS
// ============================================

function initAudioControls() {
    // Master mute toggle
    const masterMute = document.getElementById('master-mute');
    if (masterMute) {
        masterMute.addEventListener('click', () => {
            const newValue = !state.audio.fullMuted;
            settingsManager.setAudioSetting('fullMuted', newValue);
            masterMute.classList.toggle('active', newValue);
            masterMute.innerHTML = newValue 
                ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>'
                : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>';
        });
    }
}

// ============================================
// DASHBOARD
// ============================================

function renderDashboard() {
    // Dashboard is rendered by static HTML, this is for dynamic updates
}

function renderServerView(serverId) {
    const mainContent = document.getElementById('main-content');
    if (!mainContent) return;
    
    const server = state.servers.find(s => s.id === serverId);
    mainContent.innerHTML = `
        <div class="content-header">
            <h1 class="content-title">${server?.name || 'Server'}</h1>
        </div>
        <div class="content-body">
            <div class="card">
                <h2>Willkommen auf ${server?.name || 'dem Server'}</h2>
                <p>Wähle einen Channel aus der Liste, um zu beginnen.</p>
            </div>
        </div>
    `;
}

// ============================================
// UTILITIES
// ============================================

function updateTime() {
    const timeEl = document.getElementById('current-time');
    if (timeEl) {
        const now = new Date();
        timeEl.textContent = now.toLocaleTimeString('de-DE', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    }
}

// Make functions globally available
window.openSettings = openSettings;
window.closeSettingsModal = closeSettingsModal;
window.saveSettings = saveSettings;
window.cancelSettings = cancelSettings;
window.resetSettings = resetSettings;
window.showCreateServerModal = showCreateServerModal;
window.closeCreateServerModal = closeCreateServerModal;
window.createServer = createServer;
window.switchServer = switchServer;
window.switchFriendsTab = switchFriendsTab;
window.filterFriends = filterFriends;
window.openAddFriendModal = openAddFriendModal;
window.acceptFriendRequest = acceptFriendRequest;
window.declineFriendRequest = declineFriendRequest;
window.openChat = openChat;
window.endGame = function() { window.location.href = 'index.html'; };

// Audio control functions
window.toggleMic = function() {
    const newValue = !state.audio.micMuted;
    settingsManager.setAudioSetting('micMuted', newValue);
    const btn = document.getElementById('mic-mute');
    if (btn) btn.classList.toggle('active', newValue);
    toastManager.info(newValue ? 'Mikrofon stummgeschaltet' : 'Mikrofon aktiv');
};

window.toggleFullMute = function() {
    const newValue = !state.audio.fullMuted;
    settingsManager.setAudioSetting('fullMuted', newValue);
    const btn = document.getElementById('full-mute');
    if (btn) btn.classList.toggle('active', newValue);
    
    const btn2 = document.getElementById('full-mute-btn');
    if (btn2) btn2.classList.toggle('active', newValue);
    
    document.body.classList.toggle('audio-muted', newValue);
    
    toastManager.info(newValue ? 'Stummgeschaltet' : 'Ton aktiviert');
};

window.toggleMicMute = window.toggleMic;

// Settings helper for external access
window.getSetting = function(key) {
    return settingsManager ? settingsManager.getSetting(key) : null;
};

window.getAudioSetting = function(key) {
    return settingsManager ? settingsManager.getAudioSetting(key) : null;
};
