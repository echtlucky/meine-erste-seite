/* =========================
   Reflex Lab — echtlucky
   - Crosshair only (cursor hidden)
   - 3 Modes: Reaction / Flick / Precision
   - Smooth target spawn + time measurement
   - Save: localStorage always, Firestore if logged in
========================= */

(() => {
  "use strict";

  const LS_KEY = "echtlucky_reflex_v1";

  // Firebase optional (works without login)
  const authRef = window.echtlucky?.auth || window.auth || null;
  const dbRef   = window.echtlucky?.db   || window.db   || null;

  // DOM
  const stage = document.getElementById("stage");
  const crosshair = document.getElementById("crosshair");
  const centerMsg = document.getElementById("centerMsg");

  const bestValue = document.getElementById("bestValue");
  const avgValue = document.getElementById("avgValue");
  const ratingValue = document.getElementById("ratingValue");

  const hudMode = document.getElementById("hudMode");
  const hudProgress = document.getElementById("hudProgress");
  const hudLast = document.getElementById("hudLast");
  const hudBest = document.getElementById("hudBest");
  const hudAvg = document.getElementById("hudAvg");

  const btnStart = document.getElementById("btnStart");
  const btnReset = document.getElementById("btnReset");
  const btnHow = document.getElementById("btnHow");

  const cfgTargets = document.getElementById("cfgTargets");
  const cfgTargetsVal = document.getElementById("cfgTargetsVal");
  const cfgSize = document.getElementById("cfgSize");
  const cfgSpawn = document.getElementById("cfgSpawn");
  const saveStatus = document.getElementById("saveStatus");

  const modeBtns = Array.from(document.querySelectorAll(".mode"));

  const resultCard = document.getElementById("resultCard");
  const resultRating = document.getElementById("resultRating");
  const resAvg = document.getElementById("resAvg");
  const resBest = document.getElementById("resBest");
  const resCons = document.getElementById("resCons");
  const resScore = document.getElementById("resScore");
  const hitChips = document.getElementById("hitChips");

  // Crosshair dot (optional)
  if (crosshair && !crosshair.querySelector(".dot")) {
    const d = document.createElement("div");
    d.className = "dot";
    crosshair.appendChild(d);
  }

  // State
  let mode = "reaction";
  let running = false;

  let runTotal = 15;
  let runCount = 0;

  let hitTimes = []; // ms per hit
  let currentSpawnAt = 0;

  let lastPos = { x: 0.5, y: 0.5 }; // for "safe" spawn

  // Smooth crosshair tracking
  let pointer = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  let cross = { x: pointer.x, y: pointer.y };

  function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }

  function nowMs() {
    return performance.now();
  }

  function msToLabel(ms){
    if (!isFinite(ms)) return "—";
    if (ms >= 1000) return (ms/1000).toFixed(2) + "s";
    return Math.round(ms) + "ms";
  }

  function loadLS(){
    try { return JSON.parse(localStorage.getItem(LS_KEY) || "{}"); }
    catch { return {}; }
  }

  function saveLS(data){
    localStorage.setItem(LS_KEY, JSON.stringify(data));
  }

  function getRating(avgMs){
    if (!isFinite(avgMs)) return { label:"—", grade:"—" };
    // Simple & fun
    if (avgMs <= 220) return { label:"Godlike", grade:"S+" };
    if (avgMs <= 280) return { label:"Cracked", grade:"S" };
    if (avgMs <= 340) return { label:"Insane", grade:"A" };
    if (avgMs <= 420) return { label:"Solid", grade:"B" };
    if (avgMs <= 520) return { label:"Okay", grade:"C" };
    return { label:"Warmup needed", grade:"D" };
  }

  function calcStats(times){
    if (!times.length) return { avg: NaN, best: NaN, std: NaN, score: 0 };

    const avg = times.reduce((a,b)=>a+b,0) / times.length;
    const best = Math.min(...times);

    // Std dev (consistency)
    const varr = times.reduce((s,t)=> s + Math.pow(t-avg,2), 0) / times.length;
    const std = Math.sqrt(varr);

    // Score: speed + consistency
    const speed = clamp(1000 - avg, 0, 1000);       // lower avg -> higher
    const cons  = clamp(600 - std, 0, 600);         // lower std -> higher
    const sizeBonus = (mode === "precision") ? 180 : (mode === "flick") ? 120 : 80;
    const score = Math.round(speed + cons + sizeBonus + times.length * 12);

    return { avg, best, std, score };
  }

  function renderTopStats(){
    const ls = loadLS();
    const best = ls?.bestMs;
    const avg  = ls?.bestAvgMs;

    bestValue.textContent = isFinite(best) ? msToLabel(best) : "—";
    avgValue.textContent  = isFinite(avg) ? msToLabel(avg) : "—";

    const r = getRating(avg);
    ratingValue.textContent = r.grade;
  }

  function updateSaveStatus(){
    const user = window.__ECHTLUCKY_CURRENT_USER__ || null;
    if (user && dbRef) {
      saveStatus.textContent = "Account";
      saveStatus.style.borderColor = "rgba(0,255,136,0.22)";
    } else {
      saveStatus.textContent = "Local";
      saveStatus.style.borderColor = "rgba(255,255,255,0.12)";
    }
  }

  // Firestore save: store inside users doc (Rules-friendly)
  async function saveToAccountIfLoggedIn(payload){
    const user = window.__ECHTLUCKY_CURRENT_USER__ || null;
    if (!user || !dbRef) return;

    try {
      // write into users/{uid} (merge) => allowed by your rules (self update, role unchanged)
      await dbRef.collection("users").doc(user.uid).set({
        reflexStats: payload,
        reflexUpdatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
    } catch (e) {
      // fail silently (local always works)
      console.warn("Reflex save failed:", e?.message || e);
    }
  }

  function clearStage(){
    stage.querySelectorAll(".target").forEach(t => t.remove());
  }

  function sizePx(){
    const preset = cfgSize.value;
    if (preset === "large") return 74;
    if (preset === "medium") return 54;
    if (preset === "small") return 34;

    // mixed
    const pool = (mode === "precision")
      ? [28, 30, 32, 34, 36]
      : (mode === "flick")
      ? [34, 40, 46, 52]
      : [40, 46, 52, 58, 64];

    return pool[Math.floor(Math.random() * pool.length)];
  }

  function spawnPoint(){
    // stage rect
    const r = stage.getBoundingClientRect();
    const pad = 40;

    let x = pad + Math.random() * (r.width - pad*2);
    let y = pad + Math.random() * (r.height - pad*2);

    if (cfgSpawn.value === "safe") {
      // keep some distance from last position
      const lx = lastPos.x * r.width;
      const ly = lastPos.y * r.height;

      let tries = 0;
      while (tries < 12) {
        const dx = x - lx;
        const dy = y - ly;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist > r.width * 0.18) break;
        x = pad + Math.random() * (r.width - pad*2);
        y = pad + Math.random() * (r.height - pad*2);
        tries++;
      }
    }

    lastPos = { x: x / r.width, y: y / r.height };
    return { x, y };
  }

  function createTarget(){
    clearStage();

    const s = sizePx();
    const p = spawnPoint();

    const t = document.createElement("div");
    t.className = "target";
    t.style.width = s + "px";
    t.style.height = s + "px";
    t.style.left = p.x + "px";
    t.style.top = p.y + "px";

    // For feel: tiny pop-in
    t.animate(
      [{ transform: "translate3d(-50%,-50%,0) scale(0.92)", opacity: 0.0 },
       { transform: "translate3d(-50%,-50%,0) scale(1)", opacity: 1.0 }],
      { duration: 120, easing: "cubic-bezier(.2,.9,.2,1)" }
    );

    t.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!running) return;

      const hitMs = nowMs() - currentSpawnAt;
      hitTimes.push(hitMs);

      hudLast.textContent = "Last: " + msToLabel(hitMs);

      runCount++;
      hudProgress.textContent = `${runCount}/${runTotal}`;

      // next
      if (runCount >= runTotal) finishRun();
      else nextTarget();
    });

    stage.appendChild(t);
    currentSpawnAt = nowMs();
  }

  function nextTarget(){
    // Mode behavior
    if (mode === "reaction") {
      // spawn after random delay, measure click time from spawn
      clearStage();
      const delay = 250 + Math.random() * 700;
      setTimeout(() => {
        if (!running) return;
        createTarget();
      }, delay);
      return;
    }

    // flick / precision = instant spawn
    createTarget();
  }

  function startRun(){
    running = true;
    runTotal = parseInt(cfgTargets.value, 10) || 15;
    runCount = 0;
    hitTimes = [];
    hudProgress.textContent = `0/${runTotal}`;
    hudMode.textContent = mode[0].toUpperCase() + mode.slice(1);
    hudLast.textContent = "Last: —";

    if (centerMsg) centerMsg.style.display = "none";
    if (resultCard) resultCard.style.display = "none";

    stage.focus({ preventScroll: true });
    nextTarget();
  }

  function finishRun(){
    running = false;
    clearStage();

    const stats = calcStats(hitTimes);

    // Update HUD
    hudBest.textContent = "Best: " + msToLabel(stats.best);
    hudAvg.textContent  = "Avg: " + msToLabel(stats.avg);

    // Save bests locally
    const ls = loadLS();
    const improvedBest = !isFinite(ls.bestMs) || stats.best < ls.bestMs;
    const improvedAvg  = !isFinite(ls.bestAvgMs) || stats.avg < ls.bestAvgMs;

    const newLS = {
      ...ls,
      bestMs: improvedBest ? stats.best : ls.bestMs,
      bestAvgMs: improvedAvg ? stats.avg : ls.bestAvgMs,
      lastRun: {
        mode,
        total: runTotal,
        times: hitTimes,
        avgMs: stats.avg,
        bestMs: stats.best,
        stdMs: stats.std,
        score: stats.score,
        at: Date.now()
      }
    };
    saveLS(newLS);

    // Show result card
    const r = getRating(stats.avg);
    if (resultCard) resultCard.style.display = "grid";
    if (resultRating) resultRating.textContent = `${r.grade} • ${r.label}`;
    if (resAvg) resAvg.textContent = msToLabel(stats.avg);
    if (resBest) resBest.textContent = msToLabel(stats.best);
    if (resCons) resCons.textContent = isFinite(stats.std) ? Math.round(stats.std) + "ms" : "—";
    if (resScore) resScore.textContent = String(stats.score);

    if (hitChips){
      hitChips.innerHTML = "";
      hitTimes.slice(0, 60).forEach((t) => {
        const c = document.createElement("div");
        c.className = "chip";
        c.textContent = msToLabel(t);
        hitChips.appendChild(c);
      });
    }

    // Persist to account if logged in
    saveToAccountIfLoggedIn({
      bestMs: newLS.bestMs,
      bestAvgMs: newLS.bestAvgMs,
      lastRun: newLS.lastRun,
    });

    renderTopStats();
  }

  function resetStats(){
    if (!confirm("Reflex Stats wirklich resetten?")) return;
    localStorage.removeItem(LS_KEY);
    hitTimes = [];
    runCount = 0;
    running = false;
    clearStage();
    if (centerMsg) centerMsg.style.display = "flex";
    if (resultCard) resultCard.style.display = "none";
    renderTopStats();
  }

  function showHow(){
    alert(
      "Reflex Lab:\n\n" +
      "• Reaction: Target spawnt nach Delay — klick ASAP.\n" +
      "• Flick: Targets spawnen sofort — pure Flicks.\n" +
      "• Precision: kleinere Targets — Accuracy & Control.\n\n" +
      "Cursor ist unsichtbar, du siehst nur das Crosshair."
    );
  }

  // Crosshair loop (ultra smooth)
  function crosshairLoop(){
    cross.x += (pointer.x - cross.x) * 0.28;
    cross.y += (pointer.y - cross.y) * 0.28;

    if (crosshair){
      crosshair.style.transform = `translate3d(${cross.x}px, ${cross.y}px, 0) translate3d(-50%, -50%, 0)`;
    }
    requestAnimationFrame(crosshairLoop);
  }

  function onPointerMove(e){
    pointer.x = e.clientX;
    pointer.y = e.clientY;
  }

  // Wire config
  cfgTargetsVal.textContent = cfgTargets.value;
  cfgTargets.addEventListener("input", () => {
    cfgTargetsVal.textContent = cfgTargets.value;
    if (!running) hudProgress.textContent = `0/${cfgTargets.value}`;
  });

  // Mode buttons
  modeBtns.forEach((b) => {
    b.addEventListener("click", () => {
      if (running) return;

      modeBtns.forEach(x => x.classList.remove("is-active"));
      b.classList.add("is-active");
      mode = b.dataset.mode;

      hudMode.textContent = mode[0].toUpperCase() + mode.slice(1);

      // hint changes (optional)
      if (centerMsg) {
        centerMsg.style.display = "flex";
      }
    });
  });

  btnStart.addEventListener("click", () => {
    if (running) return;
    startRun();
  });

  btnReset.addEventListener("click", resetStats);
  btnHow.addEventListener("click", showHow);

  // Stage: prevent selection + allow taps
  stage.addEventListener("pointermove", onPointerMove, { passive: true });
  window.addEventListener("pointermove", onPointerMove, { passive: true });

  stage.addEventListener("contextmenu", (e) => e.preventDefault());

  // Auth UI status updates (when login state changes)
  const auth = authRef;
  if (auth && typeof auth.onAuthStateChanged === "function") {
    auth.onAuthStateChanged(() => updateSaveStatus());
  }

  // Init
  renderTopStats();
  updateSaveStatus();
  hudProgress.textContent = `0/${cfgTargets.value}`;
  hudBest.textContent = "Best: —";
  hudAvg.textContent = "Avg: —";
  hudMode.textContent = "Reaction";

  // start crosshair render
  requestAnimationFrame(crosshairLoop);
})();