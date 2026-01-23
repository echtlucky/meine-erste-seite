// firebase.js – globale compat-Version

const firebaseConfig = {
  apiKey: "AIzaSyCVOWzlu3_N3zd6yS90D2YY-U1ZL0VYHVo",
  authDomain: "echtlucky-blog.firebaseapp.com",
  projectId: "echtlucky-blog",
  storageBucket: "echtlucky-blog.firebasestorage.app",
  messagingSenderId: "411123885314",
  appId: "1:411123885314:web:869d4cfabaaea3849d0e1b",
  measurementId: "G-MEFF1FQDFF"
};

// Firebase initialisieren (compat-Style)
firebase.initializeApp(firebaseConfig);

// Globale auth & provider
const auth = firebase.auth();
const googleProvider = new firebase.auth.GoogleAuthProvider();
// firebase.js (Ende hinzufügen)

// Deine E-Mail als Admin
const ADMIN_EMAIL = "lucassteckel04@gmail.com";  // ← HIER DEINE E-MAIL EINTRAGEN!

// Exportiere sie (falls du später mehr Logik brauchst)
window.isAdmin = (user) => user && user.email === ADMIN_EMAIL;

// firebase.js (am Ende hinzufügen)

// Hilfsfunktion: Nutzername beim Registrieren speichern
function saveUsername(user, username) {
  if (user) {
    user.updateProfile({
      displayName: username
    }).then(() => {
      console.log('Nutzername gespeichert:', username);
    }).catch((err) => {
      console.error('Nutzername speichern fehlgeschlagen:', err);
    });
  }
}

// Mach window.saveUsername verfügbar
window.saveUsername = saveUsername;