// js/menu.js – final & stabil

let authListenerInitialized = false;

function initHeaderScripts() {
  const userNameDisplay = document.getElementById('user-name-display');
  const dropdownMenu = document.getElementById('dropdown-menu');
  const loginLink = document.getElementById('login-link');
  const adminPanelLink = document.getElementById('admin-panel-link');
  const menuToggle = document.getElementById('menuToggle');
  const mainNav = document.getElementById('mainNav');

  /* =========================
     🔐 Firebase Auth (nur 1x)
     ========================= */
  if (!authListenerInitialized && typeof auth !== "undefined") {
    authListenerInitialized = true;

    auth.onAuthStateChanged((user) => {
      if (user) {
        if (loginLink) loginLink.style.display = 'none';

        if (userNameDisplay) {
          userNameDisplay.textContent =
            user.displayName || user.email.split('@')[0];
          userNameDisplay.style.display = 'inline-block';
        }

        // Admin-Link (aktuell per E-Mail)
        const ADMIN_EMAIL = "lucassteckel04@gmail.com";
        if (adminPanelLink) {
          adminPanelLink.style.display =
            user.email === ADMIN_EMAIL ? 'block' : 'none';
        }
      } else {
        if (loginLink) loginLink.style.display = 'inline-block';
        if (userNameDisplay) userNameDisplay.style.display = 'none';
        if (dropdownMenu) dropdownMenu.classList.remove('show');
        if (adminPanelLink) adminPanelLink.style.display = 'none';
      }
    });
  }

  /* =========================
     👤 User Dropdown (Click)
     ========================= */
  if (userNameDisplay && dropdownMenu) {
    userNameDisplay.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdownMenu.classList.toggle('show');
    });

    document.addEventListener('click', () => {
      dropdownMenu.classList.remove('show');
    });
  }

  /* =========================
     📱 Mobile Menü Toggle
     ========================= */
  if (menuToggle && mainNav) {
    menuToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      mainNav.classList.toggle('open');
    });

    document.addEventListener('click', () => {
      mainNav.classList.remove('open');
    });

    window.addEventListener('resize', () => {
      if (window.innerWidth > 768) {
        mainNav.classList.remove('open');
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

    if (
      linkPath === currentPath ||
      (currentPath === "index.html" && linkPath === "index.html")
    ) {
      link.classList.add("active");
    }
  });
}

/* =========================
   🚪 Logout global
   ========================= */
function logout() {
  auth.signOut()
    .then(() => {
      window.location.href = 'index.html';
    })
    .catch((err) => {
      alert('Ausloggen fehlgeschlagen: ' + err.message);
    });
}
