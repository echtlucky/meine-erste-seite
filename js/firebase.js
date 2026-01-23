// firebase.js – saubere, einmalige Initialisierung (GitHub Pages kompatibel)

(function () {
  // Lade Firebase SDKs dynamisch (damit sie vor deinem Code da sind)
  const scripts = [
    "https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js",
    "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth-compat.js",
    "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore-compat.js"
  ];

  // Lade Scripts sequentiell
  function loadScript(url, callback) {
    const script = document.createElement('script');
    script.src = url;
    script.onload = callback;
    script.onerror = () => console.error('Fehler beim Laden: ' + url);
    document.head.appendChild(script);
  }

  let index = 0;
  function loadNext() {
    if (index < scripts.length) {
      loadScript(scripts[index], () => {
        index++;
        loadNext();
      });
    } else {
      initFirebase();
    }
  }

  function initFirebase() {
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

    window.auth = firebase.auth();
    window.db = firebase.firestore();
    window.googleProvider = new firebase.auth.GoogleAuthProvider();

    window.ADMIN_EMAIL = "lucassteckel04@gmail.com";

    window.isAdmin = (user) => user && user.email === window.ADMIN_EMAIL;

    window.saveUsername = (user, username) => {
      if (user && username) {
        user.updateProfile({ displayName: username })
          .then(() => console.log("Nutzername gespeichert:", username))
          .catch(err => console.error("Fehler beim Speichern:", err));
      }
    };

    console.log("Firebase initialisiert – auth & db bereit");
  }

  // Starte Laden
  loadNext();
})();