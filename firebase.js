
(function () {
  "use strict";

  if (window.__ECHTLUCKY_FIREBASE_LOADED__) {
    return;
  }
  window.__ECHTLUCKY_FIREBASE_LOADED__ = true;

  function initWhenReady() {
    if (!window.firebase) {
      setTimeout(initWhenReady, 50);
      return;
    }

    doInit();
  }

  function doInit() {
    
    const firebaseConfig = {
      apiKey: "AIzaSyCVOWzlu3_N3zd6yS90D2YY-U1ZL0VYHVo",
      authDomain: "echtlucky-blog.firebaseapp.com",
      projectId: "echtlucky-blog",
      storageBucket: "echtlucky-blog.firebasestorage.app",
      messagingSenderId: "411123885314",
      appId: "1:411123885314:web:869d4cfabaaea3849d0e1b",
      measurementId: "G-MEFF1FQDFF",
    };

    
    const appNS = (window.echtlucky = window.echtlucky || {});

    
    if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);

    
    const auth = firebase.auth();
    const db = firebase.firestore();

    const googleProvider = new firebase.auth.GoogleAuthProvider();
    googleProvider.setCustomParameters({ prompt: "select_account" });

    try {
      db.enablePersistence({ synchronizeTabs: true }).catch((err) => {
      });
    } catch (err) {
    }

    
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
        return "user";
      }
    }

    async function isAdmin(user) {
      if (!user) return false;
      if (isAdminByEmail(user)) return true; // fallback
      const r = await getRole(user.uid);
      return r === "admin";
    }

    
  function sanitizeUsername(raw) {
    return String(raw || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "")
      .replace(/[^a-z0-9_.-]/g, "")
      .slice(0, 20);
  }

  
  async function ensureUserDoc(user, extra = {}) {
    if (!user?.uid) return;

    const ref = db.collection("users").doc(user.uid);
    const snap = await ref.get();
    const now = firebase.firestore.FieldValue.serverTimestamp();
    const fallbackName = user.displayName || (user.email ? user.email.split("@")[0] : "");
    const fallbackUsername = sanitizeUsername(fallbackName);
    const emailLower = String(user.email || "").trim().toLowerCase();

    if (!snap.exists) {
      const initialRole = isAdminByEmail(user) ? "admin" : "user";

      await ref.set({
        email: user.email || "",
        emailLower,
        username: fallbackUsername,
        usernameLower: fallbackUsername,
        displayName: fallbackUsername,
        role: initialRole,
        createdAt: now,
        lastLoginAt: now,
        ...extra,
      });
    } else {
      const data = snap.data() || {};
      const patch = {
        email: user.email || "",
        emailLower,
        lastLoginAt: now,
        ...extra,
      };

      const existingUsername = String(data.username || "").trim();
      const existingDisplayName = String(data.displayName || "").trim();
      const existingLower = String(data.usernameLower || "").trim();

      if (!existingUsername && fallbackUsername) {
        patch.username = fallbackUsername;
      }

      if (!existingDisplayName && (existingUsername || fallbackUsername)) {
        patch.displayName = existingUsername || fallbackUsername;
      }

      if (!existingLower && (existingUsername || fallbackUsername)) {
        patch.usernameLower = sanitizeUsername(existingUsername || fallbackUsername);
      }

      await ref.set(patch, { merge: true });
    }
  }

  async function changeUsername(user, usernameRaw) {
    if (!user?.uid) throw new Error("Nicht eingeloggt.");
    const uname = sanitizeUsername(usernameRaw);
    if (!uname || uname.length < 3) throw new Error("Username ungültig (min. 3 Zeichen).");

    const now = firebase.firestore.FieldValue.serverTimestamp();
    const userRef = db.collection("users").doc(user.uid);
    const unameRef = db.collection("usernames").doc(uname);

    await db.runTransaction(async (tx) => {
      const [userSnap, unameSnap] = await Promise.all([tx.get(userRef), tx.get(unameRef)]);

      if (unameSnap.exists) {
        const mappedUid = String(unameSnap.data()?.uid || "").trim();
        if (mappedUid && mappedUid !== user.uid) {
          throw new Error("Username ist schon vergeben.");
        }
      }

      const data = userSnap.exists ? (userSnap.data() || {}) : {};
      const prevLower = String(data.usernameLower || sanitizeUsername(data.username || data.displayName || "")).trim();

      if (prevLower && prevLower !== uname) {
        const prevRef = db.collection("usernames").doc(prevLower);
        const prevSnap = await tx.get(prevRef);
        if (prevSnap.exists) {
          tx.delete(prevRef);
        }
      }

      tx.set(
        unameRef,
        {
          uid: user.uid,
          email: user.email || "",
          updatedAt: now,
          createdAt: unameSnap.exists ? (unameSnap.data()?.createdAt || now) : now
        },
        { merge: true }
      );

      tx.set(
        userRef,
        {
          username: uname,
          usernameLower: uname,
          displayName: uname,
          updatedAt: now
        },
        { merge: true }
      );
    });

    try {
      await user.updateProfile({ displayName: uname });
    } catch (_) {}

    return uname;
  }

  
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

    await ensureUserDoc(user, { username: uname, usernameLower: uname, displayName: uname });

    return uname;
  }

  
  appNS.auth = auth;
  appNS.db = db;
  appNS.googleProvider = googleProvider;

  appNS.ADMIN_EMAIL = ADMIN_EMAIL;
  appNS.isAdminByEmail = isAdminByEmail;
  appNS.isAdmin = isAdmin;
  appNS.getRole = getRole;

  appNS.ensureUserDoc = ensureUserDoc;
  appNS.saveUsername = saveUsername;
  appNS.changeUsername = changeUsername;
  appNS.sanitizeUsername = sanitizeUsername;

  
  window.auth = auth;
  window.db = db;
  window.googleProvider = googleProvider;

  window.isAdmin = isAdminByEmail;
  window.saveUsername = saveUsername;

  window.firebaseReady = true;
  const event = new CustomEvent('firebaseReady', { detail: { auth, db } });
  window.dispatchEvent(event);
  document.dispatchEvent(event);

  } // end doInit

  initWhenReady();
})();
