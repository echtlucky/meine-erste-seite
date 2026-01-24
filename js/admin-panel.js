(() => {
  "use strict";

  // ===== Config
  const ADMIN_EMAIL = "lucassteckel04@gmail.com";

  // ===== Helpers
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function escapeHtml(str) {
    return String(str ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatDateMaybe(ts) {
    try {
      if (ts?.toDate) return new Date(ts.toDate()).toLocaleString();
      if (ts instanceof Date) return ts.toLocaleString();
      return "Unbekannt";
    } catch {
      return "Unbekannt";
    }
  }

  function setStatus(el, text, type = "info") {
    if (!el) return;
    el.textContent = text || "";
    el.className = `admin-status ${type}`;
  }

  function openModal(modal) {
    if (!modal) return;
    modal.style.display = "flex";
    requestAnimationFrame(() => modal.classList.add("show"));
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
  }

  function closeModal(modal) {
    if (!modal) return;
    modal.classList.remove("show");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
    setTimeout(() => {
      modal.style.display = "none";
    }, 220);
  }

  // ===== Header/Footer loader (connects to menu.js / legal-modal.js)
  async function loadSharedChrome() {
    // Header
    try {
      const headerPH = $("#header-placeholder");
      if (headerPH) {
        const html = await fetch("header.html").then(r => r.text());
        headerPH.innerHTML = html;

        if (typeof window.initHeaderScripts === "function") window.initHeaderScripts();
        if (typeof window.initSmartHeaderScroll === "function") window.initSmartHeaderScroll();
      }
    } catch (e) {
      // silently ignore; page should still work
      console.warn("Header load failed:", e);
    }

    // Footer
    try {
      const footerPH = $("#footer-placeholder");
      if (footerPH) {
        const html = await fetch("footer.html").then(r => r.text());
        footerPH.innerHTML = html;
      }
    } catch (e) {
      console.warn("Footer load failed:", e);
    }
  }

  // ===== Main
  async function init() {
    document.body.classList.add("loaded");

    await loadSharedChrome();

    // Firebase guard
    if (typeof window.firebase === "undefined") {
      alert("Firebase nicht geladen. Prüfe firebase.js + SDKs.");
      return;
    }
    if (typeof window.auth === "undefined") {
      alert("Auth nicht verfügbar. Prüfe firebase.js (auth global).");
      return;
    }

    const db = firebase.firestore();

    // ===== DOM
    const statusEl = $("#status");
    const adminBadge = $("#adminBadge");

    const postList = $("#post-list");
    const userList = $("#user-list");
    const banList = $("#ban-list");

    const postsEmpty = $("#posts-empty");
    const usersEmpty = $("#users-empty");
    const bansEmpty = $("#bans-empty");

    const tabTitle = $("#tab-title");
    const navItems = $$(".admin-nav__item");
    const tabs = $$(".admin-tab");

    const topbarRight = $(".admin-topbar__right");

    // Modals
    const newPostModal = $("#newPostModal");
    const closeNewPostModalBtn = $("#closeNewPostModal");
    const publishBtn = $("#publishBtn");
    const cancelPublishBtn = $("#cancelPublishBtn");
    const newPostBtn = $("#newPostBtn");

    const userInfoModal = $("#userInfoModal");
    const closeUserInfoModalBtn = $("#closeUserInfoModal");

    // Inputs
    const newTitle = $("#new-title");
    const newContent = $("#new-content");
    const newDate = $("#new-date");
    const charCount = $("#char-count");

    const banEmail = $("#ban-email");
    const banAddBtn = $("#banAddBtn");

    // ===== Tabs
    function setActiveTab(tabId) {
      navItems.forEach(b => b.classList.remove("is-active"));
      tabs.forEach(t => t.classList.remove("is-active"));

      const btn = navItems.find(b => b.dataset.tab === tabId);
      if (btn) btn.classList.add("is-active");

      const panel = $("#" + tabId);
      if (panel) panel.classList.add("is-active");

      const titleText = (btn?.innerText || "").trim();
      if (tabTitle) tabTitle.textContent = titleText || "Admin";

      // show top right CTA only on blog
      if (topbarRight) topbarRight.style.display = (tabId === "blog-tab") ? "flex" : "none";
    }

    navItems.forEach(btn => {
      btn.addEventListener("click", () => setActiveTab(btn.dataset.tab));
    });

    // ===== Char count
    function updateCharCount() {
      if (!charCount || !newContent) return;
      charCount.textContent = `${(newContent.value || "").length} Zeichen`;
    }
    if (newContent) newContent.addEventListener("input", updateCharCount);

    // ===== Modals wiring
    if (newPostBtn) {
      newPostBtn.addEventListener("click", () => {
        if (newTitle) newTitle.value = "";
        if (newContent) newContent.value = "";
        if (newDate) newDate.value = "";
        updateCharCount();
        openModal(newPostModal);
      });
    }

    if (closeNewPostModalBtn) closeNewPostModalBtn.addEventListener("click", () => closeModal(newPostModal));
    if (cancelPublishBtn) cancelPublishBtn.addEventListener("click", () => closeModal(newPostModal));

    if (closeUserInfoModalBtn) closeUserInfoModalBtn.addEventListener("click", () => closeModal(userInfoModal));

    if (newPostModal) {
      newPostModal.addEventListener("click", (e) => {
        if (e.target === newPostModal) closeModal(newPostModal);
      });
    }
    if (userInfoModal) {
      userInfoModal.addEventListener("click", (e) => {
        if (e.target === userInfoModal) closeModal(userInfoModal);
      });
    }

    // ===== Data: Posts
    async function loadPosts() {
      if (!postList) return;
      postList.innerHTML = "";
      if (postsEmpty) postsEmpty.style.display = "none";

      try {
        const snap = await db.collection("posts").orderBy("createdAt", "desc").get();

        if (snap.empty) {
          if (postsEmpty) postsEmpty.style.display = "block";
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
              <button class="btn btn-danger btn-sm" type="button" data-del="${doc.id}">
                <i class="fa-solid fa-trash"></i> Löschen
              </button>
            </div>
          `;

          item.querySelector("[data-del]")?.addEventListener("click", () => deletePost(doc.id));
          postList.appendChild(item);
        });
      } catch (err) {
        setStatus(statusEl, "Fehler beim Laden der Posts: " + (err?.message || err), "error");
      }
    }

    async function saveNewPost() {
      const title = (newTitle?.value || "").trim();
      const content = (newContent?.value || "").trim();
      const date = (newDate?.value || "").trim();

      if (!title || !content || !date) {
        setStatus(statusEl, "Bitte alle Felder ausfüllen.", "error");
        return;
      }

      setStatus(statusEl, "Post wird gespeichert…", "info");

      const postData = {
        title,
        content,
        date,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        author: auth.currentUser?.email || "admin"
      };

      try {
        await db.collection("posts").add(postData);
        setStatus(statusEl, "Post veröffentlicht ✅", "success");
        closeModal(newPostModal);
        await loadPosts();
      } catch (err) {
        setStatus(statusEl, "Fehler: " + (err?.message || err), "error");
      }
    }

    async function deletePost(id) {
      if (!confirm("Post wirklich löschen?")) return;

      try {
        await db.collection("posts").doc(id).delete();
        setStatus(statusEl, "Post gelöscht.", "success");
        await loadPosts();
      } catch (err) {
        setStatus(statusEl, "Löschen fehlgeschlagen: " + (err?.message || err), "error");
      }
    }

    if (publishBtn) publishBtn.addEventListener("click", saveNewPost);

    // ===== Data: Users
    async function loadUsers() {
      if (!userList) return;
      userList.innerHTML = "";
      if (usersEmpty) usersEmpty.style.display = "none";

      try {
        const snap = await db.collection("users").get();

        if (snap.empty) {
          if (usersEmpty) usersEmpty.style.display = "block";
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

          item.querySelector("[data-details]")?.addEventListener("click", () => showUserInfo(doc.id, email, role));

          item.querySelector("[data-role]")?.addEventListener("change", (e) => {
            changeRole(doc.id, e.target.value);
          });

          userList.appendChild(item);
        });
      } catch (err) {
        setStatus(statusEl, "Fehler beim Laden der Nutzer: " + (err?.message || err), "error");
      }
    }

    async function changeRole(id, role) {
      try {
        await db.collection("users").doc(id).update({ role });
        setStatus(statusEl, "Rolle aktualisiert ✅", "success");
        await loadUsers();
      } catch (err) {
        setStatus(statusEl, "Fehler: " + (err?.message || err), "error");
      }
    }

    function showUserInfo(id, email, role) {
      const content = $("#user-info-content");
      if (!content) return;

      content.innerHTML = `
        <div class="admin-userinfo__row"><span>E-Mail</span><strong>${escapeHtml(email)}</strong></div>
        <div class="admin-userinfo__row"><span>Rolle</span><strong>${escapeHtml(role)}</strong></div>

        <div class="admin-divider"></div>

        <div class="admin-userinfo__row"><span>Registriert am</span><strong>Unbekannt</strong></div>
        <div class="admin-userinfo__row"><span>Letzter Login</span><strong>Unbekannt</strong></div>
        <div class="admin-userinfo__row"><span>Posts erstellt</span><strong>Unbekannt</strong></div>
        <div class="admin-userinfo__row"><span>Kommentare</span><strong>Unbekannt</strong></div>

        <div class="admin-divider"></div>

        <button class="btn btn-danger" type="button" id="deleteUserBtn">
          <i class="fa-solid fa-user-xmark"></i> Benutzer löschen
        </button>
      `;

      $("#deleteUserBtn", content)?.addEventListener("click", () => deleteUser(id, email));
      openModal(userInfoModal);
    }

    async function deleteUser(id, email) {
      if (!confirm("Benutzer " + email + " wirklich löschen?")) return;

      try {
        await db.collection("users").doc(id).delete();
        setStatus(statusEl, "Benutzer gelöscht.", "success");
        closeModal(userInfoModal);
        await loadUsers();
      } catch (err) {
        setStatus(statusEl, "Löschen fehlgeschlagen: " + (err?.message || err), "error");
      }
    }

    // ===== Data: Bans
    async function loadBans() {
      if (!banList) return;
      banList.innerHTML = "";
      if (bansEmpty) bansEmpty.style.display = "none";

      try {
        const snap = await db.collection("bans").get();

        if (snap.empty) {
          if (bansEmpty) bansEmpty.style.display = "block";
          return;
        }

        snap.forEach(doc => {
          const data = doc.data() || {};
          const tr = document.createElement("tr");

          tr.innerHTML = `
            <td>${escapeHtml(data.email || "")}</td>
            <td>${escapeHtml(formatDateMaybe(data.bannedAt))}</td>
            <td class="col-actions">
              <button class="btn btn-ghost btn-sm" type="button" data-unban="${doc.id}">
                Entsperren
              </button>
            </td>
          `;

          tr.querySelector("[data-unban]")?.addEventListener("click", () => removeBan(doc.id));
          banList.appendChild(tr);
        });
      } catch (err) {
        setStatus(statusEl, "Fehler beim Laden der Sperren: " + (err?.message || err), "error");
      }
    }

    async function addBan() {
      const email = (banEmail?.value || "").trim();
      if (!email) {
        setStatus(statusEl, "Bitte E-Mail eingeben.", "error");
        return;
      }

      try {
        await db.collection("bans").add({
          email,
          bannedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        setStatus(statusEl, "User gebannt ✅", "success");
        if (banEmail) banEmail.value = "";
        await loadBans();
      } catch (err) {
        setStatus(statusEl, "Fehler: " + (err?.message || err), "error");
      }
    }

    async function removeBan(id) {
      if (!confirm("Entsperren?")) return;

      try {
        await db.collection("bans").doc(id).delete();
        setStatus(statusEl, "Sperre entfernt ✅", "success");
        await loadBans();
      } catch (err) {
        setStatus(statusEl, "Fehler: " + (err?.message || err), "error");
      }
    }

    if (banAddBtn) banAddBtn.addEventListener("click", addBan);

    // ===== Auth Guard + Boot
    auth.onAuthStateChanged(async (user) => {
      if (!user || user.email !== ADMIN_EMAIL) {
        alert("Zugriff verweigert – nur Admin erlaubt");
        try { await auth.signOut(); } catch {}
        window.location.href = "index.html";
        return;
      }

      if (adminBadge) adminBadge.textContent = "Admin ✓";
      setStatus(statusEl, "Admin-Zugriff erteilt: " + user.email, "success");

      // Default tab
      setActiveTab("blog-tab");

      // Initial load
      await loadPosts();
      await loadUsers();
      await loadBans();
    });
  }

  // DOM Ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();