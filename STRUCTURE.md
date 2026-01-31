# Project Structure - meine-erste-seite

This document reflects the current, real structure of the repository at /meine-erste-seite.

```
/meine-erste-seite
├─ README.md
├─ STRUCTURE.md
├─ app/
│  ├─ .firebaserc
│  ├─ .gitignore
│  ├─ BACKEND.md
│  ├─ README.md
│  ├─ README-BUILD.md
│  ├─ build-exe.bat
│  ├─ firebase.json
│  ├─ firestore.rules
│  ├─ index.html
│  ├─ main.js
│  ├─ package.json
│  ├─ package-lock.json
│  ├─ palette.md
│  ├─ preload.js
│  ├─ splash.html
│  ├─ app/
│  │  ├─ index.html
│  │  ├─ login.html
│  │  ├─ register.html
│  │  ├─ admin-panel.html
│  │  ├─ agb.html
│  │  ├─ aim-dummies.html
│  │  ├─ aim-rings.html
│  │  ├─ dev-tool.html
│  │  ├─ galaxy.html
│  │  ├─ memory-game.html
│  │  ├─ precision-game.html
│  │  ├─ reflex-test.html
│  │  ├─ web.js
│  │  ├─ css/
│  │  │  └─ main.css
│  │  └─ js/
│  │     ├─ ai-monitor.js
│  │     ├─ app.js
│  │     ├─ dev-tool-api.js
│  │     ├─ game-settings.js
│  │     └─ i18n.js
│  ├─ assets/
│  │  └─ img/
│  │     ├─ bg.png
│  │     ├─ logo.png
│  │     └─ logo-rbg.png
│  ├─ functions/
│  │  ├─ index.js
│  │  └─ package.json
│  ├─ js/
│  │  └─ firebase.js
│  ├─ build/
│  ├─ dist/
│  ├─ notifications/
│  └─ node_modules/
├─ website/
│  ├─ .firebaserc
│  ├─ .gitattributes
│  ├─ .gitignore
│  ├─ 404.html
│  ├─ BACKEND-SETUP.md
│  ├─ DESIGN-SPEC.md
│  ├─ firebase.json
│  ├─ firestore.rules
│  ├─ firestore.indexes.json
│  ├─ index.html
│  ├─ assets/
│  │  ├─ bg.png
│  │  ├─ bg.jpg
│  │  └─ logo-rbg.png
│  ├─ css/
│  │  └─ lcky-design.css
│  ├─ js/
│  │  ├─ firebase.js
│  │  ├─ firebase-init.js
│  │  ├─ auth-modal.js
│  │  ├─ blog.js
│  │  ├─ admin.js
│  │  ├─ admin-roles.js
│  │  ├─ generator-modal.js
│  │  └─ layout.js
│  ├─ pages/
│  │  ├─ blog.html
│  │  ├─ admin-panel.html
│  │  ├─ admin-roles.html
│  │  ├─ hub-download.html
│  │  ├─ fonts.html
│  │  ├─ impressum.html
│  │  ├─ datenschutz.html
│  │  └─ nutzungsbedingungen.html
│  ├─ partials/
│  │  ├─ header.html
│  │  └─ footer.html
│  ├─ screenshots/
│  └─ functions/
│     ├─ index.js
│     └─ package.json
└─ .git/
```

Notes:
- node_modules/ and dist/ are large runtime/build artifacts and are not expanded here.
- functions/ folders contain Firebase Cloud Functions codebases.

## Purpose of Key Areas

### website/
Static marketing site (GitHub Pages). Uses glassmorphism styling, modular JS, and partial-based header/footer. Contains blog, admin entry, and legal pages.

### app/
Electron-based LCKY HUB application. Contains the main Electron process (main.js), renderer app files in app/, assets, and build artifacts.

### Firebase files
- .firebaserc: Firebase project alias (now unified to echtlucky-blog).
- firebase.json: Firebase config for hosting/functions and Firestore rules mapping.
- firestore.rules: Security rules shared across website and app.
- firestore.indexes.json (website): Indexes for Firestore queries.

### functions/
Server-side Firebase Functions for API endpoints and background tasks.

### assets/
Images and media used by the website and app (backgrounds, logos, icons).
