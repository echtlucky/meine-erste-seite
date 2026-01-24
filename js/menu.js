// js/menu.js – FINAL (Header via fetch kompatibel)

let authListenerInitialized = false;

function initHeaderScripts() {
  // Header-Elemente (existieren erst nach fetch(header.html))
  const userNameDisplay = document.getElementById('user-name-display');
  const dropdownMenu = document.getElementById('dropdown-menu');
  const loginLink = document.getElementById('login-link');
  const adminPanelLink = document.getElementById('admin-panel-link');
  const menuToggle = document.getElementById('menuToggle');
  const mainNav = document.getElementById('mainNav');

  /* =========================
     📱 Mobile Menü Toggle
     ========================= */
  if (menuToggle && mainNav) {
    menuToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      mainNav.classList.toggle('open');
    });

    // Klick außerhalb => Menü zu (nur auf Mobile relevant)
    document.addEventListener('click', () => {
      mainNav.classList.remove('open');
    });

    // Resize => Menü resetten
    window.addEventListener('resize', () => {
      if (window.innerWidth > 992) {
        mainNav.classList.remove('open');
      }
    });
  }

  /* =========================
     👤 Dropdown (Click, Mobile-safe)
     ========================= */
  if (userNameDisplay && dropdownMenu) {
    userNameDisplay.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdownMenu.classList.toggle('show');
    });

    document.addEventListener('click', (e) => {
      if (!dropdownMenu.contains(e.target) && !userNameDisplay.contains(e.target)) {
        dropdownMenu.classList.remove('show');
      }
    });
  }

  /* =========================
     🔗 Active Link automatisch setzen
     ========================= */
  const currentPath = window.location.pathname.split("/").pop() || "index.html";

  document.querySelectorAll(".nav-links a").forEach(link => {
    const linkPath = link.getAttribute("href");
    link.classList.remove("active");

    if (linkPath === currentPath || (currentPath === "" && linkPath === "index.html")) {
      link.classList.add("active");
    }
  });

  /* =========================
     🔐 Firebase Auth (nur 1x Listener)
     ========================= */
  if (!authListenerInitialized && typeof window.auth !== "undefined") {
    authListenerInitialized = true;

    auth.onAuthStateChanged((user) => {
      if (user) {
        if (loginLink) loginLink.style.display = 'none';

        if (userNameDisplay) {
          userNameDisplay.textContent = user.displayName || user.email.split('@')[0];
          userNameDisplay.style.display = 'inline-block';
        }

        // Admin Link
        const ADMIN_EMAIL = "lucassteckel04@gmail.com";
        if (adminPanelLink) {
          adminPanelLink.style.display = (user.email === ADMIN_EMAIL) ? 'block' : 'none';
        }
      } else {
        if (loginLink) loginLink.style.display = 'inline-block';
        if (userNameDisplay) userNameDisplay.style.display = 'none';
        if (dropdownMenu) dropdownMenu.classList.remove('show');
        if (adminPanelLink) adminPanelLink.style.display = 'none';
      }
    });
  }
}

/* =========================
   🚪 Logout global (für onclick im header.html)
   ========================= */
function logout() {
  if (typeof window.auth === "undefined") return;

  auth.signOut()
    .then(() => {
      window.location.href = 'index.html';
    })
    .catch((err) => {
      alert('Ausloggen fehlgeschlagen: ' + err.message);
    });
}

let lastScrollY = window.scrollY;
let ticking = false;

function initSmartHeaderScroll() {
  const header = document.querySelector('.site-header');
  if (!header) return;

  function handleScroll() {
    const currentY = window.scrollY;

    // ganz oben: header immer sichtbar
    if (currentY <= 10) {
      header.classList.remove('header-hidden');
      lastScrollY = currentY;
      return;
    }

    // runter scrollen => ausblenden
    if (currentY > lastScrollY && currentY > 80) {
      header.classList.add('header-hidden');
    }

    // hoch scrollen => einblenden (auch minimal!)
    if (currentY < lastScrollY) {
      header.classList.remove('header-hidden');
    }

    lastScrollY = currentY;
  }

  window.addEventListener('scroll', () => {
    if (!ticking) {
      window.requestAnimationFrame(() => {
        handleScroll();
        ticking = false;
      });
      ticking = true;
    }
  });
}