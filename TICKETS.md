# Ticket-System — Review & Feinschliff (echtlucky)

Status: laufend • Ziel: jede Seite stabil, konsistent, production-nah.

Legende
- Priorität: P0 (Blocker) / P1 (Wichtig) / P2 (Nice)
- Bereich: Global / Home / Connect / Blog / Ranked / Stats / Focus / Reflex / Fonts / Login / Account / Admin / Legal

---

## P0 — Blocker (muss als Nächstes)

### P0-GLOBAL-001 — Firestore Rules deploy + Blog Read/Comments live schalten
- Bereich: Global / Blog
- Problem: lokale `firestore.rules` sind angepasst, aber ohne Deploy bleiben Reads/Comments ggf. gesperrt.
- Akzeptanz:
  - Unauthenticated kann `blog.html` öffnen und Posts lesen.
  - Comments: read public, create/edit/delete (author), delete (admin) funktioniert gemäß Rules.
  - Keine „Missing/insufficient permissions“ bei Blog-Reads.
- Dateien: `firestore.rules`

### P0-CONNECT-001 — Direktanruf (DM) implementieren (nicht nur Gruppen)
- Bereich: Connect
- Problem: Anruf-Button ist aktuell an Gruppen-Call-Logik gekoppelt (`groups/{groupId}/voice-calls`).
- Ziel: 1:1 Call in DMs, ohne Gruppe beizutreten.
- Lösungsskizze:
  - Neue Collection: `dm-calls/{callId}` ODER `direct-calls/{callId}` (participants: [uidA, uidB]).
  - Signaling Subcollections wie bei Gruppen: `offers/answers/ice-candidates`.
  - UI: im DM-Chat-Header „Anrufen“ + Incoming Modal mit Name/Avatar.
  - Reuse WebRTC Engine: `voice-chat.js` abstrahieren auf `callScope` (group|dm) oder neues Modul `dm-voice-chat.js`.
- Akzeptanz:
  - In DM-Chat kann User A User B anrufen (ringing/active/ended).
  - Kein Gruppenbeitritt nötig.
  - Mobile + Desktop: accept/reject/end sauber; Ring-Sound looped bis accepted/ended.
- Dateien: `connect.html`, `css/pages/connect.css`, `js/connect-minimal.js`, `js/voice-chat.js`, `firestore.rules`

### P0-CONNECT-002 — DM Chat Header + Call Controls trennen (DM vs Group)
- Bereich: Connect
- Problem: Chat-Header zeigt gruppenbezogene Controls/Labels, obwohl DM aktiv ist.
- Akzeptanz:
  - DM: Header zeigt „Direktnachricht: {Name}“ + Call + Settings (DM-spezifisch).
  - Group: Header zeigt „Gruppe: {Name}“ + Group Settings + Group Call.
  - Buttons sind korrekt enabled/disabled je Mode.
- Dateien: `connect.html`, `js/connect-minimal.js`

---

## P1 — Wichtig (Qualität, UX, Konsistenz)

### P1-GLOBAL-001 — Encoding/Mojibake Cleanup (UI Texte)
- Bereich: Global
- Problem: Einzelne Dateien enthalten noch kaputte Sonderzeichen (z. B. in `js/login.js`, `js/modal-dialog.js`).
- Akzeptanz:
  - Keine „Ã/â…“-Artefakte mehr in UI-Texten auf allen Seiten.
  - Alle betroffenen Dateien UTF-8 ohne BOM.
- Dateien (Startliste): `js/login.js`, `js/modal-dialog.js`, ggf. weitere nach Scan

### P1-GLOBAL-002 — Einheitliche Content-Breite (zentriert, max-width)
- Bereich: Global
- Ziel: alle „Content-Seiten“ wie Home: zentriert mit `--content-max`, kein Full-Stretch.
- Akzeptanz:
  - `blog`, `ranked`, `stats`, `focus`, `reflex`, `fonts`, `account`, `login`, `impressum`, `datenschutz`, `kontakt`, `404` wirken konsistent.
  - Keine Seite „explodiert“ auf Ultrawide.
- Dateien: `css/style.css`, `css/pages/*.css`, jeweilige `*.html`

### P1-GLOBAL-003 — Mobile Footer/Bottom-Rail Kollisionscheck
- Bereich: Global
- Problem: Mobile Bottom-Rail kann Footer/Inputs überdecken; Connect löst das separat.
- Akzeptanz:
  - Auf allen Seiten: Footer/Buttons/Inputs bleiben erreichbar (kein Overlap).
  - Safe-area Insets berücksichtigt (iOS).
- Dateien: `css/style.css`, `css/app-shell.css`, `css/pages/*.css`

### P1-CONNECT-003 — Freund-Management vollständig (Add/Remove/Mute/Block)
- Bereich: Connect
- Problem: „Freund hinzufügen“ sollte zuverlässig sein + DM-Liste ist Friends-first.
- Akzeptanz:
  - Add friend: findet Nutzer, fügt in Friends-Liste (Firestore oder stabiler local fallback).
  - Kontextmenü auf Friend: stumm, blockieren, entfernen, Profil ansehen.
  - Blocked: keine Nachrichten/Calls möglich, UI erklärt Status.
- Dateien: `js/connect-minimal.js`, evtl. `firestore.rules` (falls Friends serverseitig)

### P1-CONNECT-004 — Reply & Reactions UX polish (Discord-like)
- Bereich: Connect
- Akzeptanz:
  - Reply preview klickbar -> scroll/highlight original message.
  - Reactions UI: consistent highlighting, accessible, mobile friendly.
- Dateien: `connect.html`, `css/pages/connect.css`, `js/connect-minimal.js`

### P1-BLOG-001 — Post Editor (Author/Admin) + Link handling
- Bereich: Blog
- Status: Editor UI ist integriert (Bearbeiten) als Placeholder/Basic-Flow.
- Akzeptanz:
  - Bearbeiten speichert title/content (sanitized render).
  - Links in Content + Comments sind klickbar & sicher (noopener/noreferrer).
- Dateien: `blog.html`, `css/pages/blog.css`, `js/blog.js`

### P1-BLOG-002 — Comments Moderation & Limits
- Bereich: Blog
- Akzeptanz:
  - Rate-limit (client-side) + UI feedback bei Spam.
  - Edit/Delete nur author; Admin kann delete.
  - Max 600 chars (enforced UI + server rules keys).
- Dateien: `js/blog.js`, `firestore.rules`

### P1-LOGIN-001 — Login Fehler „Cant find Admin Variable“ eliminieren
- Bereich: Login
- Hypothese: irgendwo wird `ADMIN_EMAIL`/Admin-Flag erwartet, aber nicht gesetzt/inkonsistent.
- Akzeptanz:
  - Login via Google und Email/Passwort ohne Fehler.
  - Nach Login Redirect korrekt (returnTo) und Header zeigt User.
- Dateien: `js/login.js`, `js/auth-state.js`, `firebase.js`

### P1-ACCOUNT-001 — Profilbild Upload (Storage) + Anzeige überall
- Bereich: Account / Global
- Ziel: Upload + speichern URL in `users/{uid}.photoURL` + Header/Connect Userbar nutzt das.
- Akzeptanz:
  - Upload funktioniert (validations, size limit).
  - Header/Connect/Account zeigen konsistent Avatar.
- Dateien: `account.html`, `css/pages/account.css`, `js/account.js`, `js/auth-state.js`, `js/connect-minimal.js`, `storage.rules` (falls vorhanden)

### P1-RANKED-001 — Ranked UI: echte Placeholder-Logik (ohne Backend)
- Bereich: Ranked
- Akzeptanz:
  - Focus Mode Toggle, Difficulty Selector, Achievements States, Skeleton Loader funktionieren konsistent.
  - Mobile & Desktop: 3-column scroll sauber, kein jump.
- Dateien: `ranked.html`, `css/pages/ranked.css`, `js/ranked.js`

### P1-STATS-001 — Stats: Mock-Daten + Progress Animation stabil
- Bereich: Stats
- Akzeptanz:
  - Cards animieren progress, aber respektieren „reduced motion“.
  - Keine Layout-Überläufe; mobile readable.
- Dateien: `stats.html`, `css/pages/stats.css`, `js/stats.js`

### P1-FOCUS-001 — Focus: Sessions/History robust + Offline Persistence
- Bereich: Focus
- Akzeptanz:
  - Timer-Transitions sauber (start/pause/end).
  - History persistent, exportierbar, keine doppelten Einträge.
- Dateien: `focus.html`, `css/pages/focus.css`, `js/focus.js`

### P1-REFLEX-001 — Reflex: Overlay UX & Mobile Safety
- Bereich: Reflex
- Akzeptanz:
  - Overlay fullscreen stabil, exit immer möglich.
  - Keine Cursor/Scroll bugs auf Mobile.
- Dateien: `reflex.html`, `css/pages/reflex.css`, `js/reflex.js`

### P1-FONTS-001 — Schriftgenerator: Copy UX + Favorites
- Bereich: Fonts
- Akzeptanz:
  - Klick kopiert Style + Toast.
  - „ˡᶜᵏʸ“ Preset vorhanden + Filter stabil.
- Dateien: `fonts.html`, `css/pages/fonts.css`, `js/fonts.js`

---

## P2 — Nice / Ausbau

### P2-GLOBAL-001 — UI States Audit (hover/active/disabled)
- Bereich: Global
- Ziel: überall konsistente States (Buttons, Inputs, Dropdowns).
- Dateien: `css/style.css`, `css/components.css`, `css/pages/*.css`

### P2-GLOBAL-002 — Accessibility Pass
- Bereich: Global
- Akzeptanz:
  - Focus outlines vorhanden, aria-labels korrekt, modals trap focus (später).
- Dateien: alle relevanten `*.html`, `css/*`, `js/*`

### P2-CONNECT-005 — Context Menus (Groups + Friends) erweitern
- Bereich: Connect
- Akzeptanz:
  - Gruppe: rename, invite, delete, mark read.
  - Friend: call, mute, block, remove.
- Dateien: `js/connect-minimal.js`, `js/group-strip-v2.js`, `connect.html`, `css/pages/connect.css`

---

## Seiten-Review Checkliste (pro Seite)

Für jede Seite prüfen (quick pass):
1) Header Dropdowns klickbar, z-index ok
2) Content max-width ok, kein Full-Stretch
3) Mobile: Footer/Bottom bar überdeckt nichts
4) Fonts/Encoding sauber
5) Console frei von Errors (außer erwartete permission/placeholder)

