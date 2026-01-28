/**
 * Streaming Platform - Professional Full-Featured Streaming Experience
 * Comprehensive streaming platform with Twitch & YouTube-like functionality
 */

(() => {
  "use strict";

  // Firebase references
  let auth = null;
  let db = null;
  let firebase = null;
  let storage = null;

  // Utility functions
  const el = (id) => document.getElementById(id);
  const qel = (selector) => document.querySelector(selector);
  const $$ = (selector) => document.querySelectorAll(selector);

  // ===== State Management =====
  const state = {
    // User state
    user: null,
    userProfile: null,
    isLoggedIn: false,

    // View state
    currentView: "watch",
    
    // Stream state
    activeStream: null,
    selectedStreamId: null,
    streams: [],
    
    // Broadcast state
    isBroadcasting: false,
    localStream: null,
    localDisplay: null,
    
    // Player state
    isPlaying: false,
    isMuted: false,
    volume: 1,
    currentTime: 0,
    duration: 0,
    isFullscreen: false,
    
    // Chat state
    chatMessages: [],
    isChatStatsVisible: false,
    
    // VOD state
    vodList: [],
    currentVod: null,
    
    // Studio state
    selectedVideoSource: "camera",
    selectedAudioSource: null,
    selectedDesktopAudio: null,
    scenes: [
      { id: "main", name: "Haupt-Szene" },
      { id: "brb", name: "Be right back" },
      { id: "starting", name: "Starting Soon" }
    ],
    activeScene: "main",
    
    // Dashboard stats
    dashboardStats: {
      totalViews: 1247,
      totalLikes: 892,
      followers: 156,
      watchTime: 48
    }
  };

  // ===== DOM Elements Cache =====
  let elements = {};

  // ===== Initialization =====
  async function init() {
    cacheElements();
    await waitForFirebase();
    setupEventListeners();
    await loadUserProfile();
    await loadMockData();
    renderStreams();
    renderDashboard();
    renderVods();
    setupViewTabs();
    setupProfileDropdown();
    
    console.log("[Streaming] Platform initialized");
  }

  function cacheElements() {
    elements = {
      // Navigation
      profileBtn: el("profileBtn"),
      profileAvatar: el("profileAvatar"),
      profileName: el("profileName"),
      profileMenu: el("profileMenu"),
      profileDropdown: el("profileDropdown"),
      
      // View tabs
      tabWatch: el("tabWatch"),
      tabDashboard: el("tabDashboard"),
      tabVods: el("tabVods"),
      tabStudio: el("tabStudio"),
      viewWatch: el("viewWatch"),
      viewDashboard: el("viewDashboard"),
      viewVods: el("viewVods"),
      viewStudio: el("viewStudio"),
      
      // Video player
      videoPlayer: el("videoPlayer"),
      mainVideo: el("mainVideo"),
      videoOverlay: el("videoOverlay"),
      liveBadge: el("liveBadge"),
      viewerCountOverlay: el("viewerCountOverlay"),
      viewerCountDisplay: el("viewerCountDisplay"),
      streamTitleOverlay: el("streamTitleOverlay"),
      overlayStreamTitle: el("overlayStreamTitle"),
      overlayStreamerName: el("overlayStreamerName"),
      btnExitFullscreen: el("btnExitFullscreen"),
      miniChatOverlay: el("miniChatOverlay"),
      miniChatMessages: el("miniChatMessages"),
      btnCloseMiniChat: el("btnCloseMiniChat"),
      videoControls: el("videoControls"),
      btnPlayPause: el("btnPlayPause"),
      btnVolume: el("btnVolume"),
      volumeSlider: el("volumeSlider"),
      seekSlider: el("seekSlider"),
      timeDisplay: el("timeDisplay"),
      btnFullscreen: el("btnFullscreen"),
      btnTheaterMode: el("btnTheaterMode"),
      btnToggleMiniChat: el("btnToggleMiniChat"),
      
      // Stream info
      currentStreamTitle: el("currentStreamTitle"),
      currentCategory: el("currentCategory"),
      currentViewers: el("currentViewers"),
      currentRuntime: el("currentRuntime"),
      reactionsBar: el("reactionsBar"),
      
      // Chat
      chatPanel: el("chatPanel"),
      chatTabLive: el("chatTabLive"),
      chatTabStats: el("chatTabStats"),
      chatViewLive: el("chatViewLive"),
      chatStatsPanel: el("chatStatsPanel"),
      chatMessages: el("chatMessages"),
      pinnedMessage: el("pinnedMessage"),
      pinnedAuthor: el("pinnedAuthor"),
      pinnedText: el("pinnedText"),
      btnClosePinned: el("btnClosePinned"),
      chatInput: el("chatInput"),
      btnChatSend: el("btnChatSend"),
      btnEmojiPicker: el("btnEmojiPicker"),
      
      // Chat stats
      statViewers: el("statViewers"),
      statPeak: el("statPeak"),
      statChatRate: el("statChatRate"),
      statNewFollowers: el("statNewFollowers"),
      
      // Stream list
      streamListSidebar: el("streamListSidebar"),
      streamList: el("streamList"),
      
      // Actions
      btnStartBroadcast: el("btnStartBroadcast"),
      btnGoStudio: el("btnGoStudio"),
      btnFollow: el("btnFollow"),
      btnSubscribe: el("btnSubscribe"),
      btnShare: el("btnShare"),
      btnToggleChat: el("btnToggleChat"),
      
      // Dashboard
      dashTotalViews: el("dashTotalViews"),
      dashTotalLikes: el("dashTotalLikes"),
      dashFollowers: el("dashFollowers"),
      dashWatchTime: el("dashWatchTime"),
      recentStreamsBody: el("recentStreamsBody"),
      recentVodsGrid: el("recentVodsGrid"),
      btnGoLive: el("btnGoLive"),
      
      // VODs
      vodsGrid: el("vodsGrid"),
      btnUploadVod: el("btnUploadVod"),
      
      // Studio
      previewCanvas: el("previewCanvas"),
      previewVideo: el("previewVideo"),
      previewOverlay: el("previewOverlay"),
      btnStartPreview: el("btnStartPreview"),
      btnStopPreview: el("btnStopPreview"),
      streamTitleInput: el("streamTitleInput"),
      streamCategorySelect: el("streamCategorySelect"),
      streamTagsInput: el("streamTagsInput"),
      sourceCamera: el("sourceCamera"),
      sourceScreen: el("sourceScreen"),
      sourceGame: el("sourceGame"),
      sourceImage: el("sourceImage"),
      audioDeviceSelect: el("audioDeviceSelect"),
      desktopAudioSelect: el("desktopAudioSelect"),
      scenesList: el("scenesList"),
      btnAddScene: el("btnAddScene"),
      btnTestStream: el("btnTestStream"),
      btnGoLiveStudio: el("btnGoLiveStudio"),
      chkRecordLocally: el("chkRecordLocally"),
      chkAutoPublishVod: el("chkAutoPublishVod"),
      chkEnableR9k: el("chkEnableR9k"),
      chkSlowMode: el("chkSlowMode"),
      
      // Upload modal
      uploadModal: el("uploadModal"),
      btnCloseUploadModal: el("btnCloseUploadModal"),
      uploadDropzone: el("uploadDropzone"),
      videoFileInput: el("videoFileInput"),
      uploadProgress: el("uploadProgress"),
      uploadProgressFill: el("uploadProgressFill"),
      uploadProgressText: el("uploadProgressText"),
      vodTitleInput: el("vodTitleInput"),
      vodDescInput: el("vodDescInput"),
      vodPrivacySelect: el("vodPrivacySelect"),
      btnCancelUpload: el("btnCancelUpload"),
      btnPublishVod: el("btnPublishVod"),
      
      // VOD player modal
      vodPlayerModal: el("vodPlayerModal"),
      btnCloseVodPlayer: el("btnCloseVodPlayer"),
      vodVideoPlayer: el("vodVideoPlayer"),
      vodPlayerTitle: el("vodPlayerTitle"),
      vodViewCount: el("vodViewCount"),
      vodLikeCount: el("vodLikeCount"),
      vodDate: el("vodDate"),
      commentInput: el("commentInput"),
      btnPostComment: el("btnPostComment"),
      commentsList: el("commentsList"),
      
      // Filter buttons
      filterButtons: document.querySelectorAll(".filter-pill"),
      
      // Toast container
      toastContainer: el("toastContainer")
    };
  }

  // ===== Firebase Setup =====
  async function waitForFirebase() {
    return new Promise((resolve) => {
      if (window.firebaseReady && window.auth && window.db && window.firebase) {
        auth = window.auth;
        db = window.db;
        firebase = window.firebase;
        storage = window.storage || null;
        resolve();
        return;
      }

      const ready = () => {
        auth = window.auth;
        db = window.db;
        firebase = window.firebase;
        storage = window.storage || null;
        resolve();
      };

      window.addEventListener("firebaseReady", ready, { once: true });
      document.addEventListener("firebaseReady", ready, { once: true });

      setTimeout(() => {
        auth = window.auth;
        db = window.db;
        firebase = window.firebase;
        storage = window.storage || null;
        resolve();
      }, 3000);
    });
  }

  // ===== User Profile =====
  async function loadUserProfile() {
    if (!auth?.currentUser) {
      state.user = null;
      state.isLoggedIn = false;
      updateProfileUI();
      return;
    }

    state.user = auth.currentUser;
    state.isLoggedIn = true;

    try {
      const doc = await db.collection("users").doc(state.user.uid).get();
      state.userProfile = doc.exists ? doc.data() : {};
    } catch (e) {
      state.userProfile = {};
    }

    updateProfileUI();
  }

  function updateProfileUI() {
    if (state.isLoggedIn && state.user) {
      const displayName = state.userProfile?.displayName || state.user.displayName || state.user.email?.split("@")[0] || "User";
      const initials = getInitials(displayName);
      
      elements.profileName.textContent = displayName;
      elements.profileAvatar.textContent = initials;
      elements.profileAvatar.style.display = "grid";
    } else {
      elements.profileName.textContent = "Login";
      elements.profileAvatar.textContent = "?";
    }
  }

  // ===== Mock Data =====
  async function loadMockData() {
    // Mock streams
    state.streams = [
      {
        id: "stream_1",
        title: "Epic Gaming Session - Ranked Games",
        streamer: "ProGamerTV",
        streamerId: "user_1",
        category: "gaming",
        viewerCount: 1247,
        peakViewers: 2340,
        isLive: true,
        tags: ["fps", "ranked", "competitive"],
        avatar: "P",
        startedAt: Date.now() - 7200000
      },
      {
        id: "stream_2",
        title: "Just Chatting - Movie Night",
        streamer: "ChillStreamer",
        streamerId: "user_2",
        category: "just_chatting",
        viewerCount: 456,
        peakViewers: 520,
        isLive: true,
        tags: ["chat", "movies", "relaxed"],
        avatar: "C",
        startedAt: Date.now() - 3600000
      },
      {
        id: "stream_3",
        title: "Creative Art Stream",
        streamer: "DigitalArtist",
        streamerId: "user_3",
        category: "creative",
        viewerCount: 234,
        peakViewers: 312,
        isLive: true,
        tags: ["art", "drawing", "creative"],
        avatar: "D",
        startedAt: Date.now() - 5400000
      },
      {
        id: "stream_4",
        title: "Music Production Session",
        streamer: "BeatMakerPro",
        streamerId: "user_4",
        category: "music",
        viewerCount: 189,
        peakViewers: 245,
        isLive: true,
        tags: ["music", "production", "beats"],
        avatar: "B",
        startedAt: Date.now() - 1800000
      }
    ];

    // Mock VODs
    state.vodList = [
      {
        id: "vod_1",
        title: "Yesterday's Epic Tournament Highlights",
        streamer: "ProGamerTV",
        duration: 3240,
        views: 5678,
        likes: 892,
        uploadedAt: Date.now() - 86400000,
        thumbnail: null,
        category: "gaming"
      },
      {
        id: "vod_2",
        title: "Complete Walkthrough - Part 1",
        streamer: "ProGamerTV",
        duration: 7200,
        views: 3456,
        likes: 567,
        uploadedAt: Date.now() - 172800000,
        thumbnail: null,
        category: "gaming"
      },
      {
        id: "vod_3",
        title: "Q&A Session - Answering Your Questions",
        streamer: "ChillStreamer",
        duration: 5400,
        views: 1234,
        likes: 234,
        uploadedAt: Date.now() - 259200000,
        thumbnail: null,
        category: "just_chatting"
      },
      {
        id: "vod_4",
        title: "Digital Art Timelapse - Cyberpunk City",
        streamer: "DigitalArtist",
        duration: 1800,
        views: 4567,
        likes: 1234,
        uploadedAt: Date.now() - 345600000,
        thumbnail: null,
        category: "creative"
      }
    ];

    // Update stats
    updateDashboardStats();
  }

  // ===== Event Listeners =====
  function setupEventListeners() {
    // Video player controls
    elements.btnPlayPause?.addEventListener("click", togglePlayPause);
    elements.btnVolume?.addEventListener("click", toggleMute);
    elements.volumeSlider?.addEventListener("input", handleVolumeChange);
    elements.seekSlider?.addEventListener("input", handleSeek);
    elements.btnFullscreen?.addEventListener("click", toggleFullscreen);
    elements.btnExitFullscreen?.addEventListener("click", exitFullscreen);
    elements.btnTheaterMode?.addEventListener("click", toggleTheaterMode);
    elements.btnToggleMiniChat?.addEventListener("click", toggleMiniChat);
    elements.btnCloseMiniChat?.addEventListener("click", () => elements.miniChatOverlay?.classList.remove("is-visible"));

    // Chat
    elements.chatTabLive?.addEventListener("click", () => switchChatTab("live"));
    elements.chatTabStats?.addEventListener("click", () => switchChatTab("stats"));
    elements.btnChatSend?.addEventListener("click", sendChatMessage);
    elements.chatInput?.addEventListener("keypress", (e) => {
      if (e.key === "Enter") sendChatMessage();
    });
    elements.btnClosePinned?.addEventListener("click", () => elements.pinnedMessage.hidden = true);

    // Reactions
    document.querySelectorAll(".reaction-btn").forEach(btn => {
      btn.addEventListener("click", () => sendReaction(btn.dataset.reaction));
    });

    // Stream actions
    elements.btnStartBroadcast?.addEventListener("click", () => switchToView("studio"));
    elements.btnGoStudio?.addEventListener("click", () => switchToView("studio"));
    elements.btnFollow?.addEventListener("click", toggleFollow);
    elements.btnSubscribe?.addEventListener("click", toggleSubscribe);
    elements.btnShare?.addEventListener("click", shareStream);

    // Chat panel toggle
    elements.btnToggleChat?.addEventListener("click", toggleChatPanel);

    // Filter buttons
    elements.filterButtons?.forEach(btn => {
      btn.addEventListener("click", handleFilterChange);
    });

    // Dashboard
    elements.btnGoLive?.addEventListener("click", () => switchToView("studio"));
    elements.btnUploadVod?.addEventListener("click", () => elements.uploadModal?.classList.add("is-visible"));

    // Studio
    elements.btnStartPreview?.addEventListener("click", startPreview);
    elements.btnStopPreview?.addEventListener("click", stopPreview);
    elements.btnTestStream?.addEventListener("click", testStream);
    elements.btnGoLiveStudio?.addEventListener("click", goLive);
    
    // Source selection
    elements.sourceCamera?.addEventListener("click", () => selectSource("camera"));
    elements.sourceScreen?.addEventListener("click", () => selectSource("screen"));
    elements.sourceGame?.addEventListener("click", () => selectSource("game"));
    elements.sourceImage?.addEventListener("click", () => selectSource("image"));
    
    // Scene selection
    document.querySelectorAll(".scene-item").forEach(item => {
      item.addEventListener("click", () => selectScene(item.dataset.scene));
    });
    elements.btnAddScene?.addEventListener("click", addScene);

    // Upload modal
    elements.btnCloseUploadModal?.addEventListener("click", () => elements.uploadModal?.classList.remove("is-visible"));
    elements.uploadDropzone?.addEventListener("click", () => elements.videoFileInput?.click());
    elements.videoFileInput?.addEventListener("change", handleVideoUpload);
    elements.btnCancelUpload?.addEventListener("click", () => elements.uploadModal?.classList.remove("is-visible"));
    elements.btnPublishVod?.addEventListener("click", publishVod);

    // VOD player modal
    elements.btnCloseVodPlayer?.addEventListener("click", closeVodPlayer);
    elements.btnPostComment?.addEventListener("click", postComment);

    // Logout
    el("logoutBtn")?.addEventListener("click", handleLogout);

    // Keyboard shortcuts
    document.addEventListener("keydown", handleKeyboard);
  }

  // ===== View Management =====
  function setupViewTabs() {
    const tabs = document.querySelectorAll(".view-tab");
    tabs.forEach(tab => {
      tab.addEventListener("click", () => switchToView(tab.dataset.view));
    });
  }

  function switchToView(viewName) {
    state.currentView = viewName;
    
    // Update tab states
    document.querySelectorAll(".view-tab").forEach(tab => {
      tab.classList.toggle("is-active", tab.dataset.view === viewName);
    });
    
    // Update view states
    document.querySelectorAll(".stream-view").forEach(view => {
      view.classList.remove("is-visible");
    });
    
    const targetView = el(`view${viewName.charAt(0).toUpperCase() + viewName.slice(1)}`);
    if (targetView) {
      targetView.classList.add("is-visible");
    }

    // Special handling for studio view
    if (viewName === "studio" && !state.isLoggedIn) {
      showToast("info", "Login erforderlich", "Bitte logge dich ein, um das Studio zu nutzen.");
    }
  }

  // ===== Profile Dropdown =====
  function setupProfileDropdown() {
    elements.profileBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      elements.profileDropdown?.classList.toggle("is-open");
    });

    document.addEventListener("click", () => {
      elements.profileDropdown?.classList.remove("is-open");
    });

    elements.profileMenu?.addEventListener("click", (e) => {
      e.stopPropagation();
    });

    // Dashboard link
    el("streamerDashboardLink")?.addEventListener("click", (e) => {
      e.preventDefault();
      switchToView("dashboard");
      elements.profileDropdown?.classList.remove("is-open");
    });

    // Upload link
    el("uploadVideoLink")?.addEventListener("click", (e) => {
      e.preventDefault();
      elements.uploadModal?.classList.add("is-visible");
      elements.profileDropdown?.classList.remove("is-open");
    });
  }

  async function handleLogout() {
    try {
      await auth.signOut();
      showToast("success", "Abgemeldet", "Du wurdest erfolgreich abgemeldet.");
      elements.profileDropdown?.classList.remove("is-open");
      await loadUserProfile();
    } catch (error) {
      showToast("error", "Fehler", "Abmeldung fehlgeschlagen.");
    }
  }

  // ===== Video Player Controls =====
  function togglePlayPause() {
    if (state.isPlaying) {
      state.isPlaying = false;
      elements.mainVideo?.pause();
      elements.btnPlayPause.innerHTML = '<i class="fa-solid fa-play"></i>';
    } else {
      state.isPlaying = true;
      elements.mainVideo?.play();
      elements.btnPlayPause.innerHTML = '<i class="fa-solid fa-pause"></i>';
    }
  }

  function toggleMute() {
    state.isMuted = !state.isMuted;
    elements.mainVideo.muted = state.isMuted;
    elements.btnVolume.innerHTML = state.isMuted 
      ? '<i class="fa-solid fa-volume-mute"></i>' 
      : '<i class="fa-solid fa-volume-up"></i>';
  }

  function handleVolumeChange(e) {
    state.volume = parseFloat(e.target.value);
    elements.mainVideo.volume = state.volume;
    if (state.volume === 0) {
      state.isMuted = true;
      elements.btnVolume.innerHTML = '<i class="fa-solid fa-volume-mute"></i>';
    } else if (state.isMuted) {
      state.isMuted = false;
      elements.mainVideo.muted = false;
      elements.btnVolume.innerHTML = '<i class="fa-solid fa-volume-up"></i>';
    }
  }

  function handleSeek(e) {
    const value = parseFloat(e.target.value);
    const time = (value / 100) * state.duration;
    elements.mainVideo.currentTime = time;
  }

  function toggleFullscreen() {
    if (!elements.videoPlayer) return;
    
    if (document.fullscreenElement) {
      document.exitFullscreen();
      state.isFullscreen = false;
    } else {
      elements.videoPlayer.requestFullscreen();
      state.isFullscreen = true;
    }
  }

  function exitFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    }
    state.isFullscreen = false;
    elements.btnExitFullscreen.hidden = true;
    elements.videoPlayer?.classList.remove("is-fullscreen");
  }

  function toggleTheaterMode() {
    document.body.classList.toggle("theater-mode");
  }

  function toggleMiniChat() {
    elements.miniChatOverlay?.classList.toggle("is-visible");
  }

  // ===== Chat Functions =====
  function switchChatTab(tab) {
    const isLive = tab === "live";
    
    elements.chatTabLive?.classList.toggle("is-active", isLive);
    elements.chatTabStats?.classList.toggle("is-active", !isLive);
    elements.chatViewLive?.classList.toggle("is-visible", isLive);
    elements.chatStatsPanel.hidden = isLive;
    state.isChatStatsVisible = !isLive;
  }

  function sendChatMessage() {
    const text = elements.chatInput?.value.trim();
    if (!text || !state.isLoggedIn) {
      showToast("info", "Chat", "Bitte logge dich ein, um zu chatten.");
      return;
    }

    const message = {
      id: Date.now(),
      text,
      author: state.userProfile?.displayName || state.user?.displayName || "User",
      timestamp: new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }),
      color: getRandomColor()
    };

    state.chatMessages.push(message);
    renderChatMessage(message);
    elements.chatInput.value = "";

    // Add to mini chat if visible
    if (elements.miniChatOverlay?.classList.contains("is-visible")) {
      renderMiniChatMessage(message);
    }
  }

  function renderChatMessage(msg) {
    if (!elements.chatMessages) return;

    // Remove empty state
    const emptyState = elements.chatMessages.querySelector(".chat-empty");
    if (emptyState) emptyState.remove();

    const div = document.createElement("div");
    div.className = "chat-message";
    div.innerHTML = `
      <div class="chat-message__header">
        <span class="chat-message__name" style="color: ${msg.color}">${escapeHtml(msg.author)}</span>
        <span class="chat-message__time">${msg.timestamp}</span>
      </div>
      <div class="chat-message__text">${escapeHtml(msg.text)}</div>
    `;

    elements.chatMessages.appendChild(div);
    elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
  }

  function renderMiniChatMessage(msg) {
    if (!elements.miniChatMessages) return;

    const div = document.createElement("div");
    div.className = "mini-chat-line";
    div.innerHTML = `
      <span class="mini-chat-line__name" style="color: ${msg.color}">${escapeHtml(msg.author)}:</span>
      <span class="mini-chat-line__text">${escapeHtml(msg.text)}</span>
    `;

    elements.miniChatMessages.appendChild(div);

    // Keep only last 10 messages
    while (elements.miniChatMessages.children.length > 10) {
      elements.miniChatMessages.removeChild(elements.miniChatMessages.firstChild);
    }
  }

  function sendReaction(reaction) {
    if (!state.isLoggedIn) {
      showToast("info", "Reactions", "Bitte logge dich ein, um zu reagieren.");
      return;
    }

    // Visual feedback
    showToast("success", "Reaction", `Du hast mit ${reaction} reagiert.`);
    
    // Could broadcast to chat in real implementation
  }

  // ===== Stream Management =====
  function renderStreams() {
    if (!elements.streamList) return;

    const html = state.streams.map(stream => `
      <div class="stream-list-item ${stream.id === state.selectedStreamId ? 'is-active' : ''}" 
           data-stream-id="${stream.id}">
        <div class="stream-list-item__thumb">
          <div style="width: 100%; height: 100%; background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); display: grid; place-items: center;">
            <i class="fa-solid fa-play" style="color: rgba(255,255,255,0.3); font-size: 24px;"></i>
          </div>
        </div>
        <div class="stream-list-item__info">
          <div class="stream-list-item__title">${escapeHtml(stream.title)}</div>
          <div class="stream-list-item__meta">
            <span><i class="fa-solid fa-user"></i> ${escapeHtml(stream.streamer)}</span>
            <span><i class="fa-solid fa-eye"></i> ${formatNumber(stream.viewerCount)}</span>
          </div>
        </div>
      </div>
    `).join("");

    elements.streamList.innerHTML = html;

    // Add click handlers
    elements.streamList.querySelectorAll(".stream-list-item").forEach(item => {
      item.addEventListener("click", () => selectStream(item.dataset.streamId));
    });
  }

  function selectStream(streamId) {
    state.selectedStreamId = streamId;
    const stream = state.streams.find(s => s.id === streamId);
    
    if (!stream) return;

    state.activeStream = stream;

    // Update UI
    elements.currentStreamTitle.textContent = stream.title;
    elements.currentCategory.innerHTML = `<i class="fa-solid fa-gamepad"></i><span>${getCategoryLabel(stream.category)}</span>`;
    elements.currentViewers.innerHTML = `<i class="fa-solid fa-eye"></i><span>${formatNumber(stream.viewerCount)} Zuschauer</span>`;
    elements.currentRuntime.innerHTML = `<i class="fa-solid fa-clock"></i><span>${formatDuration(Date.now() - stream.startedAt)}</span>`;

    // Update overlays
    elements.overlayStreamTitle.textContent = stream.title;
    elements.overlayStreamerName.textContent = stream.streamer;
    elements.streamTitleOverlay.hidden = false;
    elements.liveBadge.hidden = false;
    elements.viewerCountOverlay.hidden = false;
    elements.viewerCountDisplay.textContent = formatNumber(stream.viewerCount);
    elements.videoOverlay.hidden = true;

    // Update stats
    elements.statViewers.textContent = formatNumber(stream.viewerCount);
    elements.statPeak.textContent = formatNumber(stream.peakViewers);
    elements.statChatRate.textContent = Math.floor(Math.random() * 50) + 10;
    elements.statNewFollowers.textContent = Math.floor(Math.random() * 10);

    // Re-render streams to update active state
    renderStreams();

    // Start simulated viewer count updates
    startViewerCountSimulation(stream);
  }

  function startViewerCountSimulation(stream) {
    setInterval(() => {
      if (stream.id === state.selectedStreamId && stream.isLive) {
        const change = Math.floor(Math.random() * 20) - 10;
        stream.viewerCount = Math.max(0, stream.viewerCount + change);
        elements.viewerCountDisplay.textContent = formatNumber(stream.viewerCount);
        elements.currentViewers.innerHTML = `<i class="fa-solid fa-eye"></i><span>${formatNumber(stream.viewerCount)} Zuschauer</span>`;
      }
    }, 5000);
  }

  function handleFilterChange(e) {
    const filter = e.target.dataset.filter;
    
    elements.filterButtons.forEach(btn => {
      btn.classList.toggle("is-active", btn.dataset.filter === filter);
    });

    // Filter streams
    const filteredStreams = filter === "all" 
      ? state.streams 
      : state.streams.filter(s => s.category === filter);

    // Re-render with filtered data
    renderStreams();
  }

  // ===== Dashboard Functions =====
  function updateDashboardStats() {
    if (elements.dashTotalViews) elements.dashTotalViews.textContent = formatNumber(state.dashboardStats.totalViews);
    if (elements.dashTotalLikes) elements.dashTotalLikes.textContent = formatNumber(state.dashboardStats.totalLikes);
    if (elements.dashFollowers) elements.dashFollowers.textContent = formatNumber(state.dashboardStats.followers);
    if (elements.dashWatchTime) elements.dashWatchTime.textContent = `${state.dashboardStats.watchTime}h`;
  }

  function renderDashboard() {
    // Render recent streams table
    if (elements.recentStreamsBody) {
      const recentStreams = state.streams.slice(0, 5);
      elements.recentStreamsBody.innerHTML = recentStreams.map(stream => `
        <div class="table-row">
          <span>${escapeHtml(stream.title)}</span>
          <span>${formatDate(stream.startedAt)}</span>
          <span>${formatNumber(stream.viewerCount)}</span>
          <span>${formatNumber(stream.peakViewers)}</span>
          <span>${formatDuration(Date.now() - stream.startedAt)}</span>
        </div>
      `).join("");
    }

    // Render recent VODs
    if (elements.recentVodsGrid) {
      elements.recentVodsGrid.innerHTML = state.vodList.slice(0, 4).map(vod => renderVodCard(vod)).join("");
      attachVodCardListeners();
    }
  }

  // ===== VOD Functions =====
  function renderVods() {
    if (elements.vodsGrid) {
      elements.vodsGrid.innerHTML = state.vodList.map(vod => renderVodCard(vod)).join("");
      attachVodCardListeners();
    }
  }

  function renderVodCard(vod) {
    return `
      <div class="vod-card" data-vod-id="${vod.id}">
        <div class="vod-card__thumb">
          <div style="width: 100%; height: 100%; background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); display: grid; place-items: center;">
            <i class="fa-solid fa-play" style="color: rgba(255,255,255,0.3); font-size: 32px;"></i>
          </div>
          <span class="vod-card__duration">${formatTime(vod.duration)}</span>
        </div>
        <div class="vod-card__info">
          <div class="vod-card__title">${escapeHtml(vod.title)}</div>
          <div class="vod-card__meta">
            <span>${formatNumber(vod.views)} Aufrufe</span>
            <span>•</span>
            <span>${formatTimeAgo(vod.uploadedAt)}</span>
          </div>
        </div>
      </div>
    `;
  }

  function attachVodCardListeners() {
    document.querySelectorAll(".vod-card").forEach(card => {
      card.addEventListener("click", () => {
        const vod = state.vodList.find(v => v.id === card.dataset.vodId);
        if (vod) openVodPlayer(vod);
      });
    });
  }

  function openVodPlayer(vod) {
    state.currentVod = vod;
    
    elements.vodPlayerTitle.textContent = vod.title;
    elements.vodViewCount.textContent = formatNumber(vod.views);
    elements.vodLikeCount.textContent = formatNumber(vod.likes);
    elements.vodDate.textContent = formatDate(vod.uploadedAt);
    
    // Mock video (in real app, would load actual video)
    elements.vodVideoPlayer.poster = "";
    elements.vodVideoPlayer.src = "";
    
    elements.vodPlayerModal?.classList.add("is-visible");
    
    // Render comments
    renderComments(vod.id);
  }

  function closeVodPlayer() {
    elements.vodPlayerModal?.classList.remove("is-visible");
    state.currentVod = null;
    elements.vodVideoPlayer.pause();
  }

  function renderComments(vodId) {
    if (!elements.commentsList) return;

    // Mock comments
    const comments = [
      { author: "User123", text: "Tolles Video!", time: "vor 2 Stunden" },
      { author: "GamerPro", text: "Mega geil!", time: "vor 1 Stunde" },
      { author: "Neuling", text: "Kann mir jemand helfen?", time: "vor 30 Minuten" }
    ];

    elements.commentsList.innerHTML = comments.map(c => `
      <div class="comment-item">
        <div class="comment-item__avatar">${getInitials(c.author)}</div>
        <div class="comment-item__content">
          <div class="comment-item__header">
            <span class="comment-item__name">${escapeHtml(c.author)}</span>
            <span class="comment-item__time">${c.time}</span>
          </div>
          <div class="comment-item__text">${escapeHtml(c.text)}</div>
        </div>
      </div>
    `).join("");
  }

  function postComment() {
    const text = elements.commentInput?.value.trim();
    if (!text) return;

    const comment = {
      author: state.userProfile?.displayName || state.user?.displayName || "User",
      text,
      time: "jetzt"
    };

    const div = document.createElement("div");
    div.className = "comment-item";
    div.innerHTML = `
      <div class="comment-item__avatar">${getInitials(comment.author)}</div>
      <div class="comment-item__content">
        <div class="comment-item__header">
          <span class="comment-item__name">${escapeHtml(comment.author)}</span>
          <span class="comment-item__time">${comment.time}</span>
        </div>
        <div class="comment-item__text">${escapeHtml(comment.text)}</div>
      </div>
    `;

    elements.commentsList?.insertBefore(div, elements.commentsList.firstChild);
    elements.commentInput.value = "";
  }

  // ===== Studio Functions =====
  async function startPreview() {
    try {
      state.localStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: true
      });

      elements.previewVideo.srcObject = state.localStream;
      elements.previewOverlay.hidden = true;
      elements.btnStartPreview.disabled = true;
      elements.btnStopPreview.disabled = false;

      showToast("success", "Vorschau", "Kameravorschau gestartet.");
    } catch (error) {
      console.error("Camera access denied:", error);
      showToast("error", "Kamerafehler", "Konnte nicht auf Kamera zugreifen. Bitte erlaube den Zugriff.");
    }
  }

  function stopPreview() {
    if (state.localStream) {
      state.localStream.getTracks().forEach(track => track.stop());
      state.localStream = null;
    }

    elements.previewVideo.srcObject = null;
    elements.previewOverlay.hidden = false;
    elements.btnStartPreview.disabled = false;
    elements.btnStopPreview.disabled = true;

    showToast("info", "Vorschau", "Kameravorschau gestoppt.");
  }

  async function selectSource(source) {
    state.selectedVideoSource = source;

    // Update UI
    document.querySelectorAll(".source-btn").forEach(btn => {
      btn.classList.toggle("is-active", btn.dataset.source === source);
    });

    try {
      if (source === "camera") {
        if (state.localDisplay) {
          state.localDisplay.getTracks().forEach(track => track.stop());
        }
        state.localStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user" },
          audio: true
        });
      } else if (source === "screen") {
        if (state.localStream) {
          state.localStream.getTracks().forEach(track => track.stop());
        }
        state.localDisplay = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true
        });
        state.localStream = state.localDisplay;
      }

      elements.previewVideo.srcObject = state.localStream;
      elements.previewOverlay.hidden = true;
    } catch (error) {
      console.error("Source selection error:", error);
      showToast("error", "Fehler", "Konnte Videoquelle nicht laden.");
    }
  }

  function selectScene(sceneId) {
    state.activeScene = sceneId;

    document.querySelectorAll(".scene-item").forEach(item => {
      item.classList.toggle("is-active", item.dataset.scene === sceneId);
    });
  }

  function addScene() {
    const name = prompt("Szenenname:");
    if (name) {
      const id = "scene_" + Date.now();
      state.scenes.push({ id, name });
      renderScenes();
    }
  }

  function renderScenes() {
    if (!elements.scenesList) return;

    elements.scenesList.innerHTML = state.scenes.map(scene => `
      <div class="scene-item ${scene.id === state.activeScene ? 'is-active' : ''}" data-scene="${scene.id}">
        <span class="scene-name">${escapeHtml(scene.name)}</span>
        <button class="scene-edit-btn"><i class="fa-solid fa-pencil"></i></button>
      </div>
    `).join("");

    // Re-attach listeners
    document.querySelectorAll(".scene-item").forEach(item => {
      item.addEventListener("click", () => selectScene(item.dataset.scene));
    });
  }

  async function goLive() {
    if (!state.isLoggedIn) {
      showToast("info", "Login erforderlich", "Bitte logge dich ein, um live zu gehen.");
      return;
    }

    const title = elements.streamTitleInput?.value.trim();
    if (!title) {
      showToast("info", "Titel fehlt", "Bitte gib einen Stream-Titel ein.");
      return;
    }

    try {
      // Request camera/screen
      state.localStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });

      state.isBroadcasting = true;

      // Create stream document in Firestore
      const streamRef = db.collection("streams").doc();
      await streamRef.set({
        id: streamRef.id,
        title,
        category: elements.streamCategorySelect?.value || "gaming",
        tags: elements.streamTagsInput?.value?.split(",").map(t => t.trim()) || [],
        ownerId: state.user.uid,
        ownerName: state.userProfile?.displayName || state.user?.displayName || "User",
        status: "live",
        viewerCount: 0,
        peakViewers: 0,
        startedAt: firebase.firestore.FieldValue.serverTimestamp(),
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      showToast("success", "Live!", "Dein Stream ist jetzt live.");
      switchToView("watch");

      // Update UI
      elements.liveBadge.hidden = false;
      elements.videoOverlay.hidden = true;

    } catch (error) {
      console.error("Go live error:", error);
      showToast("error", "Fehler", "Stream konnte nicht gestartet werden.");
    }
  }

  function testStream() {
    showToast("info", "Test", "Stream-Test gestartet (Vorschau).");
  }

  // ===== Upload Functions =====
  function handleVideoUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    // Show progress
    elements.uploadProgress.hidden = false;
    elements.uploadDropzone.hidden = true;
    elements.btnPublishVod.disabled = false;

    // Simulate upload progress
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 15;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);
      }
      elements.uploadProgressFill.style.width = `${progress}%`;
      elements.uploadProgressText.textContent = `${Math.round(progress)}%`;
    }, 200);

    // Store file reference
    state.uploadFile = file;
    state.uploadFileName = file.name;
  }

  async function publishVod() {
    const title = elements.vodTitleInput?.value.trim();
    if (!title || !state.uploadFile) {
      showToast("info", "Fehlende Daten", "Bitte wähle ein Video aus und gib einen Titel ein.");
      return;
    }

    try {
      // In real implementation, upload to Firebase Storage
      const vodRef = db.collection("videos").doc();
      await vodRef.set({
        id: vodRef.id,
        title,
        description: elements.vodDescInput?.value.trim() || "",
        privacy: elements.vodPrivacySelect?.value || "public",
        ownerId: state.user.uid,
        ownerName: state.userProfile?.displayName || state.user?.displayName || "User",
        duration: 0,
        views: 0,
        likes: 0,
        comments: 0,
        thumbnail: null,
        videoUrl: null,
        uploadedAt: firebase.firestore.FieldValue.serverTimestamp(),
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      showToast("success", "Upload abgeschlossen", "Dein Video wurde veröffentlicht.");

      // Reset and close
      elements.uploadModal?.classList.remove("is-visible");
      resetUploadModal();

      // Refresh VODs
      await loadMockData();
      renderVods();

    } catch (error) {
      console.error("Upload error:", error);
      showToast("error", "Fehler", "Video konnte nicht hochgeladen werden.");
    }
  }

  function resetUploadModal() {
    elements.uploadDropzone.hidden = false;
    elements.uploadProgress.hidden = true;
    elements.uploadProgressFill.style.width = "0%";
    elements.vodTitleInput.value = "";
    elements.vodDescInput.value = "";
    elements.videoFileInput.value = "";
    elements.btnPublishVod.disabled = true;
    state.uploadFile = null;
  }

  // ===== Action Functions =====
  function toggleFollow() {
    if (!state.isLoggedIn) {
      showToast("info", "Login erforderlich", "Bitte logge dich ein, um zu folgen.");
      return;
    }
    showToast("success", "Follow", state.activeStream ? `Du folgst jetzt ${state.activeStream.streamer}.` : "Streamer gefolgt.");
  }

  function toggleSubscribe() {
    if (!state.isLoggedIn) {
      showToast("info", "Login erforderlich", "Bitte logge dich ein, um zu abonnieren.");
      return;
    }
    showToast("success", "Subscribe", "Vielen Dank für dein Abo!");
  }

  function shareStream() {
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({
        title: state.activeStream?.title || "Streaming Platform",
        text: "Schau dir diesen Stream an!",
        url
      });
    } else {
      navigator.clipboard.writeText(url);
      showToast("success", "Link kopiert", "Der Link wurde in die Zwischenablage kopiert.");
    }
  }

  function toggleChatPanel() {
    elements.chatPanel?.classList.toggle("is-collapsed");
    const icon = elements.btnToggleChat?.querySelector("i");
    if (icon) {
      icon.className = elements.chatPanel.classList.contains("is-collapsed") 
        ? "fa-solid fa-chevron-left" 
        : "fa-solid fa-chevron-right";
    }
  }

  // ===== Keyboard Shortcuts =====
  function handleKeyboard(e) {
    // Ignore if typing in input
    if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;

    switch (e.key) {
      case " ":
      case "k":
        e.preventDefault();
        togglePlayPause();
        break;
      case "m":
        toggleMute();
        break;
      case "f":
        toggleFullscreen();
        break;
      case "Escape":
        if (state.isFullscreen) exitFullscreen();
        break;
      case "1":
        switchToView("watch");
        break;
      case "2":
        switchToView("dashboard");
        break;
      case "3":
        switchToView("vods");
        break;
      case "4":
        switchToView("studio");
        break;
    }
  }

  // ===== Utility Functions =====
  function getCategoryLabel(cat) {
    const labels = {
      gaming: "Gaming",
      just_chatting: "Just Chatting",
      creative: "Creative",
      music: "Music",
      sports: "Sports",
      esports: "Esports"
    };
    return labels[cat] || cat;
  }

  function getInitials(name) {
    return String(name || "U")
      .split(" ")
      .map(n => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str || "";
    return div.innerHTML;
  }

  function formatNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
    if (num >= 1000) return (num / 1000).toFixed(1) + "K";
    return String(num);
  }

  function formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }

  function formatTime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    
    if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  function formatDate(timestamp) {
    return new Date(timestamp).toLocaleDateString("de-DE", {
      day: "numeric",
      month: "short",
      year: "numeric"
    });
  }

  function formatTimeAgo(timestamp) {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "jetzt";
    if (minutes < 60) return `vor ${minutes} Min`;
    if (hours < 24) return `vor ${hours} Std`;
    return `vor ${days} Tagen`;
  }

  function getRandomColor() {
    const colors = [
      "#00ff88", "#ff3366", "#ffbe3d", "#3b82f6", "#a855f7",
      "#ec4899", "#06b6d4", "#84cc16", "#f97316", "#6366f1"
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  function showToast(type, title, message) {
    if (!elements.toastContainer) return;

    const toast = document.createElement("div");
    toast.className = `toast toast--${type}`;
    toast.innerHTML = `
      <div class="toast__icon">
        <i class="fa-solid fa-${type === 'success' ? 'check' : type === 'error' ? 'times' : 'info'}"></i>
      </div>
      <div class="toast__content">
        <div class="toast__title">${escapeHtml(title)}</div>
        <div class="toast__message">${escapeHtml(message)}</div>
      </div>
      <button class="toast__close"><i class="fa-solid fa-times"></i></button>
    `;

    toast.querySelector(".toast__close").addEventListener("click", () => {
      toast.remove();
    });

    elements.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.remove();
    }, 5000);
  }

  // ===== Observer for fullscreen changes =====
  document.addEventListener("fullscreenchange", () => {
    state.isFullscreen = !!document.fullscreenElement;
    elements.videoPlayer?.classList.toggle("is-fullscreen", state.isFullscreen);
    elements.btnExitFullscreen.hidden = !state.isFullscreen;
  });

  // ===== Initialize on DOM ready =====
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

})();
