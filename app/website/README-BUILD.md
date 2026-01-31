# LCKY HUB - Windows EXE Build Guide

## Schnellstart: EXE erstellen

### Methode 1: Batch-Skript (einfach)
```batch
# Doppelklick auf "build-exe.bat"
# Oder führe im Terminal aus:
build-exe.bat
```

### Methode 2: Manuell
```bash
# 1. Abhängigkeiten installieren
npm install

# 2. Windows EXE bauen
npm run build:win

# 3. EXE finden unter:
# dist/win/lucky-hub-1.0.0-setup-x64.exe
```

---

## Entwicklung starten

```bash
# Normale Entwicklung
npm start

# Mit DevTools
npm run dev
```

---

## Projektstruktur

```
echtlcky-app/
├── main.js              # Electron Main Process
├── preload.js           # IPC Bridge
├── package.json         # Dependencies & Build-Config
├── splash.html          # Startup Splash Screen
├── build-exe.bat        # Windows Build Script
├── app/
│   ├── index.html       # Entry Point (Session Check)
│   ├── login.html       # Login Page
│   ├── register.html    # Registration (Multi-step)
│   ├── home.html        # Dashboard (Optimiert!)
│   ├── chat.html        # Direct Messages
│   ├── friends.html     # Friends Management
│   ├── stream.html      # Live Streaming
│   ├── reflex.html      # Reflex Training Lab
│   ├── settings.html    # Settings Modal
│   ├── lucky-hub.css    # Complete Design System
│   ├── script.js        # Main App Logic
│   └── web.js           # Firebase & WebRTC
├── assets/img/          # Logos & Icons
├── notifications/       # Notification System
└── functions/           # Firebase Cloud Functions
```

---

## Features

✅ **Custom Titlebar** - Kein Windows-Rahmen, dragbar
✅ **Splash Screen** - Schneller Start mit Ladeanimation
✅ **Session Management** - Auto-Login
✅ **Dark-Green Theme** - Emerald (#10b981)
✅ **Discord-Style UI** - Server + Navigation Spalten
✅ **Real-time Chat** - Firebase + WebRTC
✅ **Voice/Video Calls** - Integriert
✅ **Live Streaming** - OBS-Ready
✅ **Reflex Lab** - 4 Trainings-Modi
✅ **Settings** - Account, Security, Audio/Video

---

## Systemanforderungen

- **Windows** 10/11 (64-bit)
- **Node.js** 18+
- **4GB RAM** minimum
- **100MB** Festplatte

---

## Troubleshooting

### App startet langsam?
- ✅ Splash Screen zeigt sofort
- ✅ Kritische CSS ist inline
- ✅ Fonts werden vorgeladen

### Build fehlgeschlagen?
```bash
# Cache leeren und neu bauen
npm run rebuild
npm run build:win
```

### DevTools öffnen
```bash
npm run dev
# Drücke F12 im Fenster
```

---

## Build-Ausgabe

Nach `npm run build:win`:

```
dist/
└── win/
    ├── lucky-hub-1.0.0-setup-x64.exe    # Installer (50-80MB)
    └── lucky-hub-1.0.0-x64/              # Portable Version
```

### Installer ausführen
1. `lucky-hub-*-setup-x64.exe` starten
2. Installationsassistent folgen
3. "LCKY HUB" aus Startmenü öffnen

---

## Lizenz

MIT License - © 2024 LCKY HUB Team
