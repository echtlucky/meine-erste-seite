// js/connect-minimal.js — Minimal Connect Panel Controller
// Manages groups list, group selection, and auth state display

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
  const groupsContainer = document.getElementById("groupsContainer");
  const btnCreateGroup = document.getElementById("btnCreateGroup");
  const selectedGroupSection = document.getElementById("selectedGroupSection");
  const groupTitle = document.getElementById("groupTitle");
  const groupDesc = document.getElementById("groupDesc");
  const authStatusCard = document.getElementById("authStatusCard");
  const statusLabel = document.getElementById("statusLabel");
  const btnLogin = document.getElementById("btnLogin");
  const friendSearchInput = document.getElementById("friendSearchInput");
  const friendsSearchResults = document.getElementById("friendsSearchResults");

  if (!groupsContainer || !btnCreateGroup) {
    console.warn("connect-minimal.js: DOM elements missing");
    return;
  }

  let currentUser = null;
  let selectedGroupId = null;
  let friendsOnlineListener = null;
  let friendSearchTimeout = null;
  let currentUserFriends = [];

  // Load online friends with presence (only friends from user's friends list)
  function loadOnlineFriends() {
    if (!currentUser) {
      const friendsOnlineSection = document.getElementById("friendsOnlineSection");
      if (friendsOnlineSection) friendsOnlineSection.style.display = "none";
      return;
    }

    try {
      // Clean up previous listener
      if (friendsOnlineListener) friendsOnlineListener();

      // First get current user's friends list
      db.collection("users")
        .doc(currentUser.uid)
        .onSnapshot((userDoc) => {
          const userData = userDoc.data();
          const friendUIDs = userData?.friends || [];

          // If no friends, hide section
          if (friendUIDs.length === 0) {
            const friendsOnlineSection = document.getElementById("friendsOnlineSection");
            if (friendsOnlineSection) friendsOnlineSection.style.display = "none";
            if (friendsOnlineListener) friendsOnlineListener();
            return;
          }

          // Now get only those friends who are online
          friendsOnlineListener = db.collection("users")
            .where("isOnline", "==", true)
            .onSnapshot((snapshot) => {
              const friendsList = document.getElementById("friendsOnlineList");
              const friendsOnlineSection = document.getElementById("friendsOnlineSection");
              
              if (!friendsList) return;

              // Filter: only show friends who are in user's friends list AND online
              const onlineFriends = [];
              snapshot.forEach((doc) => {
                const data = doc.data();
                // Check if this user is in current user's friends list
                if (friendUIDs.includes(doc.id) && doc.id !== currentUser.uid) {
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

                const safeName = escapeHtml(friend.name);
                const safeUid = escapeHtml(friend.uid);

                return `
                  <img
                    class="friend-avatar"
                    src="${friend.avatar || 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22%3E%3Crect fill=%22%23000%22 width=%22100%25%22 height=%22100%25%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22%23fff%22%3E' + initials + '%3C/text%3E%3C/svg%3E'}"
                    alt="${safeName}"
                    title="${safeName}"
                    data-friend-id="${safeUid}"
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
        }, (error) => {
          console.error("Error loading user friends list:", error);
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
      const unsubscribe = db.collection("groups")
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

          // Cleanup the listener immediately after getting result
          if (unsubscribe) unsubscribe();

          if (dmGroup) {
            // DM exists, select it
            selectGroup(dmGroup.id, dmGroup.data());
          } else {
            // Create new DM group
            createDirectMessageGroup(friendId);
          }
        }, (error) => {
          console.error("Error opening DM:", error);
          if (unsubscribe) unsubscribe();
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
    loadCurrentUserFriends();
    loadGroups();
    loadOnlineFriends();  // Load online friends when user logs in
  }

  // Event listeners
  btnCreateGroup.addEventListener("click", createGroup);

  // Friend search
  if (friendSearchInput) {
    friendSearchInput.addEventListener("input", (e) => {
      clearTimeout(friendSearchTimeout);
      const query = e.target.value.trim();
      
      if (query.length < 2) {
        friendsSearchResults.innerHTML = '<div class="empty-state"><p>🔍 Suche nach Benutzern</p></div>';
        return;
      }

      friendSearchTimeout = setTimeout(() => {
        searchFriends(query);
      }, 300);
    });
  }

  // Listen to auth changes
  auth.onAuthStateChanged((user) => {
    updateAuthStatus();
  });

  // Listen to reload-groups event (from connect.js when group is deleted/left)
  window.addEventListener("echtlucky:reload-groups", () => {
    loadGroups();
  });

  // ============================================
  // FRIEND SEARCH & ADD
  // ============================================

  function searchFriends(query) {
    if (!currentUser) return;

    try {
      // Search for users by displayName (case-insensitive)
      const lowerQuery = query.toLowerCase();
      
      db.collection("users")
        .get()
        .then((snapshot) => {
          const results = [];
          
          snapshot.forEach((doc) => {
            const user = doc.data();
            const displayName = user.displayName || user.email?.split("@")[0] || "User";
            
            // Skip current user and already-added friends
            if (doc.id === currentUser.uid || currentUserFriends.includes(doc.id)) {
              return;
            }
            
            // Check if displayName matches query
            if (displayName.toLowerCase().includes(lowerQuery) || 
                user.email?.toLowerCase().includes(lowerQuery)) {
              results.push({
                uid: doc.id,
                displayName: displayName,
                email: user.email,
                photoURL: user.photoURL
              });
            }
          });

          displaySearchResults(results);
        })
        .catch((err) => {
          console.error("Friend search error:", err);
          friendsSearchResults.innerHTML = '<div class="empty-state"><p>❌ Fehler bei der Suche</p></div>';
        });
    } catch (err) {
      console.error("Search error:", err);
    }
  }

  function displaySearchResults(results) {
    if (results.length === 0) {
      friendsSearchResults.innerHTML = '<div class="empty-state"><p>😞 Keine Benutzer gefunden</p></div>';
      return;
    }

    friendsSearchResults.innerHTML = results.map((user) => {
      const initials = (user.displayName || "U")
        .split(" ")
        .map(n => n[0])
        .join("")
        .toUpperCase()
        .substring(0, 2);

      const safeDisplayName = escapeHtml(user.displayName);
      const safeUid = escapeHtml(user.uid);

      return `
        <div class="friend-search-item">
          <div class="friend-search-item-avatar" style="background: linear-gradient(135deg, var(--accent), #0088ff);">
            ${initials}
          </div>
          <div class="friend-search-item-name">${safeDisplayName}</div>
          <div class="friend-search-item-action">
            <button class="btn btn-primary btn-sm" data-friend-uid="${safeUid}" data-friend-name="${safeDisplayName}">
              ➕ Hinzufügen
            </button>
          </div>
        </div>
      `;
    }).join("");

    // Add event listeners to buttons
    friendsSearchResults.querySelectorAll("button[data-friend-uid]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const friendUid = e.currentTarget.dataset.friendUid;
        const friendName = e.currentTarget.dataset.friendName;
        window.echtluckyAddFriend(friendUid, friendName);
      });
    });
  }

  // Add friend to current user's friends list
  window.echtluckyAddFriend = function(friendUid, friendName) {
    if (!currentUser) return;

    try {
      if (!firebase) {
        console.error("Firebase not available for arrayUnion");
        return;
      }
      db.collection("users")
        .doc(currentUser.uid)
        .update({
          friends: firebase.firestore.FieldValue.arrayUnion(friendUid)
        })
        .then(() => {
          window.notify?.show({
            type: "success",
            title: "Freund hinzugefügt",
            message: `${friendName} wurde zu deiner Freundesliste hinzugefügt!`,
            duration: 3000
          });
          
          // Update local friends list
          currentUserFriends = [...currentUserFriends, friendUid];
          
          // Reload search results
          const query = friendSearchInput.value.trim();
          if (query.length >= 2) {
            searchFriends(query);
          }
          
          // Reload online friends
          loadOnlineFriends();
        })
        .catch((err) => {
          console.error("Add friend error:", err);
          window.notify?.show({
            type: "error",
            title: "Fehler",
            message: "Freund konnte nicht hinzugefügt werden",
            duration: 3000
          });
        });
    } catch (err) {
      console.error("Add friend error:", err);
    }
  };

  // Load current user's friends list
  function loadCurrentUserFriends() {
    if (!currentUser) {
      currentUserFriends = [];
      return;
    }

    db.collection("users")
      .doc(currentUser.uid)
      .onSnapshot((doc) => {
        if (doc.exists) {
          currentUserFriends = doc.data().friends || [];
        }
      });
  }

  // Helper function
  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
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

  // Start initialization
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initModule);
  } else {
    initModule();
  }

  console.log("✅ connect-minimal.js initialized");
})();
