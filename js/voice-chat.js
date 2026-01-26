  // ========== PUSH-BENACHRICHTIGUNGEN (CALLS) =============
  let messaging = null;
  async function initPushNotifications() {
    if (!window.firebase?.messaging) return;
    try {
      messaging = window.firebase.messaging();
      await messaging.requestPermission?.();
      const token = await messaging.getToken();
      // Token kann im User-Dokument gespeichert werden
      const currentAuth = window.auth;
      const currentDb = window.db;
      if (currentAuth?.currentUser && token && currentDb) {
        await currentDb.collection("users").doc(currentAuth.currentUser.uid).update({ fcmToken: token });
      }
      messaging.onMessage((payload) => {
        // Zeige Notification bei eingehendem Call
        if (payload?.notification) {
          window.notify?.show({
            type: "info",
            title: payload.notification.title,
            message: payload.notification.body,
            duration: 6000
          });
        }
      });
    } catch (e) {
      console.warn("Push-Benachrichtigung konnte nicht aktiviert werden", e);
    }
  }

  // Call: Push senden (Platzhalter, Backend muss FCM nutzen)
  async function sendCallPush(toUid, title, body, data) {
    // Hier mÃ¼sste ein Cloud Function/Backend-Service das FCM-Token holen und Push senden
    // (Demo: Log-Ausgabe)
    console.log("[Push] Sende Call-Push an", toUid, title, body, data);
  }
// js/voice-chat.js â€” echtlucky Voice Integration
// WebRTC + Firebase Signaling fÃ¼r Gruppen-Calls (Direct Calls sind in diesem Projekt derzeit deaktiviert)

/*
==============================
 ANRUF-SYSTEM: KONZEPT & JSON-MODELLE
==============================

Firestore-Struktur fÃ¼r Calls:

// FÃ¼r Gruppen-Calls:
groups/{groupId}/voice-calls/{callId} {
  initiator: <uid>,
  initiatorName: <string>,
  createdAt: <timestamp>,
  participants: [<uid>, ...],
  status: "active" | "ended" | "ringing" | "pending",
  type: "group"
}

// (Hinweis) Direktanrufe (/calls) und users/{uid}/callRequests werden hier nicht genutzt,
// da die aktuellen Firestore Rules diese Schreibpfade nicht freigeben.

// Ablauf (Gruppenanruf):
// 1. Initiator startet Call: status="ringing" im group voice-call Doc
// 2. Andere Mitglieder sehen Modal + Klingelton, kÃ¶nnen annehmen/ablehnen
// 3. Bei Annahme: status="active", Teilnehmer wird zu participants hinzugefÃ¼gt
// 4. Bei Ablehnung: eigener UID wird zu rejectedBy hinzugefÃ¼gt
// 5. Status/Teilnehmer werden in Echtzeit Ã¼berwacht

// Klingelton: Audio-Element, das bei eingehendem Anruf abgespielt wird, bis angenommen/abgelehnt
// Modal: Zeigt Anrufer, Gruppe/Name, Buttons fÃ¼r Annehmen/Ablehnen
*/
// Guard: prevent double-load

(function () {
  "use strict";

  if (window.__ECHTLUCKY_VOICE_CHAT_LOADED__) {
    console.warn("voice-chat.js already loaded â€“ skipping");
    return;
  }
  window.__ECHTLUCKY_VOICE_CHAT_LOADED__ = true;

  const appNS = (window.echtlucky = window.echtlucky || {});
  let auth = null;
  let db = null;
  let firebase = null;

  async function waitForFirebase() {
    return new Promise((resolve) => {
      if (window.firebaseReady && window.auth && window.db) {
        auth = window.auth;
        db = window.db;
        firebase = window.firebase;
        console.log("âœ… voice-chat.js: Firebase ready");
        resolve();
        return;
      }

      const handler = () => {
        auth = window.auth;
        db = window.db;
        firebase = window.firebase;
        console.log("âœ… voice-chat.js: Firebase ready via event");
        resolve();
      };

      window.addEventListener("firebaseReady", handler, { once: true });
      setTimeout(() => resolve(), 5000);
    });
  }


  // ========== INCOMING CALL MODAL & RINGTONE =============
  const incomingCallModal = document.getElementById("incomingCallModal");
  const incomingCallTitle = document.getElementById("incomingCallTitle");
  const incomingCallFrom = document.getElementById("incomingCallFrom");
  const incomingCallGroup = document.getElementById("incomingCallGroup");
  const btnAcceptCall = document.getElementById("btnAcceptCall");
  const btnRejectCall = document.getElementById("btnRejectCall");
  const callRingtone = document.getElementById("callRingtone");

  let activeCallRequest = null;

  function showIncomingCallModal({ fromName, groupName, type }) {
    if (!incomingCallModal) return;
    incomingCallFrom.textContent = fromName || "Unbekannt";
    incomingCallGroup.textContent = type === "group" ? (groupName ? `Gruppe: ${groupName}` : "Gruppenanruf") : "Direktanruf";
    incomingCallModal.style.display = "flex";
    setTimeout(() => incomingCallModal.classList.add("show"), 10);
    if (callRingtone) {
      callRingtone.currentTime = 0;
      callRingtone.play().catch(()=>{});
    }
  }

  function hideIncomingCallModal() {
    if (!incomingCallModal) return;
    incomingCallModal.classList.remove("show");
    setTimeout(() => { incomingCallModal.style.display = "none"; }, 250);
    if (callRingtone) callRingtone.pause();
    activeCallRequest = null;
  }

  if (btnAcceptCall) btnAcceptCall.onclick = async () => {
    if (!activeCallRequest) return;
    const { type, groupId, callId } = activeCallRequest;

    if (type !== "group" || !groupId || !callId) return;

    hideIncomingCallModal();

    try {
      await db.collection("groups").doc(groupId).collection("voice-calls").doc(callId).update({
        status: "active",
        participants: firebase.firestore.FieldValue.arrayUnion(auth.currentUser.uid)
      });
    } catch (e) {
      console.warn("Teilnehmer konnte nicht hinzugefÃ¼gt werden", e);
    }

    window.echtlucky?.voiceChat?.joinCall?.(groupId, callId);
  };
  if (btnRejectCall) btnRejectCall.onclick = async () => {
    if (!activeCallRequest) return;
    const { type, groupId, callId } = activeCallRequest;

    if (type !== "group" || !groupId || !callId) {
      hideIncomingCallModal();
      return;
    }

    try {
      await db.collection("groups").doc(groupId).collection("voice-calls").doc(callId).update({
        rejectedBy: firebase.firestore.FieldValue.arrayUnion(auth.currentUser.uid)
      });
    } catch (e) {
      console.warn("Reject konnte nicht gespeichert werden", e);
    } finally {
      hideIncomingCallModal();
    }
  };

  // ========== LISTEN FOR INCOMING GROUP CALLS =============
  // Firestore Rules in this project only allow group-member reads/writes in /groups/...,
  // so users/{uid}/callRequests and the top-level /calls collection are intentionally not used here.
  let incomingGroupUnsubscribe = null;
  let incomingWatcherTimer = null;
  let watchedGroupId = null;

  function attachIncomingGroupListener(groupId) {
    if (incomingGroupUnsubscribe) {
      incomingGroupUnsubscribe();
      incomingGroupUnsubscribe = null;
    }

    if (!groupId) return;

    const callsRef = db.collection("groups").doc(groupId).collection("voice-calls");

    incomingGroupUnsubscribe = callsRef
      .where("status", "==", "ringing")
      .limit(1)
      .onSnapshot(async (snap) => {
        if (snap.empty) {
          if (activeCallRequest?.type === "group" && activeCallRequest?.groupId === groupId) {
            hideIncomingCallModal();
          }
          return;
        }

        const doc = snap.docs[0];
        const data = doc.data() || {};

        if (!auth?.currentUser?.uid) return;
        const currentUid = auth.currentUser.uid;

        if (data.initiator === currentUid) return;
        if (Array.isArray(data.participants) && data.participants.includes(currentUid)) {
          hideIncomingCallModal();
          return;
        }
        if (Array.isArray(data.rejectedBy) && data.rejectedBy.includes(currentUid)) {
          hideIncomingCallModal();
          return;
        }

        let groupName = "";
        try {
          const groupDoc = await db.collection("groups").doc(groupId).get();
          groupName = groupDoc.exists ? (groupDoc.data()?.name || "Gruppe") : "Gruppe";
        } catch {}

        activeCallRequest = {
          type: "group",
          groupId,
          callId: doc.id
        };

        showIncomingCallModal({
          fromName: data.initiatorName || "Unbekannt",
          groupName,
          type: "group"
        });
      });
  }

  function startIncomingGroupCallWatcher() {
    if (incomingWatcherTimer) return;

    incomingWatcherTimer = setInterval(() => {
      const nextGroupId = window.__ECHTLUCKY_SELECTED_GROUP__ || null;
      if (nextGroupId !== watchedGroupId) {
        watchedGroupId = nextGroupId;
        attachIncomingGroupListener(watchedGroupId);
        refreshVoiceStartLabels().catch(() => {});
      }
    }, 600);
  }

  let initialized = false;

  // ============================================
  // STATE
  // ============================================

  let currentVoiceCall = null; // { groupId, callId, isInitiator }
  let localStream = null;
  let isMicMuted = false;
  let uiCallState = "idle"; // idle | ringing | active | ended
  let callUnsubscribe = null;
  let peerConnections = new Map(); // uid -> RTCPeerConnection
  let remoteStreams = new Map(); // uid -> MediaStream
  let firebaseUnsubscribes = []; // Track listeners for cleanup

  // RTCPeerConnection config with multiple STUN servers
  const peerConfig = {
    iceServers: [
      { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302", "stun:stun2.l.google.com:19302", "stun:stun3.l.google.com:19302", "stun:stun4.l.google.com:19302"] }
    ]
  };

  // ============================================
  // DOM ELEMENTS
  // ============================================

  const voiceStatus = document.getElementById("voiceStatus");
  const voiceParticipants = document.getElementById("voiceParticipants");
  const btnStartVoiceCall = document.getElementById("btnStartVoice");
  const btnStartRingingCall = document.getElementById("btnStartCall");
  const btnEndVoiceCall = document.getElementById("btnEndVoice");
  const btnToggleMic = document.getElementById("btnToggleMic");

  // Check if required elements exist
  const hasRequiredElements = btnStartVoiceCall && btnEndVoiceCall;
  
  if (!hasRequiredElements) {
    console.warn("voice-chat.js: Required DOM elements missing");
  }

  // ============================================
  // CREATE PEER CONNECTION
  // ============================================

  function createPeerConnection(remoteUid) {
    console.log(`Creating peer connection with ${remoteUid}`);
    
    const peerConnection = new RTCPeerConnection(peerConfig);

    // Add local audio tracks
    if (localStream) {
      localStream.getAudioTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
        console.log(`Added local audio track to peer ${remoteUid}`);
      });
    }

    // Handle incoming remote tracks
    peerConnection.ontrack = (event) => {
      console.log("Remote track received from", remoteUid, event.track.kind);
      const remoteStream = event.streams[0];
      remoteStreams.set(remoteUid, remoteStream);
      
      // Create or update audio element for remote user
      let audioElement = document.getElementById(`remote-audio-${remoteUid}`);
      if (!audioElement) {
        audioElement = document.createElement("audio");
        audioElement.id = `remote-audio-${remoteUid}`;
        audioElement.autoplay = true;
        audioElement.playsinline = true;
        audioElement.style.display = "none";
        document.body.appendChild(audioElement);
      }
      
      audioElement.srcObject = remoteStream;
      audioElement.play().catch(e => console.log("Auto-play blocked:", e));
    };

    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate && currentVoiceCall) {
        const groupRef = db.collection("groups").doc(currentVoiceCall.groupId);
        const callRef = groupRef.collection("voice-calls").doc(currentVoiceCall.callId);
        
        callRef.collection("ice-candidates").doc(`${auth.currentUser.uid}-${Date.now()}-${Math.random()}`).set({
          candidate: event.candidate.candidate,
          sdpMLineIndex: event.candidate.sdpMLineIndex,
          sdpMid: event.candidate.sdpMid,
          from: auth.currentUser.uid,
          to: remoteUid,
          createdAt: new Date()
        }).catch(e => console.error("ICE candidate send error:", e));
      }
    };

    // Handle connection state changes
    peerConnection.onconnectionstatechange = () => {
      console.log("Connection state with", remoteUid, ":", peerConnection.connectionState);
      if (peerConnection.connectionState === "failed" || peerConnection.connectionState === "disconnected") {
        closePeerConnection(remoteUid);
        window.notify?.show({
          type: "warn",
          title: "Voice Chat",
          message: `Verbindung mit Teilnehmer unterbrochen`,
          duration: 3000
        });
      }
    };

    // Handle ICE connection state
    peerConnection.oniceconnectionstatechange = () => {
      console.log("ICE connection state with", remoteUid, ":", peerConnection.iceConnectionState);
    };

    peerConnections.set(remoteUid, peerConnection);
    return peerConnection;
  }

  // ============================================
  // CLOSE PEER CONNECTION
  // ============================================

  function closePeerConnection(uid) {
    const peerConnection = peerConnections.get(uid);
    if (peerConnection) {
      peerConnection.close();
      peerConnections.delete(uid);
      console.log(`Closed peer connection with ${uid}`);
    }

    const audioElement = document.getElementById(`remote-audio-${uid}`);
    if (audioElement) {
      audioElement.srcObject = null;
      audioElement.remove();
    }

    remoteStreams.delete(uid);
  }

  // ============================================
  // SIGNALING: Create & Send Offer
  // ============================================

  async function createAndSendOffer(groupId, callId, remoteUid) {
    try {
      if (peerConnections.has(remoteUid)) {
        console.log(`Offer already sent to ${remoteUid}`);
        return;
      }

      const peerConnection = createPeerConnection(remoteUid);
      
      const offer = await peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: false
      });

      await peerConnection.setLocalDescription(offer);
      console.log(`Offer created for ${remoteUid}`);

      // Store offer in Firestore
      const groupRef = db.collection("groups").doc(groupId);
      const callRef = groupRef.collection("voice-calls").doc(callId);
      
      await callRef.collection("offers").doc(remoteUid).set({
        from: auth.currentUser.uid,
        to: remoteUid,
        sdp: offer.sdp,
        createdAt: new Date()
      });

      console.log(`Offer sent to ${remoteUid}`);

    } catch (error) {
      console.error("Offer creation error:", error);
    }
  }

  // ============================================
  // SIGNALING: Listen & Create Answer
  // ============================================

  function listenForOffers(groupId, callId) {
    const groupRef = db.collection("groups").doc(groupId);
    const callRef = groupRef.collection("voice-calls").doc(callId);
    
    const unsubscribe = callRef.collection("offers").where("to", "==", auth.currentUser.uid).onSnapshot(async (snapshot) => {
      for (const doc of snapshot.docs) {
        const { from, sdp } = doc.data();
        
        if (!peerConnections.has(from)) {
          console.log(`Received offer from ${from}`);
          const peerConnection = createPeerConnection(from);
          
          try {
            await peerConnection.setRemoteDescription(
              new RTCSessionDescription({ type: "offer", sdp })
            );

            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);
            console.log(`Answer created for ${from}`);

            // Send answer back
            await callRef.collection("answers").doc(from).set({
              from: auth.currentUser.uid,
              to: from,
              sdp: answer.sdp,
              createdAt: new Date()
            });

            console.log(`Answer sent to ${from}`);

          } catch (error) {
            console.error("Answer creation error:", error);
          }
        }
      }
    });

    firebaseUnsubscribes.push(unsubscribe);
    return unsubscribe;
  }

  // ============================================
  // SIGNALING: Listen for Answers
  // ============================================

  function listenForAnswers(groupId, callId) {
    const groupRef = db.collection("groups").doc(groupId);
    const callRef = groupRef.collection("voice-calls").doc(callId);
    
    const unsubscribe = callRef.collection("answers").where("to", "==", auth.currentUser.uid).onSnapshot(async (snapshot) => {
      for (const doc of snapshot.docs) {
        const { from, sdp } = doc.data();
        const peerConnection = peerConnections.get(from);

        if (peerConnection && peerConnection.remoteDescription === null) {
          console.log(`Received answer from ${from}`);
          try {
            await peerConnection.setRemoteDescription(
              new RTCSessionDescription({ type: "answer", sdp })
            );
            console.log(`Remote description set for ${from}`);
          } catch (error) {
            console.error("Setting remote description error:", error);
          }
        }
      }
    });

    firebaseUnsubscribes.push(unsubscribe);
    return unsubscribe;
  }

  // ============================================
  // ICE CANDIDATES: Listen & Add
  // ============================================

  function listenForIceCandidates(groupId, callId) {
    const groupRef = db.collection("groups").doc(groupId);
    const callRef = groupRef.collection("voice-calls").doc(callId);
    
    const unsubscribe = callRef.collection("ice-candidates").where("to", "==", auth.currentUser.uid).onSnapshot((snapshot) => {
      snapshot.forEach((doc) => {
        const { from, candidate, sdpMLineIndex, sdpMid } = doc.data();
        const peerConnection = peerConnections.get(from);

        if (peerConnection && candidate) {
          try {
            peerConnection.addIceCandidate(
              new RTCIceCandidate({ candidate, sdpMLineIndex, sdpMid })
            );
            console.log(`ICE candidate added from ${from}`);
          } catch (error) {
            console.error("ICE candidate error:", error);
          }
        }
      });
    });

    firebaseUnsubscribes.push(unsubscribe);
    return unsubscribe;
  }

  // ============================================
  // Listen for Users Joining Call (Initiator)
  // ============================================

  function listenForJoiningUsers(groupId, callId) {
    const groupRef = db.collection("groups").doc(groupId);
    const callRef = groupRef.collection("voice-calls").doc(callId);
    
    const unsubscribe = callRef.onSnapshot((snap) => {
      if (!snap.exists) {
        console.log("Call document deleted");
        return;
      }

      const data = snap.data();
      if (data?.status === "ended") {
        window.notify?.show({
          type: "info",
          title: "Anruf",
          message: "Anruf beendet",
          duration: 3000
        });
        endVoiceCall().catch(() => {});
        return;
      }
      if (data?.participants) {
        const newParticipants = data.participants.filter(p => p !== auth.currentUser.uid);
        
        // Create offers for new participants
        newParticipants.forEach(participantUid => {
          if (!peerConnections.has(participantUid)) {
            createAndSendOffer(groupId, callId, participantUid);
          }
        });

        updateParticipantsList(data.participants);
      }
    });

    firebaseUnsubscribes.push(unsubscribe);
    return unsubscribe;
  }

  // ============================================
  // START VOICE CALL (Initiator)
  // ============================================

  async function startRingingGroupCall(groupId) {
    try {
      if (!auth.currentUser) {
        window.notify?.show({
          type: "error",
          title: "Authentifizierung erforderlich",
          message: "Du musst eingeloggt sein",
          duration: 4500
        });
        return;
      }

      if (!groupId) {
        window.notify?.show({
          type: "error",
          title: "Nicht unterstÃ¼tzt",
          message: "Direktanrufe sind aktuell nicht aktiviert. Bitte starte/joine einen Gruppenanruf.",
          duration: 5000
        });
        return;
      }

      if (currentVoiceCall) {
        window.notify?.show({
          type: "warn",
          title: "Voice Chat",
          message: "Beende erst den aktuellen Anruf",
          duration: 3500
        });
        return;
      }

      localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          typingNoiseDetection: true
        },
        video: false
      });

      const callId = `call_${Date.now()}_${auth.currentUser.uid}`;
      const user = auth.currentUser;

      currentVoiceCall = {
        groupId,
        callId,
        isInitiator: true
      };

      await db.collection("groups").doc(groupId).collection("voice-calls").doc(callId).set({
        initiator: user.uid,
        initiatorName: user.displayName || "User",
        createdAt: new Date(),
        participants: [user.uid],
        status: "ringing",
        type: "group",
        rejectedBy: []
      });

      listenForJoiningUsers(groupId, callId);
      listenForOffers(groupId, callId);
      listenForAnswers(groupId, callId);
      listenForIceCandidates(groupId, callId);

      updateVoiceUI(true, "Ruft anâ€¦ (klingelt)", "ringing");

      window.notify?.show({
        type: "info",
        title: "Anruf",
        message: "Anruf gestartet â€“ warte auf Annahme",
        duration: 4500
      });
    } catch (err) {
      console.error("startRingingGroupCall error:", err);
      const errorMsg =
        err.name === "NotAllowedError"
          ? "Mikrofonzugriff verweigert. Bitte erlaube Audiovorbereitung!"
          : err.name === "NotFoundError"
            ? "Kein Mikrofon gefunden. Bitte Ã¼berprÃ¼fe dein GerÃ¤t!"
            : "Fehler beim Starten des Anrufs";

      window.notify?.show({
        type: "error",
        title: "Anruf Fehler",
        message: errorMsg,
        duration: 5000
      });
    }
  }

  async function startVoiceCall(groupId) {
    try {
      if (!auth.currentUser) {
        window.notify?.show({
          type: "error",
          title: "Authentifizierung erforderlich",
          message: "Du musst eingeloggt sein",
          duration: 4500
        });
        return;
      }

      if (currentVoiceCall) {
        window.notify?.show({
          type: "warn",
          title: "Voice Chat",
          message: "Beende erst den aktuellen Anruf",
          duration: 3500
        });
        return;
      }

      // Request microphone
      localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          typingNoiseDetection: true
        },
        video: false
      });

      const callId = `call_${Date.now()}_${auth.currentUser.uid}`;
      const user = auth.currentUser;

      currentVoiceCall = {
        groupId,
        callId,
        isInitiator: true
      };

      // Create call document in Firestore
      await db.collection("groups").doc(groupId).collection("voice-calls").doc(callId).set({
        initiator: user.uid,
        initiatorName: user.displayName || "User",
        createdAt: new Date(),
        participants: [user.uid],
        status: "active"
      });

      // Setup listeners
      listenForJoiningUsers(groupId, callId);
      listenForOffers(groupId, callId);
      listenForAnswers(groupId, callId);
      listenForIceCandidates(groupId, callId);

      // Show voice panel
      updateVoiceUI(true, "Sprachchat aktiv - wartend auf Teilnehmer", "active");

      window.notify?.show({
        type: "success",
        title: "Voice Chat",
        message: "Sprachchat gestartet - andere kÃ¶nnen jetzt beitreten",
        duration: 4500
      });

    } catch (err) {
      console.error("startVoiceCall error:", err);
      const errorMsg = err.name === "NotAllowedError" 
        ? "Mikrofonzugriff verweigert. Bitte erlaube Audiovorbereitung!"
        : err.name === "NotFoundError"
        ? "Kein Mikrofon gefunden. Bitte Ã¼berprÃ¼fe dein GerÃ¤t!"
        : "Fehler beim Starten des Sprachchats";
      
      window.notify?.show({
        type: "error",
        title: "Voice Chat Fehler",
        message: errorMsg,
        duration: 5000
      });
    }
  }

  // ============================================
  // JOIN EXISTING VOICE CALL
  // ============================================

  async function joinVoiceCall(groupId, callId) {
    try {
      if (!auth.currentUser) {
        window.notify?.show({
          type: "error",
          title: "Authentifizierung erforderlich",
          message: "Du musst eingeloggt sein",
          duration: 4500
        });
        return;
      }

      if (currentVoiceCall) {
        window.notify?.show({
          type: "warn",
          title: "Voice Chat",
          message: "Beende erst den aktuellen Anruf",
          duration: 3500
        });
        return;
      }

      // Request microphone
      localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          typingNoiseDetection: true
        },
        video: false
      });

      currentVoiceCall = {
        groupId,
        callId,
        isInitiator: false
      };

      const callRef = db.collection("groups").doc(groupId).collection("voice-calls").doc(callId);

      // Add self to participants
      await callRef.update({
        participants: window.firebase.firestore.FieldValue.arrayUnion(auth.currentUser.uid)
      });

      const callDoc = await callRef.get();
      const existingParticipants = callDoc.data()?.participants || [];

      // Create offers for each existing participant (they will answer)
      for (const participantUid of existingParticipants) {
        if (participantUid !== auth.currentUser.uid) {
          await createAndSendOffer(groupId, callId, participantUid);
        }
      }

      // Setup listeners
      listenForOffers(groupId, callId);
      listenForAnswers(groupId, callId);
      listenForIceCandidates(groupId, callId);

      // Subscribe to participants list (nur fÃ¼r Gruppen sinnvoll)
      if (groupId) {
        callUnsubscribe = callRef.onSnapshot((snap) => {
          const data = snap.data();
          if (data?.participants) {
            updateParticipantsList(data.participants);
            updateVoiceUI(true, `${data.participants.length} Teilnehmer`, "active");
          }
        });
      }

      updateVoiceUI(true, "Sprachchat - Verbindung wird hergestellt", "active");

      window.notify?.show({
        type: "success",
        title: "Voice Chat",
        message: "Sprachchat beigetreten - Verbindung wird hergestellt",
        duration: 4500
      });

    } catch (err) {
      console.error("joinVoiceCall error:", err);
      const errorMsg = err.name === "NotAllowedError" 
        ? "Mikrofonzugriff verweigert"
        : "Fehler beim Beitreten zum Sprachchat";
      
      window.notify?.show({
        type: "error",
        title: "Voice Chat Fehler",
        message: errorMsg,
        duration: 5000
      });
    }
  }

  // ============================================
  // END VOICE CALL
  // ============================================

  async function endVoiceCall() {
    try {
      // Stop all audio tracks
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
      }

      // Close all peer connections
      peerConnections.forEach((pc) => {
        pc.close();
      });
      peerConnections.clear();

      // Clean up remote streams
      remoteStreams.forEach((stream, uid) => {
        const audioElement = document.getElementById(`remote-audio-${uid}`);
        if (audioElement) {
          audioElement.srcObject = null;
          audioElement.remove();
        }
      });
      remoteStreams.clear();

      // Unsubscribe from all Firestore listeners
      firebaseUnsubscribes.forEach(unsub => unsub());
      firebaseUnsubscribes = [];

      if (callUnsubscribe) {
        callUnsubscribe();
        callUnsubscribe = null;
      }

      // Update Firestore: mark ended (initiator) and remove self from call
      if (currentVoiceCall) {
        const groupRef = db.collection("groups").doc(currentVoiceCall.groupId);
        const callRef = groupRef.collection("voice-calls").doc(currentVoiceCall.callId);

        try {
          if (currentVoiceCall.isInitiator) {
            await callRef.update({
              status: "ended",
              endedAt: new Date()
            });
          }

          // Remove participant
          await callRef.update({
            participants: window.firebase.firestore.FieldValue.arrayRemove(auth.currentUser.uid)
          });

          // If initiator, delete entire call and all subcollections
          if (currentVoiceCall.isInitiator) {
            // Clean up offers
            const offerSnap = await callRef.collection("offers").get();
            for (const doc of offerSnap.docs) {
              await doc.ref.delete();
            }

            // Clean up answers
            const answerSnap = await callRef.collection("answers").get();
            for (const doc of answerSnap.docs) {
              await doc.ref.delete();
            }

            // Clean up ICE candidates
            const iceSnap = await callRef.collection("ice-candidates").get();
            for (const doc of iceSnap.docs) {
              await doc.ref.delete();
            }

            // Delete call document
            await callRef.delete();
          }
        } catch (error) {
          console.error("Error updating Firestore:", error);
        }
      }

      currentVoiceCall = null;
      isMicMuted = false;

      // Update UI
      updateVoiceUI(false, undefined, "idle");
      btnToggleMic.classList.remove("is-muted");
      btnToggleMic.textContent = "ðŸŽ¤";

      window.notify?.show({
        type: "success",
        title: "Voice Chat",
        message: "Anruf beendet",
        duration: 3500
      });

    } catch (error) {
      console.error("endVoiceCall error:", error);
    }
  }

  // ============================================
  // UPDATE UI
  // ============================================

  function updateVoiceUI(isActive, statusText, state) {
    if (isActive) {
      if (voiceStatus) voiceStatus.textContent = statusText;
      uiCallState = state || uiCallState || "active";
      if (voiceStatus) voiceStatus.setAttribute("data-state", uiCallState);
      if (btnStartVoiceCall) btnStartVoiceCall.style.display = "none";
      if (btnStartRingingCall) btnStartRingingCall.style.display = "none";
      if (btnEndVoiceCall) btnEndVoiceCall.style.display = "block";
      if (btnToggleMic) btnToggleMic.style.display = "block";
      if (btnToggleMic) btnToggleMic.disabled = false;

      if (btnEndVoiceCall) {
        btnEndVoiceCall.textContent = uiCallState === "ringing" ? "Abbrechen" : "Beenden";
      }
    } else {
      if (voiceStatus) voiceStatus.textContent = "Nicht im Call";
      uiCallState = state || "idle";
      if (voiceStatus) voiceStatus.removeAttribute("data-state");
      if (btnStartVoiceCall) btnStartVoiceCall.style.display = "block";
      if (btnStartRingingCall) btnStartRingingCall.style.display = "block";
      if (btnEndVoiceCall) btnEndVoiceCall.style.display = "none";
      if (btnToggleMic) btnToggleMic.style.display = "none";
      if (btnToggleMic) btnToggleMic.disabled = true;

      if (btnEndVoiceCall) btnEndVoiceCall.textContent = "Beenden";
    }
  }

  async function refreshVoiceStartLabels() {
    if (!btnStartVoiceCall) return;
    if (!db) return;

    const groupId = window.__ECHTLUCKY_SELECTED_GROUP__ || null;
    if (!groupId) {
      btnStartVoiceCall.textContent = "🎤 Voice beitreten";
      return;
    }

    try {
      const callsRef = db.collection("groups").doc(groupId).collection("voice-calls");
      const ringingSnap = await callsRef.where("status", "==", "ringing").limit(1).get();
      if (!ringingSnap.empty) {
        btnStartVoiceCall.textContent = "🎤 Anruf beitreten";
        return;
      }

      const activeSnap = await callsRef.where("status", "==", "active").limit(1).get();
      if (!activeSnap.empty) {
        btnStartVoiceCall.textContent = "🎤 Call beitreten";
        return;
      }

      btnStartVoiceCall.textContent = "🎤 Voice beitreten";
    } catch (_) {
      btnStartVoiceCall.textContent = "🎤 Voice beitreten";
    }
  }

  function updateParticipantsList(participantIds) {
    voiceParticipants.innerHTML = "";
    
    const currentUid = auth.currentUser.uid;
    
    participantIds.forEach(uid => {
      const el = document.createElement("div");
      el.className = "voice-participant";
      el.id = `participant-${uid}`;
      
      const name = uid === currentUid ? "Du" : `User ${uid.slice(0, 6)}`;
      const indicator = uid === currentUid ? "ðŸŽ¤" : "ðŸ‘¤";
      const connectionStatus = peerConnections.has(uid) ? " âœ“" : "";
      
      el.innerHTML = `
        <span class="voice-participant__dot"></span>
        <span>${indicator} ${name}${connectionStatus}</span>
      `;
      voiceParticipants.appendChild(el);
    });
  }

  // ============================================
  // TOGGLE MICROPHONE
  // ============================================

  function toggleMic() {
    if (!localStream) return;

    const audioTracks = localStream.getAudioTracks();
    audioTracks.forEach(track => {
      track.enabled = !track.enabled;
    });

    isMicMuted = !isMicMuted;
    btnToggleMic.classList.toggle("is-muted", isMicMuted);
    btnToggleMic.textContent = isMicMuted ? "ðŸ”Š Entstummen" : "ðŸ”‡ Stummschalten";
  }

  // ============================================
  // EVENT LISTENERS
  // ============================================
  // INITIALIZATION
  // ============================================

  async function initModule() {
    if (initialized) return;
    initialized = true;

    console.log("ðŸ”µ voice-chat.js initializing");
    await waitForFirebase();

    if (!auth || !db) {
      console.error("âŒ voice-chat.js: Firebase not ready");
      return;
    }

    // Setup event listeners if DOM elements exist
    if (btnStartVoiceCall && btnEndVoiceCall) {
      btnStartVoiceCall.addEventListener("click", async () => {
        if (!window.__ECHTLUCKY_SELECTED_GROUP__) {
          window.notify?.show({
            type: "error",
            title: "Keine Gruppe ausgewählt",
            message: "Bitte wähle eine Gruppe aus",
            duration: 4500
          });
          return;
        }

        try {
          const groupId = window.__ECHTLUCKY_SELECTED_GROUP__;

          const callsRef = db.collection("groups").doc(groupId).collection("voice-calls");
          const ringingSnap = await callsRef.where("status", "==", "ringing").limit(1).get();
          if (!ringingSnap.empty) {
            await joinVoiceCall(groupId, ringingSnap.docs[0].id);
            return;
          }

          const activeSnap = await callsRef.where("status", "==", "active").limit(1).get();
          if (!activeSnap.empty) {
            await joinVoiceCall(groupId, activeSnap.docs[0].id);
            return;
          }

          await startVoiceCall(groupId);
        } catch (e) {
          console.error("btnStartVoiceCall click error:", e);
          window.notify?.show({
            type: "error",
            title: "Voice",
            message: "Konnte nicht beitreten/Starten.",
            duration: 4500
          });
        }
      });

      btnEndVoiceCall.addEventListener("click", endVoiceCall);
    }

    if (btnStartRingingCall) {
      btnStartRingingCall.addEventListener("click", () => {
        if (!window.__ECHTLUCKY_SELECTED_GROUP__) {
          window.notify?.show({
            type: "error",
            title: "Keine Gruppe ausgewählt",
            message: "Bitte wähle eine Gruppe aus",
            duration: 4500
          });
          return;
        }
        startRingingGroupCall(window.__ECHTLUCKY_SELECTED_GROUP__);
      });
    }

    if (btnToggleMic) {
      btnToggleMic.addEventListener("click", toggleMic);
    }

    // Start incoming call listener
    startIncomingGroupCallWatcher();
    refreshVoiceStartLabels().catch(() => {});
    // Push-Benachrichtigungen initialisieren
    initPushNotifications();

    // Cleanup on page unload
    window.addEventListener("beforeunload", () => {
      if (currentVoiceCall) {
        endVoiceCall().catch(err => console.error("Cleanup error:", err));
      }
    });

    console.log("âœ… voice-chat.js setup complete");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initModule);
  } else {
    initModule();
  }

  // ============================================
  // EXPORT API
  // ============================================

  appNS.voiceChat = {
    startCall: startVoiceCall,
    joinCall: joinVoiceCall,
    endCall: endVoiceCall,
    isInCall: () => !!currentVoiceCall,
    toggleMic: toggleMic,
    getPeerCount: () => peerConnections.size
  };

  console.log("âœ… voice-chat.js initialized with full WebRTC support");
})();

