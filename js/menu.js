(function () {
  "use strict";

  if (window.__ECHTLUCKY_MENU_JS_LOADED__) return;
  window.__ECHTLUCKY_MENU_JS_LOADED__ = true;

  window.__ECHTLUCKY_CURRENT_USER__ = window.__ECHTLUCKY_CURRENT_USER__ || null;

  
  const qs = (id) => document.getElementById(id);

  function getAuth() {
    return window.auth || window.echtlucky?.auth || null;
  }

  function getUserLabel(user) {
    if (!user) return "User";
    return user.displayName || (user.email ? user.email.split("@")[0] : "User");
  }

  
  function setActiveNavLink() {
    const currentPath = window.location.pathname.split("/").pop() || "index.html";
    const links = Array.from(document.querySelectorAll(".nav-links a, .hub-menu a"));
    let anyActive = false;

    links.forEach((link) => {
      const linkPath = link.getAttribute("href");
      const isActive = linkPath === currentPath || (currentPath === "" && linkPath === "index.html");
      link.classList.toggle("active", isActive);
      anyActive = anyActive || isActive;
    });

    const hubToggle = qs("hubToggle");
    if (hubToggle) hubToggle.classList.toggle("active", anyActive);
  }

  
  function updateAccountCTAs(user) {
    const ctas = document.querySelectorAll("[data-account-cta]");
    if (!ctas.length) return;

    ctas.forEach((el) => {

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


window.renderAuthUI = function renderAuthUI(user) {
  const userNameDisplay = qs("user-name-display");
  const dropdownMenu = qs("dropdown-menu");
  const loginLink = qs("login-link");
  const adminPanelLink = qs("admin-panel-link");

  if (!loginLink && !userNameDisplay && !adminPanelLink) return;

  if (user) {
    if (loginLink) loginLink.style.display = "none";

    if (userNameDisplay) {
      const nameText = userNameDisplay.querySelector(".user-name-text");
      const label =
        user.displayName ||
        (user.email ? user.email.split("@")[0] : "User");

      if (nameText) nameText.textContent = label;
      userNameDisplay.style.display = "inline-flex";

      userNameDisplay.setAttribute("aria-expanded", "false");
    }

    const ADMIN_EMAIL = "lucassteckel04@gmail.com";
    if (adminPanelLink) {
      adminPanelLink.style.display =
        user.email && user.email === ADMIN_EMAIL ? "block" : "none";
    }
  } else {
    if (loginLink) loginLink.style.display = "inline-flex";

    if (userNameDisplay) {
      userNameDisplay.style.display = "none";
      userNameDisplay.setAttribute("aria-expanded", "false");
    }

    if (dropdownMenu) dropdownMenu.classList.remove("show");
    if (adminPanelLink) adminPanelLink.style.display = "none";
  }
};

  
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

    document.addEventListener("click", (e) => {
      if (!mainNav.contains(e.target) && !menuToggle.contains(e.target)) {
        mainNav.classList.remove("open");
        menuToggle.setAttribute("aria-expanded", "false");
        menuToggle.classList.remove("is-open");
      }
    });

    mainNav.querySelectorAll("a").forEach((a) => {
      a.addEventListener("click", () => {
        mainNav.classList.remove("open");
        menuToggle.setAttribute("aria-expanded", "false");
        menuToggle.classList.remove("is-open");
      });
    });

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

  function closeDropdown(el) {
    if (!el) return;
    el.classList.remove("show");
  }

  function wireHoverDelay(toggle, menu) {
    if (!toggle || !menu) return;

    let closeTimer = null;

    function open() {
      if (closeTimer) window.clearTimeout(closeTimer);
      closeTimer = null;
      menu.classList.add("show");
      toggle.setAttribute("aria-expanded", "true");
    }

    function scheduleClose() {
      if (closeTimer) window.clearTimeout(closeTimer);
      closeTimer = window.setTimeout(() => {
        menu.classList.remove("show");
        toggle.setAttribute("aria-expanded", "false");
      }, 1000);
    }

    toggle.addEventListener("mouseenter", () => {
      if (window.innerWidth <= 992) return;
      open();
    });
    toggle.addEventListener("mouseleave", () => {
      if (window.innerWidth <= 992) return;
      scheduleClose();
    });
    menu.addEventListener("mouseenter", () => {
      if (window.innerWidth <= 992) return;
      open();
    });
    menu.addEventListener("mouseleave", () => {
      if (window.innerWidth <= 992) return;
      scheduleClose();
    });
  }

  function wireHubDropdown() {
    const toggle = qs("hubToggle");
    const menu = qs("hubMenu");
    if (!toggle || !menu || toggle.__wired) return;

    toggle.__wired = true;
    toggle.setAttribute("aria-expanded", "false");

    toggle.addEventListener("click", (e) => {
      e.stopPropagation();
      menu.classList.toggle("show");
      const isOpen = menu.classList.contains("show");
      toggle.setAttribute("aria-expanded", String(isOpen));
    });

    document.addEventListener("click", (e) => {
      if (!menu.contains(e.target) && !toggle.contains(e.target)) {
        closeDropdown(menu);
        toggle.setAttribute("aria-expanded", "false");
      }
    });

    wireHoverDelay(toggle, menu);
  }

  function wireGroupsDropdown() {
    const toggle = qs("groupsToggle");
    const menu = qs("groupsMenu");
    if (!toggle || !menu || toggle.__wired) return;

    toggle.__wired = true;
    toggle.setAttribute("aria-expanded", "false");

    toggle.addEventListener("click", (e) => {
      e.stopPropagation();
      menu.classList.toggle("show");
      const isOpen = menu.classList.contains("show");
      toggle.setAttribute("aria-expanded", String(isOpen));
    });

    document.addEventListener("click", (e) => {
      if (!menu.contains(e.target) && !toggle.contains(e.target)) {
        closeDropdown(menu);
        toggle.setAttribute("aria-expanded", "false");
      }
    });

    wireHoverDelay(toggle, menu);
  }

  function ensureGroupStripLoaded() {
    if (window.__ECHTLUCKY_GROUP_STRIP_V2__) return;
    const existing = document.querySelector("script[src*='js/group-strip-v2.js']");
    if (existing) return;

    const s = document.createElement("script");
    s.src = "js/group-strip-v2.js?v=1";
    s.defer = true;
    document.head.appendChild(s);
  }

  
  window.initHeaderScripts = function initHeaderScripts() {
    wireMobileMenu();
    wireDropdown();
    wireHubDropdown();
    wireGroupsDropdown();
    setActiveNavLink();
    ensureGroupStripLoaded();

    renderAuthUI(window.__ECHTLUCKY_CURRENT_USER__);
  };

  
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

  
  window.logout = function logout() {
    const auth = getAuth();
    if (!auth) return;

    auth.signOut()
      .then(() => {
        if (window.notify?.success) {
          window.notify.success("Erfolgreich abgemeldet", "Logout", 3500);
        }
        window.location.href = "index.html";
      })
      .catch((err) => {
        if (window.notify?.error) {
          window.notify.error("Ausloggen fehlgeschlagen: " + (err?.message || "Unbekannt"), "Fehler", 4500);
        } else if (window.echtluckyModal?.alert) {
          window.echtluckyModal.alert({
            title: "Fehler",
            message: "Ausloggen fehlgeschlagen: " + (err?.message || "Unbekannt"),
            type: "error"
          });
        }
      });
  };

  
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

  (function ensureAuthListener() {
    if (attachAuthListener()) return;

    let tries = 0;
    const maxTries = 20; // ~2s (20 * 100ms)
    const timer = setInterval(() => {
      tries++;
      if (attachAuthListener() || tries >= maxTries) clearInterval(timer);

      renderAuthUI(window.__ECHTLUCKY_CURRENT_USER__);
    }, 100);
  })();

  
  document.addEventListener("DOMContentLoaded", () => {
    updateAccountCTAs(window.__ECHTLUCKY_CURRENT_USER__);
  });

})();
