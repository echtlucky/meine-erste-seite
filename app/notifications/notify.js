/**
 * LCKY HUB - Central Notification System
 * Global API for all notifications, dialogs, and calls
 * 
 * Usage:
 * - notify.info(title, message, options)
 * - notify.success(title, message, options)
 * - notify.error(title, message, options)
 * - notify.warning(title, message, options)
 * - notify.confirm(title, message, options) → Promise<boolean>
 * - notify.incomingCall(caller) → Promise<{action: 'accept'|'decline'}>
 * - notify.activeCall(options) → CallController
 */

const notify = (function() {
  'use strict';
  
  // ===========================================
  // PRIVATE STATE
  // ===========================================
  
  let container = null;
  let toastContainer = null;
  let activeCall = null;
  let callTimer = null;
  let callDuration = 0;
  let isScreenSharing = false;
  
  // ===========================================
  // SVG ICONS
  // ===========================================
  
  const Icons = {
    success: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>`,
    error: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/></svg>`,
    warning: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 9v4M12 17h.01"/><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>`,
    info: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>`,
    question: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3M12 17h.01"/></svg>`,
    close: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>`,
    mic: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8"/></svg>`,
    micOff: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 005.12 2.12M15 9.34V4a3 3 0 00-5.94-.6"/><path d="M17 16.95A7 7 0 015 12v-2m14 0v2a7 7 0 01-.11 1.23"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>`,
    video: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>`,
    videoOff: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 16v1a2 2 0 01-2 2H3a2 2 0 01-2-2V7a2 2 0 012-2h2m5.66 0H14a2 2 0 012 2v3.34l1 1L23 7v10"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`,
    phone: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"/></svg>`,
    phoneOff: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.68 13.31a16 16 0 003.41 2.6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7 2 2 0 011.72 2v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.42 19.42 0 01-3.33-2.67m-2.67-3.34a19.79 19.79 0 01-3.07-8.63A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`,
    screen: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>`,
    settings: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/></svg>`,
    videoCall: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>`,
    phoneCall: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.362 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.338 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>`,
    arrowLeft: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>`
  };
  
  // ===========================================
  // INITIALIZATION
  // ===========================================
  
  function init() {
    if (container) return;
    
    // Create container
    container = document.createElement('div');
    container.id = 'notify-container';
    container.innerHTML = `
      <div id="notify-toasts"></div>
      <div id="notify-modals"></div>
    `;
    document.body.appendChild(container);
    
    toastContainer = container.querySelector('#notify-toasts');
    
    // Keyboard handling (ESC to close)
    document.addEventListener('keydown', handleKeydown);
    
    console.log('[notify] System initialized');
  }
  
  function handleKeydown(e) {
    if (e.key === 'Escape') {
      const modal = container.querySelector('.notify-modal-overlay:not(.hiding)');
      if (modal && modal.dataset.closable !== 'false') {
        closeModal(modal);
      }
    }
  }
  
  // ===========================================
  // TOAST NOTIFICATIONS
  // ===========================================
  
  function createToast(type, title, message, options = {}) {
    if (!container) init();
    
    const position = options.position || 'top-right';
    const duration = options.duration || 5000;
    const icon = getIcon(type);
    
    const toast = document.createElement('div');
    toast.className = `notify-toast ${type} ${position}`;
    toast.innerHTML = `
      <div class="notify-icon">${icon}</div>
      <div class="notify-content">
        <div class="notify-title">${escapeHtml(title)}</div>
        ${message ? `<div class="notify-message">${escapeHtml(message)}</div>` : ''}
      </div>
      <div class="notify-close">${Icons.close}</div>
    `;
    
    // Click to dismiss
    toast.addEventListener('click', () => {
      dismissToast(toast);
    });
    
    // Close button
    toast.querySelector('.notify-close').addEventListener('click', (e) => {
      e.stopPropagation();
      dismissToast(toast);
    });
    
    toastContainer.appendChild(toast);
    
    // Auto dismiss
    if (duration > 0) {
      setTimeout(() => dismissToast(toast), duration);
    }
    
    return toast;
  }
  
  function dismissToast(toast) {
    if (toast.classList.contains('hiding')) return;
    toast.classList.add('hiding');
    setTimeout(() => toast.remove(), 300);
  }
  
  function getIcon(type) {
    const icons = {
      success: Icons.success,
      error: Icons.error,
      warning: Icons.warning,
      info: Icons.info
    };
    return icons[type] || Icons.info;
  }
  
  // ===========================================
  // MODAL DIALOGS
  // ===========================================
  
  function createModal(options) {
    if (!container) init();
    
    const {
      title,
      subtitle,
      description,
      icon = 'question',
      confirmText = 'Bestätigen',
      cancelText = 'Abbrechen',
      type = 'confirm',
      danger = false
    } = options;
    
    const modalOverlay = document.createElement('div');
    modalOverlay.className = 'notify-modal-overlay';
    modalOverlay.dataset.closable = options.closable !== false;
    
    const modal = document.createElement('div');
    modal.className = 'notify-modal';
    
    modal.innerHTML = `
      <div class="notify-modal-header">
        <div class="notify-icon ${type}">${Icons[icon] || Icons.question}</div>
        <div class="notify-text">
          ${title ? `<div class="notify-title">${escapeHtml(title)}</div>` : ''}
          ${subtitle ? `<div class="notify-subtitle">${escapeHtml(subtitle)}</div>` : ''}
        </div>
      </div>
      ${description ? `<div class="notify-modal-body"><div class="notify-description">${escapeHtml(description)}</div></div>` : ''}
      <div class="notify-modal-footer">
        <button class="notify-btn notify-btn-cancel">${escapeHtml(cancelText)}</button>
        <button class="notify-btn ${danger ? 'notify-btn-danger' : 'notify-btn-confirm'}">${escapeHtml(confirmText)}</button>
      </div>
    `;
    
    modalOverlay.appendChild(modal);
    container.querySelector('#notify-modals').appendChild(modalOverlay);
    
    // Focus trap - focus confirm button
    setTimeout(() => modal.querySelector('.notify-btn-confirm').focus(), 100);
    
    // Event handlers
    const cancelBtn = modal.querySelector('.notify-btn-cancel');
    const confirmBtn = modal.querySelector('.notify-btn-confirm');
    
    const resolve = (value) => {
      closeModal(modalOverlay, value);
    };
    
    cancelBtn.addEventListener('click', () => resolve(false));
    confirmBtn.addEventListener('click', () => resolve(true));
    
    // Click outside to close (if allowed)
    if (options.closable !== false) {
      modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) resolve(false);
      });
    }
    
    // Return promise
    return new Promise((resolve) => {
      modalOverlay._resolve = resolve;
    });
  }
  
  function closeModal(modalOverlay, value) {
    if (modalOverlay.classList.contains('hiding')) return;
    modalOverlay.classList.add('hiding');
    modalOverlay.querySelector('.notify-modal').classList.add('hiding');
    
    setTimeout(() => {
      modalOverlay.remove();
      if (modalOverlay._resolve) {
        modalOverlay._resolve(value !== undefined ? value : false);
      }
    }, 300);
  }
  
  // ===========================================
  // INCOMING CALL
  // ===========================================
  
  function showIncomingCall(caller) {
    return new Promise((resolve) => {
      if (!container) init();
      
      // Remove existing call overlay
      if (activeCall) {
        hideActiveCall();
      }
      
      const overlay = document.createElement('div');
      overlay.className = 'notify-call-overlay';
      
      overlay.innerHTML = `
        <div class="notify-call-avatar" style="background: ${caller.color || '#10b981'}">${getInitials(caller.name)}</div>
        <div class="notify-call-info">
          <div class="notify-call-name">${escapeHtml(caller.name)}</div>
          <div class="notify-call-type">
            ${caller.isVideo ? Icons.videoCall : Icons.phoneCall}
            ${caller.isVideo ? 'Videoanruf' : 'Sprachanruf'}
          </div>
        </div>
        <div class="notify-call-actions">
          <button class="notify-call-btn decline">${Icons.phoneOff}</button>
          <button class="notify-call-btn accept">${Icons.phoneCall}</button>
        </div>
      `;
      
      container.appendChild(overlay);
      activeCall = overlay;
      
      // Event handlers
      const acceptBtn = overlay.querySelector('.accept');
      const declineBtn = overlay.querySelector('.decline');
      
      const handleAction = (action) => {
        overlay.classList.add('hiding');
        setTimeout(() => {
          overlay.remove();
          activeCall = null;
          resolve({ action, caller });
        }, 400);
      };
      
      acceptBtn.addEventListener('click', () => handleAction('accept'));
      declineBtn.addEventListener('click', () => handleAction('decline'));
      
      // Ring animation (visual feedback)
      acceptBtn.style.animation = 'notifyPulse 1s ease-in-out infinite';
    });
  }
  
  // ===========================================
  // ACTIVE CALL
  // ===========================================
  
  function showActiveCall(options) {
    if (!container) init();
    
    const {
      peer,
      isVideo = false,
      onMuteToggle,
      onEndCall,
      onScreenShare
    } = options;
    
    // Remove existing
    if (activeCall) {
      hideActiveCall();
    }
    
    const overlay = document.createElement('div');
    overlay.className = 'notify-active-call';
    
    overlay.innerHTML = `
      <div class="notify-active-header">
        <div class="notify-active-info">
          <div class="notify-active-avatar" style="background: ${peer.color || '#10b981'}">${getInitials(peer.name)}</div>
          <div>
            <div class="notify-active-name">${escapeHtml(peer.name)}</div>
            <div class="notify-active-status"><span class="dot"></span>${isVideo ? 'Videoanruf' : 'Sprachanruf'}</div>
          </div>
        </div>
        <div class="notify-active-timer" id="notify-call-timer">00:00</div>
      </div>
      
      <div class="notify-active-main">
        <div class="notify-screen-share" id="notify-screen-share" style="display: none;">
          <span class="dot"></span>
          Du teilst deinen Bildschirm
        </div>
        <div class="notify-active-avatar-large" style="background: ${peer.color || '#10b981'}">${getInitials(peer.name)}</div>
      </div>
      
      <div class="notify-active-controls">
        <button class="notify-control-btn" id="notify-mute-btn" title="Mikrofon stummschalten">
          ${Icons.mic}
        </button>
        <button class="notify-control-btn" id="notify-video-btn" title="Kamera" style="display: ${isVideo ? 'flex' : 'none'}">
          ${Icons.video}
        </button>
        <button class="notify-control-btn ${isScreenSharing ? 'active' : ''}" id="notify-screen-btn" title="Bildschirm teilen">
          ${Icons.screen}
        </button>
        <button class="notify-control-btn end-call" id="notify-end-btn" title="Anruf beenden">
          ${Icons.phoneOff}
        </button>
      </div>
    `;
    
    container.appendChild(overlay);
    activeCall = overlay;
    
    // Start timer
    callDuration = 0;
    callTimer = setInterval(updateCallTimer, 1000);
    
    // Control handlers
    const muteBtn = overlay.querySelector('#notify-mute-btn');
    const screenBtn = overlay.querySelector('#notify-screen-btn');
    const endBtn = overlay.querySelector('#notify-end-btn');
    
    let isMuted = false;
    
    muteBtn.addEventListener('click', () => {
      isMuted = !isMuted;
      muteBtn.classList.toggle('muted', isMuted);
      muteBtn.innerHTML = isMuted ? Icons.micOff : Icons.mic;
      if (onMuteToggle) onMuteToggle(isMuted);
    });
    
    screenBtn.addEventListener('click', () => {
      isScreenSharing = !isScreenSharing;
      screenBtn.classList.toggle('active', isScreenSharing);
      const shareIndicator = overlay.querySelector('#notify-screen-share');
      shareIndicator.style.display = isScreenSharing ? 'flex' : 'none';
      if (onScreenShare) onScreenShare(isScreenSharing);
    });
    
    endBtn.addEventListener('click', () => {
      if (onEndCall) onEndCall();
      hideActiveCall();
    });
    
    // Return controller
    return {
      updatePeer: (newPeer) => {
        overlay.querySelector('.notify-active-avatar').style.background = newPeer.color || '#10b981';
        overlay.querySelector('.notify-active-avatar').textContent = getInitials(newPeer.name);
        overlay.querySelector('.notify-active-avatar-large').style.background = newPeer.color || '#10b981';
        overlay.querySelector('.notify-active-avatar-large').textContent = getInitials(newPeer.name);
        overlay.querySelector('.notify-active-name').textContent = newPeer.name;
      },
      setStatus: (status) => {
        overlay.querySelector('.notify-active-status').innerHTML = `<span class="dot"></span>${status}`;
      },
      end: () => hideActiveCall()
    };
  }
  
  function hideActiveCall() {
    if (!activeCall) return;
    
    if (callTimer) {
      clearInterval(callTimer);
      callTimer = null;
    }
    
    activeCall.classList.add('hiding');
    setTimeout(() => {
      activeCall.remove();
      activeCall = null;
      isScreenSharing = false;
    }, 400);
  }
  
  function updateCallTimer() {
    callDuration++;
    const minutes = Math.floor(callDuration / 60).toString().padStart(2, '0');
    const seconds = (callDuration % 60).toString().padStart(2, '0');
    
    const timer = document.getElementById('notify-call-timer');
    if (timer) {
      timer.textContent = `${minutes}:${seconds}`;
    }
  }
  
  // ===========================================
  // PUBLIC API
  // ===========================================
  
  return {
    init,
    
    info: (title, message, options) => createToast('info', title, message, options),
    success: (title, message, options) => createToast('success', title, message, options),
    error: (title, message, options) => createToast('error', title, message, options),
    warning: (title, message, options) => createToast('warning', title, message, options),
    
    confirm: (title, messageOrOptions, options) => {
      if (typeof messageOrOptions === 'object') {
        return createModal({ ...messageOrOptions, type: 'confirm' });
      }
      return createModal({
        title,
        description: messageOrOptions,
        ...options
      });
    },
    
    alert: (title, message, options) => {
      return createModal({
        title,
        description: message,
        cancelText: 'Schließen',
        confirmText: 'OK',
        type: 'info',
        ...options
      });
    },
    
    danger: (title, description, options) => {
      return createModal({
        title,
        description,
        type: 'danger',
        danger: true,
        ...options
      });
    },
    
    incomingCall: (caller) => showIncomingCall(caller),
    
    activeCall: (options) => showActiveCall(options),
    
    // Utility
    dismissAll: () => {
      toastContainer.querySelectorAll('.notify-toast').forEach(toast => dismissToast(toast));
    }
  };
  
  // ===========================================
  // UTILITIES
  // ===========================================
  
  function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  
  function getInitials(name) {
    if (!name) return '?';
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }
})();

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => notify.init());
} else {
  notify.init();
}
