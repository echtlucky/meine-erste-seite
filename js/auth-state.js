// js/auth-state.js
// Single Source of Truth für Auth-State + UI Updates (Header + CTAs)
// Features:
// - 1 Listener (onAuthStateChanged)
// - Header injected via fetch -> "echtlucky:header-ready"
// - Account CTA Buttons via [data-account-cta]
// - Optional Admin role via Firestore users/{uid}.role (cached)
// - Anti-flicker debounce + safe guards

(function () {
  "use strict";

  // ✅ Guard: verhindert doppelte Initialisierung
  if (window.__ECHTLUCKY_AUTH_WIRED__) return;
  window.__ECHTLUCKY_AUTH_WIRED__ = true;

  // Namespace (optional)
  const appNS = (window.echtlucky = window.echtlucky || {});

  // Firebase handles (müssen aus firebase.js kommen)
  const auth = window.auth || appNS.auth;
  const db = window.db || appNS.db;

  if (!auth || typeof auth.onAuthStateChanged !== "function") {
    console.error(
      "auth-state.js: window.auth fehlt oder onAuthStateChanged ist nicht verfügbar. firebase.js muss vorher geladen werden."
    );
    return;
  }

  // Globale Quelle der Wahrheit (kann jede Seite nutzen)
  window.__ECHTLUCKY_CURRENT_USER__ = window.__ECHTLUCKY_CURRENT_USER__ || null;

  // -----------------------------
  // Header DOM Targets
  // -----------------------------
  function getHeaderEls() {
    return {
      loginLink: document.getElementById("login-link"),
      userName: document.getElementById("user-name-display"),
      dropdown: document.getElementById("dropdown-menu"),
      adminPanelLink: document.getElementById("admin-panel-link"),
    };
  }

  function headerIsReady() {
    const { loginLink, userName, dropdown } = getHeaderEls();
    return !!(loginLink || userName || dropdown);
  }

  // -----------------------------
  // Account CTA Buttons
  // -----------------------------
  function applyAccountCTAs(user) {
    const nodes = document.querySelectorAll("[data-account-cta]");
    if (!nodes || !nodes.length) return;

    nodes.forEach((el) => {
      const outText = el.getAttribute("data-cta-logged-out-text") || "Account erstellen";
      const inText = el.getAttribute("data-cta-logged-in-text") || "Account verwalten";
      const outHref = el.getAttribute("data-cta-logged-out-href") || "login.html";
      const inHref = el.getAttribute("data-cta-logged-in-href") || "account.html";

      if (user) {
        el.textContent = inText;
        el.setAttribute("href", inHref);
        el.setAttribute("aria-label", inText);
      } else {
        el.textContent = outText;
        el.setAttribute("href", outHref);
        el.setAttribute("aria-label", outText);
      }
    });
  }

  // -----------------------------
  // Admin Role (Firestore) + Cache
  // -----------------------------
  const ROLE_CACHE_KEY = "echtlucky:role-cache:v1";

  function loadRoleCache() {
    try {
      const raw = localStorage.getItem(ROLE_CACHE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (_) {
      return {};
    }
  }

  function saveRoleCache(cache) {
    try {
      localStorage.setItem(ROLE_CACHE_KEY, JSON.stringify(cache));
    } catch (_) {}
  }

  async function getRoleForUser(uid) {
    // Default role
    let role = "user";

    // Wenn kein db da -> fertig
    if (!db || !db.collection) return role;

    // Cache check
    const cache = loadRoleCache();
    const cached = cache?.[uid];
    const now = Date.now();

    // Cache TTL: 10 Minuten (damit Änderungen nicht ewig hängen)
    const TTL = 10 * 60 * 1000;

    if (cached && cached.role && cached.ts && now - cached.ts < TTL) {
      return cached.role;
    }

    // Firestore Query
    try {
      const snap = await db.collection("users").doc(uid).get();
      role = snap.exists ? (snap.data()?.role || "user") : "user";
    } catch (_) {
      role = "user";
    }

    // Cache update
    cache[uid] = { role, ts: now };
    saveRoleCache(cache);

    return role;
  }

  // -----------------------------
  // Header Apply (safe + async)
  // -----------------------------
  async function applyHeaderState(user) {
    const { loginLink, userName, dropdown, adminPanelLink } = getHeaderEls();

    // Header noch nicht im DOM? -> return (wird später bei header-ready nochmal gemacht)
    if (!loginLink && !userName && !dropdown) return;

    if (!user) {
      // LOGGED OUT
      if (loginLink) loginLink.style.display = "inline-flex";

      if (userName) {
        userName.textContent = "";
        userName.style.display = "none";
      }

      if (dropdown) dropdown.style.display = "none";
      if (adminPanelLink) adminPanelLink.style.display = "none";
      return;
    }

    // LOGGED IN
    if (loginLink) loginLink.style.display = "none";

    if (userName) {
      userName.textContent =
        user.displayName ||
        (user.email ? user.email.split("@")[0] : "User");
      userName.style.display = "inline-flex";
    }

    if (dropdown) dropdown.style.display = "block";

    // Admin link
    if (adminPanelLink) {
      adminPanelLink.style.display = "none";
      const role = await getRoleForUser(user.uid);
      if (role === "admin") adminPanelLink.style.display = "block";
    }
  }

  // -----------------------------
  // Events (für andere Module)
  // -----------------------------
  function emitAuthEvent(user) {
    window.dispatchEvent(
      new CustomEvent("echtlucky:auth", { detail: { user } })
    );
  }

  // -----------------------------
  // Anti-flicker / Debounce
  // -----------------------------
  let lastUid = "__init__";
  let lastTs = 0;

  function shouldSkip(uid) {
    const now = Date.now();
    const tooFast = now - lastTs < 180;
    const sameUid = uid === lastUid;
    if (sameUid && tooFast) return true;
    lastUid = uid;
    lastTs = now;
    return false;
  }

  // -----------------------------
  // Main Auth Listener
  // -----------------------------
  auth.onAuthStateChanged(async (user) => {
    const uid = user?.uid || null;
    if (shouldSkip(uid)) return;

    // Global user
    window.__ECHTLUCKY_CURRENT_USER__ = user || null;

    // Optional: ensure user doc
    if (user && typeof appNS.ensureUserDoc === "function") {
      try { await appNS.ensureUserDoc(user); } catch (_) {}
    }

    // Apply UI
    await applyHeaderState(user || null);
    applyAccountCTAs(user || null);

    // Emit event
    emitAuthEvent(user || null);
  });

  // -----------------------------
  // Header injected later via fetch
  // -----------------------------
  window.addEventListener("echtlucky:header-ready", async () => {
    const u = auth.currentUser || null;
    window.__ECHTLUCKY_CURRENT_USER__ = u;
    await applyHeaderState(u);
    applyAccountCTAs(u);
  });

  // -----------------------------
  // Bonus: wenn DOMContentLoaded später kommt
  // -----------------------------
  document.addEventListener("DOMContentLoaded", async () => {
    // Falls Header schon da ist, aber event nie gefeuert wurde
    if (headerIsReady()) {
      const u = auth.currentUser || window.__ECHTLUCKY_CURRENT_USER__ || null;
      await applyHeaderState(u);
      applyAccountCTAs(u);
    }
  });

})();