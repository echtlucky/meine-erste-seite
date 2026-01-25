// firebase.js — echtlucky (v2.2)
// Saubere, einmalige Initialisierung + zentraler App-Namespace
// Erwartet Firebase COMPAT global: window.firebase (CDN scripts)

(function () {
  "use strict";

  // Prevent double-load (kills flicker + double auth listeners side-effects)
  if (window.__ECHTLUCKY_FIREBASE_LOADED__) {
    console.warn("🔥 firebase.js already loaded – skipping");
    return;
  }
  window.__ECHTLUCKY_FIREBASE_LOADED__ = true;

  if (!window.firebase) {
    console.error("firebase.js: window.firebase fehlt. Du nutzt Firebase CDN/compat? Lade die Firebase Scripts VOR firebase.js.");
    return;
  }

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
     🧠 Global Namespace
  ========================= */
  const appNS = (window.echtlucky = window.echtlucky || {});

  /* =========================
     🚀 Firebase Init
  ========================= */
  if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);

  /* =========================
     🔐 AUTH & FIRESTORE
  ========================= */
  const auth = firebase.auth();
  const db = firebase.firestore();

  const googleProvider = new firebase.auth.GoogleAuthProvider();
  googleProvider.setCustomParameters({ prompt: "select_account" });

    // Optional persistence (robust / compat-safe)
  // Multi-tab cache (best effort). Some environments block IndexedDB (private mode / strict settings).
  try {
    db.enablePersistence({ synchronizeTabs: true }).catch((err) => {
      // "failed-precondition" => multiple tabs open or persistence already enabled elsewhere
      // "unimplemented"     => browser doesn't support persistence
      // Both are safe to ignore for MVP
      console.warn("Firestore persistence disabled:", err?.code || err?.message || err);
    });
  } catch (err) {
    console.warn("Firestore persistence init failed:", err?.message || err);
  }

  /* =========================
     👑 Admin / Roles
  ========================= */
  const ADMIN_EMAIL = "lucassteckel04@gmail.com";

  function isAdminByEmail(user) {
    return !!user && user.email === ADMIN_EMAIL;
  }

  async function getRole(uid) {
    if (!uid) return "user";
    try {
      const snap = await db.collection("users").doc(uid).get();
      return snap.exists ? (snap.data()?.role || "user") : "user";
    } catch (e) {
      console.warn("getRole failed:", e);
      return "user";
    }
  }

  async function isAdmin(user) {
    if (!user) return false;
    if (isAdminByEmail(user)) return true; // fallback
    const r = await getRole(user.uid);
    return r === "admin";
  }

  /* =========================
     👤 Username Helpers
  ========================= */
  function sanitizeUsername(raw) {
    return String(raw || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "")
      .replace(/[^a-z0-9_.-]/g, "")
      .slice(0, 20);
  }

  /**
   * Creates/updates users/{uid} safely.
   * - On CREATE: sets role based on email (admin gets admin)
   * - On UPDATE: NEVER overwrites existing role automatically
   */
  async function ensureUserDoc(user, extra = {}) {
    if (!user?.uid) return;

    const ref = db.collection("users").doc(user.uid);
    const snap = await ref.get();
    const now = firebase.firestore.FieldValue.serverTimestamp();

    if (!snap.exists) {
      // IMPORTANT: role decided ONCE at creation time
      const initialRole = isAdminByEmail(user) ? "admin" : "user";

      await ref.set({
        email: user.email || "",
        username: user.displayName || "",
        role: initialRole,
        createdAt: now,
        lastLoginAt: now,
        ...extra,
      });
    } else {
      const data = snap.data() || {};
      // Never auto-overwrite role
      await ref.update({
        email: user.email || "",
        username: user.displayName || data.username || "",
        lastLoginAt: now,
        ...extra,
      });
    }
  }

  /**
   * Saves displayName + usernames mapping (for username-login)
   */
  async function saveUsername(user, usernameRaw) {
    if (!user || !usernameRaw) return;

    const uname = sanitizeUsername(usernameRaw);
    if (!uname || uname.length < 3) throw new Error("Username ungültig (min. 3 Zeichen).");

    const unameRef = db.collection("usernames").doc(uname);
    const existing = await unameRef.get();

    if (existing.exists && existing.data()?.uid !== user.uid) {
      throw new Error("Username ist schon vergeben.");
    }

    await user.updateProfile({ displayName: uname });

    await unameRef.set(
      {
        uid: user.uid,
        email: user.email || "",
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        createdAt: existing.exists
          ? (existing.data()?.createdAt || firebase.firestore.FieldValue.serverTimestamp())
          : firebase.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

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
  ========================= */
  window.auth = auth;
  window.db = db;
  window.googleProvider = googleProvider;

  // keep old sync helper name (falls irgendwo benutzt)
  window.isAdmin = isAdminByEmail;
  window.saveUsername = saveUsername;

  console.log("🔥 Firebase initialisiert (echtlucky v2.2)", {
    auth: !!auth,
    firestore: !!db,
    provider: !!googleProvider,
    ns: !!window.echtlucky,
  });
})();