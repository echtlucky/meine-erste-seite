(function () {
  "use strict";

  if (window.__ECHTLUCKY_VOICE_CHAT_LOADED__) return;
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
        resolve();
        return;
      }

      const handler = () => {
        auth = window.auth;
        db = window.db;
        firebase = window.firebase;
        resolve();
      };

      window.addEventListener("firebaseReady", handler, { once: true });
      setTimeout(() => resolve(), 5000);
    });
  }


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

    hideIncomingCallModal();

    try {
      if (!auth?.currentUser?.uid) return;
      if (!callId) return;

      if (type === "group") {
        if (!groupId) return;
        await db.collection("groups").doc(groupId).collection("voice-calls").doc(callId).update({
          status: "active",
          participants: firebase.firestore.FieldValue.arrayUnion(auth.currentUser.uid)
        });
        window.echtlucky?.voiceChat?.joinCall?.(groupId, callId);
        return;
      }

      if (type === "direct") {
        await db.collection("direct-calls").doc(callId).set({
          status: "active",
          participants: firebase.firestore.FieldValue.arrayUnion(auth.currentUser.uid),
          acceptedAt: new Date()
        }, { merge: true });
        window.echtlucky?.voiceChat?.joinDirectCall?.(callId);
        return;
      }
    } catch (e) {
    }
  };
  if (btnRejectCall) btnRejectCall.onclick = async () => {
    if (!activeCallRequest) return;
    const { type, groupId, callId } = activeCallRequest;

    try {
      if (!auth?.currentUser?.uid) return;
      if (!callId) return;

      if (type === "group") {
        if (!groupId) return;
        await db.collection("groups").doc(groupId).collection("voice-calls").doc(callId).update({
          rejectedBy: firebase.firestore.FieldValue.arrayUnion(auth.currentUser.uid)
        });
        return;
      }

      if (type === "direct") {
        await db.collection("direct-calls").doc(callId).set({
          status: "ended",
          endedAt: new Date(),
          rejectedBy: firebase.firestore.FieldValue.arrayUnion(auth.currentUser.uid)
        }, { merge: true });
        return;
      }
    } catch (e) {
    } finally {
      hideIncomingCallModal();
    }
  };

  let incomingGroupUnsubscribe = null;
  let incomingDirectUnsubscribe = null;
  let watchedGroupId = null;

  function detachIncomingDirectListener() {
    if (incomingDirectUnsubscribe) {
      incomingDirectUnsubscribe();
      incomingDirectUnsubscribe = null;
    }
  }

  function attachIncomingGroupListener(groupId) {
    if (incomingGroupUnsubscribe) {
      incomingGroupUnsubscribe();
      incomingGroupUnsubscribe = null;
    }

    if (!groupId) return;
    if (!auth?.currentUser?.uid) return;

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

  function attachIncomingDirectListener() {
    detachIncomingDirectListener();
    if (!db || !auth?.currentUser?.uid) return;

    const myUid = auth.currentUser.uid;
    incomingDirectUnsubscribe = db
      .collection("direct-calls")
      .where("status", "==", "ringing")
      .where("to", "==", myUid)
      .limit(1)
      .onSnapshot((snap) => {
        if (snap.empty) {
          if (activeCallRequest?.type === "direct") hideIncomingCallModal();
          return;
        }

        const doc = snap.docs[0];
        const data = doc.data() || {};

        if (!auth?.currentUser?.uid) return;
        if (data.initiator === myUid) return;
        if (Array.isArray(data.rejectedBy) && data.rejectedBy.includes(myUid)) return;
        if (Array.isArray(data.participants) && data.participants.includes(myUid)) return;

        activeCallRequest = { type: "direct", callId: doc.id };
        showIncomingCallModal({
          fromName: data.initiatorName || "Unbekannt",
          groupName: "",
          type: "direct"
        });
      });
  }

  function handleSelectedGroupChange(groupId) {
    if (!auth?.currentUser?.uid) {
      if (incomingGroupUnsubscribe) {
        incomingGroupUnsubscribe();
        incomingGroupUnsubscribe = null;
      }
      watchedGroupId = null;
      return;
    }
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


  const CALL_KIND_GROUP = "group";
  const CALL_KIND_DIRECT = "direct";

  let currentVoiceCall = null; // { kind: "group"|"direct", groupId?, callId, peerUid?, isInitiator }
  let localStream = null;
  let processedStream = null;
  let audioContext = null;
  let micSourceNode = null;
  let micGainNode = null;
  let micCompressorNode = null;
  let screenStream = null;
  let screenTrack = null;
  let screenAudioSourceNode = null;
  let screenShareDismissed = false;
  let screenShareInFlight = false;
  let btnOpenScreenShare = null;
  const videoSenders = new Map(); // remoteUid -> RTCRtpSender
  let isMicMuted = false;
  let uiCallState = "idle"; // idle | ringing | in_call | ended
  let callUnsubscribe = null;
  let peerConnections = new Map(); // uid -> RTCPeerConnection
  let remoteStreams = new Map(); // uid -> MediaStream
  let firebaseUnsubscribes = []; // Track listeners for cleanup

  const peerConfig = {
    iceServers: [
      { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302", "stun:stun2.l.google.com:19302", "stun:stun3.l.google.com:19302", "stun:stun4.l.google.com:19302"] }
    ]
  };


  const voiceStatus = document.getElementById("voiceStatus");
  const voiceParticipants = document.getElementById("voiceParticipants");
  const chatCallBar = document.getElementById("chatCallBar");
  const screenShareArea = document.getElementById("screenShareArea");
  const screenShareGrid = document.getElementById("screenShareGrid");
  const btnCloseScreenShare = document.getElementById("btnCloseScreenShare");
  const btnStartVoiceCall = document.getElementById("btnStartVoice");
  const btnStartRingingCall = null;
  const btnEndVoiceCall = document.getElementById("btnEndVoice");
  const btnToggleMic = document.getElementById("btnToggleMic");
  const btnShareScreen = document.getElementById("btnShareScreen");
  const shareQualitySelect = document.getElementById("shareQuality");

  const hasRequiredElements = btnStartVoiceCall && btnEndVoiceCall;
  
  if (!hasRequiredElements) return;

  function isMobileUi() {
    return window.matchMedia ? window.matchMedia("(max-width: 900px)").matches : false;
  }

  const AUDIO_INPUT_KEY = "echtlucky:audioInputDeviceId";
  const AUDIO_OUTPUT_KEY = "echtlucky:audioOutputDeviceId";
  const MIC_GAIN_KEY = "echtlucky:micGain";

  function getGroupCallRef(groupId, callId) {
    return db.collection("groups").doc(groupId).collection("voice-calls").doc(callId);
  }

  function getDirectCallRef(callId) {
    return db.collection("direct-calls").doc(callId);
  }

  function getCallRefFromActiveCall() {
    if (!currentVoiceCall) return null;
    if (currentVoiceCall.kind === CALL_KIND_DIRECT) return getDirectCallRef(currentVoiceCall.callId);
    if (!currentVoiceCall.groupId) return null;
    return getGroupCallRef(currentVoiceCall.groupId, currentVoiceCall.callId);
  }

  function uiStateFromStatus(status) {
    if (status === "ringing") return "ringing";
    if (status === "active") return "in_call";
    if (status === "ended") return "ended";
    return "idle";
  }

  function callLabel(kind) {
    return kind === CALL_KIND_DIRECT ? "Direktanruf" : "Gruppenanruf";
  }

  function clampNumber(value, min, max) {
    const v = Number(value);
    if (!Number.isFinite(v)) return min;
    return Math.min(max, Math.max(min, v));
  }

  function getStoredNumber(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (raw == null || raw === "") return fallback;
      const v = Number.parseFloat(raw);
      return Number.isFinite(v) ? v : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function getStoredDeviceId(key) {
    try {
      return localStorage.getItem(key) || "";
    } catch (_) {
      return "";
    }
  }

  function buildAudioConstraints() {
    const base = {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      typingNoiseDetection: true
    };

    const deviceId = getStoredDeviceId(AUDIO_INPUT_KEY);
    if (!deviceId) return base;

    return { ...base, deviceId: { ideal: deviceId } };
  }

  function applyPreferredOutputDevice(audioEl) {
    const deviceId = getStoredDeviceId(AUDIO_OUTPUT_KEY);
    if (!deviceId) return;
    if (!audioEl || typeof audioEl.setSinkId !== "function") return;

    audioEl.setSinkId(deviceId).catch(() => {});
  }

  function cleanupAudioProcessing() {
    try { micSourceNode?.disconnect(); } catch {}
    try { micCompressorNode?.disconnect(); } catch {}
    try { micGainNode?.disconnect(); } catch {}
    try { screenAudioSourceNode?.disconnect?.(); } catch {}
    try { audioContext?.close?.(); } catch {}

    micSourceNode = null;
    micCompressorNode = null;
    micGainNode = null;
    audioContext = null;
    processedStream = null;
    screenAudioSourceNode = null;
  }

  function ensureAudioProcessing() {
    if (!localStream) return;
    if (processedStream) return;

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

      const defaultGain = isMobileUi() ? 1.15 : 1.6;
      const preferredGain = clampNumber(getStoredNumber(MIC_GAIN_KEY, defaultGain), 0.8, 2.2);
      micGainNode.gain.value = preferredGain;

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

  function getMicGain() {
    const defaultGain = isMobileUi() ? 1.15 : 1.6;
    return clampNumber(micGainNode?.gain?.value ?? getStoredNumber(MIC_GAIN_KEY, defaultGain), 0.8, 2.2);
  }

  function setMicGain(value) {
    const next = clampNumber(value, 0.8, 2.2);
    try {
      localStorage.setItem(MIC_GAIN_KEY, String(next));
    } catch (_) {}

    try {
      ensureAudioProcessing();
      if (micGainNode) micGainNode.gain.value = next;
    } catch (_) {}

    return next;
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
    if (show) {
      try { btnCloseScreenShare?.focus?.(); } catch {}
    }

    updateOpenScreenShareButton();
  }

  async function applyTrackConstraintsSafe(track, constraints, timeoutMs) {
    if (!track?.applyConstraints) return;
    const ms = Number(timeoutMs || 0) || 0;
    try {
      if (ms <= 0) {
        await track.applyConstraints(constraints);
        return;
      }
      await Promise.race([
        track.applyConstraints(constraints),
        new Promise((resolve) => setTimeout(resolve, ms))
      ]);
    } catch (_) {}
  }

  function ensureOpenScreenShareButton() {
    if (btnOpenScreenShare) return btnOpenScreenShare;
    if (!chatCallBar) return null;
    if (!btnShareScreen) return null;

    const actions = chatCallBar.querySelector(".chat-call-bar__actions");
    if (!actions) return null;

    const existing = actions.querySelector("#btnOpenScreenShare");
    if (existing) {
      btnOpenScreenShare = existing;
      return btnOpenScreenShare;
    }

    const btn = document.createElement("button");
    btn.id = "btnOpenScreenShare";
    btn.type = "button";
    btn.className = "btn btn-secondary";
    btn.textContent = "📺 Ansehen";
    btn.hidden = true;

    actions.insertBefore(btn, btnShareScreen);
    btnOpenScreenShare = btn;
    return btnOpenScreenShare;
  }

  function updateOpenScreenShareButton() {
    const btn = ensureOpenScreenShareButton();
    if (!btn) return;

    const hasAnyVideo = !!screenShareGrid?.querySelector("video");
    const isHidden = !!screenShareArea?.hidden;
    btn.hidden = !(hasAnyVideo && isHidden);
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
    updateOpenScreenShareButton();
  }

  async function startScreenShare() {
    if (!currentVoiceCall) return;
    if (screenShareInFlight) return;
    if (screenTrack) return;

    try {
      screenShareInFlight = true;
      if (btnShareScreen) btnShareScreen.disabled = true;
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
      try {
        screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            frameRate: 30,
            width: { ideal: preset.width },
            height: { ideal: preset.height }
          },
          audio: true
        });
      } catch (_) {
        screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            frameRate: 30,
            width: { ideal: preset.width },
            height: { ideal: preset.height }
          },
          audio: false
        });
      }

      screenTrack = screenStream.getVideoTracks()[0] || null;
      if (!screenTrack) return;

      try { screenTrack.contentHint = "detail"; } catch {}

      try {
        await applyTrackConstraintsSafe(
          screenTrack,
          { width: preset.width, height: preset.height, frameRate: 30 },
          900
        );
      } catch {}

      const displayAudioTrack = screenStream.getAudioTracks()?.[0] || null;
      if (displayAudioTrack) {
        ensureAudioProcessing();
        try { await audioContext?.resume?.(); } catch {}

        if (audioContext && micCompressorNode) {
          try {
            screenAudioSourceNode?.disconnect?.();
          } catch {}
          try {
            const displayAudioStream = new MediaStream([displayAudioTrack]);
            screenAudioSourceNode = audioContext.createMediaStreamSource(displayAudioStream);
            screenAudioSourceNode.connect(micCompressorNode);
          } catch (_) {
            try { displayAudioTrack.stop(); } catch {}
            screenAudioSourceNode = null;
          }
        } else {
          try { displayAudioTrack.stop(); } catch {}
        }
      }

      showScreenShareArea(true);
      screenShareDismissed = false;
      upsertVideoEl("local-screen-preview", new MediaStream([screenTrack]), true);
      updateOpenScreenShareButton();

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
    } finally {
      screenShareInFlight = false;
      if (btnShareScreen) btnShareScreen.disabled = false;
    }
  }

  function stopScreenShare() {
    try { screenStream?.getTracks?.().forEach((t) => t.stop()); } catch {}
    screenTrack = null;
    try { screenAudioSourceNode?.disconnect?.(); } catch {}
    screenAudioSourceNode = null;
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
    updateOpenScreenShareButton();
  }


  function createPeerConnection(remoteUid) {
    
    const peerConnection = new RTCPeerConnection(peerConfig);

    try {
      const videoTransceiver = peerConnection.addTransceiver("video", { direction: "sendrecv" });
      if (videoTransceiver?.sender) {
        videoSenders.set(remoteUid, videoTransceiver.sender);
        setVideoSenderBitrate(videoTransceiver.sender);
        if (screenTrack) {
          videoTransceiver.sender.replaceTrack(screenTrack).catch(() => {});
        }
      }
    } catch {}

    const outgoing = getOutgoingStream();
    if (outgoing) {
      outgoing.getAudioTracks().forEach(track => {
        peerConnection.addTrack(track, outgoing);
      });
    }

    peerConnection.ontrack = (event) => {
      const remoteStream = event.streams[0];
      remoteStreams.set(remoteUid, remoteStream);

      if (event.track.kind === "video") {
        if (!screenShareDismissed) showScreenShareArea(true);
        upsertVideoEl(`remote-screen-${remoteUid}`, new MediaStream([event.track]), false);
        updateOpenScreenShareButton();
        event.track.onended = () => {
          removeVideoEl(`remote-screen-${remoteUid}`);
          if (screenShareGrid && screenShareGrid.querySelectorAll("video").length === 0) {
            showScreenShareArea(false);
          }
        };
        return;
      }
      
      let audioElement = document.getElementById(`remote-audio-${remoteUid}`);
      if (!audioElement) {
        audioElement = document.createElement("audio");
        audioElement.id = `remote-audio-${remoteUid}`;
        audioElement.autoplay = true;
        audioElement.playsinline = true;
        audioElement.hidden = true;
        audioElement.volume = 0.65;
        audioElement.dataset.baseVolume = "0.65";
        document.body.appendChild(audioElement);
      }
      
      applyPreferredOutputDevice(audioElement);
      audioElement.srcObject = remoteStream;
      audioElement.play().catch(() => {});
    };

    peerConnection.onicecandidate = (event) => {
      if (event.candidate && currentVoiceCall) {
        const callRef = getCallRefFromActiveCall();
        if (!callRef || !auth?.currentUser?.uid) return;

        callRef.collection("ice-candidates").doc(`${auth.currentUser.uid}-${Date.now()}-${Math.random()}`).set({
          candidate: event.candidate.candidate,
          sdpMLineIndex: event.candidate.sdpMLineIndex,
          sdpMid: event.candidate.sdpMid,
          from: auth.currentUser.uid,
          to: remoteUid,
          createdAt: new Date()
        }).catch(() => {});
      }
    };

    peerConnection.onconnectionstatechange = () => {
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

    peerConnections.set(remoteUid, peerConnection);
    return peerConnection;
  }


  function closePeerConnection(uid) {
    const peerConnection = peerConnections.get(uid);
    if (peerConnection) {
      peerConnection.close();
      peerConnections.delete(uid);
    }

    const audioElement = document.getElementById(`remote-audio-${uid}`);
    if (audioElement) {
      audioElement.srcObject = null;
      audioElement.remove();
    }

    removeVideoEl(`remote-screen-${uid}`);
    videoSenders.delete(uid);
    if (screenShareGrid && screenShareGrid.querySelectorAll("video").length === 0) {
      showScreenShareArea(false);
    }

    remoteStreams.delete(uid);
  }


  async function createAndSendOffer(callRef, remoteUid) {
    try {
      if (peerConnections.has(remoteUid)) {
        return;
      }

      if (!callRef) return;
      const peerConnection = createPeerConnection(remoteUid);
      
      const offer = await peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      });

      await peerConnection.setLocalDescription(offer);

      await callRef.collection("offers").doc(remoteUid).set({
        from: auth.currentUser.uid,
        to: remoteUid,
        sdp: offer.sdp,
        createdAt: new Date()
      });


    } catch (error) {
    }
  }


  function listenForOffers(callRef) {
    if (!callRef) return () => {};
    const unsubscribe = callRef.collection("offers").where("to", "==", auth.currentUser.uid).onSnapshot(async (snapshot) => {
      for (const doc of snapshot.docs) {
        const { from, sdp } = doc.data();
        
        if (!peerConnections.has(from)) {
          const peerConnection = createPeerConnection(from);
          
          try {
            await peerConnection.setRemoteDescription(
              new RTCSessionDescription({ type: "offer", sdp })
            );

            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);

            await callRef.collection("answers").doc(from).set({
              from: auth.currentUser.uid,
              to: from,
              sdp: answer.sdp,
              createdAt: new Date()
            });


          } catch (error) {
          }
        }
      }
    });

    firebaseUnsubscribes.push(unsubscribe);
    return unsubscribe;
  }


  function listenForAnswers(callRef) {
    if (!callRef) return () => {};
    const unsubscribe = callRef.collection("answers").where("to", "==", auth.currentUser.uid).onSnapshot(async (snapshot) => {
      for (const doc of snapshot.docs) {
        const { from, sdp } = doc.data();
        const peerConnection = peerConnections.get(from);

        if (peerConnection && peerConnection.remoteDescription === null) {
          try {
            await peerConnection.setRemoteDescription(
              new RTCSessionDescription({ type: "answer", sdp })
            );
          } catch (error) {
          }
        }
      }
    });

    firebaseUnsubscribes.push(unsubscribe);
    return unsubscribe;
  }


  function listenForIceCandidates(callRef) {
    if (!callRef) return () => {};
    const unsubscribe = callRef.collection("ice-candidates").where("to", "==", auth.currentUser.uid).onSnapshot((snapshot) => {
      snapshot.forEach((doc) => {
        const { from, candidate, sdpMLineIndex, sdpMid } = doc.data();
        const peerConnection = peerConnections.get(from);

        if (peerConnection && candidate) {
          try {
            peerConnection.addIceCandidate(
              new RTCIceCandidate({ candidate, sdpMLineIndex, sdpMid })
            );
          } catch (error) {
          }
        }
      });
    });

    firebaseUnsubscribes.push(unsubscribe);
    return unsubscribe;
  }


  function subscribeToCallDoc(callRef, kind) {
    if (!callRef) return () => {};
    const unsubscribe = callRef.onSnapshot((snap) => {
      if (!snap.exists) {
        endVoiceCall().catch(() => {});
        return;
      }

      const data = snap.data() || {};
      const status = String(data.status || "");
      const participants = Array.isArray(data.participants) ? data.participants : [];

      if (
        kind === CALL_KIND_DIRECT &&
        currentVoiceCall &&
        currentVoiceCall.kind === CALL_KIND_DIRECT &&
        currentVoiceCall.callId === callRef.id &&
        auth?.currentUser?.uid
      ) {
        const myUid = auth.currentUser.uid;
        const initiatorUid = String(data.initiator || "").trim();
        const toUid = String(data.to || "").trim();

        const isInitiator = initiatorUid && initiatorUid === myUid;
        if (isInitiator) currentVoiceCall.isInitiator = true;

        const peerUid = String(currentVoiceCall.peerUid || (isInitiator ? toUid : initiatorUid) || "").trim();
        if (peerUid) currentVoiceCall.peerUid = peerUid;

        if (status === "active" && currentVoiceCall.isInitiator && peerUid && participants.includes(peerUid)) {
          createAndSendOffer(callRef, peerUid).catch(() => {});
        }
      }

      if (status === "ended") {
        window.notify?.show({
          type: "info",
          title: "Anruf",
          message: "Anruf beendet",
          duration: 3000
        });
        endVoiceCall().catch(() => {});
        return;
      }

      updateParticipantsList(participants);

      const label = callLabel(kind);
      const uiState = uiStateFromStatus(status);
      if (uiState === "ringing") {
        updateVoiceUI(true, `${label}: klingelt…`, "ringing");
      } else if (uiState === "in_call") {
        updateVoiceUI(true, `${label}: ${participants.length} Teilnehmer`, "in_call");
      } else {
        updateVoiceUI(true, `${label}`, "in_call");
      }
    });

    firebaseUnsubscribes.push(unsubscribe);
    return unsubscribe;
  }


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
          title: "Keine Gruppe ausgewählt",
          message: "Bitte wähle eine Gruppe aus.",
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

      localStream = await navigator.mediaDevices.getUserMedia({
        audio: buildAudioConstraints(),
        video: false
      });
      cleanupAudioProcessing();
      ensureAudioProcessing();

      const callId = `call_${Date.now()}_${auth.currentUser.uid}`;
      const user = auth.currentUser;

      currentVoiceCall = {
        kind: CALL_KIND_GROUP,
        groupId,
        callId,
        isInitiator: true
      };

      const callRef = getGroupCallRef(groupId, callId);
      await callRef.set({
        initiator: user.uid,
        initiatorName: user.displayName || "User",
        createdAt: new Date(),
        participants: [user.uid],
        status: "ringing",
        type: "group",
        rejectedBy: []
      });

      callUnsubscribe = subscribeToCallDoc(callRef, CALL_KIND_GROUP);
      listenForOffers(callRef);
      listenForAnswers(callRef);
      listenForIceCandidates(callRef);

      updateVoiceUI(true, "Gruppenanruf: klingelt…", "ringing");

      window.notify?.show({
        type: "info",
        title: "Anruf",
        message: "Anruf gestartet – warte auf Annahme",
        duration: 4500
      });
    } catch (err) {
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

      localStream = await navigator.mediaDevices.getUserMedia({
        audio: buildAudioConstraints(),
        video: false
      });
      cleanupAudioProcessing();
      ensureAudioProcessing();

      const callId = `call_${Date.now()}_${auth.currentUser.uid}`;
      const user = auth.currentUser;

      currentVoiceCall = {
        kind: CALL_KIND_GROUP,
        groupId,
        callId,
        isInitiator: true
      };

      const callRef = getGroupCallRef(groupId, callId);
      await callRef.set({
        initiator: user.uid,
        initiatorName: user.displayName || "User",
        createdAt: new Date(),
        participants: [user.uid],
        status: "active"
      });

      callUnsubscribe = subscribeToCallDoc(callRef, CALL_KIND_GROUP);
      listenForOffers(callRef);
      listenForAnswers(callRef);
      listenForIceCandidates(callRef);

      updateVoiceUI(true, "Gruppenanruf: aktiv", "in_call");

      window.notify?.show({
        type: "success",
        title: "Voice Chat",
        message: "Sprachchat gestartet - andere können jetzt beitreten",
        duration: 4500
      });

    } catch (err) {
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

      localStream = await navigator.mediaDevices.getUserMedia({
        audio: buildAudioConstraints(),
        video: false
      });
      cleanupAudioProcessing();
      ensureAudioProcessing();

      currentVoiceCall = {
        kind: CALL_KIND_GROUP,
        groupId,
        callId,
        isInitiator: false,
        peerUid: null
      };

      const callRef = getGroupCallRef(groupId, callId);

      await callRef.update({
        participants: window.firebase.firestore.FieldValue.arrayUnion(auth.currentUser.uid)
      });

      const callDoc = await callRef.get();
      const existingParticipants = callDoc.data()?.participants || [];

      for (const participantUid of existingParticipants) {
        if (participantUid !== auth.currentUser.uid) {
          currentVoiceCall.peerUid = participantUid;
          await createAndSendOffer(callRef, participantUid);
        }
      }

      listenForOffers(callRef);
      listenForAnswers(callRef);
      listenForIceCandidates(callRef);
      callUnsubscribe = subscribeToCallDoc(callRef, CALL_KIND_GROUP);

      updateVoiceUI(true, "Gruppenanruf: Verbindung wird hergestellt", "in_call");

      window.notify?.show({
        type: "success",
        title: "Voice Chat",
        message: "Sprachchat beigetreten - Verbindung wird hergestellt",
        duration: 4500
      });

    } catch (err) {
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


  async function startRingingDirectCall(targetUid, targetName) {
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

      const toUid = String(targetUid || "").trim();
      if (!toUid) return;

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
        audio: buildAudioConstraints(),
        video: false
      });
      cleanupAudioProcessing();
      ensureAudioProcessing();

      const callId = `direct_${Date.now()}_${auth.currentUser.uid}`;
      const user = auth.currentUser;

      currentVoiceCall = {
        kind: CALL_KIND_DIRECT,
        groupId: null,
        callId,
        peerUid: toUid,
        isInitiator: true
      };

      const callRef = getDirectCallRef(callId);
      await callRef.set({
        initiator: user.uid,
        initiatorName: user.displayName || (user.email ? user.email.split("@")[0] : "User"),
        to: toUid,
        toName: String(targetName || "").trim(),
        createdAt: new Date(),
        participants: [user.uid],
        status: "ringing",
        type: "direct",
        rejectedBy: []
      });

      callUnsubscribe = subscribeToCallDoc(callRef, CALL_KIND_DIRECT);
      listenForOffers(callRef);
      listenForAnswers(callRef);
      listenForIceCandidates(callRef);

      updateVoiceUI(true, "Direktanruf: klingelt…", "ringing");
    } catch (err) {
      const errorMsg =
        err.name === "NotAllowedError"
          ? "Mikrofonzugriff verweigert. Bitte erlaube Audiovorbereitung!"
          : err.name === "NotFoundError"
            ? "Kein Mikrofon gefunden. Bitte überprüfe dein Gerät!"
            : "Fehler beim Starten des Direktanrufs";

      window.notify?.show({
        type: "error",
        title: "Anruf Fehler",
        message: errorMsg,
        duration: 5000
      });
    }
  }

  async function joinDirectCall(callId) {
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

      const id = String(callId || "").trim();
      if (!id) return;

      localStream = await navigator.mediaDevices.getUserMedia({
        audio: buildAudioConstraints(),
        video: false
      });
      cleanupAudioProcessing();
      ensureAudioProcessing();

      currentVoiceCall = {
        kind: CALL_KIND_DIRECT,
        groupId: null,
        callId: id,
        peerUid: null,
        isInitiator: false
      };

      const callRef = getDirectCallRef(id);

      await callRef.set({
        participants: window.firebase.firestore.FieldValue.arrayUnion(auth.currentUser.uid)
      }, { merge: true });

      const callDoc = await callRef.get();
      const callData = callDoc.exists ? (callDoc.data() || {}) : {};
      const myUid = auth.currentUser.uid;
      const initiatorUid = String(callData.initiator || "").trim();
      const toUid = String(callData.to || "").trim();

      const fallbackPeer = Array.isArray(callData.participants)
        ? callData.participants.find((u) => u && u !== myUid) || ""
        : "";

      const isInitiator = initiatorUid && initiatorUid === myUid;
      const peerUid = (isInitiator ? toUid : initiatorUid) || fallbackPeer || "";

      currentVoiceCall.isInitiator = !!isInitiator;
      currentVoiceCall.peerUid = peerUid || null;

      if (currentVoiceCall.isInitiator && peerUid) {
        await createAndSendOffer(callRef, peerUid);
      }

      listenForOffers(callRef);
      listenForAnswers(callRef);
      listenForIceCandidates(callRef);
      callUnsubscribe = subscribeToCallDoc(callRef, CALL_KIND_DIRECT);

      updateVoiceUI(true, "Direktanruf: Verbindung wird hergestellt", "in_call");
    } catch (err) {
      const errorMsg = err.name === "NotAllowedError"
        ? "Mikrofonzugriff verweigert"
        : "Fehler beim Beitreten zum Direktanruf";

      window.notify?.show({
        type: "error",
        title: "Voice Chat Fehler",
        message: errorMsg,
        duration: 5000
      });
    }
  }


  async function endVoiceCall() {
    try {
      stopScreenShare();

      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
      }
      cleanupAudioProcessing();

      peerConnections.forEach((pc) => {
        pc.close();
      });
      peerConnections.clear();

      remoteStreams.forEach((stream, uid) => {
        const audioElement = document.getElementById(`remote-audio-${uid}`);
        if (audioElement) {
          audioElement.srcObject = null;
          audioElement.remove();
        }
      });
      remoteStreams.clear();

      firebaseUnsubscribes.forEach(unsub => unsub());
      firebaseUnsubscribes = [];

      if (callUnsubscribe) {
        callUnsubscribe();
        callUnsubscribe = null;
      }

      if (currentVoiceCall) {
        const callRef = getCallRefFromActiveCall();
        const isDirect = currentVoiceCall.kind === CALL_KIND_DIRECT;
        const myUid = auth?.currentUser?.uid || "";

        try {
          if (callRef && (isDirect || currentVoiceCall.isInitiator)) {
            await callRef.set(
              {
                status: "ended",
                endedAt: new Date()
              },
              { merge: true }
            );
          }

          if (callRef && currentVoiceCall.isInitiator) {
            const offerSnap = await callRef.collection("offers").get();
            for (const doc of offerSnap.docs) {
              await doc.ref.delete();
            }

            const answerSnap = await callRef.collection("answers").get();
            for (const doc of answerSnap.docs) {
              await doc.ref.delete();
            }

            const iceSnap = await callRef.collection("ice-candidates").get();
            for (const doc of iceSnap.docs) {
              await doc.ref.delete();
            }

            await callRef.delete();
          } else if (callRef && myUid) {
            await callRef.set(
              {
                participants: window.firebase.firestore.FieldValue.arrayRemove(myUid)
              },
              { merge: true }
            );
          }
        } catch (error) {
        }
      }

      currentVoiceCall = null;
      isMicMuted = false;

      updateVoiceUI(false, "Anruf beendet", "ended");
      btnToggleMic.classList.remove("is-muted");
      btnToggleMic.textContent = "🔇 Stummschalten";

      window.notify?.show({
        type: "success",
        title: "Voice Chat",
        message: "Anruf beendet",
        duration: 3500
      });

    } catch (error) {
    }
  }


  function updateVoiceUI(isActive, statusText, state) {
    if (isActive) {
      if (voiceStatus) voiceStatus.textContent = statusText;
      uiCallState = state || uiCallState || "in_call";
      if (voiceStatus) voiceStatus.setAttribute("data-state", uiCallState);
      if (chatCallBar) chatCallBar.hidden = false;
      if (btnStartVoiceCall) btnStartVoiceCall.hidden = true;
      if (btnEndVoiceCall) btnEndVoiceCall.hidden = false;
      if (btnToggleMic) btnToggleMic.hidden = false;
      if (btnToggleMic) btnToggleMic.disabled = false;

      if (btnEndVoiceCall) {
        btnEndVoiceCall.textContent = uiCallState === "ringing" ? "Abbrechen" : "Beenden";
      }
    } else {
      const nextState = state || "idle";
      uiCallState = nextState;
      if (voiceStatus) {
        voiceStatus.textContent = statusText || (nextState === "ended" ? "Anruf beendet" : "Nicht im Call");
        if (nextState === "ended") voiceStatus.setAttribute("data-state", "ended");
        else voiceStatus.removeAttribute("data-state");
      }
      if (chatCallBar) chatCallBar.hidden = true;
      if (btnStartVoiceCall) btnStartVoiceCall.hidden = false;
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


  function toggleMic() {
    if (!localStream) return isMicMuted;

    const nextMuted = !isMicMuted;
    const nextEnabled = !nextMuted;

    const outgoing = getOutgoingStream();

    try {
      localStream.getAudioTracks().forEach((track) => {
        track.enabled = nextEnabled;
      });
    } catch (_) {}

    if (outgoing && outgoing !== localStream) {
      try {
        outgoing.getAudioTracks().forEach((track) => {
          track.enabled = nextEnabled;
        });
      } catch (_) {}
    }

    isMicMuted = nextMuted;
    btnToggleMic.classList.toggle("is-muted", isMicMuted);
    btnToggleMic.textContent = isMicMuted ? "🔊 Entstummen" : "🔇 Stummschalten";
    return isMicMuted;
  }

  function setMicMuted(muted) {
    const wantMuted = !!muted;
    if (wantMuted === isMicMuted) return isMicMuted;
    return toggleMic();
  }


  async function initModule() {
    if (initialized) return;
    initialized = true;

    await waitForFirebase();

    if (!auth || !db) {
      return;
    }

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


    if (btnToggleMic) {
      btnToggleMic.addEventListener("click", toggleMic);
    }

    if (btnShareScreen) {
      btnShareScreen.addEventListener("click", async () => {
        if (!currentVoiceCall || uiCallState !== "in_call") {
          window.notify?.show({
            type: "warn",
            title: "Bildschirm teilen",
            message: "Starte zuerst einen Call.",
            duration: 3500
          });
          return;
        }

        if (screenShareInFlight) return;
        if (screenTrack) {
          stopScreenShare();
        } else {
          await startScreenShare();
        }
      });
    }

    if (btnCloseScreenShare) {
      btnCloseScreenShare.addEventListener("click", () => {
        screenShareDismissed = true;
        showScreenShareArea(false);
      });
    }

    const openBtn = ensureOpenScreenShareButton();
    if (openBtn && !openBtn.__wired) {
      openBtn.__wired = true;
      openBtn.addEventListener("click", () => {
        screenShareDismissed = false;
        showScreenShareArea(true);
      });
    }

    if (shareQualitySelect) {
      shareQualitySelect.addEventListener("change", async () => {
        if (!screenTrack) return;
        const preset = getSharePreset();
        await applyTrackConstraintsSafe(
          screenTrack,
          { width: preset.width, height: preset.height, frameRate: 30 },
          800
        );

        peerConnections.forEach((pc, remoteUid) => {
          const sender = videoSenders.get(remoteUid);
          if (sender) setVideoSenderBitrate(sender);
        });
      });
    }

    bindSelectedGroupEvents();
    handleSelectedGroupChange(getSelectedGroupId());

    const syncAuthDependentListeners = () => {
      if (auth?.currentUser?.uid) {
        attachIncomingDirectListener();
        handleSelectedGroupChange(getSelectedGroupId());
      } else {
        detachIncomingDirectListener();
        handleSelectedGroupChange(null);
      }
    };

    window.addEventListener("echtlucky:auth-change", () => {
      syncAuthDependentListeners();
    });
    syncAuthDependentListeners();

    initPushNotifications();

    window.addEventListener("beforeunload", () => {
      if (currentVoiceCall) {
        endVoiceCall().catch(() => {});
      }
    });

  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initModule);
  } else {
    initModule();
  }


  appNS.voiceChat = {
    startCall: startVoiceCall,
    startRingingCall: startRingingGroupCall,
    startDirectCall: startRingingDirectCall,
    joinCall: joinVoiceCall,
    joinDirectCall: joinDirectCall,
    endCall: endVoiceCall,
    isInCall: () => !!currentVoiceCall,
    toggleMic: toggleMic,
    setMicMuted: setMicMuted,
    getMicMuted: () => isMicMuted,
    setMicGain: setMicGain,
    getMicGain: getMicGain,
    getPeerCount: () => peerConnections.size
  };

  try {
    window.dispatchEvent(new CustomEvent("echtlucky:voice-chat-ready"));
  } catch (_) {}

})();
