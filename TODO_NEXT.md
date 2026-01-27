# TODO (Priorisiert) — UI/UX + Layout + Fixes

## P0 — Blocker / kaputte Seiten
- [x] `blog.html`: ungültiges HTML gefixt → Seite rendert wieder, `js/blog.js` eingebunden, Header/Footer + `body.loaded`.
- [x] `account.html`: vermischtes/duplicated HTML gefixt → 1 Footer-Placeholder, modernes Layout, Scripts korrekt.
- [x] `admin-panel.html`: duplicated HTML gefixt → neue Struktur + Tabs wieder klickbar.

## P1 — Globales Layout (alle Seiten)
- [x] Hintergrundbild entfernt (nur noch CSS-“Kacheln”, kein Unsplash-Foto).
- [x] Container/Seiten-Shells auf **Fullwidth** umgestellt (Home/Blog/Ranked/Reflex/Connect/Account/Admin).
- [x] Footer: Duplikate entfernt + Layout so, dass Footer wieder am Rand sitzt.

## P1 — Connect Mobile UX (Handy)
- [~] Mobile Layout von Connect neu ausrichten (Re-Layout + sticky Bottom-Tabs; weitere Feinschliffe noch offen).
- [ ] Touch-Ziele/Spacing optimieren (Tabs, Buttons, Lists).
- [ ] Screen-Share Viewer auf Mobile: stabil, immer auffindbar, Reopen-Flow über Call-Bar.

## P1 — Account Seite (Style wie Startseite)
- [x] `account.html` auf modernes Tiles-Layout umgestellt.
- [x] Fullwidth + Footer/Scroll-Bugs entfernt (keine doppelten Placeholder mehr).
- [ ] `css/pages/account.css`: weitere Cleanup-Runde (alte Discord-Styles komplett entfernen statt nur scopen).

## P1 — Admin Panel (Logs links, zuverlässig)
- [x] Logs links als Sidebar-Card (Sticky) + „Logs“ aus Top-Nav entfernt.
- [x] Logs stabilisiert: Realtime Listener auf `admin-logs` (geordnet, limit).
- [x] Tabs/Navigation wieder klickbar (HTML/JS Klassen konsistent).

## P2 — Cleanup / Qualität
- [ ] Encoding/UTF-8 Probleme entfernen (kaputte Umlaute/Emoji in HTML/JS).
- [ ] Doppelte/alte CSS-Selektoren entfernen, Mobile-first konsolidieren.
- [ ] Smoke-Checks: JS Syntax ok, keine DOM-Null-Errors, Layout in 360px/768px/1440px.
