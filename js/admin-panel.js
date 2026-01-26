/* Admin Panel Logic  echtlucky 
   - Permission-Logs
   - Statistiken
   - Chat-Verfolgung
   - Enhanced Ban-System
*/
(() => {
  "use strict";

  const ADMIN_EMAIL = "lucassteckel04@gmail.com";
  const authRef = window.auth || window.echtlucky?.auth;
  const db = window.db || window.echtlucky?.db;

  if (!authRef || !db) {
    console.error("Admin Panel: Firebase nicht initialisiert");
    return;
  }

  // ==========================================
  // DOM ELEMENTS
  // ==========================================
  const adminStatus = document.getElementById("adminStatus");
  const navButtons = Array.from(document.querySelectorAll(".admin-nav__btn"));
  const tabContents = Array.from(document.querySelectorAll(".admin-tab"));

  // Blog
  const newPostBtn = document.getElementById("newPostBtn");
  const newPostModal = document.getElementById("newPostModal");
  const closeNewPostModal = document.getElementById("closeNewPostModal");
  const cancelPublishBtn = document.getElementById("cancelPublishBtn");
  const publishBtn = document.getElementById("publishBtn");
  const newTitle = document.getElementById("new-title");
  const newContent = document.getElementById("new-content");
  const newDate = document.getElementById("new-date");
  const charCount = document.getElementById("char-count");
  const postList = document.getElementById("post-list");
  const postsEmpty = document.getElementById("posts-empty");

  // Users
  const userList = document.getElementById("user-list");
  const usersEmpty = document.getElementById("users-empty");

  // Comments
  const commentsList = document.getElementById("comments-list");
  const commentsEmpty = document.getElementById("comments-empty");
  const commentDetailModal = document.getElementById("commentDetailModal");
  const closeCommentModal = document.getElementById("closeCommentModal");
  const commentDetailContent = document.getElementById("comment-detail-content");

  // Bans
  const banEmail = document.getElementById("ban-email");
  const banAddBtn = document.getElementById("banAddBtn");
  const banList = document.getElementById("ban-list");
  const bansEmpty = document.getElementById("bans-empty");

  // Logs
  const logsList = document.getElementById("logs-list");
  const logsEmpty = document.getElementById("logs-empty");

  // Stats
  const statTotalUsers = document.getElementById("stat-total-users");
  const statActiveToday = document.getElementById("stat-active-today");
  const statTotalPosts = document.getElementById("stat-total-posts");
  const statTotalBans = document.getElementById("stat-total-bans");
  const activityList = document.getElementById("activity-list");

  // Settings
  const maxLoginAttempts = document.getElementById("max-login-attempts");
  const sessionTimeout = document.getElementById("session-timeout");
  const enableComments = document.getElementById("enable-comments");
  const moderationRequired = document.getElementById("moderation-required");
  const saveSettingsBtn = document.getElementById("saveSettingsBtn");
  const resetSettingsBtn = document.getElementById("resetSettingsBtn");

  // User Info Modal
  const userInfoModal = document.getElementById("userInfoModal");
  const closeUserInfoModal = document.getElementById("closeUserInfoModal");
  const userInfoContent = document.getElementById("user-info-content");

  // ==========================================
  // UTILITIES
  // ==========================================
  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  function formatDate(timestamp) {
    try {
      const d = timestamp?.toDate ? timestamp.toDate() : timestamp;
      return d ? new Date(d).toLocaleString("de-DE") : "Unbekannt";
    } catch {
      return "Unbekannt";
    }
  }

  function openModal(modal) {
    if (!modal) return;
    modal.classList.add("show");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
  }

  function closeModal(modal) {
    if (!modal) return;
    modal.classList.remove("show");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
  }

  function setActiveTab(tabId) {
    navButtons.forEach((btn) => btn.classList.toggle("is-active", btn.dataset.tab === tabId));
    tabContents.forEach((tab) => tab.classList.toggle("is-active", tab.id === tabId));
  }

  // ==========================================
  // ADMIN LOGGING (Permission Changes)
  // ==========================================
  async function logAdminAction(action, details, targetUser = null) {
    try {
      const user = authRef.currentUser;
      if (!user) return;

      await db.collection("admin-logs").add({
        adminUid: user.uid,
        adminEmail: user.email,
        action,
        details,
        targetUserUid: targetUser?.uid || null,
        targetUserEmail: targetUser?.email || null,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        ip: "client-side"
      });
    } catch (err) {
      console.error("Fehler beim Log-Eintrag:", err);
    }
  }

  async function loadAdminLogs() {
    if (!logsList || !logsEmpty) return;
    logsList.innerHTML = "";
    logsEmpty.style.display = "none";

    try {
      const snap = await db.collection("admin-logs").orderBy("timestamp", "desc").limit(50).get();
      
      if (snap.empty) {
        logsEmpty.style.display = "block";
        return;
      }

      snap.forEach((doc) => {
        const data = doc.data();
        const item = document.createElement("div");
        item.className = "admin-log-item";
        
        let actionIcon = "";
        if (data.action.includes("role")) actionIcon = "";
        if (data.action.includes("ban")) actionIcon = "";
        if (data.action.includes("delete")) actionIcon = "";

        item.innerHTML = `
          <div class="admin-log-header">
            <span class="admin-log-action">${actionIcon} ${escapeHtml(data.action)}</span>
            <span class="admin-log-time">${formatDate(data.timestamp)}</span>
          </div>
          <div class="admin-log-details">
            <small>Admin: ${escapeHtml(data.adminEmail || "unknown")}</small>
            ${data.targetUserEmail ? `<small>Betroffen: ${escapeHtml(data.targetUserEmail)}</small>` : ""}
            ${data.details ? `<small>Details: ${escapeHtml(data.details)}</small>` : ""}
          </div>
        `;
        logsList.appendChild(item);
      });
    } catch (err) {
      logsEmpty.textContent = `Fehler: ${err.message}`;
      logsEmpty.style.display = "block";
    }
  }

  // ==========================================
  // POSTS / BLOG
  // ==========================================
  let editingPostId = null;

  async function loadPosts() {
    if (!postList || !postsEmpty) return;
    postList.innerHTML = "";
    postsEmpty.style.display = "none";

    try {
      const snap = await db.collection("posts").orderBy("createdAt", "desc").get();
      if (snap.empty) {
        postsEmpty.style.display = "block";
        return;
      }

      snap.forEach((doc) => {
        const data = doc.data();
        const item = document.createElement("div");
        item.className = "admin-post-item";
        item.innerHTML = `
          <div class="admin-post-meta">
            <h3>${escapeHtml(data.title || "Ohne Titel")}</h3>
            <small>${formatDate(data.createdAt)}</small>
          </div>
          <div class="admin-post-actions">
            <button class="btn btn-sm btn-primary" data-edit="${doc.id}">Bearbeiten</button>
            <button class="btn btn-sm btn-danger" data-delete="${doc.id}">Löschen</button>
          </div>
        `;

        item.querySelector(`[data-edit="${doc.id}"]`).addEventListener("click", () => {
          editingPostId = doc.id;
          newTitle.value = data.title || "";
          newContent.value = data.content || "";
          newDate.value = data.date || "";
          updateCharCount();
          document.getElementById("postModalTitle").textContent = "Beitrag bearbeiten";
          publishBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Speichern';
          openModal(newPostModal);
        });

        item.querySelector(`[data-delete="${doc.id}"]`).addEventListener("click", () => {
          if (confirm("Beitrag wirklich löschen?")) {
            deletePost(doc.id, data.title);
          }
        });

        postList.appendChild(item);
      });
    } catch (err) {
      console.error("Fehler beim Laden der Posts:", err);
    }
  }

  async function saveOrUpdatePost() {
    const user = authRef.currentUser;
    const title = (newTitle?.value || "").trim();
    const content = (newContent?.value || "").trim();
    const date = (newDate?.value || "").trim();

    if (!title || !content || !date) {
      alert("Bitte alle Felder ausfüllen");
      return;
    }

    try {
      if (!editingPostId) {
        await db.collection("posts").add({
          title,
          content,
          date,
          author: user?.email || "unknown",
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
        await logAdminAction("create_post", `Titel: ${title}`);
      } else {
        await db.collection("posts").doc(editingPostId).update({
          title,
          content,
          date,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
        await logAdminAction("update_post", `Titel: ${title}`);
      }

      closeModal(newPostModal);
      editingPostId = null;
      await loadPosts();
    } catch (err) {
      alert(`Fehler: ${err.message}`);
    }
  }

  async function deletePost(id, title) {
    try {
      await db.collection("posts").doc(id).delete();
      await logAdminAction("delete_post", `Titel: ${title}`);
      await loadPosts();
    } catch (err) {
      alert(`Fehler: ${err.message}`);
    }
  }

  // ==========================================
  // USERS & ROLES
  // ==========================================
  async function loadUsers() {
    if (!userList || !usersEmpty) return;
    userList.innerHTML = "";
    usersEmpty.style.display = "none";

    try {
      const snap = await db.collection("users").get();
      if (snap.empty) {
        usersEmpty.style.display = "block";
        return;
      }

      snap.forEach((doc) => {
        const data = doc.data();
        const email = data.email || "(keine Email)";
        const role = data.role || "user";

        const item = document.createElement("div");
        item.className = "admin-user-item";
        item.innerHTML = `
          <div class="admin-user-info">
            <h3>${escapeHtml(email)}</h3>
            <small>Rolle: <strong>${escapeHtml(role)}</strong></small>
          </div>
          <div class="admin-user-actions">
            <select class="admin-select" data-role="${doc.id}">
              <option value="user" ${role === "user" ? "selected" : ""}>User</option>
              <option value="mod" ${role === "mod" ? "selected" : ""}>Mod</option>
              <option value="admin" ${role === "admin" ? "selected" : ""}>Admin</option>
            </select>
            <button class="btn btn-sm btn-danger" data-delete-user="${doc.id}">Löschen</button>
          </div>
        `;

        item.querySelector(`[data-role="${doc.id}"]`).addEventListener("change", (e) => {
          changeRole(doc.id, email, e.target.value);
        });

        item.querySelector(`[data-delete-user="${doc.id}"]`).addEventListener("click", () => {
          if (confirm(`Benutzer ${email} wirklich löschen?`)) {
            deleteUser(doc.id, email);
          }
        });

        userList.appendChild(item);
      });
    } catch (err) {
      console.error("Fehler beim Laden der Benutzer:", err);
    }
  }

  async function changeRole(userId, email, newRole) {
    try {
      await db.collection("users").doc(userId).update({ role: newRole });
      await logAdminAction("change_user_role", `Neue Rolle: ${newRole}`, { uid: userId, email });
      console.log(` Rolle von ${email} zu ${newRole} geändert`);
    } catch (err) {
      alert(`Fehler: ${err.message}`);
    }
  }

  async function deleteUser(userId, email) {
    try {
      await db.collection("users").doc(userId).delete();
      await logAdminAction("delete_user", `Email: ${email}`, { uid: userId, email });
      await loadUsers();
    } catch (err) {
      alert(`Fehler: ${err.message}`);
    }
  }

  // ==========================================
  // BANS
  // ==========================================
  async function loadBans() {
    if (!banList || !bansEmpty) return;
    banList.innerHTML = "";
    bansEmpty.style.display = "none";

    try {
      const snap = await db.collection("bans").orderBy("bannedAt", "desc").get();
      if (snap.empty) {
        bansEmpty.style.display = "block";
        return;
      }

      snap.forEach((doc) => {
        const data = doc.data();
        const item = document.createElement("div");
        item.className = "admin-ban-item";
        item.innerHTML = `
          <div class="admin-ban-info">
            <strong>${escapeHtml(data.email)}</strong>
            <small>${formatDate(data.bannedAt)}</small>
            ${data.reason ? `<small>Grund: ${escapeHtml(data.reason)}</small>` : ""}
          </div>
          <button class="btn btn-sm btn-ghost" data-unban="${doc.id}">Entsperren</button>
        `;

        item.querySelector(`[data-unban="${doc.id}"]`).addEventListener("click", () => {
          if (confirm("Benutzer wirklich entsperren?")) {
            removeBan(doc.id, data.email);
          }
        });

        banList.appendChild(item);
      });
    } catch (err) {
      console.error("Fehler beim Laden der Bans:", err);
    }
  }

  async function addBan() {
    const email = (banEmail?.value || "").trim();
    const reason = prompt("Grund für Ban (optional):");

    if (!email) {
      alert("Bitte E-Mail eingeben");
      return;
    }

    try {
      await db.collection("bans").add({
        email,
        reason: reason || "",
        bannedAt: firebase.firestore.FieldValue.serverTimestamp(),
        bannedBy: authRef.currentUser?.email || "unknown"
      });

      await logAdminAction("ban_user", `Email: ${email}, Grund: ${reason || "keine"}`);
      if (banEmail) banEmail.value = "";
      await loadBans();
    } catch (err) {
      alert(`Fehler: ${err.message}`);
    }
  }

  async function removeBan(banId, email) {
    try {
      await db.collection("bans").doc(banId).delete();
      await logAdminAction("unban_user", `Email: ${email}`);
      await loadBans();
    } catch (err) {
      alert(`Fehler: ${err.message}`);
    }
  }

  // ==========================================
  // CHAT LOGS (Comments Tracking)
  // ==========================================
  async function loadChatLogs() {
    if (!commentsList || !commentsEmpty) return;
    commentsList.innerHTML = "";
    commentsEmpty.style.display = "none";

    try {
      const snap = await db.collection("chat-logs").orderBy("timestamp", "desc").limit(30).get();
      if (snap.empty) {
        commentsEmpty.style.display = "block";
        return;
      }

      snap.forEach((doc) => {
        const data = doc.data();
        const item = document.createElement("div");
        item.className = "admin-comment-item";

        const preview = (data.message || "").substring(0, 60) + (data.message?.length > 60 ? "..." : "");

        item.innerHTML = `
          <div class="admin-comment-meta">
            <strong>${escapeHtml(data.userName || "Anonym")}</strong>
            <small>${formatDate(data.timestamp)}</small>
          </div>
          <div class="admin-comment-preview">
            ${escapeHtml(preview)}
          </div>
          <button class="btn btn-sm btn-primary" data-view-chat="${doc.id}">Chat ansehen</button>
        `;

        item.querySelector(`[data-view-chat="${doc.id}"]`).addEventListener("click", () => {
          viewChatDetail(doc.id, data);
        });

        commentsList.appendChild(item);
      });
    } catch (err) {
      console.error("Fehler beim Laden der Chat-Logs:", err);
    }
  }

  function viewChatDetail(logId, chatData) {
    commentDetailContent.innerHTML = `
      <div class="admin-chat-detail">
        <div class="admin-detail-row">
          <strong>Benutzer:</strong>
          <span>${escapeHtml(chatData.userName || "Anonym")}</span>
        </div>
        <div class="admin-detail-row">
          <strong>Zeit:</strong>
          <span>${formatDate(chatData.timestamp)}</span>
        </div>
        <div class="admin-detail-row">
          <strong>Nachricht:</strong>
        </div>
        <div class="admin-chat-content">
          ${escapeHtml(chatData.message || "")}
        </div>
        <div class="admin-detail-row">
          <button class="btn btn-sm btn-danger" id="deleteCommentBtn">Nachricht löschen</button>
        </div>
      </div>
    `;

    document.getElementById("deleteCommentBtn").addEventListener("click", () => {
      if (confirm("Nachricht wirklich löschen?")) {
        db.collection("chat-logs").doc(logId).delete().then(() => {
          closeModal(commentDetailModal);
          loadChatLogs();
        }).catch(err => alert(err.message));
      }
    });

    openModal(commentDetailModal);
  }

  // ==========================================
  // STATISTICS
  // ==========================================
  async function loadStatistics() {
    try {
      const usersSnap = await db.collection("users").get();
      if (statTotalUsers) statTotalUsers.textContent = usersSnap.size;

      const postsSnap = await db.collection("posts").get();
      if (statTotalPosts) statTotalPosts.textContent = postsSnap.size;

      const bansSnap = await db.collection("bans").get();
      if (statTotalBans) statTotalBans.textContent = bansSnap.size;

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const activeSnap = await db.collection("users")
        .where("lastLoginAt", ">=", today)
        .get();
      if (statActiveToday) statActiveToday.textContent = activeSnap.size;

      if (activityList) {
        activityList.innerHTML = "";
        const logsSnap = await db.collection("admin-logs").orderBy("timestamp", "desc").limit(10).get();
        
        logsSnap.forEach((doc) => {
          const data = doc.data();
          const div = document.createElement("div");
          div.className = "admin-activity-item";
          div.innerHTML = `
            <span>${escapeHtml(data.action)}</span>
            <small>${formatDate(data.timestamp)}</small>
          `;
          activityList.appendChild(div);
        });
      }
    } catch (err) {
      console.error("Fehler beim Laden der Statistiken:", err);
    }
  }

  // ==========================================
  // SETTINGS
  // ==========================================
  function loadSettings() {
    try {
      const settings = localStorage.getItem("admin-settings");
      if (settings) {
        const s = JSON.parse(settings);
        if (maxLoginAttempts) maxLoginAttempts.value = s.maxLoginAttempts || 5;
        if (sessionTimeout) sessionTimeout.value = s.sessionTimeout || 30;
        if (enableComments) enableComments.checked = s.enableComments !== false;
        if (moderationRequired) moderationRequired.checked = s.moderationRequired === true;
      }
    } catch (err) {
      console.error("Fehler beim Laden der Einstellungen:", err);
    }
  }

  function saveSettings() {
    try {
      const settings = {
        maxLoginAttempts: parseInt(maxLoginAttempts?.value) || 5,
        sessionTimeout: parseInt(sessionTimeout?.value) || 30,
        enableComments: enableComments?.checked !== false,
        moderationRequired: moderationRequired?.checked === true
      };
      localStorage.setItem("admin-settings", JSON.stringify(settings));
      alert("Einstellungen gespeichert ");
      logAdminAction("update_settings", JSON.stringify(settings));
    } catch (err) {
      alert(`Fehler: ${err.message}`);
    }
  }

  function resetSettings() {
    if (confirm("Einstellungen wirklich auf Standard zurücksetzen?")) {
      localStorage.removeItem("admin-settings");
      loadSettings();
      alert("Einstellungen zurückgesetzt ");
    }
  }

  // ==========================================
  // EVENT LISTENERS
  // ==========================================
  navButtons.forEach((btn) => {
    btn.addEventListener("click", () => setActiveTab(btn.dataset.tab));
  });

  if (newPostBtn) newPostBtn.addEventListener("click", () => {
    editingPostId = null;
    newTitle.value = "";
    newContent.value = "";
    newDate.value = "";
    updateCharCount();
    document.getElementById("postModalTitle").textContent = "Neuen Beitrag erstellen";
    publishBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Veröffentlichen';
    openModal(newPostModal);
  });

  if (closeNewPostModal) closeNewPostModal.addEventListener("click", () => closeModal(newPostModal));
  if (cancelPublishBtn) cancelPublishBtn.addEventListener("click", () => closeModal(newPostModal));
  if (publishBtn) publishBtn.addEventListener("click", saveOrUpdatePost);
  if (closeUserInfoModal) closeUserInfoModal.addEventListener("click", () => closeModal(userInfoModal));
  if (closeCommentModal) closeCommentModal.addEventListener("click", () => closeModal(commentDetailModal));

  if (newPostModal) newPostModal.addEventListener("click", (e) => { if (e.target === newPostModal) closeModal(newPostModal); });
  if (userInfoModal) userInfoModal.addEventListener("click", (e) => { if (e.target === userInfoModal) closeModal(userInfoModal); });
  if (commentDetailModal) commentDetailModal.addEventListener("click", (e) => { if (e.target === commentDetailModal) closeModal(commentDetailModal); });

  if (newContent) {
    newContent.addEventListener("input", () => {
      if (charCount) charCount.textContent = newContent.value.length + " Zeichen";
    });
  }

  function updateCharCount() {
    if (charCount && newContent) charCount.textContent = newContent.value.length + " Zeichen";
  }

  if (banAddBtn) banAddBtn.addEventListener("click", addBan);
  if (saveSettingsBtn) saveSettingsBtn.addEventListener("click", saveSettings);
  if (resetSettingsBtn) resetSettingsBtn.addEventListener("click", resetSettings);

  // ==========================================
  // INITIALIZATION
  // ==========================================
  authRef.onAuthStateChanged(async (user) => {
    if (!user) {
      window.location.href = "login.html";
      return;
    }

    const isAdmin = user.email === ADMIN_EMAIL || 
                   (await db.collection("users").doc(user.uid).get()).data()?.role === "admin";

    if (!isAdmin) {
      alert("Zugriff verweigert");
      window.location.href = "index.html";
      return;
    }

    if (adminStatus) adminStatus.textContent = ` Admin (${user.email})`;

    setActiveTab("blog-tab");
    await loadPosts();
    await loadUsers();
    await loadBans();
    await loadChatLogs();
    await loadAdminLogs();
    await loadStatistics();
    loadSettings();

    setInterval(async () => {
      await loadAdminLogs();
      await loadStatistics();
    }, 30000);
  });

  console.log(" Admin Panel initialized");
})();
