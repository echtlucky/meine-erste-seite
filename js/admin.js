import {
  onAuthStateChanged,
  getIdTokenResult,
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import {
  addDoc,
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getCountFromServer,
  getDocs,
  setDoc,
  limit,
  orderBy,
  query,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import { appAuth, appDb } from "./firebase-init.js";
import { loadLayout } from "./layout.js";
import "./auth-modal.js";
const adminStatus = document.getElementById("admin-status");
const adminStatusText = adminStatus.querySelector(".admin-status-text");
const adminGrid = document.querySelector(".admin-grid");

const adminLoginForm = document.getElementById("admin-login-form");
const adminLoginMessage = document.getElementById("admin-login-message");
const adminLogoutBtn = document.getElementById("admin-logout");

const normalizeUsername = (value) => value.trim().toLowerCase();
const usernameToEmail = (username) => `${username}@lcky.app`;

const blogForm = document.getElementById("blog-form");
const blogList = document.getElementById("blog-list");
const userList = document.getElementById("user-list");
const commentList = document.getElementById("comment-list");

const statPosts = document.getElementById("stat-posts");
const statUsers = document.getElementById("stat-users");
const statComments = document.getElementById("stat-comments");
const refreshStatsBtn = document.getElementById("refresh-stats");

const formatDate = (value) => {
  if (!value) return "-";
  try {
    const date = value.toDate ? value.toDate() : new Date(value);
    return date.toLocaleDateString("de-DE", {
      year: "numeric",
      month: "long",
      day: "numeric"
    });
  } catch {
    return "-";
  }
};

const ensureAdmin = async (user) => {
  const token = await getIdTokenResult(user, true);
  return token.claims && token.claims.admin === true;
};

const renderListItem = (title, subtitle, actions = []) => {
  const item = document.createElement("div");
  item.className = "blog-item";

  const info = document.createElement("div");
  info.className = "blog-item-info";

  const h4 = document.createElement("h4");
  h4.textContent = title;

  const span = document.createElement("span");
  span.textContent = subtitle;

  info.append(h4, span);

  const actionsWrap = document.createElement("div");
  actionsWrap.className = "blog-item-actions";
  actions.forEach((action) => actionsWrap.appendChild(action));

  item.append(info, actionsWrap);
  return item;
};

const createActionButton = (label, className, icon, onClick) => {
  const button = document.createElement("button");
  button.className = `action-btn ${className || ""}`.trim();
  button.title = label;
  button.textContent = icon || "✏️";
  button.addEventListener("click", onClick);
  return button;
};

const loadPosts = async () => {
  blogList.innerHTML = "";
  const postsQuery = query(collection(appDb, "posts"), orderBy("createdAt", "desc"), limit(20));
  const snapshot = await getDocs(postsQuery);

  if (snapshot.empty) {
    blogList.innerHTML = "<p class=\"comment-meta\">Keine Posts vorhanden.</p>";
    return;
  }

  snapshot.forEach((docSnap) => {
    const data = docSnap.data();
    const deleteButton = createActionButton("Löschen", "delete", "🗑️", async () => {
      await deleteDoc(doc(appDb, "posts", docSnap.id));
      loadPosts();
      loadStats();
    });

    const item = renderListItem(
      data.title || "Ohne Titel",
      `Veröffentlicht am ${formatDate(data.createdAt)}`,
      [deleteButton]
    );

    blogList.appendChild(item);
  });
};

const loadUsers = async () => {
  userList.innerHTML = "";
  const usersQuery = query(collection(appDb, "users"), orderBy("createdAt", "desc"), limit(20));
  const snapshot = await getDocs(usersQuery);

  if (snapshot.empty) {
    userList.innerHTML = "<p class=\"comment-meta\">Keine Nutzer gefunden.</p>";
    return;
  }

  snapshot.forEach((docSnap) => {
    const data = docSnap.data();
    const title = data.displayName || data.username || data.email || docSnap.id;
    const subtitle = `${data.username ? `@${data.username}` : "ohne Nutzername"} · ${data.role || "user"} · ${data.status || "active"}`;
    const toggleStatus = createActionButton(
      data.status === "disabled" ? "Aktivieren" : "Sperren",
      "delete",
      data.status === "disabled" ? "✅" : "⛔",
      async () => {
        const nextStatus = data.status === "disabled" ? "active" : "disabled";
        await setDoc(docSnap.ref, { status: nextStatus }, { merge: true });
        loadUsers();
      }
    );

    userList.appendChild(renderListItem(title, subtitle, [toggleStatus]));
  });
};

const loadComments = async () => {
  commentList.innerHTML = "";
  const commentsQuery = query(
    collectionGroup(appDb, "comments"),
    orderBy("createdAt", "desc"),
    limit(20)
  );
  const snapshot = await getDocs(commentsQuery);

  if (snapshot.empty) {
    commentList.innerHTML = "<p class=\"comment-meta\">Noch keine Kommentare.</p>";
    return;
  }

  snapshot.forEach((docSnap) => {
    const data = docSnap.data();
    const title = data.author || "Unbekannt";
    const subtitle = `${formatDate(data.createdAt)} · ${data.content?.slice(0, 60) || ""}`;
    const deleteButton = createActionButton("Löschen", "delete", "🗑️", async () => {
      await deleteDoc(docSnap.ref);
      loadComments();
      loadStats();
    });
    commentList.appendChild(renderListItem(title, subtitle, [deleteButton]));
  });
};

const loadStats = async () => {
  const [postsCount, usersCount, commentsCount] = await Promise.all([
    getCountFromServer(collection(appDb, "posts")),
    getCountFromServer(collection(appDb, "users")),
    getCountFromServer(collectionGroup(appDb, "comments"))
  ]);

  statPosts.textContent = postsCount.data().count;
  statUsers.textContent = usersCount.data().count;
  statComments.textContent = commentsCount.data().count;
};

blogForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const title = document.getElementById("post-title").value.trim();
  const excerpt = document.getElementById("post-excerpt").value.trim();
  const content = document.getElementById("post-content").value.trim();

  if (!title || !content) return;

  await addDoc(collection(appDb, "posts"), {
    title,
    excerpt,
    content,
    createdAt: serverTimestamp(),
    status: "published"
  });

  blogForm.reset();
  loadPosts();
  loadStats();
});

refreshStatsBtn.addEventListener("click", loadStats);

adminLoginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  adminLoginMessage.textContent = "";

  const rawUsername = document.getElementById("admin-login-username").value.trim();
  const password = document.getElementById("admin-login-password").value.trim();
  const username = normalizeUsername(rawUsername);
  const email = rawUsername.includes("@") ? rawUsername : usernameToEmail(username);

  try {
    await signInWithEmailAndPassword(appAuth, email, password);
    adminLoginMessage.textContent = "Login erfolgreich.";
  } catch (error) {
    adminLoginMessage.textContent = `Fehler: ${error.message}`;
  }
});

adminLogoutBtn.addEventListener("click", async () => {
  await signOut(appAuth);
});

loadLayout();

if (!appAuth || !appDb) {
  adminStatusText.textContent = "Firebase ist noch nicht konfiguriert.";
  adminGrid.style.display = "none";
} else {
  onAuthStateChanged(appAuth, async (user) => {
    if (!user) {
      adminStatusText.textContent = "Bitte einloggen, um fortzufahren.";
      adminGrid.style.display = "none";
      adminLoginForm.style.display = "block";
      return;
    }

    const isAdmin = await ensureAdmin(user);
    if (!isAdmin) {
      adminStatusText.textContent = "Kein Admin-Zugriff. Bitte Admin-Rechte vergeben.";
      adminGrid.style.display = "none";
      adminLoginForm.style.display = "block";
      return;
    }

    adminStatusText.textContent = `Eingeloggt als ${user.email}`;
    adminGrid.style.display = "grid";
    adminLoginForm.style.display = "none";
    await Promise.all([loadPosts(), loadUsers(), loadComments(), loadStats()]);
  });
}


