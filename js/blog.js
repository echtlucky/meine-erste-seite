/* =========================
   blog.js — echtlucky
   Blog-Verwaltung & Post-Anzeige
========================= */

(() => {
  "use strict";

  let db = null;
  const PAGE_SIZE = 5;
  let lastVisible = null;
  let isLoading = false;

  // Wait for Firebase to be ready
  function waitForFirebase() {
    return new Promise((resolve) => {
      if (window.firebaseReady && window.db) {
        db = window.db;
        console.log("✅ blog.js: Firebase ready");
        resolve();
        return;
      }

      const handler = () => {
        db = window.db;
        console.log("✅ blog.js: Firebase ready via event");
        resolve();
      };

      window.addEventListener("firebaseReady", handler, { once: true });

      setTimeout(() => {
        if (window.db) {
          db = window.db;
          console.log("✅ blog.js: Firebase ready via timeout");
          resolve();
        } else {
          console.error("❌ blog.js: Firebase timeout");
          resolve();
        }
      }, 5000);
    });
  }

  // ==================== Initialization ====================
  async function init() {
    console.log("🔵 blog.js initializing");
    await waitForFirebase();

    if (!db) {
      console.error("❌ blog.js: Firebase NOT ready");
      return;
    }

    console.log("✅ blog.js setup complete");
    loadPosts();
    setupEventListeners();
    // Header/Footer werden per HTML-Template geladen (blog.html).
  }

  // Start when DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
  function getElements() {
    return {
      blogList: document.getElementById("blog-list"),
      postModal: document.getElementById("postModal"),
      postTitle: document.getElementById("post-title"),
      postMeta: document.getElementById("post-meta"),
      postContent: document.getElementById("post-content"),
      modalCloseBtn: document.getElementById("modalCloseBtn"),
      deletePostBtn: document.getElementById("delete-post-btn"),
      postCountPill: document.getElementById("postCountPill"),
      loadMoreBtn: document.getElementById("loadMoreBtn")
    };
  }

  // ==================== Event Listeners ====================
  function setupEventListeners() {
    const el = getElements();
    
    if (el.modalCloseBtn) {
      el.modalCloseBtn.addEventListener("click", closeModal);
    }
    
    if (el.postModal) {
      el.postModal.addEventListener("click", (e) => {
        if (e.target === el.postModal) closeModal();
      });
    }
    
    if (el.loadMoreBtn) {
      el.loadMoreBtn.addEventListener("click", (e) => {
        e.preventDefault();
        loadMorePosts();
      });
    }

    // Keyboard events
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && el.postModal.classList.contains("active")) {
        closeModal();
      }
    });
  }

  // ==================== Load Posts ====================
  async function loadPosts() {
    const el = getElements();
    
    try {
      isLoading = true;
      
      if (!el.blogList) {
        console.error("❌ Blog-List nicht gefunden");
        return;
      }

      // Zeige Loading-Spinner
      el.blogList.innerHTML = `
        <div class="loading-spinner">
          <div class="spinner"></div>
          <p class="loading-text">Posts werden geladen...</p>
        </div>
      `;

      // Versuche Posts aus 'posts' Collection zu laden (Admin-Posts)
      let posts = [];
      let query = db.collection("posts")
        .orderBy("createdAt", "desc")
        .limit(PAGE_SIZE);

      const snapshot = await query.get();
      
      if (snapshot.empty) {
        console.warn("⚠️  Keine Posts in 'posts' Collection gefunden, versuche 'blog' Collection...");
        
        // Fallback zu 'blog' Collection (User-Posts)
        const blogSnapshot = await db.collection("blog")
          .orderBy("createdAt", "desc")
          .limit(PAGE_SIZE)
          .get();
        
        if (blogSnapshot.empty) {
          el.blogList.innerHTML = `
            <div class="empty-state">
              <p>Noch keine Blog-Posts vorhanden. 📝</p>
            </div>
          `;
          el.postCountPill.textContent = "📝 0 Posts";
          return;
        }

        posts = blogSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        lastVisible = blogSnapshot.docs[blogSnapshot.docs.length - 1];
      } else {
        posts = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        lastVisible = snapshot.docs[snapshot.docs.length - 1];
      }

      renderPosts(posts);
      el.postCountPill.textContent = `📝 ${posts.length} ${posts.length === 1 ? "Post" : "Posts"}`;

    } catch (error) {
      console.error("❌ Fehler beim Laden der Posts:", error);
      
      el.blogList.innerHTML = `
        <div class="error-state">
          <p style="color: #ff6699;">Fehler beim Laden: ${error.message}</p>
          <button class="btn" onclick="location.reload()">Seite neu laden</button>
        </div>
      `;
    } finally {
      isLoading = false;
    }
  }

  // ==================== Load More Posts ====================
  async function loadMorePosts() {
    if (isLoading || !lastVisible) return;

    try {
      isLoading = true;

      const query = db.collection("posts")
        .orderBy("createdAt", "desc")
        .startAfter(lastVisible)
        .limit(PAGE_SIZE);

      const snapshot = await query.get();

      if (snapshot.empty) {
        getElements().loadMoreBtn?.style.display = "none";
        return;
      }

      const posts = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      const el = getElements();
      const existingList = el.blogList.innerHTML;
      el.blogList.innerHTML = existingList + posts.map(renderPostItem).join("");
      
      lastVisible = snapshot.docs[snapshot.docs.length - 1];

    } catch (error) {
      console.error("❌ Fehler beim Laden weiterer Posts:", error);
    } finally {
      isLoading = false;
    }
  }

  // ==================== Render Posts ====================
  function renderPosts(posts) {
    const el = getElements();
    
    if (!posts || posts.length === 0) {
      el.blogList.innerHTML = `
        <div class="empty-state">
          <p>Noch keine Blog-Posts vorhanden. 📝</p>
        </div>
      `;
      return;
    }

    el.blogList.innerHTML = posts.map(renderPostItem).join("");
  }

  function renderPostItem(post) {
    const createdAt = formatDate(post.createdAt);
    const excerpt = (post.content || "").substring(0, 100).replace(/<[^>]*>/g, "") + "...";
    
    return `
      <article class="blog-post-card" data-post-id="${post.id}">
        <div class="blog-post-header">
          <h2 class="blog-post-title">${escapeHtml(post.title || "Untitled")}</h2>
          <time class="blog-post-date">${createdAt}</time>
        </div>
        <p class="blog-post-excerpt">${escapeHtml(excerpt)}</p>
        <div class="blog-post-actions">
          <button class="btn btn-read" data-post-id="${post.id}">Lesen →</button>
          <button class="btn btn-share" data-post-id="${post.id}" title="Kopiere Link">🔗</button>
        </div>
      </article>
    `;
  }

  // ==================== Post Details ====================
  function openPostModal(postId) {
    const el = getElements();
    
    // Finde Post in DOM
    const postCard = document.querySelector(`[data-post-id="${postId}"]`);
    if (!postCard) return;

    const titleEl = postCard.querySelector(".blog-post-title");
    const dateEl = postCard.querySelector(".blog-post-date");
    
    el.postTitle.textContent = titleEl?.textContent || "Untitled";
    el.postMeta.textContent = dateEl?.textContent || "";
    
    // Lade kompletten Post-Content
    loadPostContent(postId);
    
    el.postModal.classList.add("active");
    el.postModal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  async function loadPostContent(postId) {
    const el = getElements();
    
    try {
      // Versuche aus 'posts' Collection
      let docSnapshot = await db.collection("posts").doc(postId).get();
      
      if (!docSnapshot.exists) {
        // Fallback zu 'blog' Collection
        docSnapshot = await db.collection("blog").doc(postId).get();
      }

      if (!docSnapshot.exists) {
        el.postContent.innerHTML = "<p>Post nicht gefunden.</p>";
        return;
      }

      const post = docSnapshot.data();
      el.postContent.innerHTML = post.content || "<p>Kein Inhalt.</p>";
      
      // Update Delete Button
      el.deletePostBtn.onclick = () => deletePost(postId);
      el.deletePostBtn.style.display = isAdminOrAuthor(post) ? "inline-block" : "none";

    } catch (error) {
      console.error("❌ Fehler beim Laden des Posts:", error);
      el.postContent.innerHTML = `<p style="color: #ff6699;">Fehler: ${error.message}</p>`;
    }
  }

  function closeModal() {
    const el = getElements();
    el.postModal.classList.remove("active");
    el.postModal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "auto";
  }

  // ==================== Delete Post ====================
  async function deletePost(postId) {
    const confirmed = await echtluckyModal.confirm({
      title: "Post löschen",
      message: "Möchtest du diesen Post wirklich löschen? Dies kann nicht rückgängig gemacht werden.",
      confirmText: "Ja, löschen",
      cancelText: "Abbrechen",
      type: "danger"
    });

    if (!confirmed) return;

    try {
      // Versuche aus 'posts' Collection
      await db.collection("posts").doc(postId).delete();
      closeModal();
      loadPosts();
    } catch (error) {
      console.error("❌ Fehler beim Löschen:", error);
      await echtluckyModal.alert({
        title: "Fehler",
        message: "Fehler beim Löschen: " + error.message,
        type: "error"
      });
    }
  }

  // ==================== Share Post ====================
  function sharePost(postId) {
    const url = `${window.location.origin}${window.location.pathname}#post-${postId}`;
    navigator.clipboard.writeText(url).then(() => {
      if (window.notify) {
        window.notify.show({
          type: "success",
          title: "Erfolgreich",
          message: "Link kopiert! 📋",
          duration: 3000
        });
      }
    });
  }

  // ==================== Helper Functions ====================
  function formatDate(timestamp) {
    if (!timestamp) return "Unbekannt";
    
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toLocaleDateString("de-DE", {
        year: "numeric",
        month: "long",
        day: "numeric"
      });
    } catch (e) {
      return "Unbekannt";
    }
  }

  function escapeHtml(text) {
    const map = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    };
    return text.replace(/[&<>"']/g, m => map[m]);
  }

  function isAdminOrAuthor(post) {
    // Überprüfe ob aktueller User Admin oder Author ist
    // Diese Info müsste aus auth-state.js kommen
    return window.currentUser?.uid === post.author || window.currentUser?.isAdmin;
  }

  // ==================== Load Header ====================
  function loadHeader() {
    const headerPlaceholder = document.getElementById("header-placeholder");
    if (!headerPlaceholder) return;

    fetch("header.html")
      .then(r => r.text())
      .then(html => {
        headerPlaceholder.innerHTML = html;
        // Lade Header-spezifische Scripts
        const headerScript = document.createElement("script");
        headerScript.src = "js/menu.js";
        document.body.appendChild(headerScript);
      })
      .catch(e => console.error("❌ Header nicht geladen:", e));
  }

  // ==================== Event Delegation ====================
  document.addEventListener("click", (e) => {
    if (e.target.classList.contains("btn-read")) {
      const postId = e.target.dataset.postId;
      openPostModal(postId);
    }
    
    if (e.target.classList.contains("btn-share")) {
      const postId = e.target.dataset.postId;
      sharePost(postId);
    }
  });

})();
