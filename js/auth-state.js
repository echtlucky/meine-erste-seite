(function () {
  "use strict";

  if (window.__ECHTLUCKY_AUTH_WIRED__) return;
  window.__ECHTLUCKY_AUTH_WIRED__ = true;

  const appNS = (window.echtlucky = window.echtlucky || {});

  let auth = null;
  let db = null;

  function waitForFirebase() {
    return new Promise((resolve) => {
      if (window.auth && window.db) {
        auth = window.auth;
        db = window.db;
        resolve();
        return;
      }

      const handler = () => {
        auth = window.auth;
        db = window.db;
        resolve();
      };

      window.addEventListener("firebaseReady", handler, { once: true });

      setTimeout(() => {
        if (window.auth && window.db) {
          auth = window.auth;
          db = window.db;
          resolve();
        } else {
          resolve();
        }
      }, 5000);
    });
  }

  window.__ECHTLUCKY_CURRENT_USER__ = window.__ECHTLUCKY_CURRENT_USER__ || null;

  function getHeaderEls() {
    return {
      loginLink: document.getElementById("login-link"),
      userName: document.getElementById("user-name-display"),
      dropdown: document.getElementById("dropdown-menu"),
      adminPanelLink: document.getElementById("admin-panel-link"),
      connectNav: document.getElementById("connectNav"),
    };
  }

  function headerReady() {
    const { loginLink, userName, dropdown } = getHeaderEls();
    return !!(loginLink || userName || dropdown);
  }

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

    if (typeof appNS.isAdminByEmail === "function" && appNS.isAdminByEmail(user)) {
      return "admin";
    }

    const cache = loadRoleCache();
    const cached = cache[user.uid];
    const now = Date.now();

    if (cached?.role && cached?.ts && (now - cached.ts < ROLE_TTL_MS)) {
      return cached.role;
    }

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

  async function applyHeaderState(user) {
    const { loginLink, userName, dropdown, adminPanelLink, connectNav } = getHeaderEls();

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
      if (connectNav) connectNav.style.display = "none";
      return;
    }

    if (loginLink) loginLink.style.display = "none";
    if (connectNav) connectNav.style.display = "inline-flex";

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

  async function init() {
    await waitForFirebase();

    if (!auth) {
      return;
    }


    auth.onAuthStateChanged(async (user) => {
      window.__ECHTLUCKY_CURRENT_USER__ = user || null;
      
      let lastUid = localStorage.getItem("__echtlucky_lastuid") || "__init__";
      
      if (user && db && db.collection) {
        lastUid = user.uid;
        localStorage.setItem("__echtlucky_lastuid", user.uid);
        try {
          const fb = window.firebase;
          const userRef = db.collection("users").doc(user.uid);
          const snap = await userRef.get();
          const data = snap.exists ? (snap.data() || {}) : {};

          const authName = user.displayName || (user.email ? user.email.split("@")[0] : "");
          const existingName = String(data.username || data.displayName || "").trim();
          const baseName = existingName || authName || "user";
          const sanitize = typeof appNS.sanitizeUsername === "function"
            ? appNS.sanitizeUsername
            : (raw) => String(raw || "").trim().toLowerCase().replace(/\s+/g, "").replace(/[^a-z0-9_.-]/g, "").slice(0, 20);
          const uname = sanitize(baseName);
          const ts = fb?.firestore?.FieldValue?.serverTimestamp?.() || new Date();

          const patch = {
            isOnline: true,
            lastSeen: new Date(),
            email: user.email || "",
            uid: user.uid
          };

          if (!snap.exists) {
            patch.createdAt = ts;
            patch.username = uname;
            patch.usernameLower = uname;
            patch.displayName = uname;
          } else {
            if (!String(data.username || "").trim() && uname) patch.username = uname;
            if (!String(data.usernameLower || "").trim() && uname) patch.usernameLower = uname;
            if (!String(data.displayName || "").trim() && (String(data.username || "").trim() || uname)) {
              patch.displayName = String(data.username || "").trim() || uname;
            }
          }

          await userRef.set(patch, { merge: true });
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
      const evt = new CustomEvent('echtlucky:auth-change', { detail: { user } });
      window.dispatchEvent(evt);
      document.dispatchEvent(evt);
    });

    window.addEventListener("echtlucky:header-ready", async () => {
      const u = auth.currentUser || null;
      window.__ECHTLUCKY_CURRENT_USER__ = u;
      await applyHeaderState(u);
      applyAccountCTAs(u);
    });

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

