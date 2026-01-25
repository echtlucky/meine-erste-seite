/* =========================
   login.js — echtlucky (stable)
   - Tabs (Login/Register)
   - Email OR Username login
   - Register creates:
     - users/{uid}
     - usernames/{usernameLower}
   - Google Sign-In creates the same docs
   - FIX: kein onAuthStateChanged-Redirect Loop
   - FIX: Admin-Mail bekommt role=admin beim ersten Create + Bootstrap Update
========================= */

(function () {
  "use strict";

  document.addEventListener("DOMContentLoaded", () => {
    const authRef =
      window.echtlucky?.auth ||
      window.auth ||
      (typeof auth !== "undefined" ? auth : null);

    const dbRef =
      window.echtlucky?.db ||
      window.db ||
      (typeof db !== "undefined" ? db : null);

    const googleProvider =
      window.echtlucky?.googleProvider ||
      window.googleProvider ||
      null;

    const ADMIN_EMAIL = "lucassteckel04@gmail.com";

    if (!authRef || !dbRef || typeof firebase === "undefined") {
      console.error("login.js: auth/db/firebase missing. Prüfe firebase.js + Includes.");
      return;
    }

    // ---- DOM
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

    // ---- UI helpers
    function showMsg(text, type = "error") {
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

    function setTab(mode) {
      clearMsg();
      if (mode === "login") {
        tabLogin?.classList.add("active");
        tabRegister?.classList.remove("active");
        loginForm?.classList.remove("hidden");
        registerForm?.classList.add("hidden");
      } else {
        tabRegister?.classList.add("active");
        tabLogin?.classList.remove("active");
        registerForm?.classList.remove("hidden");
        loginForm?.classList.add("hidden");
      }
    }

    tabLogin?.addEventListener("click", () => setTab("login"));
    tabRegister?.addEventListener("click", () => setTab("register"));

    // ---- Username validation + sanitize
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

    // ---- Resolve username -> email
    async function resolveEmailFromIdentifier(raw) {
      const identifier = (raw || "").trim();
      if (!identifier) throw new Error("Bitte E-Mail oder Username eingeben.");
      if (identifier.includes("@")) return identifier;

      const uname = identifier.toLowerCase();
      const doc = await dbRef.collection("usernames").doc(uname).get();
      if (!doc.exists) throw new Error("Username nicht gefunden.");
      const data = doc.data();
      if (!data?.email) throw new Error("Username ist nicht korrekt verknüpft.");
      return data.email;
    }

    // ---- Ensure user doc exists (users + usernames)
    async function ensureUserDocs(user, usernameMaybe) {
      if (!user?.uid) return;

      const uid = user.uid;
      const email = user.email || "";
      const username = (usernameMaybe || user.displayName || "").trim();

      const userDoc = dbRef.collection("users").doc(uid);
      const snap = await userDoc.get();

      if (!snap.exists) {
        // ✅ Role beim ersten Create setzen (Admin-Mail wird admin)
        await userDoc.set({
          email,
          username,
          role: (email === ADMIN_EMAIL ? "admin" : "user"),
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          lastLoginAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
      } else {
        // niemals role anfassen
        await userDoc.update({
          lastLoginAt: firebase.firestore.FieldValue.serverTimestamp(),
          email,
          username: username || snap.data()?.username || "",
        });
      }

      // Username mapping optional (nur wenn vorhanden + frei/owner)
      const unameLower = sanitizeUsername(username);
      if (unameLower && unameLower.length >= 3) {
        const unameRef = dbRef.collection("usernames").doc(unameLower);
        const unameSnap = await unameRef.get();

        if (!unameSnap.exists) {
          await unameRef.set({
            uid,
            email,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          });
        }
      }

      // ✅ Bootstrap: falls dein Admin früher als "user" angelegt wurde, einmalig auf admin heben
      // (geht nur mit den neuen Rules, nur für deine Admin-Mail)
      if (email === ADMIN_EMAIL) {
        try {
          await userDoc.set({ role: "admin" }, { merge: true });
        } catch (_) {
          // wenn Rules noch nicht deployed sind, ignoriere hier
        }
      }
    }

    // ---- LOGIN (Email/Username + Password)
    loginForm?.addEventListener("submit", async (e) => {
      e.preventDefault();
      clearMsg();

      const identifier = loginIdentifier?.value || "";
      const password = loginPassword?.value || "";

      try {
        const email = await resolveEmailFromIdentifier(identifier);
        const cred = await authRef.signInWithEmailAndPassword(email, password);

        await ensureUserDocs(cred.user);

        showMsg("Eingeloggt. Weiterleitung…", "success");
        setTimeout(() => (window.location.href = "index.html"), 450);
      } catch (err) {
        showMsg(err?.message || "Login fehlgeschlagen.");
      }
    });

    // ---- REGISTER (Email + Password + Username)
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

        // displayName setzen
        await cred.user.updateProfile({ displayName: usernameRaw });

        // docs
        await ensureUserDocs(cred.user, usernameRaw);

        showMsg("Account erstellt. Weiterleitung…", "success");
        setTimeout(() => (window.location.href = "index.html"), 450);
      } catch (err) {
        showMsg(err?.message || "Registrierung fehlgeschlagen.");
      }
    });

    // ---- GOOGLE SIGN-IN
    async function googleSignIn() {
      clearMsg();

      try {
        const provider =
          googleProvider ||
          new firebase.auth.GoogleAuthProvider();

        if (provider.setCustomParameters) {
          provider.setCustomParameters({ prompt: "select_account" });
        }

        const result = await authRef.signInWithPopup(provider);
        const u = result.user;

        // username candidate
        let username = (u?.displayName || "").trim();
        if (!username && u?.email) username = u.email.split("@")[0];

        username = sanitizeUsername(username);
        if (!username) username = "user" + (u?.uid || "").slice(0, 6);

        // Wenn username belegt ist: kein mapping erzwingen (Login via Email bleibt ok)
        const unameSnap = await dbRef.collection("usernames").doc(username).get();
        const finalUsername = unameSnap.exists ? "" : username;

        // optional displayName updaten wenn frei
        if (finalUsername) {
          try { await u.updateProfile({ displayName: finalUsername }); } catch (_) {}
        }

        await ensureUserDocs(u, finalUsername);

        showMsg("Mit Google eingeloggt. Weiterleitung…", "success");
        setTimeout(() => (window.location.href = "index.html"), 450);
      } catch (err) {
        showMsg(err?.message || "Google Login fehlgeschlagen.");
      }
    }

    googleLoginBtn?.addEventListener("click", googleSignIn);
    googleRegisterBtn?.addEventListener("click", googleSignIn);

    // ---- PASSWORD RESET
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

    // ✅ WICHTIG: KEIN authRef.onAuthStateChanged Redirect hier!
    // Der Header (menu.js) kümmert sich ums UI,
    // Redirect passiert NUR nach erfolgreichem Login/Register/Google.
  });
})();