// js/menu.js — FINAL v2 (Fetch-Header kompatibel, anti-flicker, single auth listener)
(function () {
  "use strict";

  // Prevent double load (if script is included twice by accident)
  if (window.__ECHTLUCKY_MENU_JS_LOADED__) {
    console.warn("menu.js already loaded – skipping");
    return;
  }
  window.__ECHTLUCKY_MENU_JS_LOADED__ = true;

  // Global state
  window.__ECHTLUCKY_CURRENT_USER__ = window.__ECHTLUCKY_CURRENT_USER__ || null;

  /* =========================
     🧩 Helpers
  ========================= */
  function qs(id) {
    return document.getElementById(id);
  }

  // Re-render auth UI whenever header is (re)injected
  function renderAuthUI(user) {
    const userNameDisplay = qs("user-name-display");
    const dropdownMenu = qs("dropdown-menu");
    const loginLink = qs("login-link");
    const adminPanelLink = qs("admin-panel-link");

    // If header not present yet, just return
    if (!loginLink && !userNameDisplay && !adminPanelLink) return;

    if (user) {
      if (loginLink) loginLink.style.display = "none";

      if (userNameDisplay) {
        userNameDisplay.textContent =
          user.displayName || (user.email ? user.email.split("@")[0] : "User");
        userNameDisplay.style.display = "inline-flex";
      }

      // Admin Link (email fallback)
      const ADMIN_EMAIL = "lucassteckel04@gmail.com";
      if (adminPanelLink) {
        adminPanelLink.style.display =
          user.email && user.email === ADMIN_EMAIL ? "block" : "none";
      }
    } else {
      if (loginLink) loginLink.style.display = "inline-flex";
      if (userNameDisplay) userNameDisplay.style.display = "none";
      if (dropdownMenu) dropdownMenu.classList.remove("show");
      if (adminPanelLink) adminPanelLink.style.display = "none";
    }
  }

  function setActiveNavLink() {
    const currentPath = window.location.pathname.split("/").pop() || "index.html";
    document.querySelectorAll(".nav-links a").forEach((link) => {
      const linkPath = link.getAttribute("href");
      link.classList.toggle(
        "active",
        linkPath === currentPath || (currentPath === "" && linkPath === "index.html")
      );
    });
  }

  /* =========================
     ✅ Public init (call after fetch(header.html))
  ========================= */
  window.initHeaderScripts = function initHeaderScripts() {
    // Header elements exist only after fetch(header.html)
    const userNameDisplay = qs("user-name-display");
    const dropdownMenu = qs("dropdown-menu");
    const menuToggle = qs("menuToggle");
    const mainNav = qs("mainNav");

    /* 📱 Mobile Menü Toggle */
    if (menuToggle && mainNav && !menuToggle.__wired) {
      menuToggle.__wired = true;

      menuToggle.addEventListener("click", (e) => {
        e.stopPropagation();
        mainNav.classList.toggle("open");
      });

      document.addEventListener("click", () => {
        mainNav.classList.remove("open");
      });

      window.addEventListener("resize", () => {
        if (window.innerWidth > 992) mainNav.classList.remove("open");
      });
    }

    /* 👤 Dropdown */
    if (userNameDisplay && dropdownMenu && !userNameDisplay.__wired) {
      userNameDisplay.__wired = true;

      userNameDisplay.addEventListener("click", (e) => {
        e.stopPropagation();
        dropdownMenu.classList.toggle("show");
      });

      document.addEventListener("click", (e) => {
        if (!dropdownMenu.contains(e.target) && !userNameDisplay.contains(e.target)) {
          dropdownMenu.classList.remove("show");
        }
      });
    }

    /* 🔗 Active Link */
    setActiveNavLink();

    /* 🔐 Apply current auth state immediately (prevents header blink) */
    renderAuthUI(window.__ECHTLUCKY_CURRENT_USER__);
  };

  /* =========================
     🔐 SINGLE Auth Listener (global)
     - attaches once per page load
  ========================= */
  function ensureAuthListener() {
    if (window.__ECHTLUCKY_AUTH_LISTENER_SET__) return;
    window.__ECHTLUCKY_AUTH_LISTENER_SET__ = true;

    const auth = window.auth || window.echtlucky?.auth;
    if (!auth || typeof auth.onAuthStateChanged !== "function") {
      console.warn("Auth not ready yet – auth listener will not attach.");
      return;
    }

    auth.onAuthStateChanged((user) => {
      window.__ECHTLUCKY_CURRENT_USER__ = user || null;
      renderAuthUI(user || null);
    });
  }

  // Try immediately (firebase.js might already be loaded)
  ensureAuthListener();

  /* =========================
     🚪 Logout global (used by header.html onclick)
  ========================= */
  window.logout = function logout() {
    const auth = window.auth || window.echtlucky?.auth;
    if (!auth) return;

    auth
      .signOut()
      .then(() => (window.location.href = "index.html"))
      .catch((err) => alert("Ausloggen fehlgeschlagen: " + err.message));
  };

  /* =========================
     🧠 Smart Header Scroll (single init)
  ========================= */
  window.initSmartHeaderScroll = function initSmartHeaderScroll() {
    if (window.__ECHTLUCKY_SMART_HEADER__) return;
    window.__ECHTLUCKY_SMART_HEADER__ = true;

    const header = document.querySelector("header.site-header");
    if (!header) return;

    let lastY = window.scrollY;
    let downAcc = 0;

    window.addEventListener(
      "scroll",
      () => {
        const y = window.scrollY;
        const diff = y - lastY;

        if (y <= 10) {
          header.classList.remove("header-hidden");
          downAcc = 0;
          lastY = y;
          return;
        }

        if (diff > 0) {
          downAcc += diff;
          if (downAcc > 25) header.classList.add("header-hidden");
        }

        if (diff < 0) {
          header.classList.remove("header-hidden");
          downAcc = 0;
        }

        lastY = y;
      },
      { passive: true }
    );
  };
})();