// js/auth-state.js
// Single source of truth für Auth-State (1 Listener, 1 UI-Update)

(function () {
  "use strict";

  if (window.__EHTLUCKY_AUTH_WIRED__) return; // verhindert doppelte Initialisierung
  window.__EHTLUCKY_AUTH_WIRED__ = true;

  const appNS = (window.echtlucky = window.echtlucky || {});
  const auth = window.auth || appNS.auth;
  const db = window.db || appNS.db;

  if (!auth) {
    console.error("auth-state.js: window.auth fehlt. firebase.js muss vorher geladen werden.");
    return;
  }

  // UI-Targets (Header)
  function getHeaderEls() {
    return {
      loginLink: document.getElementById("login-link"),
      userName: document.getElementById("user-name-display"),
      dropdown: document.getElementById("dropdown-menu"),
      adminPanelLink: document.getElementById("admin-panel-link"),
    };
  }

  // Debounce gegen Flicker
  let lastUid = "__init__";
  let lastTs = 0;

  async function applyHeaderState(user) {
    const { loginLink, userName, dropdown, adminPanelLink } = getHeaderEls();

    // Wenn Header noch nicht im DOM ist (weil fetch), dann später nochmal versuchen
    if (!loginLink && !userName) return;

    if (!user) {
      if (loginLink) loginLink.style.display = "inline-flex";
      if (userName) userName.style.display = "none";
      if (adminPanelLink) adminPanelLink.style.display = "none";
      return;
    }

    // logged in
    if (loginLink) loginLink.style.display = "none";
    if (userName) {
      userName.textContent = user.displayName || (user.email ? user.email.split("@")[0] : "User");
      userName.style.display = "inline-flex";
    }

    // Admin link (Role check)
    if (adminPanelLink) {
      adminPanelLink.style.display = "none";
      try {
        const snap = await db.collection("users").doc(user.uid).get();
        const role = snap.exists ? snap.data()?.role : "user";
        if (role === "admin") adminPanelLink.style.display = "block";
      } catch (_) {}
    }
  }

  function emitAuthEvent(user) {
    window.dispatchEvent(new CustomEvent("echtlucky:auth", { detail: { user } }));
  }

  auth.onAuthStateChanged(async (user) => {
    // Anti-Flicker / Anti-Spam: ignorier ultra schnelle Wechsel
    const now = Date.now();
    const uid = user?.uid || null;

    if (uid === lastUid && now - lastTs < 250) return;
    lastUid = uid;
    lastTs = now;

    // Optional: users-doc updaten (lastLoginAt)
    if (user && appNS.ensureUserDoc) {
      try { await appNS.ensureUserDoc(user); } catch (_) {}
    }

    await applyHeaderState(user);
    emitAuthEvent(user);

    // Debug
    // console.log("auth-state:", uid ? "logged-in" : "logged-out", uid);
  });

  // Falls Header nachträglich via fetch kommt: state neu anwenden, sobald Header ready ist
  window.addEventListener("echtlucky:header-ready", async () => {
    const u = auth.currentUser;
    await applyHeaderState(u);
  });
})();