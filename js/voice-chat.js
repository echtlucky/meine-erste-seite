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
    // Hier müsste ein Cloud Function/Backend-Service das FCM-Token holen und Push senden
    // (Demo: Log-Ausgabe)
    log("[Push] Sende Call-Push an", toUid, title, body, data);
  }
// js/voice-chat.js — echtlucky Voice Integration
// WebRTC + Firebase Signaling für Gruppen-Calls (Direct Calls sind in diesem Projekt derzeit deaktiviert)

/*
==============================
 ANRUF-SYSTEM: KONZEPT & JSON-MODELLE
==============================

Firestore-Struktur für Calls:

// Für Gruppen-Calls:
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
// 2. Andere Mitglieder sehen Modal + Klingelton, können annehmen/ablehnen
// 3. Bei Annahme: status="active", Teilnehmer wird zu participants hinzugefügt
// 4. Bei Ablehnung: eigener UID wird zu rejectedBy hinzugefügt
// 5. Status/Teilnehmer werden in Echtzeit überwacht

// Klingelton: Audio-Element, das bei eingehendem Anruf abgespielt wird, bis angenommen/abgelehnt
// Modal: Zeigt Anrufer, Gruppe/Name, Buttons für Annehmen/Ablehnen
*/
// Guard: prevent double-load

(function () {
  "use strict";

  const DEBUG = false;
  const log = (...args) => {
    if (DEBUG) console.log(...args);
  };

  if (window.__ECHTLUCKY_VOICE_CHAT_LOADED__) {
    console.warn("voice-chat.js already loaded – skipping");
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
        log("✅ voice-chat.js: Firebase ready");
        resolve();
        return;
      }

      const handler = () => {
        auth = window.auth;
        db = window.db;
        firebase = window.firebase;
        log("✅ voice-chat.js: Firebase ready via event");
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
    incomingCallModal.hidden = false;
    setTimeout(() => incomingCallModal.classList.add("show"), 10);
    if (callRingtone) {
      callRingtone.currentTime = 0;
      callRingtone.play().catch(()=>{});
    }
  }

  function hideIncomingCallModal() {
    if (!incomingCallModal) return;
    incomingCallModal.classList.remove("show");
    setTimeout(() => { incomingCallModal.hidden = true; }, 250);
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
      console.warn("Teilnehmer konnte nicht hinzugefügt werden", e);
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

  function handleSelectedGroupChange(groupId) {
    const nextGroupId = groupId || null;
    if (nextGroupId === watchedGroupId) return;
    watchedGroupId = nextGroupId;
    attachIncomingGroupListener(watchedGroupId);
    refreshVoiceStartLabels().catch(() => {});
  }

  function bindSelectedGroupEvents() {
    window.addEventListener("echtlucky:group-selected", (e) => {
      handleSelectedGroupChange(e?.detail?.groupId || null);
    });
  }

  function getSelectedGroupId() {
    return watchedGroupId || window.__ECHTLUCKY_SELECTED_GROUP__ || null;
  }

  let initialized = false;

  // ============================================
  // STATE
  // ============================================

  let currentVoiceCall = null; // { groupId, callId, isInitiator }
  let localStream = null;
  let processedStream = null;
  let audioContext = null;
  let micSourceNode = null;
  let micGainNode = null;
  let micCompressorNode = null;
  let screenStream = null;
  let screenTrack = null;
  const videoSenders = new Map(); // remoteUid -> RTCRtpSender
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
  const chatCallBar = document.getElementById("chatCallBar");
  const screenShareArea = document.getElementById("screenShareArea");
  const screenShareGrid = document.getElementById("screenShareGrid");
  const btnStartVoiceCall = document.getElementById("btnStartVoice");
  const btnStartRingingCall = null;
  const btnEndVoiceCall = document.getElementById("btnEndVoice");
  const btnToggleMic = document.getElementById("btnToggleMic");
  const btnShareScreen = document.getElementById("btnShareScreen");
  const shareQualitySelect = document.getElementById("shareQuality");

  // Check if required elements exist
  const hasRequiredElements = btnStartVoiceCall && btnEndVoiceCall;
  
  if (!hasRequiredElements) {
    console.warn("voice-chat.js: Required DOM elements missing");
  }

  function isMobileUi() {
    return window.matchMedia ? window.matchMedia("(max-width: 900px)").matches : false;
  }

  function cleanupAudioProcessing() {
    try { micSourceNode?.disconnect(); } catch {}
    try { micCompressorNode?.disconnect(); } catch {}
    try { micGainNode?.disconnect(); } catch {}
    try { audioContext?.close?.(); } catch {}

    micSourceNode = null;
    micCompressorNode = null;
    micGainNode = null;
    audioContext = null;
    processedStream = null;
  }

  function ensureAudioProcessing() {
    if (!localStream) return;
    if (processedStream) return;

    // Desktop speech can sound very quiet on some setups (notably BT “hands-free”).
    // A light compressor + small gain improves intelligibility while avoiding clipping.
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;

      audioContext = new AudioCtx();
      micSourceNode = audioContext.createMediaStreamSource(localStream);
      micCompressorNode = audioContext.createDynamicsCompressor();
      micGainNode = audioContext.createGain();

      micCompressorNode.threshold.value = -24;
      micCompressorNode.knee.value = 24;
      micCompressorNode.ratio.value = 8;
      micCompressorNode.attack.value = 0.003;
      micCompressorNode.release.value = 0.25;

      micGainNode.gain.value = isMobileUi() ? 1.15 : 1.6;

      const dest = audioContext.createMediaStreamDestination();
      micSourceNode.connect(micCompressorNode);
      micCompressorNode.connect(micGainNode);
      micGainNode.connect(dest);

      processedStream = dest.stream;
    } catch (_) {
      cleanupAudioProcessing();
    }
  }

  function getOutgoingStream() {
    ensureAudioProcessing();
    return processedStream || localStream;
  }

  function getSharePreset() {
    const v = String(shareQualitySelect?.value || "1080");
    const h = Number.parseInt(v, 10);
    if (h === 720) return { width: 1280, height: 720, maxBitrate: 2_500_000 };
    if (h === 1440) return { width: 2560, height: 1440, maxBitrate: 6_000_000 };
    return { width: 1920, height: 1080, maxBitrate: 4_000_000 };
  }

  function setVideoSenderBitrate(sender) {
    try {
      const params = sender.getParameters();
      params.encodings = params.encodings || [{}];
      params.encodings[0].maxBitrate = getSharePreset().maxBitrate;
      sender.setParameters(params).catch(() => {});
    } catch {}
  }

  function showScreenShareArea(show) {
    if (!screenShareArea) return;
    screenShareArea.hidden = !show;
  }

  function upsertVideoEl(id, stream, isLocal) {
    if (!screenShareGrid) return;

    let el = document.getElementById(id);
    if (!el) {
      el = document.createElement("video");
      el.id = id;
      el.className = "screen-share-video";
      el.autoplay = true;
      el.playsInline = true;
      el.muted = !!isLocal;
      el.controls = false;
      screenShareGrid.appendChild(el);
    }

    if (el.srcObject !== stream) el.srcObject = stream;
    el.play().catch(() => {});
  }

  function removeVideoEl(id) {
    const el = document.getElementById(id);
    if (!el) return;
    try { el.srcObject = null; } catch {}
    el.remove();
  }

  async function startScreenShare() {
    if (!currentVoiceCall) return;

    try {
      if (!navigator.mediaDevices?.getDisplayMedia) {
        window.notify?.show({
          type: "error",
          title: "Bildschirm teilen",
          message: "Dein Browser unterstützt keine Bildschirmübertragung.",
          duration: 4500
        });
        return;
      }

      const preset = getSharePreset();
      screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          frameRate: 30,
          width: { ideal: preset.width },
          height: { ideal: preset.height }
        },
        audio: false
      });

      screenTrack = screenStream.getVideoTracks()[0] || null;
      if (!screenTrack) return;

      try {
        await screenTrack.applyConstraints({
          width: preset.width,
          height: preset.height,
          frameRate: 30
        });
      } catch {}

      showScreenShareArea(true);
      upsertVideoEl("local-screen-preview", new MediaStream([screenTrack]), true);

      peerConnections.forEach((pc, remoteUid) => {
        const sender = videoSenders.get(remoteUid);
        if (sender) {
          sender.replaceTrack(screenTrack).catch(() => {});
          setVideoSenderBitrate(sender);
        }
      });

      if (btnShareScreen) btnShareScreen.textContent = "🛑 Stop";

      screenTrack.onended = () => {
        stopScreenShare();
      };

      window.notify?.show({
        type: "success",
        title: "Bildschirm teilen",
        message: "Übertragung gestartet.",
        duration: 2500
      });
    } catch (_) {
      window.notify?.show({
        type: "error",
        title: "Bildschirm teilen",
        message: "Konnte nicht starten (Berechtigung abgelehnt?).",
        duration: 4500
      });
    }
  }

  function stopScreenShare() {
    try { screenTrack?.stop?.(); } catch {}
    screenTrack = null;
    screenStream = null;

    peerConnections.forEach((pc, remoteUid) => {
      const sender = videoSenders.get(remoteUid);
      if (sender) sender.replaceTrack(null).catch(() => {});
    });

    removeVideoEl("local-screen-preview");

    if (screenShareGrid && screenShareGrid.querySelectorAll("video").length === 0) {
      showScreenShareArea(false);
    }

    if (btnShareScreen) btnShareScreen.textContent = "🖥️ Teilen";
  }

  // ============================================
  // CREATE PEER CONNECTION
  // ============================================

  function createPeerConnection(remoteUid) {
    log(`Creating peer connection with ${remoteUid}`);
    
    const peerConnection = new RTCPeerConnection(peerConfig);

    // Add local audio tracks (optionally processed)
    const outgoing = getOutgoingStream();
    if (outgoing) {
      outgoing.getAudioTracks().forEach(track => {
        peerConnection.addTrack(track, outgoing);
        log(`Added local audio track to peer ${remoteUid}`);
      });
    }

    // Handle incoming remote tracks
    peerConnection.ontrack = (event) => {
      log("Remote track received from", remoteUid, event.track.kind);
      const remoteStream = event.streams[0];
      remoteStreams.set(remoteUid, remoteStream);
      
      // Create or update audio element for remote user
      let audioElement = document.getElementById(`remote-audio-${remoteUid}`);
      if (!audioElement) {
        audioElement = document.createElement("audio");
        audioElement.id = `remote-audio-${remoteUid}`;
        audioElement.autoplay = true;
        audioElement.playsinline = true;
        audioElement.hidden = true;
        document.body.appendChild(audioElement);
      }
      
      audioElement.srcObject = remoteStream;
      audioElement.play().catch(e => log("Auto-play blocked:", e));
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
      log("Connection state with", remoteUid, ":", peerConnection.connectionState);
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
      log("ICE connection state with", remoteUid, ":", peerConnection.iceConnectionState);
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
      log(`Closed peer connection with ${uid}`);
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
        log(`Offer already sent to ${remoteUid}`);
        return;
      }

      const peerConnection = createPeerConnection(remoteUid);
      
      const offer = await peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: false
      });

      await peerConnection.setLocalDescription(offer);
      log(`Offer created for ${remoteUid}`);

      // Store offer in Firestore
      const groupRef = db.collection("groups").doc(groupId);
      const callRef = groupRef.collection("voice-calls").doc(callId);
      
      await callRef.collection("offers").doc(remoteUid).set({
        from: auth.currentUser.uid,
        to: remoteUid,
        sdp: offer.sdp,
        createdAt: new Date()
      });

      log(`Offer sent to ${remoteUid}`);

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
          log(`Received offer from ${from}`);
          const peerConnection = createPeerConnection(from);
          
          try {
            await peerConnection.setRemoteDescription(
              new RTCSessionDescription({ type: "offer", sdp })
            );

            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);
            log(`Answer created for ${from}`);

            // Send answer back
            await callRef.collection("answers").doc(from).set({
              from: auth.currentUser.uid,
              to: from,
              sdp: answer.sdp,
              createdAt: new Date()
            });

            log(`Answer sent to ${from}`);

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
          log(`Received answer from ${from}`);
          try {
            await peerConnection.setRemoteDescription(
              new RTCSessionDescription({ type: "answer", sdp })
            );
            log(`Remote description set for ${from}`);
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
            log(`ICE candidate added from ${from}`);
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
        log("Call document deleted");
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
          title: "Nicht unterstützt",
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
      cleanupAudioProcessing();
      ensureAudioProcessing();

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

      updateVoiceUI(true, "Ruft an… (klingelt)", "ringing");

      window.notify?.show({
        type: "info",
        title: "Anruf",
        message: "Anruf gestartet – warte auf Annahme",
        duration: 4500
      });
    } catch (err) {
      console.error("startRingingGroupCall error:", err);
      const errorMsg =
        err.name === "NotAllowedError"
          ? "Mikrofonzugriff verweigert. Bitte erlaube Audiovorbereitung!"
          : err.name === "NotFoundError"
            ? "Kein Mikrofon gefunden. Bitte überprüfe dein Gerät!"
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
      cleanupAudioProcessing();
      ensureAudioProcessing();

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
        message: "Sprachchat gestartet - andere können jetzt beitreten",
        duration: 4500
      });

    } catch (err) {
      console.error("startVoiceCall error:", err);
      const errorMsg = err.name === "NotAllowedError" 
        ? "Mikrofonzugriff verweigert. Bitte erlaube Audiovorbereitung!"
        : err.name === "NotFoundError"
        ? "Kein Mikrofon gefunden. Bitte überprüfe dein Gerät!"
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
      cleanupAudioProcessing();
      ensureAudioProcessing();

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

      // Subscribe to participants list (nur für Gruppen sinnvoll)
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
      cleanupAudioProcessing();

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
      btnToggleMic.textContent = "🔇 Stummschalten";

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
      if (chatCallBar) chatCallBar.hidden = false;
      if (btnStartVoiceCall) btnStartVoiceCall.hidden = true;
      // Start-call button is handled in the chat header (connect-minimal), not here.
      if (btnEndVoiceCall) btnEndVoiceCall.hidden = false;
      if (btnToggleMic) btnToggleMic.hidden = false;
      if (btnToggleMic) btnToggleMic.disabled = false;

      if (btnEndVoiceCall) {
        btnEndVoiceCall.textContent = uiCallState === "ringing" ? "Abbrechen" : "Beenden";
      }
    } else {
      if (voiceStatus) voiceStatus.textContent = "Nicht im Call";
      uiCallState = state || "idle";
      if (voiceStatus) voiceStatus.removeAttribute("data-state");
      if (chatCallBar) chatCallBar.hidden = true;
      if (btnStartVoiceCall) btnStartVoiceCall.hidden = false;
      // Start-call button is handled in the chat header (connect-minimal), not here.
      if (btnEndVoiceCall) btnEndVoiceCall.hidden = true;
      if (btnToggleMic) btnToggleMic.hidden = true;
      if (btnToggleMic) btnToggleMic.disabled = true;

      if (btnEndVoiceCall) btnEndVoiceCall.textContent = "Beenden";
    }
  }

  async function refreshVoiceStartLabels() {
    if (!btnStartVoiceCall) return;
    if (!db) return;

    const groupId = getSelectedGroupId();
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
      const indicator = uid === currentUid ? "🎤" : "👤";
      const connectionStatus = peerConnections.has(uid) ? " ✓" : "";
      
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
    btnToggleMic.textContent = isMicMuted ? "🔊 Entstummen" : "🔇 Stummschalten";
  }

  // ============================================
  // EVENT LISTENERS
  // ============================================
  // INITIALIZATION
  // ============================================

  async function initModule() {
    if (initialized) return;
    initialized = true;

    log("🔵 voice-chat.js initializing");
    await waitForFirebase();

    if (!auth || !db) {
      console.error("❌ voice-chat.js: Firebase not ready");
      return;
    }

    // Setup event listeners if DOM elements exist
    if (btnStartVoiceCall && btnEndVoiceCall) {
      btnStartVoiceCall.addEventListener("click", async () => {
        if (!getSelectedGroupId()) {
          window.notify?.show({
            type: "error",
            title: "Keine Gruppe ausgewählt",
            message: "Bitte wähle eine Gruppe aus",
            duration: 4500
          });
          return;
        }

        try {
          const groupId = getSelectedGroupId();
          if (!groupId) return;

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

    // Start-call is triggered via chat header button (#btnStartCall) and handled in connect-minimal.

    if (btnToggleMic) {
      btnToggleMic.addEventListener("click", toggleMic);
    }

    // Incoming calls + labels: event-driven (no polling)
    bindSelectedGroupEvents();
    handleSelectedGroupChange(getSelectedGroupId());
    // Push-Benachrichtigungen initialisieren
    initPushNotifications();

    // Cleanup on page unload
    window.addEventListener("beforeunload", () => {
      if (currentVoiceCall) {
        endVoiceCall().catch(err => console.error("Cleanup error:", err));
      }
    });

    log("✅ voice-chat.js setup complete");
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
    startRingingCall: startRingingGroupCall,
    joinCall: joinVoiceCall,
    endCall: endVoiceCall,
    isInCall: () => !!currentVoiceCall,
    toggleMic: toggleMic,
    getPeerCount: () => peerConnections.size
  };

  log("✅ voice-chat.js initialized with full WebRTC support");
})();


