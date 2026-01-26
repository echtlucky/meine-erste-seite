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

            div.addEventListener("click", () => selectGroup(doc.id, group));
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
  function selectGroup(groupId, groupData) {
    selectedGroupId = groupId;
    
    // Store globally for voice-chat.js
    window.__ECHTLUCKY_SELECTED_GROUP__ = groupId;

    // Update active state in list
    document.querySelectorAll(".group-item").forEach((item) => {
      item.classList.remove("is-active");
    });
    event.currentTarget?.classList.add("is-active");

    // Show chat container
    const chatContainer = document.getElementById("chatContainer");
    const emptyChatState = document.getElementById("emptyChatState");
    if (chatContainer) chatContainer.style.display = "flex";
    if (emptyChatState) emptyChatState.style.display = "none";

    // Update chat header
    document.getElementById("chatGroupTitle").textContent =
      groupData.name || "Gruppe";

    // Update member settings
    document.getElementById("groupNameInput").value =
      groupData.name || "Gruppe";
    document.getElementById("groupMemberCount").value =
      groupData.members?.length || 0;

    // Dispatch event for connect.js
    window.dispatchEvent(
      new CustomEvent("echtlucky:group-selected", {
        detail: { groupId, groupData }
      })
    );
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

    const groupName = prompt("Gruppennamen eingeben:");
    if (!groupName) return;

    try {
      db.collection("groups").add({
        name: groupName,
        creator: currentUser.uid,
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

    console.log("✅ User logged in:", currentUser.email);
    statusLabel.textContent = `Hallo, ${currentUser.displayName || currentUser.email?.split("@")[0] || "User"}!`;
    btnLogin.style.display = "none";
    authStatusCard.style.display = "none";
    connectLayout.style.display = "grid";

    loadCurrentUserFriends();
    loadGroups();
  }

  // Setup event listeners (after Firebase ready)
  function init() {
    console.log("🟢 connect-minimal.js: init() called");

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
    });

    // Reload groups event
    window.addEventListener("echtlucky:reload-groups", () => {
      loadGroups();
    });

    // Initial auth check
    updateAuthStatus();
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
