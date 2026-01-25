// js/menu.js — FINAL v4
// - Fetch-Header kompatibel
// - Anti-flicker + robust gegen Timing (Firebase lädt manchmal später)
// - SINGLE auth listener
// - Mobile-Menü fix
// - Dropdown fix
// - GLOBAL Account-CTA (data-account-cta) -> "Account erstellen" vs "Account verwalten"

(function () {
  "use strict";

  // Prevent double load
  if (window.__ECHTLUCKY_MENU_JS_LOADED__) {
    console.warn("menu.js already loaded – skipping");
    return;
  }
  window.__ECHTLUCKY_MENU_JS_LOADED__ = true;

  // Global user state
  window.__ECHTLUCKY_CURRENT_USER__ = window.__ECHTLUCKY_CURRENT_USER__ || null;

  /* =========================
     Helpers
  ========================= */
  const qs = (id) => document.getElementById(id);

  function getAuth() {
    return window.auth || window.echtlucky?.auth || null;
  }

  function getUserLabel(user) {
    if (!user) return "User";
    return user.displayName || (user.email ? user.email.split("@")[0] : "User");
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
     Account CTA (global)
     - any element with [data-account-cta]
     - optional overrides via data attrs
  ========================= */
  function updateAccountCTAs(user) {
    const ctas = document.querySelectorAll("[data-account-cta]");
    if (!ctas.length) return;

    ctas.forEach((el) => {
      // you can override defaults:
      // data-cta-logged-out-text="Account erstellen"
      // data-cta-logged-in-text="Account verwalten"
      // data-cta-logged-out-href="login.html"
      // data-cta-logged-in-href="account.html"

      const outText = el.getAttribute("data-cta-logged-out-text") || "Account erstellen";
      const inText  = el.getAttribute("data-cta-logged-in-text")  || "Account verwalten";

      const outHref = el.getAttribute("data-cta-logged-out-href") || "login.html";
      const inHref  = el.getAttribute("data-cta-logged-in-href")  || "account.html";

      if (user) {
        if (el.tagName.toLowerCase() === "a") el.setAttribute("href", inHref);
        el.textContent = inText;
        el.classList.add("is-logged-in");
        el.classList.remove("is-logged-out");
      } else {
        if (el.tagName.toLowerCase() === "a") el.setAttribute("href", outHref);
        el.textContent = outText;
        el.classList.add("is-logged-out");
        el.classList.remove("is-logged-in");
      }
    });
  }

/* =========================
   Header Auth UI (UPDATED)
========================= */
window.renderAuthUI = function renderAuthUI(user) {
  const userNameDisplay = qs("user-name-display");
  const dropdownMenu = qs("dropdown-menu");
  const loginLink = qs("login-link");
  const adminPanelLink = qs("admin-panel-link");

  // Header noch nicht geladen? -> raus
  if (!loginLink && !userNameDisplay && !adminPanelLink) return;

  if (user) {
    // Login-Link verstecken
    if (loginLink) loginLink.style.display = "none";

    // Username-Button zeigen + nur Text im Child setzen
    if (userNameDisplay) {
      const nameText = userNameDisplay.querySelector(".user-name-text");
      const label =
        user.displayName ||
        (user.email ? user.email.split("@")[0] : "User");

      if (nameText) nameText.textContent = label;
      userNameDisplay.style.display = "inline-flex";

      // A11y state reset (Dropdown zu beim Render)
      userNameDisplay.setAttribute("aria-expanded", "false");
    }

    // Admin Link (email fallback)
    const ADMIN_EMAIL = "lucassteckel04@gmail.com";
    if (adminPanelLink) {
      adminPanelLink.style.display =
        user.email && user.email === ADMIN_EMAIL ? "block" : "none";
    }
  } else {
    // Logout state
    if (loginLink) loginLink.style.display = "inline-flex";

    if (userNameDisplay) {
      userNameDisplay.style.display = "none";
      userNameDisplay.setAttribute("aria-expanded", "false");
    }

    if (dropdownMenu) dropdownMenu.classList.remove("show");
    if (adminPanelLink) adminPanelLink.style.display = "none";
  }
};

  /* =========================
     Wiring: Mobile menu + Dropdown
  ========================= */
  function wireMobileMenu() {
    const menuToggle = qs("menuToggle");
    const mainNav = qs("mainNav");
    if (!menuToggle || !mainNav || menuToggle.__wired) return;

    menuToggle.__wired = true;
    menuToggle.setAttribute("aria-expanded", "false");

    menuToggle.addEventListener("click", (e) => {
      e.stopPropagation();
      mainNav.classList.toggle("open");
      const isOpen = mainNav.classList.contains("open");
      menuToggle.setAttribute("aria-expanded", String(isOpen));
      menuToggle.classList.toggle("is-open", isOpen);
    });

    // close on outside click
    document.addEventListener("click", (e) => {
      if (!mainNav.contains(e.target) && !menuToggle.contains(e.target)) {
        mainNav.classList.remove("open");
        menuToggle.setAttribute("aria-expanded", "false");
        menuToggle.classList.remove("is-open");
      }
    });

    // close after clicking a link
    mainNav.querySelectorAll("a").forEach((a) => {
      a.addEventListener("click", () => {
        mainNav.classList.remove("open");
        menuToggle.setAttribute("aria-expanded", "false");
        menuToggle.classList.remove("is-open");
      });
    });

    // resize reset
    window.addEventListener("resize", () => {
      if (window.innerWidth > 992) {
        mainNav.classList.remove("open");
        menuToggle.setAttribute("aria-expanded", "false");
        menuToggle.classList.remove("is-open");
      }
    });
  }

  function wireDropdown() {
    const userNameDisplay = qs("user-name-display");
    const dropdownMenu = qs("dropdown-menu");
    if (!userNameDisplay || !dropdownMenu || userNameDisplay.__wired) return;

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

  /* =========================
     Public init (call after fetch(header.html))
  ========================= */
  window.initHeaderScripts = function initHeaderScripts() {
    wireMobileMenu();
    wireDropdown();
    setActiveNavLink();

    // apply current state immediately
    renderAuthUI(window.__ECHTLUCKY_CURRENT_USER__);
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

  /* =========================
     Logout global
  ========================= */
  window.logout = function logout() {
    const auth = getAuth();
    if (!auth) return;

    auth
      .signOut()
      .then(() => (window.location.href = "index.html"))
      .catch((err) => alert("Ausloggen fehlgeschlagen: " + (err?.message || "Unbekannt")));
  };

  /* =========================
     SINGLE auth listener — robust timing
     - If firebase auth isn't ready yet, we retry a few times.
  ========================= */
  function attachAuthListener() {
    if (window.__ECHTLUCKY_AUTH_LISTENER_SET__) return true;

    const auth = getAuth();
    if (!auth || typeof auth.onAuthStateChanged !== "function") return false;

    window.__ECHTLUCKY_AUTH_LISTENER_SET__ = true;

    auth.onAuthStateChanged((user) => {
      window.__ECHTLUCKY_CURRENT_USER__ = user || null;
      renderAuthUI(user || null);
    });

    return true;
  }

  // Try now + retry (for slow firebase init)
  (function ensureAuthListener() {
    if (attachAuthListener()) return;

    let tries = 0;
    const maxTries = 20; // ~2s (20 * 100ms)
    const timer = setInterval(() => {
      tries++;
      if (attachAuthListener() || tries >= maxTries) clearInterval(timer);

      // Even if no auth yet: keep CTA correct based on current global user (might be null)
      renderAuthUI(window.__ECHTLUCKY_CURRENT_USER__);
    }, 100);
  })();

  /* =========================
     Also update CTA on DOM ready (pages without header fetch yet)
  ========================= */
  document.addEventListener("DOMContentLoaded", () => {
    updateAccountCTAs(window.__ECHTLUCKY_CURRENT_USER__);
  });

})();