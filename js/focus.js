(() => {
  "use strict";

  if (window.__ECHTLUCKY_FOCUS_LOADED__) return;
  window.__ECHTLUCKY_FOCUS_LOADED__ = true;

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

  let timer = null;
  let seconds = 0;
  let totalSeconds = 0;
  let sessions = [];
  let running = false;

  function formatTime(sec) {
    const m = String(Math.floor(sec / 60)).padStart(2, "0");
    const s = String(sec % 60).padStart(2, "0");
    return `${m}:${s}`;
  }

  function updateDisplay() {
    timerDisplay.textContent = formatTime(seconds);
    focusTimeTotal.textContent = formatTime(totalSeconds);
    todayCount.textContent = `${sessions.length} Sessions`;
    const avg = sessions.length ? Math.floor(totalSeconds / sessions.length) : 0;
    avgDuration.textContent = formatTime(avg);
  }

  function pushHistory(status) {
    if (!historyList) return;
    const el = document.createElement("div");
    el.className = "history-item";
    el.textContent = `${status} • ${formatTime(seconds)} • ${new Date().toLocaleTimeString()}`;
    historyList.prepend(el);
    if (historyList.querySelector(".history-empty")) {
      const placeholder = historyList.querySelector(".history-empty");
      placeholder.remove();
    }
  }

  function startTimer() {
    if (running) return;
    running = true;
    statusLabel.textContent = "In Session";
    startBtn.disabled = true;
    pauseBtn.disabled = false;
    endBtn.disabled = false;
    timer = setInterval(() => {
      seconds += 1;
      totalSeconds += 1;
      updateDisplay();
    }, 1000);
  }

  function pauseTimer() {
    if (!running) return;
    running = false;
    clearInterval(timer);
    statusLabel.textContent = "Paused";
    pushHistory("Pause");
  }

  function endSession() {
    if (timer) {
      clearInterval(timer);
    }
    if (seconds > 0) {
      sessions.push(seconds);
      logs.insertAdjacentHTML("afterbegin", `<div class="log-item">Session beendet: ${formatTime(seconds)}</div>`);
    }
    seconds = 0;
    running = false;
    timerDisplay.textContent = "00:00";
    statusLabel.textContent = "Idle";
    startBtn.disabled = false;
    pauseBtn.disabled = true;
    endBtn.disabled = true;
    pushHistory("Beendet");
    updateDisplay();
  }

  startBtn?.addEventListener("click", startTimer);
  pauseBtn?.addEventListener("click", pauseTimer);
  endBtn?.addEventListener("click", endSession);
  document.getElementById("btnClearHistory")?.addEventListener("click", () => {
    historyList.innerHTML = '<div class="history-empty">Noch keine Sessions.</div>';
  });

  toggleFocus?.addEventListener("click", () => {
    const active = toggleFocus.textContent.includes("Ein");
    toggleFocus.textContent = `Ablenkungsfrei: ${active ? "Aus" : "Ein"}`;
    toggleFocus.classList.toggle("is-active", !active);
  });

  updateDisplay();
})();
