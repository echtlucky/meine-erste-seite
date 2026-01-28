

(() => {
  "use strict";

  let auth = null;
  let db = null;
  let firebase = null;
  const ADMIN_EMAIL = "lucassteckel04@gmail.com";

  async function waitForFirebase() {
    return new Promise((resolve) => {
      if (window.firebaseReady && window.auth && window.db) {
        auth = window.auth;
        db = window.db;
        firebase = window.firebase;
        resolve();
        return;
      }

      const handleReady = () => {
        auth = window.auth;
        db = window.db;
        firebase = window.firebase;
        resolve();
      };

      window.addEventListener("firebaseReady", handleReady, { once: true });
      document.addEventListener("firebaseReady", handleReady, { once: true });

      setTimeout(() => {
        if (window.auth && window.db) {
          auth = window.auth;
          db = window.db;
          firebase = window.firebase;
          resolve();
        } else {
          resolve();
        }
      }, 3000);
    });
  }

  let adminStatus, navButtons, newPostBtn, newPostModal, publishBtn, newTitle, newContent, postList;
  let userList, banEmail, banReason, banAddBtn, banList;
  let logsList, statTotalUsers, statTotalPosts, statTotalBans, activityList;
  let saveSettingsBtn, resetSettingsBtn;
  let logsFeedUnsub = null;
  let statsLastLoadedAt = 0;
  let statsLoadInFlight = null;

  function initDOM() {
    adminStatus = document.getElementById("adminStatus");
    navButtons = document.querySelectorAll(".admin-nav__btn");
    
    newPostBtn = document.getElementById("newPostBtn");
    newPostModal = document.getElementById("newPostModal");
    publishBtn = document.getElementById("publishBtn");
    newTitle = document.getElementById("new-title");
    newContent = document.getElementById("new-content");
    postList = document.getElementById("post-list");

    userList = document.getElementById("user-list");

    banEmail = document.getElementById("ban-email");
    banReason = document.getElementById("ban-reason");
    banAddBtn = document.getElementById("banAddBtn");
    banList = document.getElementById("ban-list");

    logsList = document.getElementById("logs-list");

    statTotalUsers = document.getElementById("stat-total-users");
    statTotalPosts = document.getElementById("stat-total-posts");
    statTotalBans = document.getElementById("stat-total-bans");
    activityList = document.getElementById("activity-list");

    saveSettingsBtn = document.getElementById("saveSettingsBtn");
    resetSettingsBtn = document.getElementById("resetSettingsBtn");

  }

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
    }
  }

  function renderAdminLogsSnapshot(snap) {
    if (!logsList) return;

    if (!snap || snap.empty) {
      logsList.innerHTML = `<p style="padding: 12px; color: var(--text-muted);">Keine Logs</p>`;
      return;
    }

    logsList.innerHTML = "";
    snap.forEach((doc) => {
      const data = doc.data() || {};
      const item = document.createElement("div");
      item.className = "admin-log-item";
      item.innerHTML = `
        <div class="admin-log-item__top">
          <span class="admin-log-item__action">${escapeHtml(String(data.action || "log"))}</span>
          <span class="admin-log-item__time">${escapeHtml(formatDate(data.timestamp))}</span>
        </div>
        <div class="admin-log-item__meta">
          ${escapeHtml(String(data.details || "—"))}<br/>
          <span style="color: var(--text-muted);">von ${escapeHtml(String(data.admin || "—"))}</span>
        </div>
      `;
      logsList.appendChild(item);
    });
  }

  function startLogsFeed() {
    if (!db || !logsList) return;
    if (logsFeedUnsub) return;

    try {
      logsFeedUnsub = db
        .collection("admin-logs")
        .orderBy("timestamp", "desc")
        .limit(60)
        .onSnapshot(
          (snap) => renderAdminLogsSnapshot(snap),
          (err) => {
            if (logsList) logsList.innerHTML = `<p style="color: #ff3366;">Fehler: ${escapeHtml(err.message)}</p>`;
          }
        );
    } catch (err) {
    }
  }

  async function loadAdminLogs() {
    startLogsFeed();
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
      const snap = await db.collection("users").orderBy("email").limit(200).get();

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
    const confirmed = await echtluckyModal.confirm({
      title: "Ban aufheben",
      message: "Möchtest du diesen Ban wirklich aufheben?",
      confirmText: "Ja, aufheben",
      cancelText: "Abbrechen",
      type: "warning"
    });
    
    if (!confirmed) return;

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
      const now = Date.now();
      if (statsLoadInFlight) return statsLoadInFlight;
      if (now - statsLastLoadedAt < 60000) return;
      statsLastLoadedAt = now;

      statsLoadInFlight = (async () => {
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
      })().finally(() => {
        statsLoadInFlight = null;
      });

      return statsLoadInFlight;
    } catch (err) {
      statsLoadInFlight = null;
    }
  }

  function loadSettings() {
  }

  function saveSettings() {
    notify("Einstellungen gespeichert! ✅");
    logAdminAction("settings_updated", "Admin-Einstellungen gespeichert");
  }

  function showTab(tabName) {
    const allTabs = document.querySelectorAll(".admin-tab");
    allTabs.forEach((tab) => {
      tab.style.display = "none";
    });

    const selectedTab = document.querySelector(`.admin-tab[data-tab="${tabName}"]`);
    if (selectedTab) {
      selectedTab.style.display = "block";
    }

    loadTabContent(tabName);
  }

  function setupListeners() {
    
    if (!navButtons || navButtons.length === 0) {
      return;
    }

    navButtons.forEach((btn) => {
      btn.addEventListener("click", function(e) {
        e.preventDefault();
        e.stopPropagation();
        
        const tabName = this.getAttribute("data-tab");
        
        if (!tabName) return;

        navButtons.forEach((b) => {
          b.classList.remove("is-active");
        });
        this.classList.add("is-active");

        showTab(tabName);
      });
    });


    if (newPostBtn) {
      newPostBtn.addEventListener("click", () => {
        window.editPostId = null;
        if (newTitle) newTitle.value = "";
        if (newContent) newContent.value = "";
        if (newPostModal) {
          newPostModal.classList.add("show");
          setTimeout(() => newTitle?.focus(), 100);
        }
      });
    }

    const closeNewPostModalBtn = document.getElementById("closeNewPostModal");
    if (closeNewPostModalBtn) {
      closeNewPostModalBtn.addEventListener("click", (e) => {
        e.preventDefault();
        if (newPostModal) {
          newPostModal.classList.remove("show");
        }
      });
    }

    if (publishBtn) {
      publishBtn.addEventListener("click", savePost);
    }

    const cancelPublishBtn = document.getElementById("cancelPublishBtn");
    if (cancelPublishBtn) {
      cancelPublishBtn.addEventListener("click", () => {
        if (newPostModal) {
          newPostModal.classList.remove("show");
        }
      });
    }

    if (banAddBtn) {
      banAddBtn.addEventListener("click", addBan);
    }

    if (saveSettingsBtn) {
      saveSettingsBtn.addEventListener("click", saveSettings);
    }
    if (resetSettingsBtn) {
      resetSettingsBtn.addEventListener("click", async () => {
        const confirmed = await echtluckyModal.confirm({
          title: "Einstellungen zurücksetzen",
          message: "Möchtest du die Einstellungen wirklich auf Standard zurücksetzen?",
          confirmText: "Ja, zurücksetzen",
          cancelText: "Abbrechen",
          type: "warning"
        });
        
        if (confirmed) {
          loadSettings();
        }
      });
    }

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && newPostModal && newPostModal.classList.contains("show")) {
        newPostModal.classList.remove("show");
      }
    });

    if (newPostModal) {
      newPostModal.addEventListener("click", (e) => {
        if (e.target === newPostModal) {
          newPostModal.classList.remove("show");
        }
      });
    }

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
        case "stats":
          await loadStatistics();
          break;
        case "settings":
          loadSettings();
          break;
      }
    } catch (err) {
    }
  }

  async function startInit() {
    
    initDOM();

    await waitForFirebase();

    if (!auth || !db) {
      notify("Firebase nicht initialisiert!", "error");
      return;
    }


    setupListeners();

    auth.onAuthStateChanged(async (user) => {
      if (!user) {
        window.location.href = "login.html";
        return;
      }

      try {
        const userSnap = await db.collection("users").doc(user.uid).get();
        const userData = userSnap.data() || {};
        const isAdmin = user.email === ADMIN_EMAIL || userData.role === "admin";

        if (!isAdmin) {
          notify("Nicht als Admin berechtigt", "error");
          setTimeout(() => (window.location.href = "index.html"), 2000);
          return;
        }

        if (adminStatus) adminStatus.textContent = `✅ Admin (${user.email})`;

        await logAdminAction("panel_opened", "Admin-Panel geöffnet");
        startLogsFeed();
        showTab("blog");
      } catch (err) {
        notify(`Fehler: ${err.message}`, "error");
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startInit);
  } else {
    startInit();
  }
})();
