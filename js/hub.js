/**
 * HUB.JS - Consolidated JavaScript for the HUB page
 * Combines functionality from: connect, ranked, stats, focus, reflex
 */

(function() {
  "use strict";

  // ============================================
  // UTILITY FUNCTIONS
  // ============================================
  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function safeJsonParse(raw, fallback = null) {
    try {
      return JSON.parse(raw);
    } catch (_) {
      return fallback;
    }
  }

  function todayKey(d = new Date()) {
    return d.toISOString().slice(0, 10);
  }

  function fmt(sec) {
    const s = Math.max(0, Math.floor(sec || 0));
    const m = String(Math.floor(s / 60)).padStart(2, "0");
    const r = String(s % 60).padStart(2, "0");
    return `${m}:${r}`;
  }

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }

  // ============================================
  // CONNECT MODULE
  // ============================================
  const ConnectModule = (function() {
    let auth = null;
    let db = null;
    let firebase = null;
    let currentUser = null;

    async function waitForFirebase() {
      return new Promise((resolve) => {
        if (window.firebaseReady && window.auth && window.db) {
          auth = window.auth;
          db = window.db;
          firebase = window.firebase;
          resolve();
          return;
        }
        const handler = () => {
          auth = window.auth;
          db = window.db;
          firebase = window.firebase;
          resolve();
        };
        window.addEventListener("firebaseReady", handler, { once: true });
        setTimeout(() => resolve(), 5000);
      });
    }

    function init() {
      const authStatusCard = document.getElementById("authStatusCard");
      const statusLabel = document.getElementById("statusLabel");
      const btnLogin = document.getElementById("btnLogin");
      const connectLayout = document.getElementById("connectLayout");

      if (btnLogin) {
        btnLogin.addEventListener("click", () => {
          try {
            const file = (window.location.pathname || "").split("/").pop() || "hub.html";
            const returnTo = file + (window.location.search || "") + (window.location.hash || "");
            sessionStorage.setItem("echtlucky:returnTo", returnTo);
          } catch (_) {}
          window.location.href = "login.html";
        });
      }

      // Mobile switcher
      const mobileSwitcher = document.querySelector(".connect-mobile-switcher");
      const connectMainCard = document.querySelector(".connect-main-card");
      if (mobileSwitcher && connectMainCard) {
        const setMobilePanel = (panel) => {
          const next = panel || "left";
          connectMainCard.setAttribute("data-mobile-panel", next);
          mobileSwitcher.querySelectorAll(".connect-mobile-tab").forEach((b) => {
            const isActive = b.dataset.panel === next;
            b.classList.toggle("is-active", isActive);
            b.setAttribute("aria-selected", String(isActive));
          });
        };

        if (!connectMainCard.hasAttribute("data-mobile-panel")) {
          setMobilePanel("left");
        }

        mobileSwitcher.querySelectorAll(".connect-mobile-tab").forEach((btn) => {
          btn.addEventListener("click", () => setMobilePanel(btn.dataset.panel || "left"));
        });

        window.addEventListener("resize", () => {
          if (!window.matchMedia) return;
          const isMobile = window.matchMedia("(max-width: 900px)").matches;
          if (!isMobile) {
            connectMainCard.removeAttribute("data-mobile-panel");
          } else if (!connectMainCard.hasAttribute("data-mobile-panel")) {
            setMobilePanel("left");
          }
        });

        const btnMobileBack = document.getElementById("btnMobileBack");
        if (btnMobileBack) {
          btnMobileBack.addEventListener("click", () => setMobilePanel("left"));
        }
      }

      // Desktop nav
      const connectDesktopNav = document.getElementById("connectDesktopNav");
      const connectDmBlock = document.getElementById("connectDmBlock");
      const connectGroupsBlock = document.getElementById("connectGroupsBlock");

      if (connectDesktopNav) {
        connectDesktopNav.addEventListener("click", (e) => {
          const btn = e.target?.closest?.(".connect-desktop-tab[data-view]");
          if (!btn) return;
          const view = btn.dataset.view || "dm";

          if (view === "create") {
            createGroup();
            return;
          }

          connectDesktopNav.querySelectorAll(".connect-desktop-tab").forEach((b) => {
            b.classList.toggle("is-active", b === btn);
            b.setAttribute("aria-selected", String(b === btn));
          });

          if (connectDmBlock) connectDmBlock.hidden = view !== "dm";
          if (connectGroupsBlock) connectGroupsBlock.hidden = view !== "groups";
        });
      }

      // Auth state
      if (auth) {
        auth.onAuthStateChanged((user) => {
          currentUser = user;
          updateAuthUI(user);
        });
      }
    }

    function updateAuthUI(user) {
      const authStatusCard = document.getElementById("authStatusCard");
      const statusLabel = document.getElementById("statusLabel");
      const btnLogin = document.getElementById("btnLogin");
      const connectLayout = document.getElementById("connectLayout");
      const userBarName = document.getElementById("userBarName");
      const userBarAvatar = document.getElementById("userBarAvatar");

      if (!user) {
        if (authStatusCard) authStatusCard.hidden = false;
        if (statusLabel) statusLabel.textContent = "Nicht eingeloggt";
        if (btnLogin) btnLogin.hidden = false;
        if (connectLayout) connectLayout.hidden = true;
        if (userBarName) userBarName.textContent = "Guest";
        if (userBarAvatar) userBarAvatar.textContent = "G";
        return;
      }

      if (authStatusCard) authStatusCard.hidden = true;
      if (connectLayout) connectLayout.hidden = false;

      const displayName = user.displayName || user.email?.split("@")[0] || "User";
      if (userBarName) userBarName.textContent = displayName;
      if (userBarAvatar) userBarAvatar.textContent = displayName[0]?.toUpperCase() || "U";

      // Hide right panel by default
      const rightPanel = document.querySelector(".connect-right-panel");
      if (rightPanel) rightPanel.hidden = true;
      if (connectLayout) connectLayout.classList.add("connect-workspace--no-right");
    }

    function createGroup() {
      if (!currentUser || !db) {
        window.notify?.show({
          type: "error",
          title: "Fehler",
          message: "Bitte einloggen, um Gruppen zu erstellen.",
          duration: 4000
        });
        return;
      }

      if (window.echtluckyModal?.input) {
        window.echtluckyModal.input({
          title: "Neue Gruppe erstellen",
          placeholder: "Gruppennamen eingeben…",
          confirmText: "Erstellen",
          cancelText: "Abbrechen"
        }).then((groupName) => {
          if (!groupName) return;
          saveGroup(groupName);
        });
      } else {
        const groupName = prompt("Gruppennamen eingeben:");
        if (groupName) saveGroup(groupName);
      }
    }

    function saveGroup(name) {
      try {
        db.collection("groups").add({
          name: name,
          createdBy: currentUser.uid,
          members: [currentUser.uid],
          roles: { [currentUser.uid]: "admin" },
          createdAt: new Date()
        });
        window.notify?.show({
          type: "success",
          title: "Erfolgreich",
          message: `Gruppe "${name}" erstellt!`,
          duration: 4500
        });
      } catch (err) {
        window.notify?.show({
          type: "error",
          title: "Fehler",
          message: "Konnte Gruppe nicht erstellen",
          duration: 4000
        });
      }
    }

    return { init, waitForFirebase };
  })();

  // ============================================
  // RANKED MODULE
  // ============================================
  const RankedModule = (function() {
    const LS_KEY = "echtlucky_ranked_v2";
    const TASK_POOL = [
      { title: "Aim Warmup", desc: "10 Min Aim-Drills (Tracking + Flicks).", xp: 40 },
      { title: "Movement Check", desc: "10 Min Movement-Drills (Strafes/Peeks).", xp: 35 },
      { title: "VOD Mini-Review", desc: "1 Runde analysieren: 1 Fehler + 1 Fix.", xp: 45 },
      { title: "Comms Upgrade", desc: "In 2 Games: klare Callouts, keine Füllwörter.", xp: 35 },
      { title: "Tilt Control", desc: "Nach jedem Death: 1 Atemzug + Reset.", xp: 30 },
      { title: "Crosshair Discipline", desc: "10 Min: Headlevel halten, keine Wände aimen.", xp: 40 },
      { title: "Ranked Fokus", desc: "1 Game: nur Win-Conditions spielen.", xp: 45 },
      { title: "Utility Routine", desc: "3 Utility-Plays üben + merken.", xp: 40 },
      { title: "Anti-Autopilot", desc: "1 Game: vor jeder Runde Plan sagen.", xp: 45 },
      { title: "Consistency", desc: "2 Games: gleiche Sens/Settings, keine Experimente.", xp: 30 }
    ];

    let currentState = null;

    function loadLocal() {
      return safeJsonParse(localStorage.getItem(LS_KEY), {});
    }

    function saveLocal(state) {
      localStorage.setItem(LS_KEY, JSON.stringify(state));
    }

    function pick3Unique(pool) {
      const clone = [...pool];
      const picked = [];
      while (picked.length < 3 && clone.length) {
        const idx = Math.floor(Math.random() * clone.length);
        picked.push(clone.splice(idx, 1)[0]);
      }
      return picked;
    }

    function normalizeState(raw) {
      const day = todayKey();
      const state = raw && typeof raw === "object" ? { ...raw } : {};

      state.totalXp = Number(state.totalXp || 0);
      state.streak = Number(state.streak || 0);
      state.difficulty = state.difficulty || "normal";
      state.focusMode = Boolean(state.focusMode);

      if (!state.daily || state.daily.day !== day) {
        const picked = pick3Unique(TASK_POOL).map((task, idx) => ({
          id: `${day}_${idx}_${String(task.title).replace(/\s+/g, "_")}`,
          ...task
        }));
        state.daily = { day, tasks: picked, doneIds: [] };
      }

      return state;
    }

    function render() {
      if (!currentState) return;

      const tasks = currentState.daily?.tasks || [];
      const doneSet = new Set(currentState.daily?.doneIds || []);
      const doneCount = tasks.filter((task) => doneSet.has(task.id)).length;

      // Daily progress
      const dailyCount = document.querySelector(".daily-progress-count");
      const dailyXp = document.querySelector(".daily-progress-xp");
      const dailyBar = document.querySelector("[data-role='daily-progress']");

      if (dailyCount) dailyCount.textContent = `${doneCount} / ${tasks.length}`;
      if (dailyXp) dailyXp.textContent = `+${doneCount * 40} XP`;
      if (dailyBar) {
        const percent = tasks.length ? (doneCount / tasks.length) * 100 : 0;
        dailyBar.style.width = `${Math.round(percent)}%`;
      }

      // Task list
      const taskList = document.querySelector(".daily-task-list");
      if (taskList) {
        taskList.innerHTML = tasks.map((task) => {
          const done = doneSet.has(task.id);
          return `
            <div class="daily-task${done ? " completed" : ""}">
              <div class="daily-task__text">
                <p class="daily-task__title">${escapeHtml(task.title)}</p>
                <p class="daily-task__desc">${escapeHtml(task.desc)}</p>
              </div>
              <div>
                <p class="daily-task__xp">+${task.xp} XP</p>
                <button class="btn btn-ghost btn-sm" data-task="${task.id}" type="button">${done ? "Undo" : "Mark"}</button>
              </div>
            </div>
          `;
        }).join("");

        taskList.querySelectorAll("button[data-task]").forEach((btn) => {
          btn.addEventListener("click", () => toggleTask(btn.dataset.task));
        });
      }

      // Skill grid
      const skillGrid = document.querySelector("[data-role='skill-grid']");
      if (skillGrid) {
        const skills = [
          { label: "Aim", base: 82, scale: 2.3 },
          { label: "Gamesense", base: 74, scale: 1.8 },
          { label: "Konstanz", base: 69, scale: 1.6 },
          { label: "Warm-up", base: 91, scale: 1.2 }
        ];
        skillGrid.innerHTML = skills.map((stat) => {
          const value = Math.min(100, stat.base + Math.round(doneCount * stat.scale));
          return `
            <div class="skill">
              <span>${escapeHtml(stat.label)}</span>
              <div class="skill-meter">
                <span style="width:${value}%"></span>
              </div>
              <strong>${value}%</strong>
            </div>
          `;
        }).join("");
      }

      // Streak timeline
      const streakTimeline = document.querySelector("[data-role='streak-timeline']");
      if (streakTimeline) {
        const streak = currentState.streak || 0;
        const weekdays = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
        const todayIndex = (new Date().getDay() + 6) % 7;
        streakTimeline.innerHTML = Array.from({ length: 5 }, (_, offset) => {
          const dayIndex = (todayIndex + offset) % 7;
          const stepValue = Math.max(0, streak - (4 - offset));
          return `
            <div class="streak-step${stepValue > 0 ? " active" : ""}">
              <span>${weekdays[dayIndex]}</span>
              <strong>${stepValue}</strong>
            </div>
          `;
        }).join("");
      }
    }

    function toggleTask(taskId) {
      if (!currentState) return;
      const doneIds = new Set(currentState.daily.doneIds || []);
      if (doneIds.has(taskId)) {
        doneIds.delete(taskId);
      } else {
        doneIds.add(taskId);
      }
      currentState.daily.doneIds = Array.from(doneIds);
      saveLocal(currentState);
      render();
    }

    function init() {
      currentState = normalizeState(loadLocal());
      saveLocal(currentState);
      render();

      // Action buttons
      document.querySelectorAll("[data-action]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const action = btn.dataset.action;
          if (action === "complete-day") completeDay();
          else if (action === "reroll") reroll();
          else if (action === "reset") hardReset();
        });
      });

      // Difficulty buttons
      document.querySelectorAll(".difficulty-buttons .btn").forEach((btn) => {
        btn.addEventListener("click", () => {
          document.querySelectorAll(".difficulty-buttons .btn").forEach((b) => b.classList.remove("active"));
          btn.classList.add("active");
          if (currentState) {
            currentState.difficulty = btn.textContent?.trim().toLowerCase() || "normal";
            saveLocal(currentState);
          }
        });
      });
    }

    function completeDay() {
      if (!currentState) return;
      const tasks = currentState.daily?.tasks || [];
      const doneIds = new Set(currentState.daily?.doneIds || []);
      if (doneIds.size < tasks.length) {
        window.notify?.show({
          type: "warn",
          title: "Daily",
          message: "Noch nicht alle Tasks erledigt!",
          duration: 3000
        });
        return;
      }
      window.notify?.show({
        type: "success",
        title: "Daily Complete",
        message: `+${doneIds.size * 40} XP earned!`,
        duration: 4000
      });
    }

    function reroll() {
      if (!currentState) return;
      const day = todayKey();
      const picked = pick3Unique(TASK_POOL).map((task, idx) => ({
        id: `${day}_${idx}_${String(task.title).replace(/\s+/g, "_")}`,
        ...task
      }));
      currentState.daily = { day, tasks: picked, doneIds: [] };
      saveLocal(currentState);
      render();
    }

    function hardReset() {
      if (window.echtluckyModal?.confirm) {
        window.echtluckyModal.confirm({
          title: "Ranked Reset",
          message: "Alles zurücksetzen? (XP, Streak, History)",
          confirmText: "Ja, reset",
          cancelText: "Abbrechen",
          type: "danger"
        }).then((confirmed) => {
          if (confirmed) doReset();
        });
      } else if (confirm("Alles zurücksetzen?")) {
        doReset();
      }
    }

    function doReset() {
      currentState = normalizeState({});
      currentState.totalXp = 0;
      currentState.streak = 0;
      saveLocal(currentState);
      render();
    }

    return { init };
  })();

  // ============================================
  // STATS MODULE
  // ============================================
  const StatsModule = (function() {
    const LS = {
      rankedV2: "echtlucky_ranked_v2",
      reflexV3: "echtlucky_reflex_v3",
      focusSessions: "echtlucky:focus:sessions:v1",
      notes: "echtlucky:stats:notes:v1"
    };

    function readRanked() {
      const raw = safeJsonParse(localStorage.getItem(LS.rankedV2), {});
      return {
        totalXp: Number(raw?.totalXp || 0),
        streak: Number(raw?.streak || 0)
      };
    }

    function readReflex() {
      const raw = safeJsonParse(localStorage.getItem(LS.reflexV3), {});
      return {
        bestMs: Number(raw?.bestMs || NaN),
        bestAvgMs: Number(raw?.bestAvgMs || NaN)
      };
    }

    function readFocus() {
      const sessions = safeJsonParse(localStorage.getItem(LS.focusSessions), []);
      return { sessions: Array.isArray(sessions) ? sessions : [] };
    }

    function getRankName(xp) {
      const ranks = [
        { name: "Bronze", minXp: 0 },
        { name: "Silber", minXp: 400 },
        { name: "Gold", minXp: 900 },
        { name: "Platin", minXp: 1500 },
        { name: "Diamant", minXp: 2200 },
        { name: "Elite", minXp: 3000 },
        { name: "Champion", minXp: 3800 },
        { name: "Unreal", minXp: 4700 }
      ];
      let idx = 0;
      for (let i = 0; i < ranks.length; i++) {
        if (xp >= ranks[i].minXp) idx = i;
      }
      return ranks[idx].name;
    }

    function render() {
      const ranked = readRanked();
      const reflex = readReflex();
      const focus = readFocus();

      const level = Math.max(1, Math.floor(ranked.totalXp / 250) + 1);
      const rankName = getRankName(ranked.totalXp);

      // Hero stats
      const rankValue = document.getElementById("statsRankValue");
      const streakValue = document.getElementById("statsStreakValue");
      const focusValue = document.getElementById("statsFocusValue");

      if (rankValue) rankValue.textContent = `${rankName} • ${ranked.totalXp} XP • Lvl ${level}`;
      if (streakValue) streakValue.textContent = `${ranked.streak} Tage`;
      if (focusValue) focusValue.textContent = focus.sessions.length > 0 ? "Aktiv" : "Aus";

      // XP Week title
      const xpWeekTitle = document.getElementById("xpWeekTitle");
      if (xpWeekTitle) xpWeekTitle.textContent = `+${ranked.totalXp} XP total`;

      // Skill fills
      const aimPct = Math.min(100, Math.round((500 - (reflex.bestAvgMs || 300)) / 2));
      const gamesensePct = Math.min(100, Math.round(ranked.totalXp / 50));
      const consistencyPct = Math.min(100, ranked.streak * 3);

      const skillAimFill = document.getElementById("skillAimFill");
      const skillGamesenseFill = document.getElementById("skillGamesenseFill");
      const skillConsistencyFill = document.getElementById("skillConsistencyFill");
      const skillAimValue = document.getElementById("skillAimValue");
      const skillGamesenseValue = document.getElementById("skillGamesenseValue");
      const skillConsistencyValue = document.getElementById("skillConsistencyValue");

      if (skillAimFill) skillAimFill.style.width = `${clamp(aimPct, 0, 100)}%`;
      if (skillGamesenseFill) skillGamesenseFill.style.width = `${clamp(gamesensePct, 0, 100)}%`;
      if (skillConsistencyFill) skillConsistencyFill.style.width = `${clamp(consistencyPct, 0, 100)}%`;
      if (skillAimValue) skillAimValue.textContent = `${clamp(aimPct, 0, 100)}%`;
      if (skillGamesenseValue) skillGamesenseValue.textContent = `${clamp(gamesensePct, 0, 100)}%`;
      if (skillConsistencyValue) skillConsistencyValue.textContent = `${clamp(consistencyPct, 0, 100)}%`;

      // Streak pill
      const streakPill = document.getElementById("statsStreakPill");
      if (streakPill) streakPill.textContent = `+${ranked.streak} Tage`;

      // Streak rows
      const streakRows = document.getElementById("streakRows");
      if (streakRows) {
        streakRows.innerHTML = Array.from({ length: 7 }, (_, i) => {
          const day = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"][i];
          const xp = i === 6 ? ranked.totalXp % 500 : Math.floor(Math.random() * 300);
          return `<div>${day} · ${xp} XP</div>`;
        }).join("");
      }

      // Compare values
      const compareToday = document.getElementById("compareTodayValue");
      const compareYesterday = document.getElementById("compareYesterdayValue");
      if (compareToday) compareToday.textContent = `Focus ${focus.sessions.length * 25}m • XP +${ranked.totalXp % 500}`;
      if (compareYesterday) compareYesterday.textContent = `Focus ${Math.max(0, focus.sessions.length - 1) * 25}m • XP +${Math.max(0, (ranked.totalXp % 500) - 50)}`;
    }

    function init() {
      render();

      // Add note button
      const btnAddNote = document.getElementById("btnAddNote");
      if (btnAddNote) {
        btnAddNote.addEventListener("click", () => {
          const text = prompt("Notiz eingeben:");
          if (text) {
            const notes = safeJsonParse(localStorage.getItem(LS.notes), []);
            notes.unshift({
              id: `note_${Date.now()}`,
              at: new Date().toISOString(),
              text: text.slice(0, 180)
            });
            localStorage.setItem(LS.notes, JSON.stringify(notes.slice(0, 20)));
            renderNotes();
          }
        });
      }

      renderNotes();
    }

    function renderNotes() {
      const noteList = document.getElementById("noteList");
      if (!noteList) return;

      const notes = safeJsonParse(localStorage.getItem(LS.notes), []);
      if (notes.length === 0) {
        noteList.innerHTML = '<div class="note note--empty">Noch keine Notizen.</div>';
        return;
      }

      noteList.innerHTML = notes.slice(0, 5).map((n) => `
        <div class="note">${escapeHtml(n.text)}</div>
      `).join("");
    }

    return { init };
  })();

  // ============================================
  // FOCUS MODULE
  // ============================================
  const FocusModule = (function() {
    const LS_SESSIONS = "echtlucky:focus:sessions:v1";
    const LS_ACTIVE = "echtlucky:focus:active:v1";
    const LS_SETTINGS = "echtlucky:focus:settings:v1";

    let tickTimer = null;

    function loadSettings() {
      const s = safeJsonParse(localStorage.getItem(LS_SETTINGS), {});
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
      const arr = safeJsonParse(localStorage.getItem(LS_SESSIONS), []);
      return Array.isArray(arr) ? arr : [];
    }

    function saveSessions(arr) {
      localStorage.setItem(LS_SESSIONS, JSON.stringify(arr.slice(-250)));
    }

    function loadActive() {
      const a = safeJsonParse(sessionStorage.getItem(LS_ACTIVE) || localStorage.getItem(LS_ACTIVE), null);
      return a && typeof a === "object" ? a : null;
    }

    function saveActive(active) {
      if (active) {
        const data = JSON.stringify(active);
        sessionStorage.setItem(LS_ACTIVE, data);
        localStorage.setItem(LS_ACTIVE, data);
      } else {
        sessionStorage.removeItem(LS_ACTIVE);
        localStorage.removeItem(LS_ACTIVE);
      }
    }

    function render() {
      const sessions = loadSessions();
      const today = todayKey();
      const todaySessions = sessions.filter((s) => (s.dayKey || "").startsWith(today) && s.kind === "focus");
      const todayTotal = todaySessions.reduce((a, b) => a + (b.durationSec || 0), 0);
      const focusSessions = sessions.filter((s) => s.kind === "focus");
      const focusTotal = focusSessions.reduce((a, b) => a + (b.durationSec || 0), 0);
      const avg = focusSessions.length ? Math.floor(focusTotal / focusSessions.length) : 0;

      const focusTime = document.getElementById("focusTime");
      const todayCount = document.getElementById("todayCount");
      const avgDuration = document.getElementById("avgDuration");

      if (focusTime) focusTime.textContent = fmt(todayTotal);
      if (todayCount) todayCount.textContent = `${todaySessions.length} Sessions`;
      if (avgDuration) avgDuration.textContent = fmt(avg);

      // History
      const focusHistory = document.getElementById("focusHistory");
      if (focusHistory) {
        if (!sessions.length) {
          focusHistory.innerHTML = '<div class="history-empty">Noch keine Sessions.</div>';
        } else {
          focusHistory.innerHTML = sessions.slice().reverse().slice(0, 20).map((s) => {
            const startedAt = new Date(s.startedAt);
            const label = s.kind === "break" ? "Pause" : "Fokus";
            return `<div class="history-item">${label} • ${fmt(s.durationSec)} • ${startedAt.toLocaleString()}</div>`;
          }).join("");
        }
      }
    }

    function renderStatus() {
      const active = loadActive();
      const statusLabel = document.getElementById("focusStatus");
      const timerDisplay = document.getElementById("sessionClock");
      const startBtn = document.getElementById("btnStartFocus");
      const pauseBtn = document.getElementById("btnPauseFocus");
      const endBtn = document.getElementById("btnEndFocus");

      if (!active) {
        if (statusLabel) statusLabel.textContent = "Bereit";
        if (timerDisplay) timerDisplay.textContent = "00:00";
        if (startBtn) startBtn.disabled = false;
        if (pauseBtn) pauseBtn.disabled = true;
        if (endBtn) endBtn.disabled = true;
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

      if (statusLabel) statusLabel.textContent = active.pausedAt ? "Pausiert" : active.kind === "break" ? "Pause" : "Läuft";
      if (timerDisplay) timerDisplay.textContent = fmt(remainingSec);
      if (startBtn) startBtn.disabled = true;
      if (pauseBtn) pauseBtn.disabled = false;
      if (endBtn) endBtn.disabled = false;
    }

    function startTick() {
      if (tickTimer) return;
      tickTimer = window.setInterval(renderStatus, 250);
    }

    function stopTick() {
      if (tickTimer) {
        window.clearInterval(tickTimer);
        tickTimer = null;
      }
    }

    function startFocusSession() {
      saveActive({
        kind: "focus",
        startedAtMs: Date.now(),
        pausedAt: null,
        pausedAccumMs: 0,
        isLongBreak: false,
        distractions: []
      });
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

      stopTick();
      render();
      renderStatus();

      const focusLogs = document.getElementById("focusLogs");
      if (focusLogs) {
        const label = entry.kind === "break" ? "Pause" : "Fokus";
        focusLogs.insertAdjacentHTML("afterbegin", `<div class="log-item">${label} beendet: ${fmt(entry.durationSec)}</div>`);
      }
    }

    function clearHistory() {
      localStorage.removeItem(LS_SESSIONS);
      render();
    }

    function logDistraction() {
      const input = document.getElementById("distractionInput");
      const active = loadActive();
      if (!active || !input) return;

      const text = String(input.value || "").trim();
      if (!text) return;

      const item = { at: new Date().toISOString(), text: text.slice(0, 140) };
      active.distractions = Array.isArray(active.distractions) ? active.distractions : [];
      active.distractions.unshift(item);
      active.distractions = active.distractions.slice(0, 20);
      saveActive(active);

      const focusLogs = document.getElementById("focusLogs");
      if (focusLogs) {
        focusLogs.insertAdjacentHTML("afterbegin", `<div class="log-item">Ablenkung: ${escapeHtml(item.text)}</div>`);
      }

      input.value = "";
    }

    function applySettingsToUI() {
      const s = loadSettings();
      const focusMinutesSelect = document.getElementById("focusMinutesSelect");
      const breakMinutesSelect = document.getElementById("breakMinutesSelect");
      const longBreakMinutesSelect = document.getElementById("longBreakMinutesSelect");
      const toggleFocus = document.getElementById("btnToggleFocusMode");

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

    function init() {
      applySettingsToUI();
      render();
      renderStatus();

      const startBtn = document.getElementById("btnStartFocus");
      const pauseBtn = document.getElementById("btnPauseFocus");
      const endBtn = document.getElementById("btnEndFocus");
      const clearBtn = document.getElementById("btnClearHistory");
      const logBtn = document.getElementById("btnLogDistraction");
      const toggleFocus = document.getElementById("btnToggleFocusMode");
      const distractionInput = document.getElementById("distractionInput");

      if (startBtn) startBtn.addEventListener("click", startFocusSession);
      if (pauseBtn) pauseBtn.addEventListener("click", togglePause);
      if (endBtn) endBtn.addEventListener("click", endSession);
      if (clearBtn) clearBtn.addEventListener("click", clearHistory);
      if (logBtn) logBtn.addEventListener("click", logDistraction);

      if (distractionInput) {
        distractionInput.addEventListener("keydown", (e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            logDistraction();
          }
        });
      }

      if (toggleFocus) {
        toggleFocus.addEventListener("click", () => {
          const s = loadSettings();
          const next = { ...s, focusMode: !s.focusMode };
          saveSettings(next);
          applySettingsToUI();
        });
      }

      // Settings change handlers
      const onChange = () => {
        const next = {
          ...loadSettings(),
          focusMin: Number(document.getElementById("focusMinutesSelect")?.value || 25),
          breakMin: Number(document.getElementById("breakMinutesSelect")?.value || 5),
          longBreakMin: Number(document.getElementById("longBreakMinutesSelect")?.value || 15)
        };
        saveSettings(next);
      };

      const focusMinutesSelect = document.getElementById("focusMinutesSelect");
      const breakMinutesSelect = document.getElementById("breakMinutesSelect");
      const longBreakMinutesSelect = document.getElementById("longBreakMinutesSelect");

      if (focusMinutesSelect) focusMinutesSelect.addEventListener("change", onChange);
      if (breakMinutesSelect) breakMinutesSelect.addEventListener("change", onChange);
      if (longBreakMinutesSelect) longBreakMinutesSelect.addEventListener("change", onChange);

      // Start tick if there's an active session
      if (loadActive()) {
        startTick();
      }
    }

    return { init };
  })();

  // ============================================
  // REFLEX MODULE
  // ============================================
  const ReflexModule = (function() {
    const LS_KEY = "echtlucky_reflex_v3";

    let mode = "reaction";
    let sizeMode = "mixed";
    let spawnMode = "safe";
    let running = false;
    let runTotal = 15;
    let runCount = 0;
    let hitTimes = [];
    let spawnAt = 0;
    let lastPos = { x: 0.5, y: 0.5 };

    function loadLS() {
      return safeJsonParse(localStorage.getItem(LS_KEY), {});
    }

    function saveLS(data) {
      localStorage.setItem(LS_KEY, JSON.stringify(data));
    }

    function msToLabel(ms) {
      if (!isFinite(ms)) return "—";
      if (ms >= 1000) return (ms / 1000).toFixed(2) + "s";
      return Math.round(ms) + "ms";
    }

    function ratingFromAvg(avgMs) {
      if (!isFinite(avgMs)) return { grade: "—", label: "—" };
      if (avgMs <= 220) return { grade: "S+", label: "Godlike" };
      if (avgMs <= 280) return { grade: "S", label: "Cracked" };
      if (avgMs <= 340) return { grade: "A", label: "Insane" };
      if (avgMs <= 420) return { grade: "B", label: "Solid" };
      if (avgMs <= 520) return { grade: "C", label: "Okay" };
      return { grade: "D", label: "Warmup needed" };
    }

    function calcStats(times) {
      if (!times.length) return { avg: NaN, best: NaN, std: NaN, score: 0 };
      const avg = times.reduce((a, b) => a + b, 0) / times.length;
      const best = Math.min(...times);
      const variance = times.reduce((s, t) => s + Math.pow(t - avg, 2), 0) / times.length;
      const std = Math.sqrt(variance);
      const speed = clamp(1000 - avg, 0, 1000);
      const cons = clamp(600 - std, 0, 600);
      const bonus = mode === "precision" ? 180 : mode === "flick" ? 120 : 80;
      const score = Math.round(speed + cons + bonus + times.length * 12);
      return { avg, best, std, score };
    }

    function renderTopStats() {
      const ls = loadLS();
      const bestValue = document.getElementById("bestValue");
      const avgValue = document.getElementById("avgValue");
      const ratingValue = document.getElementById("ratingValue");

      if (bestValue) bestValue.textContent = isFinite(ls.bestMs) ? msToLabel(ls.bestMs) : "—";
      if (avgValue) avgValue.textContent = isFinite(ls.bestAvgMs) ? msToLabel(ls.bestAvgMs) : "—";
      if (ratingValue) ratingValue.textContent = ratingFromAvg(ls.bestAvgMs).grade;
    }

    function paintTargetsRange() {
      const cfgTargets = document.getElementById("cfgTargets");
      const cfgTargetsVal = document.getElementById("cfgTargetsVal");
      if (!cfgTargets) return;

      const min = Number(cfgTargets.min || 0);
      const max = Number(cfgTargets.max || 100);
      const val = Number(cfgTargets.value || 0);
      const pct = ((val - min) / (max - min)) * 100;
      cfgTargets.style.setProperty("--fill", `${pct}%`);
      if (cfgTargetsVal) cfgTargetsVal.textContent = String(val);
    }

    function clearStage() {
      const stage = document.getElementById("stage");
      if (stage) {
        stage.querySelectorAll(".target").forEach((el) => el.remove());
      }
    }

    function sizePx() {
      if (sizeMode === "large") return 76;
      if (sizeMode === "medium") return 54;
      if (sizeMode === "small") return 34;

      const pool = mode === "precision" ? [26, 28, 30, 32, 34] :
                   mode === "flick" ? [34, 40, 46, 52] :
                   [40, 46, 52, 58, 64];
      return pool[Math.floor(Math.random() * pool.length)];
    }

    function spawnPoint() {
      const stage = document.getElementById("stage");
      if (!stage) return { x: 100, y: 100 };

      const r = stage.getBoundingClientRect();
      const pad = 60;
      const w = Math.max(300, r.width);
      const h = Math.max(300, r.height);

      let x = pad + Math.random() * (w - pad * 2);
      let y = pad + Math.random() * (h - pad * 2);

      if (spawnMode === "safe") {
        const lx = lastPos.x * w;
        const ly = lastPos.y * h;
        let tries = 0;
        while (tries < 14) {
          const dx = x - lx;
          const dy = y - ly;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > w * 0.18) break;
          x = pad + Math.random() * (w - pad * 2);
          y = pad + Math.random() * (h - pad * 2);
          tries++;
        }
      }

      lastPos = { x: x / w, y: y / h };
      return { x, y };
    }

    function createTarget() {
      clearStage();
      const stage = document.getElementById("stage");
      if (!stage) return;

      const s = sizePx();
      const p = spawnPoint();

      const t = document.createElement("div");
      t.className = "target";
      t.style.width = s + "px";
      t.style.height = s + "px";
      t.style.left = p.x + "px";
      t.style.top = p.y + "px";

      t.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!running) return;

        const hitMs = performance.now() - spawnAt;
        hitTimes.push(hitMs);

        const hudLast = document.getElementById("hudLast");
        if (hudLast) hudLast.textContent = "Last: " + msToLabel(hitMs);

        runCount++;
        const hudProgress = document.getElementById("hudProgress");
        if (hudProgress) hudProgress.textContent = `${runCount}/${runTotal}`;

        if (runCount >= runTotal) finishRun();
        else nextTarget();
      });

      stage.appendChild(t);
      spawnAt = performance.now();
    }

    function nextTarget() {
      if (!running) return;
      if (mode === "reaction") {
        clearStage();
        const delay = 260 + Math.random() * 760;
        window.setTimeout(() => {
          if (!running) return;
          createTarget();
        }, delay);
        return;
      }
      createTarget();
    }

    function setCenter(title, text) {
      const centerMsg = document.getElementById("centerMsg");
      if (!centerMsg) return;
      const t = centerMsg.querySelector(".center-title");
      const p = centerMsg.querySelector(".center-text");
      if (t) t.textContent = title;
      if (p) p.textContent = text;
      centerMsg.style.display = "flex";
    }

    function hideCenter() {
      const centerMsg = document.getElementById("centerMsg");
      if (centerMsg) centerMsg.style.display = "none";
    }

    function openOverlay() {
      const overlay = document.getElementById("gameOverlay");
      if (!overlay) return;
      overlay.classList.add("show");
      overlay.classList.add("is-playing");
      overlay.setAttribute("aria-hidden", "false");
      document.body.classList.add("modal-open");

      if (!document.fullscreenElement && overlay.requestFullscreen) {
        overlay.requestFullscreen().catch(() => {});
      }

      const stage = document.getElementById("stage");
      if (stage) stage.focus({ preventScroll: true });
    }

    function closeOverlay() {
      running = false;
      clearStage();

      const overlay = document.getElementById("gameOverlay");
      if (overlay) {
        overlay.classList.remove("is-playing");
        overlay.classList.remove("show");
        overlay.setAttribute("aria-hidden", "true");
      }
      document.body.classList.remove("modal-open");

      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }

      setCenter("Ready?", "Targets erscheinen gleich. Klick so schnell wie möglich.");
    }

    function startRun() {
      const cfgTargets = document.getElementById("cfgTargets");
      running = true;
      runTotal = parseInt(cfgTargets?.value || 15, 10);
      runCount = 0;
      hitTimes = [];

      const hudProgress = document.getElementById("hudProgress");
      const hudMode = document.getElementById("hudMode");
      const hudLast = document.getElementById("hudLast");
      const hudBest = document.getElementById("hudBest");
      const hudAvg = document.getElementById("hudAvg");
      const resultCard = document.getElementById("resultCard");

      if (hudProgress) hudProgress.textContent = `0/${runTotal}`;
      if (hudMode) hudMode.textContent = mode[0].toUpperCase() + mode.slice(1);
      if (hudLast) hudLast.textContent = "Last: —";
      if (hudBest) hudBest.textContent = "Best: —";
      if (hudAvg) hudAvg.textContent = "Avg: —";
      if (resultCard) resultCard.style.display = "none";

      hideCenter();
      openOverlay();
      nextTarget();
    }

    function finishRun() {
      running = false;
      clearStage();

      const stats = calcStats(hitTimes);
      const hudBest = document.getElementById("hudBest");
      const hudAvg = document.getElementById("hudAvg");

      if (hudBest) hudBest.textContent = "Best: " + msToLabel(stats.best);
      if (hudAvg) hudAvg.textContent = "Avg: " + msToLabel(stats.avg);

      const ls = loadLS();
      const improvedBest = !isFinite(ls.bestMs) || stats.best < ls.bestMs;
      const improvedAvg = !isFinite(ls.bestAvgMs) || stats.avg < ls.bestAvgMs;

      const newLS = {
        ...ls,
        bestMs: improvedBest ? stats.best : ls.bestMs,
        bestAvgMs: improvedAvg ? stats.avg : ls.bestAvgMs,
        lastRun: { mode, sizeMode, spawnMode, total: runTotal, times: hitTimes, avgMs: stats.avg, bestMs: stats.best, stdMs: stats.std, score: stats.score, at: Date.now() }
      };
      saveLS(newLS);

      const r = ratingFromAvg(stats.avg);
      const resultCard = document.getElementById("resultCard");
      const resultRating = document.getElementById("resultRating");
      const resAvg = document.getElementById("resAvg");
      const resBest = document.getElementById("resBest");
      const resCons = document.getElementById("resCons");
      const resScore = document.getElementById("resScore");
      const hitChips = document.getElementById("hitChips");

      if (resultCard) resultCard.style.display = "grid";
      if (resultRating) resultRating.textContent = `${r.grade} • ${r.label}`;
      if (resAvg) resAvg.textContent = msToLabel(stats.avg);
      if (resBest) resBest.textContent = msToLabel(stats.best);
      if (resCons) resCons.textContent = isFinite(stats.std) ? Math.round(stats.std) + "ms" : "—";
      if (resScore) resScore.textContent = String(stats.score);

      if (hitChips) {
        hitChips.innerHTML = hitTimes.slice(0, 60).map((t) => `<div class="chip">${msToLabel(t)}</div>`).join("");
      }

      renderTopStats();

      if (window.notify) {
        window.notify.show({ type: "success", title: "Reflex Lab", message: `Run complete • Avg ${msToLabel(stats.avg)}`, duration: 4500 });
      }

      setCenter("Run complete ✅", "Du kannst erneut starten oder Exit drücken.");
    }

    function setActive(list, btn) {
      list.forEach((x) => x.classList.remove("is-active"));
      btn.classList.add("is-active");
    }

    function showHow() {
      if (window.notify?.show) {
        window.notify.show({
          type: "info",
          title: "How it works",
          message: "Reaction: Target kommt nach Delay. Flick: sofortige Targets. Precision: kleiner + sweaty. ESC/Exit beendet.",
          duration: 6500
        });
      }
    }

    function resetStats() {
      if (window.echtluckyModal?.confirm) {
        window.echtluckyModal.confirm({
          title: "Reflex Stats zurücksetzen",
          message: "Möchtest du alle deine Reflex-Statistiken wirklich zurücksetzen?",
          confirmText: "Ja, zurücksetzen",
          cancelText: "Abbrechen",
          type: "warning"
        }).then((ok) => {
          if (ok) doReset();
        });
      } else if (confirm("Reflex Stats zurücksetzen?")) {
        doReset();
      }
    }

    function doReset() {
      localStorage.removeItem(LS_KEY);
      renderTopStats();
      const resultCard = document.getElementById("resultCard");
      if (resultCard) resultCard.style.display = "none";
      if (window.notify) {
        window.notify.show({ type: "success", title: "Reflex Lab", message: "Stats wurden resettet ✅", duration: 4500 });
      }
    }

    function init() {
      renderTopStats();
      paintTargetsRange();

      const cfgTargets = document.getElementById("cfgTargets");
      const btnStart = document.getElementById("btnStart");
      const btnReset = document.getElementById("btnReset");
      const btnHow = document.getElementById("btnHow");
      const btnExit = document.getElementById("btnExit");

      if (cfgTargets) cfgTargets.addEventListener("input", paintTargetsRange, { passive: true });
      if (btnStart) btnStart.addEventListener("click", startRun);
      if (btnReset) btnReset.addEventListener("click", resetStats);
      if (btnHow) btnHow.addEventListener("click", showHow);
      if (btnExit) btnExit.addEventListener("click", closeOverlay);

      // Mode buttons
      document.querySelectorAll(".mode").forEach((b) => {
        b.addEventListener("click", () => {
          if (running) return;
          setActive(Array.from(document.querySelectorAll(".mode")), b);
          mode = b.dataset.mode;
        });
      });

      // Size buttons
      document.querySelectorAll(".seg[data-size]").forEach((b) => {
        b.addEventListener("click", () => {
          if (running) return;
          setActive(Array.from(document.querySelectorAll(".seg[data-size]")), b);
          sizeMode = b.dataset.size;
        });
      });

      // Spawn buttons
      document.querySelectorAll(".seg[data-spawn]").forEach((b) => {
        b.addEventListener("click", () => {
          if (running) return;
          setActive(Array.from(document.querySelectorAll(".seg[data-spawn]")), b);
          spawnMode = b.dataset.spawn;
        });
      });

      // Keyboard
      window.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
          const overlay = document.getElementById("gameOverlay");
          if (overlay?.classList.contains("show")) {
            closeOverlay();
          }
        }
      });
    }

    return { init };
  })();

  // ============================================
  // INITIALIZATION
  // ============================================
  async function init() {
    // Wait for Firebase
    await ConnectModule.waitForFirebase();

    // Initialize all modules
    ConnectModule.init();
    RankedModule.init();
    StatsModule.init();
    FocusModule.init();
    ReflexModule.init();

    // Global keyboard shortcuts
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        // Close any open modals
        document.querySelectorAll(".modal-overlay:not([hidden])").forEach((modal) => {
          modal.hidden = true;
          modal.setAttribute("aria-hidden", "true");
        });
        document.querySelectorAll(".group-settings-modal.is-open").forEach((modal) => {
          modal.classList.remove("is-open");
        });
      }
    });
  }

  // Start when DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
