// js/connect-minimal.js v2 — 3-Column Layout Controller
// Manages groups list (left column), group selection, and auth state

(function () {
  "use strict";

  if (window.__ECHTLUCKY_CONNECT_MINIMAL_LOADED__) {
    console.warn("connect-minimal.js already loaded – skipping");
    return;
  }
  window.__ECHTLUCKY_CONNECT_MINIMAL_LOADED__ = true;

  let auth = null;
  let db = null;
  let firebase = null;

  async function waitForFirebase() {
    return new Promise((resolve) => {
      if (window.firebaseReady && window.auth && window.db) {
        auth = window.auth;
        db = window.db;
        firebase = window.firebase;
        console.log("✅ connect-minimal.js: Firebase ready");
        resolve();
        return;
      }

      const handler = () => {
        auth = window.auth;
        db = window.db;
        firebase = window.firebase;
        console.log("✅ connect-minimal.js: Firebase ready via event");
        resolve();
      };

      window.addEventListener("firebaseReady", handler, { once: true });
      setTimeout(() => resolve(), 5000);
    });
  }

  let initialized = false;

  // DOM Elements
  const authStatusCard = document.getElementById("authStatusCard");
  const statusLabel = document.getElementById("statusLabel");
  const btnLogin = document.getElementById("btnLogin");
  const connectLayout = document.getElementById("connectLayout");
  const groupsListPanel = document.getElementById("groupsListPanel");
  const btnCreateGroup = document.getElementById("btnCreateGroup");
  const friendSearchInput = document.getElementById("friendSearchInput");
  const friendsSearchResults = document.getElementById("friendsSearchResults");

  let currentUser = null;
  let selectedGroupId = null;
  let selectedGroupData = null;
  let selectedGroupUnsubscribe = null;
  let messagesUnsubscribe = null;
  let friendSearchTimeout = null;
  let currentUserFriends = [];

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

  // Load current user's friends list
  function loadCurrentUserFriends() {
    if (!currentUser) return;

    try {
      db.collection("users")
        .doc(currentUser.uid)
        .onSnapshot((doc) => {
          currentUserFriends = doc.data()?.friends || [];
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
          groupsListPanel.innerHTML = "";

          if (snapshot.empty) {
            groupsListPanel.innerHTML =
              '<div class="empty-state"><p>📭 Keine Gruppen</p></div>';
            return;
          }

          snapshot.forEach((doc) => {
            const group = doc.data();
            const div = document.createElement("div");
            div.className = "group-item";
            if (selectedGroupId === doc.id) div.classList.add("is-active");

            div.innerHTML = `
              <div class="group-item-name">${escapeHtml(group.name || "Gruppe")}</div>
              <div class="group-item-meta">${group.members?.length || 0} Members</div>
            `;

            div.addEventListener("click", () => selectGroup(doc.id, group, div));
            groupsListPanel.appendChild(div);
          });
        });
    } catch (err) {
      console.error("Error loading groups:", err);
      groupsListPanel.innerHTML =
        '<div class="empty-state"><p>⚠️ Fehler</p></div>';
    }
  }

  // Select a group
  function selectGroup(groupId, groupData, clickedEl) {
    selectedGroupId = groupId;
    selectedGroupData = groupData || null;
    
    // Store globally for voice-chat.js
    window.__ECHTLUCKY_SELECTED_GROUP__ = groupId;

    // Update active state in list
    document.querySelectorAll(".group-item").forEach((item) => {
      item.classList.remove("is-active");
    });
    clickedEl?.classList.add("is-active");

    // Show chat container
    const chatContainer = document.getElementById("chatContainer");
    const emptyChatState = document.getElementById("emptyChatState");
    if (chatContainer) chatContainer.style.display = "flex";
    if (emptyChatState) emptyChatState.style.display = "none";

    // Update chat header
    const chatGroupTitle = document.getElementById("chatGroupTitle");
    if (chatGroupTitle) chatGroupTitle.textContent = groupData.name || "Gruppe";

    // Update member settings
    const groupNameInput = document.getElementById("groupNameInput");
    if (groupNameInput) groupNameInput.value = groupData.name || "Gruppe";

    const groupMemberCount = document.getElementById("groupMemberCount");
    if (groupMemberCount) groupMemberCount.value = groupData.members?.length || 0;

    attachSelectedGroupListener(groupId);
    attachMessagesListener(groupId);

    // Dispatch event for connect.js
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

    membersList.innerHTML = members
      .map((memberUid) => {
        const label = memberUid === uid ? "Du" : `User ${String(memberUid).slice(0, 6)}`;
        const initials = label.slice(0, 2).toUpperCase();
        return `
          <div class="member-item">
            <div class="member-info">
              <div class="member-avatar">${escapeHtml(initials)}</div>
              <div class="member-details">
                <div class="member-name">${escapeHtml(label)}</div>
                <div class="member-status">${escapeHtml(String(memberUid).slice(0, 10))}</div>
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
    if (membersAddSection) membersAddSection.style.display = allowAdd ? "block" : "none";

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

    const formatTime = (createdAt) => {
      try {
        const d =
          createdAt?.toDate?.() ||
          (createdAt instanceof Date ? createdAt : null);
        if (!d) return "";
        return d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
      } catch (_) {
        return "";
      }
    };

    list.innerHTML = messages
      .map((m) => {
        const author = m.authorName || "User";
        const text = m.text || "";
        const isMine = m.authorUid === myUid;
        const time = formatTime(m.createdAt);
        return `
          <div class="message${isMine ? " is-mine" : ""}">
            <div class="message-author">${escapeHtml(author)}</div>
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
        snap.forEach((doc) => messages.push(doc.data()));
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

      await db.collection("groups").doc(selectedGroupId).collection("messages").add({
        authorUid: user.uid,
        authorName,
        text,
        createdAt: new Date(),
        createdAtServer: firebase?.firestore?.FieldValue?.serverTimestamp?.()
      });

      if (input) input.value = "";
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
    const hasGroup = !!selectedGroupId;
    const members = Array.isArray(selectedGroupData?.members) ? selectedGroupData.members : [];
    const isMember = hasAuth ? members.includes(auth.currentUser.uid) : false;

    const enabled = hasAuth && hasGroup && isMember;

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
        targetEl.innerHTML = '<div class="empty-state"><p>🔍 Suche...</p></div>';
        return;
      }

      targetEl.innerHTML = '<div class="empty-state"><p>🔍 Suche...</p></div>';

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
              <div>${escapeHtml(initials)} ${escapeHtml(u.displayName)}</div>
              <button class="btn btn-primary btn-sm" data-add-member="${escapeHtml(u.uid)}">➕</button>
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
      window.__ECHTLUCKY_SELECTED_GROUP__ = null;
      detachSelectedGroupListener();
      detachMessagesListener();

      const chatContainer = document.getElementById("chatContainer");
      const emptyChatState = document.getElementById("emptyChatState");
      if (chatContainer) chatContainer.style.display = "none";
      if (emptyChatState) emptyChatState.style.display = "block";
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
      window.__ECHTLUCKY_SELECTED_GROUP__ = null;
      detachSelectedGroupListener();
      detachMessagesListener();

      const chatContainer = document.getElementById("chatContainer");
      const emptyChatState = document.getElementById("emptyChatState");
      if (chatContainer) chatContainer.style.display = "none";
      if (emptyChatState) emptyChatState.style.display = "block";
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
                  <div class="friend-search-item-name">${escapeHtml(user.displayName)}</div>
                  <div class="friend-search-item-action">
                    <button class="btn btn-primary btn-sm" data-friend-uid="${escapeHtml(user.uid)}" data-friend-name="${escapeHtml(user.displayName)}">
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
              btn.addEventListener("click", (e) => {
                const friendUid = e.currentTarget.dataset.friendUid;
                const friendName = e.currentTarget.dataset.friendName;
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
        '<div class="empty-state"><p>🔍 Suche...</p></div>';
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
      placeholder: "Gruppennamen eingeben...",
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

  // Update auth status
  function updateAuthStatus() {
    currentUser = auth.currentUser;
    console.log(
      "🔵 updateAuthStatus: currentUser =",
      currentUser ? currentUser.email : null
    );

    if (!currentUser) {
      console.log("⚠️ No user logged in");
      statusLabel.textContent = "Nicht eingeloggt";
      btnLogin.style.display = "inline-flex";
      authStatusCard.style.display = "block";
      connectLayout.style.display = "none";
      return;
    }

    console.log("… User logged in:", currentUser.email);
    statusLabel.textContent = `Hallo, ${currentUser.displayName || currentUser.email?.split("@")[0] || "User"}!`;
    btnLogin.style.display = "none";
    authStatusCard.style.display = "none";
    connectLayout.style.display = "grid";

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
    console.log("🟢 connect-minimal.js: init() called");

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

    initGroupSettingsModal();
    wireAddMemberSearchUI();

    // Create group button
    if (btnCreateGroup) {
      btnCreateGroup.addEventListener("click", createGroup);
    }

    // Friend search
    if (friendSearchInput) {
      friendSearchInput.addEventListener("input", (e) => {
        clearTimeout(friendSearchTimeout);
        const query = e.target.value.trim();

        if (query.length < 2) {
          friendsSearchResults.innerHTML =
            '<div class="empty-state"><p>🔍 Suche...</p></div>';
          return;
        }

        friendSearchTimeout = setTimeout(() => {
          searchFriends(query);
        }, 300);
      });
    }

    // Auth changes
    auth.onAuthStateChanged((user) => {
      console.log("🔵 connect-minimal.js: Auth state changed. User:", user ? user.email : "null");
      updateAuthStatus();
      updateChatControls();
    });

    // Reload groups event
    window.addEventListener("echtlucky:reload-groups", () => {
      loadGroups();
    });

    // Initial auth check
    updateAuthStatus();

    const btnSendMessage = document.getElementById("btnSendMessage");
    if (btnSendMessage) {
      btnSendMessage.addEventListener("click", () => {
        sendMessageToSelectedGroup().catch((e) => console.error(e));
      });
    }

    const messageInput = document.getElementById("messageInput");
    if (messageInput) {
      messageInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          sendMessageToSelectedGroup().catch((er) => console.error(er));
        }
      });
    }

    updateChatControls();
  }

  // Initialize module
  async function initModule() {
    if (initialized) return;
    initialized = true;

    console.log("🔵 connect-minimal.js initializing");
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

  console.log("✅ connect-minimal.js initialized");
})();



