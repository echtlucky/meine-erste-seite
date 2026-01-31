/**
 * LCKY HUB - Self-Healing UI AI Monitor
 * Detects and reports UI/UX issues, runtime errors, and performance problems
 */

class AIMonitor {
    constructor() {
        this.enabled = true;
        this.autoFixEnabled = false; // Disabled by default - requires user confirmation
        this.issues = [];
        this.fixHistory = [];
        this.performanceMetrics = {
            fps: 60,
            memory: 0,
            renderTime: 0
        };
        
        this.init();
    }

    init() {
        if (!this.enabled) return;
        
        console.log('[AI-Monitor] Initializing Self-Healing UI Monitor...');
        
        // Set up error monitoring
        this.setupErrorMonitoring();
        
        // Set up performance monitoring
        this.setupPerformanceMonitoring();
        
        // Set up layout monitoring
        this.setupLayoutMonitoring();
        
        // Set up DOM monitoring
        this.setupDOMMonitoring();
        
        console.log('[AI-Monitor] Initialization complete');
    }

    // ==========================================
    // ERROR MONITORING
    // ==========================================
    
    setupErrorMonitoring() {
        // Capture JavaScript errors
        window.addEventListener('error', (event) => {
            this.reportIssue({
                type: 'ui-error',
                severity: 'high',
                confidence: 0.95,
                description: `JavaScript Error: ${event.message}`,
                stack: event.error?.stack,
                filename: event.filename,
                line: event.lineno,
                detectedIn: {
                    os: this.getOS(),
                    resolution: `${window.innerWidth}x${window.innerHeight}`,
                    component: 'window-error-handler'
                }
            });
        });

        // Capture unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            this.reportIssue({
                type: 'ui-error',
                severity: 'medium',
                confidence: 0.9,
                description: `Unhandled Promise Rejection: ${event.reason?.message || 'Unknown error'}`,
                stack: event.reason?.stack,
                detectedIn: {
                    os: this.getOS(),
                    resolution: `${window.innerWidth}x${window.innerHeight}`,
                    component: 'promise-rejection-handler'
                }
            });
        });

        // Override console.error to capture logs
        const originalError = console.error;
        console.error = (...args) => {
            originalError.apply(console, args);
            this.logConsoleMessage('error', args.join(' '));
        };

        // Override console.warn for warnings
        const originalWarn = console.warn;
        console.warn = (...args) => {
            originalWarn.apply(console, args);
            this.logConsoleMessage('warning', args.join(' '));
        };
    }

    logConsoleMessage(level, message) {
        const issue = {
            type: 'console-log',
            level: level,
            message: message,
            timestamp: new Date().toISOString(),
            detectedIn: {
                os: this.getOS(),
                resolution: `${window.innerWidth}x${window.innerHeight}`,
                component: 'console'
            }
        };
        
        // Send to dev tool if available
        if (window.devToolAPI) {
            window.devToolAPI.log(issue);
        }
    }

    // ==========================================
    // PERFORMANCE MONITORING
    // ==========================================
    
    setupPerformanceMonitoring() {
        // FPS Monitoring
        let frameCount = 0;
        let lastTime = performance.now();
        
        const measureFPS = () => {
            if (!this.enabled) return;
            
            frameCount++;
            const currentTime = performance.now();
            
            if (currentTime - lastTime >= 1000) {
                this.performanceMetrics.fps = frameCount;
                frameCount = 0;
                lastTime = currentTime;
                
                // Report low FPS
                if (frameCount < 30 && frameCount > 0) {
                    this.reportIssue({
                        type: 'performance',
                        severity: 'medium',
                        confidence: 0.85,
                        description: `Low FPS detected: ${frameCount} fps`,
                        detectedIn: {
                            os: this.getOS(),
                            resolution: `${window.innerWidth}x${window.innerHeight}`,
                            component: 'fps-monitor'
                        },
                        suggestedFix: {
                            mode: 'suggestion-only',
                            scope: 'animation',
                            description: 'Consider reducing animation intensity or disabling heavy effects'
                        }
                    });
                }
            }
            
            requestAnimationFrame(measureFPS);
        };
        
        requestAnimationFrame(measureFPS);
        
        // Memory monitoring (if available)
        if (performance.memory) {
            setInterval(() => {
                this.performanceMetrics.memory = performance.memory.usedJSHeapSize;
                
                // Report high memory usage
                if (performance.memory.usedJSHeapSize > 100 * 1024 * 1024) {
                    this.reportIssue({
                        type: 'performance',
                        severity: 'low',
                        confidence: 0.8,
                        description: 'High memory usage detected',
                        detectedIn: {
                            os: this.getOS(),
                            resolution: `${window.innerWidth}x${window.innerHeight}`,
                            component: 'memory-monitor'
                        }
                    });
                }
            }, 5000);
        }
        
        // Long task detection
        if (PerformanceObserver) {
            try {
                const longTaskObserver = new PerformanceObserver((list) => {
                    for (const entry of list.getEntries()) {
                        if (entry.duration > 100) {
                            this.reportIssue({
                                type: 'performance',
                                severity: 'low',
                                confidence: 0.9,
                                description: `Long task detected: ${entry.duration.toFixed(2)}ms`,
                                detectedIn: {
                                    os: this.getOS(),
                                    resolution: `${window.innerWidth}x${window.innerHeight}`,
                                    component: 'long-task-observer'
                                }
                            });
                        }
                    }
                });
                
                longTaskObserver.observe({ entryTypes: ['longtask'] });
            } catch (e) {
                // Long task API not supported
            }
        }
    }

    // ==========================================
    // LAYOUT MONITORING
    // ==========================================
    
    setupLayoutMonitoring() {
        // Check for horizontal scroll (layout overflow)
        const checkLayoutOverflow = () => {
            const hasHorizontalScroll = document.documentElement.scrollWidth > window.innerWidth;
            
            if (hasHorizontalScroll) {
                this.reportIssue({
                    type: 'layout',
                    severity: 'medium',
                    confidence: 0.95,
                    description: 'Horizontal scroll detected - possible layout overflow',
                    detectedIn: {
                        os: this.getOS(),
                        resolution: `${window.innerWidth}x${window.innerHeight}`,
                        component: 'layout-monitor'
                    },
                    suggestedFix: {
                        mode: this.autoFixEnabled ? 'auto-fix' : 'suggestion-only',
                        scope: 'layout',
                        description: 'Clamp max-width on container elements',
                        examplePatch: 'max-width: 100vw; overflow-x: hidden;'
                    }
                });
            }
        };
        
        // Run check on resize and load
        window.addEventListener('resize', checkLayoutOverflow);
        window.addEventListener('load', checkLayoutOverflow);
        
        // Check periodically
        setInterval(checkLayoutOverflow, 10000);
        
        // Check for broken images
        document.addEventListener('error', (event) => {
            if (event.target.tagName === 'IMG') {
                this.reportIssue({
                    type: 'accessibility',
                    severity: 'low',
                    confidence: 0.95,
                    description: `Broken image detected: ${event.target.src}`,
                    detectedIn: {
                        os: this.getOS(),
                        resolution: `${window.innerWidth}x${window.innerHeight}`,
                        component: 'image-loader'
                    },
                    suggestedFix: {
                        mode: 'suggestion-only',
                        scope: 'accessibility',
                        description: 'Add fallback image or alt text'
                    }
                });
            }
        }, true);
    }

    // ==========================================
    // DOM MONITORING
    // ==========================================
    
    setupDOMMonitoring() {
        // Monitor for large DOM changes
        const observer = new MutationObserver((mutations) => {
            const totalNodes = mutations.reduce((sum, m) => {
                return sum + m.addedNodes.length + m.removedNodes.length;
            }, 0);
            
            if (totalNodes > 100) {
                this.reportIssue({
                    type: 'performance',
                    severity: 'low',
                    confidence: 0.8,
                    description: `Large DOM mutation detected: ${totalNodes} nodes changed`,
                    detectedIn: {
                        os: this.getOS(),
                        resolution: `${window.innerWidth}x${window.innerHeight}`,
                        component: 'mutation-observer'
                    },
                    suggestedFix: {
                        mode: 'suggestion-only',
                        scope: 'performance',
                        description: 'Consider using documentFragment for batch updates'
                    }
                });
            }
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
        
        // Check for click-blocking overlays
        const checkClickBlocking = () => {
            const overlays = document.querySelectorAll('[class*="overlay"], [class*="modal"]');
            
            overlays.forEach(overlay => {
                const rect = overlay.getBoundingClientRect();
                const zIndex = parseInt(window.getComputedStyle(overlay).zIndex) || 0;
                
                // Check if overlay blocks entire screen but doesn't capture clicks properly
                if (rect.width > window.innerWidth * 0.9 && 
                    rect.height > window.innerHeight * 0.9 &&
                    !overlay.hasAttribute('aria-modal')) {
                    
                    this.reportIssue({
                        type: 'ux',
                        severity: 'low',
                        confidence: 0.75,
                        description: 'Potential click-blocking overlay detected without aria-modal',
                        detectedIn: {
                            os: this.getOS(),
                            resolution: `${window.innerWidth}x${window.innerHeight}`,
                            component: 'accessibility-check'
                        },
                        suggestedFix: {
                            mode: 'suggestion-only',
                            scope: 'accessibility',
                            description: 'Add aria-modal="true" to overlay elements'
                        }
                    });
                }
            });
        };
        
        setInterval(checkClickBlocking, 15000);
    }

    // ==========================================
    // ISSUE REPORTING
    // ==========================================
    
    reportIssue(issue) {
        // Check for duplicates
        const isDuplicate = this.issues.some(i => 
            i.description === issue.description && 
            i.detectedIn?.component === issue.detectedIn?.component
        );
        
        if (isDuplicate) return;
        
        issue.id = Date.now();
        issue.timestamp = new Date().toISOString();
        this.issues.push(issue);
        
        // Log to console
        console.log(`[AI-Monitor] Issue detected: ${issue.description}`);
        
        // Send to dev tool if available
        if (window.devToolAPI) {
            window.devToolAPI.addIssue(issue);
        }
        
        // Auto-fix if enabled and safe
        if (this.autoFixEnabled && issue.suggestedFix?.mode === 'auto-fix') {
            this.applyAutoFix(issue);
        }
    }

    // ==========================================
    // AUTO-FIX SYSTEM
    // ==========================================
    
    applyAutoFix(issue) {
        const fix = issue.suggestedFix;
        
        if (!fix || fix.mode !== 'auto-fix') return;
        
        try {
            switch (fix.scope) {
                case 'layout':
                    this.applyLayoutFix(issue, fix);
                    break;
                case 'animation':
                    this.applyAnimationFix(issue, fix);
                    break;
                case 'css':
                    this.applyCSSFix(issue, fix);
                    break;
            }
            
            // Record fix
            this.fixHistory.push({
                issueId: issue.id,
                fix: fix.description,
                timestamp: new Date().toISOString(),
                success: true
            });
            
            console.log(`[AI-Monitor] Auto-fix applied: ${fix.description}`);
            
        } catch (error) {
            console.error(`[AI-Monitor] Auto-fix failed: ${error.message}`);
            
            this.fixHistory.push({
                issueId: issue.id,
                fix: fix.description,
                timestamp: new Date().toISOString(),
                success: false,
                error: error.message
            });
        }
    }

    applyLayoutFix(issue, fix) {
        // Apply max-width and overflow-x to body
        document.body.style.maxWidth = '100vw';
        document.body.style.overflowX = 'hidden';
    }

    applyAnimationFix(issue, fix) {
        // Reduce animation intensity
        document.body.classList.add('reduced-motion');
        
        // Add CSS rule for reduced motion
        const style = document.createElement('style');
        style.textContent = `
            .reduced-motion * {
                animation-duration: 0.01ms !important;
                animation-iteration-count: 1 !important;
                transition-duration: 0.01ms !important;
            }
        `;
        document.head.appendChild(style);
    }

    applyCSSFix(issue, fix) {
        // Apply generic CSS fixes via style tag
        const style = document.createElement('style');
        style.textContent = `/* AI Auto-Fix */`;
        document.head.appendChild(style);
    }

    // ==========================================
    // UTILITY METHODS
    // ==========================================
    
    getOS() {
        const platform = navigator.platform.toLowerCase();
        if (platform.includes('win')) return 'Windows';
        if (platform.includes('mac')) return 'macOS';
        if (platform.includes('linux')) return 'Linux';
        return 'Unknown';
    }

    getIssues() {
        return this.issues;
    }

    getFixHistory() {
        return this.fixHistory;
    }

    getPerformanceMetrics() {
        return this.performanceMetrics;
    }

    setEnabled(enabled) {
        this.enabled = enabled;
    }

    setAutoFixEnabled(enabled) {
        this.autoFixEnabled = enabled;
        console.log(`[AI-Monitor] Auto-fix ${enabled ? 'enabled' : 'disabled'}`);
    }

    clearIssues() {
        this.issues = [];
    }

    clearFixHistory() {
        this.fixHistory = [];
    }
}

// Export for use
window.AIMonitor = AIMonitor;

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.aiMonitor = new AIMonitor();
});
