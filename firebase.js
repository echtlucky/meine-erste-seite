// firebase.js — echtlucky (v2)
// Saubere, einmalige Initialisierung + zentraler App-Namespace

(function () {
  "use strict";

  /* =========================
     ⚙️ Firebase Config
     ========================= */
  const firebaseConfig = {
    apiKey: "AIzaSyCVOWzlu3_N3zd6yS90D2YY-U1ZL0VYHVo",
    authDomain: "echtlucky-blog.firebaseapp.com",
    projectId: "echtlucky-blog",
    storageBucket: "echtlucky-blog.firebasestorage.app",
    messagingSenderId: "411123885314",
    appId: "1:411123885314:web:869d4cfabaaea3849d0e1b",
    measurementId: "G-MEFF1FQDFF",
  };

  /* =========================
     🧠 Global Namespace (1 Platz)
     ========================= */
  const appNS = (window.echtlucky = window.echtlucky || {});

  /* =========================
     🚀 Firebase Initialisieren
     ========================= */
  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }

  /* =========================
     🔐 AUTH & FIRESTORE
     ========================= */
  const auth = firebase.auth();
  const db = firebase.firestore();

  // Provider (Google)
  const googleProvider = new firebase.auth.GoogleAuthProvider();
  googleProvider.setCustomParameters({ prompt: "select_account" });

  /* =========================
     🧩 Firestore Settings (safe)
     ========================= */
  // Hinweis: In compat ist enablePersistence optional.
  // Wenn es im Browser nicht geht -> wird es einfach abgefangen.
  try {
    db.enablePersistence({ synchronizeTabs: true }).catch(() => {});
  } catch (_) {}

  /* =========================
     👑 Admin / Role Helpers
     ========================= */
  const ADMIN_EMAIL = "lucassteckel04@gmail.com";

  function isAdminByEmail(user) {
    return !!user && user.email === ADMIN_EMAIL;
  }

  // Sauber: Rolle aus users/{uid}
  async function getRole(uid) {
    if (!uid) return null;
    try {
      const snap = await db.collection("users").doc(uid).get();
      return snap.exists ? snap.data()?.role || "user" : null;
    } catch (e) {
      console.warn("getRole failed:", e);
      return null;
    }
  }

  async function isAdmin(user) {
    if (!user) return false;
    if (isAdminByEmail(user)) return true; // fallback
    const role = await getRole(user.uid);
    return role === "admin";
  }

  /* =========================
     👤 Username / Profile Helpers
     ========================= */

  function sanitizeUsername(raw) {
    const u = String(raw || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "")
      .replace(/[^a-z0-9_.-]/g, "")
      .slice(0, 20);

    return u;
  }

  async function ensureUserDoc(user, extra = {}) {
    if (!user?.uid) return;

    const ref = db.collection("users").doc(user.uid);
    const snap = await ref.get();

    const base = {
      email: user.email || "",
      username: user.displayName || "",
      role: "user",
      lastLoginAt: firebase.firestore.FieldValue.serverTimestamp(),
    };

    if (!snap.exists) {
      await ref.set({
        ...base,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        ...extra,
      });
    } else {
      await ref.update({
        lastLoginAt: firebase.firestore.FieldValue.serverTimestamp(),
        ...extra,
      });
    }
  }

  // Speichert displayName + usernames mapping (für Username-Login!)
  async function saveUsername(user, usernameRaw) {
    if (!user || !usernameRaw) return;

    const uname = sanitizeUsername(usernameRaw);
    if (!uname || uname.length < 3) {
      throw new Error("Username ungültig (min. 3 Zeichen).");
    }

    const unameRef = db.collection("usernames").doc(uname);
    const existing = await unameRef.get();

    // Username schon vergeben?
    if (existing.exists && existing.data()?.uid !== user.uid) {
      throw new Error("Username ist schon vergeben.");
    }

    // displayName setzen
    await user.updateProfile({ displayName: uname });

    // Mapping setzen
    await unameRef.set(
      {
        uid: user.uid,
        email: user.email || "",
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        createdAt: existing.exists
          ? existing.data()?.createdAt || firebase.firestore.FieldValue.serverTimestamp()
          : firebase.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    // users doc updaten
    await ensureUserDoc(user, { username: uname });

    console.log("✅ Username gespeichert + verknüpft:", uname);
    return uname;
  }

  /* =========================
     🌍 Export in Namespace
     ========================= */
  appNS.auth = auth;
  appNS.db = db;
  appNS.googleProvider = googleProvider;

  appNS.ADMIN_EMAIL = ADMIN_EMAIL;

  appNS.isAdminByEmail = isAdminByEmail;
  appNS.isAdmin = isAdmin;
  appNS.getRole = getRole;

  appNS.ensureUserDoc = ensureUserDoc;
  appNS.saveUsername = saveUsername;
  appNS.sanitizeUsername = sanitizeUsername;

  /* =========================
     ✅ Backwards compatibility
     (Damit dein alter Code NICHT bricht)
     ========================= */
  window.auth = auth;
  window.db = db;
  window.googleProvider = googleProvider;
  window.isAdmin = isAdminByEmail; // alter code erwartet oft sync boolean
  window.saveUsername = saveUsername;

  /* =========================
     🔎 DEBUG
     ========================= */
  console.log("🔥 Firebase initialisiert (echtlucky v2)", {
    auth: !!auth,
    firestore: !!db,
    provider: !!googleProvider,
    ns: !!window.echtlucky,
  });
})();