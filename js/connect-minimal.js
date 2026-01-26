// js/connect-minimal.js — Minimal Connect Panel Controller
// Manages groups list, group selection, and auth state display

(function () {
  "use strict";

  if (window.__ECHTLUCKY_CONNECT_MINIMAL_LOADED__) {
    console.warn("connect-minimal.js already loaded – skipping");
    return;
  }
  window.__ECHTLUCKY_CONNECT_MINIMAL_LOADED__ = true;

  const auth = window.auth || window.echtlucky?.auth;
  const db = window.db || window.echtlucky?.db;

  if (!auth || !db) {
    console.error("connect-minimal.js: auth/db missing. firebase.js must load first.");
    return;
  }

  // DOM Elements
  const groupsContainer = document.getElementById("groupsContainer");
  const btnCreateGroup = document.getElementById("btnCreateGroup");
  const selectedGroupSection = document.getElementById("selectedGroupSection");
  const groupTitle = document.getElementById("groupTitle");
  const groupDesc = document.getElementById("groupDesc");
  const authStatusCard = document.getElementById("authStatusCard");
  const statusLabel = document.getElementById("statusLabel");
  const btnLogin = document.getElementById("btnLogin");

  if (!groupsContainer || !btnCreateGroup) {
    console.warn("connect-minimal.js: DOM elements missing");
    return;
  }

  let currentUser = null;
  let selectedGroupId = null;
  let friendsOnlineListener = null;

  // Load online friends with presence
  function loadOnlineFriends() {
    if (!currentUser) {
      const friendsOnlineSection = document.getElementById("friendsOnlineSection");
      if (friendsOnlineSection) friendsOnlineSection.style.display = "none";
      return;
    }

    try {
      // Clean up previous listener
      if (friendsOnlineListener) friendsOnlineListener();

      // Query: Get all users who are currently online
      friendsOnlineListener = db.collection("users")
        .where("isOnline", "==", true)
        .onSnapshot((snapshot) => {
          const friendsList = document.getElementById("friendsOnlineList");
          const friendsOnlineSection = document.getElementById("friendsOnlineSection");
          
          if (!friendsList) return;

          // Filter out current user from online friends
          const onlineFriends = [];
          snapshot.forEach((doc) => {
            const data = doc.data();
            if (doc.id !== currentUser.uid) {
              onlineFriends.push({
                uid: doc.id,
                name: data.displayName || data.email?.split("@")[0] || "User",
                avatar: data.photoURL || null,
                lastSeen: data.lastSeen || null
              });
            }
          });

          // Show/hide section based on friends count
          if (onlineFriends.length === 0) {
            if (friendsOnlineSection) friendsOnlineSection.style.display = "none";
            return;
          }

          if (friendsOnlineSection) friendsOnlineSection.style.display = "block";

          // Populate friends list
          friendsList.innerHTML = onlineFriends.map((friend) => {
            // Get initials for avatar fallback
            const initials = friend.name
              .split(" ")
              .map((n) => n[0])
              .join("")
              .toUpperCase()
              .substring(0, 2);

            return `
              <img
                class="friend-avatar"
                src="${friend.avatar || 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22%3E%3Crect fill=%22%23000%22 width=%22100%25%22 height=%22100%25%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22%23fff%22%3E' + initials + '%3C/text%3E%3C/svg%3E'}"
                alt="${friend.name}"
                title="${friend.name}"
                data-friend-id="${friend.uid}"
                style="cursor: pointer;"
              />
            `;
          }).join("");

          // Add click handlers to open direct messages
          friendsList.querySelectorAll(".friend-avatar").forEach((avatar) => {
            avatar.addEventListener("click", (e) => {
              const friendId = e.currentTarget.dataset.friendId;
              openDirectMessage(friendId);
            });
          });
        }, (error) => {
          console.error("Error loading online friends:", error);
        });
    } catch (error) {
      console.error("loadOnlineFriends error:", error);
    }
  }

  // Open direct message with friend
  function openDirectMessage(friendId) {
    if (!currentUser) return;

    // Create a direct message thread ID (sorted user IDs for consistency)
    const dmId = [currentUser.uid, friendId].sort().join("_");

    // Find or create DM group
    try {
      // First check if a DM group already exists between these users
      db.collection("groups")
        .where("isDM", "==", true)
        .where("dmParticipants", "array-contains", currentUser.uid)
        .onSnapshot((snapshot) => {
          let dmGroup = null;

          // Find DM with this specific friend
          snapshot.docs.forEach((doc) => {
            const data = doc.data();
            if (data.dmParticipants?.includes(friendId)) {
              dmGroup = doc;
            }
          });

          if (dmGroup) {
            // DM exists, select it
            selectGroup(dmGroup.id, dmGroup.data());
          } else {
            // Create new DM group
            createDirectMessageGroup(friendId);
          }
        });
    } catch (error) {
      console.error("Error opening DM:", error);
    }
  }

  // Create a new direct message group
  function createDirectMessageGroup(friendId) {
    if (!currentUser) return;

    // Get friend info
    db.collection("users")
      .doc(friendId)
      .get()
      .then((doc) => {
        if (!doc.exists) {
          console.error("Friend not found");
          return;
        }

        const friendData = doc.data();
        const friendName = friendData.displayName || friendData.email?.split("@")[0] || "User";

        // Create DM group
        db.collection("groups")
          .add({
            isDM: true,
            dmParticipants: [currentUser.uid, friendId],
            name: `💬 ${friendName}`,
            createdBy: currentUser.uid,
            createdAt: new Date(),
            members: [currentUser.uid, friendId],
            messages: [],
            updatedAt: new Date()
          })
          .then((docRef) => {
            // Reload groups and select the new DM
            loadGroups();
            selectGroup(docRef.id, { isDM: true, name: `💬 ${friendName}` });
          })
          .catch((error) => {
            console.error("Error creating DM group:", error);
          });
      })
      .catch((error) => {
        console.error("Error fetching friend info:", error);
      });
  }

  // Load groups from Firestore
  function loadGroups() {
    if (!currentUser) {
      groupsContainer.innerHTML = '<div class="empty-state"><p>📭 Nicht eingeloggt</p><small>Melde dich an um Gruppen zu sehen</small></div>';
      return;
    }

    try {
      // Load groups where current user is a member
      db.collection("groups")
        .where("members", "array-contains", currentUser.uid)
        .onSnapshot((snapshot) => {
          if (snapshot.empty) {
            groupsContainer.innerHTML = '<div class="empty-state"><p>📭 Noch keine Gruppen</p><small>Erstelle eine neue Gruppe um zu starten</small></div>';
            return;
          }

          groupsContainer.innerHTML = "";
          snapshot.forEach((doc) => {
            const group = doc.data();
            const div = document.createElement("div");
            div.className = "group-item";
            div.innerHTML = `
              <div class="group-item-name">${group.name || "Unbenannte Gruppe"}</div>
              <div class="group-item-meta">${group.members?.length || 0} Members</div>
            `;
            div.addEventListener("click", () => selectGroup(doc.id, group));
            groupsContainer.appendChild(div);
          });
        });
    } catch (err) {
      console.error("Error loading groups:", err);
      groupsContainer.innerHTML = '<div class="empty-state"><p>⚠️ Fehler beim Laden der Gruppen</p></div>';
    }
  }

  // Select a group
  function selectGroup(groupId, groupData) {
    selectedGroupId = groupId;
    groupTitle.textContent = groupData.name || "Gruppe";
    groupDesc.textContent = `${groupData.members?.length || 0} Members`;
    selectedGroupSection.style.display = "block";
    
    // Dispatch event for connect.js to load messages/members
    window.dispatchEvent(new CustomEvent("echtlucky:group-selected", { 
      detail: { groupId, groupData } 
    }));
  }

  // Create new group
  function createGroup() {
    if (!currentUser) {
      window.notify?.show({
        type: "error",
        title: "Nicht angemeldet",
        message: "Du musst angemeldet sein um eine Gruppe zu erstellen",
        duration: 4000
      });
      return;
    }

    const groupName = prompt("Wie soll die Gruppe heißen?");
    if (!groupName || groupName.trim() === "") return;

    const groupData = {
      name: groupName.trim(),
      createdBy: currentUser.uid,
      createdAt: new Date(),
      members: [currentUser.uid],
      messages: []
    };

    try {
      db.collection("groups")
        .add(groupData)
        .then((docRef) => {
          window.notify?.show({
            type: "success",
            title: "Gruppe erstellt",
            message: `"${groupName}" wurde erstellt!`,
            duration: 3000
          });
          console.log("✅ Group created:", docRef.id);
        });
    } catch (err) {
      console.error("Error creating group:", err);
      window.notify?.show({
        type: "error",
        title: "Fehler",
        message: "Konnte Gruppe nicht erstellen: " + err.message,
        duration: 4000
      });
    }
  }

  // Update auth status
  function updateAuthStatus() {
    currentUser = auth.currentUser;

    if (!currentUser) {
      statusLabel.textContent = "Nicht eingeloggt";
      btnLogin.style.display = "inline-block";
      btnCreateGroup.disabled = true;
      groupsContainer.innerHTML = '<div class="empty-state"><p>📭 Nicht eingeloggt</p><small>Melde dich an um Gruppen zu sehen</small></div>';
      return;
    }

    statusLabel.textContent = `Hallo, ${currentUser.displayName || currentUser.email?.split("@")[0] || "User"}!`;
    btnLogin.style.display = "none";
    btnCreateGroup.disabled = false;
    loadGroups();
    loadOnlineFriends();  // Load online friends when user logs in
  }

  // Event listeners
  btnCreateGroup.addEventListener("click", createGroup);

  // Listen to auth changes
  auth.onAuthStateChanged((user) => {
    updateAuthStatus();
  });

  console.log("✅ connect-minimal.js initialized");
})();
