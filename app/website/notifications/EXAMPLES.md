# LCKY HUB - Notification System Beispiele

## 📌 Vollständiges Einbindungs-Beispiel

```html
<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Meine Seite - LCKY HUB</title>
    
    <!-- App Styles -->
    <link rel="stylesheet" href="app/style.css">
</head>
<body>
    <!-- Dein Content hier -->
    
    <!-- Notification System (am Ende des Body) -->
    <link rel="stylesheet" href="notifications/notify.css">
    <script src="notifications/notify.js"></script>
    
    <!-- Dein Page Script -->
    <script src="app/script.js"></script>
</body>
</html>
```

---

## 🎯 Toast-Notifications

```javascript
// Erfolgsbenachrichtigung
notify.success(
    'Einstellungen gespeichert', 
    'Deine Präferenzen wurden aktualisiert'
);

// Fehlerbenachrichtigung
notify.error(
    'Verbindung verloren',
    'Bitte überprüfe deine Internetverbindung'
);

// Infobenachrichtigung
notify.info(
    'Update verfügbar',
    'Eine neue Version ist bereit zum Download',
    { duration: 0 }  // Bleibt offen bis Benutzer schließt
);

// Warnung
notify.warning(
    'Session läuft ab',
    'Deine Sitzung endet in 5 Minuten'
);
```

---

## ✅ Bestätigungs-Dialoge

### Einfacher Confirm
```javascript
const bestaetigt = await notify.confirm(
    'Freund entfernen',
    'Möchtest du diesen Freund wirklich aus deiner Liste entfernen?'
);

if (bestaetigt) {
    // Freund entfernen
    console.log('Benutzer hat bestätigt');
} else {
    console.log('Benutzer hat abgebrochen');
}
```

### Danger Dialog (für kritische Aktionen)
```javascript
const geloescht = await notify.danger(
    'Account löschen',
    'Diese Aktion ist unwiderruflich. Alle deine Daten, Freunde und Nachrichten werden permanent gelöscht.'
);

if (geloescht) {
    // Account löschen
    await deleteUserData();
    navigateTo('login.html');
}
```

### Mit Custom Buttons
```javascript
const action = await notify.confirm(
    'Stream beenden',
    'Möchtest du den Stream wirklich beenden?',
    {
        confirmText: 'Stream beenden',
        cancelText: 'Weiter streamen'
    }
);
```

---

## 📞 Anruf-System

### Eingehenden Anruf simulieren
```javascript
// Wenn ein Anruf eingeht
const antwort = await notify.incomingCall({
    name: 'Sarah Müller',
    discriminator: '8921',
    color: '#8b5cf6',  // Lila
    isVideo: true      // Videoanruf
});

if (antwort.action === 'accept') {
    // WebRTC Verbindung herstellen
    startVideoCall(antwort.caller);
} else {
    // Anruf ablehnen
    sendBusyStatus(antwort.caller);
}
```

### Aktiver Anruf mit Controls
```javascript
let currentCall = null;

async function startCall(peer) {
    currentCall = notify.activeCall({
        peer: peer,
        isVideo: true,
        onMuteToggle: (muted) => {
            if (muted) {
                audioContext.mute();
            } else {
                audioContext.unmute();
            }
        },
        onScreenShare: (sharing) => {
            if (sharing) {
                startScreenShare();
            } else {
                stopScreenShare();
            }
        },
        onEndCall: () => {
            endCall();
            notify.info('Anruf beendet', `Dauer: ${callDuration}`);
        }
    });
}

// Anruf beenden
function endCall() {
    if (currentCall) {
        currentCall.end();
        currentCall = null;
    }
}
```

### Screen-Sharing Status-Indikator
```javascript
// Wenn Screen-Sharing aktiv wird
currentCall = notify.activeCall({
    peer: { name: 'Max', color: '#10b981' },
    isVideo: true,
    onScreenShare: (sharing) => {
        if (sharing) {
            // Screen-Share starten
            navigator.mediaDevices.getDisplayMedia({ video: true })
                .then(stream => {
                    // Video-Track zum Call hinzufügen
                });
        } else {
            // Screen-Share stoppen
        }
    }
});
```

---

## 🔄 Async/Await Pattern

### Mehrere Bestätigungen hintereinander
```javascript
async function deleteUserAccount() {
    const step1 = await notify.confirm(
        'Account-Löschung starten',
        'Möchtest du fortfahren? Diese Aktion erfordert weitere Bestätigungen.'
    );
    
    if (!step1) return;
    
    const step2 = await notify.danger(
        ' Wirklich löschen?',
        'Dies ist deine letzte Chance. All deine Daten werden unwiderruflich gelöscht.'
    );
    
    if (!step2) {
        notify.info('Abgebrochen', 'Dein Account ist sicher.');
        return;
    }
    
    // Löschen...
    await performDeletion();
    notify.success('Account gelöscht', 'Wir bedauern deinen Abschied.');
    navigateTo('login.html');
}
```

### Mit Loading-State
```javascript
async function saveSettings() {
    notify.info('Speichern...', 'Deine Einstellungen werden gespeichert');
    
    try {
        await saveToFirestore();
        notify.success('Gespeichert', 'Alle Einstellungen wurden übernommen');
    } catch (error) {
        notify.error('Fehler', 'Speichern fehlgeschlagen: ' + error.message);
    }
}
```

---

## 🎨 Custom Styling Beispiele

### Toast-Position ändern
```javascript
// Oben rechts (Standard)
notify.success('Erfolg', 'Nachricht');

// Unten rechts
notify.success('Erfolg', 'Nachricht', { position: 'bottom-right' });

// Oben links
notify.error('Fehler', 'Nachricht', { position: 'top-left' });

// Oben zentriert
notify.warning('Achtung', 'Nachricht', { position: 'top-center' });
```

---

## ⚠️ WICHTIG: Keine alert()/confirm()

### ❌ FALSCH (Alte Methode)
```javascript
if (confirm('Löschen?')) {
    deleteSomething();
}

alert('Fehler!');
```

### ✅ RICHTIG (Neue Methode)
```javascript
const bestaetigt = await notify.confirm(
    'Löschen bestätigen',
    'Möchtest du dieses Element wirklich löschen?'
);

if (bestaetigt) {
    deleteSomething();
}

notify.error('Fehler aufgetreten', 'Bitte versuche es erneut');
```

---

## 📱 Mobile Considerations

Das System ist bereits responsive. Für mobile Optimierungen:

```javascript
// Auf Mobile anders positionieren
const position = /Mobile/i.test(navigator.userAgent) 
    ? 'bottom-center' 
    : 'bottom-right';

notify.success('Gespeichert', '✓', { position });
```

---

## 🐛 Debugging

```javascript
// Alle Notifications im Entwicklungsmodus loggen
const originalSuccess = notify.success;
notify.success = (title, message, options) => {
    console.log('[NOTIFY]', { type: 'success', title, message });
    return originalSuccess(title, message, options);
};
```
