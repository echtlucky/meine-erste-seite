// js/menu.js – stabil & Firebase-safe

document.addEventListener("DOMContentLoaded", () => {
  const menuToggle = document.getElementById("menuToggle");
  const mainNav = document.getElementById("mainNav");

  if (!menuToggle || !mainNav) return;

  // Menü öffnen / schließen
  menuToggle.addEventListener("click", (e) => {
    e.stopPropagation();
    mainNav.classList.toggle("active");
  });

  // Klick außerhalb schließt Menü
  document.addEventListener("click", (e) => {
    if (!mainNav.classList.contains("active")) return;

    if (!mainNav.contains(e.target) && !menuToggle.contains(e.target)) {
      mainNav.classList.remove("active");
    }
  });
});
