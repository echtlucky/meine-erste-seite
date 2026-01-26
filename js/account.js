/* =========================
   account.js  echtlucky
   - zeigt Local + Cloud Stats
   - Sync Buttons (Local -> Cloud, Cloud -> Local)
   - Username + Email Änderung
   - Rank History Chart
   - Requires Firebase Auth/Firestore
========================= */

(() => {
  "use strict";

  // LocalStorage Keys
  const LS_RANKED = "echtlucky_ranked_v1";
  const LS_REFLEX = "echtlucky_reflex_v2";
  const LS_USERNAME_CHANGE = "echtlucky_username_change_ts";

  // Firestore path
  const USER_COLLECTION = "users";
  const COOLDOWN_DAYS = 7;

  let auth = null;
  let db = null;

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
  const rankedStreak= el("rankedStreak");
  const rankedMeta  = el("rankedMeta");

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

  // Account Settings Elements
  const accountSettingsForm = el("accountSettingsForm");
  const inputUsername = el("inputUsername");
  const inputEmail = el("inputEmail");
  const usernameStatus = el("usernameStatus");
  const emailStatus = el("emailStatus");
  const usernameHint = el("usernameHint");
  const emailHint = el("emailHint");
  const btnSaveSettings = el("btnSaveSettings");
  const btnCancelSettings = el("btnCancelSettings");
  const settingsFormMsg = el("settingsFormMsg");

  // Chart
  let rankChart = null;

  // Notify wrapper
  function toast(type, msg) {
    if (window.notify?.show) {
      return window.notify.show({
        type: type,
        title: type === "success" ? "Erfolg" : type === "error" ? "Fehler" : "Info",
        message: msg,
        duration: 4500
      });
    }
    console.log(`[${type.toUpperCase()}] ${msg}`);
  }

  function showFormMsg(text, type = "error") {
    if (!settingsFormMsg) return;
    settingsFormMsg.textContent = text;
    settingsFormMsg.className = `form-msg show ${type}`;
    setTimeout(() => {
      settingsFormMsg.className = "form-msg";
    }, 4000);
  }

  function msToLabel(ms) {
    if (!isFinite(ms)) return "";
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
    const lastRun = data.lastRun || null;

    return {
      bestMs: isFinite(bestMs) ? bestMs : NaN,
      bestAvgMs: isFinite(bestAvgMs) ? bestAvgMs : NaN,
      lastRun,
      source: raw ? "local" : "none",
    };
  }

  function ratingFromAvg(avgMs) {
    if (!isFinite(avgMs)) return { grade: "", label: "" };
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
    profileEmail.textContent = user.email || "";
    avatarInitial.textContent = (display?.[0] || "?").toUpperCase();

    pillStatus.textContent = "Status: Eingeloggt";
    pillProvider.textContent = "Login: " + (user.providerData?.[0]?.providerId || "firebase");
  }

  function setLoggedOutUI() {
    pillStatus.textContent = "Status: Nicht eingeloggt";
    pillProvider.textContent = "Login: ";
    pillUpdated.textContent = "Update: ";
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
    if (!ts) return "";
    const d = ts instanceof Date ? ts : new Date(ts);
    if (isNaN(d.getTime())) return "";
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
    rankedMeta.textContent = r.lastCompletedDay ? `Zuletzt: ${r.lastCompletedDay}` : "Zuletzt: ";
    rankedStreak.textContent = `${r.streak}`;

    reflexAvg.textContent = msToLabel(f.bestAvgMs);
    reflexBest.textContent = msToLabel(f.bestMs);
    reflexRating.textContent = `${fr.grade}  ${fr.label}`;
    reflexLast.textContent = f.lastRun?.at ? `${fmtDate(f.lastRun.at)}` : "";

    chipSync.textContent = "Sync: Local";
    drawRankChart([r.level], ["Jetzt"]);
  }

  async function loadCloud(user) {
    if (!db) return null;
    const doc = await db.collection(USER_COLLECTION).doc(user.uid).get();
    return doc.exists ? doc.data() : null;
  }

  function renderCloudPreview(user, cloud) {
    pvUid.textContent = user.uid || "";

    const rankedCloud = cloud?.rankedStats || cloud?.ranked || null;
    const reflexCloud = cloud?.reflexStats || cloud?.reflex || null;

    pvRanked.textContent = rankedCloud ? "vorhanden " : "";
    pvReflex.textContent = reflexCloud ? "vorhanden " : "";

    const updatedAt =
      cloud?.updatedAt?.toDate?.() ||
      cloud?.reflexUpdatedAt?.toDate?.() ||
      cloud?.rankedUpdatedAt?.toDate?.() ||
      null;

    pvUpdated.textContent = updatedAt ? fmtDate(updatedAt) : "";
    pillUpdated.textContent = "Update: " + (updatedAt ? fmtDate(updatedAt) : "");
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
    const rankedCloud = cloud?.rankedStats || cloud?.ranked || null;
    const totalXp = rankedCloud?.totalXp ?? localRanked.totalXp;
    const streak  = rankedCloud?.streak ?? localRanked.streak;
    const lastCompletedDay = rankedCloud?.lastCompletedDay ?? localRanked.lastCompletedDay;

    const reflexCloud = cloud?.reflexStats || cloud?.reflex || null;
    const bestAvgMs = chooseBetter(localReflex.bestAvgMs, reflexCloud?.bestAvgMs, true);
    const bestMs    = chooseBetter(localReflex.bestMs, reflexCloud?.bestMs, true);

    const fr = ratingFromAvg(bestAvgMs);

    rankedLevel.textContent = String(calcLevel(totalXp));
    rankedXp.textContent = String(Number(totalXp || 0));
    rankedMeta.textContent = lastCompletedDay ? `Zuletzt: ${lastCompletedDay}` : "Zuletzt: ";
    rankedStreak.textContent = `${Number(streak || 0)}`;

    reflexAvg.textContent = msToLabel(bestAvgMs);
    reflexBest.textContent = msToLabel(bestMs);
    reflexRating.textContent = `${fr.grade}  ${fr.label}`;

    const cloudLastAt = reflexCloud?.lastRun?.at || cloud?.reflexUpdatedAt?.toDate?.()?.getTime?.();
    const localLastAt = localReflex.lastRun?.at || null;
    const lastAt = cloudLastAt || localLastAt;
    reflexLast.textContent = lastAt ? `${fmtDate(lastAt)}` : "";

    chipSync.textContent = cloud ? "Sync: Account + Local" : "Sync: Local";
    
    // Draw rank chart with some history
    const levels = [calcLevel(totalXp)];
    const labels = ["Aktuell"];
    drawRankChart(levels, labels);
  }

  function drawRankChart(levels, labels) {
    const canvas = el("rankChartCanvas");
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    
    if (rankChart) {
      rankChart.destroy();
    }

    rankChart = new Chart(ctx, {
      type: "line",
      data: {
        labels: labels,
        datasets: [{
          label: "Rank Level",
          data: levels,
          borderColor: "rgba(0, 255, 136, 0.9)",
          backgroundColor: "rgba(0, 255, 136, 0.1)",
          borderWidth: 2,
          fill: true,
          tension: 0.3,
          pointRadius: 4,
          pointBackgroundColor: "rgba(0, 255, 136, 0.95)",
          pointBorderColor: "#00ff88",
          pointBorderWidth: 2,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            display: true,
            labels: {
              color: "rgba(224, 255, 224, 0.9)",
              font: { size: 12, weight: "600" }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { color: "rgba(224, 255, 224, 0.7)", stepSize: 1 },
            grid: { color: "rgba(0, 255, 136, 0.08)" }
          },
          x: {
            ticks: { color: "rgba(224, 255, 224, 0.7)" },
            grid: { color: "rgba(0, 255, 136, 0.08)" }
          }
        }
      }
    });
  }

  // Username cooldown check
  function checkUsernameCooldown() {
    const lastChange = localStorage.getItem(LS_USERNAME_CHANGE);
    if (!lastChange) {
      return { canChange: true, daysLeft: 0 };
    }

    const lastTs = Number(lastChange);
    const nowTs = Date.now();
    const daysPassed = (nowTs - lastTs) / (1000 * 60 * 60 * 24);

    if (daysPassed >= COOLDOWN_DAYS) {
      return { canChange: true, daysLeft: 0 };
    }

    const daysLeft = Math.ceil(COOLDOWN_DAYS - daysPassed);
    return { canChange: false, daysLeft };
  }

  function updateUsernameStatus(canChange, daysLeft) {
    if (canChange) {
      usernameStatus.textContent = "Änderbar";
      usernameStatus.className = "form-status available";
      usernameHint.textContent = "Öffentlich sichtbar  Änderbar alle 7 Tage";
      inputUsername.disabled = false;
    } else {
      usernameStatus.textContent = `Noch ${daysLeft}d`;
      usernameStatus.className = "form-status locked";
      usernameHint.textContent = `Nächste Änderung in ${daysLeft} Tag(en) möglich`;
      inputUsername.disabled = true;
    }
  }

  async function loadSettingsData(user) {
    if (!db) return;
    try {
      const doc = await db.collection(USER_COLLECTION).doc(user.uid).get();
      if (doc.exists) {
        const data = doc.data();
        if (inputUsername) inputUsername.value = data.username || data.displayName || "";
        if (inputEmail) inputEmail.value = user.email || "";

        // Check if Google auth
        const isGoogleAuth = user.providerData?.some(p => p.providerId === "google.com");
        if (isGoogleAuth && inputEmail) {
          inputEmail.disabled = true;
          emailHint.textContent = "Mit Google angemeldet  Email nicht änderbar";
        } else if (inputEmail) {
          inputEmail.disabled = false;
          emailHint.textContent = "Du kannst deine Email ändern";
        }

        // Check username cooldown
        const cooldown = checkUsernameCooldown();
        updateUsernameStatus(cooldown.canChange, cooldown.daysLeft);
      }
    } catch (e) {
      console.warn("Fehler beim Laden der Einstellungen:", e);
    }
  }

  async function saveSettings(user) {
    if (!db) return showFormMsg("Firestore nicht bereit.", "error");

    const username = inputUsername?.value?.trim() || "";
    const email = inputEmail?.value?.trim() || "";

    if (!username) {
      return showFormMsg("Benutzername ist erforderlich.", "error");
    }

    if (!email) {
      return showFormMsg("Email ist erforderlich.", "error");
    }

    // Check username cooldown
    const cooldown = checkUsernameCooldown();
    if (!cooldown.canChange) {
      return showFormMsg(`Benutzername noch ${cooldown.daysLeft} Tag(e) gesperrt.`, "error");
    }

    try {
      if (btnSaveSettings) {
        btnSaveSettings.disabled = true;
        btnSaveSettings.textContent = "Speichern...";
      }

      // Update username in Firestore
      await db.collection(USER_COLLECTION).doc(user.uid).set({
        username: username,
        displayName: username,
        settingsUpdatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });

      // Set username change cooldown
      localStorage.setItem(LS_USERNAME_CHANGE, Date.now().toString());

      // Update user profile if email changed
      if (email !== user.email) {
        try {
          await user.verifyBeforeUpdateEmail(email);
          showFormMsg("Bestätigungslink wurde an neue Email gesendet ", "success");
          toast("success", "Bestätigungslink versendet!");
        } catch (emailErr) {
          console.warn("Email Änderung:", emailErr);
          showFormMsg("Email konnte nicht geändert werden: " + emailErr.message, "error");
        }
      } else {
        showFormMsg("Einstellungen gespeichert ", "success");
      }

      // Reload settings
      await loadSettingsData(user);
      toast("success", "Einstellungen aktualisiert ");
    } catch (e) {
      console.error("Fehler beim Speichern:", e);
      showFormMsg("Speichern fehlgeschlagen: " + (e?.message || "Unbekannt"), "error");
    } finally {
      if (btnSaveSettings) {
        btnSaveSettings.disabled = false;
        btnSaveSettings.textContent = "Speichern";
      }
    }
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
    toast("success", "Gespeichert  Local  Account");
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

    toast("success", "Übernommen  Account  Local");
  }

  function clearLocal() {
    localStorage.removeItem(LS_RANKED);
    localStorage.removeItem(LS_REFLEX);
    toast("success", "Local Stats gelöscht ");
  }

  async function wipeCloud(user) {
    if (!db) return toast("error", "Firestore nicht bereit (db fehlt).");
    await db.collection(USER_COLLECTION).doc(user.uid).set({
      rankedStats: firebase.firestore.FieldValue.delete(),
      reflexStats: firebase.firestore.FieldValue.delete(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    toast("success", "Cloud Stats zurückgesetzt ");
  }

  async function boot() {
    // Wait for Firebase to be ready
    if (!auth || !db) {
      if (window.firebaseReady && window.auth && window.db) {
        auth = window.auth;
        db = window.db;
      } else {
        await new Promise((resolve) => {
          const handler = () => {
            auth = window.auth;
            db = window.db;
            resolve();
          };
          window.addEventListener("firebaseReady", handler, { once: true });
          setTimeout(() => resolve(), 5000);
        });
      }
    }

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

      // Load settings
      await loadSettingsData(user);

      try {
        const localRanked = readLocalRanked();
        const localReflex = readLocalReflex();

        const cloud = await loadCloud(user);
        renderCloudPreview(user, cloud);
        renderMerged(localRanked, localReflex, cloud);
      } catch (e) {
        console.warn(e);
        toast("warn", "Konnte Cloud-Daten nicht laden.");
      }
    });

    // Buttons
    btnSignOut?.addEventListener("click", async () => {
      try {
        await auth.signOut();
        toast("success", "Ausgeloggt ");
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
      
      const confirmed = await echtluckyModal.confirm({
        title: "Cloud zu Lokal übernehmen",
        message: "Dies überschreibt deine lokalen Werte mit den Cloud-Daten. Fortfahren?",
        confirmText: "Ja, übernehmen",
        cancelText: "Abbrechen",
        type: "warning"
      });
      
      if (!confirmed) return;

      try {
        await downloadCloudToLocal(user);
        const cloud = await loadCloud(user);
        renderCloudPreview(user, cloud);
        renderMerged(readLocalRanked(), readLocalReflex(), cloud);
      } catch (e) {
        toast("error", "Übernehmen fehlgeschlagen: " + (e?.message || "Unbekannt"));
      }
    });

    btnClearLocal?.addEventListener("click", async () => {
      const confirmed = await echtluckyModal.confirm({
        title: "Lokale Stats löschen",
        message: "Möchtest du alle lokalen Statistiken wirklich löschen?",
        confirmText: "Ja, löschen",
        cancelText: "Abbrechen",
        type: "danger"
      });
      
      if (!confirmed) return;
      clearLocal();
      renderLocalOnly();
    });

    btnWipeCloud?.addEventListener("click", async () => {
      const user = window.__ECHTLUCKY_CURRENT_USER__ || auth.currentUser;
      if (!user) return toast("warn", "Bitte einloggen.");
      
      const confirmed = await echtluckyModal.confirm({
        title: "Cloud Stats zurücksetzen",
        message: "Dies löscht alle Cloud-Statistiken permanently! Dies kann nicht rückgängig gemacht werden.",
        confirmText: "Ja, löschen",
        cancelText: "Abbrechen",
        type: "danger"
      });
      
      if (!confirmed) return;

      try {
        await wipeCloud(user);
        const cloud = await loadCloud(user);
        renderCloudPreview(user, cloud);
        renderMerged(readLocalRanked(), readLocalReflex(), cloud);
      } catch (e) {
        toast("error", "Reset fehlgeschlagen: " + (e?.message || "Unbekannt"));
      }
    });

    // Settings Form
    accountSettingsForm?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const user = window.__ECHTLUCKY_CURRENT_USER__ || auth.currentUser;
      if (!user) return toast("warn", "Bitte einloggen.");
      await saveSettings(user);
    });

    btnCancelSettings?.addEventListener("click", () => {
      const user = window.__ECHTLUCKY_CURRENT_USER__ || auth.currentUser;
      if (user) {
        loadSettingsData(user);
      }
    });
  }

  // Initialize on DOM load
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => boot());
  } else {
    boot();
  }
})();
