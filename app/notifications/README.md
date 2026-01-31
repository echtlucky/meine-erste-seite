# LCKY HUB - Central Notification System

## 📋 Übersicht

Das Notification-System ist das zentrale UI-System für alle Benachrichtigungen, Dialoge und Anrufe in LCKY HUB. Es ersetzt alle `alert()`, `confirm()` und individuellen Toast-Lösungen.

## 🚀 Schnellstart

### Einbindung

Fügen Sie diese Zeilen in Ihre HTML-Seite ein (am Ende des `<body>`):

```html
<!-- Notification Styles -->
<link rel="stylesheet" href="notifications/notify.css">

<!-- Notification Script -->
<script src="notifications/notify.js"></script>
```

Das `notify`-Objekt ist nun global verfügbar.

---

## 📖 API-Referenz

### Toast-Benachrichtigungen

```javascript
// Erfolg
notify.success('Titel', 'Nachricht');

// Fehler
notify.error('Titel', 'Nachricht');

// Warnung
notify.warning('Titel', 'Nachricht');

// Information
notify.info('Titel', 'Nachricht');
```

#### Optionen

```javascript
notify.success('Titel', 'Nachricht', {
    position: 'top-right',  // top-right, top-left, bottom-right, bottom-left, top-center, bottom-center
    duration: 5000          // 0 = keine automatische Schließung
});
```

### Bestätigungs-Dialoge (Promise-basiert)

```javascript
const bestaetigt = await notify.confirm(
    'Titel',
    'Beschreibung der Aktion'
);

if (bestaetigt) {
    // Benutzer hat bestätigt
}
```

#### Danger-Dialog (für gefährliche Aktionen)

```javascript
const geloescht = await notify.danger(
    'Account löschen',
    'Diese Aktion kann nicht rückgängig gemacht werden.'
);

if (geloescht) {
    // Account wird gelöscht
}
```

### Anruf-System

#### Eingehender Anruf

```javascript
const antwort = await notify.incomingCall({
    name: 'Max Mustermann',
    discriminator: '1234',
    color: '#10b981',
    isVideo: true  // oder false für Sprachanruf
});

if (antwort.action === 'accept') {
    // Anruf annehmen
} else {
    // Anruf ablehnen
}
```

#### Aktiver Anruf

```javascript
const call = notify.activeCall({
    peer: { name: 'Max Mustermann', color: '#10b981' },
    isVideo: true,
    onMuteToggle: (muted) => console.log('Mikrofon:', muted ? 'aus' : 'an'),
    onScreenShare: (sharing) => console.log('Screen-Share:', sharing),
    onEndCall: () => console.log('Anruf beendet')
});

// Call aktualisieren
call.updatePeer({ name: 'Neuer Name', color: '#ef4444' });
call.setStatus('Warte...');

// Call beenden
call.end();
```

---

## 🎨 Design-Vorgaben

| Element | Wert |
|---------|------|
| **Schrift** | Montserrat |
| **Primärfarbe** | `#10b981` (Emerald Green) |
| **Akzentfarbe** | `#ef4444` (Red für HUB/Call) |
| **Radius** | `14px` (Modal), `10px` (Toast) |
| **Animation** | `350ms cubic-bezier(0.4, 0, 0.2, 1)` |
| **Glow** | Soft, diffus, nicht grell |

---

## 📁 Dateistruktur

```
notifications/
├── notify.html      # Demo & Testseite
├── notify.css       # Alle Styles
├── notify.js        # Hauptlogik (Global API)
└── README.md        # Diese Datei
```

---

## ✨ UX-Gründe für dieses System

### 1. **Konsistenz**
Alle UI-Elemente sehen gleich aus und verhalten sich gleich. Keine Überraschungen für den Benutzer.

### 2. **Promise-basiert**
```javascript
// Alt (blockierend)
if (confirm('Löschen?')) { ... }

// Neu (modern, async)
if (await notify.confirm('Löschen?', ...)) { ... }
```

### 3. **Fokus-Falle**
Benutzer kann nicht außerhalb des Dialogs klicken. Die Aufmerksamkeit bleibt beim wichtigen UI-Element.

### 4. **ESC-Unterstützung**
Dialoge können mit ESC geschlossen werden (außer wenn `closable: false`).

### 5. **Zentrale Wartung**
Änderungen am Design werden nur an einer Stelle vorgenommen und gelten überall.

---

## 🔧 Erweiterung

### Neue Notification-Typen

```javascript
// In notify.js, Icons-Objekt erweitern
const Icons = {
    // ... bestehende Icons
    myCustom: `<svg>...</svg>`
};

// Neue Toast-Funktion
notify.custom = (title, message, options) => {
    return createToast('custom', title, message, options);
};
```

---

## 📱 Responsive

- Mobile: Vollbild-Overlays
- Desktop: Zentrierte Modals
- Anpassung automatisch

---

## ⚡ Performance

- CSS-Animationen nutzen `transform` und `opacity`
- DOM wird nur bei Bedarf erstellt
- Keine unnötigen Reflows
- Auto-Cleanup nach Animationen
