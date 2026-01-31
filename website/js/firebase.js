export const firebaseConfig = {
  apiKey: "REPLACE_WITH_API_KEY",
  authDomain: "echtlucky-blog.firebaseapp.com",
  projectId: "echtlucky-blog",
  storageBucket: "echtlucky-blog.appspot.com",
  messagingSenderId: "411123885314",
  appId: "1:411123885314:web:869d4cfabaaea3849d0e1b"
};

export const hasFirebaseConfig = () =>
  firebaseConfig.apiKey &&
  !String(firebaseConfig.apiKey).startsWith("REPLACE_") &&
  firebaseConfig.projectId &&
  firebaseConfig.appId;
