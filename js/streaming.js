/**
 * Streaming Module - Professional Live Streaming Experience
 * WebRTC-based streaming with robust state management and fullscreen support
 */

(() => {
  "use strict";

  let auth = null;
  let db = null;
  let firebase = null;

  const el = (id) => document.getElementById(id);

  // DOM Elements
  const streamList = el("streamList");
  const streamSearchInput = el("streamSearchInput");
  const btnStartStream = el("btnStartStream");
  const stageVideo = el("stageVideo");
  const stageEmpty = el("stageEmpty");
  const streamTitle = el("streamTitle");
  const streamSub = el("streamSub");
  const streamCategory = el("streamCategory");
  const streamerName = el("streamerName");
  const streamStatus = el("streamStatus");
  const btnStageMute = el("btnStageMute");
  const btnStageFullscreen = el("btnStageFullscreen");
  const btnStageCinema = el("btnStageCinema");
  const btnStagePlay = el("btnStagePlay");
  const btnStageVolume = el("btnStageVolume");
  const volumeSlider = el("volumeSlider");

  const streamChatCard = el("streamChatCard");
  const streamChatSub = el("streamChatSub");
  const streamChatMessages = el("streamChatMessages");
  const streamChatInput = el("streamChatInput");
  const btnStreamChatSend = el("btnStreamChatSend");
  const streamMiniChat = el("streamMiniChat");
  const miniChatList = el("miniChatList");

  // State
  let activeCategory = "all";
  let searchQ = "";
  let selectedStreamId = "";
  let streamsCache = [];

  let streamsUnsub = null;
  let selectedStreamUnsub = null;
  let viewersUnsub = null;
  let chatUnsub = null;
  let viewerDocUnsub = null;
  let viewerCandidatesUnsub = null;
  let broadcasterCandidatesUnsub = null;

  let localStream = null;
  let isBroadcasting = false;
  let isStageMuted = true;
  let isStagePlaying = false;
  let stageVolume = 0.6;
  let isCinema = false;
  let isFullscreen = false;
  let myDisplayNameCached = "";
  let chatSeq = 0;

  const peerConnections = new Map();
  let viewerPc = null;
  let viewerCandidatesRef = null;
  let broadcasterCandidatesRef = null;

  const RTC_CONFIG = {
    iceServers: [{ urls: ["stun:stun.l.google.com:19302"] }],
  };

  // Stream States
  const STREAM_STATE = {
    OFFLINE: "offline",
    PREPARING: "preparing",
    LIVE: "live",
    PAUSED: "paused",
    ENDED: "ended"
  };

  let currentStreamState = STREAM_STATE.OFFLINE;

  function notify(type, title, message, duration) {
    try {
      window.notify?.show?.({ type, title, message, duration: duration || 3500 });
    } catch (_) {}
  }

  async function waitForFirebase() {
    return new Promise((resolve) => {
      if (window.firebaseReady && window.auth && window.db && window.firebase) {
        auth = window.auth;
        db = window.db;
        firebase = window.firebase;
        resolve();
        return;
      }

      const ready = () => {
        auth = window.auth;
        db = window.db;
        firebase = window.firebase;
        resolve();
      };

      window.addEventListener("firebaseReady", ready, { once: true });
      document.addEventListener("firebaseReady", ready, { once: true });

      setTimeout(() => {
        auth = window.auth;
        db = window.db;
        firebase = window.firebase;
        resolve();
      }, 3500);
    });
  }

  async function loadMyProfileDisplay() {
    const user = auth?.currentUser;
    if (!user?.uid) return user?.displayName || user?.email?.split("@")[0] || "User";
    try {
      const snap = await db.collection("users").doc(user.uid).get();
      const data = snap.exists ? snap.data() : {};
      const displayName = String(data.displayName || "").trim();
      myDisplayNameCached = displayName || user.displayName || user.email?.split("@")[0] || "User";
      return myDisplayNameCached;
    } catch (_) {
      return user?.displayName || user?.email?.split("@")[0] || "User";
    }
  }

  function getCategoryLabel(cat) {
    const map = { just_chatting: "Just Chatting", gaming: "Gaming" };
    return map[cat] || "Stream";
  }

  function getInitials(name) {
    return String(name || "U")
      .split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function setStageVideoStream(mediaStream) {
    if (!stageVideo) return;
    if (mediaStream) {
      stageVideo.srcObject = mediaStream;
      stageVideo.muted = isStageMuted;
      stageVideo.volume = isStageMuted ? 0 : stageVolume;
      isStagePlaying = true;
      updatePlayButton();
    } else {
      stageVideo.srcObject = null;
      isStagePlaying = false;
      updatePlayButton();
    }
  }

  function setStageEmpty(empty) {
    if (!stageEmpty || !stageVideo) return;
    stageEmpty.hidden = !empty;
    stageVideo.hidden = empty;
    if (empty) {
      setStageVideoStream(null);
    }
  }

  function setStageMeta({ title, sub, category, streamer, status }) {
    if (streamTitle) streamTitle.textContent = title || "";
    if (streamSub) streamSub.textContent = sub || "";
    if (streamCategory) streamCategory.textContent = category || "—";
    if (streamerName) streamerName.textContent = streamer || "—";
    if (streamStatus) {
      streamStatus.textContent = status || "—";
      streamStatus.className = "streaming-stat__value";
      if (status === "Live") streamStatus.classList.add("is-live");
      if (status === "Beendet") streamStatus.classList.add("is-ended");
      if (status === "Pausiert") streamStatus.classList.add("is-paused");
    }
  }

  function updatePlayButton() {
    if (!btnStagePlay) return;
    const icon = btnStagePlay.querySelector("i");
    if (icon) {
      icon.className = isStagePlaying ? "fa-solid fa-pause" : "fa-solid fa-play";
    }
    btnStagePlay.setAttribute("aria-label", isStagePlaying ? "Pause" : "Play");
  }

  function updateVolumeIcon() {
    if (!btnStageVolume) return;
    const icon = btnStageVolume.querySelector("i");
    if (!icon) return;
    
    if (isStageMuted || stageVolume === 0) {
      icon.className = "fa-solid fa-volume-xmark";
    } else if (stageVolume < 0.3) {
      icon.className = "fa-solid fa-volume-off";
    } else if (stageVolume < 0.7) {
      icon.className = "fa-solid fa-volume-low";
    } else {
      icon.className = "fa-solid fa-volume-high";
    }
  }

  function updateFullscreenButton() {
    if (!btnStageFullscreen) return;
    const icon = btnStageFullscreen.querySelector("i");
    if (icon) {
      icon.className = isFullscreen 
        ? "fa-solid fa-compress" 
        : "fa-solid fa-expand";
    }
    btnStageFullscreen.setAttribute("aria-label", isFullscreen ? "Vollbild verlassen" : "Vollbild");
  }

  function cleanupSelectedStreamSubscriptions() {
    try {
      if (selectedStreamUnsub) selectedStreamUnsub();
    } catch (_) {}
    selectedStreamUnsub = null;

    try {
      if (viewerDocUnsub) viewerDocUnsub();
    } catch (_) {}
    viewerDocUnsub = null;

    try {
      if (viewerCandidatesUnsub) viewerCandidatesUnsub();
    } catch (_) {}
    viewerCandidatesUnsub = null;

    try {
      if (broadcasterCandidatesUnsub) broadcasterCandidatesUnsub();
    } catch (_) {}
    broadcasterCandidatesUnsub = null;
  }

  function cleanupBroadcastPeers() {
    for (const [, pc] of peerConnections) {
      try {
        pc?.close?.();
      } catch (_) {}
    }
    peerConnections.clear();
  }

  async function stopBroadcast() {
    cleanupSelectedStreamSubscriptions();
    cleanupBroadcastPeers();

    try {
      if (localStream) {
        localStream.getTracks().forEach((t) => {
          try {
            t.stop();
          } catch (_) {}
        });
      }
    } catch (_) {}
    localStream = null;
    isBroadcasting = false;
    currentStreamState = STREAM_STATE.ENDED;

    try {
      const uid = auth?.currentUser?.uid;
      if (uid && selectedStreamId && db) {
        await db.collection("streams").doc(selectedStreamId).set(
          {
            status: "ended",
            endedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      }
    } catch (_) {}

    selectedStreamId = "";
    setStageVideoStream(null);
    setStageEmpty(true);
    setStageMeta({ 
      title: "Kein Stream ausgewählt", 
      sub: "Wähle links einen Stream aus.", 
      category: "—", 
      streamer: "—", 
      status: "—" 
    });
    
    if (btnStartStream) {
      btnStartStream.innerHTML = '<i class="fa-solid fa-tower-broadcast" aria-hidden="true"></i> Stream starten';
      btnStartStream.classList.remove("is-live");
    }
  }

  function renderStreams(items) {
    if (!streamList) return;
    if (!items.length) {
      streamList.innerHTML = '<div class="empty-state"><p>Keine Live-Streams.</p></div>';
      return;
    }

    streamList.innerHTML = items
      .map((s) => {
        const isActive = s.id === selectedStreamId;
        const title = s.title || "Stream";
        const owner = s.ownerName || "User";
        const cat = getCategoryLabel(s.category);
        const initials = getInitials(owner);
        const viewerCount = s.viewerCount || 0;
        return `
          <div class="stream-item ${isActive ? "is-active" : ""}" role="button" tabindex="0" data-stream-id="${escapeHtml(s.id)}">
            <div class="stream-item__avatar">${escapeHtml(initials)}</div>
            <div class="stream-item__info">
              <div class="stream-item__title">${escapeHtml(title)}</div>
              <div class="stream-item__sub">${escapeHtml(owner)} • ${escapeHtml(cat)}</div>
            </div>
            <div class="stream-item__meta">
              <span class="stream-item__viewers"><i class="fa-solid fa-eye" aria-hidden="true"></i> ${viewerCount}</span>
              <div class="stream-item__badge">LIVE</div>
            </div>
          </div>
        `;
      })
      .join("");
  }

  function matchStream(s) {
    if (activeCategory !== "all" && s.category !== activeCategory) return false;
    const q = String(searchQ || "").trim().toLowerCase();
    if (!q) return true;
    const hay = `${s.title || ""} ${s.ownerName || ""}`.toLowerCase();
    return hay.includes(q);
  }

  function wireStreamListSelection() {
    if (!streamList || streamList.__wired) return;
    streamList.__wired = true;

    const activate = (target) => {
      const id = target?.dataset?.streamId || "";
      if (!id) return;
      selectStream(id);
    };

    streamList.addEventListener("click", (e) => {
      const item = e.target?.closest?.("[data-stream-id]");
      if (!item) return;
      activate(item);
    });

    streamList.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      const item = e.target?.closest?.("[data-stream-id]");
      if (!item) return;
      activate(item);
    });
  }

  async function selectStream(id) {
    if (!db) return;
    if (id === selectedStreamId) return;

    await cleanupViewer();

    selectedStreamId = id;
    cleanupSelectedStreamSubscriptions();

    setStageEmpty(true);
    setStageMeta({ 
      title: "Lade Stream…", 
      sub: "", 
      category: "—", 
      streamer: "—", 
      status: "—" 
    });

    const ref = db.collection("streams").doc(id);
    selectedStreamUnsub = ref.onSnapshot(
      (snap) => {
        if (!snap.exists) {
          setStageMeta({ 
            title: "Stream nicht verfügbar", 
            sub: "", 
            category: "—", 
            streamer: "—", 
            status: "—" 
          });
          setStageEmpty(true);
          return;
        }
        const d = snap.data() || {};
        const status = d.status || "live";
        
        currentStreamState = status === "live" ? STREAM_STATE.LIVE : STREAM_STATE.ENDED;
        
        setStageMeta({
          title: d.title || "Stream",
          sub: "",
          category: getCategoryLabel(d.category),
          streamer: d.ownerName || "User",
          status: status === "live" ? "Live" : "Beendet",
        });

        if (status !== "live") {
          setStageEmpty(true);
          setStageVideoStream(null);
          return;
        }

        if (!isBroadcasting) {
          joinStreamAsViewer(id).catch(() => {});
        }
      },
      () => {
        setStageMeta({ 
          title: "Fehler", 
          sub: "Stream konnte nicht geladen werden.", 
          category: "—", 
          streamer: "—", 
          status: "—" 
        });
        setStageEmpty(true);
      }
    );
  }

  async function cleanupViewer() {
    if (viewerPc) {
      try {
        viewerPc.close();
      } catch (_) {}
      viewerPc = null;
    }
    
    try {
      const uid = auth?.currentUser?.uid;
      if (uid && selectedStreamId && db) {
        await db.collection("streams").doc(selectedStreamId)
          .collection("viewers").doc(uid).delete();
      }
    } catch (_) {}
  }

  async function joinStreamAsViewer(streamId) {
    if (!db || !auth) return;

    const user = auth.currentUser;
    if (!user?.uid) {
      setStageMeta({ 
        title: "Login erforderlich", 
        sub: "Bitte einloggen, um Streams zu schauen.", 
        category: "—", 
        streamer: "—", 
        status: "—" 
      });
      setStageEmpty(true);
      setStageVideoStream(null);
      return;
    }

    const viewerUid = user.uid;
    const viewerName = await loadMyProfileDisplay();

    const streamRef = db.collection("streams").doc(streamId);
    const viewerRef = streamRef.collection("viewers").doc(viewerUid);

    viewerCandidatesRef = viewerRef.collection("viewerCandidates");
    broadcasterCandidatesRef = viewerRef.collection("broadcasterCandidates");

    viewerPc = new RTCPeerConnection(RTC_CONFIG);

    viewerPc.ontrack = (event) => {
      const ms = event.streams?.[0] || null;
      if (ms) {
        setStageVideoStream(ms);
        setStageEmpty(false);
        stageVideo.muted = isStageMuted;
        stageVideo.volume = isStageMuted ? 0 : stageVolume;
      }
    };

    viewerPc.onicecandidate = (event) => {
      if (!event.candidate || !viewerCandidatesRef) return;
      viewerCandidatesRef.add(event.candidate.toJSON()).catch(() => {});
    };

    await viewerRef.set(
      {
        viewerUid,
        viewerName,
        status: "watching",
        joinedAt: firebase.firestore.FieldValue.serverTimestamp(),
        offer: null,
        answer: null,
      },
      { merge: true }
    );

    const offer = await viewerPc.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true,
    });
    await viewerPc.setLocalDescription(offer);

    await viewerRef.set(
      {
        offer: { type: offer.type, sdp: offer.sdp },
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    viewerDocUnsub = viewerRef.onSnapshot((snap) => {
      if (!snap.exists) return;
      const data = snap.data() || {};
      if (data.answer && !viewerPc.currentRemoteDescription) {
        const answerDesc = new RTCSessionDescription(data.answer);
        viewerPc.setRemoteDescription(answerDesc).catch(() => {});
      }
    });

    broadcasterCandidatesUnsub = broadcasterCandidatesRef.onSnapshot((snap) => {
      snap.docChanges().forEach((change) => {
        if (change.type !== "added") return;
        const cand = change.doc.data();
        if (!cand) return;
        viewerPc.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
      });
    });
  }

  async function startBroadcastFlow() {
    if (!db || !auth) return;

    const user = auth.currentUser;
    if (!user?.uid) {
      try {
        const returnTo = "streaming.html" + (window.location.search || "") + (window.location.hash || "");
        sessionStorage.setItem("echtlucky:returnTo", returnTo);
      } catch (_) {}
      window.location.href = "login.html";
      return;
    }

    const profileName = await loadMyProfileDisplay();

    const opts = {
      title: "Stream starten",
      fields: [
        { name: "title", label: "Titel", type: "text", placeholder: "z.B. Ranked Grind", required: true, maxLength: 80 },
        {
          name: "category",
          label: "Kategorie",
          type: "select",
          options: [
            { value: "just_chatting", label: "Just Chatting" },
            { value: "gaming", label: "Gaming" },
          ],
          required: true,
        },
      ],
      confirmText: "Starten",
      cancelText: "Abbrechen",
    };

    let data = null;
    try {
      data = await window.echtluckyModal?.form?.(opts);
    } catch (_) {}

    if (!data) return;

    const title = String(data.title || "").trim().slice(0, 80);
    const category = String(data.category || "").trim();
    if (!title || !["just_chatting", "gaming"].includes(category)) return;

    // Preparing state
    currentStreamState = STREAM_STATE.PREPARING;
    setStageMeta({ 
      title: "Stream wird vorbereitet...", 
      sub: "Berechtigungen werden angefordert", 
      category: getCategoryLabel(category), 
      streamer: profileName, 
      status: "Vorbereitung" 
    });

    const liveSnap = await db.collection("streams").where("status", "==", "live").limit(12).get();
    if (liveSnap.size >= 10) {
      notify("warn", "Limit erreicht", "Aktuell sind 10 Streams live. Bitte später erneut versuchen.", 4500);
      currentStreamState = STREAM_STATE.OFFLINE;
      return;
    }

    let displayMedia = null;
    let micStream = null;
    try {
      displayMedia = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
    } catch (_) {
      notify("error", "Abgebrochen", "Screen Capture wurde nicht gestartet.", 3800);
      currentStreamState = STREAM_STATE.OFFLINE;
      return;
    }

    try {
      micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    } catch (_) {
      micStream = null;
    }

    const tracks = [];
    if (displayMedia) displayMedia.getTracks().forEach((t) => tracks.push(t));
    if (micStream) micStream.getAudioTracks().forEach((t) => tracks.push(t));

    localStream = new MediaStream(tracks);
    isBroadcasting = true;
    currentStreamState = STREAM_STATE.LIVE;

    setStageEmpty(false);
    setStageVideoStream(localStream);
    stageVideo.muted = true;
    stageVideo.volume = 0;

    const streamRef = db.collection("streams").doc();
    selectedStreamId = streamRef.id;

    await streamRef.set({
      ownerUid: user.uid,
      ownerName: profileName,
      title,
      category,
      status: "live",
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });

    setStageMeta({ 
      title, 
      sub: "Du bist live.", 
      category: getCategoryLabel(category), 
      streamer: profileName, 
      status: "Live" 
    });

    if (btnStartStream) {
      btnStartStream.innerHTML = '<i class="fa-solid fa-stop" aria-hidden="true"></i> Stream beenden';
      btnStartStream.classList.add("is-live");
    }

    displayMedia?.getVideoTracks?.()?.[0]?.addEventListener?.("ended", () => {
      stopBroadcast().catch(() => {});
    });

    startBroadcasterSignaling(streamRef).catch(() => {});
    notify("success", "Live", "Stream gestartet.", 2600);
  }

  async function startBroadcasterSignaling(streamRef) {
    cleanupSelectedStreamSubscriptions();
    cleanupBroadcastPeers();

    viewersUnsub = streamRef.collection("viewers").onSnapshot((snap) => {
      snap.docChanges().forEach((change) => {
        const doc = change.doc;
        const viewerUid = doc.id;
        const data = doc.data() || {};

        if (!viewerUid) return;
        if (change.type === "removed") {
          const pc = peerConnections.get(viewerUid);
          if (pc) {
            try {
              pc.close();
            } catch (_) {}
            peerConnections.delete(viewerUid);
          }
          return;
        }

        if (!data.offer || data.answer) return;
        if (peerConnections.has(viewerUid)) return;

        const pc = new RTCPeerConnection(RTC_CONFIG);
        peerConnections.set(viewerUid, pc);

        try {
          localStream?.getTracks?.()?.forEach((t) => pc.addTrack(t, localStream));
        } catch (_) {}

        const viewerRef = streamRef.collection("viewers").doc(viewerUid);
        const viewerCandidates = viewerRef.collection("viewerCandidates");
        const broadcasterCandidates = viewerRef.collection("broadcasterCandidates");

        pc.onicecandidate = (event) => {
          if (!event.candidate) return;
          broadcasterCandidates.add(event.candidate.toJSON()).catch(() => {});
        };

        viewerCandidates.onSnapshot((candSnap) => {
          candSnap.docChanges().forEach((c) => {
            if (c.type !== "added") return;
            const candidate = c.doc.data();
            if (!candidate) return;
            pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
          });
        });

        pc.setRemoteDescription(new RTCSessionDescription(data.offer))
          .then(() => pc.createAnswer())
          .then((answer) => {
            pc.setLocalDescription(answer).catch(() => {});
            return viewerRef.set(
              {
                answer: { type: answer.type, sdp: answer.sdp },
                answeredAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
              },
              { merge: true }
            );
          })
          .catch(() => {});
      });
    });
  }

  // Fullscreen handling
  function toggleFullscreen() {
    const host = document.querySelector(".streaming-player");
    if (!host) return;

    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      host.requestFullscreen().catch(() => {});
    }
  }

  function onFullscreenChange() {
    isFullscreen = !!document.fullscreenElement;
    updateFullscreenButton();
    
    const player = document.querySelector(".streaming-player");
    if (player) {
      player.classList.toggle("is-fullscreen", isFullscreen);
    }
    
    // Show/hide exit fullscreen overlay button
    const exitBtn = document.getElementById("btnExitFullscreen");
    if (exitBtn) {
      exitBtn.hidden = !isFullscreen;
    }
  }

  // Cinema mode
  function toggleCinema() {
    isCinema = !isCinema;
    document.body.classList.toggle("cinema-mode", isCinema);
    if (btnStageCinema) {
      btnStageCinema.setAttribute("aria-pressed", String(isCinema));
      btnStageCinema.classList.toggle("is-active", isCinema);
    }
  }

  // Volume handling
  function toggleMute() {
    isStageMuted = !isStageMuted;
    if (stageVideo) {
      stageVideo.muted = isStageMuted;
      stageVideo.volume = isStageMuted ? 0 : stageVolume;
    }
    if (btnStageMute) {
      btnStageMute.classList.toggle("is-active", isStageMuted);
    }
    updateVolumeIcon();
  }

  function setVolume(value) {
    stageVolume = Math.max(0, Math.min(1, value));
    if (stageVideo) {
      stageVideo.volume = stageVolume;
      if (stageVolume > 0 && isStageMuted) {
        isStageMuted = false;
        if (btnStageMute) btnStageMute.classList.remove("is-active");
      }
    }
    if (volumeSlider) {
      volumeSlider.value = stageVolume;
    }
    updateVolumeIcon();
    
    try {
      localStorage.setItem("echtlucky:streaming:volume", String(stageVolume));
    } catch (_) {}
  }

  function togglePlay() {
    if (!stageVideo) return;
    
    if (stageVideo.paused) {
      stageVideo.play().then(() => {
        isStagePlaying = true;
        updatePlayButton();
      }).catch(() => {});
    } else {
      stageVideo.pause();
      isStagePlaying = false;
      updatePlayButton();
    }
  }

  function wireControls() {
    // Category filters
    document.querySelectorAll("[data-category]").forEach((btn) => {
      btn.addEventListener("click", () => {
        activeCategory = btn.dataset.category || "all";
        document.querySelectorAll("[data-category]").forEach((b) => b.classList.toggle("is-active", b === btn));
        refreshStreamListUI();
      });
    });

    // Search
    streamSearchInput?.addEventListener("input", (e) => {
      searchQ = String(e.target.value || "").trim();
      refreshStreamListUI();
    });

    // Start/Stop stream
    btnStartStream?.addEventListener("click", async () => {
      if (isBroadcasting) {
        const ok = await window.echtluckyModal?.confirm?.({
          title: "Stream beenden",
          message: "Stream wirklich beenden?",
          confirmText: "Beenden",
          cancelText: "Abbrechen",
          type: "danger",
        });
        if (!ok) return;
        await stopBroadcast();
        return;
      }
      await startBroadcastFlow();
    });

    // Player controls
    btnStageMute?.addEventListener("click", toggleMute);
    
    btnStagePlay?.addEventListener("click", togglePlay);
    
    btnStageVolume?.addEventListener("click", () => {
      const slider = document.getElementById("volumeSliderContainer");
      if (slider) {
        slider.classList.toggle("is-visible");
      }
    });
    
    volumeSlider?.addEventListener("input", (e) => {
      setVolume(parseFloat(e.target.value));
    });
    
    btnStageFullscreen?.addEventListener("click", toggleFullscreen);
    
    btnStageCinema?.addEventListener("click", toggleCinema);

    // Fullscreen change events
    document.addEventListener("fullscreenchange", onFullscreenChange);
    document.addEventListener("webkitfullscreenchange", onFullscreenChange);
    document.addEventListener("mozfullscreenchange", onFullscreenChange);
    document.addEventListener("MSFullscreenChange", onFullscreenChange);

    // ESC key for exiting fullscreen
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && isFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    });

    // Video click to toggle play
    stageVideo?.addEventListener("click", togglePlay);
    
    // Before unload cleanup
    window.addEventListener("beforeunload", () => {
      try {
        if (isBroadcasting) {
          db?.collection("streams")?.doc?.(selectedStreamId)?.set?.({ status: "ended" }, { merge: true });
        }
      } catch (_) {}
    });
  }

  function refreshStreamListUI() {
    const filtered = (Array.isArray(streamsCache) ? streamsCache : []).filter(matchStream);
    renderStreams(filtered);
  }

  function startStreamsFeed() {
    if (!db || !streamList) return;
    if (streamsUnsub) return;

    streamsUnsub = db
      .collection("streams")
      .where("status", "==", "live")
      .limit(10)
      .onSnapshot(
        (snap) => {
          const items = [];
          snap.forEach((doc) => items.push({ id: doc.id, ...(doc.data() || {}) }));
          items.sort((a, b) => {
            const at = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
            const bt = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
            return bt - at;
          });
          streamsCache = items;
          refreshStreamListUI();
        },
        () => {
          streamList.innerHTML = '<div class="empty-state"><p>Streams konnten nicht geladen werden.</p></div>';
        }
      );
  }

  async function init() {
    await waitForFirebase();
    if (!auth || !db || !firebase) return;

    // Load saved volume
    try {
      const savedVol = localStorage.getItem("echtlucky:streaming:volume");
      if (savedVol !== null) {
        stageVolume = parseFloat(savedVol);
        if (volumeSlider) volumeSlider.value = stageVolume;
      }
    } catch (_) {}

    wireControls();
    wireStreamListSelection();
    startStreamsFeed();

    setStageEmpty(true);
    setStageMeta({ 
      title: "Kein Stream ausgewählt", 
      sub: "Wähle links einen Stream aus.", 
      category: "—", 
      streamer: "—", 
      status: "—" 
    });
    
    updateVolumeIcon();
    updatePlayButton();
    updateFullscreenButton();

    auth.onAuthStateChanged(() => {});
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
