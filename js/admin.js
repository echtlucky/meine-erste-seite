/* ======================================================
   🧠 ADMIN PANEL – UI & ROLE LOGIC
====================================================== */

/* =========================
   🔧 STATE
========================= */
let currentUser = null;
let currentRole = null;

/* =========================
   🔐 ROLE DEFINITIONS
========================= */
const ROLE_HIERARCHY = {
  supporter: 1,
  mod: 2,
  admin: 3
};

/* =========================
   🚀 INIT
========================= */
document.addEventListener("DOMContentLoaded", () => {
  initAuthGuard();
  initSidebar();
  initModals();
});

/* =========================
   🔐 AUTH GUARD
========================= */
function initAuthGuard() {
  auth.onAuthStateChanged(async (user) => {
    if (!user) {
      window.location.href = "../index.html";
      return;
    }

    currentUser = user;
    document.getElementById("user-email").textContent = user.email;

    const role = await fetchUserRole(user.uid);
    currentRole = role;

    applyRoleUI(role);

    document.getElementById("current-role").textContent =
      role.toUpperCase();

    document.body.classList.remove("admin-loading");
    document.body.classList.add("admin-loaded");
  });
}

/* =========================
   🧑‍💼 FETCH ROLE
========================= */
async function fetchUserRole(uid) {
  try {
    const snap = await db.collection("users").doc(uid).get();
    if (!snap.exists) return "supporter";
    return snap.data().role || "supporter";
  } catch (err) {
    console.error("Role fetch failed:", err);
    return "supporter";
  }
}

/* =========================
   🎭 APPLY ROLE UI
========================= */
function applyRoleUI(role) {
  document.querySelectorAll(".sidebar-item").forEach(item => {
    const requiredRole = item.dataset.role;

    if (!requiredRole) return;

    if (
      ROLE_HIERARCHY[role] <
      ROLE_HIERARCHY[requiredRole]
    ) {
      item.style.display = "none";
    }
  });
}

/* =========================
   📚 SIDEBAR LOGIC
========================= */
function initSidebar() {
  const items = document.querySelectorAll(".sidebar-item");

  items.forEach(item => {
    item.addEventListener("click", () => {
      const tabId = item.dataset.tab;
      if (!tabId) return;

      switchTab(tabId);

      items.forEach(i => i.classList.remove("active"));
      item.classList.add("active");
    });
  });
}

/* =========================
   📄 TAB SWITCH
========================= */
function switchTab(tabId) {
  document.querySelectorAll(".tab").forEach(tab => {
    tab.classList.remove("active");
  });

  const target = document.getElementById(tabId);
  if (target) target.classList.add("active");
}

/* =========================
   🪟 MODALS
========================= */
function initModals() {
  document.querySelectorAll(".modal").forEach(modal => {
    modal.addEventListener("click", (e) => {
      if (e.target.classList.contains("modal")) {
        modal.classList.remove("show");
      }
    });
  });
}

function openPostModal() {
  guardRole("mod", () => {
    document.getElementById("postModal").classList.add("show");
  });
}

function closePostModal() {
  document.getElementById("postModal").classList.remove("show");
}

/* =========================
   🛡️ ROLE GUARD
========================= */
function guardRole(requiredRole, callback) {
  if (
    ROLE_HIERARCHY[currentRole] >=
    ROLE_HIERARCHY[requiredRole]
  ) {
    callback();
  } else {
    alert("❌ Keine Berechtigung");
  }
}

/* =========================
   🔘 ACTION PLACEHOLDERS
   (Firebase kommt in Teil 4)
========================= */
function savePost() {
  guardRole("mod", () => {
    alert("✔️ savePost() – Firebase kommt in Teil 4");
  });
}

function banUser() {
  guardRole("mod", () => {
    alert("✔️ banUser() – Firebase kommt in Teil 4");
  });
}

/* =========================
   🚪 LOGOUT
========================= */
function logout() {
  auth.signOut().then(() => {
    window.location.href = "../index.html";
  });
}
