/* =========================
   Reflex Lab — echtlucky (v2)
   FIX:
   - Cursor sichtbar im UI
   - Cursor hidden only in overlay
   - Start -> fullscreen overlay
   UI:
   - segmented controls for size/spawn
========================= */

(() => {
  "use strict";

  const LS_KEY = "echtlucky_reflex_v2";

  // Firebase optional
  const authRef = window.echtlucky?.auth || window.auth || null;
  const dbRef   = window.echtlucky?.db   || window.db   || null;

  // UI DOM
  const bestValue = document.getElementById("bestValue");
  const avgValue = document.getElementById("avgValue");
  const ratingValue = document.getElementById("ratingValue");

  const btnStart = document.getElementById("btnStart");
  const btnReset = document.getElementById("btnReset");
  const btnHow = document.getElementById("btnHow");

  const cfgTargets = document.getElementById("cfgTargets");
  const cfgTargetsVal = document.getElementById("cfgTargetsVal");
  const saveStatus = document.getElementById("saveStatus");

  const modeBtns = Array.from(document.querySelectorAll(".mode"));
  const sizeSegs = Array.from(document.querySelectorAll(".seg[data-size]"));
  const spawnSegs = Array.from(document.querySelectorAll(".seg[data-spawn]"));

  // Overlay DOM
  const overlay = document.getElementById("gameOverlay");
  const stage = document.getElementById("stage");
  const crosshair = document.getElementById("crosshair");
  const centerMsg = document.getElementById("centerMsg");
  const btnExit = document.getElementById("btnExit");

  const hudMode = document.getElementById("hudMode");
  const hudProgress = document.getElementById("hudProgress");
  const hudLast = document.getElementById("hudLast");
  const hudBest = document.getElementById("hudBest");
  const hudAvg = document.getElementById("hudAvg");

  // Results
  const resultCard = document.getElementById("resultCard");
  const resultRating = document.getElementById("resultRating");
  const resAvg = document.getElementById("resAvg");
  const resBest = document.getElementById("resBest");
  const resCons = document.getElementById("resCons");
  const resScore = document.getElementById("resScore");
  const hitChips = document.getElementById("hitChips");

  // Crosshair dot
  if (crosshair && !crosshair.querySelector(".dot")) {
    const d = document.createElement("div");
    d.className = "dot";
    crosshair.appendChild(d);
  }

  // Game state
  let mode = "reaction";
  let sizeMode = "mixed"; // mixed|large|medium|small
  let spawnMode = "safe"; // safe|full

  let running = false;
  let runTotal = 15;
  let runCount = 0;
  let hitTimes = [];
  let currentSpawnAt = 0;
  let lastPos = { x: 0.5, y: 0.5 };

  // Crosshair tracking
  let pointer = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  let cross = { x: pointer.x, y: pointer.y };

  function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }
  function nowMs(){ return performance.now(); }

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
    const varr = times.reduce((s,t)=> s + Math.pow(t-avg,2), 0) / times.length;
    const std = Math.sqrt(varr);

    const speed = clamp(1000 - avg, 0, 1000);
    const cons  = clamp(600 - std, 0, 600);
    const sizeBonus = (mode === "precision") ? 180 : (mode === "flick") ? 120 : 80;
    const score = Math.round(speed + cons + sizeBonus + times.length * 12);

    return { avg, best, std, score };
  }

  function renderTopStats(){
    const ls = loadLS();
    bestValue.textContent = isFinite(ls?.bestMs) ? msToLabel(ls.bestMs) : "—";
    avgValue.textContent  = isFinite(ls?.bestAvgMs) ? msToLabel(ls.bestAvgMs) : "—";
    const r = getRating(ls?.bestAvgMs);
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

  async function saveToAccountIfLoggedIn(payload){
    const user = window.__ECHTLUCKY_CURRENT_USER__ || null;
    if (!user || !dbRef) return;

    try {
      await dbRef.collection("users").doc(user.uid).set({
        reflexStats: payload,
        reflexUpdatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
    } catch (e) {
      console.warn("Reflex save failed:", e?.message || e);
    }
  }

  function clearStage(){
    stage.querySelectorAll(".target").forEach(t => t.remove());
  }

  function sizePx(){
    if (sizeMode === "large") return 76;
    if (sizeMode === "medium") return 54;
    if (sizeMode === "small") return 34;

    // mixed
    const pool = (mode === "precision")
      ? [26, 28, 30, 32, 34]
      : (mode === "flick")
      ? [34, 40, 46, 52]
      : [40, 46, 52, 58, 64];

    return pool[Math.floor(Math.random() * pool.length)];
  }

  function spawnPoint(){
    const r = stage.getBoundingClientRect();
    const pad = 46;

    let x = pad + Math.random() * (r.width - pad*2);
    let y = pad + Math.random() * (r.height - pad*2);

    if (spawnMode === "safe") {
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

      if (runCount >= runTotal) finishRun();
      else nextTarget();
    });

    stage.appendChild(t);
    currentSpawnAt = nowMs();
  }

  function nextTarget(){
    if (mode === "reaction") {
      clearStage();
      const delay = 260 + Math.random() * 760;
      setTimeout(() => {
        if (!running) return;
        createTarget();
      }, delay);
      return;
    }
    createTarget();
  }

  function setCenterText(title, text){
    if (!centerMsg) return;
    const t = centerMsg.querySelector(".center-title");
    const p = centerMsg.querySelector(".center-text");
    if (t) t.textContent = title;
    if (p) p.textContent = text;
    centerMsg.style.display = "flex";
  }

  function hideCenter(){
    if (centerMsg) centerMsg.style.display = "none";
  }

  async function openOverlay(){
    if (!overlay) return;
    overlay.classList.add("show");
    overlay.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");

    // fullscreen attempt (best effort)
    try {
      if (!document.fullscreenElement) {
        await overlay.requestFullscreen?.();
      }
    } catch (_) {
      // ignore
    }

    stage.focus({ preventScroll: true });
        // place crosshair instantly to current pointer or center
    const cx = pointer.x || (window.innerWidth / 2);
    const cy = pointer.y || (window.innerHeight / 2);
    setCrosshair(cx, cy);
  }

  async function closeOverlay(){
    running = false;
    clearStage();
    if (!overlay) return;

    overlay.classList.remove("show");
    overlay.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");

    // exit fullscreen
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
    } catch (_) {}

    // bring back UI
    setCenterText("Ready?", "Targets erscheinen gleich. Klick so schnell wie möglich.");
  }

  function startRun(){
    running = true;
    runTotal = parseInt(cfgTargets.value, 10) || 15;
    runCount = 0;
    hitTimes = [];

    hudProgress.textContent = `0/${runTotal}`;
    hudMode.textContent = mode[0].toUpperCase() + mode.slice(1);
    hudLast.textContent = "Last: —";
    hudBest.textContent = "Best: —";
    hudAvg.textContent  = "Avg: —";

    if (resultCard) resultCard.style.display = "none";

    hideCenter();
    nextTarget();
  }

  function finishRun(){
    running = false;
    clearStage();

    const stats = calcStats(hitTimes);
    hudBest.textContent = "Best: " + msToLabel(stats.best);
    hudAvg.textContent  = "Avg: " + msToLabel(stats.avg);

    // save local bests
    const ls = loadLS();
    const improvedBest = !isFinite(ls.bestMs) || stats.best < ls.bestMs;
    const improvedAvg  = !isFinite(ls.bestAvgMs) || stats.avg < ls.bestAvgMs;

    const newLS = {
      ...ls,
      bestMs: improvedBest ? stats.best : ls.bestMs,
      bestAvgMs: improvedAvg ? stats.avg : ls.bestAvgMs,
      lastRun: {
        mode,
        sizeMode,
        spawnMode,
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

    // Results UI (outside overlay card)
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

    // account save
    saveToAccountIfLoggedIn({
      bestMs: newLS.bestMs,
      bestAvgMs: newLS.bestAvgMs,
      lastRun: newLS.lastRun,
    });

    renderTopStats();
    setCenterText("Run complete ✅", "Du kannst erneut starten oder Exit drücken.");
  }

  function resetStats(){
    if (!confirm("Reflex Stats wirklich resetten?")) return;
    localStorage.removeItem(LS_KEY);
    renderTopStats();
    if (resultCard) resultCard.style.display = "none";
    alert("Reset done ✅");
  }

  function showHow(){
    alert(
      "Reflex Lab:\n\n" +
      "• Reaction: Target spawnt nach Delay — klick ASAP.\n" +
      "• Flick: Targets spawnen sofort — pure Flicks.\n" +
      "• Precision: kleinere Targets — Accuracy & Control.\n\n" +
      "Start öffnet Fullscreen. Cursor ist nur im Game unsichtbar."
    );
  }

  // Crosshair (STIFF / instant)
  function setCrosshair(x, y){
    if (!crosshair) return;
    crosshair.style.transform =
      `translate3d(${x}px, ${y}px, 0) translate3d(-50%, -50%, 0)`;
  }

    function onPointerMove(e){
    pointer.x = e.clientX;
    pointer.y = e.clientY;

    // only update crosshair when overlay is active
    if (overlay && overlay.classList.contains("show")) {
      setCrosshair(pointer.x, pointer.y);
    }
  }


  // Seg helpers
  function setSegActive(list, matchValue){
    list.forEach(btn => btn.classList.toggle("is-active", btn.dataset.size === matchValue || btn.dataset.spawn === matchValue));
  }

  // Wire config
  cfgTargetsVal.textContent = cfgTargets.value;
  cfgTargets.addEventListener("input", () => {
    cfgTargetsVal.textContent = cfgTargets.value;
  });

  // Modes
  modeBtns.forEach((b) => {
    b.addEventListener("click", () => {
      if (running) return;
      modeBtns.forEach(x => x.classList.remove("is-active"));
      b.classList.add("is-active");
      mode = b.dataset.mode;
    });
  });

  // Size segs
  sizeSegs.forEach((b) => {
    b.addEventListener("click", () => {
      if (running) return;
      sizeMode = b.dataset.size;
      setSegActive(sizeSegs, sizeMode);
    });
  });

  // Spawn segs
  spawnSegs.forEach((b) => {
    b.addEventListener("click", () => {
      if (running) return;
      spawnMode = b.dataset.spawn;
      setSegActive(spawnSegs, spawnMode);
    });
  });

  // Start: open overlay + run
  btnStart.addEventListener("click", async () => {
    await openOverlay();
    startRun();
  });

  btnExit.addEventListener("click", closeOverlay);

  btnReset.addEventListener("click", resetStats);
  btnHow.addEventListener("click", showHow);

  // Stage pointer + prevent context menu
  stage.addEventListener("pointermove", onPointerMove, { passive: true });
  window.addEventListener("pointermove", onPointerMove, { passive: true });
  stage.addEventListener("contextmenu", (e) => e.preventDefault());

  // Exit on ESC
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && overlay.classList.contains("show")) {
      // let browser exit fullscreen then we close overlay
      setTimeout(closeOverlay, 0);
    }
  });

  // Auth save indicator updates
  const auth = authRef;
  if (auth && typeof auth.onAuthStateChanged === "function") {
    auth.onAuthStateChanged(() => updateSaveStatus());
  }

  // Init
  renderTopStats();
  updateSaveStatus();

})();