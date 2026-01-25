/* =========================
   ranked.js — echtlucky
   Daily Challenge + Streak + XP/Level
   Storage: localStorage
========================= */

(() => {
  "use strict";

  const LS_KEY = "echtlucky_ranked_v1";

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

  const els = {
    todayLabel: document.getElementById("todayLabel"),
    taskList: document.getElementById("taskList"),
    progressBar: document.getElementById("progressBar"),
    progressText: document.getElementById("progressText"),
    xpText: document.getElementById("xpText"),

    streakValue: document.getElementById("streakValue"),
    xpValue: document.getElementById("xpValue"),
    levelValue: document.getElementById("levelValue"),

    rerollBtn: document.getElementById("rerollBtn"),
    resetBtn: document.getElementById("resetBtn"),
    completeBtn: document.getElementById("completeBtn"),
  };

  function todayKey() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function loadState() {
    try {
      return JSON.parse(localStorage.getItem(LS_KEY) || "{}");
    } catch {
      return {};
    }
  }

  function saveState(state) {
    localStorage.setItem(LS_KEY, JSON.stringify(state));
  }

  function pick3Unique(pool) {
    const copy = [...pool];
    const picked = [];
    while (picked.length < 3 && copy.length) {
      const idx = Math.floor(Math.random() * copy.length);
      picked.push(copy.splice(idx, 1)[0]);
    }
    return picked;
  }

  function calcLevel(totalXp) {
    // simpel: Level steigt alle 250 XP
    const lvl = Math.max(1, Math.floor((totalXp || 0) / 250) + 1);
    return lvl;
  }

  function render(state) {
    const day = todayKey();
    els.todayLabel.textContent = `Daily • ${day}`;

    const tasks = state.daily?.tasks || [];
    const done = new Set(state.daily?.doneIds || []);
    const doneCount = tasks.filter((t) => done.has(t.id)).length;

    const gainedXp = tasks
      .filter((t) => done.has(t.id))
      .reduce((sum, t) => sum + (t.xp || 0), 0);

    // Stats
    els.streakValue.textContent = String(state.streak || 0);
    els.xpValue.textContent = String(state.totalXp || 0);
    els.levelValue.textContent = String(calcLevel(state.totalXp || 0));

    // Progress
    els.progressText.textContent = `${doneCount}/3 erledigt`;
    els.xpText.textContent = `+${gainedXp} XP`;

    const pct = Math.round((doneCount / 3) * 100);
    els.progressBar.style.width = `${pct}%`;

    // Tasks
    els.taskList.innerHTML = "";
    tasks.forEach((t) => {
      const isDone = done.has(t.id);

      const item = document.createElement("div");
      item.className = "ranked-task";
      item.innerHTML = `
        <div class="ranked-task__left">
          <div class="ranked-task__title">${t.title}</div>
          <div class="ranked-task__desc">${t.desc}</div>
        </div>
        <div class="ranked-task__right">
          <div class="ranked-task__xp">+${t.xp} XP</div>
          <button class="btn ${isDone ? "btn-ghost" : "btn-primary"} btn-sm" type="button">
            ${isDone ? "Done" : "Mark"}
          </button>
        </div>
      `;

      const btn = item.querySelector("button");
      btn.addEventListener("click", () => {
        const s = loadState();
        const doneSet = new Set(s.daily?.doneIds || []);
        if (doneSet.has(t.id)) doneSet.delete(t.id);
        else doneSet.add(t.id);

        s.daily.doneIds = Array.from(doneSet);
        saveState(s);
        render(s);
      });

      els.taskList.appendChild(item);
    });
  }

  function initDaily() {
    const s = loadState();
    const day = todayKey();

    // default base
    s.totalXp = s.totalXp || 0;
    s.streak = s.streak || 0;
    s.lastCompletedDay = s.lastCompletedDay || null;

    // daily reset if date changed
    if (!s.daily || s.daily.day !== day) {
      const picked = pick3Unique(TASK_POOL).map((t, idx) => ({
        id: `${day}_${idx}_${t.title.replace(/\s+/g, "_")}`,
        ...t
      }));
      s.daily = { day, tasks: picked, doneIds: [] };
      saveState(s);
    }

    return s;
  }

  function completeDay() {
    const s = loadState();
    const day = todayKey();

    if (!s.daily || s.daily.day !== day) return;

    const tasks = s.daily.tasks || [];
    const done = new Set(s.daily.doneIds || []);
    const doneCount = tasks.filter((t) => done.has(t.id)).length;

    if (doneCount < 3) return alert("Noch nicht alles erledigt 😤");

    // XP add once per day
    if (s.lastCompletedDay === day) return alert("Heute schon completed ✅");

    const gainedXp = tasks.reduce((sum, t) => sum + (t.xp || 0), 0);
    s.totalXp = (s.totalXp || 0) + gainedXp;

    // streak logic
    // wenn gestern completed → streak++
    // sonst streak = 1
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yKey = `${yesterday.getFullYear()}-${String(yesterday.getMonth()+1).padStart(2,"0")}-${String(yesterday.getDate()).padStart(2,"0")}`;

    if (s.lastCompletedDay === yKey) s.streak = (s.streak || 0) + 1;
    else s.streak = 1;

    s.lastCompletedDay = day;
    saveState(s);
    render(s);
    alert(`Day complete ✅ +${gainedXp} XP`);
  }

  function reroll() {
    const s = loadState();
    const day = todayKey();

    const picked = pick3Unique(TASK_POOL).map((t, idx) => ({
      id: `${day}_${idx}_${t.title.replace(/\s+/g, "_")}`,
      ...t
    }));

    s.daily = { day, tasks: picked, doneIds: [] };
    saveState(s);
    render(s);
  }

  function hardReset() {
    if (!confirm("Wirklich alles resetten? (Streak/XP/Daily)")) return;
    localStorage.removeItem(LS_KEY);
    const s = initDaily();
    render(s);
  }

  // Wire
  els.completeBtn?.addEventListener("click", completeDay);
  els.rerollBtn?.addEventListener("click", reroll);
  els.resetBtn?.addEventListener("click", hardReset);

  // Init
  const state = initDaily();
  render(state);
})();