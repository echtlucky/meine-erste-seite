// js/auth-state.js
// Single source of truth für Auth-State (1 Listener, 1 UI-Update)
// - Works with Firebase compat auth (window.auth)
// - Handles header injected via fetch with "echtlucky:header-ready"
// - Updates data-account-cta automatically
// - Admin role via users/{uid}.role (cached), fallback: ADMIN_EMAIL

(function () {
  "use strict";

  // ✅ Fix: konsistenter Guard-Name
  if (window.__ECHTLUCKY_AUTH_WIRED__) return;
  window.__ECHTLUCKY_AUTH_WIRED__ = true;

  const appNS = (window.echtlucky = window.echtlucky || {});

  // Wait for Firebase to be ready
  let auth = null;
  let db = null;

  function waitForFirebase() {
    return new Promise((resolve) => {
      if (window.auth && window.db) {
        auth = window.auth;
        db = window.db;
        console.log("✅ auth-state.js: Firebase ready");
        resolve();
        return;
      }

      const handler = () => {
        auth = window.auth;
        db = window.db;
        console.log("✅ auth-state.js: Firebase ready via event");
        resolve();
      };

      window.addEventListener("firebaseReady", handler, { once: true });

      setTimeout(() => {
        if (window.auth && window.db) {
          auth = window.auth;
          db = window.db;
          console.log("✅ auth-state.js: Firebase ready via timeout");
          resolve();
        } else {
          console.error("❌ auth-state.js: Firebase timeout");
          resolve();
        }
      }, 5000);
    });
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
      if (dropdown) {
        dropdown.classList.remove('show');
      }
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

    if (dropdown) {
      dropdown.classList.remove('show');
    }

    if (adminPanelLink) {
      adminPanelLink.style.display = "none";
      try {
        const role = await resolveRole(user);
        if (role === "admin") {
          adminPanelLink.style.display = "inline-flex";
        }
      } catch (_) {}
    }
  }

  // Init when ready
  async function init() {
    console.log("🔵 auth-state.js initializing");
    await waitForFirebase();

    if (!auth) {
      console.error("❌ auth-state.js: auth still not ready");
      return;
    }

    console.log("✅ auth-state.js setup complete");

    auth.onAuthStateChanged(async (user) => {
      window.__ECHTLUCKY_CURRENT_USER__ = user || null;
      
      // Update presence
      let lastUid = localStorage.getItem("__echtlucky_lastuid") || "__init__";
      
      if (user && db && db.collection) {
        lastUid = user.uid;
        localStorage.setItem("__echtlucky_lastuid", user.uid);
        try {
          await db.collection("users").doc(user.uid).set({
            isOnline: true,
            lastSeen: new Date(),
            email: user.email,
            displayName: user.displayName || user.email?.split("@")[0],
            uid: user.uid,
            createdAt: new Date()
          }, { merge: true });
        } catch (_) {}
      } else if (!user && db && db.collection && lastUid !== "__init__") {
        try {
          await db.collection("users").doc(lastUid).update({
            isOnline: false,
            lastSeen: new Date()
          });
        } catch (_) {}
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

    // fallback
    document.addEventListener("DOMContentLoaded", async () => {
      if (!headerReady()) return;
      const u = auth.currentUser || window.__ECHTLUCKY_CURRENT_USER__ || null;
      await applyHeaderState(u);
      applyAccountCTAs(u);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
