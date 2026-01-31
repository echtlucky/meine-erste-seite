/**
 * LCKY HUB - Dev Tool API
 * Connects the Dev Tool UI to the AI Monitor and provides logging/features
 */

const DevToolAPI = {
    logs: [],
    issues: [],
    fixHistory: [],
    autoFixEnabled: false,

    init() {
        console.log('[DevTool-API] Initializing...');
        
        // Register with AI Monitor
        if (window.aiMonitor) {
            window.devToolAPI = this;
        }
        
        // Setup sidebar navigation
        this.setupNavigation();
        
        // Setup feature flags
        this.setupFeatureFlags();
        
        // Setup cache buttons
        this.setupCacheButtons();
        
        // Update dev mode badge
        this.updateDevModeBadge();
        
        console.log('[DevTool-API] Ready');
    },

    setupNavigation() {
        const navItems = document.querySelectorAll('.devtool-nav-item');
        const sections = document.querySelectorAll('.devtool-section');
        
        navItems.forEach(item => {
            item.addEventListener('click', () => {
                const section = item.dataset.section;
                
                // Update active nav
                navItems.forEach(nav => nav.classList.remove('active'));
                item.classList.add('active');
                
                // Update active section
                sections.forEach(sec => sec.classList.remove('active'));
                document.getElementById(`section-${section}`).classList.add('active');
            });
        });
    },

    setupFeatureFlags() {
        const toggles = document.querySelectorAll('.feature-flag .toggle');
        
        toggles.forEach(toggle => {
            toggle.addEventListener('click', () => {
                toggle.classList.toggle('active');
            });
        });
    },

    setupCacheButtons() {
        const clearLogsBtn = document.getElementById('clearLogs');
        const copyLogsBtn = document.getElementById('copyLogs');
        const clearCacheBtn = document.getElementById('clearAllCache');
        
        if (clearLogsBtn) {
            clearLogsBtn.addEventListener('click', () => {
                this.clearLogs();
            });
        }
        
        if (copyLogsBtn) {
            copyLogsBtn.addEventListener('click', () => {
                this.copyLogs();
            });
        }
        
        if (clearCacheBtn) {
            clearCacheBtn.addEventListener('click', () => {
                this.clearAllCache();
            });
        }
    },

    updateDevModeBadge() {
        const badge = document.getElementById('devModeBadge');
        if (badge) {
            const isAdmin = this.checkAdminPermission();
            badge.className = `test-mode-badge ${isAdmin ? 'active' : 'inactive'}`;
            badge.innerHTML = `<span>●</span> ${isAdmin ? 'Dev Mode Aktiv' : 'Dev Mode Inaktiv'}`;
        }
    },

    checkAdminPermission() {
        const userData = JSON.parse(localStorage.getItem('userData') || '{}');
        return userData.isAdmin === true || userData.email === 'lucassteckel04@gmail.com';
    },

    // ==========================================
    // LOGGING API
    // ==========================================
    
    log(data) {
        const entry = {
            ...data,
            timestamp: new Date().toISOString()
        };
        
        this.logs.unshift(entry);
        
        // Keep only last 100 logs
        if (this.logs.length > 100) {
            this.logs.pop();
        }
        
        this.renderLog(entry);
    },

    renderLog(entry) {
        const container = document.getElementById('logsContainer');
        if (!container) return;
        
        const time = new Date().toLocaleTimeString('de-DE', { 
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
        
        const div = document.createElement('div');
        div.className = `dev-log ${entry.level || 'info'}`;
        div.setAttribute('data-time', time);
        div.textContent = entry.message || JSON.stringify(entry);
        
        container.insertBefore(div, container.firstChild);
        
        // Update time on all logs
        container.querySelectorAll('.dev-log').forEach((log, index) => {
            if (this.logs[index]) {
                const logTime = new Date(this.logs[index].timestamp).toLocaleTimeString('de-DE', {
                    hour12: false,
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                });
                log.setAttribute('data-time', logTime);
            }
        });
    },

    clearLogs() {
        this.logs = [];
        const container = document.getElementById('logsContainer');
        if (container) {
            container.innerHTML = '';
        }
        this.log({
            level: 'info',
            message: '[SYSTEM] Logs cleared'
        });
    },

    copyLogs() {
        const logText = this.logs.map(log => {
            const time = new Date(log.timestamp).toLocaleTimeString('de-DE');
            return `[${time}] [${log.level?.toUpperCase()}] ${log.message}`;
        }).join('\n');
        
        navigator.clipboard.writeText(logText).then(() => {
            this.log({
                level: 'success',
                message: '[SYSTEM] Logs copied to clipboard'
            });
        }).catch(() => {
            this.log({
                level: 'error',
                message: '[SYSTEM] Failed to copy logs'
            });
        });
    },

    // ==========================================
    // ISSUES API
    // ==========================================
    
    addIssue(issue) {
        this.issues.unshift(issue);
        
        // Keep only last 50 issues
        if (this.issues.length > 50) {
            this.issues.pop();
        }
        
        this.renderIssue(issue);
    },

    renderIssue(issue) {
        // This will be rendered in the AI Monitoring section
        const container = document.getElementById('ai-issues-list');
        if (!container) return;
        
        const severityColors = {
            critical: '#FF4757',
            high: '#FF6B7A',
            medium: '#FFD700',
            low: '#A78BFA'
        };
        
        const severityBg = {
            critical: 'rgba(255, 71, 87, 0.15)',
            high: 'rgba(255, 107, 122, 0.15)',
            medium: 'rgba(255, 215, 0, 0.15)',
            low: 'rgba(167, 139, 250, 0.15)'
        };
        
        const div = document.createElement('div');
        div.className = 'ai-issue-card';
        div.style.cssText = `
            background: ${severityBg[issue.severity] || 'rgba(167, 139, 250, 0.15)'};
            border: 1px solid ${severityColors[issue.severity] || '#A78BFA'};
            border-radius: 10px;
            padding: 16px;
            margin-bottom: 12px;
            animation: slideIn 0.3s ease;
        `;
        
        div.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
                <span style="color: ${severityColors[issue.severity] || '#A78BFA'}; font-weight: 600; font-size: 12px; text-transform: uppercase;">
                    ${issue.severity}
                </span>
                <span style="color: rgba(255,255,255,0.4); font-size: 11px;">
                    ${(issue.confidence * 100).toFixed(0)}% confidence
                </span>
            </div>
            <div style="color: white; font-size: 14px; margin-bottom: 8px;">
                ${issue.description}
            </div>
            <div style="display: flex; gap: 16px; font-size: 11px; color: rgba(255,255,255,0.5);">
                <span>${issue.detectedIn?.os || 'Unknown'}</span>
                <span>${issue.detectedIn?.resolution || 'Unknown'}</span>
                <span>${issue.detectedIn?.component || 'Unknown'}</span>
            </div>
            ${issue.suggestedFix ? `
                <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.1);">
                    <div style="color: rgba(255,255,255,0.6); font-size: 12px;">
                        <strong>Suggested Fix:</strong> ${issue.suggestedFix.description}
                    </div>
                </div>
            ` : ''}
        `;
        
        container.insertBefore(div, container.firstChild);
    },

    // ==========================================
    // AUTO-FIX API
    // ==========================================
    
    toggleAutoFix() {
        this.autoFixEnabled = !this.autoFixEnabled;
        
        if (window.aiMonitor) {
            window.aiMonitor.setAutoFixEnabled(this.autoFixEnabled);
        }
        
        const btn = document.getElementById('toggleAutoFix');
        if (btn) {
            btn.className = `devtool-btn ${this.autoFixEnabled ? 'primary' : 'secondary'}`;
            btn.textContent = this.autoFixEnabled ? 'Auto-Fix: AN' : 'Auto-Fix: AUS';
        }
        
        this.log({
            level: 'info',
            message: `[AI-Monitor] Auto-Fix ${this.autoFixEnabled ? 'enabled' : 'disabled'}`
        });
    },

    // ==========================================
    // CACHE API
    // ==========================================
    
    clearAllCache() {
        localStorage.clear();
        sessionStorage.clear();
        
        this.log({
            level: 'success',
            message: '[SYSTEM] All cache cleared'
        });
        
        // Reload page after short delay
        setTimeout(() => {
            window.location.reload();
        }, 1000);
    },

    // ==========================================
    // PERFORMANCE API
    // ==========================================
    
    updatePerformanceDisplay() {
        if (!window.aiMonitor) return;
        
        const metrics = window.aiMonitor.getPerformanceMetrics();
        
        // Update FPS
        const fpsEl = document.getElementById('perf-fps');
        if (fpsEl) {
            fpsEl.textContent = metrics.fps;
            fpsEl.style.color = metrics.fps < 30 ? '#FF4757' : '#00FF88';
        }
        
        // Update Memory
        const memEl = document.getElementById('perf-memory');
        if (memEl && metrics.memory) {
            const mb = (metrics.memory / (1024 * 1024)).toFixed(1);
            memEl.textContent = `${mb} MB`;
        }
        
        // Update Uptime
        const uptimeEl = document.getElementById('perf-uptime');
        if (uptimeEl) {
            const seconds = Math.floor(performance.now() / 1000);
            const hours = Math.floor(seconds / 3600);
            const minutes = Math.floor((seconds % 3600) / 60);
            uptimeEl.textContent = `${hours}h ${minutes}m`;
        }
    },

    // ==========================================
    // FEATURE FLAGS
    // ==========================================
    
    getFeatureFlags() {
        return {
            newSidebar: true,
            darkMode: true,
            adminPanel: true,
            autoUpdater: true,
            reflexLab: true,
            newColorPalette: true,
            aiMonitor: true
        };
    }
};

// Auto-initialize
document.addEventListener('DOMContentLoaded', () => {
    DevToolAPI.init();
    
    // Start performance updates
    setInterval(() => {
        DevToolAPI.updatePerformanceDisplay();
    }, 1000);
});

// Export
window.devToolAPI = DevToolAPI;
