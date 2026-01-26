/* =========================
   Reflex Lab — echtlucky (v3 CLEAN)
   FIX:
   - No duplicate UI logic
   - Overlay stable + fullscreen best effort
   - Cursor visible in UI, hidden only in overlay (is-playing)
   - Crosshair STIFF (instant)
   - Cleaner start/exit lifecycle
========================= */

(() => {
  "use strict";

  const LS_KEY = "echtlucky_reflex_v3";

  // Firebase optional
  const authRef = window.echtlucky?.auth || window.auth || null;
  const dbRef   = window.echtlucky?.db   || window.db   || null;

  // ===== DOM (top stats)
  const bestValue   = document.getElementById("bestValue");
  const avgValue    = document.getElementById("avgValue");
  const ratingValue = document.getElementById("ratingValue");

  // Controls
  const btnStart = document.getElementById("btnStart");
  const btnReset = document.getElementById("btnReset");
  const btnHow   = document.getElementById("btnHow");

  const cfgTargets    = document.getElementById("cfgTargets");
  const cfgTargetsVal = document.getElementById("cfgTargetsVal");
  const saveStatus    = document.getElementById("saveStatus");

  const modeBtns  = Array.from(document.querySelectorAll(".mode"));
  const sizeSegs  = Array.from(document.querySelectorAll(".seg[data-size]"));
  const spawnSegs = Array.from(document.querySelectorAll(".seg[data-spawn]"));

  // Overlay
  const overlay   = document.getElementById("gameOverlay");
  const stage     = document.getElementById("stage");
  const crosshair = document.getElementById("crosshair");
  const centerMsg = document.getElementById("centerMsg");
  const btnExit   = document.getElementById("btnExit");

  // HUD
  const hudMode     = document.getElementById("hudMode");
  const hudProgress = document.getElementById("hudProgress");
  const hudLast     = document.getElementById("hudLast");
  const hudBest     = document.getElementById("hudBest");
  const hudAvg      = document.getElementById("hudAvg");

  // Results
  const resultCard   = document.getElementById("resultCard");
  const resultRating = document.getElementById("resultRating");
  const resAvg       = document.getElementById("resAvg");
  const resBest      = document.getElementById("resBest");
  const resCons      = document.getElementById("resCons");
  const resScore     = document.getElementById("resScore");
  const hitChips     = document.getElementById("hitChips");

  // Guard
  if (!btnStart || !overlay || !stage) {
    console.error("Reflex Lab: required DOM missing.");
    return;
  }

  // ===== State
  let mode = "reaction";     // reaction | flick | precision
  let sizeMode = "mixed";    // mixed | large | medium | small
  let spawnMode = "safe";    // safe | full

  let running = false;
  let runTotal = 15;
  let runCount = 0;
  let hitTimes = [];
  let spawnAt = 0;

  let lastPos = { x: 0.5, y: 0.5 };

  // pointer (used for crosshair position)
  const pointer = { x: window.innerWidth / 2, y: window.innerHeight / 2 };

  // ===== Helpers
  function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }
  function nowMs(){ return performance.now(); }

  function msToLabel(ms){
    if (!isFinite(ms)) return "—";
    if (ms >= 1000) return (ms / 1000).toFixed(2) + "s";
    return Math.round(ms) + "ms";
  }

  function loadLS(){
    try { return JSON.parse(localStorage.getItem(LS_KEY) || "{}"); }
    catch { return {}; }
  }

  function saveLS(data){
    localStorage.setItem(LS_KEY, JSON.stringify(data));
  }

  function ratingFromAvg(avgMs){
    if (!isFinite(avgMs)) return { grade:"—", label:"—" };
    if (avgMs <= 220) return { grade:"S+", label:"Godlike" };
    if (avgMs <= 280) return { grade:"S",  label:"Cracked" };
    if (avgMs <= 340) return { grade:"A",  label:"Insane" };
    if (avgMs <= 420) return { grade:"B",  label:"Solid" };
    if (avgMs <= 520) return { grade:"C",  label:"Okay" };
    return { grade:"D", label:"Warmup needed" };
  }

  function calcStats(times){
    if (!times.length) return { avg: NaN, best: NaN, std: NaN, score: 0 };

    const avg = times.reduce((a,b)=>a+b,0) / times.length;
    const best = Math.min(...times);

    const variance = times.reduce((s,t)=> s + Math.pow(t-avg,2), 0) / times.length;
    const std = Math.sqrt(variance);

    const speed = clamp(1000 - avg, 0, 1000);
    const cons  = clamp(600 - std, 0, 600);
    const bonus = (mode === "precision") ? 180 : (mode === "flick") ? 120 : 80;
    const score = Math.round(speed + cons + bonus + times.length * 12);

    return { avg, best, std, score };
  }

  function renderTopStats(){
    const ls = loadLS();
    bestValue.textContent = isFinite(ls.bestMs) ? msToLabel(ls.bestMs) : "—";
    avgValue.textContent  = isFinite(ls.bestAvgMs) ? msToLabel(ls.bestAvgMs) : "—";
    ratingValue.textContent = ratingFromAvg(ls.bestAvgMs).grade;
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
    if (!user || !dbRef || typeof firebase === "undefined") return;

    try {
      await dbRef.collection("users").doc(user.uid).set({
        reflexStats: payload,
        reflexUpdatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
    } catch (e) {
      console.warn("Reflex save failed:", e?.message || e);
    }
  }

  // ===== UI: Slider fill
  function paintTargetsRange(){
    if (!cfgTargets) return;
    const min = Number(cfgTargets.min || 0);
    const max = Number(cfgTargets.max || 100);
    const val = Number(cfgTargets.value || 0);
    const pct = ((val - min) / (max - min)) * 100;
    cfgTargets.style.setProperty("--fill", `${pct}%`);
    if (cfgTargetsVal) cfgTargetsVal.textContent = String(val);
  }

  // ===== Game mechanics
  function clearStage(){
    stage.querySelectorAll(".target").forEach(el => el.remove());
  }

  function sizePx(){
    if (sizeMode === "large") return 76;
    if (sizeMode === "medium") return 54;
    if (sizeMode === "small") return 34;

    // mixed: depends on mode
    const pool =
      mode === "precision" ? [26,28,30,32,34] :
      mode === "flick"     ? [34,40,46,52] :
                             [40,46,52,58,64];

    return pool[Math.floor(Math.random() * pool.length)];
  }

  function spawnPoint(){
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
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist > w * 0.18) break;

        x = pad + Math.random() * (w - pad * 2);
        y = pad + Math.random() * (h - pad * 2);
        tries++;
      }
    }

    lastPos = { x: x / w, y: y / h };
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

    // small pop-in
    t.animate(
      [{ transform: "translate3d(-50%,-50%,0) scale(0.92)", opacity: 0.0 },
       { transform: "translate3d(-50%,-50%,0) scale(1)", opacity: 1.0 }],
      { duration: 110, easing: "cubic-bezier(.2,.9,.2,1)" }
    );

    t.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!running) return;

      const hitMs = nowMs() - spawnAt;
      hitTimes.push(hitMs);

      if (hudLast) hudLast.textContent = "Last: " + msToLabel(hitMs);

      runCount++;
      if (hudProgress) hudProgress.textContent = `${runCount}/${runTotal}`;

      if (runCount >= runTotal) finishRun();
      else nextTarget();
    });

    stage.appendChild(t);
    spawnAt = nowMs();
  }

  function nextTarget(){
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

    // flick / precision: immediate chain
    createTarget();
  }

  function setCenter(title, text){
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

  // ===== Overlay lifecycle
  async function openOverlay(){
    overlay.classList.add("show");
    overlay.classList.add("is-playing");
    overlay.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");

    // fullscreen best effort
    try {
      if (!document.fullscreenElement && overlay.requestFullscreen) {
        await overlay.requestFullscreen();
      }
    } catch (_) {}

    // ensure layout settled before spawn
    await new Promise((r) => requestAnimationFrame(() => r()));
    stage.focus({ preventScroll: true });

    // snap crosshair to center immediately
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    pointer.x = cx; pointer.y = cy;
    setCrosshair(cx, cy);
  }

  async function closeOverlay(){
    running = false;
    clearStage();

    overlay.classList.remove("is-playing");
    overlay.classList.remove("show");
    overlay.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");

    try {
      if (document.fullscreenElement) await document.exitFullscreen();
    } catch (_) {}

    setCenter("Ready?", "Targets erscheinen gleich. Klick so schnell wie möglich.");
  }

  function startRun(){
    running = true;
    runTotal = parseInt(cfgTargets.value, 10) || 15;
    runCount = 0;
    hitTimes = [];

    if (hudProgress) hudProgress.textContent = `0/${runTotal}`;
    if (hudMode) hudMode.textContent = mode[0].toUpperCase() + mode.slice(1);
    if (hudLast) hudLast.textContent = "Last: —";
    if (hudBest) hudBest.textContent = "Best: —";
    if (hudAvg)  hudAvg.textContent  = "Avg: —";

    if (resultCard) resultCard.style.display = "none";

    hideCenter();
    nextTarget();
  }

  function finishRun(){
    running = false;
    clearStage();

    const stats = calcStats(hitTimes);
    if (hudBest) hudBest.textContent = "Best: " + msToLabel(stats.best);
    if (hudAvg)  hudAvg.textContent  = "Avg: "  + msToLabel(stats.avg);

    // save local bests
    const ls = loadLS();
    const improvedBest = !isFinite(ls.bestMs) || stats.best < ls.bestMs;
    const improvedAvg  = !isFinite(ls.bestAvgMs) || stats.avg < ls.bestAvgMs;

    const newLS = {
      ...ls,
      bestMs: improvedBest ? stats.best : ls.bestMs,
      bestAvgMs: improvedAvg ? stats.avg : ls.bestAvgMs,
      lastRun: {
        mode, sizeMode, spawnMode,
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

    // results UI
    const r = ratingFromAvg(stats.avg);
    if (resultCard) resultCard.style.display = "grid";
    if (resultRating) resultRating.textContent = `${r.grade} • ${r.label}`;
    if (resAvg)  resAvg.textContent  = msToLabel(stats.avg);
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

    // notify
    if (window.notify) notify.success(`Run complete • Avg ${msToLabel(stats.avg)}`, "Reflex Lab");
    setCenter("Run complete ✅", "Du kannst erneut starten oder Exit drücken.");
  }

  // ===== Crosshair (STIFF / instant)
  function setCrosshair(x, y){
    if (!crosshair) return;
    crosshair.style.transform =
      `translate3d(${x}px, ${y}px, 0) translate3d(-50%, -50%, 0)`;
  }

  function onPointerMove(e){
    pointer.x = e.clientX;
    pointer.y = e.clientY;

    // update only when overlay visible
    if (overlay.classList.contains("show")) {
      setCrosshair(pointer.x, pointer.y);
    }
  }

  // ===== UI actions
  function setActive(list, btn){
    list.forEach(x => x.classList.remove("is-active"));
    btn.classList.add("is-active");
  }

  function showHow(){
    if (window.notify?.show) {
      window.notify.show({
        type: "info",
        title: "How it works",
        message: "Reaction: Target kommt nach Delay. Flick: sofortige Targets. Precision: kleiner + sweaty. ESC/Exit beendet.",
        duration: 6500
      });
      return;
    }
    
    if (window.notify) {
      window.notify.show({
        type: "info",
        title: "How it works",
        message: "Reaction: Delay • Flick: instant • Precision: kleiner • ESC/Exit beendet",
        duration: 6000
      });
    }
  }

  function resetStats(){
    echtluckyModal.confirm({
      title: "Reflex Stats zurücksetzen",
      message: "Möchtest du alle deine Reflex-Statistiken wirklich zurücksetzen?",
      confirmText: "Ja, zurücksetzen",
      cancelText: "Abbrechen",
      type: "warning"
    }).then(ok => {
      if (!ok) return;

      localStorage.removeItem(LS_KEY);
      renderTopStats();
      if (resultCard) resultCard.style.display = "none";
      if (window.notify) window.notify.show({ type: "success", title: "Reflex Lab", message: "Stats wurden resettet ✅", duration: 4500 });
    });
  }

  // ===== WIRING
  paintTargetsRange();
  cfgTargets.addEventListener("input", paintTargetsRange, { passive: true });

  modeBtns.forEach((b) => {
    b.addEventListener("click", () => {
      if (running) return;
      setActive(modeBtns, b);
      mode = b.dataset.mode;
      if (window.notify) notify.info(`Mode: ${mode}`, "Reflex Lab", 1400);
    });
  });

  sizeSegs.forEach((b) => {
    b.addEventListener("click", () => {
      if (running) return;
      setActive(sizeSegs, b);
      sizeMode = b.dataset.size;
    });
  });

  spawnSegs.forEach((b) => {
    b.addEventListener("click", () => {
      if (running) return;
      setActive(spawnSegs, b);
      spawnMode = b.dataset.spawn;
    });
  });

  btnStart.addEventListener("click", async () => {
    await openOverlay();
    startRun();
  });

  btnExit.addEventListener("click", closeOverlay);
  btnReset.addEventListener("click", resetStats);
  btnHow.addEventListener("click", showHow);

  // pointer tracking (stage + window)
  stage.addEventListener("pointermove", onPointerMove, { passive: true });
  window.addEventListener("pointermove", onPointerMove, { passive: true });
  stage.addEventListener("contextmenu", (e) => e.preventDefault());

  // ESC handling
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && overlay.classList.contains("show")) {
      // allow browser fullscreen exit first
      setTimeout(closeOverlay, 0);
    }
  });

  // Auth save indicator
  if (authRef && typeof authRef.onAuthStateChanged === "function") {
    authRef.onAuthStateChanged(() => updateSaveStatus());
  }

  // Init
  renderTopStats();
  updateSaveStatus();
  setCenter("Ready?", "Targets erscheinen gleich. Klick so schnell wie möglich.");

})();