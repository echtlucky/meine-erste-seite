import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import { firebaseConfig, hasFirebaseConfig } from "./firebase.js";

export const appFirebase = hasFirebaseConfig() ? initializeApp(firebaseConfig) : null;
export const appAuth = appFirebase ? getAuth(appFirebase) : null;
export const appDb = appFirebase ? getFirestore(appFirebase) : null;

