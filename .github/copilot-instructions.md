# AI Coding Instructions for echtlucky Portfolio

## Project Overview

**echtlucky** is a German-language Fortnite competitive player portfolio website built with vanilla HTML/CSS/JS + Firebase. It's a single-author personal brand site hosted on GitHub Pages with authentication, blog functionality, and community features. No frameworks—everything is handcrafted and intentional.

## Architecture & Key Patterns

### Module Structure & Double-Load Prevention

All major JS files use IIFE (Immediately Invoked Function Expression) with guard checks to prevent double-initialization:

```javascript
if (window.__ECHTLUCKY_FILENAME_LOADED__) return;
window.__ECHTLUCKY_FILENAME_LOADED__ = true;
```

This prevents flicker, race conditions, and duplicate event listeners. **Always add this pattern when creating new JS modules.**

### Global Namespace: `window.echtlucky`

All modules export to a single namespace to avoid global pollution:
- `firebase.js` → exports `appNS.auth`, `appNS.db`, `appNS.isAdminByEmail()`
- `auth-state.js` → manages `window.__ECHTLUCKY_CURRENT_USER__` (single source of truth)
- `menu.js` / `login.js` / page-specific files → consume from `window.echtlucky`

**Convention:** Reference Firebase refs via:
```javascript
const auth = window.auth || window.echtlucky?.auth;
const db = window.db || window.echtlucky?.db;
```

### CSS Organization

- **../css/style.css** — Base typography, grid, utilities (Fortnite-inspired green `#00FF88`)
- **../css/components.css** — Reusable UI (cards, badges, buttons) with CSS variables (spacing, shadows, borders)
- **../css/pages/*.css** — Page-specific styles (home, login, ranked, etc.)

**Pattern:** All components use `--ui-*` CSS variables. Extend via new page-specific CSS files, never modify components.css for one-off needs.

### Firebase Integration

**Load order matters:**
1. Firebase SDK (CDN, before firebase.js)
2. **../firebase.js** — Single init point, prevents double-load, exports `auth` & `db`
3. **../js/auth-state.js** — Auth listener + role caching (10-min TTL, localStorage)
4. Page-specific JS (login.js, account.js, etc.)

**Auth Patterns:**
- Admin detection: `isAdminByEmail()` fallback (hardcoded `lucassteckel04@gmail.com`) + Firestore `users/{uid}.role`
- Role cache: Minimizes Firestore reads for repeated role checks
- Current user: `window.__ECHTLUCKY_CURRENT_USER__` (canonical state)

### Header & Navigation (Fetch-Based)

**../header.html** is injected via fetch into every page's `#header-placeholder`. This allows:
- Single auth state listener (../js/auth-state.js)
- Active nav link highlighting based on pathname
- Mobile menu + dropdown + login CTA updates from one place

**Pattern:** After header fetch completes, pages listen for auth changes and update `data-account-cta` attributes (CTA text/href swap for logged-in vs logged-out).

### Data Flow Example: Login → Account

1. User submits login form (../js/login.js)
2. Firebase auth creates session → onAuthStateChanged fires
3. ../js/auth-state.js updates `window.__ECHTLUCKY_CURRENT_USER__`
4. Firestore reads `users/{uid}` + `users/{uid}.role`
5. Header updates (login link → user dropdown)
6. Page-specific JS (e.g., ../js/account.js) shows/hides account sections

## Critical Conventions

### Naming

- **HTML IDs:** kebab-case, prefixed by context: `#login-link`, `#dropdown-menu`, `#user-name-display`
- **CSS classes:** BEM-inspired, e.g., `.card`, `.card--strong`, `.home-hero`, `.home-hero__inner`
- **JS variables:** camelCase; guard variables: `__ECHTLUCKY_MODULENAME_LOADED__`

### Form Validation & Messages

All forms use a centralized message box pattern (e.g., ../js/login.js):
```javascript
function showMsg(text, type = "error") { /* display in msgBox */ }
```

**Never use `alert()`**—always update DOM.

### Firestore Schema

- `users/{uid}` — Profile + role + metadata
- `users/{uid}.role` — "admin" or "user" (cache this, TTL 10min)
- `usernames/{usernameLower}` — Maps username → uid (prevent duplicates)
- Other collections (blog, groups, etc.) inferred from code

## Development Workflow

### Testing Locally

1. Install Firebase CLI: `npm install -g firebase-tools`
2. Run locally: `firebase serve` (serves on localhost:5000)
3. Login required for /connect, /account, /admin-panel
4. Test auth state with DevTools: `window.__ECHTLUCKY_CURRENT_USER__`

### Common Tasks

- **Add a new page:** Create `pagename.html` + `css/pages/pagename.css` + `js/pagename.js` (with guard)
- **Update header/nav:** Modify **../header.html** only—auto-propagates via fetch
- **Add auth-protected section:** Use `if (window.__ECHTLUCKY_CURRENT_USER__)` after auth-state.js loads
- **Minimize Firestore reads:** Cache role checks (auth-state.js pattern), batch reads in Firestore queries

## Copyright & Content Policy

**This is NOT open-source.** All code, design, and content are copyright © 2026 echtlucky. No forking, copying, or commercial reuse without explicit permission. Respect this when suggesting changes—don't treat it as a template repo.

## Key Files Reference

| File | Purpose |
|------|---------|
| ../firebase.js | Firebase init, auth/db exports |
| ../js/auth-state.js | Auth listener, role cache, header sync |
| ../js/menu.js | Header/nav DOM wiring, mobile menu |
| ../js/login.js | Login/register forms, Firebase auth ops |
| ../css/components.css | UI components + CSS var system |
| ../header.html | Shared header/nav (fetched globally) |
