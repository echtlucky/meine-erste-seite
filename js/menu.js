// js/menu.js – stabil & Firebase-safe

function initHeaderScripts() {
  const userNameDisplay = document.getElementById('user-name-display');
  const dropdownMenu = document.getElementById('dropdown-menu');
  const loginLink = document.getElementById('login-link');
  const adminPanelLink = document.getElementById('admin-panel-link');

  // Firebase Auth prüfen
  auth.onAuthStateChanged((user) => {
    if (user) {
      if (loginLink) loginLink.style.display = 'none';
      if (userNameDisplay) {
        userNameDisplay.textContent = user.displayName || user.email.split('@')[0];
        userNameDisplay.style.display = 'inline-block';
      }

      const ADMIN_EMAIL = "lucassteckel04@gmail.com";
      if (user.email === ADMIN_EMAIL && adminPanelLink) {
        adminPanelLink.style.display = 'block';
      }
    } else {
      if (loginLink) loginLink.style.display = 'inline-block';
      if (userNameDisplay) userNameDisplay.style.display = 'none';
      if (dropdownMenu) dropdownMenu.classList.remove('show');
      if (adminPanelLink) adminPanelLink.style.display = 'none';
    }
  });

  // Dropdown Hover
  if (userNameDisplay && dropdownMenu) {
    userNameDisplay.addEventListener('mouseenter', () => {
      dropdownMenu.classList.add('show');
    });

    document.addEventListener('click', (e) => {
      if (!userNameDisplay.contains(e.target) && !dropdownMenu.contains(e.target)) {
        dropdownMenu.classList.remove('show');
      }
    });
  }

  // Menu Toggle für mobile Ansicht
  const menuToggle = document.getElementById('menuToggle');
  const mainNav = document.getElementById('mainNav');
  if (menuToggle && mainNav) {
    menuToggle.addEventListener('click', () => {
      mainNav.classList.toggle('open');
    });
  }
}

// Logout-Funktion global verfügbar machen
function logout() {
  auth.signOut()
    .then(() => {
      alert('Erfolgreich ausgeloggt!');
      window.location.href = 'index.html';
    })
    .catch((err) => {
      alert('Ausloggen fehlgeschlagen: ' + err.message);
    });
}
