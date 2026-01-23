// firebase.js – globale compat-Version (GitHub Pages ready)

const firebaseConfig = {
  apiKey: "AIzaSyCVOWzlu3_N3zd6yS90D2YY-U1ZL0VYHVo",
  authDomain: "echtlucky-blog.firebaseapp.com",
  projectId: "echtlucky-blog",
  storageBucket: "echtlucky-blog.firebasestorage.app",
  messagingSenderId: "411123885314",
  appId: "1:411123885314:web:869d4cfabaaea3849d0e1b",
  measurementId: "G-MEFF1FQDFF"
};

// 🔥 Firebase initialisieren
firebase.initializeApp(firebaseConfig);

// ==========================
// 🔐 AUTH
// ==========================
window.auth = firebase.auth();
window.googleProvider = new firebase.auth.GoogleAuthProvider();

// ==========================
// 📦 FIRESTORE
// ==========================
window.db = firebase.firestore();

// ==========================
// 👑 ADMIN-LOGIK
// ==========================
const ADMIN_EMAIL = "lucassteckel04@gmail.com";

// Globaler Admin-Check
window.isAdmin = (user) => {
  return user && user.email === "lucassteckel04@gmail.com";
};

// ==========================
// 👤 USER-HELPER
// ==========================

// Nutzername speichern (z. B. nach Registrierung)
window.saveUsername = function (user, username) {
  if (!user || !username) return;

  user.updateProfile({
    displayName: username
  })
  .then(() => {
    console.log("Nutzername gespeichert:", username);
  })
  .catch((err) => {
    console.error("Fehler beim Speichern des Nutzernamens:", err);
  });
};

// ==========================
// 🔎 DEBUG (optional)
// ==========================
console.log("🔥 Firebase initialisiert:", {
  auth: !!window.auth,
  db: !!window.db
});
