/**
 * LCKY HUB - Game Settings Integration
 * Shared settings functionality for all game pages
 */

// Game Settings Manager for standalone game pages
const GameSettings = {
    // Get setting from localStorage
    get(key, defaultValue) {
        try {
            const settings = JSON.parse(localStorage.getItem('lcky_hub_settings') || '{}');
            const audio = JSON.parse(localStorage.getItem('lcky_hub_audio') || '{}');
            return audio[key] ?? settings[key] ?? defaultValue;
        } catch (e) {
            return defaultValue;
        }
    },
    
    // Get audio setting
    getAudio(key, defaultValue) {
        try {
            const audio = JSON.parse(localStorage.getItem('lcky_hub_audio') || '{}');
            return audio[key] ?? defaultValue;
        } catch (e) {
            return defaultValue;
        }
    },
    
    // Apply theme accent colors
    applyThemeAccent() {
        const themeAccent = this.get('themeAccent', 'purple');
        const accentColors = {
            purple: '#8B5CF6',
            cyan: '#00FFFF',
            pink: '#FF00FF',
            green: '#00FF88',
            orange: '#FF9500'
        };
        const accent = accentColors[themeAccent] || accentColors.purple;
        document.documentElement.style.setProperty('--neon-pink', accent);
        document.documentElement.style.setProperty('--color-primary', accent);
    },
    
    // Apply reduce motion setting
    applyReduceMotion() {
        const reduceMotion = this.get('reduceMotion', false);
        if (reduceMotion) {
            document.body.classList.add('reduce-motion');
        }
    },
    
    // Play hit sound
    playHitSound(frequency = 800, duration = 0.1) {
        if (!this.getAudio('sounds', true) || this.getAudio('fullMuted', false)) return;
        
        const volume = this.getAudio('sfxVolume', 0.8) * this.getAudio('masterVolume', 1.0);
        
        try {
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            
            oscillator.frequency.value = frequency;
            oscillator.type = 'sine';
            
            gainNode.gain.setValueAtTime(volume * 0.3, audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
            
            oscillator.start();
            oscillator.stop(audioCtx.currentTime + duration);
        } catch (e) {
            // Ignore audio errors
        }
    },
    
    // Initialize all game settings
    init() {
        this.applyThemeAccent();
        this.applyReduceMotion();
    }
};

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    GameSettings.init();
});

// Make globally available
window.GameSettings = GameSettings;
