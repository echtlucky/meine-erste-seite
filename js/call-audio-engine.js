/**
 * Call Audio Engine - Professional Voice/Video Call Sound System
 * Generates high-quality, non-intrusive call tones using Web Audio API
 */

(function() {
  "use strict";

  if (window.__ECHTLUCKY_CALL_AUDIO__) return;
  window.__ECHTLUCKY_CALL_AUDIO__ = true;

  const AudioEngine = {
    ctx: null,
    masterGain: null,
    volume: 0.6,
    isMuted: false,
    activeLoops: new Map(),
    
    // Sound presets
    presets: {
      // Outgoing call: Gentle, rhythmic pulses
      outgoing: {
        freq: 440,
        freq2: 554,
        duration: 0.18,
        interval: 2.0,
        type: "sine",
        attack: 0.02,
        release: 0.08,
        volume: 0.5
      },
      
      // Incoming call: Pleasant, attention-getting pattern
      incoming: {
        freq: 523,
        freq2: 659,
        duration: 0.25,
        interval: 1.2,
        type: "sine",
        attack: 0.015,
        release: 0.1,
        volume: 0.7
      },
      
      // Connecting: Subtle, continuous soft tone
      connecting: {
        freq: 330,
        duration: 0.08,
        interval: 0.4,
        type: "triangle",
        attack: 0.03,
        release: 0.05,
        volume: 0.3
      },
      
      // Connected: Short, positive confirmation
      connected: {
        sequence: [
          { freq: 523, duration: 0.12, delay: 0 },
          { freq: 659, duration: 0.15, delay: 0.1 },
          { freq: 784, duration: 0.2, delay: 0.18 }
        ],
        type: "sine",
        attack: 0.01,
        release: 0.08,
        volume: 0.5
      },
      
      // Ended: Gentle downward pattern
      ended: {
        sequence: [
          { freq: 440, duration: 0.15, delay: 0 },
          { freq: 330, duration: 0.2, delay: 0.12 }
        ],
        type: "sine",
        attack: 0.02,
        release: 0.1,
        volume: 0.4
      },
      
      // Rejected/Busy: Quick, low tones
      rejected: {
        sequence: [
          { freq: 294, duration: 0.1, delay: 0 },
          { freq: 294, duration: 0.1, delay: 0.15 }
        ],
        type: "triangle",
        attack: 0.01,
        release: 0.05,
        volume: 0.4
      },
      
      // Error: Very subtle low tone
      error: {
        freq: 200,
        duration: 0.3,
        type: "sine",
        attack: 0.05,
        release: 0.15,
        volume: 0.3
      }
    },

    /**
     * Initialize audio context (must be called after user interaction)
     */
    init() {
      if (this.ctx) return Promise.resolve();
      
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) {
          console.warn("Web Audio API not supported");
          return Promise.reject(new Error("Web Audio API not supported"));
        }
        
        this.ctx = new AudioContext();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = this.isMuted ? 0 : this.volume;
        this.masterGain.connect(this.ctx.destination);
        
        return Promise.resolve();
      } catch (err) {
        console.warn("Failed to initialize audio context:", err);
        return Promise.reject(err);
      }
    },

    /**
     * Ensure audio context is running (resume if suspended)
     */
    async ensureRunning() {
      if (!this.ctx) {
        await this.init();
      }
      if (this.ctx?.state === "suspended") {
        try {
          await this.ctx.resume();
        } catch (err) {
          console.warn("Could not resume audio context:", err);
        }
      }
    },

    /**
     * Set master volume (0.0 - 1.0)
     */
    setVolume(value) {
      this.volume = Math.max(0, Math.min(1, value));
      if (this.masterGain && !this.isMuted) {
        this.masterGain.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.05);
      }
      try {
        localStorage.setItem("echtlucky:callAudio:volume", String(this.volume));
      } catch (_) {}
    },

    /**
     * Get current volume
     */
    getVolume() {
      return this.volume;
    },

    /**
     * Mute/unmute all sounds
     */
    setMuted(muted) {
      this.isMuted = muted;
      if (this.masterGain) {
        const target = muted ? 0 : this.volume;
        this.masterGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.05);
      }
      try {
        localStorage.setItem("echtlucky:callAudio:muted", String(muted));
      } catch (_) {}
    },

    /**
     * Check if sounds are enabled in user preferences
     */
    isEnabled() {
      try {
        const raw = localStorage.getItem("echtlucky:connect:prefs:v1");
        if (!raw) return true;
        const parsed = JSON.parse(raw);
        return parsed?.callSounds !== false;
      } catch (_) {
        return true;
      }
    },

    /**
     * Create a soft envelope for smooth sound
     */
    applyEnvelope(gainNode, attack, release, duration, startTime) {
      const now = startTime || this.ctx.currentTime;
      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(1, now + attack);
      gainNode.gain.setValueAtTime(1, now + duration - release);
      gainNode.gain.linearRampToValueAtTime(0, now + duration);
    },

    /**
     * Play a single tone
     */
    playTone({ freq, duration, type = "sine", attack = 0.02, release = 0.08, volume = 1.0 }) {
      if (!this.ctx || this.isMuted || !this.isEnabled()) return;
      
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      
      const finalVolume = volume * this.volume;
      gain.gain.value = finalVolume;
      
      this.applyEnvelope(gain, attack, release, duration, this.ctx.currentTime);
      
      osc.connect(gain);
      gain.connect(this.masterGain);
      
      osc.start();
      osc.stop(this.ctx.currentTime + duration);
      
      return { osc, gain };
    },

    /**
     * Play a sequence of tones
     */
    playSequence(sequence, type = "sine", attack = 0.02, release = 0.08, volume = 1.0) {
      if (!this.ctx || this.isMuted || !this.isEnabled()) return;
      
      const now = this.ctx.currentTime;
      
      sequence.forEach(({ freq, duration, delay }) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = type;
        osc.frequency.setValueAtTime(freq, now + delay);
        
        const finalVolume = volume * this.volume;
        gain.gain.value = finalVolume;
        
        this.applyEnvelope(gain, attack, release, duration, now + delay);
        
        osc.connect(gain);
        gain.connect(this.masterGain);
        
        osc.start(now + delay);
        osc.stop(now + delay + duration);
      });
    },

    /**
     * Start a looping sound (for outgoing/incoming/connecting)
     */
    startLoop(name, preset) {
      if (!this.ctx || this.isMuted || !this.isEnabled()) return;
      
      this.stopLoop(name);
      
      const loopId = Symbol(name);
      let nextTime = this.ctx.currentTime;
      let isActive = true;
      
      const schedule = () => {
        if (!isActive || !this.ctx) return;
        
        const now = this.ctx.currentTime;
        
        while (nextTime < now + 2.0) {
          if (preset.sequence) {
            // Play sequence once per loop
            preset.sequence.forEach(({ freq, duration, delay }) => {
              const osc = this.ctx.createOscillator();
              const gain = this.ctx.createGain();
              
              osc.type = preset.type || "sine";
              osc.frequency.setValueAtTime(freq, nextTime + delay);
              
              const finalVolume = (preset.volume || 1.0) * this.volume;
              gain.gain.value = finalVolume;
              
              this.applyEnvelope(gain, preset.attack || 0.02, preset.release || 0.08, duration, nextTime + delay);
              
              osc.connect(gain);
              gain.connect(this.masterGain);
              
              osc.start(nextTime + delay);
              osc.stop(nextTime + delay + duration);
            });
          } else if (preset.freq2) {
            // Dual tone (like outgoing/incoming)
            [preset.freq, preset.freq2].forEach((f, i) => {
              const osc = this.ctx.createOscillator();
              const gain = this.ctx.createGain();
              
              osc.type = preset.type || "sine";
              osc.frequency.setValueAtTime(f, nextTime + (i * 0.15));
              
              const finalVolume = (preset.volume || 1.0) * this.volume;
              gain.gain.value = finalVolume;
              
              this.applyEnvelope(gain, preset.attack || 0.02, preset.release || 0.08, preset.duration, nextTime + (i * 0.15));
              
              osc.connect(gain);
              gain.connect(this.masterGain);
              
              osc.start(nextTime + (i * 0.15));
              osc.stop(nextTime + (i * 0.15) + preset.duration);
            });
          } else {
            // Single tone
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            
            osc.type = preset.type || "sine";
            osc.frequency.setValueAtTime(preset.freq, nextTime);
            
            const finalVolume = (preset.volume || 1.0) * this.volume;
            gain.gain.value = finalVolume;
            
            this.applyEnvelope(gain, preset.attack || 0.02, preset.release || 0.08, preset.duration, nextTime);
            
            osc.connect(gain);
            gain.connect(this.masterGain);
            
            osc.start(nextTime);
            osc.stop(nextTime + preset.duration);
          }
          
          nextTime += preset.interval;
        }
        
        if (isActive) {
          setTimeout(schedule, 100);
        }
      };
      
      schedule();
      
      this.activeLoops.set(name, {
        id: loopId,
        stop: () => { isActive = false; }
      });
    },

    /**
     * Stop a looping sound
     */
    stopLoop(name) {
      const loop = this.activeLoops.get(name);
      if (loop) {
        loop.stop();
        this.activeLoops.delete(name);
      }
    },

    /**
     * Stop all loops
     */
    stopAllLoops() {
      this.activeLoops.forEach(loop => loop.stop());
      this.activeLoops.clear();
    },

    // Public API methods
    
    async playOutgoing() {
      await this.ensureRunning();
      this.startLoop("outgoing", this.presets.outgoing);
    },
    
    async playIncoming() {
      await this.ensureRunning();
      this.startLoop("incoming", this.presets.incoming);
    },
    
    async playConnecting() {
      await this.ensureRunning();
      this.startLoop("connecting", this.presets.connecting);
    },
    
    async playConnected() {
      await this.ensureRunning();
      this.stopAllLoops();
      const p = this.presets.connected;
      this.playSequence(p.sequence, p.type, p.attack, p.release, p.volume);
    },
    
    async playEnded() {
      await this.ensureRunning();
      this.stopAllLoops();
      const p = this.presets.ended;
      this.playSequence(p.sequence, p.type, p.attack, p.release, p.volume);
    },
    
    async playRejected() {
      await this.ensureRunning();
      this.stopAllLoops();
      const p = this.presets.rejected;
      this.playSequence(p.sequence, p.type, p.attack, p.release, p.volume);
    },
    
    async playError() {
      await this.ensureRunning();
      this.stopAllLoops();
      const p = this.presets.error;
      this.playTone(p);
    },
    
    stop() {
      this.stopAllLoops();
    }
  };

  // Load saved preferences
  try {
    const savedVolume = localStorage.getItem("echtlucky:callAudio:volume");
    if (savedVolume !== null) {
      AudioEngine.volume = parseFloat(savedVolume);
    }
    const savedMuted = localStorage.getItem("echtlucky:callAudio:muted");
    if (savedMuted !== null) {
      AudioEngine.isMuted = savedMuted === "true";
    }
  } catch (_) {}

  // Expose to global namespace
  window.echtlucky = window.echtlucky || {};
  window.echtlucky.callAudio = AudioEngine;
  
  // Auto-initialize on first user interaction
  const initOnInteraction = () => {
    AudioEngine.init().catch(() => {});
    document.removeEventListener("click", initOnInteraction);
    document.removeEventListener("keydown", initOnInteraction);
    document.removeEventListener("touchstart", initOnInteraction);
  };
  
  document.addEventListener("click", initOnInteraction, { once: true });
  document.addEventListener("keydown", initOnInteraction, { once: true });
  document.addEventListener("touchstart", initOnInteraction, { once: true });
  
})();
