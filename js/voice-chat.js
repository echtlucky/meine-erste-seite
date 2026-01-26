// js/voice-chat.js — echtlucky Voice Integration
// WebRTC + Firebase Signaling für Group Voice Calls
// Guard: prevent double-load

(function () {
  "use strict";

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
        console.log("✅ voice-chat.js: Firebase ready");
        resolve();
        return;
      }

      const handler = () => {
        auth = window.auth;
        db = window.db;
        firebase = window.firebase;
        console.log("✅ voice-chat.js: Firebase ready via event");
        resolve();
      };

      window.addEventListener("firebaseReady", handler, { once: true });
      setTimeout(() => resolve(), 5000);
    });
  }

  let initialized = false;

  // ============================================
  // STATE
  // ============================================

  let currentVoiceCall = null; // { groupId, callId, isInitiator }
  let localStream = null;
  let isMicMuted = false;
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

  const voiceCallPanel = null; // Not used in new layout
  const voiceStatus = document.getElementById("voiceStatus");
  const voiceParticipants = document.getElementById("voiceParticipants");
  const btnStartVoiceCall = document.getElementById("btnStartVoice");
  const btnEndVoiceCall = document.getElementById("btnEndVoice");
  const btnToggleMic = document.getElementById("btnToggleMic");

  if (!btnStartVoiceCall || !btnEndVoiceCall) {
    console.warn("voice-chat.js: DOM elements missing – voice-chat skipped.");
    return;
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
      updateVoiceUI(true, "Sprachchat aktiv - wartend auf Teilnehmer");

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

      // Get existing participants
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

      // Subscribe to participants list
      callUnsubscribe = callRef.onSnapshot((snap) => {
        const data = snap.data();
        if (data?.participants) {
          updateParticipantsList(data.participants);
          updateVoiceUI(true, `${data.participants.length} Teilnehmer`);
        }
      });

      updateVoiceUI(true, "Sprachchat - Verbindung wird hergestellt");

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

      // Update Firestore: Remove self from call or delete call
      if (currentVoiceCall) {
        const groupRef = db.collection("groups").doc(currentVoiceCall.groupId);
        const callRef = groupRef.collection("voice-calls").doc(currentVoiceCall.callId);

        try {
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
      updateVoiceUI(false);
      btnToggleMic.classList.remove("is-muted");
      btnToggleMic.textContent = "🎤";

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

  function updateVoiceUI(isActive, statusText) {
    if (isActive) {
      if (voiceStatus) voiceStatus.textContent = statusText;
      if (btnStartVoiceCall) btnStartVoiceCall.style.display = "none";
      if (btnEndVoiceCall) btnEndVoiceCall.style.display = "block";
      if (btnToggleMic) btnToggleMic.style.display = "block";
    } else {
      if (voiceStatus) voiceStatus.textContent = "Not in a call";
      if (btnStartVoiceCall) btnStartVoiceCall.style.display = "block";
      if (btnEndVoiceCall) btnEndVoiceCall.style.display = "none";
      if (btnToggleMic) btnToggleMic.style.display = "none";
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
    btnToggleMic.textContent = isMicMuted ? "🔇 Unmute" : "🎤 Mute";
  }

  // ============================================
  // EVENT LISTENERS
  // ============================================
  // INITIALIZATION
  // ============================================

  async function initModule() {
    if (initialized) return;
    initialized = true;

    console.log("🔵 voice-chat.js initializing");
    await waitForFirebase();

    if (!auth || !db) {
      console.error("❌ voice-chat.js: Firebase not ready");
      return;
    }

    console.log("✅ voice-chat.js setup complete");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initModule);
  } else {
    initModule();
  }

  // ============================================
  // EVENT LISTENERS
  // ============================================

  btnStartVoiceCall.addEventListener("click", () => {
    if (!window.__ECHTLUCKY_SELECTED_GROUP__) {
      window.notify?.show({
        type: "error",
        title: "Keine Gruppe ausgewählt",
        message: "Bitte wähle eine Gruppe aus",
        duration: 4500
      });
      return;
    }
    startVoiceCall(window.__ECHTLUCKY_SELECTED_GROUP__);
  });

  btnEndVoiceCall.addEventListener("click", endVoiceCall);

  if (btnToggleMic) {
    btnToggleMic.addEventListener("click", toggleMic);
  }

  // Cleanup on page unload
  window.addEventListener("beforeunload", () => {
    if (currentVoiceCall) {
      endVoiceCall();
    }
  });

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

  console.log("✅ voice-chat.js initialized with full WebRTC support");
})();
