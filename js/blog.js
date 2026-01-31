import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import {
  collection,
  addDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import { appAuth, appDb } from "./firebase-init.js";
import { loadLayout } from "./layout.js";
import "./auth-modal.js";

const postsContainer = document.getElementById("posts-container");
const authMessage = document.getElementById("auth-message");
const authState = document.getElementById("auth-state");
const currentUserLabel = document.getElementById("current-user");
const logoutBtn = document.getElementById("logout-btn");

const registerForm = document.getElementById("register-form");
const loginForm = document.getElementById("login-form");

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

const normalizeUsername = (value) => value.trim().toLowerCase();
const isValidUsername = (value) => /^[a-z0-9._-]{3,20}$/.test(value);
const usernameToEmail = (username) => `${username}@lcky.app`;

const ensureProfile = async (user, username = "") => {
  const userRef = doc(appDb, "users", user.uid);
  const snapshot = await getDoc(userRef);
  if (!snapshot.exists()) {
    await setDoc(userRef, {
      uid: user.uid,
      email: user.email,
      username: username || "",
      displayName: username || "",
      createdAt: serverTimestamp(),
      role: "user",
      status: "active"
    });
    if (username) {
      await setDoc(doc(appDb, "usernames", username), {
        uid: user.uid,
        createdAt: serverTimestamp()
      });
    }
    return { displayName: username || "", email: user.email, username };
  }
  const data = snapshot.data();
  if (username && data.username !== username) {
    await setDoc(userRef, { username, displayName: username }, { merge: true });
    await setDoc(doc(appDb, "usernames", username), {
      uid: user.uid,
      createdAt: serverTimestamp()
    });
    return { ...data, username, displayName: username };
  }
  return data;
};

const renderComment = (commentData) => {
  const item = document.createElement("div");
  item.className = "comment-item";

  const meta = document.createElement("div");
  meta.className = "comment-meta";
  const author = commentData.author || "Unbekannt";
  const date = formatDate(commentData.createdAt);
  meta.textContent = `${author} · ${date}`;

  const text = document.createElement("p");
  text.className = "comment-text";
  text.textContent = commentData.content || "";

  item.append(meta, text);
  return item;
};

let currentProfile = null;

const renderPosts = async (currentUser) => {
  postsContainer.innerHTML = "";

  const postsQuery = query(collection(appDb, "posts"), orderBy("createdAt", "desc"));
  const postsSnapshot = await getDocs(postsQuery);

  if (postsSnapshot.empty) {
    const empty = document.createElement("div");
    empty.className = "card";
    empty.innerHTML = "<h3>Noch keine Posts</h3><p>Hier erscheinen bald die ersten Beiträge.</p>";
    postsContainer.appendChild(empty);
    return;
  }

  for (const postDoc of postsSnapshot.docs) {
    const postData = postDoc.data();
    const card = document.createElement("article");
    card.className = "card";

    const title = document.createElement("h3");
    title.textContent = postData.title || "Untitled";

    const meta = document.createElement("p");
    meta.className = "comment-meta";
    meta.textContent = `Veröffentlicht am ${formatDate(postData.createdAt)}`;

    const excerpt = document.createElement("p");
    excerpt.textContent = postData.excerpt || postData.content?.slice(0, 180) || "";

    const subGrid = document.createElement("div");
    subGrid.className = "subcard-grid";
    const authorCard = document.createElement("div");
    authorCard.className = "subcard";
    authorCard.innerHTML = "<h5>Autor</h5><p>Team LCKY</p>";
    const stateCard = document.createElement("div");
    stateCard.className = "subcard";
    stateCard.innerHTML = "<h5>Status</h5><p>Öffentlich</p>";
    subGrid.append(authorCard, stateCard);

    const commentSection = document.createElement("div");
    commentSection.className = "comment-card";
    commentSection.style.marginTop = "2rem";

    const commentHeader = document.createElement("h4");
    commentHeader.textContent = "Kommentare";

    const commentList = document.createElement("div");
    commentList.className = "comment-list";

    const commentsQuery = query(
      collection(appDb, "posts", postDoc.id, "comments"),
      orderBy("createdAt", "desc"),
      limit(10)
    );

    const commentsSnapshot = await getDocs(commentsQuery);
    if (commentsSnapshot.empty) {
      const emptyComment = document.createElement("p");
      emptyComment.className = "comment-meta";
      emptyComment.textContent = "Sei die erste Person, die kommentiert.";
      commentList.appendChild(emptyComment);
    } else {
      commentsSnapshot.forEach((commentDoc) => {
        commentList.appendChild(renderComment(commentDoc.data()));
      });
    }

    const commentForm = document.createElement("form");
    commentForm.className = "form-stack";
    commentForm.style.marginTop = "1.5rem";

    const commentInput = document.createElement("textarea");
    commentInput.className = "input-field";
    commentInput.rows = 3;
    commentInput.placeholder = currentUser
      ? "Dein Kommentar..."
      : "Bitte anmelden, um zu kommentieren.";
    commentInput.disabled = !currentUser;

    const commentButton = document.createElement("button");
    commentButton.className = "btn btn-primary";
    commentButton.type = "submit";
    commentButton.textContent = "Kommentar posten";
    commentButton.disabled = !currentUser;

    commentForm.append(commentInput, commentButton);

    commentForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!currentUser) return;
      const content = commentInput.value.trim();
      if (!content) return;

      await addDoc(collection(appDb, "posts", postDoc.id, "comments"), {
        uid: currentUser.uid,
        author: (currentProfile && currentProfile.displayName) || currentUser.email,
        content,
        createdAt: serverTimestamp()
      });

      commentInput.value = "";
      renderPosts(currentUser);
    });

    commentSection.append(commentHeader, commentList, commentForm);
    card.append(title, meta, excerpt, subGrid, commentSection);
    postsContainer.appendChild(card);
  }
};

registerForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  authMessage.textContent = "";

  const rawUsername = document.getElementById("register-username").value.trim();
  const password = document.getElementById("register-password").value.trim();

  const username = normalizeUsername(rawUsername);
  if (!isValidUsername(username)) {
    authMessage.textContent = "Nutzername ungültig (3-20, a-z, 0-9, . _ -).";
    return;
  }

  const usernameRef = doc(appDb, "usernames", username);
  const usernameSnap = await getDoc(usernameRef);
  if (usernameSnap.exists()) {
    authMessage.textContent = "Nutzername ist bereits vergeben.";
    return;
  }

  const email = usernameToEmail(username);
  try {
    const credential = await createUserWithEmailAndPassword(appAuth, email, password);
    currentProfile = await ensureProfile(credential.user, username);
    authMessage.textContent = "Account erstellt und eingeloggt.";
  } catch (error) {
    authMessage.textContent = `Fehler: ${error.message}`;
  }
});

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  authMessage.textContent = "";

  const rawUsername = document.getElementById("login-username").value.trim();
  const password = document.getElementById("login-password").value.trim();

  const username = normalizeUsername(rawUsername);
  const email = rawUsername.includes("@") ? rawUsername : usernameToEmail(username);
  try {
    const credential = await signInWithEmailAndPassword(appAuth, email, password);
    currentProfile = await ensureProfile(credential.user);
    authMessage.textContent = "Willkommen zurück.";
  } catch (error) {
    authMessage.textContent = `Fehler: ${error.message}`;
  }
});

logoutBtn.addEventListener("click", async () => {
  await signOut(appAuth);
});

loadLayout();

if (!appAuth || !appDb) {
  authMessage.textContent = "Firebase ist noch nicht konfiguriert.";
} else {
  onAuthStateChanged(appAuth, async (user) => {
    if (user) {
      authState.style.display = "grid";
      registerForm.style.display = "none";
      loginForm.style.display = "none";
      currentProfile = await ensureProfile(user);
      currentUserLabel.textContent = (currentProfile && currentProfile.displayName) || user.email || user.uid;
      renderPosts(user);
    } else {
      authState.style.display = "none";
      currentUserLabel.textContent = "-";
      registerForm.style.display = "flex";
      loginForm.style.display = "flex";
      currentProfile = null;
      renderPosts(null);
    }
  });
}
