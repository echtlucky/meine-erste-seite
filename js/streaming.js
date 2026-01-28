(() => {
  "use strict";

  let auth = null;
  let db = null;
  let firebase = null;

  const el = (id) => document.getElementById(id);

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

  const streamChatCard = el("streamChatCard");
  const streamChatSub = el("streamChatSub");
  const streamChatMessages = el("streamChatMessages");
  const streamChatInput = el("streamChatInput");
  const btnStreamChatSend = el("btnStreamChatSend");
  const streamMiniChat = el("streamMiniChat");
  const miniChatList = el("miniChatList");

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
  let isCinema = false;
  let myDisplayNameCached = "";
  let chatSeq = 0;

  const peerConnections = new Map(); // viewerUid -> RTCPeerConnection
  let viewerPc = null;
  let viewerCandidatesRef = null;
  let broadcasterCandidatesRef = null;

  const RTC_CONFIG = {
    iceServers: [{ urls: ["stun:stun.l.google.com:19302"] }],
  };

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
      const data = snap.exists ? snap.data() || {} : {};
      return data.username || data.displayName || user.displayName || user.email?.split("@")[0] || "User";
    } catch (_) {
      return user.displayName || user.email?.split("@")[0] || "User";
    }
  }

  function setStageMeta(meta) {
    streamTitle.textContent = meta.title || "Kein Stream ausgewählt";
    streamSub.textContent = meta.sub || "";
    streamCategory.textContent = meta.category || "—";
    streamerName.textContent = meta.streamer || "—";
    streamStatus.textContent = meta.status || "—";
  }

  function setStageEmpty(show) {
    if (!stageEmpty) return;
    stageEmpty.hidden = !show;
  }

  function setStageVideoStream(media) {
    if (!stageVideo) return;
    try {
      stageVideo.srcObject = media || null;
    } catch (_) {
      stageVideo.srcObject = null;
    }
  }

  function getCategoryLabel(raw) {
    if (raw === "just_chatting") return "Just Chatting";
    if (raw === "gaming") return "Gaming";
    return "—";
  }

  function getInitials(name) {
    const s = String(name || "U").trim();
    if (!s) return "U";
    const parts = s.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  function escapeHtml(str) {
    const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
    return String(str || "").replace(/[&<>"']/g, (m) => map[m]);
  }

  function cleanupSelectedStreamSubscriptions() {
    try {
      if (typeof selectedStreamUnsub === "function") selectedStreamUnsub();
    } catch (_) {}
    selectedStreamUnsub = null;

    try {
      if (typeof viewersUnsub === "function") viewersUnsub();
    } catch (_) {}
    viewersUnsub = null;
  }

  async function cleanupViewer() {
    try {
      if (typeof viewerDocUnsub === "function") viewerDocUnsub();
    } catch (_) {}
    viewerDocUnsub = null;

    try {
      if (typeof viewerCandidatesUnsub === "function") viewerCandidatesUnsub();
    } catch (_) {}
    viewerCandidatesUnsub = null;

    try {
      if (typeof broadcasterCandidatesUnsub === "function") broadcasterCandidatesUnsub();
    } catch (_) {}
    broadcasterCandidatesUnsub = null;

    try {
      if (viewerPc) viewerPc.close();
    } catch (_) {}
    viewerPc = null;
    viewerCandidatesRef = null;
    broadcasterCandidatesRef = null;

    try {
      if (selectedStreamId && auth?.currentUser?.uid && db) {
        await db
          .collection("streams")
          .doc(selectedStreamId)
          .collection("viewers")
          .doc(auth.currentUser.uid)
          .delete();
      }
    } catch (_) {}

    if (!isBroadcasting) {
      setStageVideoStream(null);
      setStageEmpty(true);
    }
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
    setStageMeta({ title: "Kein Stream ausgewählt", sub: "Wähle links einen Stream aus.", category: "—", streamer: "—", status: "—" });
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
        return `
          <div class="stream-item ${isActive ? "is-active" : ""}" role="button" tabindex="0" data-stream-id="${escapeHtml(s.id)}">
            <div class="stream-item__avatar">${escapeHtml(initials)}</div>
            <div>
              <div class="stream-item__title">${escapeHtml(title)}</div>
              <div class="stream-item__sub">${escapeHtml(owner)} • ${escapeHtml(cat)}</div>
            </div>
            <div class="stream-item__badge">
              LIVE
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
    setStageMeta({ title: "Lade Stream…", sub: "", category: "—", streamer: "—", status: "—" });

    const ref = db.collection("streams").doc(id);
    selectedStreamUnsub = ref.onSnapshot(
      (snap) => {
        if (!snap.exists) {
          setStageMeta({ title: "Stream nicht verfügbar", sub: "", category: "—", streamer: "—", status: "—" });
          setStageEmpty(true);
          return;
        }
        const d = snap.data() || {};
        const status = d.status || "live";
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
        setStageMeta({ title: "Fehler", sub: "Stream konnte nicht geladen werden.", category: "—", streamer: "—", status: "—" });
        setStageEmpty(true);
      }
    );
  }

  async function joinStreamAsViewer(streamId) {
    if (!db || !auth) return;

    const user = auth.currentUser;
    if (!user?.uid) {
      setStageMeta({ title: "Login erforderlich", sub: "Bitte einloggen, um Streams zu schauen.", category: "—", streamer: "—", status: "—" });
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
        stageVideo.volume = isStageMuted ? 0 : 0.6;
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

    const liveSnap = await db.collection("streams").where("status", "==", "live").limit(12).get();
    if (liveSnap.size >= 10) {
      notify("warn", "Limit erreicht", "Aktuell sind 10 Streams live. Bitte später erneut versuchen.", 4500);
      return;
    }

    let displayMedia = null;
    let micStream = null;
    try {
      displayMedia = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
    } catch (_) {
      notify("error", "Abgebrochen", "Screen Capture wurde nicht gestartet.", 3800);
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

    setStageMeta({ title, sub: "Du bist live.", category: getCategoryLabel(category), streamer: profileName, status: "Live" });

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

  function wireControls() {
    document.querySelectorAll("[data-category]").forEach((btn) => {
      btn.addEventListener("click", () => {
        activeCategory = btn.dataset.category || "all";
        document.querySelectorAll("[data-category]").forEach((b) => b.classList.toggle("is-active", b === btn));
        refreshStreamListUI();
      });
    });

    streamSearchInput?.addEventListener("input", (e) => {
      searchQ = String(e.target.value || "").trim();
      refreshStreamListUI();
    });

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
        btnStartStream.textContent = "Stream starten";
        return;
      }
      await startBroadcastFlow();
      if (isBroadcasting) btnStartStream.textContent = "Stream beenden";
    });

    btnStageMute?.addEventListener("click", () => {
      isStageMuted = !isStageMuted;
      if (stageVideo) {
        stageVideo.muted = isStageMuted;
        stageVideo.volume = isStageMuted ? 0 : 0.6;
      }
      btnStageMute?.classList?.toggle?.("is-active", isStageMuted);
    });

    btnStageFullscreen?.addEventListener("click", () => {
      const host = document.querySelector(".streaming-player");
      if (!host) return;
      const go = async () => {
        try {
          if (document.fullscreenElement) await document.exitFullscreen();
          else await host.requestFullscreen();
        } catch (_) {}
      };
      go();
    });

    window.addEventListener("beforeunload", () => {
      try {
        if (isBroadcasting) db?.collection("streams")?.doc?.(selectedStreamId)?.set?.({ status: "ended" }, { merge: true });
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

    wireControls();
    wireStreamListSelection();
    startStreamsFeed();

    setStageEmpty(true);
    setStageMeta({ title: "Kein Stream ausgewählt", sub: "Wähle links einen Stream aus.", category: "—", streamer: "—", status: "—" });

    auth.onAuthStateChanged(() => {});
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
