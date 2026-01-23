// firebase.js – globale Version für GitHub Pages (kein import/export)

const firebaseConfig = {
  apiKey: "AIzaSyCVOWzlu3_N3zd6yS90D2YY-U1ZL0VYHVo",
  authDomain: "echtlucky-blog.firebaseapp.com",
  projectId: "echtlucky-blog",
  storageBucket: "echtlucky-blog.firebasestorage.app",
  messagingSenderId: "411123885314",
  appId: "1:411123885314:web:869d4cfabaaea3849d0e1b",
  measurementId: "G-MEFF1FQDFF"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const googleProvider = new firebase.auth.GoogleAuthProvider();

// Optional: Firestore, wenn du später Posts speichern willst
const db = firebase.firestore();