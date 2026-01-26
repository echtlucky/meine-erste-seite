/* =========================
   ranked.js — echtlucky (v2)
   Daily Challenge + Streak + XP/Level
   Storage:
   - default: localStorage
   - wenn eingeloggt: sync in Firestore users/{uid}.rankedState
========================= */

(() => {
  "use strict";

  const LS_KEY = "echtlucky_ranked_v2";
  const CLOUD_FIELD = "rankedState";

  // ✅ 30 Tasks (10 alt + 20 neu)
  const TASK_POOL = [
    // --- Original 10
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

    // --- +20 NEU
    { title: "Pre-Aim Routes", desc: "10 Min: 3 typische Pre-Aim Lines pro Map spotten.", xp: 40 },
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

  // Firebase (optional)
  const authRef = window.echtlucky?.auth || window.auth || null;
  const dbRef = window.echtlucky?.db || window.db || null;

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

  function safeJsonParse(s) {
    try { return JSON.parse(s || "{}"); } catch { return {}; }
  }

  function loadLocal() {
    return safeJsonParse(localStorage.getItem(LS_KEY));
  }

  function saveLocal(state) {
    localStorage.setItem(LS_KEY, JSON.stringify(state));
  }

  async function loadCloud(user) {
    if (!dbRef || !user?.uid) return null;
    try {
      const snap = await dbRef.collection("users").doc(user.uid).get();
      if (!snap.exists) return null;
      const data = snap.data() || {};
      return data[CLOUD_FIELD] || null;
    } catch {
      return null;
    }
  }

  async function saveCloud(user, state) {
    if (!dbRef || !user?.uid) return;
    try {
      await dbRef.collection("users").doc(user.uid).set(
        {
          [CLOUD_FIELD]: state,
          rankedUpdatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    } catch {
      // silent: bleibt dann halt lokal
    }
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
    return Math.max(1, Math.floor((totalXp || 0) / 250) + 1);
  }

  function normalizeState(s) {
    const day = todayKey();
    const state = s && typeof s === "object" ? s : {};

    state.totalXp = Number(state.totalXp || 0);
    state.streak = Number(state.streak || 0);
    state.lastCompletedDay = state.lastCompletedDay || null;
    state.updatedAtMs = Number(state.updatedAtMs || 0);

    if (!state.daily || state.daily.day !== day) {
      const picked = pick3Unique(TASK_POOL).map((t, idx) => ({
        id: `${day}_${idx}_${String(t.title).replace(/\s+/g, "_")}`,
        ...t,
      }));
      state.daily = { day, tasks: picked, doneIds: [] };
      state.updatedAtMs = nowMs();
    }

    if (!Array.isArray(state.daily.tasks)) state.daily.tasks = [];
    if (!Array.isArray(state.daily.doneIds)) state.daily.doneIds = [];

    return state;
  }

  function render(state, mode = "local") {
    const day = todayKey();
    if (els.todayLabel) els.todayLabel.textContent = `Daily • ${day}`;

    const tasks = state.daily?.tasks || [];
    const done = new Set(state.daily?.doneIds || []);
    const doneCount = tasks.filter((t) => done.has(t.id)).length;

    const gainedXp = tasks
      .filter((t) => done.has(t.id))
      .reduce((sum, t) => sum + (t.xp || 0), 0);

    if (els.streakValue) els.streakValue.textContent = String(state.streak || 0);
    if (els.xpValue) els.xpValue.textContent = String(state.totalXp || 0);
    if (els.levelValue) els.levelValue.textContent = String(calcLevel(state.totalXp || 0));

    if (els.progressText) els.progressText.textContent = `${doneCount}/3 erledigt`;
    if (els.xpText) els.xpText.textContent = `+${gainedXp} XP`;

    const pct = Math.round((doneCount / 3) * 100);
    if (els.progressBar) els.progressBar.style.width = `${pct}%`;

    if (els.taskList) {
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
        btn.addEventListener("click", async () => {
          const s = normalizeState(loadLocal());
          const doneSet = new Set(s.daily?.doneIds || []);
          if (doneSet.has(t.id)) doneSet.delete(t.id);
          else doneSet.add(t.id);

          s.daily.doneIds = Array.from(doneSet);
          s.updatedAtMs = nowMs();
          saveLocal(s);

          // cloud mirror wenn logged in
          const u = authRef?.currentUser;
          if (u) await saveCloud(u, s);

          render(s, u ? "cloud" : "local");
        });

        els.taskList.appendChild(item);
      });
    }

    // Footer Text updaten ohne HTML ändern
    const footerHint = document.querySelector(".ranked-footer__left span:last-child");
    if (footerHint) {
      footerHint.textContent =
        mode === "cloud"
          ? "Eingeloggt → Fortschritt wird gespeichert ✅"
          : "Nicht eingeloggt → lokal gespeichert (Login optional).";
    }
  }

  function completeDayCore(state) {
    const day = todayKey();
    if (!state.daily || state.daily.day !== day) return { state, msg: null };

    const tasks = state.daily.tasks || [];
    const done = new Set(state.daily.doneIds || []);
    const doneCount = tasks.filter((t) => done.has(t.id)).length;

    if (doneCount < 3) return { state, msg: "Noch nicht alles erledigt 😤" };
    if (state.lastCompletedDay === day) return { state, msg: "Heute schon completed ✅" };

    const gainedXp = tasks.reduce((sum, t) => sum + (t.xp || 0), 0);
    state.totalXp = (state.totalXp || 0) + gainedXp;

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yKey = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;

    if (state.lastCompletedDay === yKey) state.streak = (state.streak || 0) + 1;
    else state.streak = 1;

    state.lastCompletedDay = day;
    state.updatedAtMs = nowMs();

    return { state, msg: `Day complete ✅ +${gainedXp} XP` };
  }

  async function completeDay() {
    const s = normalizeState(loadLocal());
    const res = completeDayCore(s);
    saveLocal(res.state);

    const u = authRef?.currentUser;
    if (u) await saveCloud(u, res.state);

    render(res.state, u ? "cloud" : "local");
    if (res.msg) {
      if (window.notify?.show) {
        window.notify.show({
          type: "success",
          title: "Task abgeschlossen",
          message: res.msg,
          duration: 4500
        });
      } else {
        if (window.notify) {
          window.notify.show({
            type: "info",
            title: "Ranked",
            message: res.msg,
            duration: 4000
          });
        }
      }
    }
  }

  async function reroll() {
    const day = todayKey();
    const s = normalizeState(loadLocal());

    const picked = pick3Unique(TASK_POOL).map((t, idx) => ({
      id: `${day}_${idx}_${String(t.title).replace(/\s+/g, "_")}`,
      ...t,
    }));

    s.daily = { day, tasks: picked, doneIds: [] };
    s.updatedAtMs = nowMs();
    saveLocal(s);

    const u = authRef?.currentUser;
    if (u) await saveCloud(u, s);

    render(s, u ? "cloud" : "local");
  }

  async function hardReset() {
    const confirmed = await echtluckyModal.confirm({
      title: "Ranked Stats zurücksetzen",
      message: "Möchtest du wirklich alles zurücksetzen? (Streak, XP, Daily Quests)",
      confirmText: "Ja, alles zurücksetzen",
      cancelText: "Abbrechen",
      type: "danger"
    });

    if (!confirmed) return;

    localStorage.removeItem(LS_KEY);

    const s = normalizeState({});
    saveLocal(s);

    const u = authRef?.currentUser;
    if (u) await saveCloud(u, s);

    render(s, u ? "cloud" : "local");
  }

  // ✅ Init: merge cloud->local, aber nur wenn cloud neuer ist
  async function init() {
    let localState = normalizeState(loadLocal());
    saveLocal(localState);

    const u = authRef?.currentUser;
    if (u && dbRef) {
      const cloudStateRaw = await loadCloud(u);
      if (cloudStateRaw && typeof cloudStateRaw === "object") {
        const cloudState = normalizeState(cloudStateRaw);

        // Wenn cloud neuer ist -> local überschreiben
        if ((cloudState.updatedAtMs || 0) > (localState.updatedAtMs || 0)) {
          localState = cloudState;
          saveLocal(localState);
        } else {
          // local neuer -> cloud updaten
          await saveCloud(u, localState);
        }
      } else {
        // Noch nichts in cloud -> initial push
        await saveCloud(u, localState);
      }

      render(localState, "cloud");
    } else {
      render(localState, "local");
    }
  }

  // Wire
  els.completeBtn?.addEventListener("click", completeDay);
  els.rerollBtn?.addEventListener("click", reroll);
  els.resetBtn?.addEventListener("click", hardReset);

  // Re-init wenn User sich auf der Seite einloggt/ausloggt
  if (authRef?.onAuthStateChanged) {
    authRef.onAuthStateChanged(() => init());
  } else {
    init();
  }
})();