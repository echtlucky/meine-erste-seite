# LCKY HUB - Backend Architecture

## 📁 Firestore Data Model

```
firestore/
├── users/{userId}/
│   ├── uid: string
│   ├── username: string (unique, 3-32 chars)
│   ├── displayName: string (optional, free text)
│   ├── email: string
│   ├── discriminator: string (e.g., "1234")
│   ├── avatarUrl: string (optional)
│   ├── avatarColor: string (hex, fallback)
│   ├── status: enum ("online", "idle", "dnd", "offline")
│   ├── customStatus: string (optional)
│   ├── role: enum ("user", "creator", "admin")
│   ├── lastUsernameChange: timestamp
│   ├── lastSeen: timestamp
│   ├── createdAt: timestamp
│   └── settings: map
│
├── usernames/{usernameLowercase}/
│   └── userId: string (mapping for uniqueness)
│
├── friends/{userId}/
│   └── userFriends/{friendId}/
│       ├── status: enum ("accepted", "blocked")
│       ├── addedAt: timestamp
│       └── friendSince: timestamp
│
├── friendRequests/{requestId}/
│   ├── fromUserId: string
│   ├── fromUsername: string
│   ├── toUserId: string
│   ├── toUsername: string
│   ├── status: enum ("pending", "accepted", "declined")
│   ├── message: string (optional)
│   └── createdAt: timestamp
│
├── chats/{chatId}/
│   ├── type: enum ("dm", "group")
│   ├── name: string (optional, for groups)
│   ├── participants: map
│   ├── lastMessage: string
│   ├── lastMessageAt: timestamp
│   ├── createdAt: timestamp
│   └── createdBy: string
│
│   └── messages/{messageId}/
│       ├── content: string
│       ├── senderId: string
│       ├── senderName: string
│       ├── type: enum ("text", "image", "file", "call")
│       ├── attachments: array
│       ├── edited: boolean
│       ├── editedAt: timestamp (optional)
│       ├── readBy: map
│       └── timestamp: timestamp
│
├── calls/{callId}/
│   ├── type: enum ("audio", "video", "screen")
│   ├── status: enum ("ringing", "active", "ended")
│   ├── participants: map
│   ├── startedAt: timestamp
│   ├── endedAt: timestamp (optional)
│   ├── duration: number (seconds, optional)
│   ├── initiatedBy: string
│   └── endedBy: string (optional)
│
│   └── participants/{userId}/
│       ├── joinedAt: timestamp
│       ├── leftAt: timestamp (optional)
│       ├── isMuted: boolean
│       ├── isVideoOff: boolean
│       └── isScreenSharing: boolean
│
├── streams/{streamId}/
│   ├── title: string
│   ├── description: string (optional)
│   ├── streamerId: string
│   ├── streamerName: string
│   ├── thumbnailUrl: string (optional)
│   ├── status: enum ("live", "ended")
│   ├── category: string (optional)
│   ├── viewers: number
│   ├── peakViewers: number
│   ├── likes: number
│   ├── startedAt: timestamp
│   ├── endedAt: timestamp (optional)
│   └── rtmpUrl: string (server-side only)
│
│   └── viewers/{viewerId}/
│       └── joinedAt: timestamp
│
└── notifications/{notificationId}/
    ├── userId: string
    ├── type: enum ("friend_request", "call", "message", "stream", "system")
    ├── title: string
    ├── message: string
    ├── data: map (additional data)
    ├── read: boolean
    └── createdAt: timestamp
```

---

## 🔐 Firebase Security Rules

### Key Security Decisions

1. **User Profiles**: Only owner can modify their own data
2. **Username Changes**: Cooldown of 7 days enforced server-side
3. **Chat Access**: Only participants can read/write messages
4. **Friends**: Mutual agreement required (bidirectional)
5. **Creator Role**: Required for streaming (enforced in rules)
6. **Username Uniqueness**: Managed by cloud functions (no client write)

### Storage Limits
- Avatars: 5MB max
- Thumbnails: 10MB max
- Attachments: 50MB max
- Recordings: 1GB max

---

## 📞 Call & Screen-Sharing Flow

### 1. Initiating a Call

```javascript
// User clicks "Call" button
async function initiateCall(userId, type = 'video') {
  const currentUser = getCurrentUser();
  
  // Create call document
  const callRef = db.collection('calls').doc();
  await callRef.set({
    type: type,
    status: 'ringing',
    participants: {
      [currentUser.id]: {
        joinedAt: firebase.firestore.FieldValue.serverTimestamp(),
        isMuted: false,
        isVideoOff: false,
        isScreenSharing: false
      }
    },
    startedAt: firebase.firestore.FieldValue.serverTimestamp(),
    initiatedBy: currentUser.id
  });
  
  // Send notification to callee
  await sendNotification(userId, {
    type: 'call',
    title: 'Anruf von ' + currentUser.username,
    message: type === 'video' ? 'Videoanruf' : 'Sprachanruf',
    data: { callId: callRef.id, callerId: currentUser.id }
  });
  
  return callRef.id;
}
```

### 2. Incoming Call (Notification)

```javascript
// Frontend receives notification
notify.incomingCall({
  name: caller.username,
  discriminator: caller.discriminator,
  color: caller.avatarColor,
  isVideo: call.type === 'video'
}).then(action => {
  if (action.action === 'accept') {
    // Join the call
    joinCall(callId);
  } else {
    // Decline - notify caller
    declineCall(callId);
  }
});
```

### 3. Joining a Call

```javascript
async function joinCall(callId) {
  const callRef = db.collection('calls').doc(callId);
  
  // Update call status
  await callRef.update({
    status: 'active',
    [`participants.${currentUser.id}`]: {
      joinedAt: firebase.firestore.FieldValue.serverTimestamp(),
      isMuted: false,
      isVideoOff: false,
      isScreenSharing: false
    }
  });
  
  // Listen for call updates
  callRef.onSnapshot(snapshot => {
    const call = snapshot.data();
    updateCallUI(call);
  });
  
  // Initialize WebRTC connection
  initializeWebRTC(callId);
}
```

### 4. Screen Sharing

```javascript
async function startScreenShare() {
  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: { cursor: 'always' },
      audio: false
    });
    
    // Replace video track with screen track
    const videoTrack = stream.getVideoTracks()[0];
    const sender = peerConnection.getSenders()
      .find(s => s.track && s.track.kind === 'video');
    
    if (sender) {
      await sender.replaceTrack(videoTrack);
    }
    
    // Update Firestore
    await db.collection('calls').doc(callId).update({
      [`participants.${currentUser.id}.isScreenSharing`]: true
    });
    
    // Handle stream end
    videoTrack.onended = () => {
      stopScreenShare();
    };
    
    return stream;
  } catch (error) {
    notify.error('Screen-Sharing', 'Konnte nicht gestartet werden');
    throw error;
  }
}

async function stopScreenShare() {
  // Get camera track
  const cameraStream = await navigator.mediaDevices.getUserMedia({ video: true });
  const cameraTrack = cameraStream.getVideoTracks()[0];
  
  // Replace screen track with camera
  const sender = peerConnection.getSenders()
    .find(s => s.track && s.track.kind === 'video');
  
  if (sender) {
    await sender.replaceTrack(cameraTrack);
  }
  
  // Update Firestore
  await db.collection('calls').doc(callId).update({
    [`participants.${currentUser.id}.isScreenSharing`]: false
  });
}
```

### 5. Ending a Call

```javascript
async function endCall(callId) {
  const callRef = db.collection('calls').doc(callId);
  
  await callRef.update({
    status: 'ended',
    endedAt: firebase.firestore.FieldValue.serverTimestamp(),
    endedBy: currentUser.id,
    duration: calculateDuration()
  });
  
  // Clean up WebRTC
  cleanupWebRTC();
  
  notify.info('Anruf beendet', 'Dauer: ' + formatDuration(duration));
}
```

---

## 🔄 Update System

### Check for Updates

```javascript
async function checkForUpdates() {
  try {
    const response = await fetch('https://api.luckyhub.app/version');
    const { version, downloadUrl, changelog } = await response.json();
    const currentVersion = appVersion;
    
    if (isNewerVersion(version, currentVersion)) {
      // Show update available in titlebar
      document.getElementById('updateBtn').classList.add('has-update');
      
      return { available: true, version, downloadUrl, changelog };
    }
    
    return { available: false };
  } catch (error) {
    console.error('Update check failed:', error);
    return { available: false };
  }
}
```

### Download & Install Update

```javascript
async function downloadAndInstallUpdate() {
  const confirmed = await notify.confirm(
    'Update verfügbar',
    'Eine neue Version ist bereit. Möchtest du herunterladen und installieren?'
  );
  
  if (!confirmed) return;
  
  try {
    notify.info('Download', 'Update wird heruntergeladen...');
    
    // Download update
    const updateData = await checkForUpdates();
    const response = await fetch(updateData.downloadUrl);
    const blob = await response.blob();
    
    // Save to file system (Electron)
    await window.electronAPI.saveUpdate(blob);
    
    notify.success('Update bereit', 'App wird neu gestartet...');
    
    // Schedule restart on quit
    window.electronAPI.scheduleRestart();
    
  } catch (error) {
    notify.error('Update fehlgeschlagen', error.message);
  }
}
```

### Electron Main Process (main.js)

```javascript
// Check for updates
ipcMain.handle('check-updates', async () => {
  // Implement update check logic
});

// Save update file
ipcMain.handle('save-update', async (event, blob) => {
  // Save update file to disk
});

// Schedule restart
ipcMain.handle('schedule-restart', async () => {
  // Set flag to restart after quit
  global.updatePending = true;
});

// Before quit, install update
app.on('before-quit', () => {
  if (global.updatePending) {
    // Install update (Electron auto-updater or manual)
  }
});
```

---

## 🎨 Notification System

### Frontend API

```javascript
// Success notification
notify.success('Erfolg', 'Daten gespeichert');

// Error notification
notify.error('Fehler', 'Verbindung verloren');

// Warning notification
notify.warning('Achtung', 'Session läuft ab');

// Info notification
notify.info('Info', 'Neue Nachricht');

// Confirm dialog (Promise-based)
const confirmed = await notify.confirm(
  'Löschen bestätigen',
  'Möchtest du diesen Eintrag wirklich löschen?'
);
if (confirmed) {
  // User clicked OK
}

// Incoming call
const action = await notify.incomingCall({
  name: 'Max Mustermann',
  discriminator: '1234',
  color: '#10b981',
  isVideo: true
});

// Update available
notify.updateAvailable({
  version: '1.2.0',
  changelog: 'Bug fixes and new features'
});
```

### Backend Notification Trigger (Cloud Function)

```javascript
exports.sendNotification = functions.firestore
  .document('notifications/{notificationId}')
  .onCreate(async (snapshot, context) => {
    const notification = snapshot.data();
    
    // Send push notification via FCM
    const userDoc = await db.collection('users').doc(notification.userId).get();
    const fcmToken = userDoc.data().fcmToken;
    
    if (fcmToken) {
      await admin.messaging().send({
        token: fcmToken,
        notification: {
          title: notification.title,
          body: notification.message
        },
        data: {
          type: notification.type,
          ...notification.data
        }
      });
    }
  });
```

---

## 👥 Creator Role Management

### Becoming a Creator

```javascript
async function applyForCreator() {
  const confirmed = await notify.confirm(
    'Creator werden',
    'Möchtest du dich als Creator bewerben? Dies ermöglicht dir, live zu gehen.'
  );
  
  if (!confirmed) return;
  
  try {
    // Create application
    await db.collection('creatorApplications').add({
      userId: currentUser.id,
      username: currentUser.username,
      status: 'pending',
      appliedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    notify.success('Bewerbung gesendet', 'Wir prüfen deinen Antrag.');
    
    // Notify admins
    sendAdminNotification({
      type: 'creator_application',
      userId: currentUser.id
    });
    
  } catch (error) {
    notify.error('Fehler', 'Bewerbung konnte nicht gesendet werden.');
  }
}
```

### Creator Dashboard (Only Visible for Creators)

```javascript
async function loadCreatorDashboard() {
  const user = await getCurrentUser();
  
  if (user.role !== 'creator') {
    // Show access denied
    notify.error('Kein Zugriff', 'Nur Creator können diese Seite sehen.');
    return;
  }
  
  // Load creator stats
  const streams = await db.collection('streams')
    .where('streamerId', '==', user.id)
    .orderBy('startedAt', 'desc')
    .limit(10)
    .get();
  
  const stats = {
    totalStreams: streams.size,
    totalViewers: 0,
    totalLikes: 0
  };
  
  streams.forEach(doc => {
    const data = doc.data();
    stats.totalViewers += data.peakViewers || 0;
    stats.totalLikes += data.likes || 0;
  });
  
  return stats;
}
```

---

## 📊 Offline Support

### Enable Offline Persistence

```javascript
// Enable offline cache
db.enablePersistence({
  experimentalTabSynchronization: true
}).catch(err => {
  if (err.code == 'failed-precondition') {
    console.log('Multiple tabs open, persistence can only be enabled in one tab');
  } else if (err.code == 'unimplemented') {
    console.log('Persistence not supported by browser');
  }
});

// Listen for online status
window.addEventListener('online', () => {
  notify.success('Online', 'Verbindung wiederhergestellt');
});

window.addEventListener('offline', () => {
  notify.warning('Offline', 'Du bist offline. Änderungen werden synchronisiert, wenn du wieder online bist.');
});
```

---

## 🔒 Security Best Practices

1. **Never expose sensitive data** in client-side code
2. **Validate all inputs** both client and server-side
3. **Use Firestore rules** for authorization
4. **Implement rate limiting** via Cloud Functions
5. **Use HTTPS** for all API calls
6. **Store secrets** in Firebase Config, not in code
7. **Regular security audits** of rules and functions
8. **Monitor usage** with Cloud Monitoring

---

## 🚀 Deployment

### Deploy Firestore Rules

```bash
firebase deploy --only firestore:rules
```

### Deploy Storage Rules

```bash
firebase deploy --only storage:rules
```

### Deploy Cloud Functions

```bash
firebase deploy --only functions
```

### Deploy Hosting

```bash
firebase deploy --only hosting
```
