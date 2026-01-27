(function () {
  "use strict";

  if (window.__ECHTLUCKY_LOGIN_LOADED__) return;
  window.__ECHTLUCKY_LOGIN_LOADED__ = true;

  function waitForFirebase() {
    return new Promise((resolve) => {
      if (window.firebaseReady && window.auth && window.db && window.firebase) {
        resolve();
        return;
      }

      const handler = () => {
        resolve();
      };

      window.addEventListener("firebaseReady", handler, { once: true });

      setTimeout(() => {
        if (window.auth && window.db && window.firebase) {
          resolve();
        } else {
          resolve();
        }
      }, 5000);
    });
  }

  async function initLoginForm() {
    await waitForFirebase();

    const authRef = window.auth || window.echtlucky?.auth;
    const dbRef = window.db || window.echtlucky?.db;
    const firebaseObj = window.firebase;

    if (!authRef || !dbRef || !firebaseObj) {
      return;
    }

    initLogin(authRef, dbRef, firebaseObj);
  }

  function initLogin(authRef, dbRef, firebaseObj) {
    const ADMIN_EMAIL = window.echtlucky?.ADMIN_EMAIL || "lucassteckel04@gmail.com";

    const tabLogin = document.getElementById("tabLogin");
    const tabRegister = document.getElementById("tabRegister");
    const loginForm = document.getElementById("loginForm");
    const registerForm = document.getElementById("registerForm");
    const msgBox = document.getElementById("msgBox");

    const loginIdentifier = document.getElementById("loginIdentifier");
    const loginPassword = document.getElementById("loginPassword");

    const regUsername = document.getElementById("regUsername");
    const regEmail = document.getElementById("regEmail");
    const regPassword = document.getElementById("regPassword");

    const googleLoginBtn = document.getElementById("googleLoginBtn");
    const googleRegisterBtn = document.getElementById("googleRegisterBtn");
    const forgotPw = document.getElementById("forgotPw");

    function showMsg(text, type = "error") {
      if (window.notify?.show) {
        const typeMap = {
          error: "error",
          success: "success",
          warn: "warn"
        };
        return window.notify.show({
          type: typeMap[type] || "info",
          title: type === "success" ? "Erfolg" : "Fehler",
          message: text,
          duration: 4500
        });
      }
      if (!msgBox) return;
      msgBox.textContent = text;
      msgBox.className = "msg " + (type === "success" ? "success" : "error");
      msgBox.style.display = "block";
    }
    function clearMsg() {
      if (!msgBox) return;
      msgBox.style.display = "none";
      msgBox.textContent = "";
      msgBox.className = "msg";
    }

    function redirectAfterAuth() {
      let target = "account.html";
      try {
        const returnTo = sessionStorage.getItem("echtlucky:returnTo") || "";
        sessionStorage.removeItem("echtlucky:returnTo");

        const cleaned = String(returnTo || "").trim();
        if (
          cleaned &&
          !cleaned.includes("://") &&
          !cleaned.startsWith("//") &&
          !cleaned.toLowerCase().includes("login.html") &&
          /^[a-z0-9._/\\-]+\\.html(\\?.*)?(#.*)?$/i.test(cleaned)
        ) {
          target = cleaned;
        }
      } catch (_) {}

      window.location.href = target;
    }

    function setTab(mode) {
      clearMsg();
      if (mode === "login") {
        tabLogin?.classList.add("is-active");
        tabRegister?.classList.remove("is-active");
        loginForm?.classList.remove("hidden");
        registerForm?.classList.add("hidden");
      } else {
        tabRegister?.classList.add("is-active");
        tabLogin?.classList.remove("is-active");
        registerForm?.classList.remove("hidden");
        loginForm?.classList.add("hidden");
      }
    }

    tabLogin?.addEventListener("click", () => setTab("login"));
    tabRegister?.addEventListener("click", () => setTab("register"));

    function isValidUsername(u) {
      const v = (u || "").trim();
      if (v.length < 3 || v.length > 20) return false;
      return /^[a-zA-Z0-9_.-]+$/.test(v);
    }

    function sanitizeUsername(raw) {
      return String(raw || "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "")
        .replace(/[^a-z0-9_.-]/g, "")
        .slice(0, 20);
    }

    async function resolveEmailFromIdentifier(raw) {
      const identifier = (raw || "").trim();
      if (!identifier) throw new Error("Bitte E-Mail oder Username eingeben.");
      if (identifier.includes("@")) return identifier;

      const uname = identifier.toLowerCase();
      const snap = await dbRef.collection("usernames").doc(uname).get();
      if (!snap.exists) throw new Error("Username nicht gefunden.");
      const data = snap.data();
      if (!data?.email) throw new Error("Username ist nicht korrekt verknüpft.");
      return data.email;
    }

    async function ensureUserDoc(user, usernameMaybe) {
      if (!user?.uid) return;

      const uid = user.uid;
      const email = user.email || "";
      const username = (usernameMaybe || user.displayName || "").trim();

      const ref = dbRef.collection("users").doc(uid);
      const snap = await ref.get();

      const base = {
        email,
        username,
        lastLoginAt: firebase.firestore.FieldValue.serverTimestamp(),
      };

      if (!snap.exists) {
        await ref.set({
          ...base,
          role: (email === ADMIN_EMAIL ? "admin" : "user"),
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
      } else {
        const old = snap.data() || {};
        await ref.update({
          ...base,
          username: username || old.username || "",
        });
      }

      if (email === ADMIN_EMAIL) {
        try {
          await ref.set({ role: "admin" }, { merge: true });
        } catch {}
      }
    }

    async function ensureUsernameMapping(user, usernameRaw) {
      const uid = user?.uid;
      const email = user?.email || "";
      const uname = sanitizeUsername(usernameRaw);

      if (!uid || !uname || uname.length < 3) return;

      const ref = dbRef.collection("usernames").doc(uname);
      const snap = await ref.get();

      if (!snap.exists) {
        await ref.set({
          uid,
          email,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
        return;
      }

      const data = snap.data() || {};
      if (data.uid === uid) {
        await ref.set(
          {
            email,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      }
    }

    loginForm?.addEventListener("submit", async (e) => {
      e.preventDefault();
      clearMsg();

      const identifier = loginIdentifier?.value || "";
      const password = loginPassword?.value || "";

      try {
        const email = await resolveEmailFromIdentifier(identifier);
        const cred = await authRef.signInWithEmailAndPassword(email, password);

        const u = cred.user;
        await ensureUserDoc(u, u?.displayName || "");
        await ensureUsernameMapping(u, u?.displayName || "");

        showMsg("Eingeloggt. Weiterleitung…", "success");
        setTimeout(() => redirectAfterAuth(), 450);
      } catch (err) {
        showMsg(err?.message || "Login fehlgeschlagen.");
      }
    });

    registerForm?.addEventListener("submit", async (e) => {
      e.preventDefault();
      clearMsg();

      const usernameRaw = (regUsername?.value || "").trim();
      const email = (regEmail?.value || "").trim();
      const password = regPassword?.value || "";

      if (!isValidUsername(usernameRaw)) {
        showMsg("Username ungültig. Erlaubt: A-Z, 0-9, _ . - (3–20 Zeichen).");
        return;
      }

      try {
        const unameLower = sanitizeUsername(usernameRaw);

        const existing = await dbRef.collection("usernames").doc(unameLower).get();
        if (existing.exists) {
          showMsg("Username ist schon vergeben.");
          return;
        }

        const cred = await authRef.createUserWithEmailAndPassword(email, password);

        await cred.user.updateProfile({ displayName: unameLower });

        await ensureUserDoc(cred.user, unameLower);
        await ensureUsernameMapping(cred.user, unameLower);

        showMsg("Account erstellt. Weiterleitung…", "success");
        setTimeout(() => redirectAfterAuth(), 450);
      } catch (err) {
        showMsg(err?.message || "Registrierung fehlgeschlagen.");
      }
    });

    async function googleSignIn() {
      clearMsg();

      try {
        const provider =
          window.echtlucky?.googleProvider ||
          window.googleProvider ||
          new firebase.auth.GoogleAuthProvider();

        if (provider.setCustomParameters) {
          provider.setCustomParameters({ prompt: "select_account" });
        }

        const result = await authRef.signInWithPopup(provider);
        const u = result.user;

        let username = (u?.displayName || "").trim();
        if (!username && u?.email) username = u.email.split("@")[0];

        username = sanitizeUsername(username);
        if (!username) username = "user" + (u?.uid || "").slice(0, 6);

        const unameRef = dbRef.collection("usernames").doc(username);
        const unameSnap = await unameRef.get();

        let finalUsername = username;
        if (unameSnap.exists && (unameSnap.data()?.uid || "") !== u.uid) {
          finalUsername = ""; // belegt durch jemand anderen
        }

        if (finalUsername) {
          try { await u.updateProfile({ displayName: finalUsername }); } catch (_) {}
        }

        await ensureUserDoc(u, finalUsername || (u?.displayName || ""));
        await ensureUsernameMapping(u, finalUsername || "");

        showMsg("Mit Google eingeloggt. Weiterleitung…", "success");
        setTimeout(() => redirectAfterAuth(), 450);
      } catch (err) {
        showMsg(err?.message || "Google Login fehlgeschlagen.");
      }
    }

    googleLoginBtn?.addEventListener("click", googleSignIn);
    googleRegisterBtn?.addEventListener("click", googleSignIn);

    forgotPw?.addEventListener("click", async (e) => {
      e.preventDefault();
      clearMsg();

      const identifier = (loginIdentifier?.value || "").trim();
      if (!identifier) {
        showMsg("Bitte zuerst E-Mail oder Username eingeben.");
        return;
      }

      try {
        const email = await resolveEmailFromIdentifier(identifier);
        await authRef.sendPasswordResetEmail(email);
        showMsg("Reset-Mail wurde gesendet (falls die Adresse existiert).", "success");
      } catch (err) {
        showMsg(err?.message || "Reset fehlgeschlagen.");
      }
    });

  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initLoginForm);
  } else {
    initLoginForm();
  }
})();
