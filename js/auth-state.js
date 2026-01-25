// js/auth-state.js
// Single source of truth für Auth-State (1 Listener, 1 UI-Update)
// - Works with Firebase compat auth (window.auth)
// - Handles header injected via fetch with "echtlucky:header-ready"
// - Updates data-account-cta automatically
// - Admin role via users/{uid}.role (cached), fallback: ADMIN_EMAIL

(function () {
  "use strict";

  // ✅ Fix: konsistenter Guard-Name (bei dir war ein Tippfehler drin)
  if (window.__ECHTLUCKY_AUTH_WIRED__) return;
  window.__ECHTLUCKY_AUTH_WIRED__ = true;

  const appNS = (window.echtlucky = window.echtlucky || {});
  const auth = window.auth || appNS.auth;
  const db = window.db || appNS.db;

  if (!auth || typeof auth.onAuthStateChanged !== "function") {
    console.error("auth-state.js: auth fehlt. firebase.js muss vorher geladen werden.");
    return;
  }

  // globale Quelle der Wahrheit
  window.__ECHTLUCKY_CURRENT_USER__ = window.__ECHTLUCKY_CURRENT_USER__ || null;

  // -----------------------------
  // Header Targets
  // -----------------------------
  function getHeaderEls() {
    return {
      loginLink: document.getElementById("login-link"),
      userName: document.getElementById("user-name-display"),
      dropdown: document.getElementById("dropdown-menu"),
      adminPanelLink: document.getElementById("admin-panel-link"),
    };
  }

  function headerReady() {
    const { loginLink, userName, dropdown } = getHeaderEls();
    return !!(loginLink || userName || dropdown);
  }

  // -----------------------------
  // Account CTA (Home Button etc.)
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
        el.href = inHref;
        el.setAttribute("aria-label", inText);
      } else {
        el.textContent = outText;
        el.href = outHref;
        el.setAttribute("aria-label", outText);
      }
    });
  }

  // -----------------------------
  // Admin Role Cache (minimiert Firestore Reads)
  // -----------------------------
  const ROLE_CACHE_KEY = "echtlucky:role-cache:v1";
  const ROLE_TTL_MS = 10 * 60 * 1000; // 10 min

  function loadRoleCache() {
    try {
      return JSON.parse(localStorage.getItem(ROLE_CACHE_KEY) || "{}");
    } catch (_) {
      return {};
    }
  }

  function saveRoleCache(cache) {
    try {
      localStorage.setItem(ROLE_CACHE_KEY, JSON.stringify(cache));
    } catch (_) {}
  }

  async function resolveRole(user) {
    if (!user?.uid) return "user";

    // fallback: admin email (aus firebase.js)
    if (typeof appNS.isAdminByEmail === "function" && appNS.isAdminByEmail(user)) {
      return "admin";
    }

    // cached?
    const cache = loadRoleCache();
    const cached = cache[user.uid];
    const now = Date.now();

    if (cached?.role && cached?.ts && (now - cached.ts < ROLE_TTL_MS)) {
      return cached.role;
    }

    // fetch role
    let role = "user";
    if (db && db.collection) {
      try {
        const snap = await db.collection("users").doc(user.uid).get();
        role = snap.exists ? (snap.data()?.role || "user") : "user";
      } catch (_) {
        role = "user";
      }
    }

    cache[user.uid] = { role, ts: now };
    saveRoleCache(cache);
    return role;
  }

  // -----------------------------
  // Apply Header UI
  // -----------------------------
  async function applyHeaderState(user) {
    const { loginLink, userName, dropdown, adminPanelLink } = getHeaderEls();

    // Header noch nicht da? -> später via event
    if (!loginLink && !userName && !dropdown) return;

    if (!user) {
      if (loginLink) loginLink.style.display = "inline-flex";
      if (userName) {
        userName.textContent = "";
        userName.style.display = "none";
      }
      if (dropdown) dropdown.style.display = "none";
      if (adminPanelLink) adminPanelLink.style.display = "none";
      return;
    }

    // logged in
    if (loginLink) loginLink.style.display = "none";

    if (userName) {
      userName.textContent =
        user.displayName ||
        (user.email ? user.email.split("@")[0] : "User");
      userName.style.display = "inline-flex";
    }

    if (dropdown) dropdown.style.display = "block";

    if (adminPanelLink) {
      adminPanelLink.style.display = "none";
      const role = await resolveRole(user);
      if (role === "admin") adminPanelLink.style.display = "block";
    }
  }

  function emitAuthEvent(user) {
    window.dispatchEvent(new CustomEvent("echtlucky:auth", { detail: { user } }));
  }

  // -----------------------------
  // Anti-Flicker
  // -----------------------------
  let lastUid = "__init__";
  let lastTs = 0;

  function shouldSkip(uid) {
    const now = Date.now();
    const tooFast = (now - lastTs) < 180;
    const same = uid === lastUid;
    if (same && tooFast) return true;
    lastUid = uid;
    lastTs = now;
    return false;
  }

  // -----------------------------
  // Main listener
  // -----------------------------
  auth.onAuthStateChanged(async (user) => {
    const uid = user?.uid || null;
    if (shouldSkip(uid)) return;

    window.__ECHTLUCKY_CURRENT_USER__ = user || null;

    // optional: ensure user doc exists / lastLoginAt update
    if (user && typeof appNS.ensureUserDoc === "function") {
      try { await appNS.ensureUserDoc(user); } catch (_) {}
    }

    await applyHeaderState(user || null);
    applyAccountCTAs(user || null);

    emitAuthEvent(user || null);
  });

  // Header injected later (fetch)
  window.addEventListener("echtlucky:header-ready", async () => {
    const u = auth.currentUser || null;
    window.__ECHTLUCKY_CURRENT_USER__ = u;
    await applyHeaderState(u);
    applyAccountCTAs(u);
  });

  // fallback: falls event nie gefeuert wird
  document.addEventListener("DOMContentLoaded", async () => {
    if (!headerReady()) return;
    const u = auth.currentUser || window.__ECHTLUCKY_CURRENT_USER__ || null;
    await applyHeaderState(u);
    applyAccountCTAs(u);
  });
})();