import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

const APP_FIREBASE_CONFIG = {
  apiKey: "REPLACE_WITH_APP_API_KEY",
  authDomain: "REPLACE_WITH_APP_AUTH_DOMAIN",
  projectId: "REPLACE_WITH_APP_PROJECT_ID",
  storageBucket: "REPLACE_WITH_APP_STORAGE_BUCKET",
  messagingSenderId: "REPLACE_WITH_APP_SENDER_ID",
  appId: "REPLACE_WITH_APP_APP_ID"
};

const SITE_FIREBASE_CONFIG = {
  apiKey: "REPLACE_WITH_SITE_API_KEY",
  authDomain: "REPLACE_WITH_SITE_AUTH_DOMAIN",
  projectId: "REPLACE_WITH_SITE_PROJECT_ID",
  storageBucket: "REPLACE_WITH_SITE_STORAGE_BUCKET",
  messagingSenderId: "REPLACE_WITH_SITE_SENDER_ID",
  appId: "REPLACE_WITH_SITE_APP_ID"
};

const hasConfig = (config) => Object.values(config).every((value) => !String(value).startsWith("REPLACE_"));

export const appFirebase = hasConfig(APP_FIREBASE_CONFIG)
  ? initializeApp(APP_FIREBASE_CONFIG, "app")
  : null;
export const appAuth = appFirebase ? getAuth(appFirebase) : null;
export const appDb = appFirebase ? getFirestore(appFirebase) : null;

export const siteFirebase = hasConfig(SITE_FIREBASE_CONFIG)
  ? initializeApp(SITE_FIREBASE_CONFIG, "site")
  : null;
export const siteAuth = siteFirebase ? getAuth(siteFirebase) : null;
export const siteDb = siteFirebase ? getFirestore(siteFirebase) : null;
