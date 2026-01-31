import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import { appAuth, appDb } from "./firebase-init.js";

let profileBtn = null;
let authModal = null;
let authMessage = null;
let authLogoutBtn = null;
let authTabs = [];
let authForms = [];

const normalizeUsername = (value) => value.trim().toLowerCase();
const isValidUsername = (value) => /^[a-z0-9._-]{3,20}$/.test(value);
const usernameToEmail = (username) => `${username}@lcky.app`;

const openModal = () => {
  if (!authModal) return;
  authModal.classList.add("active");
  authModal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
};

const closeModal = () => {
  if (!authModal) return;
  authModal.classList.remove("active");
  authModal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
};

const switchTab = (tabName) => {
  authTabs.forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.authTab === tabName);
  });
  authForms.forEach((form) => {
    form.classList.toggle("active", form.id.includes(tabName));
  });
};

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
    return;
  }

  if (username && snapshot.data().username !== username) {
    await setDoc(userRef, { username, displayName: username }, { merge: true });
    await setDoc(doc(appDb, "usernames", username), {
      uid: user.uid,
      createdAt: serverTimestamp()
    });
  }
};

let registerForm = null;
let loginForm = null;
let bound = false;

const bindAuthModal = () => {
  if (bound) return;
  profileBtn = document.getElementById("profile-btn");
  authModal = document.getElementById("auth-modal");
  authMessage = document.getElementById("auth-modal-message");
  authLogoutBtn = document.getElementById("auth-logout-btn");
  authTabs = authModal ? authModal.querySelectorAll("[data-auth-tab]") : [];
  authForms = authModal ? authModal.querySelectorAll(".auth-form") : [];
  registerForm = document.getElementById("auth-register-form");
  loginForm = document.getElementById("auth-login-form");

  if (profileBtn && authModal) {
    bound = true;
    profileBtn.addEventListener("click", openModal);
    authModal.addEventListener("click", (event) => {
      if (event.target.matches("[data-auth-close]")) {
        closeModal();
      }
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeModal();
    });
  }

  if (authTabs.length) {
    authTabs.forEach((tab) => {
      tab.addEventListener("click", () => switchTab(tab.dataset.authTab));
    });
  }

  if (!appAuth || !appDb) {
    if (authMessage) {
      authMessage.textContent = "Firebase ist noch nicht konfiguriert.";
    }
    return;
  }

  if (registerForm) {
    registerForm.addEventListener("submit", async (event) => {
      event.preventDefault();

    const rawUsername = document.getElementById("auth-register-username").value.trim();
    const password = document.getElementById("auth-register-password").value.trim();
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

    try {
      const email = usernameToEmail(username);
      const credential = await createUserWithEmailAndPassword(appAuth, email, password);
      await ensureProfile(credential.user, username);
      authMessage.textContent = "Account erstellt.";
      switchTab("login");
    } catch (error) {
      authMessage.textContent = `Fehler: ${error.message}`;
    }
  });
  }

  if (loginForm && appAuth) {
    loginForm.addEventListener("submit", async (event) => {
      event.preventDefault();

    const rawUsername = document.getElementById("auth-login-username").value.trim();
    const password = document.getElementById("auth-login-password").value.trim();
    const username = normalizeUsername(rawUsername);
    const email = rawUsername.includes("@") ? rawUsername : usernameToEmail(username);

    try {
      const credential = await signInWithEmailAndPassword(appAuth, email, password);
      await ensureProfile(credential.user);
      authMessage.textContent = "Willkommen zurück.";
      closeModal();
    } catch (error) {
      authMessage.textContent = `Fehler: ${error.message}`;
    }
  });
  }

  if (authLogoutBtn) {
    authLogoutBtn.addEventListener("click", async () => {
      if (!appAuth) return;
      await signOut(appAuth);
    });
  }

  if (appAuth) {
    onAuthStateChanged(appAuth, (user) => {
      if (!authMessage) return;
      if (user) {
        authMessage.textContent = `Eingeloggt als ${user.email || user.uid}`;
        if (authLogoutBtn) authLogoutBtn.style.display = "inline-flex";
      } else {
        authMessage.textContent = "Bitte logge dich ein, um zu kommentieren.";
        if (authLogoutBtn) authLogoutBtn.style.display = "none";
      }
    });
  }
};

window.addEventListener("layout:ready", bindAuthModal);
