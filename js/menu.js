// js/menu.js — FINAL v4
// Fetch-Header kompatibel, anti-flicker, SINGLE auth listener,
// Mobile-Menü fix, Account-CTA Switch (Account erstellen ↔ verwalten)
(function () {
  "use strict";

  // Prevent double load (if script is included twice by accident)
  if (window.__ECHTLUCKY_MENU_JS_LOADED__) {
    console.warn("menu.js already loaded – skipping");
    return;
  }
  window.__ECHTLUCKY_MENU_JS_LOADED__ = true;

  // Global user cache (shared across pages)
  window.__ECHTLUCKY_CURRENT_USER__ = window.__ECHTLUCKY_CURRENT_USER__ || null;

  /* =========================
     Helpers
  ========================= */
  function qs(id) {
    return document.getElementById(id);
  }

  function safeTextFromUser(user) {
    return (
      user?.displayName ||
      (user?.email ? user.email.split("@")[0] : null) ||
      "User"
    );
  }

  /* =========================
     AUTH UI (Header)
  ========================= */
  function renderAuthUI(user) {
    const userNameDisplay = qs("user-name-display");
    const dropdownMenu = qs("dropdown-menu");
    const loginLink = qs("login-link");
    const adminPanelLink = qs("admin-panel-link");

    // Header not injected yet? no problem.
    if (!loginLink && !userNameDisplay && !adminPanelLink) return;

    if (user) {
      if (loginLink) loginLink.style.display = "none";

      if (userNameDisplay) {
        userNameDisplay.textContent = safeTextFromUser(user);
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

  /* =========================
     Account CTA Switch (Site-wide)
     - Default:
       logged out -> "Account erstellen" (login.html)
       logged in  -> "Account verwalten" (account.html)
     - Works for ANY element that has:
       id="accountActionBtn" OR data-account-cta
  ========================= */
  function updateAccountCTA(user) {
    // 1) single known CTA
    const primary = document.getElementById("accountActionBtn");

    // 2) optional multiple CTAs
    const all = Array.from(document.querySelectorAll("[data-account-cta]"));

    const targets = [];
    if (primary) targets.push(primary);
    all.forEach((el) => targets.push(el));

    if (!targets.length) return;

    targets.forEach((btn) => {
      if (user) {
        btn.textContent = btn.getAttribute("data-cta-logged-in") || "Account verwalten";
        btn.setAttribute("href", btn.getAttribute("data-href-logged-in") || "account.html");
      } else {
        btn.textContent = btn.getAttribute("data-cta-logged-out") || "Account erstellen";
        btn.setAttribute("href", btn.getAttribute("data-href-logged-out") || "login.html");
      }
    });
  }

  /* =========================
     Active Nav Link
  ========================= */
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
     Public init (call after fetch(header.html))
  ========================= */
  window.initHeaderScripts = function initHeaderScripts() {
    const userNameDisplay = qs("user-name-display");
    const dropdownMenu = qs("dropdown-menu");
    const menuToggle = qs("menuToggle");
    const mainNav = qs("mainNav");

    /* =========================
       Mobile Menü Toggle
    ========================= */
    if (menuToggle && mainNav && !menuToggle.__wired) {
      menuToggle.__wired = true;
      menuToggle.setAttribute("aria-expanded", "false");

      menuToggle.addEventListener("click", (e) => {
        e.stopPropagation();
        mainNav.classList.toggle("open");

        const isOpen = mainNav.classList.contains("open");
        menuToggle.setAttribute("aria-expanded", String(isOpen));
        menuToggle.classList.toggle("is-open", isOpen);
      });

      // Close menu when clicking outside
      document.addEventListener("click", (e) => {
        if (!mainNav.contains(e.target) && !menuToggle.contains(e.target)) {
          mainNav.classList.remove("open");
          menuToggle.setAttribute("aria-expanded", "false");
          menuToggle.classList.remove("is-open");
        }
      });

      // Close menu after clicking a nav link
      mainNav.querySelectorAll("a").forEach((a) => {
        a.addEventListener("click", () => {
          mainNav.classList.remove("open");
          menuToggle.setAttribute("aria-expanded", "false");
          menuToggle.classList.remove("is-open");
        });
      });

      // Resize => reset menu
      window.addEventListener("resize", () => {
        if (window.innerWidth > 992) {
          mainNav.classList.remove("open");
          menuToggle.setAttribute("aria-expanded", "false");
          menuToggle.classList.remove("is-open");
        }
      });
    }

    /* =========================
       Dropdown (User)
    ========================= */
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

    // Active link
    setActiveNavLink();

    // Apply current auth state to freshly injected header + CTAs
    const u = window.__ECHTLUCKY_CURRENT_USER__ || null;
    renderAuthUI(u);
    updateAccountCTA(u);
  };

  /* =========================
     SINGLE Auth Listener (global)
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

      // Update header & any CTA elements on the page
      renderAuthUI(user || null);
      updateAccountCTA(user || null);
    });
  }

  // Try immediately
  ensureAuthListener();

  /* =========================
     Logout global (used by header.html onclick)
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
     Smart Header Scroll (single init)
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