// js/menu.js – zentrierter, interaktiver Header

function initHeaderScripts() {
  const userNameDisplay = document.getElementById('user-name-display');
  const loginLink = document.getElementById('login-link');
  const adminPanelLink = document.getElementById('admin-panel-link');
  const logoutBtn = document.getElementById('logout-btn');

  // =========================
  // 🔐 Firebase Auth
  // =========================
  if (typeof auth !== "undefined") {
    auth.onAuthStateChanged((user) => {
      if (user) {
        // Login-Link ausblenden
        if (loginLink) loginLink.style.display = 'none';

        // Username anzeigen
        if (userNameDisplay) {
          userNameDisplay.textContent = user.displayName || user.email.split('@')[0];
          userNameDisplay.style.display = 'inline-block';
        }

        // Logout-Button anzeigen
        if (logoutBtn) logoutBtn.style.display = 'inline-block';

        // Admin-Link anzeigen
        const ADMIN_EMAIL = "lucassteckel04@gmail.com";
        if (adminPanelLink) {
          adminPanelLink.style.display = user.email === ADMIN_EMAIL ? 'inline-block' : 'none';
        }
      } else {
        // Nicht eingeloggt
        if (loginLink) loginLink.style.display = 'inline-block';
        if (userNameDisplay) userNameDisplay.style.display = 'none';
        if (logoutBtn) logoutBtn.style.display = 'none';
        if (adminPanelLink) adminPanelLink.style.display = 'none';
      }
    });
  }

  // =========================
  // Logout
  // =========================
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      auth.signOut()
        .then(() => window.location.href = 'index.html')
        .catch(err => alert('Ausloggen fehlgeschlagen: ' + err.message));
    });
  }

  // =========================
  // Active Link
  // =========================
  const currentPath = window.location.pathname.split("/").pop() || "index.html";

  document.querySelectorAll(".nav-link").forEach(link => {
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

// Init automatisch beim Laden
document.addEventListener('DOMContentLoaded', initHeaderScripts);
