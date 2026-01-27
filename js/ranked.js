(() => {
  "use strict";

  const LS_KEY = "echtlucky_ranked_v2";
  const CLOUD_FIELD = "rankedState";

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
    { title: "Consistency", desc: "2 Games: gleiche Sens/Settings, keine Experimente.", xp: 30 },
    { title: "Pre-Aim Routes", desc: "10 Min: 3 typische Pre-Aim Lines pro Map.", xp: 40 },
    { title: "Crosshair Reset", desc: "In 2 Games: nach jedem Fight bewusst resetten.", xp: 35 },
    { title: "Angle Discipline", desc: "1 Game: nur 1–2 Angles halten, nicht over-peeken.", xp: 45 },
    { title: "Trade Practice", desc: "In 2 Games: immer tradefähig spielen (Abstand check).", xp: 40 },
    { title: "Info Economy", desc: "1 Game: Info callen ohne Panik (kurz, klar, useful).", xp: 35 },
    { title: "Mini Goal", desc: "Setz dir 1 Ziel: z.B. 0 unnötige Repeeks.", xp: 30 },
    { title: "Spray Control", desc: "10 Min: Spray-Pattern / Burst Routine.", xp: 40 },
    { title: "Micro-Positioning", desc: "1 Game: nach jedem Shot mini reposition (1–2 Steps).", xp: 45 },
    { title: "Utility Timing", desc: "3 Utility-Plays mit Timing: early/mid/late testen.", xp: 40 },
    { title: "Eco Mastery", desc: "1 Eco-Round: nur Value spielen (Pick + Exit).", xp: 45 },
    { title: "Clutch Rules", desc: "Wenn 1vX: isolieren, nicht rushen. 1 Runde bewusst.", xp: 45 },
    { title: "Minimap Check", desc: "2 Games: alle 10–15 Sek minimap/teams checken.", xp: 35 },
    { title: "Sound Focus", desc: "1 Game: Audio über alles, keine Musik/Distraction.", xp: 30 },
    { title: "Setup Routine", desc: "Vor Ranked: 2 Min Settings check (sens, fps, audio).", xp: 25 },
    { title: "First Death Rule", desc: "1 Game: avoid first death (safe opener).", xp: 45 },
    { title: "Entry Discipline", desc: "Wenn entry: 1 clear plan, wenn nicht: trade ready.", xp: 40 },
    { title: "Retake Plan", desc: "1 Game: vor Retake kurz plan callen (2 steps).", xp: 45 },
    { title: "Anti Tilt Chat", desc: "2 Games: kein Flame, nur Infos (0 tox).", xp: 35 },
    { title: "Review Your Win", desc: "Nach Win: 1 Sache merken, warum’s geklappt hat.", xp: 30 },
    { title: "Review Your Loss", desc: "Nach Loss: 1 Sache fixen (nicht 10).", xp: 30 },
  ];

  const DIFFICULTY_CONFIG = {
    easy: { label: "Easy", multiplier: 0.92 },
    normal: { label: "Normal", multiplier: 1 },
    hard: { label: "Hard", multiplier: 1.12 },
  };

  const WEEKLY_CHALLENGES_TEMPLATE = [
    {
      id: "weekly-heat",
      title: "Heatmap Run",
      desc: "15 Min Fokus auf Tracking & Flicks.",
      status: "in-progress",
    },
    {
      id: "weekly-coach",
      title: "Coach Session",
      desc: "Custom mit Feedback + Dos/Don'ts.",
      status: "ready",
    },
    {
      id: "weekly-focus",
      title: "Focus Mode",
      desc: "3 Matches ohne Tilt, nur win-conditions.",
      status: "locked",
    },
    {
      id: "weekly-resets",
      title: "Reset Ritual",
      desc: "After warm-up: 2 aim resets, 1 rehydration.",
      status: "locked",
    },
  ];

  const HISTORY_TEMPLATE = (() => {
    const now = Date.now();
    return [
      {
        id: "history-1",
        label: "Scrim vs. Cipher",
        xp: 18,
        type: "Scrim",
        ts: now - 1000 * 60 * 45,
      },
      {
        id: "history-2",
        label: "VOD Review Mission",
        xp: 12,
        type: "Review",
        ts: now - 1000 * 60 * 90,
      },
      {
        id: "history-3",
        label: "High-Stakes Run",
        xp: 25,
        type: "Ranked",
        ts: now - 1000 * 60 * 130,
      },
      {
        id: "history-4",
        label: "Warm-up Sprint",
        xp: 9,
        type: "Warm-up",
        ts: now - 1000 * 60 * 200,
      },
    ];
  })();

  const BADGE_TEMPLATE = [
    { id: "badge-7", label: "7-Day Streak", type: "streak", threshold: 7 },
    { id: "badge-30", label: "30 XP Drops", type: "xp", threshold: 300 },
    { id: "badge-50", label: "50 Matches", type: "matches", threshold: 50 },
  ];

  const SKILL_TEMPLATE = [
    { label: "Aim", base: 82, scale: 2.3 },
    { label: "Gamesense", base: 74, scale: 1.8 },
    { label: "Consistency", base: 69, scale: 1.6 },
    { label: "Warm-Up", base: 91, scale: 1.2 },
  ];

  const RANKS = [
    { name: "Bronze", xp: 0 },
    { name: "Steel", xp: 800 },
    { name: "Unreal", xp: 2000 },
    { name: "Mythic", xp: 4200 },
    { name: "Divinity", xp: 7800 },
  ];

  const WEEKDAY_NAMES = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

  const els = {
    shell: document.querySelector(".ranked-shell"),
    dailyList: document.querySelector(".daily-task-list"),
    dailyBar: document.querySelector("[data-role='daily-progress']"),
    dailyCount: document.querySelector(".daily-progress-count"),
    dailyXp: document.querySelector(".daily-progress-xp"),
    weeklyList: document.querySelector("[data-role='weekly-list']"),
    weeklyPercent: document.querySelector(".weekly-progress-percent"),
    weeklyBar: document.querySelector("[data-role='weekly-progress']"),
    weeklyNotes: document.querySelector("[data-role='weekly-notes']"),
    monthlyBar: document.querySelector("[data-role='monthly-progress']"),
    monthlyDelta: document.querySelector("[data-role='monthly-delta']"),
    monthlyStreak: document.querySelector("[data-role='monthly-streak']"),
    historyList: document.querySelector("[data-role='history-list']"),
    badgesGrid: document.querySelector("[data-role='badges-grid']"),
    heatmapGrid: document.querySelector("[data-role='heatmap-grid']"),
    feedbackPercent: document.querySelector(".feedback-percent"),
    focusToggle: document.querySelector(".focus-toggle"),
    difficultyButtons: document.querySelectorAll(".difficulty-buttons .btn"),
    skillGrid: document.querySelector("[data-role='skill-grid']"),
    streakTimeline: document.querySelector("[data-role='streak-timeline']"),
    compareToday: document.querySelector("[data-role='compare-today']"),
    compareYesterday: document.querySelector("[data-role='compare-yesterday']"),
    compareDelta: document.querySelector("[data-role='compare-delta']"),
    headerRank: document.querySelector(".ranked-header-rank"),
    headerMeta: document.querySelectorAll(".ranked-header-meta strong"),
    headerProgressBar: document.querySelector(".ranked-sticky-header .ranked-progress__bar"),
    skeleton: document.querySelector(".skeleton-loader"),
    actions: document.querySelectorAll("[data-action]"),
    addSessionBtn: document.querySelector(".floating-add-session"),
  };

  const authRef = window.echtlucky?.auth || window.auth || null;
  const dbRef = window.echtlucky?.db || window.db || null;

  let currentState = null;

  const STATUS_CYCLE = ["locked", "in-progress", "ready", "earned"];

  function todayKey() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function nowMs() {
    return Date.now();
  }

  function safeJsonParse(value) {
    try {
      return JSON.parse(value || "{}");
    } catch {
      return {};
    }
  }

  function loadLocal() {
    return safeJsonParse(localStorage.getItem(LS_KEY));
  }

  function saveLocal(state) {
    localStorage.setItem(LS_KEY, JSON.stringify(state));
  }

  function cloneWeeklyTemplate() {
    return WEEKLY_CHALLENGES_TEMPLATE.map((challenge) => ({ ...challenge }));
  }

  function cloneHistoryTemplate() {
    return HISTORY_TEMPLATE.map((item) => ({ ...item }));
  }

  function cloneBadgesTemplate() {
    return BADGE_TEMPLATE.map((badge) => ({ ...badge }));
  }

  function normalizeState(raw) {
    const day = todayKey();
    const state = raw && typeof raw === "object" ? { ...raw } : {};

    state.totalXp = Number(state.totalXp || 0);
    state.streak = Number(state.streak || 0);
    state.lastCompletedDay = state.lastCompletedDay || null;
    state.updatedAtMs = Number(state.updatedAtMs || 0);
    state.difficulty = state.difficulty || "normal";
    state.focusMode = Boolean(state.focusMode);
    state.weeklyNotes = state.weeklyNotes || "";
    state.matchesCount = Number(state.matchesCount || 0);

    if (!Array.isArray(state.history) || !state.history.length) {
      state.history = cloneHistoryTemplate();
    }

    if (!Array.isArray(state.badges) || !state.badges.length) {
      state.badges = cloneBadgesTemplate();
    }

    if (!Array.isArray(state.weeklyChallenges) || !state.weeklyChallenges.length) {
      state.weeklyChallenges = cloneWeeklyTemplate();
    }

    state.monthly = state.monthly && typeof state.monthly === "object"
      ? {
          progress: Number(state.monthly.progress || 0.54),
          streakDays: Number(state.monthly.streakDays || 14),
          previousDayXp: Number(state.monthly.previousDayXp || 0),
        }
      : { progress: 0.54, streakDays: 14, previousDayXp: 0 };

    if (!state.daily || state.daily.day !== day) {
      const picked = pick3Unique(TASK_POOL).map((task, idx) => ({
        id: `${day}_${idx}_${String(task.title).replace(/\s+/g, "_")}`,
        ...task,
      }));
      state.daily = { day, tasks: picked, doneIds: [] };
      state.updatedAtMs = nowMs();
    }

    if (!Array.isArray(state.daily.tasks)) {
      state.daily.tasks = [];
    }

    if (!Array.isArray(state.daily.doneIds)) {
      state.daily.doneIds = [];
    }

    return state;
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

  function getScaledXp(xp, difficulty) {
    const config = DIFFICULTY_CONFIG[difficulty] || DIFFICULTY_CONFIG.normal;
    return Math.round((xp || 0) * config.multiplier);
  }

  function calcLevel(totalXp) {
    return Math.max(1, Math.floor((totalXp || 0) / 250) + 1);
  }

  function getRankName(totalXp) {
    let rank = RANKS[0].name;
    for (const entry of RANKS) {
      if ((totalXp || 0) >= entry.xp) {
        rank = entry.name;
      }
    }
    return rank;
  }

  function getNextRank(totalXp) {
    const next = RANKS.find((entry) => (totalXp || 0) < entry.xp);
    return next ? next.name : RANKS[RANKS.length - 1].name;
  }

  function renderAll(state) {
    if (!state) return;
    currentState = state;
    saveLocal(state);

    const tasks = state.daily?.tasks || [];
    const doneSet = new Set(state.daily?.doneIds || []);
    const doneCount = tasks.filter((task) => doneSet.has(task.id)).length;
    const xpGain = tasks
      .filter((task) => doneSet.has(task.id))
      .reduce((sum, task) => sum + getScaledXp(task.xp, state.difficulty), 0);

    updateBadgeStatus(state);
    renderDaily(state, doneCount, xpGain);
    renderWeekly(state, doneCount);
    renderMonthly(state, xpGain);
    renderHistory(state);
    renderBadges(state);
    renderHeatmap();
    renderSkillGrid(doneCount);
    renderStreakTimeline(state);
    renderCompare(state, xpGain);
    updateHeader(state);
    updateFocusMode(state);
    refreshDifficultyButtons(state);
    renderFeedback(state, doneCount);
    hideSkeleton();
  }

  function renderDaily(state, doneCount, xpGain) {
    if (els.dailyCount) {
      els.dailyCount.textContent = `${doneCount} / ${state.daily?.tasks.length || 0}`;
    }
    if (els.dailyXp) {
      els.dailyXp.textContent = `+${xpGain} XP`;
    }
    if (els.dailyBar) {
      const percent = state.daily?.tasks.length ? (doneCount / state.daily.tasks.length) * 100 : 0;
      els.dailyBar.style.width = `${Math.round(percent)}%`;
    }
    if (els.dailyList) {
      els.dailyList.innerHTML = "";
      (state.daily?.tasks || []).forEach((task) => {
        const done = state.daily.doneIds.includes(task.id);
        const xpValue = getScaledXp(task.xp, state.difficulty);
        const item = document.createElement("div");
        item.className = `daily-task${done ? " completed" : ""}`;
        item.innerHTML = `
          <div class="daily-task__text">
            <p class="daily-task__title">${task.title}</p>
            <p class="daily-task__desc">${task.desc}</p>
          </div>
          <div>
            <p class="daily-task__xp">+${xpValue} XP</p>
            <button class="btn btn-ghost btn-sm" data-task="${task.id}" type="button">${done ? "Undo" : "Mark"}</button>
          </div>
        `;
        const btn = item.querySelector("button");
        btn?.addEventListener("click", () => {
          toggleTask(task.id);
        });
        els.dailyList.appendChild(item);
      });
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
    currentState.updatedAtMs = nowMs();
    saveLocal(currentState);
    renderAll(currentState);
    syncCloud();
  }

  function renderWeekly(state, doneCount) {
    if (els.weeklyPercent) {
      const weeklyProgress = Math.min(1, 0.35 + (doneCount / 3) * 0.55);
      els.weeklyPercent.textContent = `${Math.round(weeklyProgress * 100)}%`;
    }
    if (els.weeklyBar) {
      const percent = Math.min(100, (Math.min(1, 0.35 + (doneCount / 3) * 0.55)) * 100);
      els.weeklyBar.style.width = `${percent}%`;
    }
    if (els.weeklyList) {
      els.weeklyList.innerHTML = "";
      state.weeklyChallenges.forEach((challenge) => {
        const item = document.createElement("div");
        item.className = `weekly-item ${challenge.status}`;
        item.innerHTML = `
          <div>
            <h3>${challenge.title}</h3>
            <p>${challenge.desc}</p>
          </div>
          <span>${challenge.status.replace("-", " ")}</span>
        `;
        item.addEventListener("click", () => {
          cycleWeeklyStatus(challenge.id);
        });
        els.weeklyList.appendChild(item);
      });
    }
    if (els.weeklyNotes && els.weeklyNotes.value !== state.weeklyNotes) {
      els.weeklyNotes.value = state.weeklyNotes;
    }
  }

  function cycleWeeklyStatus(challengeId) {
    if (!currentState) return;
    const challenge = currentState.weeklyChallenges.find((item) => item.id === challengeId);
    if (!challenge) return;
    const idx = STATUS_CYCLE.indexOf(challenge.status);
    challenge.status = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
    currentState.updatedAtMs = nowMs();
    saveLocal(currentState);
    renderAll(currentState);
    syncCloud();
  }

  function renderMonthly(state, xpGain) {
    if (els.monthlyBar) {
      const width = Math.min(1, state.monthly.progress || 0) * 100;
      els.monthlyBar.style.width = `${width}%`;
    }
    if (els.monthlyDelta) {
      const delta = xpGain - (state.monthly.previousDayXp || 0);
      els.monthlyDelta.textContent = `${delta >= 0 ? "+" : ""}${delta.toFixed(1)}%`;
    }
    if (els.monthlyStreak) {
      els.monthlyStreak.textContent = `${state.monthly.streakDays || 0} Tage`;
    }
  }

  function renderHistory(state) {
    if (!els.historyList) return;
    els.historyList.innerHTML = "";
    const sorted = [...state.history].sort((a, b) => (b.ts || 0) - (a.ts || 0));
    sorted.slice(0, 10).forEach((entry) => {
      const item = document.createElement("li");
      const time = new Date(entry.ts || nowMs()).toLocaleTimeString("de-DE", {
        hour: "2-digit",
        minute: "2-digit",
      });
      item.innerHTML = `
        <div>
          <p class="history-label">${entry.label}</p>
          <small class="history-meta">${time} � ${entry.type}</small>
        </div>
        <strong>+${entry.xp} XP</strong>
      `;
      els.historyList.appendChild(item);
    });
  }

  function renderBadges(state) {
    if (!els.badgesGrid) return;
    els.badgesGrid.innerHTML = "";
    state.badges.forEach((badge) => {
      const el = document.createElement("div");
      el.className = `badge badge--${badge.status || "locked"}`;
      el.innerHTML = `
        <strong>${badge.threshold}</strong>
        <span>${badge.label}</span>
      `;
      els.badgesGrid.appendChild(el);
    });
  }

  function renderHeatmap() {
    if (!els.heatmapGrid) return;
    els.heatmapGrid.innerHTML = "";
    for (let i = 0; i < 12; i += 1) {
      const cell = document.createElement("span");
      const intensity = 0.2 + Math.random() * 0.6;
      cell.style.background = `rgba(0, 255, 136, ${intensity})`;
      cell.style.borderColor = `rgba(0, 255, 136, ${0.4 + intensity / 2})`;
      cell.style.opacity = Math.min(1, intensity + 0.4);
      els.heatmapGrid.appendChild(cell);
    }
  }

  function renderSkillGrid(doneCount) {
    if (!els.skillGrid) return;
    els.skillGrid.innerHTML = "";
    SKILL_TEMPLATE.forEach((stat) => {
      const value = Math.min(100, stat.base + Math.round(doneCount * stat.scale));
      const block = document.createElement("div");
      block.className = "skill";
      block.innerHTML = `
        <span>${stat.label}</span>
        <div class="skill-meter">
          <span style="width:${value}%"></span>
        </div>
        <strong>${value}%</strong>
      `;
      els.skillGrid.appendChild(block);
    });
  }

  function renderStreakTimeline(state) {
    if (!els.streakTimeline) return;
    els.streakTimeline.innerHTML = "";
    const streak = state.streak || 0;
    const todayIndex = ((new Date().getDay() + 6) % 7);
    for (let offset = 0; offset < 5; offset += 1) {
      const dayIndex = (todayIndex + offset) % 7;
      const stepValue = Math.max(0, streak - (4 - offset));
      const node = document.createElement("div");
      node.className = `streak-step${stepValue > 0 ? " active" : ""}`;
      node.innerHTML = `<span>${WEEKDAY_NAMES[dayIndex]}</span><strong>${stepValue}</strong>`;
      els.streakTimeline.appendChild(node);
    }
  }

  function updateHeader(state) {
    if (els.headerRank) {
      els.headerRank.textContent = getRankName(state.totalXp);
    }
    if (els.headerMeta?.length >= 3) {
      els.headerMeta[0].textContent = String(state.totalXp);
      els.headerMeta[1].textContent = String(calcLevel(state.totalXp));
      els.headerMeta[2].textContent = getNextRank(state.totalXp);
    }
    if (els.headerProgressBar) {
      const progressFraction = Math.min(1, ((state.totalXp % 1500) / 1500));
      els.headerProgressBar.style.width = `${Math.round(progressFraction * 100)}%`;
    }
  }

  function updateFocusMode(state) {
    if (!els.shell) return;
    if (state.focusMode) {
      els.shell.classList.add("focus-mode-on");
      els.focusToggle?.classList.add("active");
    } else {
      els.shell.classList.remove("focus-mode-on");
      els.focusToggle?.classList.remove("active");
    }
    if (els.focusToggle) {
      const stateLabel = els.focusToggle.querySelector(".focus-toggle__state");
      if (stateLabel) {
        stateLabel.textContent = state.focusMode ? "On" : "Off";
      }
    }
  }

  function renderFeedback(state, doneCount) {
    if (!els.feedbackPercent) return;
    const progress = Math.min(1, 0.35 + (doneCount / 3) * 0.55);
    els.feedbackPercent.textContent = `${Math.round(progress * 100)}%`;
  }

  function hideSkeleton() {
    if (!els.skeleton) return;
    els.skeleton.classList.add("is-hidden");
  }

  function showSkeleton() {
    if (!els.skeleton) return;
    els.skeleton.classList.remove("is-hidden");
  }

  function updateBadgeStatus(state) {
    state.badges = state.badges.map((badge) => {
      let status = "locked";
      if (badge.type === "streak") {
        status = (state.streak || 0) >= badge.threshold ? "earned" : "active";
      } else if (badge.type === "xp") {
        status = (state.totalXp || 0) >= badge.threshold ? "earned" : "active";
      } else if (badge.type === "matches") {
        status = (state.matchesCount || 0) >= badge.threshold ? "earned" : "active";
      }
      return { ...badge, status };
    });
  }

  function completeDayCore(state) {
    const day = todayKey();
    const tasks = state.daily?.tasks || [];
    const done = new Set(state.daily?.doneIds || []);
    const doneCount = tasks.filter((task) => done.has(task.id)).length;
    const gainedXp = tasks
      .filter((task) => done.has(task.id))
      .reduce((sum, task) => sum + getScaledXp(task.xp, state.difficulty), 0);

    if (doneCount < tasks.length) {
      return { state, msg: "Noch nicht alles erledigt", gainedXp: 0 };
    }
    if (state.lastCompletedDay === day) {
      return { state, msg: "Heute schon abgeschlossen", gainedXp: 0 };
    }

    state.totalXp = (state.totalXp || 0) + gainedXp;
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yKey = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;
    if (state.lastCompletedDay === yKey) {
      state.streak = (state.streak || 0) + 1;
    } else {
      state.streak = 1;
    }
    state.lastCompletedDay = day;
    state.updatedAtMs = nowMs();

    return { state, msg: `Day complete ✓ +${gainedXp} XP`, gainedXp };
  }

  async function completeDay() {
    if (!currentState) return;
    const res = completeDayCore(currentState);
    currentState = res.state;
    if (res.gainedXp > 0) {
      recordSession("Daily Completion", res.gainedXp, "Daily");
      currentState.monthly.progress = Math.min(1, (currentState.monthly.progress || 0.5) + 0.05);
      currentState.monthly.streakDays = currentState.streak;
      currentState.monthly.previousDayXp = res.gainedXp;
    }
    saveLocal(currentState);
    renderAll(currentState);
    syncCloud();
    if (res.msg && window.notify?.show) {
      window.notify.show({
        type: "success",
        title: "Daily Quest",
        message: res.msg,
        duration: 4000,
      });
    }
  }

  async function reroll() {
    if (!currentState) return;
    const day = todayKey();
    const tasks = pick3Unique(TASK_POOL).map((task, idx) => ({
      id: `${day}_${idx}_${String(task.title).replace(/\s+/g, "_")}`,
      ...task,
    }));
    currentState.daily = { day, tasks, doneIds: [] };
    currentState.updatedAtMs = nowMs();
    saveLocal(currentState);
    renderAll(currentState);
    syncCloud();
  }

  async function hardReset() {
    const confirmed = await window.echtluckyModal?.confirm({
      title: "Ranked Reset",
      message: "Alles zurücksetzen? (XP, Streak, History)",
      confirmText: "Ja, reset",
      cancelText: "Abbrechen",
      type: "danger",
    });
    if (!confirmed) return;
    currentState = normalizeState({});
    currentState.history = cloneHistoryTemplate();
    currentState.badges = cloneBadgesTemplate();
    currentState.weeklyChallenges = cloneWeeklyTemplate();
    currentState.monthly = { progress: 0.54, streakDays: 14, previousDayXp: 0 };
    currentState.matchesCount = 0;
    localStorage.removeItem(LS_KEY);
    saveLocal(currentState);
    renderAll(currentState);
    syncCloud();
  }

  function recordSession(label, xp, type = "Session") {
    if (!currentState) return;
    const session = {
      id: `session_${nowMs()}`,
      label,
      xp,
      type,
      ts: nowMs(),
    };
    currentState.history = [session, ...(currentState.history || [])].slice(0, 10);
    currentState.matchesCount = (currentState.matchesCount || 0) + 1;
    currentState.updatedAtMs = nowMs();
  }

  function syncCloud() {
    const user = authRef?.currentUser;
    if (!user || !dbRef) return;
    saveCloud(user, currentState);
  }

  async function saveCloud(user, state) {
    if (!user || !dbRef) return;
    try {
      await dbRef.collection("users").doc(user.uid).set(
        {
          [CLOUD_FIELD]: state,
          rankedUpdatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    } catch (error) {
      console.warn("Ranked cloud save failed", error);
    }
  }

  async function loadCloud(user) {
    if (!user || !dbRef) return null;
    try {
      const snap = await dbRef.collection("users").doc(user.uid).get();
      if (!snap.exists) return null;
      const data = snap.data() || {};
      return data[CLOUD_FIELD] || null;
    } catch {
      return null;
    }
  }

  async function init() {
    showSkeleton();
    let state = normalizeState(loadLocal());
    saveLocal(state);
    const user = authRef?.currentUser;
    if (user && dbRef) {
      const cloudStateRaw = await loadCloud(user);
      if (cloudStateRaw && typeof cloudStateRaw === "object" && (cloudStateRaw.updatedAtMs || 0) > (state.updatedAtMs || 0)) {
        state = normalizeState(cloudStateRaw);
        saveLocal(state);
      } else if (cloudStateRaw) {
        await saveCloud(user, state);
      } else {
        await saveCloud(user, state);
      }
    }
    renderAll(state);
  }

  els.actions.forEach((button) => {
    button.addEventListener("click", () => {
      const action = button.dataset.action;
      if (action === "complete-day") completeDay();
      else if (action === "reroll") reroll();
      else if (action === "reset") hardReset();
    });
  });

  els.focusToggle?.addEventListener("click", () => {
    if (!currentState) return;
    currentState.focusMode = !currentState.focusMode;
    saveLocal(currentState);
    renderAll(currentState);
    syncCloud();
  });

  els.difficultyButtons.forEach((button) => {
    button.addEventListener("click", () => {
      if (!currentState) return;
      els.difficultyButtons.forEach((btn) => btn.classList.remove("active"));
      button.classList.add("active");
      const key = button.textContent?.trim().toLowerCase();
      const difficulty = DIFFICULTY_CONFIG[key] ? key : "normal";
      currentState.difficulty = difficulty;
      saveLocal(currentState);
      renderAll(currentState);
      syncCloud();
    });
  });

  els.weeklyNotes?.addEventListener("input", (event) => {
    if (!currentState) return;
    currentState.weeklyNotes = event.target.value;
    saveLocal(currentState);
  });

  els.addSessionBtn?.addEventListener("click", () => {
    const xp = Math.round(12 + Math.random() * 18);
    recordSession("Custom Session", xp, "Custom");
    saveLocal(currentState);
    renderAll(currentState);
    syncCloud();
  });

    function refreshDifficultyButtons(state) {
    if (!els.difficultyButtons?.length) return;
    els.difficultyButtons.forEach((button) => {
      const key = button.textContent?.trim().toLowerCase();
      button.classList.toggle("active", key === (state.difficulty || "normal"));
    });
  }

  function renderCompare(state, xpGain) {
    const previous = state.monthly.previousDayXp || 0;
    const deltaValue = xpGain - previous;
    if (els.compareToday) {
      els.compareToday.textContent = `+${xpGain} XP`;
    }
    if (els.compareYesterday) {
      els.compareYesterday.textContent = `+${previous} XP`;
    }
    if (els.compareDelta) {
      els.compareDelta.textContent = `${deltaValue >= 0 ? "+" : ""}${deltaValue} XP`;
    }
  }

  document.addEventListener("DOMContentLoaded", init);
  if (authRef?.onAuthStateChanged) {
    authRef.onAuthStateChanged(() => init());
  }
})();





