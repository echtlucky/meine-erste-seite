// =====================================================
// 🔥 Firebase – Compat Setup (GitHub Pages kompatibel)
// =====================================================

(function () {
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
    measurementId: "G-MEFF1FQDFF"
  };

  /* =========================
     🚀 Firebase Initialisieren
     ========================= */
  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }

  /* =========================
     🔐 AUTH
     ========================= */
  const auth = firebase.auth();
  const googleProvider = new firebase.auth.GoogleAuthProvider();

  /* =========================
     📦 FIRESTORE
     ========================= */
  const db = firebase.firestore();

  /* =========================
     👑 ADMIN-LOGIK
     ========================= */
  const ADMIN_EMAIL = "lucassteckel04@gmail.com";

  const isAdmin = (user) => {
    return !!user && user.email === ADMIN_EMAIL;
  };

  /* =========================
     👤 USER-HELPER
     ========================= */
  const saveUsername = (user, username) => {
    if (!user || !username) return Promise.resolve();

    return user.updateProfile({ displayName: username })
      .then(() => {
        console.log("✅ Nutzername gespeichert:", username);
      })
      .catch((err) => {
        console.error("❌ Fehler beim Speichern des Nutzernamens:", err);
      });
  };

  /* =========================
     🌍 Global verfügbar machen
     ========================= */
  window.auth = auth;
  window.db = db;
  window.googleProvider = googleProvider;
  window.isAdmin = isAdmin;
  window.saveUsername = saveUsername;

  /* =========================
     🔎 DEBUG
     ========================= */
  console.log("🔥 Firebase bereit", {
    auth: !!auth,
    firestore: !!db
  });
})();