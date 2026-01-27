(() => {
  "use strict";

  if (window.__ECHTLUCKY_FOCUS_V2_LOADED__) return;
  window.__ECHTLUCKY_FOCUS_V2_LOADED__ = true;

  const LS_SESSIONS = "echtlucky:focus:sessions:v1";
  const LS_ACTIVE = "echtlucky:focus:active:v1";
  const LS_SETTINGS = "echtlucky:focus:settings:v1";

  const startBtn = document.getElementById("btnStartFocus");
  const pauseBtn = document.getElementById("btnPauseFocus");
  const endBtn = document.getElementById("btnEndFocus");
  const statusLabel = document.getElementById("focusStatus");
  const timerDisplay = document.getElementById("sessionClock");
  const historyList = document.getElementById("focusHistory");
  const focusTimeTotal = document.getElementById("focusTime");
  const todayCount = document.getElementById("todayCount");
  const avgDuration = document.getElementById("avgDuration");
  const logs = document.getElementById("focusLogs");
  const toggleFocus = document.getElementById("btnToggleFocusMode");
  const focusHint = document.getElementById("focusHint");

  const focusMinutesSelect = document.getElementById("focusMinutesSelect");
  const breakMinutesSelect = document.getElementById("breakMinutesSelect");
  const longBreakMinutesSelect = document.getElementById("longBreakMinutesSelect");

  const distractionInput = document.getElementById("distractionInput");
  const btnLogDistraction = document.getElementById("btnLogDistraction");
  const btnClearHistory = document.getElementById("btnClearHistory");

  let tickTimer = null;

  function safeJsonParse(raw) {
    try {
      return JSON.parse(raw);
    } catch (_) {
      return null;
    }
  }

  function fmt(sec) {
    const s = Math.max(0, Math.floor(sec || 0));
    const m = String(Math.floor(s / 60)).padStart(2, "0");
    const r = String(s % 60).padStart(2, "0");
    return `${m}:${r}`;
  }

  function todayKey(d = new Date()) {
    return d.toISOString().slice(0, 10);
  }

  function loadSettings() {
    const s = safeJsonParse(localStorage.getItem(LS_SETTINGS) || "{}") || {};
    return {
      focusMin: Number(s.focusMin || 25),
      breakMin: Number(s.breakMin || 5),
      longBreakMin: Number(s.longBreakMin || 15),
      focusMode: s.focusMode === true
    };
  }

  function saveSettings(next) {
    localStorage.setItem(LS_SETTINGS, JSON.stringify(next));
  }

  function loadSessions() {
    const arr = safeJsonParse(localStorage.getItem(LS_SESSIONS) || "[]");
    return Array.isArray(arr) ? arr : [];
  }

  function saveSessions(arr) {
    localStorage.setItem(LS_SESSIONS, JSON.stringify(arr.slice(-250)));
  }

  function loadActive() {
    const a = safeJsonParse(sessionStorage.getItem(LS_ACTIVE) || localStorage.getItem(LS_ACTIVE) || "null");
    return a && typeof a === "object" ? a : null;
  }

  function saveActive(active) {
    if (active) {
      sessionStorage.setItem(LS_ACTIVE, JSON.stringify(active));
      localStorage.setItem(LS_ACTIVE, JSON.stringify(active));
    } else {
      sessionStorage.removeItem(LS_ACTIVE);
      localStorage.removeItem(LS_ACTIVE);
    }
  }

  function setButtons({ running }) {
    if (startBtn) startBtn.disabled = !!running;
    if (pauseBtn) pauseBtn.disabled = !running;
    if (endBtn) endBtn.disabled = !running;
  }

  function renderHistory() {
    if (!historyList) return;
    const sessions = loadSessions().slice().reverse();
    if (!sessions.length) {
      historyList.innerHTML = '<div class="history-empty">Noch keine Sessions.</div>';
      return;
    }

    historyList.innerHTML = sessions
      .slice(0, 20)
      .map((s) => {
        const startedAt = new Date(s.startedAt);
        const label = s.kind === "break" ? "Break" : "Focus";
        const line = `${label} • ${fmt(s.durationSec)} • ${startedAt.toLocaleString()}`;
        return `<div class="history-item">${line}</div>`;
      })
      .join("");
  }

  function renderOverview() {
    const sessions = loadSessions();
    const today = todayKey();
    const todaySessions = sessions.filter((s) => (s.dayKey || "").startsWith(today) && s.kind === "focus");
    const todayTotal = todaySessions.reduce((a, b) => a + (b.durationSec || 0), 0);
    const focusSessions = sessions.filter((s) => s.kind === "focus");
    const focusTotal = focusSessions.reduce((a, b) => a + (b.durationSec || 0), 0);
    const avg = focusSessions.length ? Math.floor(focusTotal / focusSessions.length) : 0;

    if (focusTimeTotal) focusTimeTotal.textContent = fmt(todayTotal);
    if (todayCount) todayCount.textContent = `${todaySessions.length} Sessions`;
    if (avgDuration) avgDuration.textContent = fmt(avg);
  }

  function renderStatus() {
    const active = loadActive();
    if (!active) {
      if (statusLabel) statusLabel.textContent = "Idle";
      if (timerDisplay) timerDisplay.textContent = "00:00";
      setButtons({ running: false });
      return;
    }

    const now = Date.now();
    const endMs = active.pausedAt ? active.pausedAt : now;
    const elapsedMs = endMs - active.startedAtMs - (active.pausedAccumMs || 0);
    const elapsedSec = Math.max(0, Math.floor(elapsedMs / 1000));

    const settings = loadSettings();
    const targetMin = active.kind === "break"
      ? (active.isLongBreak ? settings.longBreakMin : settings.breakMin)
      : settings.focusMin;
    const remainingSec = Math.max(0, targetMin * 60 - elapsedSec);

    if (statusLabel) statusLabel.textContent = active.pausedAt ? "Paused" : active.kind === "break" ? "Break" : "In Session";
    if (timerDisplay) timerDisplay.textContent = fmt(remainingSec);
    setButtons({ running: !active.pausedAt });
  }

  function startTick() {
    if (tickTimer) return;
    tickTimer = window.setInterval(renderStatus, 250);
  }

  function stopTick() {
    if (tickTimer) window.clearInterval(tickTimer);
    tickTimer = null;
  }

  function startFocusSession() {
    const sessions = loadSessions();
    const recentFocus = sessions.filter((s) => s.kind === "focus").slice(-4);
    const nextIsLongBreak = recentFocus.length >= 4;

    saveActive({
      kind: "focus",
      startedAtMs: Date.now(),
      pausedAt: null,
      pausedAccumMs: 0,
      isLongBreak: false,
      distractions: []
    });

    if (focusHint) {
      focusHint.textContent = nextIsLongBreak
        ? "Nach dieser Session wartet eine längere Pause."
        : "Standard: Fokus-Session, kurze Pause danach.";
    }

    startTick();
    renderStatus();
  }

  function togglePause() {
    const active = loadActive();
    if (!active) return;

    const now = Date.now();
    if (!active.pausedAt) {
      active.pausedAt = now;
    } else {
      const pausedFor = now - active.pausedAt;
      active.pausedAccumMs = (active.pausedAccumMs || 0) + Math.max(0, pausedFor);
      active.pausedAt = null;
    }

    saveActive(active);
    renderStatus();
  }

  function endSession() {
    const active = loadActive();
    if (!active) return;

    const endMs = active.pausedAt ? active.pausedAt : Date.now();
    const elapsedMs = endMs - active.startedAtMs - (active.pausedAccumMs || 0);
    const durationSec = Math.max(0, Math.floor(elapsedMs / 1000));

    const entry = {
      id: `focus_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      kind: active.kind || "focus",
      startedAt: new Date(active.startedAtMs).toISOString(),
      endedAt: new Date(endMs).toISOString(),
      durationSec,
      dayKey: todayKey(),
      distractions: Array.isArray(active.distractions) ? active.distractions.slice(0, 50) : []
    };

    const sessions = loadSessions();
    sessions.push(entry);
    saveSessions(sessions);
    saveActive(null);

    if (logs) {
      const label = entry.kind === "break" ? "Break" : "Focus";
      logs.insertAdjacentHTML("afterbegin", `<div class="log-item">${label} beendet: ${fmt(entry.durationSec)}</div>`);
      if (entry.distractions?.[0]?.text) {
        logs.insertAdjacentHTML("afterbegin", `<div class="log-item">Letzte Ablenkung: ${entry.distractions[0].text}</div>`);
      }
    }

    stopTick();
    renderHistory();
    renderOverview();
    renderStatus();
  }

  function clearHistory() {
    localStorage.removeItem(LS_SESSIONS);
    renderHistory();
    renderOverview();
  }

  function logDistraction() {
    const active = loadActive();
    if (!active) return;
    const text = String(distractionInput?.value || "").trim();
    if (!text) return;

    const item = { at: new Date().toISOString(), text: text.slice(0, 140) };
    active.distractions = Array.isArray(active.distractions) ? active.distractions : [];
    active.distractions.unshift(item);
    active.distractions = active.distractions.slice(0, 20);
    saveActive(active);

    if (logs) {
      logs.insertAdjacentHTML("afterbegin", `<div class="log-item">Ablenkung: ${item.text}</div>`);
    }

    if (distractionInput) distractionInput.value = "";
  }

  function applySettingsToUI() {
    const s = loadSettings();
    if (focusMinutesSelect) focusMinutesSelect.value = String(s.focusMin);
    if (breakMinutesSelect) breakMinutesSelect.value = String(s.breakMin);
    if (longBreakMinutesSelect) longBreakMinutesSelect.value = String(s.longBreakMin);

    const isOn = s.focusMode === true;
    if (toggleFocus) {
      toggleFocus.textContent = `Ablenkungsfrei: ${isOn ? "Ein" : "Aus"}`;
      toggleFocus.classList.toggle("is-active", isOn);
    }
    document.body.classList.toggle("is-focus-mode", isOn);
  }

  function wire() {
    startBtn?.addEventListener("click", startFocusSession);
    pauseBtn?.addEventListener("click", togglePause);
    endBtn?.addEventListener("click", endSession);
    btnClearHistory?.addEventListener("click", clearHistory);
    btnLogDistraction?.addEventListener("click", logDistraction);

    distractionInput?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        logDistraction();
      }
    });

    toggleFocus?.addEventListener("click", () => {
      const s = loadSettings();
      const next = { ...s, focusMode: !s.focusMode };
      saveSettings(next);
      applySettingsToUI();
    });

    const onChange = () => {
      const next = {
        ...loadSettings(),
        focusMin: Number(focusMinutesSelect?.value || 25),
        breakMin: Number(breakMinutesSelect?.value || 5),
        longBreakMin: Number(longBreakMinutesSelect?.value || 15)
      };
      saveSettings(next);
      applySettingsToUI();
    };

    focusMinutesSelect?.addEventListener("change", onChange);
    breakMinutesSelect?.addEventListener("change", onChange);
    longBreakMinutesSelect?.addEventListener("change", onChange);
  }

  applySettingsToUI();
  renderHistory();
  renderOverview();
  renderStatus();
  startTick();
  wire();
})();

