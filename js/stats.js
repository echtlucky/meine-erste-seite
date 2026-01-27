(() => {
  "use strict";

  if (window.__ECHTLUCKY_STATS_V2_LOADED__) return;
  window.__ECHTLUCKY_STATS_V2_LOADED__ = true;

  const LS = {
    rankedV2: "echtlucky_ranked_v2",
    rankedV1: "echtlucky_ranked_v1",
    reflexV3: "echtlucky_reflex_v3",
    reflexV2: "echtlucky_reflex_v2",
    focusSessions: "echtlucky:focus:sessions:v1",
    focusSettings: "echtlucky:focus:settings:v1",
    notes: "echtlucky:stats:notes:v1",
  };

  const el = (id) => document.getElementById(id);

  const ui = {
    rankValue: el("statsRankValue"),
    streakValue: el("statsStreakValue"),
    focusValue: el("statsFocusValue"),

    xpWeekTitle: el("xpWeekTitle"),
    xpTodayDelta: el("xpTodayDelta"),
    xpTodayFill: el("xpTodayFill"),
    xpSpark: el("xpSpark"),

    skillAimFill: el("skillAimFill"),
    skillAimValue: el("skillAimValue"),
    skillGamesenseFill: el("skillGamesenseFill"),
    skillGamesenseValue: el("skillGamesenseValue"),
    skillConsistencyFill: el("skillConsistencyFill"),
    skillConsistencyValue: el("skillConsistencyValue"),

    streakPill: el("statsStreakPill"),
    streakRows: el("streakRows"),
    streakFoot: el("streakFoot"),

    heatmap: el("heatmap"),

    compareTodayValue: el("compareTodayValue"),
    compareYesterdayValue: el("compareYesterdayValue"),
    compareFoot: el("compareFoot"),

    btnAddNote: el("btnAddNote"),
    noteList: el("noteList"),
  };

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }

  function safeJsonParse(raw, fallback) {
    try {
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  }

  function todayKey(d = new Date()) {
    return d.toISOString().slice(0, 10);
  }

  function fmtInt(n) {
    const v = Number(n || 0);
    return Number.isFinite(v) ? Math.round(v).toString() : "0";
  }

  function escapeHtml(s) {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function readRanked() {
    const rawV2 = safeJsonParse(localStorage.getItem(LS.rankedV2) || "null", null);
    const rawV1 = safeJsonParse(localStorage.getItem(LS.rankedV1) || "null", null);

    const v2 = rawV2 && typeof rawV2 === "object" ? rawV2 : null;
    const v1 = rawV1 && typeof rawV1 === "object" ? rawV1 : null;

    const totalXp = Number((v2?.totalXp ?? v1?.totalXp) || 0);
    const streak = Number((v2?.streak ?? v1?.streak) || 0);
    const lastCompletedDay = v2?.lastCompletedDay ?? v1?.lastCompletedDay ?? null;

    const history = Array.isArray(v2?.history)
      ? v2.history
          .map((h) => ({
            ts: Number(h?.ts || 0),
            xp: Number(h?.xp || 0),
            label: String(h?.label || ""),
          }))
          .filter((h) => Number.isFinite(h.ts) && h.ts > 0 && Number.isFinite(h.xp))
      : [];

    return { totalXp, streak, lastCompletedDay, history, hasV2: !!v2 };
  }

  function readReflex() {
    const rawV3 = safeJsonParse(localStorage.getItem(LS.reflexV3) || "null", null);
    const rawV2 = safeJsonParse(localStorage.getItem(LS.reflexV2) || "null", null);
    const v3 = rawV3 && typeof rawV3 === "object" ? rawV3 : null;
    const v2 = rawV2 && typeof rawV2 === "object" ? rawV2 : null;

    const bestMs = Number((v3?.bestMs ?? v2?.bestMs) ?? NaN);
    const bestAvgMs = Number((v3?.bestAvgMs ?? v2?.bestAvgMs) ?? NaN);
    return { bestMs, bestAvgMs };
  }

  function readFocus() {
    const sessions = safeJsonParse(localStorage.getItem(LS.focusSessions) || "[]", []);
    const settings = safeJsonParse(localStorage.getItem(LS.focusSettings) || "{}", {});

    return {
      sessions: Array.isArray(sessions) ? sessions : [],
      focusMode: settings?.focusMode === true,
    };
  }

  const RANKS = [
    { name: "Bronze", minXp: 0 },
    { name: "Silber", minXp: 400 },
    { name: "Gold", minXp: 900 },
    { name: "Platin", minXp: 1500 },
    { name: "Diamant", minXp: 2200 },
    { name: "Elite", minXp: 3000 },
    { name: "Champion", minXp: 3800 },
    { name: "Unreal", minXp: 4700 },
  ];

  function rankFromXp(totalXp) {
    const xp = Number(totalXp || 0);
    let idx = 0;
    for (let i = 0; i < RANKS.length; i += 1) {
      if (xp >= RANKS[i].minXp) idx = i;
    }

    const current = RANKS[idx];
    const next = RANKS[idx + 1] || null;

    const from = current.minXp;
    const to = next ? next.minXp : current.minXp + 800;
    const pct = next ? clamp((xp - from) / Math.max(1, to - from), 0, 1) : 1;

    return {
      name: current.name,
      nextName: next?.name || null,
      progressPct: pct,
      nextXp: next?.minXp ?? null,
    };
  }

  function bucketXpByDay(history) {
    const out = new Map();
    history.forEach((h) => {
      const d = new Date(h.ts);
      if (Number.isNaN(d.getTime())) return;
      const key = todayKey(d);
      out.set(key, (out.get(key) || 0) + Number(h.xp || 0));
    });
    return out;
  }

  function sumXpSince(history, daysBack) {
    const now = Date.now();
    const from = now - daysBack * 86400_000;
    return history
      .filter((h) => h.ts >= from && h.ts <= now)
      .reduce((a, b) => a + Number(b.xp || 0), 0);
  }

  function focusMinutesForDay(sessions, key) {
    return sessions
      .filter((s) => s?.kind === "focus" && (s?.dayKey || "").startsWith(key))
      .reduce((a, b) => a + Number(b?.durationSec || 0), 0) / 60;
  }

  function aimPercentFromReflex(bestAvgMs) {
    if (!Number.isFinite(bestAvgMs)) return 0.55;
    // 220ms -> 100%, 520ms -> 0%
    const pct = 1 - clamp((bestAvgMs - 220) / 300, 0, 1);
    return clamp(pct, 0.08, 1);
  }

  function gamesensePercentFromXp(xp) {
    const max = RANKS[RANKS.length - 1].minXp;
    return clamp(xp / Math.max(1, max), 0.12, 1);
  }

  function consistencyPercentFromStreak(streakDays) {
    const pct = clamp(Number(streakDays || 0) / 30, 0, 1);
    return clamp(pct, 0.12, 1);
  }

  function setFill(elFill, pct) {
    if (!elFill) return;
    const p = clamp(Number(pct || 0), 0, 1);
    // trigger transitions reliably
    elFill.style.width = "0%";
    requestAnimationFrame(() => {
      elFill.style.width = `${Math.round(p * 1000) / 10}%`;
    });
  }

  function renderSpark(dayTotals) {
    if (!ui.xpSpark) return;
    const keys = Array.from(dayTotals.keys()).sort();
    const last14 = keys.slice(-14);

    const values = last14.map((k) => Number(dayTotals.get(k) || 0));
    const max = Math.max(1, ...values);

    ui.xpSpark.innerHTML = "";

    const points = 40;
    for (let i = 0; i < points; i += 1) {
      const t = i / (points - 1);
      const idx = Math.floor(t * (values.length - 1));
      const v = values.length ? values[idx] : 0;
      const bottom = 8 + Math.round(clamp(v / max, 0, 1) * 86);

      const dot = document.createElement("span");
      dot.className = "spark";
      dot.style.left = `${t * 100}%`;
      dot.style.bottom = `${bottom}px`;
      dot.style.animationDelay = `${i * 0.04}s`;
      ui.xpSpark.appendChild(dot);
    }
  }

  function renderStreakRows(dayTotals) {
    if (!ui.streakRows) return;
    const keys = Array.from(dayTotals.keys()).sort();
    const last7 = keys.slice(-7);
    const rows = last7.map((k) => {
      const d = new Date(`${k}T12:00:00`);
      const label = d.toLocaleDateString("de-DE", { weekday: "short" });
      const xp = Math.round(Number(dayTotals.get(k) || 0));
      return `<div>${escapeHtml(label)} · ${fmtInt(xp)} XP</div>`;
    });

    ui.streakRows.innerHTML = rows.length ? rows.join("") : "<div>—</div>";
  }

  function renderHeatmap(sessions) {
    if (!ui.heatmap) return;

    // 7 columns (Mon..Sun) x 4 rows (Night/Morning/Afternoon/Evening) => 28 cells
    const grid = Array.from({ length: 28 }, () => 0);

    sessions
      .filter((s) => s?.kind === "focus" && s?.startedAt)
      .forEach((s) => {
        const d = new Date(s.startedAt);
        if (Number.isNaN(d.getTime())) return;

        const dayIdx = (d.getDay() + 6) % 7; // Mon=0
        const h = d.getHours();
        const slotIdx = h < 6 ? 0 : h < 12 ? 1 : h < 18 ? 2 : 3;
        const mins = Number(s?.durationSec || 0) / 60;
        const idx = slotIdx * 7 + dayIdx;
        grid[idx] += mins;
      });

    const max = Math.max(1, ...grid);
    ui.heatmap.innerHTML = "";

    for (let i = 0; i < 28; i += 1) {
      const cell = document.createElement("span");
      const v = grid[i];
      const pct = clamp(v / max, 0, 1);
      const alpha = 0.08 + pct * 0.82;
      cell.style.background = `rgba(0, 255, 136, ${alpha.toFixed(3)})`;
      cell.title = `${Math.round(v)} min`;
      ui.heatmap.appendChild(cell);
    }
  }

  function loadNotes() {
    const raw = safeJsonParse(localStorage.getItem(LS.notes) || "[]", []);
    return Array.isArray(raw) ? raw : [];
  }

  function saveNotes(notes) {
    localStorage.setItem(LS.notes, JSON.stringify(notes.slice(0, 150)));
  }

  function renderNotes() {
    if (!ui.noteList) return;
    const notes = loadNotes();
    ui.noteList.innerHTML = "";

    if (!notes.length) {
      ui.noteList.innerHTML = '<div class="note note--empty">Noch keine Notizen.</div>';
      return;
    }

    ui.noteList.innerHTML = notes
      .slice()
      .sort((a, b) => String(b?.at || "").localeCompare(String(a?.at || "")))
      .slice(0, 20)
      .map((n) => {
        const at = n?.at ? new Date(n.at) : null;
        const stamp = at && !Number.isNaN(at.getTime()) ? at.toLocaleString("de-DE") : "";
        return `<div class="note" data-note-id="${escapeHtml(n.id || "")}" title="${escapeHtml(stamp)}">${escapeHtml(
          n.text || ""
        )}</div>`;
      })
      .join("");
  }

  async function addNoteFlow() {
    const promptText = "Notiz (max. 180 Zeichen)";
    let text = "";

    if (window.echtluckyModal?.input) {
      // returns { ok:boolean, value:string }
      const res = await window.echtluckyModal.input({
        title: "Neue Notiz",
        label: promptText,
        placeholder: "Was war heute wichtig?",
        maxLength: 180,
      });
      if (!res?.ok) return;
      text = String(res.value || "").trim();
    } else {
      // eslint-disable-next-line no-alert
      text = String(window.prompt(promptText, "") || "").trim();
    }

    if (!text) return;

    const notes = loadNotes();
    notes.unshift({
      id: `note_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      at: new Date().toISOString(),
      text: text.slice(0, 180),
    });
    saveNotes(notes);
    renderNotes();
  }

  async function deleteNoteFlow(noteId) {
    if (!noteId) return;

    let ok = false;
    if (window.echtluckyModal?.confirm) {
      const res = await window.echtluckyModal.confirm({
        title: "Notiz löschen",
        message: "Willst du diese Notiz wirklich löschen?",
        confirmText: "Löschen",
        cancelText: "Abbrechen",
        danger: true,
      });
      ok = !!res?.ok;
    } else {
      // eslint-disable-next-line no-alert
      ok = window.confirm("Notiz löschen?");
    }

    if (!ok) return;

    const next = loadNotes().filter((n) => String(n?.id || "") !== String(noteId));
    saveNotes(next);
    renderNotes();
  }

  function renderAll() {
    const ranked = readRanked();
    const reflex = readReflex();
    const focus = readFocus();

    const level = Math.max(1, Math.floor(ranked.totalXp / 250) + 1);
    const rankMeta = rankFromXp(ranked.totalXp);

    if (ui.rankValue) {
      const nextPart = rankMeta.nextName ? ` → ${rankMeta.nextName} @ ${rankMeta.nextXp} XP` : "";
      ui.rankValue.textContent = `${rankMeta.name} • ${fmtInt(ranked.totalXp)} XP • Lvl ${level}${nextPart}`;
    }

    if (ui.streakValue) ui.streakValue.textContent = `${fmtInt(ranked.streak)} Tage`;
    if (ui.focusValue) ui.focusValue.textContent = focus.focusMode ? "Aktiv" : "Aus";

    if (ui.streakPill) ui.streakPill.textContent = ranked.streak ? `+${fmtInt(ranked.streak)} Tage` : "0 Tage";

    const dayTotals = bucketXpByDay(ranked.history);
    const today = todayKey();
    const yesterday = todayKey(new Date(Date.now() - 86400_000));
    const todayXp = Number(dayTotals.get(today) || 0);
    const yesterdayXp = Number(dayTotals.get(yesterday) || 0);

    const weekXp = ranked.history.length ? sumXpSince(ranked.history, 7) : 0;
    if (ui.xpWeekTitle) ui.xpWeekTitle.textContent = `+${fmtInt(weekXp)} XP diese Woche`;
    if (ui.xpTodayDelta) ui.xpTodayDelta.textContent = `+${fmtInt(todayXp)} XP`;

    const avgDaily = ranked.history.length ? weekXp / 7 : 0;
    const dayTarget = Math.max(80, Math.round(avgDaily * 1.2) || 250);
    setFill(ui.xpTodayFill, dayTarget ? clamp(todayXp / dayTarget, 0, 1) : 0);

    const aimPct = aimPercentFromReflex(reflex.bestAvgMs);
    const gamesensePct = gamesensePercentFromXp(ranked.totalXp);
    const consistencyPct = consistencyPercentFromStreak(ranked.streak);

    setFill(ui.skillAimFill, aimPct);
    setFill(ui.skillGamesenseFill, gamesensePct);
    setFill(ui.skillConsistencyFill, consistencyPct);

    if (ui.skillAimValue) ui.skillAimValue.textContent = `${Math.round(aimPct * 100)}%`;
    if (ui.skillGamesenseValue) ui.skillGamesenseValue.textContent = `${Math.round(gamesensePct * 100)}%`;
    if (ui.skillConsistencyValue) ui.skillConsistencyValue.textContent = `${Math.round(consistencyPct * 100)}%`;

    renderSpark(dayTotals);
    renderStreakRows(dayTotals);
    renderHeatmap(focus.sessions);

    const todayFocusMin = focusMinutesForDay(focus.sessions, today);
    const yFocusMin = focusMinutesForDay(focus.sessions, yesterday);

    if (ui.compareTodayValue) ui.compareTodayValue.textContent = `Focus ${Math.round(todayFocusMin)}m • XP +${fmtInt(todayXp)}`;
    if (ui.compareYesterdayValue) ui.compareYesterdayValue.textContent = `Focus ${Math.round(yFocusMin)}m • XP +${fmtInt(
      yesterdayXp
    )}`;

    if (ui.compareFoot) {
      const focusDelta = Math.round(todayFocusMin - yFocusMin);
      const xpDelta = Math.round(todayXp - yesterdayXp);
      const fd = focusDelta === 0 ? "±0m" : (focusDelta > 0 ? `+${focusDelta}m` : `${focusDelta}m`);
      const xd = xpDelta === 0 ? "±0 XP" : (xpDelta > 0 ? `+${xpDelta} XP` : `${xpDelta} XP`);
      ui.compareFoot.textContent = `Delta: ${fd} Focus • ${xd} XP`;
    }

    if (ui.streakFoot) {
      const tip =
        ranked.hasV2 && ranked.history.length
          ? `Ziel heute: ~${fmtInt(dayTarget)} XP. Focus: ${Math.round(todayFocusMin)}m.`
          : "Tip: Spiele Ranked, um XP und Streak zu tracken.";
      ui.streakFoot.textContent = tip;
    }

    renderNotes();
  }

  function bindNotes() {
    if (ui.btnAddNote) {
      ui.btnAddNote.addEventListener("click", () => {
        addNoteFlow();
      });
    }

    if (ui.noteList) {
      ui.noteList.addEventListener("contextmenu", (e) => {
        const target = e.target instanceof HTMLElement ? e.target.closest("[data-note-id]") : null;
        if (!target) return;
        e.preventDefault();
        deleteNoteFlow(target.getAttribute("data-note-id") || "");
      });
    }
  }

  bindNotes();
  renderAll();
})();
