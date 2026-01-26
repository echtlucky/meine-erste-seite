/* =========================
   account.js — echtlucky
   - zeigt Local + Cloud Stats
   - Sync Buttons (Local -> Cloud, Cloud -> Local)
   - Requires Firebase Auth/Firestore (optional graceful)
========================= */

(() => {
  "use strict";

  // LocalStorage Keys aus deinen bestehenden Systemen
  const LS_RANKED = "echtlucky_ranked_v1";
  const LS_REFLEX = "echtlucky_reflex_v2";

  // Firestore path
  const USER_COLLECTION = "users";

  const auth = window.echtlucky?.auth || window.auth || null;
  const db   = window.echtlucky?.db   || window.db   || null;

  const el = (id) => document.getElementById(id);

  // UI
  const loggedOutCard = el("loggedOutCard");
  const accountGrid   = el("accountGrid");

  const pillStatus  = el("pillStatus");
  const pillProvider= el("pillProvider");
  const pillUpdated = el("pillUpdated");

  const avatarInitial = el("avatarInitial");
  const profileName = el("profileName");
  const profileEmail= el("profileEmail");

  const rankedLevel = el("rankedLevel");
  const rankedXp    = el("rankedXp");
  const rankedMeta  = el("rankedMeta");
  const rankedStreak= el("rankedStreak");

  const reflexAvg   = el("reflexAvg");
  const reflexBest  = el("reflexBest");
  const reflexRating= el("reflexRating");
  const reflexLast  = el("reflexLast");

  const chipSync    = el("chipSync");

  const pvUid       = el("pvUid");
  const pvRanked    = el("pvRanked");
  const pvReflex    = el("pvReflex");
  const pvUpdated   = el("pvUpdated");

  const btnSignOut      = el("btnSignOut");
  const btnUploadLocal  = el("btnUploadLocal");
  const btnDownloadCloud= el("btnDownloadCloud");
  const btnClearLocal   = el("btnClearLocal");
  const btnWipeCloud    = el("btnWipeCloud");

  // Profile Edit Elements
  const profileEditForm = el("profileEditForm");
  const inputDisplayName = el("inputDisplayName");
  const inputAddress = el("inputAddress");
  const inputPhone = el("inputPhone");
  const btnSaveProfile = el("btnSaveProfile");
  const btnCancelEdit = el("btnCancelEdit");
  const profileFormMsg = el("profileFormMsg");

  // Notify wrapper — einheitlich mit notify.js
  function toast(type, msg) {
    if (window.notify?.show) {
      return window.notify.show({
        type: type,
        title: type === "success" ? "Erfolg" : type === "error" ? "Fehler" : "Info",
        message: msg,
        duration: 4500
      });
    }
    // Fallback
    console.log(`[${type.toUpperCase()}] ${msg}`);
  }

  function showFormMsg(text, type = "error") {
    if (!profileFormMsg) return;
    profileFormMsg.textContent = text;
    profileFormMsg.className = `form-msg show ${type}`;
    setTimeout(() => {
      profileFormMsg.className = "form-msg";
    }, 4000);
  }

  function msToLabel(ms) {
    if (!isFinite(ms)) return "—";
    if (ms >= 1000) return (ms / 1000).toFixed(2) + "s";
    return Math.round(ms) + "ms";
  }

  function calcLevel(totalXp) {
    const xp = Number(totalXp || 0);
    return Math.max(1, Math.floor(xp / 250) + 1);
  }

  function safeParse(json) {
    try { return JSON.parse(json); } catch { return null; }
  }

  function readLocalRanked() {
    const raw = localStorage.getItem(LS_RANKED);
    const data = safeParse(raw || "{}") || {};
    const totalXp = Number(data.totalXp || 0);
    const streak  = Number(data.streak || 0);
    const lastCompletedDay = data.lastCompletedDay || null;

    return {
      totalXp,
      level: calcLevel(totalXp),
      streak,
      lastCompletedDay,
      source: raw ? "local" : "none",
    };
  }

  function readLocalReflex() {
    const raw = localStorage.getItem(LS_REFLEX);
    const data = safeParse(raw || "{}") || {};
    const bestMs = Number(data.bestMs);
    const bestAvgMs = Number(data.bestAvgMs);

    // optional lastRun
    const lastRun = data.lastRun || null;

    return {
      bestMs: isFinite(bestMs) ? bestMs : NaN,
      bestAvgMs: isFinite(bestAvgMs) ? bestAvgMs : NaN,
      lastRun,
      source: raw ? "local" : "none",
    };
  }

  function ratingFromAvg(avgMs) {
    if (!isFinite(avgMs)) return { grade: "—", label: "—" };
    if (avgMs <= 220) return { grade: "S+", label: "Godlike" };
    if (avgMs <= 280) return { grade: "S",  label: "Cracked" };
    if (avgMs <= 340) return { grade: "A",  label: "Insane" };
    if (avgMs <= 420) return { grade: "B",  label: "Solid" };
    if (avgMs <= 520) return { grade: "C",  label: "Okay" };
    return { grade: "D", label: "Warmup needed" };
  }

  function setLoggedInUI(user) {
    const display = user.displayName || (user.email ? user.email.split("@")[0] : "User");
    profileName.textContent = display;
    profileEmail.textContent = user.email || "—";
    avatarInitial.textContent = (display?.[0] || "?").toUpperCase();

    pillStatus.textContent = "Status: Eingeloggt";
    pillProvider.textContent = "Login: " + (user.providerData?.[0]?.providerId || "firebase");
  }

  function setLoggedOutUI() {
    pillStatus.textContent = "Status: Nicht eingeloggt";
    pillProvider.textContent = "Login: —";
    pillUpdated.textContent = "Update: —";
  }

  function showLoggedOut() {
    if (loggedOutCard) loggedOutCard.style.display = "block";
    if (accountGrid) accountGrid.style.display = "none";
    setLoggedOutUI();
  }

  function showLoggedIn() {
    if (loggedOutCard) loggedOutCard.style.display = "none";
    if (accountGrid) accountGrid.style.display = "grid";
  }

  function fmtDate(ts) {
    if (!ts) return "—";
    const d = ts instanceof Date ? ts : new Date(ts);
    if (isNaN(d.getTime())) return "—";
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    return `${dd}.${mm}.${yy} ${hh}:${mi}`;
  }

  function renderLocalOnly() {
    const r = readLocalRanked();
    const f = readLocalReflex();
    const fr = ratingFromAvg(f.bestAvgMs);

    rankedLevel.textContent = String(r.level);
    rankedXp.textContent = String(r.totalXp);
    rankedMeta.textContent = r.lastCompletedDay ? `Last complete: ${r.lastCompletedDay}` : "Last complete: —";
    rankedStreak.textContent = `Streak: ${r.streak}`;

    reflexAvg.textContent = msToLabel(f.bestAvgMs);
    reflexBest.textContent = msToLabel(f.bestMs);
    reflexRating.textContent = `Rating: ${fr.grade} • ${fr.label}`;
    reflexLast.textContent = f.lastRun?.at ? `Last run: ${fmtDate(f.lastRun.at)}` : "Last run: —";

    chipSync.textContent = "Sync: Local";
  }

  async function loadCloud(user) {
    if (!db) return null;
    const doc = await db.collection(USER_COLLECTION).doc(user.uid).get();
    return doc.exists ? doc.data() : null;
  }

  function renderCloudPreview(user, cloud) {
    pvUid.textContent = user.uid || "—";

    const rankedCloud = cloud?.rankedStats || cloud?.ranked || null;
    const reflexCloud = cloud?.reflexStats || cloud?.reflex || null;

    pvRanked.textContent = rankedCloud ? "vorhanden ✅" : "—";
    pvReflex.textContent = reflexCloud ? "vorhanden ✅" : "—";

    const updatedAt =
      cloud?.updatedAt?.toDate?.() ||
      cloud?.reflexUpdatedAt?.toDate?.() ||
      cloud?.rankedUpdatedAt?.toDate?.() ||
      null;

    pvUpdated.textContent = updatedAt ? fmtDate(updatedAt) : "—";
    pillUpdated.textContent = "Update: " + (updatedAt ? fmtDate(updatedAt) : "—");
  }

  function chooseBetter(localVal, cloudVal, smallerIsBetter = false) {
    const l = Number(localVal);
    const c = Number(cloudVal);
    const hasL = isFinite(l);
    const hasC = isFinite(c);
    if (!hasL && !hasC) return NaN;
    if (hasL && !hasC) return l;
    if (!hasL && hasC) return c;
    return smallerIsBetter ? Math.min(l, c) : Math.max(l, c);
  }

  function renderMerged(localRanked, localReflex, cloud) {
    // Ranked: wir nehmen XP/Streak aus Cloud wenn vorhanden, sonst Local.
    const rankedCloud = cloud?.rankedStats || cloud?.ranked || null;
    const totalXp = rankedCloud?.totalXp ?? localRanked.totalXp;
    const streak  = rankedCloud?.streak ?? localRanked.streak;
    const lastCompletedDay = rankedCloud?.lastCompletedDay ?? localRanked.lastCompletedDay;

    // Reflex: bestAvg und bestMs -> kleiner ist besser
    const reflexCloud = cloud?.reflexStats || cloud?.reflex || null;
    const bestAvgMs = chooseBetter(localReflex.bestAvgMs, reflexCloud?.bestAvgMs, true);
    const bestMs    = chooseBetter(localReflex.bestMs, reflexCloud?.bestMs, true);

    const fr = ratingFromAvg(bestAvgMs);

    rankedLevel.textContent = String(calcLevel(totalXp));
    rankedXp.textContent = String(Number(totalXp || 0));
    rankedMeta.textContent = lastCompletedDay ? `Last complete: ${lastCompletedDay}` : "Last complete: —";
    rankedStreak.textContent = `Streak: ${Number(streak || 0)}`;

    reflexAvg.textContent = msToLabel(bestAvgMs);
    reflexBest.textContent = msToLabel(bestMs);
    reflexRating.textContent = `Rating: ${fr.grade} • ${fr.label}`;

    const cloudLastAt = reflexCloud?.lastRun?.at || cloud?.reflexUpdatedAt?.toDate?.()?.getTime?.();
    const localLastAt = localReflex.lastRun?.at || null;
    const lastAt = cloudLastAt || localLastAt;
    reflexLast.textContent = lastAt ? `Last run: ${fmtDate(lastAt)}` : "Last run: —";

    chipSync.textContent = cloud ? "Sync: Account + Local" : "Sync: Local";
  }

  async function uploadLocalToCloud(user) {
    if (!db) return toast("error", "Firestore nicht bereit (db fehlt).");

    const ranked = readLocalRanked();
    const reflex = readLocalReflex();

    const payload = {
      rankedStats: {
        totalXp: ranked.totalXp,
        streak: ranked.streak,
        lastCompletedDay: ranked.lastCompletedDay || null,
      },
      reflexStats: {
        bestMs: isFinite(reflex.bestMs) ? reflex.bestMs : null,
        bestAvgMs: isFinite(reflex.bestAvgMs) ? reflex.bestAvgMs : null,
        lastRun: reflex.lastRun || null,
      },
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      rankedUpdatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      reflexUpdatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    };

    await db.collection(USER_COLLECTION).doc(user.uid).set(payload, { merge: true });
    toast("success", "Gespeichert ✅ Local → Account");
  }

  async function downloadCloudToLocal(user) {
    if (!db) return toast("error", "Firestore nicht bereit (db fehlt).");

    const cloud = await loadCloud(user);
    const rankedCloud = cloud?.rankedStats || cloud?.ranked || null;
    const reflexCloud = cloud?.reflexStats || cloud?.reflex || null;

    if (!rankedCloud && !reflexCloud) {
      return toast("warn", "Keine Cloud-Daten gefunden.");
    }

    if (rankedCloud) {
      const localRankedRaw = localStorage.getItem(LS_RANKED);
      const localRanked = safeParse(localRankedRaw || "{}") || {};
      localRanked.totalXp = Number(rankedCloud.totalXp || 0);
      localRanked.streak = Number(rankedCloud.streak || 0);
      localRanked.lastCompletedDay = rankedCloud.lastCompletedDay || null;
      localStorage.setItem(LS_RANKED, JSON.stringify(localRanked));
    }

    if (reflexCloud) {
      const localReflexRaw = localStorage.getItem(LS_REFLEX);
      const localReflex = safeParse(localReflexRaw || "{}") || {};
      if (reflexCloud.bestMs != null) localReflex.bestMs = Number(reflexCloud.bestMs);
      if (reflexCloud.bestAvgMs != null) localReflex.bestAvgMs = Number(reflexCloud.bestAvgMs);
      if (reflexCloud.lastRun) localReflex.lastRun = reflexCloud.lastRun;
      localStorage.setItem(LS_REFLEX, JSON.stringify(localReflex));
    }

    toast("success", "Übernommen ✅ Account → Local");
  }

  function clearLocal() {
    localStorage.removeItem(LS_RANKED);
    localStorage.removeItem(LS_REFLEX);
    toast("success", "Local Stats gelöscht ✅");
  }

  async function wipeCloud(user) {
    if (!db) return toast("error", "Firestore nicht bereit (db fehlt).");
    await db.collection(USER_COLLECTION).doc(user.uid).set({
      rankedStats: firebase.firestore.FieldValue.delete(),
      reflexStats: firebase.firestore.FieldValue.delete(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    toast("success", "Cloud Stats zurückgesetzt ✅");
  }

  async function loadProfileData(user) {
    if (!db) return;
    try {
      const doc = await db.collection(USER_COLLECTION).doc(user.uid).get();
      if (doc.exists) {
        const data = doc.data();
        if (inputDisplayName) inputDisplayName.value = data.displayName || "";
        if (inputAddress) inputAddress.value = data.address || "";
        if (inputPhone) inputPhone.value = data.phone || "";
      }
    } catch (e) {
      console.warn("Fehler beim Laden der Profildaten:", e);
    }
  }

  async function saveProfileData(user) {
    if (!db) return showFormMsg("Firestore nicht bereit.", "error");

    const displayName = inputDisplayName?.value?.trim() || "";
    const address = inputAddress?.value?.trim() || "";
    const phone = inputPhone?.value?.trim() || "";

    if (!displayName) {
      return showFormMsg("Name ist erforderlich.", "error");
    }

    try {
      if (btnSaveProfile) {
        btnSaveProfile.disabled = true;
        btnSaveProfile.textContent = "Speichern...";
      }

      await db.collection(USER_COLLECTION).doc(user.uid).set({
        displayName: displayName,
        address: address || null,
        phone: phone || null,
        profileUpdatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });

      // Update den UI auch
      setLoggedInUI(user);

      showFormMsg("Profil gespeichert ✅", "success");
      toast("success", "Profil aktualisiert ✅");
    } catch (e) {
      console.error("Fehler beim Speichern:", e);
      showFormMsg("Speichern fehlgeschlagen: " + (e?.message || "Unbekannt"), "error");
    } finally {
      if (btnSaveProfile) {
        btnSaveProfile.disabled = false;
        btnSaveProfile.textContent = "Speichern";
      }
    }
  }

  async function wipeCloud(user) {
    if (!db) return toast("error", "Firestore nicht bereit (db fehlt).");
    await db.collection(USER_COLLECTION).doc(user.uid).set({
      rankedStats: firebase.firestore.FieldValue.delete(),
      reflexStats: firebase.firestore.FieldValue.delete(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    toast("success", "Cloud Stats zurückgesetzt ✅");
  }

  async function boot() {
    renderLocalOnly();

    if (!auth || typeof auth.onAuthStateChanged !== "function") {
      showLoggedOut();
      return;
    }

    auth.onAuthStateChanged(async (user) => {
      if (!user) {
        showLoggedOut();
        return;
      }

      showLoggedIn();
      setLoggedInUI(user);

      // Load profile data
      await loadProfileData(user);

      try {
        const localRanked = readLocalRanked();
        const localReflex = readLocalReflex();

        const cloud = await loadCloud(user);
        renderCloudPreview(user, cloud);
        renderMerged(localRanked, localReflex, cloud);
      } catch (e) {
        console.warn(e);
        toast("warn", "Konnte Cloud-Daten nicht laden (siehe Console).");
      }
    });

    // Buttons
    btnSignOut?.addEventListener("click", async () => {
      try {
        await auth.signOut();
        toast("success", "Ausgeloggt ✅");
        window.location.href = "index.html";
      } catch (e) {
        toast("error", "Ausloggen fehlgeschlagen: " + (e?.message || "Unbekannt"));
      }
    });

    btnUploadLocal?.addEventListener("click", async () => {
      const user = window.__ECHTLUCKY_CURRENT_USER__ || auth.currentUser;
      if (!user) return toast("warn", "Bitte einloggen.");
      try {
        await uploadLocalToCloud(user);
        const cloud = await loadCloud(user);
        renderCloudPreview(user, cloud);
        renderMerged(readLocalRanked(), readLocalReflex(), cloud);
      } catch (e) {
        toast("error", "Speichern fehlgeschlagen: " + (e?.message || "Unbekannt"));
      }
    });

    btnDownloadCloud?.addEventListener("click", async () => {
      const user = window.__ECHTLUCKY_CURRENT_USER__ || auth.currentUser;
      if (!user) return toast("warn", "Bitte einloggen.");
      if (!confirm("Account → Local überschreibt deine lokalen Werte. Fortfahren?")) return;

      try {
        await downloadCloudToLocal(user);
        const cloud = await loadCloud(user);
        renderCloudPreview(user, cloud);
        renderMerged(readLocalRanked(), readLocalReflex(), cloud);
      } catch (e) {
        toast("error", "Übernehmen fehlgeschlagen: " + (e?.message || "Unbekannt"));
      }
    });

    btnClearLocal?.addEventListener("click", () => {
      if (!confirm("Local Stats wirklich löschen?")) return;
      clearLocal();
      renderLocalOnly();
    });

    btnWipeCloud?.addEventListener("click", async () => {
      const user = window.__ECHTLUCKY_CURRENT_USER__ || auth.currentUser;
      if (!user) return toast("warn", "Bitte einloggen.");
      if (!confirm("Cloud Stats wirklich zurücksetzen? (nicht rückgängig)")) return;

      try {
        await wipeCloud(user);
        const cloud = await loadCloud(user);
        renderCloudPreview(user, cloud);
        renderMerged(readLocalRanked(), readLocalReflex(), cloud);
      } catch (e) {
        toast("error", "Reset fehlgeschlagen: " + (e?.message || "Unbekannt"));
      }
    });

    // Profile Edit Form
    profileEditForm?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const user = window.__ECHTLUCKY_CURRENT_USER__ || auth.currentUser;
      if (!user) return toast("warn", "Bitte einloggen.");
      await saveProfileData(user);
    });

    btnCancelEdit?.addEventListener("click", () => {
      // Reset form to current values
      const user = window.__ECHTLUCKY_CURRENT_USER__ || auth.currentUser;
      if (user) {
        loadProfileData(user);
      }
    });
  }

  boot();
})();