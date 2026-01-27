// js/blog.js - echtlucky
// Public blog feed (no-login read) + comments + safe rendering.

(() => {
  "use strict";

  const PAGE_SIZE = 8;

  let db = null;
  let firebase = null;

  let isLoading = false;
  let cursorPosts = null;
  let cursorBlog = null;
  let exhaustedPosts = false;
  let exhaustedBlog = false;

  const renderedIds = new Set();

  let currentPost = null; // { collection, id }
  let commentsUnsub = null;

  function waitForFirebase() {
    return new Promise((resolve) => {
      if (window.db && window.firebase) {
        db = window.db;
        firebase = window.firebase;
        resolve();
        return;
      }

      const handler = () => {
        db = window.db;
        firebase = window.firebase;
        resolve();
      };

      window.addEventListener("firebaseReady", handler, { once: true });
      setTimeout(() => {
        db = window.db;
        firebase = window.firebase;
        resolve();
      }, 5000);
    });
  }

  function el() {
    return {
      blogList: document.getElementById("blog-list"),
      postCountPill: document.getElementById("postCountPill"),
      loadMoreBtn: document.getElementById("loadMoreBtn"),

      postModal: document.getElementById("postModal"),
      modalCloseBtn: document.getElementById("modalCloseBtn"),
      postTitle: document.getElementById("post-title"),
      postMeta: document.getElementById("post-meta"),
      postContent: document.getElementById("post-content"),

      editPostBtn: document.getElementById("edit-post-btn"),
      deletePostBtn: document.getElementById("delete-post-btn"),

      commentsMeta: document.getElementById("commentsMeta"),
      commentsList: document.getElementById("commentsList"),
      commentForm: document.getElementById("commentForm"),
      commentText: document.getElementById("commentText"),
      commentLoginBtn: document.getElementById("commentLoginBtn"),
      commentSubmitBtn: document.getElementById("commentSubmitBtn"),
    };
  }

  function getUser() {
    return window.__ECHTLUCKY_CURRENT_USER__ || null;
  }

  function isAdminUser(user) {
    if (!user) return false;
    try {
      if (typeof window.echtlucky?.isAdminByEmail === "function") {
        return !!window.echtlucky.isAdminByEmail(user);
      }
    } catch (_) {}

    try {
      const cache = JSON.parse(localStorage.getItem("echtlucky:role-cache:v1") || "{}");
      const role = cache?.[user.uid]?.role;
      return role === "admin";
    } catch (_) {
      return false;
    }
  }

  function escapeHtml(text) {
    const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
    return String(text || "").replace(/[&<>"']/g, (m) => map[m]);
  }

  function normalizeDate(ts) {
    if (!ts) return null;
    try {
      if (ts.toDate) return ts.toDate();
      if (typeof ts === "number") return new Date(ts);
      if (typeof ts === "string") return new Date(ts);
      if (ts.seconds) return new Date(ts.seconds * 1000);
    } catch (_) {}
    return null;
  }

  function formatDate(ts) {
    const d = normalizeDate(ts);
    if (!d || Number.isNaN(d.getTime())) return "Unbekannt";
    return d.toLocaleDateString("de-DE", { year: "numeric", month: "long", day: "numeric" });
  }

  function createdAtMs(post) {
    const d = normalizeDate(post?.createdAt);
    return d ? d.getTime() : 0;
  }

  function linkifyPlainText(text) {
    const safe = escapeHtml(text);

    const withMd = safe.replace(/\[([^\]]{1,120})\]\((https?:\/\/[^\s)]+)\)/g, (m, label, url) => {
      const href = String(url);
      return `<a href="${href}" target="_blank" rel="noopener noreferrer">${label}</a>`;
    });

    const withUrls = withMd.replace(/(https?:\/\/[^\s<]+[^\s<\.)])/g, (m) => {
      const href = String(m);
      return `<a href="${href}" target="_blank" rel="noopener noreferrer">${href}</a>`;
    });

    return withUrls.replace(/\n/g, "<br>");
  }

  function sanitizeHtml(html) {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(String(html || ""), "text/html");
      const allowed = new Set(["A", "BR", "P", "UL", "OL", "LI", "STRONG", "EM", "B", "I", "CODE", "PRE", "BLOCKQUOTE", "H3", "H4"]);

      const walk = (node) => {
        const children = Array.from(node.childNodes || []);
        for (const child of children) {
          if (child.nodeType === Node.ELEMENT_NODE) {
            const tag = child.tagName;
            if (!allowed.has(tag)) {
              const replacement = doc.createTextNode(child.textContent || "");
              child.replaceWith(replacement);
              continue;
            }

            const attrs = Array.from(child.attributes || []);
            for (const a of attrs) child.removeAttribute(a.name);

            if (tag === "A") {
              const rawHref = child.getAttribute("href") || "";
              const href = String(rawHref);
              if (!/^https?:\/\//i.test(href) && !/^mailto:/i.test(href)) {
                child.replaceWith(doc.createTextNode(child.textContent || ""));
                continue;
              }
              child.setAttribute("href", href);
              child.setAttribute("target", "_blank");
              child.setAttribute("rel", "noopener noreferrer");
            }

            walk(child);
          }

          if (child.nodeType === Node.COMMENT_NODE) {
            child.remove();
          }
        }
      };

      walk(doc.body);
      return doc.body.innerHTML;
    } catch (_) {
      return linkifyPlainText(String(html || ""));
    }
  }

  function renderPostContent(post) {
    const raw = String(post?.content || post?.body || post?.text || "");
    const looksLikeHtml = /<\s*\w+[^>]*>/.test(raw);
    return looksLikeHtml ? sanitizeHtml(raw) : linkifyPlainText(raw);
  }

  function getPostKey(p) {
    return `${p._collection}:${p.id}`;
  }

  function renderPostCard(post) {
    const title = escapeHtml(post.title || "Untitled");
    const createdAt = formatDate(post.createdAt);

    const excerptRaw = String(post.content || post.body || "");
    const excerpt = escapeHtml(excerptRaw.replace(/<[^>]*>/g, "").trim()).slice(0, 140);

    return `
      <article class="blog-card" data-post-id="${post.id}" data-collection="${post._collection}">
        <div class="card-top">
          <span class="blog-badge"><i class="fa-solid fa-pen-nib" aria-hidden="true"></i> Post</span>
          <span class="meta">${createdAt}</span>
        </div>
        <h2>${title}</h2>
        <p class="preview">${excerpt}${excerpt.length ? "..." : ""}</p>
        <div class="card-actions">
          <button class="btn btn-read" type="button" data-post-id="${post.id}" data-collection="${post._collection}">Lesen -&gt;</button>
          <button class="btn btn-share" type="button" data-post-id="${post.id}" data-collection="${post._collection}" title="Link kopieren">🔗</button>
        </div>
      </article>
    `;
  }

  function updateCountPill() {
    const count = renderedIds.size;
    const pill = el().postCountPill;
    if (!pill) return;
    pill.innerHTML = `<i class="fa-solid fa-pen-nib" aria-hidden="true"></i> ${count} ${count === 1 ? "Post" : "Posts"}`;
  }

  async function fetchNextBatchFrom(collection, cursor) {
    if (!db) return { docs: [], cursor: null, exhausted: true };

    let q = db.collection(collection).orderBy("createdAt", "desc").limit(PAGE_SIZE);
    if (cursor) q = q.startAfter(cursor);

    const snap = await q.get();
    if (snap.empty) return { docs: [], cursor: cursor || null, exhausted: true };

    const docs = snap.docs.map((d) => ({ id: d.id, _collection: collection, ...d.data() }));
    const nextCursor = snap.docs[snap.docs.length - 1];
    return { docs, cursor: nextCursor, exhausted: false };
  }

  async function loadInitial() {
    renderedIds.clear();
    cursorPosts = null;
    cursorBlog = null;
    exhaustedPosts = false;
    exhaustedBlog = false;

    const list = el().blogList;
    if (list) {
      list.innerHTML = `
        <div class="loading-spinner">
          <div class="spinner"></div>
          <p class="loading-text">Posts werden geladen...</p>
        </div>
      `;
    }

    await loadMore();

    const hash = String(window.location.hash || "");
    const m = hash.match(/#post=([a-z-]+):([a-zA-Z0-9_-]+)/);
    if (m) {
      openPostModal(m[1], m[2]).catch(() => {});
    }
  }

  async function loadMore() {
    if (isLoading) return;
    isLoading = true;

    const list = el().blogList;
    const btn = el().loadMoreBtn;

    try {
      const [a, b] = await Promise.all([
        exhaustedPosts ? Promise.resolve({ docs: [], cursor: cursorPosts, exhausted: true }) : fetchNextBatchFrom("posts", cursorPosts),
        exhaustedBlog ? Promise.resolve({ docs: [], cursor: cursorBlog, exhausted: true }) : fetchNextBatchFrom("blog", cursorBlog),
      ]);

      cursorPosts = a.cursor;
      cursorBlog = b.cursor;
      exhaustedPosts = exhaustedPosts || a.exhausted;
      exhaustedBlog = exhaustedBlog || b.exhausted;

      const merged = [...(a.docs || []), ...(b.docs || [])].sort((x, y) => createdAtMs(y) - createdAtMs(x));

      const fresh = [];
      for (const p of merged) {
        const key = getPostKey(p);
        if (renderedIds.has(key)) continue;
        fresh.push(p);
      }

      const slice = fresh.slice(0, PAGE_SIZE);

      if (!list) return;

      if (renderedIds.size === 0) list.innerHTML = "";

      if (!slice.length && renderedIds.size === 0) {
        list.innerHTML = `
          <div class="empty-state">
            <p>Noch keine Blog-Posts vorhanden.</p>
          </div>
        `;
      } else {
        for (const p of slice) renderedIds.add(getPostKey(p));
        list.insertAdjacentHTML("beforeend", slice.map(renderPostCard).join(""));
      }

      updateCountPill();

      if (btn) {
        const hasMore = !(exhaustedPosts && exhaustedBlog);
        btn.style.display = hasMore ? "inline-flex" : "none";
      }
    } catch (err) {
      console.error("blog loadMore error:", err);
      if (list && renderedIds.size === 0) {
        list.innerHTML = `
          <div class="error-state">
            <p style="color:#ff6699;">Fehler beim Laden: ${escapeHtml(err?.message || String(err))}</p>
            <button class="btn" type="button" onclick="location.reload()">Seite neu laden</button>
          </div>
        `;
      }
    } finally {
      isLoading = false;
    }
  }

  function openModal() {
    const m = el().postModal;
    if (!m) return;
    m.classList.add("show");
    m.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  function closeModal() {
    const m = el().postModal;
    if (!m) return;
    m.classList.remove("show");
    m.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "auto";

    currentPost = null;
    stopCommentsListener();

    const editBtn = el().editPostBtn;
    if (editBtn) {
      editBtn.hidden = true;
      editBtn.textContent = "Bearbeiten";
    }
  }

  function stopCommentsListener() {
    if (typeof commentsUnsub === "function") {
      try { commentsUnsub(); } catch (_) {}
    }
    commentsUnsub = null;
  }

  async function fetchPostDoc(collection, id) {
    const snap = await db.collection(collection).doc(id).get();
    if (!snap.exists) return null;
    return { id: snap.id, _collection: collection, ...snap.data() };
  }

  function canEditPost(post) {
    const user = getUser();
    if (!user) return false;
    if (isAdminUser(user)) return true;
    const authorUid = post?.authorUid || post?.author || post?.uid;
    return !!authorUid && String(authorUid) === String(user.uid);
  }

  function renderPostMeta(post) {
    const author = post?.authorName || post?.author || post?.displayName || "";
    const date = formatDate(post?.createdAt);
    return author ? `${date} - ${author}` : date;
  }

  async function openPostModal(collection, id) {
    const elements = el();
    if (!db) return;

    currentPost = { collection, id };

    if (elements.postTitle) elements.postTitle.textContent = "...";
    if (elements.postMeta) elements.postMeta.textContent = "";
    if (elements.postContent) elements.postContent.innerHTML = "<p>Lade...</p>";

    openModal();

    let post = null;
    try {
      post = await fetchPostDoc(collection, id);
      if (!post) {
        const other = collection === "posts" ? "blog" : "posts";
        post = await fetchPostDoc(other, id);
        if (post) currentPost = { collection: other, id };
      }

      if (!post) {
        if (elements.postContent) elements.postContent.innerHTML = "<p>Post nicht gefunden.</p>";
        return;
      }

      if (elements.postTitle) elements.postTitle.textContent = post.title || "Untitled";
      if (elements.postMeta) elements.postMeta.textContent = renderPostMeta(post);
      if (elements.postContent) elements.postContent.innerHTML = renderPostContent(post) || "<p>Kein Inhalt.</p>";

      const canEdit = canEditPost(post);
      if (elements.editPostBtn) elements.editPostBtn.hidden = !canEdit;
      if (elements.deletePostBtn) elements.deletePostBtn.hidden = !canEdit;

      startCommentsListener(currentPost.collection, currentPost.id);
      updateCommentAuthUI();

      try {
        window.location.hash = `post=${currentPost.collection}:${currentPost.id}`;
      } catch (_) {}
    } catch (err) {
      console.error("openPostModal error:", err);
      if (elements.postContent) {
        elements.postContent.innerHTML = `<p style="color:#ff6699;">Fehler: ${escapeHtml(err?.message || String(err))}</p>`;
      }
    }
  }

  function updateCommentAuthUI() {
    const elements = el();
    const user = getUser();

    if (elements.commentLoginBtn) elements.commentLoginBtn.hidden = !!user;
    if (elements.commentSubmitBtn) elements.commentSubmitBtn.disabled = !user;

    if (!user && elements.commentText) {
      elements.commentText.value = "";
    }
  }

  function renderCommentItem(comment) {
    const user = getUser();
    const isAdmin = isAdminUser(user);
    const isMine = user && String(user.uid) === String(comment.authorUid);

    const name = escapeHtml(comment.authorName || "User");
    const created = formatDate(comment.createdAt);
    const body = linkifyPlainText(String(comment.text || ""));

    return `
      <div class="comment" data-comment-id="${comment.id}">
        <div class="comment__avatar" aria-hidden="true">${escapeHtml(String(name).slice(0, 1).toUpperCase())}</div>
        <div class="comment__body">
          <div class="comment__top">
            <div class="comment__meta">
              <strong class="comment__name">${name}</strong>
              <span class="comment__date">${created}</span>
            </div>
            <div class="comment__actions" ${isMine || isAdmin ? "" : "hidden"}>
              <button class="comment__btn" type="button" data-action="edit" ${isMine ? "" : "hidden"}>Bearbeiten</button>
              <button class="comment__btn comment__btn--danger" type="button" data-action="delete">Loeschen</button>
            </div>
          </div>
          <div class="comment__text">${body}</div>
        </div>
      </div>
    `;
  }

  function startCommentsListener(collection, postId) {
    stopCommentsListener();

    const elements = el();
    if (!elements.commentsList) return;

    elements.commentsList.innerHTML = `<div class="comments-empty">Lade Kommentare...</div>`;

    const ref = db.collection(collection).doc(postId).collection("comments");
    commentsUnsub = ref.orderBy("createdAt", "asc").limit(200).onSnapshot(
      (snap) => {
        const comments = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

        if (elements.commentsMeta) {
          elements.commentsMeta.textContent = `${comments.length} ${comments.length === 1 ? "Kommentar" : "Kommentare"}`;
        }

        if (!comments.length) {
          elements.commentsList.innerHTML = `<div class="comments-empty">Noch keine Kommentare.</div>`;
          return;
        }

        elements.commentsList.innerHTML = comments.map(renderCommentItem).join("");
      },
      (err) => {
        console.error("comments listener error:", err);
        if (elements.commentsList) {
          elements.commentsList.innerHTML = `<div class="comments-empty" style="color:#ff6699;">Kommentare konnten nicht geladen werden.</div>`;
        }
      }
    );
  }

  async function submitComment() {
    const elements = el();
    if (!currentPost) return;

    const user = getUser();
    if (!user) {
      window.notify?.show?.({
        type: "warn",
        title: "Login",
        message: "Bitte melde dich an, um zu kommentieren.",
        duration: 3500,
      });
      return;
    }

    const text = String(elements.commentText?.value || "").trim();
    if (!text) return;

    const safeText = text.slice(0, 600);

    const authorName = user.displayName || (user.email ? user.email.split("@")[0] : "User");

    try {
      elements.commentSubmitBtn.disabled = true;

      await db
        .collection(currentPost.collection)
        .doc(currentPost.id)
        .collection("comments")
        .add({
          authorUid: user.uid,
          authorName: authorName,
          text: safeText,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        });

      elements.commentText.value = "";
    } catch (err) {
      console.error("submitComment error:", err);
      window.notify?.show?.({
        type: "error",
        title: "Kommentar",
        message: err?.message || "Kommentar konnte nicht gesendet werden.",
        duration: 4500,
      });
    } finally {
      elements.commentSubmitBtn.disabled = false;
    }
  }

  async function editComment(commentId) {
    if (!currentPost || !commentId) return;

    const user = getUser();
    if (!user) return;

    try {
      const ref = db.collection(currentPost.collection).doc(currentPost.id).collection("comments").doc(commentId);
      const snap = await ref.get();
      if (!snap.exists) return;

      const data = snap.data() || {};
      if (String(data.authorUid || "") !== String(user.uid)) return;

      const next = await window.echtluckyModal?.input?.({
        title: "Kommentar bearbeiten",
        placeholder: "Kommentar...",
        initialValue: String(data.text || "").slice(0, 600),
        confirmText: "Speichern",
        cancelText: "Abbrechen",
      });

      if (next === null) return;

      await ref.set(
        {
          text: String(next || "").trim().slice(0, 600),
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    } catch (err) {
      console.error("editComment error:", err);
    }
  }

  async function deleteComment(commentId) {
    if (!currentPost || !commentId) return;

    const user = getUser();
    if (!user) return;

    const ok = await window.echtluckyModal?.confirm?.({
      title: "Kommentar loeschen",
      message: "Willst du diesen Kommentar wirklich loeschen?",
      confirmText: "Loeschen",
      cancelText: "Abbrechen",
      type: "danger",
    });

    if (!ok) return;

    try {
      await db.collection(currentPost.collection).doc(currentPost.id).collection("comments").doc(commentId).delete();
    } catch (err) {
      console.error("deleteComment error:", err);
    }
  }

  async function deletePost() {
    if (!currentPost) return;

    const ok = await window.echtluckyModal?.confirm?.({
      title: "Post loeschen",
      message: "Moechtest du diesen Post wirklich loeschen?",
      confirmText: "Ja, loeschen",
      cancelText: "Abbrechen",
      type: "danger",
    });

    if (!ok) return;

    try {
      await db.collection(currentPost.collection).doc(currentPost.id).delete();
      closeModal();
      await loadInitial();
    } catch (err) {
      console.error("deletePost error:", err);
      window.notify?.show?.({
        type: "error",
        title: "Post",
        message: err?.message || "Konnte nicht loeschen.",
        duration: 4500,
      });
    }
  }

  async function editPost() {
    if (!currentPost) return;
    const elements = el();

    const snap = await db.collection(currentPost.collection).doc(currentPost.id).get();
    if (!snap.exists) return;

    const post = snap.data() || {};
    const canEdit = canEditPost(post);
    if (!canEdit) return;

    const title = String(post.title || "");
    const content = String(post.content || post.body || "");

    elements.postContent.innerHTML = `
      <div class="post-edit">
        <label class="post-edit__label" for="postEditTitle">Titel</label>
        <input id="postEditTitle" class="post-edit__title" type="text" maxlength="80" value="${escapeHtml(title)}" />

        <label class="post-edit__label" for="postEditContent">Inhalt</label>
        <textarea id="postEditContent" class="post-edit__content" rows="10" maxlength="12000">${escapeHtml(content)}</textarea>

        <div class="post-edit__actions">
          <button class="btn btn-sm" id="postEditSave" type="button">Speichern</button>
          <button class="btn btn-sm btn-secondary" id="postEditCancel" type="button">Abbrechen</button>
        </div>
        <p class="post-edit__hint">Links: URL einfuegen oder Markdown nutzen: [Text](https://...)</p>
      </div>
    `;

    const saveBtn = document.getElementById("postEditSave");
    const cancelBtn = document.getElementById("postEditCancel");

    cancelBtn?.addEventListener("click", async () => {
      const refreshed = await fetchPostDoc(currentPost.collection, currentPost.id);
      if (!refreshed) return;
      elements.postTitle.textContent = refreshed.title || "Untitled";
      elements.postMeta.textContent = renderPostMeta(refreshed);
      elements.postContent.innerHTML = renderPostContent(refreshed) || "<p>Kein Inhalt.</p>";
    });

    saveBtn?.addEventListener("click", async () => {
      const t = String(document.getElementById("postEditTitle")?.value || "").trim().slice(0, 80);
      const c = String(document.getElementById("postEditContent")?.value || "").trim().slice(0, 12000);

      if (!t) {
        window.notify?.show?.({ type: "warn", title: "Titel", message: "Bitte Titel setzen.", duration: 2500 });
        return;
      }

      try {
        await db.collection(currentPost.collection).doc(currentPost.id).set(
          {
            title: t,
            content: c,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        const refreshed = await fetchPostDoc(currentPost.collection, currentPost.id);
        if (!refreshed) return;
        elements.postTitle.textContent = refreshed.title || "Untitled";
        elements.postMeta.textContent = renderPostMeta(refreshed);
        elements.postContent.innerHTML = renderPostContent(refreshed) || "<p>Kein Inhalt.</p>";

        window.notify?.show?.({ type: "success", title: "Post", message: "Gespeichert.", duration: 2500 });
      } catch (err) {
        console.error("editPost save error:", err);
        window.notify?.show?.({ type: "error", title: "Post", message: err?.message || "Fehler beim Speichern.", duration: 4500 });
      }
    });
  }

  function sharePost(collection, id) {
    const url = `${window.location.origin}${window.location.pathname}#post=${collection}:${id}`;
    navigator.clipboard
      .writeText(url)
      .then(() => window.notify?.show?.({ type: "success", title: "Link kopiert", message: "Link kopiert.", duration: 2500 }))
      .catch(() => {});
  }

  function wireEvents() {
    const elements = el();

    elements.modalCloseBtn?.addEventListener("click", closeModal);
    elements.postModal?.addEventListener("click", (e) => {
      if (e.target === elements.postModal) closeModal();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && elements.postModal?.classList.contains("show")) closeModal();
    });

    elements.loadMoreBtn?.addEventListener("click", (e) => {
      e.preventDefault();
      loadMore();
    });

    document.addEventListener("click", (e) => {
      const readBtn = e.target.closest?.(".btn-read");
      if (readBtn) {
        const postId = readBtn.dataset.postId;
        const collection = readBtn.dataset.collection || "posts";
        openPostModal(collection, postId).catch(() => {});
        return;
      }

      const shareBtn = e.target.closest?.(".btn-share");
      if (shareBtn) {
        const postId = shareBtn.dataset.postId;
        const collection = shareBtn.dataset.collection || "posts";
        sharePost(collection, postId);
        return;
      }

      const commentBtn = e.target.closest?.(".comment__btn");
      if (commentBtn) {
        const action = commentBtn.dataset.action;
        const commentEl = commentBtn.closest?.(".comment");
        const commentId = commentEl?.dataset.commentId;
        if (!commentId) return;

        if (action === "edit") editComment(commentId);
        if (action === "delete") deleteComment(commentId);
        return;
      }

      const editPostBtn = e.target.closest?.("#edit-post-btn");
      if (editPostBtn && !editPostBtn.hidden) {
        editPost().catch(() => {});
        return;
      }

      const deletePostBtn = e.target.closest?.("#delete-post-btn");
      if (deletePostBtn && !deletePostBtn.hidden) {
        deletePost().catch(() => {});
      }
    });

    elements.commentForm?.addEventListener("submit", (e) => {
      e.preventDefault();
      submitComment().catch(() => {});
    });

    try {
      window.auth?.onAuthStateChanged?.(() => updateCommentAuthUI());
    } catch (_) {}
  }

  async function init() {
    await waitForFirebase();
    if (!db || !firebase) return;

    wireEvents();
    await loadInitial();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
