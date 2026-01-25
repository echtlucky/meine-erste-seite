/* =========================================
   login.js — Auth Logic für login.html
   - Login + Register (Email/Pass)
   - sorgt dafür, dass users/{uid} existiert
   - harmoniert mit firebase.js (auth + db global)
========================================= */

(function () {
  // Erwartet: firebase.js setzt global: auth, db (oder firebase.firestore())
  if (typeof firebase === "undefined") {
    console.error("Firebase SDK fehlt. Prüfe Script-Reihenfolge.");
    return;
  }

  // Falls du in firebase.js schon auth/db global definierst, nutzen wir die.
  const _auth = window.auth || firebase.auth();
  const _db = window.db || firebase.firestore();

  // ====== DOM (IDs müssen in login.html existieren) ======
  // Tabs / Buttons
  const loginTabBtn = document.getElementById("loginTabBtn");
  const registerTabBtn = document.getElementById("registerTabBtn");

  const loginBtn = document.getElementById("loginBtn");
  const registerBtn = document.getElementById("registerBtn");
  const googleBtn = document.getElementById("googleBtn");

  // Inputs
  const usernameEl = document.getElementById("username"); // optional (falls vorhanden)
  const emailEl = document.getElementById("email");
  const passEl = document.getElementById("password");

  // UI output
  const errorBox = document.getElementById("authError");   // rote Box
  const statusBox = document.getElementById("authStatus"); // optional

  // Mode
  let mode = "login"; // "login" | "register"

  // ===== Helpers =====
  function setError(msg = "") {
    if (!errorBox) return;
    errorBox.style.display = msg ? "block" : "none";
    errorBox.textContent = msg;
  }

  function setStatus(msg = "") {
    if (!statusBox) return;
    statusBox.style.display = msg ? "block" : "none";
    statusBox.textContent = msg;
  }

  function safe(v) {
    return (v ?? "").toString().trim();
  }

  function showMode(nextMode) {
    mode = nextMode;

    // Optional: Tab UI
    if (loginTabBtn && registerTabBtn) {
      loginTabBtn.classList.toggle("active", mode === "login");
      registerTabBtn.classList.toggle("active", mode === "register");
    }

    // Buttons togglen
    if (loginBtn) loginBtn.style.display = mode === "login" ? "inline-flex" : "none";
    if (registerBtn) registerBtn.style.display = mode === "register" ? "inline-flex" : "none";

    setError("");
    setStatus("");
  }

  async function ensureUserDoc(user, extra = {}) {
    if (!user) return;

    const ref = _db.collection("users").doc(user.uid);
    const snap = await ref.get();

    if (!snap.exists) {
      await ref.set({
        email: user.email || "",
        username: extra.username || "", // optional
        role: "user",
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
    } else {
      // Optional: wenn username nachgetragen werden soll
      if (extra.username) {
        await ref.set({ username: extra.username }, { merge: true });
      }
    }
  }

  async function handleLogin() {
    setError("");
    setStatus("Login läuft…");

    const email = safe(emailEl?.value);
    const password = safe(passEl?.value);

    if (!email || !password) {
      setStatus("");
      setError("Bitte E-Mail und Passwort ausfüllen.");
      return;
    }

    try {
      const cred = await _auth.signInWithEmailAndPassword(email, password);
      await ensureUserDoc(cred.user);

      setStatus("Eingeloggt ✅");

      // Redirect (wenn du willst)
      // window.location.href = "index.html";

    } catch (err) {
      setStatus("");
      setError(err?.message || "Login fehlgeschlagen.");
      console.error(err);
    }
  }

  async function handleRegister() {
    setError("");
    setStatus("Account wird erstellt…");

    const email = safe(emailEl?.value);
    const password = safe(passEl?.value);
    const username = safe(usernameEl?.value);

    if (!email || !password) {
      setStatus("");
      setError("Bitte E-Mail und Passwort ausfüllen.");
      return;
    }

    if (password.length < 6) {
      setStatus("");
      setError("Passwort muss mindestens 6 Zeichen haben.");
      return;
    }

    try {
      const cred = await _auth.createUserWithEmailAndPassword(email, password);

      // optional: displayName setzen
      if (username) {
        await cred.user.updateProfile({ displayName: username });
      }

      await ensureUserDoc(cred.user, { username });

      setStatus("Account erstellt ✅");

      // Redirect (wenn du willst)
      // window.location.href = "index.html";

    } catch (err) {
      setStatus("");
      setError(err?.message || "Registrierung fehlgeschlagen.");
      console.error(err);
    }
  }

  async function handleGoogle() {
    setError("");
    setStatus("Google Login läuft…");

    try {
      const provider = new firebase.auth.GoogleAuthProvider();
      const cred = await _auth.signInWithPopup(provider);

      const username = safe(cred.user?.displayName);
      await ensureUserDoc(cred.user, { username });

      setStatus("Eingeloggt ✅");

      // window.location.href = "index.html";

    } catch (err) {
      setStatus("");
      setError(err?.message || "Google Login fehlgeschlagen.");
      console.error(err);
    }
  }

  // ===== Wire UI =====
  if (loginTabBtn) loginTabBtn.addEventListener("click", () => showMode("login"));
  if (registerTabBtn) registerTabBtn.addEventListener("click", () => showMode("register"));

  if (loginBtn) loginBtn.addEventListener("click", handleLogin);
  if (registerBtn) registerBtn.addEventListener("click", handleRegister);
  if (googleBtn) googleBtn.addEventListener("click", handleGoogle);

  // Enter-Submit
  [emailEl, passEl, usernameEl].forEach((el) => {
    if (!el) return;
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        if (mode === "login") handleLogin();
        else handleRegister();
      }
    });
  });

  // Default Mode
  showMode("login");

  // Wenn bereits eingeloggt, User-Dokument sicherstellen
  _auth.onAuthStateChanged(async (user) => {
    if (!user) return;
    try {
      await ensureUserDoc(user, { username: safe(user.displayName) });
    } catch (e) {
      console.warn("ensureUserDoc failed:", e);
    }
  });
})();