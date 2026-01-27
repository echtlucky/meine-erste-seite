

(() => {
  "use strict";

  const LS_RANKED = "echtlucky_ranked_v1";
  const LS_REFLEX = "echtlucky_reflex_v2";
  const LS_USERNAME_CHANGE = "echtlucky_username_change_ts";

  const USER_COLLECTION = "users";
  const COOLDOWN_DAYS = 7;

  let auth = null;
  let db = null;

  const el = (id) => document.getElementById(id);

  const loggedOutCard = el("loggedOutCard");
  const accountGrid   = el("accountGrid");

  const pillStatus  = el("pillStatus");
  const pillProvider= el("pillProvider");
  const pillUpdated = el("pillUpdated");

  const avatarInitial = el("avatarInitial");
  const avatarImg = el("avatarImg");
  const avatarFile = el("avatarFile");
  const btnChangeAvatar = el("btnChangeAvatar");
  const btnRemoveAvatar = el("btnRemoveAvatar");
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
  const prefFocusDefault = el("prefFocusDefault");
  const prefDifficultyDefault = el("prefDifficultyDefault");
  const prefSounds = el("prefSounds");

  const accountStatusSelect = el("accountStatusSelect");
  const accountCustomStatus = el("accountCustomStatus");
  const btnSaveStatus = el("btnSaveStatus");
  const btnClearStatus = el("btnClearStatus");
  const statusFormMsg = el("statusFormMsg");

  const linkedProvidersList = el("linkedProvidersList");
  const btnChangeEmail = el("btnChangeEmail");
  const btnChangePassword = el("btnChangePassword");
  const btnSetup2fa = el("btnSetup2fa");
  const btnGenerateBackupCodes = el("btnGenerateBackupCodes");
  const btnCopyBackupCodes = el("btnCopyBackupCodes");
  const backupCodesBox = el("backupCodesBox");

  const sessionsList = el("sessionsList");
  const btnSignOutOtherSessions = el("btnSignOutOtherSessions");

  const btnExportAccount = el("btnExportAccount");
  const btnExportAll = el("btnExportAll");
  const btnDeleteAccount = el("btnDeleteAccount");

  let rankChart = null;
  let cachedUserDoc = null;

  function toast(type, msg) {
    if (window.notify?.show) {
      return window.notify.show({
        type: type,
        title: type === "success" ? "Erfolg" : type === "error" ? "Fehler" : "Info",
        message: msg,
        duration: 4500
      });
    }
  }

  function showFormMsg(text, type = "error") {
    if (!settingsFormMsg) return;
    settingsFormMsg.textContent = text;
    settingsFormMsg.className = `form-msg show ${type}`;
    setTimeout(() => {
      settingsFormMsg.className = "form-msg";
    }, 4000);
  }

  function showInlineMsg(targetEl, text, type = "error") {
    if (!targetEl) return;
    targetEl.textContent = text;
    targetEl.className = `form-msg show ${type}`;
    setTimeout(() => {
      targetEl.className = "form-msg";
    }, 4000);
  }

  function downloadJson(filename, data) {
    try {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast("error", "Export fehlgeschlagen: " + (e?.message || "Unbekannt"));
    }
  }

  function providerLabel(providerId) {
    if (providerId === "google.com") return "Google";
    if (providerId === "password") return "E-Mail/Passwort";
    if (providerId === "github.com") return "GitHub";
    if (providerId === "twitter.com") return "Twitter/X";
    return providerId || "Provider";
  }

  function renderLinkedProviders(user) {
    if (!linkedProvidersList) return;
    const providers = Array.isArray(user?.providerData) ? user.providerData : [];
    const rows = providers.length
      ? providers.map((p) => {
          const label = providerLabel(p.providerId);
          const detail = p.email || p.uid || "";
          return `<div class=\"preview-row\"><div class=\"preview-k\">${label}</div><div class=\"preview-v\">${detail}</div></div>`;
        })
      : [`<div class=\"empty-state\"><p>Keine Provider-Daten</p></div>`];

    linkedProvidersList.innerHTML = rows.join("");
  }

  function renderSessions(user) {
    if (!sessionsList) return;
    const ua = navigator.userAgent || "";
    const meta = user?.metadata || {};
    const createdAt = meta.creationTime || "";
    const lastSignIn = meta.lastSignInTime || "";

    sessionsList.innerHTML = `
      <div class="preview-row">
        <div class="preview-k">Aktives Gerät</div>
        <div class="preview-v">${ua}</div>
      </div>
      <div class="preview-row">
        <div class="preview-k">Created</div>
        <div class="preview-v">${createdAt}</div>
      </div>
      <div class="preview-row">
        <div class="preview-k">Last Sign-In</div>
        <div class="preview-v">${lastSignIn}</div>
      </div>
    `;
  }

  function generateBackupCodes(count = 10) {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const rand = (n) => {
      let out = "";
      for (let i = 0; i < n; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
      return out;
    };
    const codes = [];
    for (let i = 0; i < count; i++) codes.push(`${rand(4)}-${rand(4)}`);
    return codes;
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      toast("success", "Kopiert.");
      return true;
    } catch (_) {
      return false;
    }
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
      usernameHint.textContent = "Öffentlich sichtbar • Änderbar alle 7 Tage";
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
        cachedUserDoc = data || null;
        if (inputUsername) inputUsername.value = data.username || data.displayName || "";
        if (inputEmail) inputEmail.value = user.email || "";

        const prefs = data.preferences || {};
        if (prefFocusDefault) prefFocusDefault.value = prefs.focusDefault === "on" ? "on" : "off";
        if (prefDifficultyDefault) prefDifficultyDefault.value = String(prefs.difficultyDefault || "normal");
        if (prefSounds) prefSounds.value = prefs.sounds === "off" ? "off" : "on";

        const isGoogleAuth = user.providerData?.some(p => p.providerId === "google.com");
        if (isGoogleAuth && inputEmail) {
          inputEmail.disabled = true;
          emailHint.textContent = "Mit Google angemeldet • E-Mail nicht änderbar";
        } else if (inputEmail) {
          inputEmail.disabled = false;
          emailHint.textContent = "Du kannst deine Email ändern";
        }

        const cooldown = checkUsernameCooldown();
        updateUsernameStatus(cooldown.canChange, cooldown.daysLeft);

        if (accountStatusSelect) accountStatusSelect.value = String(data.status || "online");
        if (accountCustomStatus) accountCustomStatus.value = String(data.customStatus || "");
      }
    } catch {}
  }

  async function saveStatus(user) {
    if (!db) return showInlineMsg(statusFormMsg, "Firestore nicht bereit.", "error");
    const status = String(accountStatusSelect?.value || "online");
    const customStatus = String(accountCustomStatus?.value || "").trim().slice(0, 80);

    try {
      await db.collection(USER_COLLECTION).doc(user.uid).set(
        {
          status,
          customStatus,
          statusUpdatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      showInlineMsg(statusFormMsg, "Status gespeichert.", "success");
    } catch (e) {
      showInlineMsg(statusFormMsg, "Konnte Status nicht speichern: " + (e?.message || "Unbekannt"), "error");
    }
  }

  async function clearStatus(user) {
    if (!db) return showInlineMsg(statusFormMsg, "Firestore nicht bereit.", "error");
    try {
      await db.collection(USER_COLLECTION).doc(user.uid).set(
        {
          status: "online",
          customStatus: "",
          statusUpdatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      if (accountStatusSelect) accountStatusSelect.value = "online";
      if (accountCustomStatus) accountCustomStatus.value = "";
      showInlineMsg(statusFormMsg, "Status zurückgesetzt.", "success");
    } catch (e) {
      showInlineMsg(statusFormMsg, "Konnte Status nicht zurücksetzen: " + (e?.message || "Unbekannt"), "error");
    }
  }

  async function promptForEmailChange(user) {
    const next = await window.echtluckyModal?.prompt?.({
      title: "E-Mail ändern",
      message: "Neue E-Mail-Adresse eingeben. Du erhältst einen Bestätigungslink.",
      placeholder: "name@example.com",
      confirmText: "Link senden",
      cancelText: "Abbrechen"
    });
    const email = String(next || "").trim();
    if (!email) return;

    try {
      await user.verifyBeforeUpdateEmail(email);
      toast("success", "Bestätigungslink versendet.");
    } catch (e) {
      toast("error", "E-Mail ändern fehlgeschlagen: " + (e?.message || "Unbekannt"));
    }
  }

  async function promptForPasswordChange(user) {
    const next = await window.echtluckyModal?.prompt?.({
      title: "Passwort ändern",
      message: "Neues Passwort eingeben (mind. 6 Zeichen).",
      placeholder: "Neues Passwort",
      confirmText: "Ändern",
      cancelText: "Abbrechen",
      inputType: "password"
    });
    const pw = String(next || "");
    if (!pw) return;
    if (pw.length < 6) return toast("warn", "Mindestens 6 Zeichen.");

    try {
      await user.updatePassword(pw);
      toast("success", "Passwort aktualisiert.");
    } catch (e) {
      toast("error", "Passwort ändern fehlgeschlagen: " + (e?.message || "Unbekannt"));
    }
  }

  async function deleteAccount(user) {
    const confirmed = await window.echtluckyModal?.confirm?.({
      title: "Account löschen",
      message: "Dies löscht deinen Account. Dieser Vorgang ist nicht rückgängig zu machen.",
      confirmText: "Account löschen",
      cancelText: "Abbrechen",
      type: "danger"
    });
    if (!confirmed) return;

    try {
      const snap = await db.collection(USER_COLLECTION).doc(user.uid).get();
      const data = snap.exists ? snap.data() : null;
      const username = String(data?.username || data?.displayName || "").trim();
      const usernameLower = String(data?.usernameLower || (username ? username.toLowerCase() : "")).trim();

      await db.collection("presence").doc(user.uid).delete().catch(() => {});
      await db.collection(USER_COLLECTION).doc(user.uid).delete().catch(() => {});

      if (usernameLower) {
        await db.collection("usernames").doc(usernameLower).delete().catch(() => {});
      }

      await user.delete();
      toast("success", "Account gelöscht.");
      window.location.href = "index.html";
    } catch (e) {
      toast("error", "Account löschen fehlgeschlagen: " + (e?.message || "Unbekannt"));
    }
  }

  function setAvatarUi(url, displayName) {
    if (avatarImg) {
      if (url) {
        avatarImg.src = url;
        avatarImg.hidden = false;
        avatarImg.alt = `${displayName || "Profil"} – Profilbild`;
      } else {
        avatarImg.hidden = true;
        avatarImg.removeAttribute("src");
      }
    }

    if (avatarInitial) {
      avatarInitial.style.display = url ? "none" : "grid";
    }
  }

  async function fileToSquareJpegBlob(file, size = 512, quality = 0.86) {
    const img = document.createElement("img");
    const url = URL.createObjectURL(file);

    await new Promise((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Bild konnte nicht geladen werden"));
      img.src = url;
    });

    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");

    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    const scale = Math.max(size / w, size / h);
    const sw = Math.round(size / scale);
    const sh = Math.round(size / scale);
    const sx = Math.max(0, Math.floor((w - sw) / 2));
    const sy = Math.max(0, Math.floor((h - sh) / 2));

    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, size, size);

    URL.revokeObjectURL(url);

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (!blob) throw new Error("Bild konnte nicht verarbeitet werden");
    return blob;
  }

  async function uploadAvatar(user, file) {
    if (!user?.uid) throw new Error("Nicht eingeloggt");

    const fb = window.firebase;
    if (!fb?.storage) throw new Error("Firebase Storage nicht verfügbar");

    const storage = fb.storage();
    const ref = storage.ref(`avatars/${user.uid}.jpg`);
    const blob = await fileToSquareJpegBlob(file, 512, 0.86);

    await ref.put(blob, {
      contentType: "image/jpeg",
      cacheControl: "public,max-age=31536000"
    });

    const url = await ref.getDownloadURL();

    await db.collection(USER_COLLECTION).doc(user.uid).set(
      {
        avatarUrl: url,
        avatarUpdatedAt: fb.firestore?.FieldValue?.serverTimestamp?.() || new Date()
      },
      { merge: true }
    );

    if (typeof user.updateProfile === "function") {
      try {
        await user.updateProfile({ photoURL: url });
      } catch (_) {}
    }

    return url;
  }

  async function removeAvatar(user) {
    if (!user?.uid) throw new Error("Nicht eingeloggt");
    const fb = window.firebase;

    await db.collection(USER_COLLECTION).doc(user.uid).set(
      { avatarUrl: null, avatarUpdatedAt: fb?.firestore?.FieldValue?.serverTimestamp?.() || new Date() },
      { merge: true }
    );

    try {
      const storage = fb?.storage?.();
      await storage?.ref(`avatars/${user.uid}.jpg`)?.delete?.();
    } catch (_) {}
  }

  async function saveSettings(user) {
    if (!db) return showFormMsg("Firestore nicht bereit.", "error");

    const username = inputUsername?.value?.trim() || "";
    const email = inputEmail?.value?.trim() || "";
    const nextPrefs = {
      focusDefault: prefFocusDefault?.value === "on" ? "on" : "off",
      difficultyDefault: String(prefDifficultyDefault?.value || "normal"),
      sounds: prefSounds?.value === "off" ? "off" : "on"
    };

    if (!username) {
      return showFormMsg("Benutzername ist erforderlich.", "error");
    }

    if (!email) {
      return showFormMsg("Email ist erforderlich.", "error");
    }

    const cooldown = checkUsernameCooldown();
    if (!cooldown.canChange) {
      return showFormMsg(`Benutzername noch ${cooldown.daysLeft} Tag(e) gesperrt.`, "error");
    }

    try {
      if (btnSaveSettings) {
        btnSaveSettings.disabled = true;
        btnSaveSettings.textContent = "Speichern...";
      }

      await db.collection(USER_COLLECTION).doc(user.uid).set({
        username: username,
        displayName: username,
        preferences: nextPrefs,
        settingsUpdatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });

      localStorage.setItem(LS_USERNAME_CHANGE, Date.now().toString());

      if (email !== user.email) {
        try {
          await user.verifyBeforeUpdateEmail(email);
          showFormMsg("Bestätigungslink wurde an neue Email gesendet ", "success");
          toast("success", "Bestätigungslink versendet!");
        } catch (emailErr) {
          showFormMsg("Email konnte nicht geändert werden: " + emailErr.message, "error");
        }
      } else {
        showFormMsg("Einstellungen gespeichert ", "success");
      }

      await loadSettingsData(user);
      toast("success", "Einstellungen aktualisiert ");
    } catch (e) {
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

      await loadSettingsData(user);
      renderLinkedProviders(user);
      renderSessions(user);

      try {
        const snap = await db.collection(USER_COLLECTION).doc(user.uid).get();
        const data = snap.exists ? snap.data() : null;
        setAvatarUi(data?.avatarUrl || user.photoURL || "", user.displayName || "");
      } catch (_) {
        setAvatarUi(user.photoURL || "", user.displayName || "");
      }

      try {
        const localRanked = readLocalRanked();
        const localReflex = readLocalReflex();

        const cloud = await loadCloud(user);
        renderCloudPreview(user, cloud);
        renderMerged(localRanked, localReflex, cloud);
      } catch (e) {
        toast("warn", "Konnte Cloud-Daten nicht laden.");
      }
    });

    btnSignOut?.addEventListener("click", async () => {
      try {
        await auth.signOut();
        toast("success", "Ausgeloggt ");
        window.location.href = "index.html";
      } catch (e) {
        toast("error", "Ausloggen fehlgeschlagen: " + (e?.message || "Unbekannt"));
      }
    });

    btnChangeAvatar?.addEventListener("click", () => avatarFile?.click?.());
    avatarInitial?.addEventListener("click", () => avatarFile?.click?.());
    avatarImg?.addEventListener("click", () => avatarFile?.click?.());

    avatarFile?.addEventListener("change", async () => {
      const user = window.__ECHTLUCKY_CURRENT_USER__ || auth.currentUser;
      const file = avatarFile.files?.[0];
      if (!user || !file) return;

      if (!/^image\//.test(file.type || "")) {
        toast("warn", "Bitte eine Bilddatei wählen.");
        avatarFile.value = "";
        return;
      }

      if (file.size > 4 * 1024 * 1024) {
        toast("warn", "Bild ist zu groß (max. 4MB).");
        avatarFile.value = "";
        return;
      }

      try {
        const url = await uploadAvatar(user, file);
        setAvatarUi(url, user.displayName || "");
        toast("success", "Profilbild aktualisiert.");
      } catch (e) {
        toast("error", "Upload fehlgeschlagen: " + (e?.message || "Unbekannt"));
      } finally {
        avatarFile.value = "";
      }
    });

    btnRemoveAvatar?.addEventListener("click", async () => {
      const user = window.__ECHTLUCKY_CURRENT_USER__ || auth.currentUser;
      if (!user) return toast("warn", "Bitte einloggen.");
      try {
        await removeAvatar(user);
        setAvatarUi("", user.displayName || "");
        toast("success", "Profilbild entfernt.");
      } catch (e) {
        toast("error", "Konnte nicht entfernen: " + (e?.message || "Unbekannt"));
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

    btnSaveStatus?.addEventListener("click", async () => {
      const user = window.__ECHTLUCKY_CURRENT_USER__ || auth.currentUser;
      if (!user) return toast("warn", "Bitte einloggen.");
      await saveStatus(user);
    });

    btnClearStatus?.addEventListener("click", async () => {
      const user = window.__ECHTLUCKY_CURRENT_USER__ || auth.currentUser;
      if (!user) return toast("warn", "Bitte einloggen.");
      await clearStatus(user);
    });

    btnChangeEmail?.addEventListener("click", async () => {
      const user = window.__ECHTLUCKY_CURRENT_USER__ || auth.currentUser;
      if (!user) return toast("warn", "Bitte einloggen.");
      await promptForEmailChange(user);
    });

    btnChangePassword?.addEventListener("click", async () => {
      const user = window.__ECHTLUCKY_CURRENT_USER__ || auth.currentUser;
      if (!user) return toast("warn", "Bitte einloggen.");
      await promptForPasswordChange(user);
    });

    btnSetup2fa?.addEventListener("click", async () => {
      await window.echtluckyModal?.alert?.({
        title: "2FA",
        message: "2FA ist aktuell nicht verfügbar.",
        confirmText: "OK"
      });
    });

    btnGenerateBackupCodes?.addEventListener("click", () => {
      const codes = generateBackupCodes(10);
      const text = codes.join("\n");
      if (backupCodesBox) backupCodesBox.value = text;
      toast("success", "Backup-Codes generiert.");
    });

    btnCopyBackupCodes?.addEventListener("click", async () => {
      const text = String(backupCodesBox?.value || "").trim();
      if (!text) return;
      const ok = await copyText(text);
      if (!ok) toast("warn", "Kopieren nicht möglich.");
    });

    btnSignOutOtherSessions?.addEventListener("click", async () => {
      await window.echtluckyModal?.alert?.({
        title: "Sessions",
        message: "Andere Sessions ausloggen ist in der Web-Version nicht verfügbar.",
        confirmText: "OK"
      });
    });

    btnExportAccount?.addEventListener("click", async () => {
      const user = window.__ECHTLUCKY_CURRENT_USER__ || auth.currentUser;
      if (!user) return toast("warn", "Bitte einloggen.");
      const snap = await db.collection(USER_COLLECTION).doc(user.uid).get().catch(() => null);
      const doc = snap && snap.exists ? snap.data() : null;
      downloadJson(`echtlucky-account-${user.uid}.json`, {
        user: { uid: user.uid, email: user.email, providers: user.providerData || [] },
        profile: doc || {}
      });
    });

    btnExportAll?.addEventListener("click", async () => {
      const user = window.__ECHTLUCKY_CURRENT_USER__ || auth.currentUser;
      if (!user) return toast("warn", "Bitte einloggen.");
      const snap = await db.collection(USER_COLLECTION).doc(user.uid).get().catch(() => null);
      const doc = snap && snap.exists ? snap.data() : null;
      const localRanked = safeParse(localStorage.getItem(LS_RANKED) || "{}") || {};
      const localReflex = safeParse(localStorage.getItem(LS_REFLEX) || "{}") || {};
      downloadJson(`echtlucky-export-${user.uid}.json`, {
        user: { uid: user.uid, email: user.email, providers: user.providerData || [], metadata: user.metadata || {} },
        profile: doc || {},
        local: { ranked: localRanked, reflex: localReflex }
      });
    });

    btnDeleteAccount?.addEventListener("click", async () => {
      const user = window.__ECHTLUCKY_CURRENT_USER__ || auth.currentUser;
      if (!user) return toast("warn", "Bitte einloggen.");
      await deleteAccount(user);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => boot());
  } else {
    boot();
  }
})();
