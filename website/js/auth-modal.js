import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail
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
        email: user.email,
        createdAt: serverTimestamp()
      });
    }
    return;
  }

  if (username && snapshot.data().username !== username) {
    await setDoc(userRef, { username, displayName: username }, { merge: true });
    await setDoc(doc(appDb, "usernames", username), {
      uid: user.uid,
      email: user.email,
      createdAt: serverTimestamp()
    });
  }
};

let registerForm = null;
let loginForm = null;
let bound = false;
let forgotBtn = null;

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
  forgotBtn = document.getElementById("auth-forgot");

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

  document.querySelectorAll("[data-auth-open]").forEach((button) => {
    button.addEventListener("click", openModal);
  });

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

    const emailInput = document.getElementById("auth-register-email").value.trim();
    const rawUsername = document.getElementById("auth-register-username").value.trim();
    const password = document.getElementById("auth-register-password").value.trim();
    const repeatPassword = document.getElementById("auth-register-password-repeat").value.trim();
    const username = normalizeUsername(rawUsername);

    if (!emailInput) {
      authMessage.textContent = "Bitte E-Mail eingeben.";
      return;
    }

    if (!isValidUsername(username)) {
      authMessage.textContent = "Nutzername ungültig (3-20, a-z, 0-9, . _ -).";
      return;
    }

    if (password !== repeatPassword) {
      authMessage.textContent = "Passwörter stimmen nicht überein.";
      return;
    }

    const usernameRef = doc(appDb, "usernames", username);
    const usernameSnap = await getDoc(usernameRef);
    if (usernameSnap.exists()) {
      authMessage.textContent = "Nutzername ist bereits vergeben.";
      return;
    }

    try {
      const email = emailInput;
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

    const rawIdentifier = document.getElementById("auth-login-identifier").value.trim();
    const password = document.getElementById("auth-login-password").value.trim();
    let email = rawIdentifier;

    if (!rawIdentifier.includes("@")) {
      const username = normalizeUsername(rawIdentifier);
      const usernameSnap = await getDoc(doc(appDb, "usernames", username));
      if (!usernameSnap.exists()) {
        authMessage.textContent = "Nutzername nicht gefunden.";
        return;
      }
      email = usernameSnap.data().email;
    }

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

  if (forgotBtn) {
    forgotBtn.addEventListener("click", async () => {
      const rawIdentifier = document.getElementById("auth-login-identifier").value.trim();
      if (!rawIdentifier) {
        authMessage.textContent = "Bitte E-Mail oder Nutzername eingeben.";
        return;
      }

      let email = rawIdentifier;
      if (!rawIdentifier.includes("@")) {
        const username = normalizeUsername(rawIdentifier);
        const usernameSnap = await getDoc(doc(appDb, "usernames", username));
        email = usernameSnap.exists() ? usernameSnap.data().email : null;
      }

      if (!email) {
        authMessage.textContent = "E-Mail nicht gefunden.";
        return;
      }

      try {
        await sendPasswordResetEmail(appAuth, email);
        authMessage.textContent = "Passwort-Reset gesendet.";
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



