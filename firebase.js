// firebase.js – globale Version (compat, funktioniert auf GitHub Pages)

const firebaseConfig = {
  apiKey: "AIzaSyCVOWzlu3_N3zd6yS90D2YY-U1ZL0VYHVo",
  authDomain: "echtlucky-blog.firebaseapp.com",
  projectId: "echtlucky-blog",
  storageBucket: "echtlucky-blog.firebasestorage.app",
  messagingSenderId: "411123885314",
  appId: "1:411123885314:web:869d4cfabaaea3849d0e1b",
  measurementId: "G-MEFF1FQDFF"
};

// Firebase initialisieren
firebase.initializeApp(firebaseConfig);

// 🔥 GLOBAL verfügbar machen
window.auth = firebase.auth();
window.googleProvider = new firebase.auth.GoogleAuthProvider();
