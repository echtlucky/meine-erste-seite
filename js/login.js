/* =========================
   login.js — echtlucky
   - Tabs (Login/Register)
   - Email OR Username login
   - Register creates:
     - users/{uid}
     - usernames/{usernameLower}
   - Google Sign-In creates the same docs
========================= */

(function () {
  // ---- Safety: wait for DOM + Firebase globals
  document.addEventListener("DOMContentLoaded", () => {
    // Expect these to exist from firebase.js:
    // window.auth (firebase.auth())
    // window.db   (firebase.firestore()) OR global db
    // firebase (SDK)
    const authRef = window.auth || (typeof auth !== "undefined" ? auth : null);
    const dbRef   = window.db   || (typeof db !== "undefined" ? db : null);

    if (!authRef || !dbRef || typeof firebase === "undefined") {
      console.error("login.js: auth/db/firebase missing. Check firebase.js includes + globals.");
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

    // ---- Username validation
    function isValidUsername(u) {
      const v = (u || "").trim();
      if (v.length < 3 || v.length > 20) return false;
      return /^[a-zA-Z0-9_.-]+$/.test(v);
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

    // ---- Ensure user docs exist (users + usernames)
    async function ensureUserDocs({ uid, email, username }) {
      const userDoc = dbRef.collection("users").doc(uid);
      const userSnap = await userDoc.get();

      if (!userSnap.exists) {
        await userDoc.set({
          email: email || "",
          username: username || "",
          role: "user",
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          lastLoginAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
      } else {
        await userDoc.update({
          lastLoginAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
      }

      if (username) {
        const unameLower = username.toLowerCase();
        const unameDoc = dbRef.collection("usernames").doc(unameLower);
        const unameSnap = await unameDoc.get();
        if (!unameSnap.exists) {
          await unameDoc.set({
            uid,
            email: email || "",
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          });
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

        // Try to update user doc login time (optional)
        const u = cred.user;
        const username = u?.displayName || "";
        await ensureUserDocs({ uid: u.uid, email: u.email, username });

        showMsg("Eingeloggt. Weiterleitung…", "success");
        setTimeout(() => (window.location.href = "index.html"), 650);
      } catch (err) {
        showMsg(err?.message || "Login fehlgeschlagen.");
      }
    });

    // ---- REGISTER (Email + Password + Username)
    registerForm?.addEventListener("submit", async (e) => {
      e.preventDefault();
      clearMsg();

      const username = (regUsername?.value || "").trim();
      const email = (regEmail?.value || "").trim();
      const password = regPassword?.value || "";

      if (!isValidUsername(username)) {
        showMsg("Username ungültig. Erlaubt: A-Z, 0-9, _ . - (3–20 Zeichen).");
        return;
      }

      try {
        const unameLower = username.toLowerCase();

        // Check username availability
        const existing = await dbRef.collection("usernames").doc(unameLower).get();
        if (existing.exists) {
          showMsg("Username ist schon vergeben.");
          return;
        }

        // Create auth user
        const cred = await authRef.createUserWithEmailAndPassword(email, password);
        await cred.user.updateProfile({ displayName: username });

        // Create Firestore docs
        await ensureUserDocs({ uid: cred.user.uid, email, username });

        showMsg("Account erstellt. Weiterleitung…", "success");
        setTimeout(() => (window.location.href = "index.html"), 650);
      } catch (err) {
        showMsg(err?.message || "Registrierung fehlgeschlagen.");
      }
    });

    // ---- GOOGLE SIGN-IN (works for both buttons)
    async function googleSignIn() {
      clearMsg();

      try {
        const provider = new firebase.auth.GoogleAuthProvider();
        provider.setCustomParameters({ prompt: "select_account" });

        const result = await authRef.signInWithPopup(provider);
        const u = result.user;

        // Create a stable username candidate
        let username = (u?.displayName || "").trim();

        // If no displayName, derive from email local-part
        if (!username && u?.email) username = u.email.split("@")[0];

        // sanitize username
        username = username
          .toLowerCase()
          .replace(/\s+/g, "")
          .replace(/[^a-z0-9_.-]/g, "")
          .slice(0, 20);

        // If empty after sanitize, fallback
        if (!username) username = "user" + (u?.uid || "").slice(0, 6);

        // Only create usernames/{username} if free, otherwise skip mapping (still allow login via email)
        const unameDoc = await dbRef.collection("usernames").doc(username).get();
        const finalUsername = unameDoc.exists ? "" : username;

        await ensureUserDocs({
          uid: u.uid,
          email: u.email || "",
          username: finalUsername,
        });

        showMsg("Mit Google eingeloggt. Weiterleitung…", "success");
        setTimeout(() => (window.location.href = "index.html"), 650);
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

    // ---- Optional: redirect if logged in
    authRef.onAuthStateChanged((user) => {
      if (user) window.location.href = "index.html";
    });
  });
})();