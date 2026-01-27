// js/connect-minimal.js v2 — 3-Column Layout Controller
// Manages groups list (left column), group selection, and auth state

(function () {
  "use strict";

  const DEBUG = false;
  const log = (...args) => {
    if (DEBUG) console.log(...args);
  };

  if (window.__ECHTLUCKY_CONNECT_MINIMAL_LOADED__) {
    console.warn("connect-minimal.js already loaded – skipping");
    return;
  }
  window.__ECHTLUCKY_CONNECT_MINIMAL_LOADED__ = true;

  let auth = null;
  let db = null;
  let firebase = null;
  const audioCtx =
    typeof window.AudioContext !== "undefined" ? new window.AudioContext() : null;

  async function waitForFirebase() {
    return new Promise((resolve) => {
      if (window.firebaseReady && window.auth && window.db) {
        auth = window.auth;
        db = window.db;
        firebase = window.firebase;
        log("✅ connect-minimal.js: Firebase ready");
        resolve();
        return;
      }

      const handler = () => {
        auth = window.auth;
        db = window.db;
        firebase = window.firebase;
        log("✅ connect-minimal.js: Firebase ready via event");
        resolve();
      };

      window.addEventListener("firebaseReady", handler, { once: true });
      setTimeout(() => resolve(), 5000);
    });
  }

  function playToneSequence(sequence) {
    if (!audioCtx) return;
    const now = audioCtx.currentTime;
    sequence.forEach(({ freq = 440, duration = 0.18, start = 0, type = "sine" }) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now + start);
      gain.gain.setValueAtTime(0, now + start);
      gain.gain.linearRampToValueAtTime(0.35, now + start + 0.01);
      gain.gain.setValueAtTime(0.35, now + start + duration - 0.02);
      gain.gain.linearRampToValueAtTime(0, now + start + duration);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now + start);
      osc.stop(now + start + duration);
    });
  }

  function playIncomingTone() {
    playToneSequence([
      { freq: 520, duration: 0.12, start: 0 },
      { freq: 640, duration: 0.12, start: 0.16 },
      { freq: 760, duration: 0.14, start: 0.32 }
    ]);
  }

  function playCallTone() {
    if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
    playToneSequence([
      { freq: 280, duration: 0.2, start: 0, type: "triangle" },
      { freq: 360, duration: 0.2, start: 0.18, type: "triangle" },
      { freq: 440, duration: 0.2, start: 0.36, type: "triangle" }
    ]);
  }

  function playHangupTone() {
    playToneSequence([
      { freq: 420, duration: 0.2, start: 0, type: "square" },
      { freq: 320, duration: 0.2, start: 0.18, type: "square" },
      { freq: 240, duration: 0.24, start: 0.36, type: "square" }
    ]);
  }

  let initialized = false;

  // DOM Elements
  const authStatusCard = document.getElementById("authStatusCard");
  const statusLabel = document.getElementById("statusLabel");
  const btnLogin = document.getElementById("btnLogin");
  const connectLayout = document.getElementById("connectLayout");
  const groupsListPanel = document.getElementById("groupsListPanel");
  const groupContextMenu = document.getElementById("groupContextMenu");
  const userContextMenu = document.getElementById("userContextMenu");
  const dmListPanel = document.getElementById("dmListPanel");
  const dmSearchInput = document.getElementById("dmSearchInput");
  const btnOpenAddFriend = document.getElementById("btnOpenAddFriend");
  const addFriendModal = document.getElementById("addFriendModal");
  const btnCloseAddFriendModal = document.getElementById("btnCloseAddFriendModal");
  const connectSettingsModal = document.getElementById("connectSettingsModal");
  const btnCloseConnectSettings = document.getElementById("btnCloseConnectSettings");
  const btnCreateGroup = document.getElementById("btnCreateGroup");
  const friendSearchInput = document.getElementById("friendSearchInput");
  const friendsSearchResults = document.getElementById("friendsSearchResults");
  const incomingCallModal = document.getElementById("incomingCallModal");
  const btnAcceptCall = document.getElementById("btnAcceptCall");
  const btnRejectCall = document.getElementById("btnRejectCall");
  const replyPreview = document.getElementById("replyPreview");
  const replyPreviewText = document.getElementById("replyPreviewText");
  const btnCancelReply = document.getElementById("btnCancelReply");
  const btnUserBarAccount = document.getElementById("btnUserBarAccount");
  const userBarAvatar = document.getElementById("userBarAvatar");
  const userBarName = document.getElementById("userBarName");
  const btnUserBarMute = document.getElementById("btnUserBarMute");
  const btnUserBarDeafen = document.getElementById("btnUserBarDeafen");
  const btnUserBarSettings = document.getElementById("btnUserBarSettings");

  let currentUser = null;
  let activeChatMode = "dm"; // "dm" | "group"
  let selectedDmUid = null;
  let selectedDmName = "";
  let selectedGroupId = null;
  let selectedGroupData = null;
  let selectedGroupUnsubscribe = null;
  let messagesUnsubscribe = null;
  let friendSearchTimeout = null;
  let currentUserFriends = [];
  const userCache = new Map(); // uid -> { displayName, email }
  const groupsCache = new Map(); // groupId -> groupData (from snapshot)
  let groupContextState = null; // { groupId, groupData }
  let userContextState = null; // { uid, name }
  let replyState = null; // { messageId, authorName, excerpt }
  const connectMainCard = document.querySelector(".connect-main-card");
  const mobileSwitcher = document.querySelector(".connect-mobile-switcher");

  // Presence (Firestone rules allow write only to /presence/{uid})
  let presenceHeartbeatTimer = null;
  let presenceListenersBound = false;
  const presenceCache = new Map(); // uid -> { state, lastActiveAtMs }
  const presenceCacheFetchedAt = new Map(); // uid -> ms
  const presenceCacheInFlight = new Set(); // uid

  async function writePresence(state) {
    if (!auth?.currentUser?.uid || !db || !firebase) return;

    try {
      await db.collection("presence").doc(auth.currentUser.uid).set(
        {
          state,
          page: "connect",
          lastActiveAt: firebase.firestore.FieldValue.serverTimestamp()
        },
        { merge: true }
      );
    } catch (e) {
      console.warn("Presence update fehlgeschlagen", e);
    }
  }

  function stopPresenceHeartbeat() {
    if (presenceHeartbeatTimer) {
      clearInterval(presenceHeartbeatTimer);
      presenceHeartbeatTimer = null;
    }
  }

  function startPresenceHeartbeat() {
    stopPresenceHeartbeat();

    // Immediate update + heartbeat (stale-data friendly; clients can treat old timestamps as offline)
    writePresence(document.hidden ? "away" : "online");

    presenceHeartbeatTimer = setInterval(() => {
      writePresence(document.hidden ? "away" : "online");
    }, 30000);

    if (!presenceListenersBound) {
      presenceListenersBound = true;

      document.addEventListener("visibilitychange", () => {
        writePresence(document.hidden ? "away" : "online");
      });

      window.addEventListener("beforeunload", () => {
        // Best-effort; might not complete, but helps on normal navigations.
        writePresence("offline");
      });
    }
  }

  async function refreshPresence(uids) {
    if (!auth?.currentUser?.uid || !db) return false;

    const now = Date.now();
    const unique = Array.from(new Set(uids || [])).filter(Boolean);

    const toFetch = unique.filter((uid) => {
      if (presenceCacheInFlight.has(uid)) return false;
      const last = presenceCacheFetchedAt.get(uid) || 0;
      return now - last > 20000;
    });

    if (!toFetch.length) return false;

    toFetch.forEach((uid) => presenceCacheInFlight.add(uid));

    let changed = false;
    await Promise.all(
      toFetch.map(async (uid) => {
        try {
          const snap = await db.collection("presence").doc(uid).get();
          const data = snap.exists ? snap.data() : null;
          const state = (data?.state && String(data.state)) || "offline";

          const ts = data?.lastActiveAt;
          const lastActiveAtMs =
            ts && typeof ts.toDate === "function" ? ts.toDate().getTime() : null;

          const next = { state, lastActiveAtMs };
          const prev = presenceCache.get(uid);
          if (!prev || prev.state !== next.state || prev.lastActiveAtMs !== next.lastActiveAtMs) {
            presenceCache.set(uid, next);
            changed = true;
          }
        } catch (_) {
          // Ignore presence fetch failures; default display stays "offline".
        } finally {
          presenceCacheFetchedAt.set(uid, now);
          presenceCacheInFlight.delete(uid);
        }
      })
    );

    return changed;
  }

  function getPresenceState(uid) {
    const cached = presenceCache.get(uid);
    if (!cached?.lastActiveAtMs) return "offline";

    const ageMs = Date.now() - cached.lastActiveAtMs;
    if (ageMs > 90000) return "offline";

    if (cached.state === "away") return "away";
    return "online";
  }
  const userCacheInFlight = new Set(); // uid

  // Escape HTML
  function escapeHtml(str) {
    const map = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    };
    return String(str || "").replace(/[&<>"']/g, (m) => map[m]);
  }

  function safeJsonParse(raw) {
    try {
      return JSON.parse(raw);
    } catch (_) {
      return null;
    }
  }

  function splitUserTag(displayName) {
    const s = String(displayName || "").trim();
    const m = s.match(/^(.*?)[#](\d{3,6})$/);
    if (!m) return null;

    const name = (m[1] || "").trim();
    const tag = (m[2] || "").trim();
    if (!name || !tag) return null;
    return { name, tag };
  }

  function renderUserDisplayName(displayName) {
    const parts = splitUserTag(displayName);
    if (!parts) return escapeHtml(displayName || "");

    return `${escapeHtml(parts.name)} <span class="user-tag"><i class="fa-solid fa-star" aria-hidden="true"></i>${escapeHtml(parts.tag)}</span>`;
  }

  function getDmKey(myUid, otherUid) {
    const a = String(myUid || "").trim();
    const b = String(otherUid || "").trim();
    const pair = [a, b].sort().join("_");
    return `echtlucky:dm:${pair}`;
  }

  function loadDmMessages(myUid, otherUid) {
    const key = getDmKey(myUid, otherUid);
    const data = safeJsonParse(localStorage.getItem(key) || "[]");
    return Array.isArray(data) ? data : [];
  }

  function saveDmMessages(myUid, otherUid, messages) {
    const key = getDmKey(myUid, otherUid);
    localStorage.setItem(key, JSON.stringify(messages || []));
  }

  function renderDmList() {
    if (!dmListPanel) return;
    const myUid = auth?.currentUser?.uid || currentUser?.uid;
    if (!myUid) {
      dmListPanel.innerHTML = '<div class="empty-state"><p>Bitte einloggen</p></div>';
      return;
    }

    const q = String(dmSearchInput?.value || "").trim().toLowerCase();
    const ids = Array.isArray(currentUserFriends) ? currentUserFriends.filter(Boolean) : [];

    if (!ids.length) {
      dmListPanel.innerHTML = '<div class="empty-state"><p>Keine Direktnachrichten</p></div>';
      return;
    }

    // Warm cache
    fetchUserProfiles(ids).catch(() => {});
    refreshPresence(ids).catch(() => {});

    const items = ids
      .map((uid) => {
        const { label, initials } = getCachedUserLabel(uid);
        const state = getPresenceState(uid);
        const stateLabel = state === "online" ? "Online" : state === "away" ? "Abwesend" : "Offline";
        return { uid, label, initials, state, stateLabel };
      })
      .filter((it) => !q || String(it.label).toLowerCase().includes(q))
      .slice(0, 60);

    dmListPanel.innerHTML = items
      .map((it) => {
        const active = selectedDmUid === it.uid && activeChatMode === "dm";
        return `
          <button class="dm-item${active ? " is-active" : ""}" type="button" data-dm-uid="${escapeHtml(it.uid)}" data-dm-name="${escapeHtml(it.label)}">
            <span class="dm-item__left">
              <span class="dm-item__avatar">${escapeHtml(it.initials)}</span>
              <span style="min-width:0;">
                <span class="dm-item__name">${renderUserDisplayName(it.label)}</span>
                <span class="dm-item__status">• ${escapeHtml(it.stateLabel)}</span>
              </span>
            </span>
          </button>
        `;
      })
      .join("");
  }

  function selectDm(uid, name) {
    activeChatMode = "dm";
    selectedDmUid = uid;
    selectedDmName = name || "";
    selectedGroupId = null;
    selectedGroupData = null;
    detachSelectedGroupListener();
    detachMessagesListener();

    const chatContainer = document.getElementById("chatContainer");
    const emptyChatState = document.getElementById("emptyChatState");
    if (chatContainer) chatContainer.hidden = false;
    if (emptyChatState) emptyChatState.hidden = true;

    const chatGroupTitle = document.getElementById("chatGroupTitle");
    if (chatGroupTitle) chatGroupTitle.textContent = name || "Direktnachricht";

    clearReplyState();

    const myUid = auth?.currentUser?.uid;
    const messages = myUid && uid ? loadDmMessages(myUid, uid) : [];
    renderMessages(messages);
    updateChatControls();
    renderDmList();
  }

  async function sendMessageToSelectedDm() {
    const myUid = auth?.currentUser?.uid;
    if (!myUid || !selectedDmUid) return;

    const input = document.getElementById("messageInput");
    const text = (input?.value || "").trim();
    if (!text) return;

    const authorName = auth.currentUser.displayName || (auth.currentUser.email ? auth.currentUser.email.split("@")[0] : "Du");

    const messages = loadDmMessages(myUid, selectedDmUid);
    const message = {
      id: `dm_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      authorUid: myUid,
      authorName,
      text,
      createdAt: new Date().toISOString()
    };

    if (replyState?.excerpt) {
      message.replyTo = {
        messageId: replyState.messageId || null,
        authorName: replyState.authorName || "",
        excerpt: String(replyState.excerpt || "").slice(0, 180)
      };
    }

    messages.push(message);
    saveDmMessages(myUid, selectedDmUid, messages.slice(-200));
    if (input) input.value = "";
    clearReplyState();
    renderMessages(messages);
  }

  function clearReplyState() {
    replyState = null;
    if (replyPreview) replyPreview.hidden = true;
    if (replyPreviewText) replyPreviewText.textContent = "";
  }

  function setReplyState(message) {
    if (!message) return;

    replyState = {
      messageId: message.id || null,
      authorName: message.authorName || "User",
      excerpt: String(message.text || "").trim().slice(0, 140)
    };

    if (replyPreviewText) {
      replyPreviewText.textContent = `${replyState.authorName}: ${replyState.excerpt}`;
    }
    if (replyPreview) replyPreview.hidden = false;
  }

  // Load current user's friends list
  function loadCurrentUserFriends() {
    if (!currentUser) return;

    try {
      db.collection("users")
        .doc(currentUser.uid)
        .onSnapshot((doc) => {
          currentUserFriends = doc.data()?.friends || [];
          renderDmList();
        });
    } catch (err) {
      console.error("Error loading friends:", err);
    }
  }

  // Load groups for current user
  function loadGroups() {
    if (!currentUser) return;

    try {
      db.collection("groups")
        .where("members", "array-contains", currentUser.uid)
        .onSnapshot((snapshot) => {
          groupsCache.clear();
          const stripData = [];

          // DM "home" entry at the top of the strip
          stripData.push({ id: "__dm__", name: "DM", unread: 0, color: "#00ff88", type: "dm" });

          if (!snapshot.empty) {
            // Legacy list (kept hidden in HTML, but still populated for quick context operations if needed)
            if (groupsListPanel) groupsListPanel.innerHTML = "";

            snapshot.forEach((doc) => {
              const group = doc.data();
              groupsCache.set(doc.id, group);

              if (groupsListPanel) {
                const div = document.createElement("div");
                div.className = "group-item";
                div.dataset.groupId = doc.id;
                if (selectedGroupId === doc.id) div.classList.add("is-active");

                div.innerHTML = `
                  <div class="group-item-name">${escapeHtml(group.name || "Gruppe")}</div>
                  <div class="group-item-meta">${group.members?.length || 0} Mitglieder</div>
                `;

                div.addEventListener("click", () => selectGroup(doc.id, group, div));
                div.addEventListener("contextmenu", (e) => {
                  e.preventDefault();
                  selectGroup(doc.id, group, div);
                  openGroupContextMenu(e.clientX, e.clientY, doc.id, group);
                });
                groupsListPanel.appendChild(div);
              }

              stripData.push({
                id: doc.id,
                name: group.name || "Gruppe",
                unread: group.unreadCount || group.unread || 0,
                color: group.meta?.color || "#00ff88",
                type: "group"
              });
            });
          } else {
            if (groupsListPanel) {
              groupsListPanel.innerHTML = '<div class="empty-state"><p>📭 Keine Gruppen</p></div>';
            }
          }

          // Create button at the bottom of the strip
          stripData.push({ id: "__create__", name: "+", unread: 0, color: "#00ff88", type: "create" });

          window.updateGroupStrip?.(stripData);
        });
    } catch (err) {
      console.error("Error loading groups:", err);
      if (groupsListPanel) {
        groupsListPanel.innerHTML = '<div class="empty-state"><p>⚠️ Fehler</p></div>';
      }
    }
  }

  // Select a group
  function selectGroup(groupId, groupData, clickedEl) {
    activeChatMode = "group";
    selectedDmUid = null;
    selectedDmName = "";
    selectedGroupId = groupId;
    selectedGroupData = groupData || null;
    
    // Update active state in list
    document.querySelectorAll(".group-item").forEach((item) => {
      item.classList.remove("is-active");
    });
    clickedEl?.classList.add("is-active");

    // Show chat container
    const chatContainer = document.getElementById("chatContainer");
    const emptyChatState = document.getElementById("emptyChatState");
    if (chatContainer) chatContainer.hidden = false;
    if (emptyChatState) emptyChatState.hidden = true;

    // Mobile: jump into chat panel after selecting a group
    if (connectMainCard && window.matchMedia && window.matchMedia("(max-width: 900px)").matches) {
      connectMainCard.setAttribute("data-mobile-panel", "middle");
      document.querySelectorAll(".connect-mobile-tab").forEach((b) => {
        const isActive = b.dataset.panel === "middle";
        b.classList.toggle("is-active", isActive);
        b.setAttribute("aria-selected", String(isActive));
      });
    }

    // Update chat header
    const chatGroupTitle = document.getElementById("chatGroupTitle");
    if (chatGroupTitle) chatGroupTitle.textContent = groupData.name || "Gruppe";

    clearReplyState();

    // Update member settings
    const groupNameInput = document.getElementById("groupNameInput");
    if (groupNameInput) groupNameInput.value = groupData.name || "Gruppe";

    const groupMemberCount = document.getElementById("groupMemberCount");
    if (groupMemberCount) groupMemberCount.value = groupData.members?.length || 0;

    attachSelectedGroupListener(groupId);
    attachMessagesListener(groupId);
    updateChatControls();

    // Dispatch event for other listeners (e.g. voice-chat)
    window.dispatchEvent(
      new CustomEvent("echtlucky:group-selected", {
        detail: { groupId, groupData }
      })
    );
  }

  function detachSelectedGroupListener() {
    if (selectedGroupUnsubscribe) {
      selectedGroupUnsubscribe();
      selectedGroupUnsubscribe = null;
    }
  }

  function canManageGroupMembers(groupDoc) {
    const uid = auth?.currentUser?.uid;
    if (!uid || !groupDoc) return false;
    if (groupDoc.createdBy === uid) return true;
    if (groupDoc.roles && groupDoc.roles[uid] === "admin") return true;
    return false;
  }

  function canDeleteGroup(groupDoc) {
    const uid = auth?.currentUser?.uid;
    if (!uid || !groupDoc) return false;
    // Destructive action: restrict to creator only.
    return groupDoc.createdBy === uid;
  }

  function closeGroupContextMenu() {
    if (!groupContextMenu) return;
    groupContextMenu.hidden = true;
    groupContextMenu.style.left = "";
    groupContextMenu.style.top = "";
    groupContextMenu.innerHTML = "";
    groupContextState = null;
  }

  function closeUserContextMenu() {
    if (!userContextMenu) return;
    userContextMenu.hidden = true;
    userContextMenu.style.left = "";
    userContextMenu.style.top = "";
    userContextMenu.innerHTML = "";
    userContextState = null;
  }

  function positionContextMenu(x, y) {
    if (!groupContextMenu) return;

    const margin = 10;
    const vw = window.innerWidth || 0;
    const vh = window.innerHeight || 0;

    // Place near cursor first; then clamp into viewport after measuring.
    groupContextMenu.style.left = `${Math.max(margin, Math.min(x, vw - margin))}px`;
    groupContextMenu.style.top = `${Math.max(margin, Math.min(y, vh - margin))}px`;

    const rect = groupContextMenu.getBoundingClientRect();
    let left = rect.left;
    let top = rect.top;

    if (rect.right > vw - margin) left = Math.max(margin, vw - margin - rect.width);
    if (rect.bottom > vh - margin) top = Math.max(margin, vh - margin - rect.height);

    groupContextMenu.style.left = `${left}px`;
    groupContextMenu.style.top = `${top}px`;
  }

  function positionUserContextMenu(x, y) {
    if (!userContextMenu) return;

    const margin = 10;
    const vw = window.innerWidth || 0;
    const vh = window.innerHeight || 0;

    userContextMenu.style.left = `${Math.max(margin, Math.min(x, vw - margin))}px`;
    userContextMenu.style.top = `${Math.max(margin, Math.min(y, vh - margin))}px`;

    const rect = userContextMenu.getBoundingClientRect();
    let left = rect.left;
    let top = rect.top;

    if (rect.right > vw - margin) left = Math.max(margin, vw - margin - rect.width);
    if (rect.bottom > vh - margin) top = Math.max(margin, vh - margin - rect.height);

    userContextMenu.style.left = `${left}px`;
    userContextMenu.style.top = `${top}px`;
  }

  function renderContextMenuItems(items) {
    if (!groupContextMenu) return;

    groupContextMenu.innerHTML = items
      .map((it) => {
        if (it.type === "sep") return '<div class="context-menu__sep" role="separator"></div>';
        const variantAttr = it.variant ? ` data-variant="${escapeHtml(it.variant)}"` : "";
        const hint = it.hint ? `<span class="context-menu__hint">${escapeHtml(it.hint)}</span>` : "";
        return `<button class="context-menu__item" type="button" data-action="${escapeHtml(it.action)}"${variantAttr} role="menuitem">${escapeHtml(it.label)}${hint}</button>`;
      })
      .join("");
  }

  function renderUserContextMenuItems(items) {
    if (!userContextMenu) return;

    userContextMenu.innerHTML = items
      .map((it) => {
        if (it.type === "sep") return '<div class="context-menu__sep" role="separator"></div>';
        const variantAttr = it.variant ? ` data-variant="${escapeHtml(it.variant)}"` : "";
        const hint = it.hint ? `<span class="context-menu__hint">${escapeHtml(it.hint)}</span>` : "";
        return `<button class="context-menu__item" type="button" data-action="${escapeHtml(it.action)}"${variantAttr} role="menuitem">${escapeHtml(it.label)}${hint}</button>`;
      })
      .join("");
  }

  function getMutedFriendsKey() {
    const myUid = auth?.currentUser?.uid || currentUser?.uid || "";
    return `echtlucky:friends-muted:${myUid}`;
  }

  function readMutedFriendsSet() {
    const arr = safeJsonParse(localStorage.getItem(getMutedFriendsKey()) || "[]");
    return new Set(Array.isArray(arr) ? arr : []);
  }

  function writeMutedFriendsSet(set) {
    localStorage.setItem(getMutedFriendsKey(), JSON.stringify(Array.from(set || [])));
  }

  async function showUserProfile(uid, fallbackName) {
    const { label, initials } = getCachedUserLabel(uid);
    const name = fallbackName || label || `User ${String(uid || "").slice(0, 6)}`;
    const state = getPresenceState(uid);
    const stateLabel = state === "online" ? "Online" : state === "away" ? "Abwesend" : "Offline";

    await window.echtluckyModal?.alert?.({
      title: "Profil",
      message: `${name}\n\nStatus: ${stateLabel}\nTag: ${initials}`,
      confirmText: "OK"
    });
  }

  function openUserContextMenu(x, y, targetUid, targetName, source = "member") {
    if (!userContextMenu) return;
    if (!targetUid) return;
    if (targetUid === auth?.currentUser?.uid) return;

    const isFriend = Array.isArray(currentUserFriends) && currentUserFriends.includes(targetUid);
    const muted = readMutedFriendsSet().has(targetUid);

    const items = [];

    if (source === "friend") {
      items.push({ action: "view-profile", label: "Profil ansehen" });
      items.push({ action: "toggle-mute", label: muted ? "Stummschaltung aufheben" : "Stummschalten" });
      items.push({ type: "sep" });
      items.push({ action: "remove-friend", label: "Aus Freundesliste entfernen", variant: "danger" });
      items.push({ type: "sep" });
      items.push({ action: "copy-name", label: "Benutzername kopieren", hint: "⧉" });
    } else {
      if (isFriend) {
        items.push({ action: "remove-friend", label: "Aus Freundesliste entfernen", variant: "danger" });
      } else {
        items.push({ action: "add-friend", label: "Freund hinzufügen" });
      }
      items.push({ type: "sep" });
      items.push({ action: "copy-name", label: "Benutzername kopieren", hint: "⧉" });
    }

    userContextState = { uid: targetUid, name: targetName || "", source };
    renderUserContextMenuItems(items);
    userContextMenu.hidden = false;
    positionUserContextMenu(x, y);

    userContextMenu.querySelector(".context-menu__item")?.focus?.();
  }

  async function removeFriend(friendUid, friendName) {
    if (!currentUser || !db || !friendUid || !firebase) return;

    try {
      await db.collection("users").doc(currentUser.uid).update({
        friends: firebase.firestore.FieldValue.arrayRemove(friendUid)
      });

      window.notify?.show({
        type: "success",
        title: "Entfernt",
        message: `${friendName || "User"} wurde entfernt.`,
        duration: 3500
      });
    } catch (err) {
      console.error("removeFriend error:", err);
      window.notify?.show({
        type: "error",
        title: "Fehler",
        message: "Konnte Freund nicht entfernen",
        duration: 4000
      });
    }
  }

  async function renameGroup(groupId, groupDoc) {
    if (!groupId || !groupDoc) return;
    if (!canManageGroupMembers(groupDoc)) {
      window.notify?.show({
        type: "warn",
        title: "Keine Berechtigung",
        message: "Du darfst diese Gruppe nicht verwalten.",
        duration: 3500
      });
      return;
    }

    const nextName = await window.echtluckyModal?.input?.({
      title: "Gruppe umbenennen",
      placeholder: "Neuer Gruppenname…",
      confirmText: "Speichern",
      cancelText: "Abbrechen",
      initialValue: groupDoc.name || ""
    });

    if (!nextName) return;

    try {
      await db.collection("groups").doc(groupId).update({ name: String(nextName).slice(0, 60) });
      window.notify?.show({
        type: "success",
        title: "Gespeichert",
        message: "Gruppenname aktualisiert.",
        duration: 2500
      });
    } catch (err) {
      console.error("renameGroup error:", err);
      window.notify?.show({
        type: "error",
        title: "Fehler",
        message: "Konnte nicht umbenennen.",
        duration: 4500
      });
    }
  }

  function focusAddMemberUi(groupDoc) {
    if (!groupDoc || !canManageGroupMembers(groupDoc)) {
      window.notify?.show({
        type: "warn",
        title: "Keine Berechtigung",
        message: "Du darfst keine Mitglieder hinzufügen.",
        duration: 3500
      });
      return;
    }

    // Mobile: switch to members panel
    if (connectMainCard && window.matchMedia && window.matchMedia("(max-width: 900px)").matches) {
      connectMainCard.setAttribute("data-mobile-panel", "right");
      document.querySelectorAll(".connect-mobile-tab").forEach((b) => {
        const isActive = b.dataset.panel === "right";
        b.classList.toggle("is-active", isActive);
        b.setAttribute("aria-selected", String(isActive));
      });
    }

    const membersAddSection = document.getElementById("membersAddSection");
    if (membersAddSection) membersAddSection.hidden = false;

    const input = document.getElementById("addMemberInput");
    input?.focus?.();
    input?.select?.();
  }

  function openGroupContextMenu(x, y, groupId, groupDoc) {
    if (!groupContextMenu) return;

    const items = [];
    if (!groupId || !groupDoc) {
      items.push({ action: "create", label: "Neue Gruppe erstellen", hint: "+" });
    } else {
      items.push({ action: "rename", label: "Umbenennen" });
      items.push({ action: "add-member", label: "Mitglied hinzufügen" });
      items.push({ type: "sep" });
      items.push({ action: "leave", label: "Gruppe verlassen" });
      if (canDeleteGroup(groupDoc)) {
        items.push({ action: "delete", label: "Gruppe löschen", variant: "danger" });
      }
    }

    groupContextState = groupId ? { groupId, groupData: groupDoc } : null;
    renderContextMenuItems(items);
    groupContextMenu.hidden = false;
    positionContextMenu(x, y);

    groupContextMenu.querySelector(".context-menu__item")?.focus?.();
  }

  function getCachedUserLabel(uid) {
    if (!uid) return { label: "User", initials: "U" };

    const cached = userCache.get(uid);
    const displayName =
      cached?.displayName ||
      cached?.email?.split("@")?.[0] ||
      `User ${String(uid).slice(0, 6)}`;

    const initials = String(displayName || "U")
      .trim()
      .split(/\s+/)
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

    return { label: displayName, initials: initials || "U" };
  }

  async function fetchUserProfiles(uids) {
    if (!db) return;

    const toFetch = Array.from(new Set(uids || []))
      .filter(Boolean)
      .filter((uid) => !userCache.has(uid))
      .filter((uid) => !userCacheInFlight.has(uid));

    if (!toFetch.length) return;

    toFetch.forEach((uid) => userCacheInFlight.add(uid));

    try {
      await Promise.all(
        toFetch.map(async (uid) => {
          try {
            const snap = await db.collection("users").doc(uid).get();
            const data = snap.exists ? snap.data() : null;
            const displayName = data?.displayName || "";
            const email = data?.email || "";
            userCache.set(uid, { displayName, email });
          } catch (_) {
            userCache.set(uid, { displayName: "", email: "" });
          } finally {
            userCacheInFlight.delete(uid);
          }
        })
      );
    } catch (_) {
      toFetch.forEach((uid) => userCacheInFlight.delete(uid));
    }
  }

  function renderMembers(groupDoc) {
    const membersList = document.getElementById("membersList");
    const membersCount = document.getElementById("membersCount");
    if (!membersList || !membersCount) return;

    const members = Array.isArray(groupDoc?.members) ? groupDoc.members : [];
    membersCount.textContent = String(members.length);

    if (members.length === 0) {
      membersList.innerHTML = '<div class="empty-state"><p>Keine Mitglieder</p></div>';
      return;
    }

    const uid = auth?.currentUser?.uid;

    // Fetch missing profiles in background and re-render after load.
    const missing = members.filter((m) => m && !userCache.has(m) && m !== uid);
    if (missing.length) {
      fetchUserProfiles(missing).then(() => {
        if (selectedGroupId === groupDoc?.id || selectedGroupId) {
          // Re-render to show names once cache is warm
          renderMembers(groupDoc);
        }
      });
    }

    // Presence fetch in background and re-render after cache update.
    refreshPresence(members).then((changed) => {
      if (changed && selectedGroupId) renderMembers(groupDoc);
    });

    membersList.innerHTML = members
      .map((memberUid) => {
        const { label: cachedLabel, initials: cachedInitials } = getCachedUserLabel(memberUid);
        const label = memberUid === uid ? "Du" : cachedLabel;
        const initials = memberUid === uid ? "DU" : cachedInitials;
        const presenceState = memberUid === uid ? (document.hidden ? "away" : "online") : getPresenceState(memberUid);
        const presenceText = presenceState === "online" ? "Online" : presenceState === "away" ? "Abwesend" : "Offline";
        const dataUid = escapeHtml(memberUid);
        const dataName = escapeHtml(label);
        return `
          <div class="member-item" data-user-uid="${dataUid}" data-user-name="${dataName}">
            <div class="member-info">
              <div class="member-avatar">${escapeHtml(initials)}</div>
              <div class="member-details">
                <div class="member-name">${renderUserDisplayName(label)}</div>
                <div class="member-status-row">
                  <span class="member-presence-dot" data-state="${escapeHtml(presenceState)}"></span>
                  <span class="member-status-text">${escapeHtml(presenceText)}</span>
                </div>
              </div>
            </div>
          </div>
        `;
      })
      .join("");
  }

  function applyGroupUi(groupDoc) {
    if (!groupDoc) return;

    const groupNameInput = document.getElementById("groupNameInput");
    if (groupNameInput) groupNameInput.value = groupDoc.name || "Gruppe";

    const groupMemberCount = document.getElementById("groupMemberCount");
    if (groupMemberCount) groupMemberCount.value = Array.isArray(groupDoc.members) ? groupDoc.members.length : 0;

    const chatGroupTitle = document.getElementById("chatGroupTitle");
    if (chatGroupTitle) chatGroupTitle.textContent = groupDoc.name || "Gruppe";

    const membersAddSection = document.getElementById("membersAddSection");
    const allowAdd = canManageGroupMembers(groupDoc);
    if (membersAddSection) membersAddSection.hidden = !allowAdd;

    renderMembers(groupDoc);
    updateChatControls();
  }

  function attachSelectedGroupListener(groupId) {
    detachSelectedGroupListener();
    if (!groupId || !db) return;

    selectedGroupUnsubscribe = db
      .collection("groups")
      .doc(groupId)
      .onSnapshot((snap) => {
        if (!snap.exists) {
          selectedGroupData = null;
          return;
        }
        selectedGroupData = snap.data() || null;
        applyGroupUi(selectedGroupData);
      });
  }

  function detachMessagesListener() {
    if (messagesUnsubscribe) {
      messagesUnsubscribe();
      messagesUnsubscribe = null;
    }
  }

  function renderMessages(messages) {
    const list = document.getElementById("messagesList");
    if (!list) return;

    if (!messages || !messages.length) {
      list.innerHTML = '<div class="empty-state"><p>Noch keine Nachrichten</p></div>';
      return;
    }

    const myUid = auth?.currentUser?.uid;

    const ids = (messages || []).map((m) => m?.authorUid).filter(Boolean);
    const missing = ids.filter((uid) => uid && uid !== myUid && !userCache.has(uid) && !userCacheInFlight.has(uid));
    if (missing.length) {
      fetchUserProfiles(missing).then(() => renderMessages(messages));
    }

    const formatTime = (createdAt) => {
      try {
        const d =
          createdAt?.toDate?.() ||
          (createdAt instanceof Date ? createdAt : null) ||
          (typeof createdAt === "string" ? new Date(createdAt) : null);
        if (!d) return "";
        return d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
      } catch (_) {
        return "";
      }
    };

    const reactionKey = activeChatMode === "group" && selectedGroupId && myUid ? `echtlucky:reacted:${selectedGroupId}:${myUid}` : null;
    const reactedIds = reactionKey ? new Set(safeJsonParse(localStorage.getItem(reactionKey) || "[]") || []) : new Set();

    list.innerHTML = messages
      .map((m) => {
        const authorUid = m.authorUid;
        const author = authorUid === myUid ? "Du" : (userCache.get(authorUid)?.displayName || m.authorName || `User ${String(authorUid || "").slice(0, 6)}`);
        const text = m.text || "";
        const isMine = m.authorUid === myUid;
        const time = formatTime(m.createdAt);
        const idAttr = m.id ? ` data-message-id="${escapeHtml(m.id)}"` : "";
        const hasReply = !!m.replyTo?.excerpt;
        const hasReaction = !!(m.id && reactedIds.has(m.id)) || !!m.reactionsCount;

        const quote = hasReply
          ? `<div class="message-quote"><strong>${escapeHtml(m.replyTo.authorName || "User")}:</strong> ${escapeHtml(m.replyTo.excerpt || "")}</div>`
          : "";

        return `
          <div class="message${isMine ? " is-mine" : ""}${hasReply ? " has-reply" : ""}${hasReaction ? " has-reaction" : ""}"${idAttr}>
            <div class="message-actions">
              <button class="message-action" type="button" data-action="reply" aria-label="Antworten">↩</button>
              <button class="message-action" type="button" data-action="react" aria-label="Reaktion">❤</button>
            </div>
            <div class="message-author">${renderUserDisplayName(author)}</div>
            ${quote}
            <div class="message-text">${escapeHtml(text)}</div>
            ${time ? `<div class="message-time">${escapeHtml(time)}</div>` : ""}
          </div>
        `;
      })
      .join("");

    list.scrollTop = list.scrollHeight;
  }

  function attachMessagesListener(groupId) {
    detachMessagesListener();
    if (!groupId || !db) return;

    messagesUnsubscribe = db
      .collection("groups")
      .doc(groupId)
      .collection("messages")
      .orderBy("createdAt", "asc")
      .limit(200)
      .onSnapshot((snap) => {
        const messages = [];
        snap.forEach((doc) => messages.push({ id: doc.id, ...(doc.data() || {}) }));
        renderMessages(messages);
        updateChatControls();
      });
  }

  async function sendMessageToSelectedGroup() {
    if (!selectedGroupId || !auth?.currentUser?.uid) return;

    const input = document.getElementById("messageInput");
    const text = (input?.value || "").trim();
    if (!text) return;

    try {
      const user = auth.currentUser;
      const members = Array.isArray(selectedGroupData?.members) ? selectedGroupData.members : [];
      if (!members.includes(user.uid)) {
        window.notify?.show({
          type: "error",
          title: "Keine Berechtigung",
          message: "Du bist kein Mitglied dieser Gruppe.",
          duration: 4500
        });
        return;
      }

      const authorName =
        user.displayName || (user.email ? user.email.split("@")[0] : "User");

      const payload = {
        authorUid: user.uid,
        authorName,
        text,
        createdAt: new Date(),
        createdAtServer: firebase?.firestore?.FieldValue?.serverTimestamp?.()
      };

      if (replyState?.excerpt) {
        payload.replyTo = {
          messageId: replyState.messageId || null,
          authorName: replyState.authorName || "",
          excerpt: String(replyState.excerpt || "").slice(0, 180)
        };
      }

      await db.collection("groups").doc(selectedGroupId).collection("messages").add(payload);

      if (input) input.value = "";
      clearReplyState();
    } catch (err) {
      console.error("sendMessageToSelectedGroup error:", err);
      window.notify?.show({
        type: "error",
        title: "Fehler",
        message: "Nachricht konnte nicht gesendet werden.",
        duration: 4500
      });
    }
  }

  function updateChatControls() {
    const input = document.getElementById("messageInput");
    const btn = document.getElementById("btnSendMessage");

    const hasAuth = !!auth?.currentUser?.uid;

    let enabled = false;
    if (activeChatMode === "group") {
      const hasGroup = !!selectedGroupId;
      const members = Array.isArray(selectedGroupData?.members) ? selectedGroupData.members : [];
      const isMember = hasAuth ? members.includes(auth.currentUser.uid) : false;
      enabled = hasAuth && hasGroup && isMember;
    } else {
      enabled = hasAuth && !!selectedDmUid;
    }

    if (input) input.disabled = !enabled;
    if (btn) btn.disabled = !enabled;
  }

  async function searchUsersForGroup(query) {
    if (!currentUser || !selectedGroupId) return [];

    const lowerQuery = String(query || "").toLowerCase();
    if (!lowerQuery) return [];

    const snap = await db.collection("users").get();
    const groupMembers = Array.isArray(selectedGroupData?.members) ? selectedGroupData.members : [];

    const results = [];
    snap.forEach((doc) => {
      const user = doc.data() || {};
      const uid = doc.id;
      const displayName = user.displayName || user.email?.split("@")[0] || "User";

      if (uid === currentUser.uid) return;
      if (groupMembers.includes(uid)) return;

      if (
        String(displayName).toLowerCase().includes(lowerQuery) ||
        String(user.email || "").toLowerCase().includes(lowerQuery)
      ) {
        results.push({ uid, displayName, email: user.email || "" });
      }
    });

    return results.slice(0, 12);
  }

  async function addMemberToSelectedGroup(memberUid) {
    if (!selectedGroupId || !memberUid) return;

    try {
      await db.collection("groups").doc(selectedGroupId).update({
        members: firebase.firestore.FieldValue.arrayUnion(memberUid)
      });

      window.notify?.show({
        type: "success",
        title: "Erfolgreich",
        message: "Mitglied hinzugefügt.",
        duration: 3000
      });
    } catch (err) {
      console.error("addMemberToSelectedGroup error:", err);
      window.notify?.show({
        type: "error",
        title: "Fehler",
        message: "Konnte Mitglied nicht hinzufügen (keine Berechtigung?).",
        duration: 4500
      });
    }
  }

  function wireAddMemberSearchUI() {
    const addMemberInput = document.getElementById("addMemberInput");
    const addMemberResults = document.getElementById("addMemberResults");
    const modalSearchInput = document.getElementById("addMemberSearchInput");
    const modalResults = document.getElementById("modalMemberResults");

    let addMemberSearchTimer = null;
    let modalSearchTimer = null;

    async function renderResults(targetEl, query) {
      if (!targetEl) return;

      if (!selectedGroupId) {
        targetEl.innerHTML = '<div class="empty-state"><p>Bitte wähle eine Gruppe aus.</p></div>';
        return;
      }

      if (!query || query.trim().length < 2) {
        targetEl.innerHTML = '<div class="empty-state"><p>🔍 Suche…</p></div>';
        return;
      }

      targetEl.innerHTML = '<div class="empty-state"><p>🔍 Suche…</p></div>';

      let users = [];
      try {
        users = await searchUsersForGroup(query.trim());
      } catch (e) {
        console.error("searchUsersForGroup error:", e);
        targetEl.innerHTML = '<div class="empty-state"><p>❌ Fehler bei der Suche</p></div>';
        return;
      }

      if (!users.length) {
        targetEl.innerHTML = '<div class="empty-state"><p>😞 Keine Benutzer gefunden</p></div>';
        return;
      }

      targetEl.innerHTML = users
        .map((u) => {
          const initials = String(u.displayName || "U")
            .split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase()
            .substring(0, 2);

          return `
            <div class="member-search-item">
              <div class="member-search-item__label">
                <span class="member-search-item__initials">${escapeHtml(initials)}</span>
                <span class="member-search-item__name">${renderUserDisplayName(u.displayName)}</span>
              </div>
              <button class="btn btn-sm" data-add-member="${escapeHtml(u.uid)}">➕</button>
            </div>
          `;
        })
        .join("");

      targetEl.querySelectorAll("button[data-add-member]").forEach((btn) => {
        btn.addEventListener("click", async (e) => {
          const uid = e.currentTarget.dataset.addMember;
          await addMemberToSelectedGroup(uid);
          if (addMemberInput) addMemberInput.value = "";
          if (modalSearchInput) modalSearchInput.value = "";
          await renderResults(targetEl, "");
        });
      });
    }

    if (addMemberInput && addMemberResults) {
      addMemberInput.addEventListener("input", (e) => {
        clearTimeout(addMemberSearchTimer);
        const q = e.target.value;
        addMemberSearchTimer = setTimeout(() => {
          renderResults(addMemberResults, q);
        }, 250);
      });
    }

    if (modalSearchInput && modalResults) {
      modalSearchInput.addEventListener("input", (e) => {
        clearTimeout(modalSearchTimer);
        const q = e.target.value;
        modalSearchTimer = setTimeout(() => {
          renderResults(modalResults, q);
        }, 250);
      });
    }
  }

  async function leaveSelectedGroup() {
    if (!auth?.currentUser?.uid || !selectedGroupId) return;

    const ok = await window.echtluckyModal?.confirm?.({
      title: "Gruppe verlassen",
      message: "Willst du diese Gruppe wirklich verlassen?",
      cancelText: "Abbrechen",
      confirmText: "Verlassen",
      type: "warning"
    });

    if (!ok) return;

    try {
      const uid = auth.currentUser.uid;
      await db.collection("groups").doc(selectedGroupId).update({
        members: firebase.firestore.FieldValue.arrayRemove(uid)
      });

      window.notify?.show({
        type: "success",
        title: "Erledigt",
        message: "Du hast die Gruppe verlassen.",
        duration: 3500
      });

      selectedGroupId = null;
      selectedGroupData = null;
      detachSelectedGroupListener();
      detachMessagesListener();

      const chatContainer = document.getElementById("chatContainer");
      const emptyChatState = document.getElementById("emptyChatState");
      if (chatContainer) chatContainer.hidden = true;
      if (emptyChatState) emptyChatState.hidden = false;
    } catch (err) {
      console.error("leaveSelectedGroup error:", err);
      window.notify?.show({
        type: "error",
        title: "Fehler",
        message: "Konnte die Gruppe nicht verlassen.",
        duration: 4500
      });
    }
  }

  async function deleteSelectedGroup() {
    if (!auth?.currentUser?.uid || !selectedGroupId) return;

    const ok = await window.echtluckyModal?.confirm?.({
      title: "Gruppe löschen",
      message: "Diese Aktion kann nicht rückgängig gemacht werden. Gruppe wirklich löschen?",
      cancelText: "Abbrechen",
      confirmText: "Löschen",
      type: "danger"
    });

    if (!ok) return;

    try {
      await db.collection("groups").doc(selectedGroupId).delete();

      window.notify?.show({
        type: "success",
        title: "Gelöscht",
        message: "Die Gruppe wurde gelöscht.",
        duration: 3500
      });

      selectedGroupId = null;
      selectedGroupData = null;
      detachSelectedGroupListener();
      detachMessagesListener();

      const chatContainer = document.getElementById("chatContainer");
      const emptyChatState = document.getElementById("emptyChatState");
      if (chatContainer) chatContainer.hidden = true;
      if (emptyChatState) emptyChatState.hidden = false;
    } catch (err) {
      console.error("deleteSelectedGroup error:", err);
      window.notify?.show({
        type: "error",
        title: "Fehler",
        message: "Konnte die Gruppe nicht löschen (keine Berechtigung?).",
        duration: 4500
      });
    }
  }

  function initGroupSettingsModal() {
    const modal = document.getElementById("groupSettingsModal");
    const btnOpen = document.getElementById("btnGroupSettings");
    const btnClose = document.getElementById("closeGroupSettings");

    if (!modal || !btnOpen || !btnClose) return;

    const open = () => {
      // Settings are mobile-only (button is hidden on desktop, but keep a runtime guard).
      if (window.matchMedia && window.matchMedia("(min-width: 901px)").matches) return;
      modal.classList.add("is-open");
      modal.setAttribute("aria-hidden", "false");
    };

    const close = () => {
      modal.classList.remove("is-open");
      modal.setAttribute("aria-hidden", "true");
    };

    btnOpen.addEventListener("click", () => {
      if (!selectedGroupId) {
        window.notify?.show({
          type: "warn",
          title: "Keine Gruppe ausgewählt",
          message: "Bitte wähle zuerst eine Gruppe aus.",
          duration: 3500
        });
        return;
      }
      open();
    });

    btnClose.addEventListener("click", close);

    modal.addEventListener("click", (e) => {
      if (e.target === modal) close();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") close();
    });
  }

  // Search friends
  function searchFriends(query) {
    if (!currentUser) return;

    try {
      const lowerQuery = query.toLowerCase();

      db.collection("users")
        .get()
        .then((snapshot) => {
          const results = [];

          snapshot.forEach((doc) => {
            const user = doc.data();
            const displayName =
              user.displayName || user.email?.split("@")[0] || "User";

            if (doc.id === currentUser.uid || currentUserFriends.includes(doc.id)) {
              return;
            }

            if (
              displayName.toLowerCase().includes(lowerQuery) ||
              user.email?.toLowerCase().includes(lowerQuery)
            ) {
              results.push({
                uid: doc.id,
                displayName: displayName,
                email: user.email
              });
            }
          });

          if (results.length === 0) {
            friendsSearchResults.innerHTML =
              '<div class="empty-state"><p>😞 Keine Benutzer gefunden</p></div>';
            return;
          }

          friendsSearchResults.innerHTML = results
            .map((user) => {
              const initials = (user.displayName || "U")
                .split(" ")
                .map((n) => n[0])
                .join("")
                .toUpperCase()
                .substring(0, 2);

              return `
                <div class="friend-search-item">
                  <div class="friend-search-item-avatar" style="background: linear-gradient(135deg, #00ff88, #0088ff);">
                    ${initials}
                  </div>
                  <div class="friend-search-item-name">${renderUserDisplayName(user.displayName)}</div>
                  <div class="friend-search-item-action">
                    <button class="btn btn-sm" data-friend-uid="${escapeHtml(user.uid)}" data-friend-name="${escapeHtml(user.displayName)}">
                      ➕ Hinzufügen
                    </button>
                  </div>
                </div>
              `;
            })
            .join("");

          // Add listeners
          friendsSearchResults
            .querySelectorAll("button[data-friend-uid]")
            .forEach((btn) => {
              btn.addEventListener("click", () => {
                const friendUid = btn.dataset.friendUid;
                const friendName = btn.dataset.friendName;
                window.echtluckyAddFriend(friendUid, friendName);
              });
            });
        });
    } catch (err) {
      friendsSearchResults.innerHTML =
        '<div class="empty-state"><p>❌ Fehler bei der Suche</p></div>';
    }
  }

  // Add friend
  window.echtluckyAddFriend = function (friendUid, friendName) {
    if (!currentUser) return;

    try {
      db.collection("users")
        .doc(currentUser.uid)
        .update({
          friends: firebase.firestore.FieldValue.arrayUnion(friendUid)
        });

      window.notify?.show({
        type: "success",
        title: "Erfolgreich",
        message: `${friendName} wurde hinzugefügt!`,
        duration: 4500
      });

      friendSearchInput.value = "";
      friendsSearchResults.innerHTML =
        '<div class="empty-state"><p>🔍 Suche…</p></div>';
    } catch (err) {
      window.notify?.show({
        type: "error",
        title: "Fehler",
        message: "Konnte Freund nicht hinzufügen",
        duration: 4000
      });
    }
  };

  // Create group
  function createGroup() {
    if (!currentUser) return;

    echtluckyModal.input({
      title: "Neue Gruppe erstellen",
      placeholder: "Gruppennamen eingeben…",
      confirmText: "Erstellen",
      cancelText: "Abbrechen"
    }).then(groupName => {
      if (!groupName) return;

        try {
          db.collection("groups").add({
            name: groupName,
            createdBy: currentUser.uid,
            members: [currentUser.uid],
            roles: {
              [currentUser.uid]: "admin"
            },
            createdAt: new Date(),
            messages: []
          });

        window.notify?.show({
          type: "success",
          title: "Erfolgreich",
          message: `Gruppe "${groupName}" erstellt!`,
          duration: 4500
        });
      } catch (err) {
        window.notify?.show({
          type: "error",
          title: "Fehler",
          message: "Konnte Gruppe nicht erstellen",
          duration: 4000
        });
      }
    });
  }

  async function loadCurrentUserProfile(uid) {
    if (!uid) return null;
    try {
      const snap = await db.collection("users").doc(uid).get();
      return snap.exists ? snap.data() : null;
    } catch (_) {
      return null;
    }
  }

  function renderUserBarIdentity(displayName, avatarUrl) {
    if (userBarName) userBarName.textContent = displayName || "User";

    if (!userBarAvatar) return;

    const url = String(avatarUrl || "").trim();
    if (url) {
      userBarAvatar.innerHTML = "";
      const img = document.createElement("img");
      img.src = url;
      img.alt = "";
      img.loading = "lazy";
      img.decoding = "async";
      userBarAvatar.appendChild(img);
      userBarAvatar.setAttribute("aria-label", "Profilbild");
      return;
    }

    userBarAvatar.innerHTML = "";
    const initial = String(displayName || "U")[0]?.toUpperCase?.() || "U";
    userBarAvatar.textContent = initial;
    userBarAvatar.removeAttribute("aria-label");
  }

  // Update auth status
  async function updateAuthStatus() {
    currentUser = auth.currentUser;
    log("🔵 updateAuthStatus: currentUser =", currentUser ? currentUser.email : null);

    if (!currentUser) {
      log("⚠️ No user logged in");
      if (statusLabel) statusLabel.textContent = "Nicht eingeloggt";
      if (btnLogin) btnLogin.hidden = false;
      if (authStatusCard) authStatusCard.hidden = false;
      if (connectLayout) connectLayout.hidden = true;
      renderUserBarIdentity("Guest", "");
      if (dmListPanel) dmListPanel.innerHTML = '<div class="empty-state"><p>Bitte einloggen</p></div>';
      return;
    }

    log("… User logged in:", currentUser.email);
    const profile = await loadCurrentUserProfile(currentUser.uid);
    const display =
      profile?.username ||
      profile?.displayName ||
      currentUser.displayName ||
      currentUser.email?.split("@")[0] ||
      "User";

    const avatarUrl = profile?.avatarUrl || currentUser.photoURL || "";
    if (statusLabel) statusLabel.textContent = `Hallo, ${display}!`;
    if (btnLogin) btnLogin.hidden = true;
    if (authStatusCard) authStatusCard.hidden = true;
    if (connectLayout) connectLayout.hidden = false;

    renderUserBarIdentity(display, avatarUrl);

    loadCurrentUserFriends();
    loadGroups();
  }

  // Setup event listeners (after Firebase ready)
  function init() {
    if (btnLogin) {
      btnLogin.addEventListener("click", () => {
        try {
          const file = (window.location.pathname || "").split("/").pop() || "connect.html";
          const returnTo = file + (window.location.search || "") + (window.location.hash || "");
          sessionStorage.setItem("echtlucky:returnTo", returnTo);
        } catch (_) {}
        window.location.href = "login.html";
      });
    }
    log("🟢 connect-minimal.js: init() called");

    const btnLeaveGroupModal = document.getElementById("btnLeaveGroupModal");
    if (btnLeaveGroupModal) {
      btnLeaveGroupModal.addEventListener("click", () => {
        leaveSelectedGroup().catch((e) => console.error(e));
      });
    }

    const btnDeleteGroupModal = document.getElementById("btnDeleteGroupModal");
    if (btnDeleteGroupModal) {
      btnDeleteGroupModal.addEventListener("click", () => {
        deleteSelectedGroup().catch((e) => console.error(e));
      });
    }

    // Mobile panel switcher
    if (mobileSwitcher && connectMainCard) {
      const setMobilePanel = (panel) => {
        const next = panel || "left";
        connectMainCard.setAttribute("data-mobile-panel", next);

        mobileSwitcher.querySelectorAll(".connect-mobile-tab").forEach((b) => {
          const isActive = b.dataset.panel === next;
          b.classList.toggle("is-active", isActive);
          b.setAttribute("aria-selected", String(isActive));
        });
      };

      if (!connectMainCard.hasAttribute("data-mobile-panel")) setMobilePanel("left");

      mobileSwitcher.querySelectorAll(".connect-mobile-tab").forEach((btn) => {
        btn.addEventListener("click", () => setMobilePanel(btn.dataset.panel || "left"));
      });

      // Keep state sane across resizes (e.g. rotating the phone)
      window.addEventListener("resize", () => {
        if (!window.matchMedia) return;
        const isMobile = window.matchMedia("(max-width: 900px)").matches;
        if (!isMobile) {
          connectMainCard.removeAttribute("data-mobile-panel");
        } else if (!connectMainCard.hasAttribute("data-mobile-panel")) {
          setMobilePanel("left");
        }
      });

      // Mobile back button (chat header) -> go back to groups
      const btnMobileBack = document.getElementById("btnMobileBack");
      if (btnMobileBack && !btnMobileBack.__wired) {
        btnMobileBack.__wired = true;
        btnMobileBack.addEventListener("click", () => setMobilePanel("left"));
      }
    }

    // Rail quick account modal (desktop + mobile)
    const btnQuickAccount = document.getElementById("btnQuickAccount");
    const accountQuickModal = document.getElementById("accountQuickModal");
    const btnAccountQuickClose = document.getElementById("btnAccountQuickClose");
    const btnAccountQuickLogout = document.getElementById("btnAccountQuickLogout");
    const audioInputSelect = document.getElementById("audioInputSelect");
    const audioOutputSelect = document.getElementById("audioOutputSelect");

    if (btnQuickAccount && accountQuickModal && !btnQuickAccount.__wired) {
      btnQuickAccount.__wired = true;

      const AUDIO_INPUT_KEY = "echtlucky:audioInputDeviceId";
      const AUDIO_OUTPUT_KEY = "echtlucky:audioOutputDeviceId";

      const getStored = (key) => {
        try { return localStorage.getItem(key) || ""; } catch (_) { return ""; }
      };

      const setStored = (key, value) => {
        try { localStorage.setItem(key, value || ""); } catch (_) {}
      };

      const fillSelect = (selectEl, devices, storedId, placeholder) => {
        if (!selectEl) return;
        selectEl.innerHTML = "";

        const optAuto = document.createElement("option");
        optAuto.value = "";
        optAuto.textContent = placeholder || "Automatisch";
        selectEl.appendChild(optAuto);

        (devices || []).forEach((d, idx) => {
          const opt = document.createElement("option");
          opt.value = d.deviceId || "";
          opt.textContent = d.label || `${placeholder || "Gerät"} ${idx + 1}`;
          selectEl.appendChild(opt);
        });

        selectEl.value = storedId || "";
      };

      const refreshDeviceSelectors = async () => {
        if (!audioInputSelect && !audioOutputSelect) return;
        if (!navigator.mediaDevices?.enumerateDevices) {
          if (audioInputSelect) {
            audioInputSelect.innerHTML = '<option value="">Nicht unterstützt</option>';
            audioInputSelect.disabled = true;
          }
          if (audioOutputSelect) {
            audioOutputSelect.innerHTML = '<option value="">Nicht unterstützt</option>';
            audioOutputSelect.disabled = true;
          }
          return;
        }

        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const inputs = devices.filter((d) => d.kind === "audioinput");
          const outputs = devices.filter((d) => d.kind === "audiooutput");

          if (audioInputSelect) {
            audioInputSelect.disabled = false;
            fillSelect(audioInputSelect, inputs, getStored(AUDIO_INPUT_KEY), "Automatisch");
          }

          if (audioOutputSelect) {
            const canSetSink = !!HTMLMediaElement.prototype.setSinkId;
            audioOutputSelect.disabled = !canSetSink;
            fillSelect(audioOutputSelect, outputs, getStored(AUDIO_OUTPUT_KEY), canSetSink ? "Automatisch" : "Nicht verfügbar");
          }
        } catch (err) {
          console.warn("refreshDeviceSelectors error:", err);
        }
      };

      if (audioInputSelect && !audioInputSelect.__wired) {
        audioInputSelect.__wired = true;
        audioInputSelect.addEventListener("change", () => {
          setStored(AUDIO_INPUT_KEY, audioInputSelect.value);
          window.notify?.show({
            type: "success",
            title: "Mikrofon",
            message: "Auswahl gespeichert (wirkt ab dem nächsten Call).",
            duration: 2500
          });
        });
      }

      if (audioOutputSelect && !audioOutputSelect.__wired) {
        audioOutputSelect.__wired = true;
        audioOutputSelect.addEventListener("change", () => {
          setStored(AUDIO_OUTPUT_KEY, audioOutputSelect.value);
          window.notify?.show({
            type: "success",
            title: "Audio-Ausgabe",
            message: "Auswahl gespeichert (Browser-abhängig).",
            duration: 2500
          });
        });
      }

      if (navigator.mediaDevices?.addEventListener) {
        navigator.mediaDevices.addEventListener("devicechange", () => {
          if (!accountQuickModal.hidden) refreshDeviceSelectors();
        });
      }

      const openAccountQuick = () => {
        accountQuickModal.hidden = false;
        accountQuickModal.setAttribute("aria-hidden", "false");
        setTimeout(() => accountQuickModal.classList.add("show"), 10);
        refreshDeviceSelectors();
      };

      const closeAccountQuick = () => {
        accountQuickModal.classList.remove("show");
        accountQuickModal.setAttribute("aria-hidden", "true");
        setTimeout(() => (accountQuickModal.hidden = true), 200);
      };

      btnQuickAccount.addEventListener("click", openAccountQuick);
      btnAccountQuickClose?.addEventListener("click", closeAccountQuick);

      btnAccountQuickLogout?.addEventListener("click", () => {
        closeAccountQuick();
        window.logout?.();
      });

      accountQuickModal.addEventListener("click", (e) => {
        if (e.target === accountQuickModal) closeAccountQuick();
      });

      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && !accountQuickModal.hidden) closeAccountQuick();
      });
    }

    // Start call from chat header (phone icon)
    const btnStartCall = document.getElementById("btnStartCall");
    if (btnStartCall) {
      btnStartCall.addEventListener("click", () => {
        if (!selectedGroupId) {
          window.notify?.show({
            type: "error",
            title: "Keine Gruppe ausgewählt",
            message: "Bitte wähle eine Gruppe aus",
            duration: 4500
          });
          return;
        }

        playCallTone();

        window.echtlucky?.voiceChat?.startRingingCall?.(selectedGroupId);
      });
    }

    btnEndVoice?.addEventListener("click", () => {
      playHangupTone();
    });

    btnAcceptCall?.addEventListener("click", () => {
      playCallTone();
    });

    btnRejectCall?.addEventListener("click", () => {
      playHangupTone();
    });

    if (incomingCallModal) {
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.attributeName === "hidden") {
            if (!incomingCallModal.hidden) {
              playIncomingTone();
            } else {
              playHangupTone();
            }
          }
        });
      });
      observer.observe(incomingCallModal, { attributes: true });
    }

    // Groups: right-click context menu (desktop)
    if (groupsListPanel && groupContextMenu) {
      // Right-click on empty area -> quick create
      groupsListPanel.addEventListener("contextmenu", (e) => {
        if (e.target?.closest?.(".group-item")) return;
        e.preventDefault();
        openGroupContextMenu(e.clientX, e.clientY, null, null);
      });

      groupContextMenu.addEventListener("click", (e) => {
        const btn = e.target?.closest?.(".context-menu__item");
        if (!btn) return;

        const action = btn.getAttribute("data-action") || "";
        const state = groupContextState;
        closeGroupContextMenu();

        if (action === "create") {
          createGroup();
          return;
        }

        if (!state?.groupId || !state?.groupData) return;

        if (action === "rename") {
          renameGroup(state.groupId, state.groupData);
          return;
        }

        if (action === "add-member") {
          focusAddMemberUi(state.groupData);
          return;
        }

        if (action === "leave") {
          leaveSelectedGroup().catch((err) => console.error(err));
          return;
        }

        if (action === "delete") {
          deleteSelectedGroup().catch((err) => console.error(err));
          return;
        }
      });

      // Close on outside click / escape / scroll / resize
      document.addEventListener("pointerdown", (e) => {
        if (groupContextMenu.hidden) return;
        if (e.target === groupContextMenu || e.target?.closest?.("#groupContextMenu")) return;
        closeGroupContextMenu();
      });

      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") closeGroupContextMenu();
      });

      window.addEventListener("resize", closeGroupContextMenu);
      window.addEventListener("scroll", closeGroupContextMenu, true);
    }

    // Users context menu (members + friends)
    if (userContextMenu && !userContextMenu.__wired) {
      userContextMenu.__wired = true;

      userContextMenu.addEventListener("click", async (e) => {
        const btn = e.target?.closest?.(".context-menu__item");
        if (!btn) return;

        const action = btn.getAttribute("data-action") || "";
        const state = userContextState;
        closeUserContextMenu();

        if (!state?.uid) return;

        if (action === "add-friend") {
          window.echtluckyAddFriend?.(state.uid, state.name || "User");
          return;
        }

        if (action === "remove-friend") {
          await removeFriend(state.uid, state.name || "User");
          if (selectedDmUid === state.uid) {
            selectedDmUid = null;
            selectedDmName = "";
            clearReplyState();
            updateChatControls();
            const chatContainer = document.getElementById("chatContainer");
            const emptyChatState = document.getElementById("emptyChatState");
            if (chatContainer) chatContainer.hidden = true;
            if (emptyChatState) emptyChatState.hidden = false;
          }
          renderDmList();
          return;
        }

        if (action === "toggle-mute") {
          const set = readMutedFriendsSet();
          const nextMuted = !set.has(state.uid);
          if (nextMuted) set.add(state.uid);
          else set.delete(state.uid);
          writeMutedFriendsSet(set);
          renderDmList();
          window.notify?.show({
            type: "success",
            title: "Aktualisiert",
            message: nextMuted ? "User stummgeschaltet." : "Stummschaltung aufgehoben.",
            duration: 2500
          });
          return;
        }

        if (action === "view-profile") {
          await showUserProfile(state.uid, state.name || "");
          return;
        }

        if (action === "copy-name") {
          const text = String(state.name || "").trim();
          if (!text) return;
          try {
            await navigator.clipboard.writeText(text);
            window.notify?.show({
              type: "success",
              title: "Kopiert",
              message: "Benutzername kopiert.",
              duration: 2000
            });
          } catch (_) {}
          return;
        }
      });

      document.addEventListener("pointerdown", (e) => {
        if (userContextMenu.hidden) return;
        if (e.target === userContextMenu || e.target?.closest?.("#userContextMenu")) return;
        closeUserContextMenu();
      });

      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") closeUserContextMenu();
      });

      window.addEventListener("resize", closeUserContextMenu);
      window.addEventListener("scroll", closeUserContextMenu, true);
    }

    const membersList = document.getElementById("membersList");
    if (membersList) {
      membersList.addEventListener("contextmenu", (e) => {
        const item = e.target?.closest?.(".member-item[data-user-uid]");
        if (!item) return;
        e.preventDefault();
        openUserContextMenu(
          e.clientX,
          e.clientY,
          item.getAttribute("data-user-uid") || "",
          item.getAttribute("data-user-name") || "",
          "member"
        );
      });
    }

    if (dmListPanel) {
      dmListPanel.addEventListener("contextmenu", (e) => {
        const item = e.target?.closest?.(".dm-item[data-dm-uid]");
        if (!item) return;
        e.preventDefault();
        openUserContextMenu(
          e.clientX,
          e.clientY,
          item.getAttribute("data-dm-uid") || "",
          item.getAttribute("data-dm-name") || "",
          "friend"
        );
      });
    }

    initGroupSettingsModal();
    wireAddMemberSearchUI();

    // Create group button
    if (btnCreateGroup) {
      btnCreateGroup.addEventListener("click", createGroup);
    }

    // DM list: search + select
    if (dmSearchInput) {
      dmSearchInput.addEventListener("input", () => {
        renderDmList();
      });
    }

    if (dmListPanel && !dmListPanel.__wired) {
      dmListPanel.__wired = true;
      dmListPanel.addEventListener("click", (e) => {
        const btn = e.target?.closest?.(".dm-item[data-dm-uid]");
        if (!btn) return;
        const uid = btn.getAttribute("data-dm-uid") || "";
        const name = btn.getAttribute("data-dm-name") || "";
        if (!uid) return;
        selectDm(uid, name);
      });
    }

    // Add friend modal
    const openAddFriend = () => {
      if (!addFriendModal) return;
      addFriendModal.hidden = false;
      addFriendModal.setAttribute("aria-hidden", "false");
      setTimeout(() => addFriendModal.classList.add("show"), 10);
      friendSearchInput?.focus?.();
    };

    const closeAddFriend = () => {
      if (!addFriendModal) return;
      addFriendModal.classList.remove("show");
      addFriendModal.setAttribute("aria-hidden", "true");
      setTimeout(() => (addFriendModal.hidden = true), 200);
    };

    btnOpenAddFriend?.addEventListener("click", openAddFriend);
    btnCloseAddFriendModal?.addEventListener("click", closeAddFriend);
    addFriendModal?.addEventListener("click", (e) => {
      if (e.target === addFriendModal) closeAddFriend();
    });

    // Settings popup (user bar gear)
    const CONNECT_PREFS_KEY = "echtlucky:connect:prefs:v1";
    const loadPrefs = () => {
      const defaults = {
        callSounds: true,
        messageSounds: true,
        compactUi: false,
        reducedMotion: false,
        remoteVolume: 1
      };
      try {
        const raw = localStorage.getItem(CONNECT_PREFS_KEY);
        if (!raw) return defaults;
        const parsed = JSON.parse(raw);
        return { ...defaults, ...(parsed || {}) };
      } catch (_) {
        return defaults;
      }
    };

    const savePrefs = (next) => {
      try {
        localStorage.setItem(CONNECT_PREFS_KEY, JSON.stringify(next || {}));
      } catch (_) {}
    };

    const applyRemoteVolume = (value) => {
      const v = Math.max(0, Math.min(1, Number(value) || 0));
      document.querySelectorAll("audio, video").forEach((el) => {
        try {
          el.volume = v;
        } catch (_) {}
      });
    };

    const applyUiPrefs = (prefs) => {
      document.documentElement.classList.toggle("connect-compact", !!prefs.compactUi);
      document.documentElement.classList.toggle("reduced-motion", !!prefs.reducedMotion);
      applyRemoteVolume(prefs.remoteVolume);
    };

    // Apply persisted preferences once on load (no UI interaction needed).
    applyUiPrefs(loadPrefs());

    const openConnectSettings = () => {
      if (!connectSettingsModal) return;
      connectSettingsModal.hidden = false;
      connectSettingsModal.setAttribute("aria-hidden", "false");
      setTimeout(() => connectSettingsModal.classList.add("show"), 10);

      const prefs = loadPrefs();
      applyUiPrefs(prefs);

      // Populate device selectors (settings popup has its own selects)
      const audioIn = document.getElementById("audioInputSelectSettings");
      const audioOut = document.getElementById("audioOutputSelectSettings");
      const AUDIO_INPUT_KEY = "echtlucky:audioInputDeviceId";
      const AUDIO_OUTPUT_KEY = "echtlucky:audioOutputDeviceId";

      const fill = (select, list, stored, placeholder) => {
        if (!select) return;
        select.innerHTML = "";
        const opt0 = document.createElement("option");
        opt0.value = "";
        opt0.textContent = placeholder || "Automatisch";
        select.appendChild(opt0);

        list.forEach((d) => {
          const opt = document.createElement("option");
          opt.value = d.deviceId;
          opt.textContent = d.label || `${d.kind}`;
          select.appendChild(opt);
        });

        if (stored) select.value = stored;
      };

      const refresh = async () => {
        if (!navigator.mediaDevices?.enumerateDevices) return;
        const devices = await navigator.mediaDevices.enumerateDevices();
        const inputs = devices.filter((d) => d.kind === "audioinput");
        const outputs = devices.filter((d) => d.kind === "audiooutput");
        fill(audioIn, inputs, localStorage.getItem(AUDIO_INPUT_KEY), "Automatisch");
        fill(audioOut, outputs, localStorage.getItem(AUDIO_OUTPUT_KEY), "Automatisch");
      };

      refresh().catch(() => {});

      if (audioIn && !audioIn.__wired) {
        audioIn.__wired = true;
        audioIn.addEventListener("change", () => {
          localStorage.setItem(AUDIO_INPUT_KEY, audioIn.value || "");
        });
      }

      if (audioOut && !audioOut.__wired) {
        audioOut.__wired = true;
        audioOut.addEventListener("change", () => {
          localStorage.setItem(AUDIO_OUTPUT_KEY, audioOut.value || "");
        });
      }

      // Preferences (UI/Audio)
      const prefCallSounds = document.getElementById("prefCallSounds");
      const prefMessageSounds = document.getElementById("prefMessageSounds");
      const prefCompactUi = document.getElementById("prefCompactUi");
      const prefReducedMotion = document.getElementById("prefReducedMotion");
      const prefRemoteVolume = document.getElementById("prefRemoteVolume");
      const prefRemoteVolumeValue = document.getElementById("prefRemoteVolumeValue");
      const prefMicGain = document.getElementById("prefMicGain");
      const prefMicGainValue = document.getElementById("prefMicGainValue");

      const syncUi = (p) => {
        if (prefCallSounds) prefCallSounds.checked = !!p.callSounds;
        if (prefMessageSounds) prefMessageSounds.checked = !!p.messageSounds;
        if (prefCompactUi) prefCompactUi.checked = !!p.compactUi;
        if (prefReducedMotion) prefReducedMotion.checked = !!p.reducedMotion;

        if (prefRemoteVolume) {
          const pct = Math.round((Number(p.remoteVolume) || 1) * 100);
          prefRemoteVolume.value = String(Math.max(0, Math.min(100, pct)));
          if (prefRemoteVolumeValue) prefRemoteVolumeValue.textContent = `${prefRemoteVolume.value}%`;
        }

        if (prefMicGain) {
          const api = window.echtlucky?.voiceChat;
          const gain = typeof api?.getMicGain === "function" ? api.getMicGain() : 1.6;
          const pct = Math.round((Number(gain) || 1.6) * 100);
          prefMicGain.value = String(Math.max(80, Math.min(220, pct)));
          if (prefMicGainValue) prefMicGainValue.textContent = `${(Number(prefMicGain.value) / 100).toFixed(2)}x`;
        }
      };

      const write = (mutator) => {
        const p = loadPrefs();
        const next = { ...p, ...(mutator ? mutator(p) : {}) };
        savePrefs(next);
        applyUiPrefs(next);
        syncUi(next);
      };

      syncUi(prefs);

      if (prefCallSounds && !prefCallSounds.__wired) {
        prefCallSounds.__wired = true;
        prefCallSounds.addEventListener("change", () => write(() => ({ callSounds: prefCallSounds.checked })));
      }

      if (prefMessageSounds && !prefMessageSounds.__wired) {
        prefMessageSounds.__wired = true;
        prefMessageSounds.addEventListener("change", () => write(() => ({ messageSounds: prefMessageSounds.checked })));
      }

      if (prefCompactUi && !prefCompactUi.__wired) {
        prefCompactUi.__wired = true;
        prefCompactUi.addEventListener("change", () => write(() => ({ compactUi: prefCompactUi.checked })));
      }

      if (prefReducedMotion && !prefReducedMotion.__wired) {
        prefReducedMotion.__wired = true;
        prefReducedMotion.addEventListener("change", () => write(() => ({ reducedMotion: prefReducedMotion.checked })));
      }

      if (prefRemoteVolume && !prefRemoteVolume.__wired) {
        prefRemoteVolume.__wired = true;
        prefRemoteVolume.addEventListener("input", () => {
          const v = Math.max(0, Math.min(100, Number(prefRemoteVolume.value) || 100));
          if (prefRemoteVolumeValue) prefRemoteVolumeValue.textContent = `${v}%`;
          write(() => ({ remoteVolume: v / 100 }));
        });
      }

      if (prefMicGain && !prefMicGain.__wired) {
        prefMicGain.__wired = true;
        prefMicGain.addEventListener("input", () => {
          const pct = Math.max(80, Math.min(220, Number(prefMicGain.value) || 160));
          const gain = pct / 100;
          if (prefMicGainValue) prefMicGainValue.textContent = `${gain.toFixed(2)}x`;
          const api = window.echtlucky?.voiceChat;
          if (typeof api?.setMicGain === "function") api.setMicGain(gain);
          else {
            try { localStorage.setItem("echtlucky:micGain", String(gain)); } catch (_) {}
          }
        });
      }
    };

    const closeConnectSettings = () => {
      if (!connectSettingsModal) return;
      connectSettingsModal.classList.remove("show");
      connectSettingsModal.setAttribute("aria-hidden", "true");
      setTimeout(() => (connectSettingsModal.hidden = true), 200);
    };

    btnUserBarSettings?.addEventListener("click", openConnectSettings);
    btnCloseConnectSettings?.addEventListener("click", closeConnectSettings);
    connectSettingsModal?.addEventListener("click", (e) => {
      if (e.target === connectSettingsModal) closeConnectSettings();
    });

    // Settings tabs
    if (connectSettingsModal && !connectSettingsModal.__wired) {
      connectSettingsModal.__wired = true;
      connectSettingsModal.addEventListener("click", (e) => {
        const tabBtn = e.target?.closest?.(".settings-tab[data-tab]");
        if (!tabBtn) return;
        const tab = tabBtn.dataset.tab;
        connectSettingsModal.querySelectorAll(".settings-tab").forEach((b) => b.classList.toggle("is-active", b === tabBtn));
        connectSettingsModal.querySelectorAll(".settings-pane").forEach((p) => p.classList.toggle("is-active", p.dataset.tab === tab));
      });
    }

    // User bar controls
    btnUserBarAccount?.addEventListener("click", () => {
      // Reuse quick account modal (rail) so there is a single source of truth for device selectors.
      document.getElementById("btnQuickAccount")?.click?.();
    });

    const syncUserBarMicState = () => {
      const api = window.echtlucky?.voiceChat;
      const muted = typeof api?.getMicMuted === "function" ? api.getMicMuted() : false;
      btnUserBarMute?.classList?.toggle?.("is-active", !!muted);
    };

    window.addEventListener("echtlucky:voice-chat-ready", () => {
      syncUserBarMicState();
    });

    btnUserBarMute?.addEventListener("click", () => {
      const api = window.echtlucky?.voiceChat;
      if (typeof api?.toggleMic === "function") {
        const muted = api.toggleMic();
        btnUserBarMute.classList.toggle("is-active", !!muted);
      } else {
        document.getElementById("btnToggleMic")?.click?.();
        setTimeout(syncUserBarMicState, 0);
      }
    });

    let isDeafened = false;
    btnUserBarDeafen?.addEventListener("click", () => {
      isDeafened = !isDeafened;
      document.querySelectorAll("audio, video").forEach((a) => {
        try {
          a.muted = isDeafened;
        } catch (_) {}
      });
      btnUserBarDeafen.classList.toggle("is-active", isDeafened);
    });

    // Keep userbar state in sync when voice UI toggles are used elsewhere.
    document.getElementById("btnToggleMic")?.addEventListener?.("click", () => {
      setTimeout(syncUserBarMicState, 0);
    });

    // Reply preview
    btnCancelReply?.addEventListener("click", clearReplyState);

    // Friend search
    if (friendSearchInput) {
      friendSearchInput.addEventListener("input", (e) => {
        clearTimeout(friendSearchTimeout);
        const query = e.target.value.trim();

        if (query.length < 2) {
          friendsSearchResults.innerHTML =
            '<div class="empty-state"><p>🔍 Suche…</p></div>';
          return;
        }

        friendSearchTimeout = setTimeout(() => {
          searchFriends(query);
        }, 300);
      });
    }

    if (friendsSearchResults && !friendsSearchResults.__friendDelegate) {
      friendsSearchResults.__friendDelegate = true;
      friendsSearchResults.addEventListener("click", (event) => {
        const btn = event.target.closest("button[data-friend-uid]");
        if (!btn) return;
        const friendUid = btn.dataset.friendUid;
        const friendName = btn.dataset.friendName;
        window.echtluckyAddFriend(friendUid, friendName);
      });
    }

    // Auth changes
    auth.onAuthStateChanged((user) => {
      log("🔵 connect-minimal.js: Auth state changed. User:", user ? user.email : "null");
      updateAuthStatus().catch(() => {});
      updateChatControls();

      if (user) startPresenceHeartbeat();
      else stopPresenceHeartbeat();
    });

    // Reload groups event
    window.addEventListener("echtlucky:reload-groups", () => {
      loadGroups();
    });

    window.addEventListener("echtlucky:group-strip-select", (event) => {
      const groupId = event?.detail?.groupId;
      if (!groupId) return;

      if (groupId === "__dm__") {
        activeChatMode = "dm";
        selectedDmUid = null;
        selectedDmName = "";
        selectedGroupId = null;
        selectedGroupData = null;
        detachSelectedGroupListener();
        detachMessagesListener();
        clearReplyState();
        renderDmList();
        updateChatControls();
        return;
      }

      if (groupId === "__create__") {
        createGroup();
        return;
      }

      const cached = groupsCache.get(groupId);
      const item = groupsListPanel?.querySelector?.(`[data-group-id="${groupId}"]`) || null;
      if (cached) selectGroup(groupId, cached, item);
    });

    // Initial auth check
    updateAuthStatus().catch(() => {});

    const btnSendMessage = document.getElementById("btnSendMessage");
    if (btnSendMessage) {
      btnSendMessage.addEventListener("click", () => {
        if (activeChatMode === "group") sendMessageToSelectedGroup().catch((e) => console.error(e));
        else sendMessageToSelectedDm().catch((e) => console.error(e));
      });
    }

    const messageInput = document.getElementById("messageInput");
    if (messageInput) {
      messageInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          if (activeChatMode === "group") sendMessageToSelectedGroup().catch((er) => console.error(er));
          else sendMessageToSelectedDm().catch((er) => console.error(er));
        }
      });
    }

    // Message actions (reply/react)
    const messagesList = document.getElementById("messagesList");
    if (messagesList && !messagesList.__wired) {
      messagesList.__wired = true;
      messagesList.addEventListener("click", (e) => {
        const btn = e.target?.closest?.(".message-action[data-action]");
        if (!btn) return;

        const action = btn.dataset.action;
        const messageEl = btn.closest(".message[data-message-id]");
        const msgId = messageEl?.getAttribute?.("data-message-id") || "";
        if (!msgId) return;

        // Reconstruct minimal data from DOM for reply preview (group messages have full data in snapshot, dm is local)
        if (action === "reply") {
          const author = messageEl.querySelector(".message-author")?.textContent?.trim() || "User";
          const text = messageEl.querySelector(".message-text")?.textContent?.trim() || "";
          setReplyState({ id: msgId, authorName: author, text });
        }

        if (action === "react") {
          const myUid = auth?.currentUser?.uid;
          if (!myUid || !selectedGroupId || activeChatMode !== "group") return;
          const key = `echtlucky:reacted:${selectedGroupId}:${myUid}`;
          const set = new Set(safeJsonParse(localStorage.getItem(key) || "[]") || []);
          if (set.has(msgId)) set.delete(msgId);
          else set.add(msgId);
          localStorage.setItem(key, JSON.stringify(Array.from(set)));
          messageEl.classList.toggle("has-reaction", set.has(msgId));
        }
      });
    }

    updateChatControls();
  }

  // Initialize module
  async function initModule() {
    if (initialized) return;
    initialized = true;

    log("🔵 connect-minimal.js initializing");
    await waitForFirebase();

    if (!auth || !db) {
      console.error("❌ connect-minimal.js: Firebase not ready");
      return;
    }

    init();
  }

  // Start
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initModule);
  } else {
    initModule();
  }

  log("✅ connect-minimal.js initialized");
})();



