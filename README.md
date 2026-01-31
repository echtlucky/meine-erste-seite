# LCKY HUB - Website & App

Glassy, violet, premium. This repo contains the public website and the LCKY HUB app.

Live: `https://echtlucky.github.io/meine-erste-seite/`

## Project structure

```
/meine-erste-seite
  /website   -> static marketing site (GitHub Pages)
  /app       -> LCKY HUB application (npm + Firebase)
```

## Local usage

### Website (static)

Open `website/index.html` directly or serve it with any static file server.

### App (npm)

Run npm commands **only** inside `app/`:

```
cd app
npm start
```

## Firebase

Both website and app are designed to share one Firebase project:
- Auth (email + username)
- Firestore (shared user base + roles)

## Notes

- Do not run npm in the repository root.
- `website/` is static and should not use npm.

(c) 2026 echtlcky
