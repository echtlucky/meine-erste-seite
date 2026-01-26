/* =========================
   admin-panel.js — echtlucky (v2)
   Vollständiges Admin-Panel
========================= */

(() => {
  "use strict";

  const auth = window.auth || window.echtlucky?.auth;
  const db = window.db || window.echtlucky?.db;
  const ADMIN_EMAIL = "lucassteckel04@gmail.com";

  if (!auth || !db) {
    console.error("❌ Admin Panel: Firebase nicht initialisiert");
    return;
  }

  // DOM ELEMENTS
  const adminStatus = document.getElementById("adminStatus");
  const navButtons = document.querySelectorAll(".admin-nav__btn");
  
  // Blog
  const newPostBtn = document.getElementById("newPostBtn");
  const newPostModal = document.getElementById("newPostModal");
  const publishBtn = document.getElementById("publishBtn");
  const newTitle = document.getElementById("new-title");
  const newContent = document.getElementById("new-content");
  const postList = document.getElementById("post-list");

  // Users
  const userList = document.getElementById("user-list");

  // Bans
  const banEmail = document.getElementById("ban-email");
  const banReason = document.getElementById("ban-reason");
  const banAddBtn = document.getElementById("banAddBtn");
  const banList = document.getElementById("ban-list");

  // Logs
  const logsList = document.getElementById("logs-list");

  // Stats
  const statTotalUsers = document.getElementById("stat-total-users");
  const statTotalPosts = document.getElementById("stat-total-posts");
  const statTotalBans = document.getElementById("stat-total-bans");
  const activityList = document.getElementById("activity-list");

  // Settings
  const saveSettingsBtn = document.getElementById("saveSettingsBtn");
  const resetSettingsBtn = document.getElementById("resetSettingsBtn");

  // UTILITIES
  function escapeHtml(str) {
    const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
    return String(str || "").replace(/[&<>"']/g, (m) => map[m]);
  }

  function formatDate(ts) {
    if (!ts) return "—";
    try {
      const d = ts.toDate ? ts.toDate() : ts;
      return new Date(d).toLocaleString("de-DE");
    } catch {
      return "—";
    }
  }

  function notify(msg, type = "success") {
    const el = document.createElement("div");
    el.style.cssText = `
      position: fixed; top: 20px; right: 20px; padding: 12px 20px;
      border-radius: 8px; background: ${type === "success" ? "#00ff88" : "#ff3366"};
      color: ${type === "success" ? "#000" : "#fff"}; z-index: 9999; font-weight: 700;
    `;
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3000);
  }

  // ADMIN LOGGING
  async function logAdminAction(action, details) {
    try {
      const user = auth.currentUser;
      if (!user) return;
      await db.collection("admin-logs").add({
        action,
        details,
        admin: user.email,
        timestamp: new Date(),
      });
    } catch (err) {
      console.warn("Log failed:", err);
    }
  }

  async function loadAdminLogs() {
    try {
      logsList.innerHTML = "";
      const snap = await db.collection("admin-logs").orderBy("timestamp", "desc").limit(50).get();
      
      if (snap.empty) {
        logsList.innerHTML = `<p style="padding: 20px; color: var(--text-muted);">Keine Logs</p>`;
        return;
      }

      snap.forEach((doc) => {
        const data = doc.data();
        const item = document.createElement("div");
        item.className = "admin-log-item";
        item.innerHTML = `
          <div class="admin-log-header">
            <span class="admin-log-action">📝 ${escapeHtml(data.action)}</span>
            <span class="admin-log-time">${formatDate(data.timestamp)}</span>
          </div>
          <div class="admin-log-details">
            <small>${escapeHtml(data.details || "—")}</small>
            <small style="color: var(--text-muted);">von ${escapeHtml(data.admin || "—")}</small>
          </div>
        `;
        logsList.appendChild(item);
      });
    } catch (err) {
      logsList.innerHTML = `<p style="color: #ff3366;">Fehler: ${escapeHtml(err.message)}</p>`;
    }
  }

  async function loadPosts() {
    try {
      postList.innerHTML = "";
      const snap = await db.collection("posts").orderBy("createdAt", "desc").get();
      
      if (snap.empty) {
        postList.innerHTML = `<p style="padding: 20px; color: var(--text-muted);">Keine Posts vorhanden</p>`;
        return;
      }

      snap.forEach((doc) => {
        const post = doc.data();
        const item = document.createElement("div");
        item.className = "admin-post-item";
        item.innerHTML = `
          <div class="admin-post-meta">
            <h3>${escapeHtml(post.title || "Untitled")}</h3>
            <small>${formatDate(post.createdAt)}</small>
          </div>
          <div class="admin-post-actions">
            <button class="btn btn-ghost" onclick="window.editPostId='${doc.id}'; window.showEditModal()">Edit</button>
            <button class="btn btn-ghost" onclick="window.deletePost('${doc.id}')" style="color: #ff3366;">Delete</button>
          </div>
        `;
        postList.appendChild(item);
      });
    } catch (err) {
      postList.innerHTML = `<p style="color: #ff3366;">Fehler: ${escapeHtml(err.message)}</p>`;
    }
  }

  async function savePost() {
    const title = newTitle.value.trim();
    const content = newContent.value.trim();

    if (!title || !content) {
      notify("Title und Content erforderlich", "error");
      return;
    }

    try {
      const user = auth.currentUser;
      if (!window.editPostId) {
        await db.collection("posts").add({
          title,
          content,
          author: user.displayName || user.email,
          createdAt: new Date(),
        });
        await logAdminAction("post_created", `Post: "${title}" erstellt`);
      } else {
        await db.collection("posts").doc(window.editPostId).update({
          title,
          content,
          updatedAt: new Date(),
        });
        await logAdminAction("post_updated", `Post: "${title}" aktualisiert`);
        window.editPostId = null;
      }

      newTitle.value = "";
      newContent.value = "";
      newPostModal.classList.remove("show");
      notify("Post gespeichert! ✅");
      await loadPosts();
    } catch (err) {
      notify(`Fehler: ${err.message}`, "error");
    }
  }

  async function loadUsers() {
    try {
      userList.innerHTML = "";
      const snap = await db.collection("users").get();

      if (snap.empty) {
        userList.innerHTML = `<p style="padding: 20px;">Keine Users</p>`;
        return;
      }

      snap.forEach((doc) => {
        const user = doc.data();
        const role = user.role || "user";
        const item = document.createElement("div");
        item.className = "admin-user-item";
        item.innerHTML = `
          <div class="admin-user-info">
            <h3>${escapeHtml(user.email || "—")}</h3>
            <small>Rolle: <strong>${escapeHtml(role)}</strong></small>
          </div>
          <div class="admin-user-actions">
            <select class="admin-select" onchange="window.changeUserRole('${doc.id}', this.value)">
              <option value="user" ${role === "user" ? "selected" : ""}>User</option>
              <option value="admin" ${role === "admin" ? "selected" : ""}>Admin</option>
            </select>
          </div>
        `;
        userList.appendChild(item);
      });
    } catch (err) {
      userList.innerHTML = `<p style="color: #ff3366;">Fehler: ${escapeHtml(err.message)}</p>`;
    }
  }

  async function loadBans() {
    try {
      banList.innerHTML = "";
      const snap = await db.collection("bans").orderBy("bannedAt", "desc").get();

      if (snap.empty) {
        banList.innerHTML = `<p style="padding: 20px;">Keine Bans</p>`;
        return;
      }

      snap.forEach((doc) => {
        const ban = doc.data();
        const item = document.createElement("div");
        item.className = "admin-ban-item";
        item.innerHTML = `
          <div class="admin-ban-info">
            <strong style="color: #ff6699;">${escapeHtml(ban.email)}</strong>
            <small>Grund: ${escapeHtml(ban.reason || "—")}</small>
            <small>Datum: ${formatDate(ban.bannedAt)}</small>
          </div>
          <button class="btn btn-ghost" onclick="window.removeBan('${doc.id}')" style="color: #ff3366;">
            Entsperren
          </button>
        `;
        banList.appendChild(item);
      });
    } catch (err) {
      banList.innerHTML = `<p style="color: #ff3366;">Fehler: ${escapeHtml(err.message)}</p>`;
    }
  }

  async function addBan() {
    const email = banEmail.value.trim();
    const reason = banReason?.value?.trim() || "Kein Grund angegeben";

    if (!email) {
      notify("Email erforderlich", "error");
      return;
    }

    try {
      await db.collection("bans").add({
        email,
        reason,
        bannedAt: new Date(),
        bannedBy: auth.currentUser?.email,
      });

      await logAdminAction("user_banned", `User ${email} gebannt (${reason})`);
      banEmail.value = "";
      if (banReason) banReason.value = "";
      notify(`${email} gebannt! ✅`);
      await loadBans();
    } catch (err) {
      notify(`Fehler: ${err.message}`, "error");
    }
  }

  async function removeBan(banId) {
    if (!confirm("Ban wirklich aufheben?")) return;

    try {
      await db.collection("bans").doc(banId).delete();
      await logAdminAction("ban_removed", `Ban ${banId} entfernt`);
      notify("Ban aufgehoben! ✅");
      await loadBans();
    } catch (err) {
      notify(`Fehler: ${err.message}`, "error");
    }
  }

  async function loadStatistics() {
    try {
      const usersSnap = await db.collection("users").get();
      if (statTotalUsers) statTotalUsers.textContent = usersSnap.size;

      const postsSnap = await db.collection("posts").get();
      if (statTotalPosts) statTotalPosts.textContent = postsSnap.size;

      const bansSnap = await db.collection("bans").get();
      if (statTotalBans) statTotalBans.textContent = bansSnap.size;

      if (activityList) {
        activityList.innerHTML = "";
        const logsSnap = await db
          .collection("admin-logs")
          .orderBy("timestamp", "desc")
          .limit(10)
          .get();

        logsSnap.forEach((doc) => {
          const log = doc.data();
          const div = document.createElement("div");
          div.className = "admin-activity-item";
          div.innerHTML = `
            <span>${escapeHtml(log.action)}</span>
            <small>${formatDate(log.timestamp)}</small>
          `;
          activityList.appendChild(div);
        });
      }
    } catch (err) {
      console.error("Fehler beim Laden der Statistiken:", err);
    }
  }

  function loadSettings() {
    // Settings placeholder - can load from localStorage or Firestore
    console.log("Settings loaded");
  }

  function saveSettings() {
    notify("Einstellungen gespeichert! ✅");
    logAdminAction("settings_updated", "Admin-Einstellungen gespeichert");
  }

  // Setup Event Listeners
  function setupListeners() {
    // Tab Navigation
    navButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const tabName = btn.dataset.tab;
        if (!tabName) return;

        navButtons.forEach((b) => b.classList.remove("is-active"));
        btn.classList.add("is-active");

        loadTabContent(tabName);
      });
    });

    // Blog
    if (newPostBtn) {
      newPostBtn.addEventListener("click", () => {
        window.editPostId = null;
        newTitle.value = "";
        newContent.value = "";
        newPostModal.classList.add("show");
      });
    }

    const closeNewPostBtn = newPostModal?.querySelector(".admin-modal__close");
    if (closeNewPostBtn) {
      closeNewPostBtn.addEventListener("click", () => {
        newPostModal.classList.remove("show");
      });
    }

    if (publishBtn) {
      publishBtn.addEventListener("click", savePost);
    }

    // Bans
    if (banAddBtn) {
      banAddBtn.addEventListener("click", addBan);
    }

    // Settings
    if (saveSettingsBtn) {
      saveSettingsBtn.addEventListener("click", saveSettings);
    }
    if (resetSettingsBtn) {
      resetSettingsBtn.addEventListener("click", () => {
        if (confirm("Einstellungen zurücksetzen?")) {
          loadSettings();
        }
      });
    }

    // Modal close on escape
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && newPostModal.classList.contains("show")) {
        newPostModal.classList.remove("show");
      }
    });
  }

  async function loadTabContent(tabName) {
    try {
      switch (tabName) {
        case "blog":
          await loadPosts();
          break;
        case "users":
          await loadUsers();
          break;
        case "bans":
          await loadBans();
          break;
        case "logs":
          await loadAdminLogs();
          break;
        case "stats":
          await loadStatistics();
          break;
        case "settings":
          loadSettings();
          break;
      }
    } catch (err) {
      console.error(`Error loading tab ${tabName}:`, err);
    }
  }

  // Initialization
  async function init() {
    console.log("🔵 Admin Panel initializing...");

    auth.onAuthStateChanged(async (user) => {
      if (!user) {
        window.location.href = "login.html";
        return;
      }

      // Check admin access
      try {
        const userDoc = await db.collection("users").doc(user.uid).get();
        const isAdmin = user.email === ADMIN_EMAIL || userDoc.data()?.role === "admin";

        if (!isAdmin) {
          notify("Zugriff verweigert - nicht Admin", "error");
          setTimeout(() => {
            window.location.href = "index.html";
          }, 1500);
          return;
        }

        if (adminStatus) adminStatus.textContent = `✅ Admin (${user.email})`;
        await logAdminAction("admin_panel_access", "Admin-Panel geöffnet");

        setupListeners();

        // Load all tabs
        await loadPosts();
        await loadUsers();
        await loadBans();
        await loadAdminLogs();
        await loadStatistics();
        loadSettings();

        // Auto-refresh logs every 30 seconds
        setInterval(async () => {
          await loadAdminLogs();
          await loadStatistics();
        }, 30000);

        console.log("✅ Admin Panel ready");
      } catch (err) {
        console.error("❌ Admin init failed:", err);
        notify(`Fehler: ${err.message}`, "error");
      }
    });
  }

  // Start initialization
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
