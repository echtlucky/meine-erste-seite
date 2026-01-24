/* ======================================
   Admin Panel Logic — echtlucky
   File: js/admin-panel.js
====================================== */
(() => {
  "use strict";

  // --- Config
  const ADMIN_EMAIL = "lucassteckel04@gmail.com";

  // --- Firebase (kommt aus firebase.js)
  // Erwartet: window.firebase + window.auth (oder firebase.auth())
  const db = firebase.firestore();
  const authRef = window.auth || firebase.auth();

  // --- DOM
  const adminBadge = document.getElementById("adminBadge");
  const statusEl = document.getElementById("status");

  const tabButtons = Array.from(document.querySelectorAll(".admin-tabbtn"));
  const tabs = Array.from(document.querySelectorAll(".admin-tab"));
  const tabTitle = document.getElementById("tab-title");

  const newPostBtn = document.getElementById("newPostBtn");
  const newPostModal = document.getElementById("newPostModal");
  const closeNewPostModal = document.getElementById("closeNewPostModal");
  const cancelPublishBtn = document.getElementById("cancelPublishBtn");
  const publishBtn = document.getElementById("publishBtn");

  const userInfoModal = document.getElementById("userInfoModal");
  const closeUserInfoModal = document.getElementById("closeUserInfoModal");
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

  // --- Helpers UI
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
      if (!d) return "Unbekannt";
      return d.toLocaleString();
    } catch {
      return "Unbekannt";
    }
  }

  // --- Tabs
  function setActiveTab(tabId) {
    tabButtons.forEach(b => b.classList.toggle("is-active", b.dataset.tab === tabId));
    tabs.forEach(t => t.classList.toggle("is-active", t.id === tabId));

    // Title + action button visibility
    const activeBtn = tabButtons.find(b => b.dataset.tab === tabId);
    if (tabTitle && activeBtn && tabId === "blog-tab") tabTitle.textContent = "Blog verwalten";
    if (newPostBtn) newPostBtn.style.display = (tabId === "blog-tab") ? "inline-flex" : "none";
  }

  tabButtons.forEach(btn => {
    btn.addEventListener("click", () => setActiveTab(btn.dataset.tab));
  });

  // --- Modal wiring
  if (newPostBtn) {
    newPostBtn.addEventListener("click", () => {
      newTitle.value = "";
      newContent.value = "";
      newDate.value = "";
      updateCharCount();
      openModal(newPostModal);
    });
  }

  function updateCharCount() {
    if (charCount) charCount.textContent = `${(newContent.value || "").length} Zeichen`;
  }
  if (newContent) newContent.addEventListener("input", updateCharCount);

  if (closeNewPostModal) closeNewPostModal.addEventListener("click", () => closeModal(newPostModal));
  if (cancelPublishBtn) cancelPublishBtn.addEventListener("click", () => closeModal(newPostModal));
  if (closeUserInfoModal) closeUserInfoModal.addEventListener("click", () => closeModal(userInfoModal));

  // close on backdrop click
  if (newPostModal) newPostModal.addEventListener("click", (e) => { if (e.target === newPostModal) closeModal(newPostModal); });
  if (userInfoModal) userInfoModal.addEventListener("click", (e) => { if (e.target === userInfoModal) closeModal(userInfoModal); });

  // --- Firestore actions
  async function loadPosts() {
    postList.innerHTML = "";
    postsEmpty.style.display = "none";

    try {
      const snap = await db.collection("posts").orderBy("createdAt", "desc").get();
      if (snap.empty) {
        postsEmpty.style.display = "block";
        return;
      }

      snap.forEach(doc => {
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
            <button class="btn btn-ghost btn-sm" type="button" data-edit="${doc.id}">
              Bearbeiten
            </button>
            <button class="btn btn-danger btn-sm" type="button" data-del="${doc.id}">
              <i class="fa-solid fa-trash"></i> Löschen
            </button>
          </div>
        `;

        item.querySelector(`[data-del="${doc.id}"]`).addEventListener("click", () => deletePost(doc.id));
        item.querySelector(`[data-edit="${doc.id}"]`).addEventListener("click", () => editPost(doc.id, data));
        postList.appendChild(item);
      });
    } catch (err) {
      setStatus(`Fehler beim Laden der Posts: ${err.message}`, "error");
    }
  }

  async function saveNewPost() {
    const title = (newTitle.value || "").trim();
    const content = (newContent.value || "").trim();
    const date = (newDate.value || "").trim();

    if (!title || !content || !date) {
      setStatus("Bitte alle Felder ausfüllen.", "error");
      return;
    }

    setStatus("Post wird gespeichert…", "info");

    try {
      await db.collection("posts").add({
        title,
        content,
        date,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        author: authRef.currentUser?.email || "unknown"
      });

      setStatus("Post veröffentlicht ✅", "success");
      closeModal(newPostModal);
      await loadPosts();
    } catch (err) {
      setStatus(`Fehler beim Speichern: ${err.message}`, "error");
    }
  }

  async function editPost(id, data) {
    // Minimal: Modal als Editor wiederverwenden
    newTitle.value = data.title || "";
    newContent.value = data.content || "";
    newDate.value = data.date || "";
    updateCharCount();

    // UI: Titel ändern
    const modalTitle = document.getElementById("postModalTitle");
    if (modalTitle) modalTitle.textContent = "Beitrag bearbeiten";

    openModal(newPostModal);

    // Einmal-Update Handler
    const handler = async () => {
      const title = (newTitle.value || "").trim();
      const content = (newContent.value || "").trim();
      const date = (newDate.value || "").trim();

      if (!title || !content || !date) {
        setStatus("Bitte alle Felder ausfüllen.", "error");
        return;
      }

      setStatus("Update wird gespeichert…", "info");

      try {
        await db.collection("posts").doc(id).update({
          title, content, date,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        setStatus("Beitrag aktualisiert ✅", "success");
        closeModal(newPostModal);
        await loadPosts();
      } catch (err) {
        setStatus(`Fehler beim Update: ${err.message}`, "error");
      } finally {
        publishBtn.removeEventListener("click", handler);
      }
    };

    // publishBtn temporär als "Update"
    publishBtn.addEventListener("click", handler);
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
    userList.innerHTML = "";
    usersEmpty.style.display = "none";

    try {
      const snap = await db.collection("users").get();
      if (snap.empty) {
        usersEmpty.style.display = "block";
        return;
      }

      snap.forEach(doc => {
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
            <button class="btn btn-ghost btn-sm" type="button" data-details="${doc.id}">
              Details
            </button>

            <select class="select" data-role="${doc.id}">
              <option value="user" ${role === "user" ? "selected" : ""}>User</option>
              <option value="mod" ${role === "mod" ? "selected" : ""}>Mod</option>
              <option value="admin" ${role === "admin" ? "selected" : ""}>Admin</option>
            </select>
          </div>
        `;

        item.querySelector(`[data-details="${doc.id}"]`).addEventListener("click", () => showUserInfo(doc.id, email, role));
        item.querySelector(`[data-role="${doc.id}"]`).addEventListener("change", (e) => changeRole(doc.id, e.target.value));

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
    userInfoContent.innerHTML = `
      <div class="admin-userinfo__row"><span>E-Mail</span><strong>${escapeHtml(email)}</strong></div>
      <div class="admin-userinfo__row"><span>Rolle</span><strong>${escapeHtml(role)}</strong></div>

      <div class="admin-divider"></div>

      <div class="admin-userinfo__row"><span>Registriert am</span><strong>Unbekannt</strong></div>
      <div class="admin-userinfo__row"><span>Letzter Login</span><strong>Unbekannt</strong></div>

      <div class="admin-divider"></div>

      <button class="btn btn-danger" type="button" id="deleteUserBtn">
        <i class="fa-solid fa-user-xmark"></i> Benutzer löschen
      </button>
    `;

    userInfoContent.querySelector("#deleteUserBtn").addEventListener("click", () => deleteUser(uidDocId, email));
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
    banList.innerHTML = "";
    bansEmpty.style.display = "none";

    try {
      const snap = await db.collection("bans").orderBy("bannedAt", "desc").get();
      if (snap.empty) {
        bansEmpty.style.display = "block";
        return;
      }

      snap.forEach(doc => {
        const data = doc.data() || {};
        const tr = document.createElement("tr");

        tr.innerHTML = `
          <td>${escapeHtml(data.email || "")}</td>
          <td>${escapeHtml(fmtDateTime(data.bannedAt))}</td>
          <td class="col-actions">
            <button class="btn btn-ghost btn-sm" type="button" data-unban="${doc.id}">
              Entsperren
            </button>
          </td>
        `;

        tr.querySelector(`[data-unban="${doc.id}"]`).addEventListener("click", () => removeBan(doc.id));
        banList.appendChild(tr);
      });
    } catch (err) {
      setStatus(`Fehler beim Laden der Sperren: ${err.message}`, "error");
    }
  }

  async function addBan() {
    const email = (banEmail.value || "").trim();
    if (!email) {
      setStatus("Bitte E-Mail eingeben.", "error");
      return;
    }

    try {
      await db.collection("bans").add({
        email,
        bannedAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      banEmail.value = "";
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

  // --- Events
  if (publishBtn) publishBtn.addEventListener("click", saveNewPost);
  if (banAddBtn) banAddBtn.addEventListener("click", addBan);

  // --- Auth Guard + Init
  authRef.onAuthStateChanged(async (user) => {
    if (!user || user.email !== ADMIN_EMAIL) {
      alert("Zugriff verweigert – nur Admin erlaubt");
      await authRef.signOut();
      window.location.href = "index.html";
      return;
    }

    adminBadge.textContent = "Admin ✓";
    setStatus(`Admin-Zugriff erteilt: ${user.email}`, "success");

    // default tab
    setActiveTab("blog-tab");

    // load data
    await loadPosts();
    await loadUsers();
    await loadBans();
  });

})();