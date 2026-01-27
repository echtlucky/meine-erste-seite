# TODO (Priorisiert) — UI/UX + Layout + Fixes

## P0 — Blocker / kaputte Seiten
- [ ] `blog.html`: Datei ist aktuell **ungültiges HTML** (Code steht nach `</html>`), deshalb wird die Seite leer/kaputt gerendert → bereinigen, `js/blog.js` korrekt einbinden, Header/Footer laden, `body.loaded` setzen.
- [ ] `account.html`: Datei ist ebenfalls **vermischt/duplicated** (zweiter Block nach `</html>` + mehrfach `#footer-placeholder`) → bereinigen, nur 1 Footer-Placeholder, korrektes Script-Setup (`js/account.js`), responsive Layout.
- [ ] `admin-panel.html`: Datei ist **duplicated** (doppeltes `#footer-placeholder` + extra Content nach `</html>`) → bereinigen, Tabs zuverlässig, Logs-Bereich neu strukturieren.

## P1 — Globales Layout (alle Seiten)
- [ ] Hintergrundbild entfernen (nur noch “Kacheln/Tile”-Look über CSS, kein Unsplash-Foto).
- [ ] Cards/Seiten-Container sollen **100% Breite** nutzen (keine festen max-width Container) und sauber mitskalieren.
- [ ] Footer auf **allen Seiten** immer am unteren Rand (keine Placeholder-Duplikate, Layout-Flex/MinHeight sauber).

## P1 — Connect Mobile UX (Handy)
- [ ] Mobile Layout von Connect neu ausrichten (weniger „links-lastig“, klare Hierarchie).
- [ ] Touch-Ziele/Spacing optimieren (Tabs, Buttons, Lists).
- [ ] Screen-Share Viewer auf Mobile: stabil, immer auffindbar, Reopen-Flow über Call-Bar.

## P1 — Account Seite (Style wie Startseite)
- [ ] `css/pages/account.css`: Discord-graue Optik raus, Home/Glass-Theme rein.
- [ ] Sections als Tiles/Fullwidth, responsiv (Grid → Stack).
- [ ] Footer/Scroll-Bugs entfernen (Inhalte dürfen nicht unter dem Rand “verschwinden”).

## P1 — Admin Panel (Logs links, zuverlässig)
- [ ] „Aktivität“ → **Logs**: links als dauerhaft sichtbare Card (Sticky/Sidebar).
- [ ] Logs-Quelle stabilisieren (kein zufälliges UI-Flackern, klare Reihenfolge, Limit/Load more).
- [ ] Tabs/Navigation: „Logs“ aus der Top-Menüleiste entfernen (weil links), Rest-Tabs wieder klickbar.

## P2 — Cleanup / Qualität
- [ ] Encoding/UTF-8 Probleme entfernen (kaputte Umlaute/Emoji in HTML/JS).
- [ ] Doppelte/alte CSS-Selektoren entfernen, Mobile-first konsolidieren.
- [ ] Smoke-Checks: JS Syntax ok, keine DOM-Null-Errors, Layout in 360px/768px/1440px.

