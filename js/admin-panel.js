/* ======================================
   Admin Panel Logic — echtlucky (FINAL ✅)
   File: js/admin-panel.js
   - KEIN role-write im Client (Security!)
   - nur read role + enforce access
====================================== */
(() => {
  "use strict";

  const ADMIN_EMAIL = "lucassteckel04@gmail.com";

  // Firebase
  const authRef = window.echtlucky?.auth || window.auth || firebase.auth();
  const db = window.echtlucky?.db || window.db || firebase.firestore();

  // DOM
  const adminBadge = document.getElementById("adminBadge");
  const statusEl = document.getElementById("status");

  const tabButtons = Array.from(document.querySelectorAll(".admin-nav__item, .admin-tabbtn"));
  const tabs = Array.from(document.querySelectorAll(".admin-tab"));
  const tabTitle = document.getElementById("tab-title");

  const newPostBtn = document.getElementById("newPostBtn");
  const newPostModal = document.getElementById("newPostModal");
  const closeNewPostModalBtn = document.getElementById("closeNewPostModal");
  const cancelPublishBtn = document.getElementById("cancelPublishBtn");
  const publishBtn = document.getElementById("publishBtn");

  const userInfoModal = document.getElementById("userInfoModal");
  const closeUserInfoModalBtn = document.getElementById("closeUserInfoModal");
  const userInfoContent = document.getElementById("user-info-content");

  const newTitle = document.getElementById("new-title");
  const newContent = document.getElementById("new-content");
  const newDate = document.getElementById("new-date");
  const charCount = document.getElementById("char-count");

  const postList = document.getElementById("post-list");
  const postsEmpty = document.getElementById("posts-empty");

  const userList = document.getElementById("user-list");
  const usersEmpty = document.getElementById("users-empty");

  const banEmail = document.getElementById("ban-email");
  const banAddBtn = document.getElementById("banAddBtn");
  const banList = document.getElementById("ban-list");
  const bansEmpty = document.getElementById("bans-empty");

  // UI Helpers
  function setStatus(msg, type = "info") {
    if (!statusEl) return;
    statusEl.textContent = msg || "";
    statusEl.classList.remove("admin-status--info", "admin-status--success", "admin-status--error");
    statusEl.classList.add(`admin-status--${type}`);
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

  function escapeHtml(str) {
    return String(str ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function fmtDateTime(ts) {
    try {
      const d = ts?.toDate ? ts.toDate() : (ts instanceof Date ? ts : null);
      return d ? d.toLocaleString() : "Unbekannt";
    } catch {
      return "Unbekannt";
    }
  }

  // =========================
  // Auth / Role helpers
  // =========================
  async function ensureUserDocExists(user) {
    if (!user?.uid) return;
    const ref = db.collection("users").doc(user.uid);
    const snap = await ref.get();

    const base = {
      email: user.email || "",
      username: user.displayName || "",
      lastLoginAt: firebase.firestore.FieldValue.serverTimestamp(),
    };

    if (!snap.exists) {
      // role NICHT hier "hochziehen" – nur baseline anlegen
      await ref.set({
        ...base,
        role: "user",
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
    } else {
      await ref.update(base);
    }
  }

  async function getRole(user) {
    if (!user?.uid) return null;
    const snap = await db.collection("users").doc(user.uid).get();
    return snap.exists ? (snap.data()?.role || "user") : null;
  }

  async function canModerate(user) {
    // fallback: Admin-Mail darf rein, auch wenn role doc kaputt ist
    if (user?.email === ADMIN_EMAIL) return true;
    const r = await getRole(user);
    return r === "admin" || r === "mod" || r === "moderator";
  }

  // =========================
  // Tabs
  // =========================
  function setActiveTab(tabId) {
    tabButtons.forEach((b) => b.classList.toggle("is-active", b.dataset.tab === tabId));
    tabs.forEach((t) => t.classList.toggle("is-active", t.id === tabId));

    const activeBtn = tabButtons.find((b) => b.dataset.tab === tabId);
    if (tabTitle) tabTitle.textContent = activeBtn ? activeBtn.innerText.trim() : "Admin Panel";

    if (newPostBtn) newPostBtn.style.display = (tabId === "blog-tab") ? "inline-flex" : "none";
  }

  tabButtons.forEach((btn) => btn.addEventListener("click", () => setActiveTab(btn.dataset.tab)));

  // =========================
  // Modal wiring
  // =========================
  function updateCharCount() {
    if (!charCount || !newContent) return;
    charCount.textContent = `${(newContent.value || "").length} Zeichen`;
  }
  if (newContent) newContent.addEventListener("input", updateCharCount);

  if (newPostBtn) {
    newPostBtn.addEventListener("click", () => {
      if (newTitle) newTitle.value = "";
      if (newContent) newContent.value = "";
      if (newDate) newDate.value = "";
      updateCharCount();

      const modalTitle = document.getElementById("postModalTitle");
      if (modalTitle) modalTitle.textContent = "Neuen Beitrag erstellen";

      setEditMode(null);
      openModal(newPostModal);
    });
  }

  if (closeNewPostModalBtn) closeNewPostModalBtn.addEventListener("click", () => closeModal(newPostModal));
  if (cancelPublishBtn) cancelPublishBtn.addEventListener("click", () => closeModal(newPostModal));
  if (closeUserInfoModalBtn) closeUserInfoModalBtn.addEventListener("click", () => closeModal(userInfoModal));

  if (newPostModal) newPostModal.addEventListener("click", (e) => { if (e.target === newPostModal) closeModal(newPostModal); });
  if (userInfoModal) userInfoModal.addEventListener("click", (e) => { if (e.target === userInfoModal) closeModal(userInfoModal); });

  // =========================
  // Create/Edit mode
  // =========================
  let editingPostId = null;

  function setEditMode(postId) {
    editingPostId = postId;
    if (!publishBtn) return;
    publishBtn.innerHTML = postId
      ? `<i class="fa-solid fa-floppy-disk"></i> Update speichern`
      : `<i class="fa-solid fa-paper-plane"></i> Veröffentlichen`;
  }

  // =========================
  // Firestore Actions
  // =========================
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
        const data = doc.data() || {};
        const item = document.createElement("div");
        item.className = "admin-item";

        item.innerHTML = `
          <div class="admin-item__meta">
            <div class="admin-item__title">${escapeHtml(data.title || "Ohne Titel")}</div>
            <div class="admin-item__sub">
              ${escapeHtml(data.date || "")}${data.date ? " • " : ""}von ${escapeHtml(data.author || "Unbekannt")}
            </div>
          </div>

          <div class="admin-item__actions">
            <button class="btn btn-ghost btn-sm" type="button" data-edit="${doc.id}">Bearbeiten</button>
            <button class="btn btn-danger btn-sm" type="button" data-del="${doc.id}">
              <i class="fa-solid fa-trash"></i> Löschen
            </button>
          </div>
        `;

        item.querySelector(`[data-del="${doc.id}"]`).addEventListener("click", () => deletePost(doc.id));
        item.querySelector(`[data-edit="${doc.id}"]`).addEventListener("click", () => openEditPost(doc.id, data));

        postList.appendChild(item);
      });
    } catch (err) {
      setStatus(`Fehler beim Laden der Posts: ${err.message}`, "error");
    }
  }

  function openEditPost(id, data) {
    if (newTitle) newTitle.value = data.title || "";
    if (newContent) newContent.value = data.content || "";
    if (newDate) newDate.value = data.date || "";
    updateCharCount();

    const modalTitle = document.getElementById("postModalTitle");
    if (modalTitle) modalTitle.textContent = "Beitrag bearbeiten";

    setEditMode(id);
    openModal(newPostModal);
  }

  async function saveOrUpdatePost() {
    const user = authRef.currentUser;
    const title = (newTitle?.value || "").trim();
    const content = (newContent?.value || "").trim();
    const date = (newDate?.value || "").trim();

    if (!title || !content || !date) {
      setStatus("Bitte alle Felder ausfüllen.", "error");
      return;
    }

    try {
      setStatus(editingPostId ? "Update wird gespeichert…" : "Post wird gespeichert…", "info");

      if (!editingPostId) {
        await db.collection("posts").add({
          title, content, date,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          author: user?.email || "unknown",
        });
        setStatus("Post veröffentlicht ✅", "success");
      } else {
        await db.collection("posts").doc(editingPostId).update({
          title, content, date,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
        setStatus("Beitrag aktualisiert ✅", "success");
      }

      closeModal(newPostModal);
      setEditMode(null);
      await loadPosts();
    } catch (err) {
      setStatus(`Fehler: ${err.message}`, "error");
    }
  }

  async function deletePost(id) {
    if (!confirm("Post wirklich löschen?")) return;
    try {
      await db.collection("posts").doc(id).delete();
      setStatus("Post gelöscht ✅", "success");
      await loadPosts();
    } catch (err) {
      setStatus(`Löschen fehlgeschlagen: ${err.message}`, "error");
    }
  }

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
        const data = doc.data() || {};
        const email = data.email || "(ohne Email)";
        const role = data.role || "user";

        const item = document.createElement("div");
        item.className = "admin-item";

        item.innerHTML = `
          <div class="admin-item__meta">
            <div class="admin-item__title">${escapeHtml(email)}</div>
            <div class="admin-item__sub">Rolle: <strong>${escapeHtml(role)}</strong></div>
          </div>

          <div class="admin-item__actions">
            <button class="btn btn-ghost btn-sm" type="button" data-details="${doc.id}">Details</button>

            <select class="select" data-role="${doc.id}">
              <option value="user" ${role === "user" ? "selected" : ""}>User</option>
              <option value="mod" ${role === "mod" ? "selected" : ""}>Mod</option>
              <option value="admin" ${role === "admin" ? "selected" : ""}>Admin</option>
            </select>
          </div>
        `;

        item.querySelector(`[data-details="${doc.id}"]`)
          .addEventListener("click", () => showUserInfo(doc.id, email, role));

        item.querySelector(`[data-role="${doc.id}"]`)
          .addEventListener("change", (e) => changeRole(doc.id, e.target.value));

        userList.appendChild(item);
      });
    } catch (err) {
      setStatus(`Fehler beim Laden der Nutzer: ${err.message}`, "error");
    }
  }

  async function changeRole(uidDocId, role) {
    try {
      await db.collection("users").doc(uidDocId).update({ role });
      setStatus("Rolle aktualisiert ✅", "success");
      await loadUsers();
    } catch (err) {
      setStatus(`Fehler: ${err.message}`, "error");
    }
  }

  function showUserInfo(uidDocId, email, role) {
    if (!userInfoContent) return;

    userInfoContent.innerHTML = `
      <div class="admin-userinfo__row"><span>E-Mail</span><strong>${escapeHtml(email)}</strong></div>
      <div class="admin-userinfo__row"><span>Rolle</span><strong>${escapeHtml(role)}</strong></div>
      <div class="admin-divider"></div>
      <button class="btn btn-danger" type="button" id="deleteUserBtn">
        <i class="fa-solid fa-user-xmark"></i> Benutzer löschen
      </button>
    `;

    userInfoContent.querySelector("#deleteUserBtn")
      .addEventListener("click", () => deleteUser(uidDocId, email));

    openModal(userInfoModal);
  }

  async function deleteUser(uidDocId, email) {
    if (!confirm(`Benutzer ${email} wirklich löschen?`)) return;

    try {
      await db.collection("users").doc(uidDocId).delete();
      setStatus("Benutzer gelöscht ✅", "success");
      closeModal(userInfoModal);
      await loadUsers();
    } catch (err) {
      setStatus(`Löschen fehlgeschlagen: ${err.message}`, "error");
    }
  }

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
        const data = doc.data() || {};
        const tr = document.createElement("tr");

        tr.innerHTML = `
          <td>${escapeHtml(data.email || "")}</td>
          <td>${escapeHtml(fmtDateTime(data.bannedAt))}</td>
          <td class="col-actions">
            <button class="btn btn-ghost btn-sm" type="button" data-unban="${doc.id}">Entsperren</button>
          </td>
        `;

        tr.querySelector(`[data-unban="${doc.id}"]`).addEventListener("click", () => removeBan(doc.id));
        banList.appendChild(tr);
      });
    } catch (err) {
      setStatus(`Fehler beim Laden der Sperren: ${err.message}`, "error");
      if (String(err.message || "").toLowerCase().includes("permission")) {
        setStatus("Permissions-Fehler: users/{uid}.role muss 'admin' oder 'mod' sein (Rules).", "error");
      }
    }
  }

  async function addBan() {
    const email = (banEmail?.value || "").trim();
    if (!email) {
      setStatus("Bitte E-Mail eingeben.", "error");
      return;
    }

    try {
      await db.collection("bans").add({
        email,
        bannedAt: firebase.firestore.FieldValue.serverTimestamp(),
      });

      if (banEmail) banEmail.value = "";
      setStatus("User gebannt ✅", "success");
      await loadBans();
    } catch (err) {
      setStatus(`Fehler: ${err.message}`, "error");
    }
  }

  async function removeBan(id) {
    if (!confirm("Entsperren?")) return;

    try {
      await db.collection("bans").doc(id).delete();
      setStatus("Sperre entfernt ✅", "success");
      await loadBans();
    } catch (err) {
      setStatus(`Fehler: ${err.message}`, "error");
    }
  }

  // Events
  if (publishBtn) publishBtn.addEventListener("click", saveOrUpdatePost);
  if (banAddBtn) banAddBtn.addEventListener("click", addBan);

  // Auth Guard + Init
  authRef.onAuthStateChanged(async (user) => {
    if (!user) {
      window.location.href = "login.html";
      return;
    }

    // nur sicherstellen, dass users-doc existiert (ohne role push)
    await ensureUserDocExists(user);

    const ok = await canModerate(user);
    if (!ok) {
      if (window.notify?.error) {
        window.notify.error("Keine Admin/Mod Rechte", "Zugriff verweigert", 4500);
      } else {
        alert("Zugriff verweigert – keine Admin/Mod Rechte.");
      }
      window.location.href = "index.html";
      return;
    }

    if (adminBadge) adminBadge.textContent = "Admin ✓";
    setStatus(`Admin-Zugriff erteilt: ${user.email}`, "success");

    setActiveTab("blog-tab");

    await loadPosts();
    await loadUsers();
    await loadBans();
  });

})();