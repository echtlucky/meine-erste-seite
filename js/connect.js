// js/connect.js v2 — Chat, Members, Roles, and Settings for 3-Column Layout

(function () {
  "use strict";

  if (window.__ECHTLUCKY_CONNECT_EXT_LOADED__) {
    console.warn("connect.js already loaded – skipping");
    return;
  }
  window.__ECHTLUCKY_CONNECT_EXT_LOADED__ = true;

  let auth = null;
  let db = null;
  let firebase = null;

  async function waitForFirebase() {
    return new Promise((resolve) => {
      if (window.firebaseReady && window.auth && window.db) {
        auth = window.auth;
        db = window.db;
        firebase = window.firebase;
        console.log("✅ connect.js: Firebase ready");
        resolve();
        return;
      }

      const handler = () => {
        auth = window.auth;
        db = window.db;
        firebase = window.firebase;
        console.log("✅ connect.js: Firebase ready via event");
        resolve();
      };

      window.addEventListener("firebaseReady", handler, { once: true });
      setTimeout(() => resolve(), 5000);
    });
  }

  let initialized = false;
  let selectedGroupId = null;
  let currentUser = null;
  let messagesUnsubscribe = null;
  let membersUnsubscribe = null;

  // DOM Elements
  const messageInput = document.getElementById("messageInput");
  const btnSendMessage = document.getElementById("btnSendMessage");
  const messagesList = document.getElementById("messagesList");
  const membersList = document.getElementById("membersList");
  const membersCount = document.getElementById("membersCount");
  const btnGroupSettings = document.getElementById("btnGroupSettings");
  const groupSettingsModal = document.getElementById("groupSettingsModal");
  const closeGroupSettings = document.getElementById("closeGroupSettings");
  const btnModalAddMember = document.getElementById("btnModalAddMember");
  const addMemberSearchInput = document.getElementById("addMemberSearchInput");
  const modalMemberResults = document.getElementById("modalMemberResults");
  const btnLeaveGroupModal = document.getElementById("btnLeaveGroupModal");
  const btnDeleteGroupModal = document.getElementById("btnDeleteGroupModal");
  const membersAddSection = document.getElementById("membersAddSection");

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

  // Format date
  function formatDate(ts) {
    if (!ts) return "—";
    try {
      const d = ts.toDate ? ts.toDate() : ts;
      return new Date(d).toLocaleTimeString("de-DE", {
        hour: "2-digit",
        minute: "2-digit"
      });
    } catch {
      return "—";
    }
  }

  // Load messages
  function loadMessages() {
    if (!selectedGroupId) return;

    if (messagesUnsubscribe) messagesUnsubscribe();

    try {
      messagesUnsubscribe = db
        .collection("groups")
        .doc(selectedGroupId)
        .collection("messages")
        .orderBy("createdAt", "asc")
        .limitToLast(50)
        .onSnapshot((snap) => {
          messagesList.innerHTML = "";

          snap.forEach((doc) => {
            const msg = doc.data();
            const div = document.createElement("div");
            div.className = "message";
            div.innerHTML = `
              <div class="message-author">${escapeHtml(msg.author || "User")}</div>
              <div class="message-text">${escapeHtml(msg.text || "")}</div>
              <div class="message-time">${formatDate(msg.createdAt)}</div>
            `;
            messagesList.appendChild(div);
          });

          // Scroll to bottom
          messagesList.parentElement.scrollTop =
            messagesList.parentElement.scrollHeight;
        });
    } catch (err) {
      console.error("Error loading messages:", err);
    }
  }

  // Send message
  function sendMessage() {
    if (!selectedGroupId || !messageInput.value.trim()) return;

    try {
      db.collection("groups")
        .doc(selectedGroupId)
        .collection("messages")
        .add({
          author:
            currentUser.displayName || currentUser.email?.split("@")[0],
          text: messageInput.value.trim(),
          userId: currentUser.uid,
          createdAt: new Date()
        });

      messageInput.value = "";
      messageInput.focus();
    } catch (err) {
      console.error("Error sending message:", err);
      window.notify?.show({
        type: "error",
        title: "Fehler",
        message: "Nachricht konnte nicht gesendet werden",
        duration: 3000
      });
    }
  }

  // Load members
  function loadMembers() {
    if (!selectedGroupId) return;

    if (membersUnsubscribe) membersUnsubscribe();

    try {
      membersUnsubscribe = db
        .collection("groups")
        .doc(selectedGroupId)
        .onSnapshot(async (doc) => {
          if (!doc.exists) return;

          const groupData = doc.data();
          const memberIds = groupData.members || [];
          const roles = groupData.roles || {};

          membersList.innerHTML = "";
          membersCount.textContent = memberIds.length;

          // Fetch user details for all members
          for (const memberId of memberIds) {
            try {
              const userSnap = await db
                .collection("users")
                .doc(memberId)
                .get();
              if (!userSnap.exists) continue;

              const userData = userSnap.data();
              const role = roles[memberId] || "user";
              const isAdmin = memberId === groupData.creator;

              const div = document.createElement("div");
              div.className = "member-item";

              const initials = (userData.displayName || "U")
                .split(" ")
                .map((n) => n[0])
                .join("")
                .toUpperCase()
                .substring(0, 2);

              const roleSelect =
                currentUser.uid === groupData.creator && memberId !== groupData.creator
                  ? `
                  <select class="member-role-select" data-member-id="${memberId}" onchange="window.changeUserRole('${selectedGroupId}', '${memberId}', this.value)">
                    <option value="user" ${role === "user" ? "selected" : ""}>User</option>
                    <option value="mod" ${role === "mod" ? "selected" : ""}>Mod</option>
                    <option value="support" ${role === "support" ? "selected" : ""}>Support</option>
                    <option value="admin" ${role === "admin" ? "selected" : ""}>Admin</option>
                  </select>
                `
                  : `<span class="member-role ${role}">${role.toUpperCase()}</span>`;

              div.innerHTML = `
                <div class="member-info">
                  <div class="member-avatar">${initials}</div>
                  <div class="member-details">
                    <div class="member-name">${escapeHtml(userData.displayName || userData.email?.split("@")[0])}</div>
                  </div>
                </div>
                <div style="display: flex; gap: 0.5rem; align-items: center;">
                  ${roleSelect}
                </div>
              `;

              membersList.appendChild(div);
            } catch (err) {
              console.error("Error loading member:", err);
            }
          }
        });
    } catch (err) {
      console.error("Error loading members:", err);
    }
  }

  // Change user role
  window.changeUserRole = function (groupId, memberId, newRole) {
    if (!currentUser) {
      window.notify?.show({
        type: "error",
        title: "Fehler",
        message: "Du musst eingeloggt sein",
        duration: 4500
      });
      return;
    }

    try {
      // Verify user is admin
      db.collection("groups")
        .doc(groupId)
        .get()
        .then(doc => {
          if (!doc.exists) {
            window.notify?.show({
              type: "error",
              title: "Fehler",
              message: "Gruppe nicht gefunden",
              duration: 4000
            });
            return;
          }

          if (doc.data().creator !== currentUser.uid) {
            window.notify?.show({
              type: "error",
              title: "Fehler",
              message: "Nur der Admin kann Rollen ändern",
              duration: 4500
            });
            return;
          }

          // Update role
          db.collection("groups")
            .doc(groupId)
            .update({
              [`roles.${memberId}`]: newRole
            })
            .then(() => {
              window.notify?.show({
                type: "success",
                title: "Erfolgreich",
                message: `Rolle geändert zu ${newRole}`,
                duration: 3500
              });
            });
        });
    } catch (err) {
      console.error("Error changing role:", err);
      window.notify?.show({
        type: "error",
        title: "Fehler",
        message: "Konnte Rolle nicht ändern",
        duration: 4500
      });
    }
  };

  // Open settings modal
  function openGroupSettings() {
    groupSettingsModal.classList.add("show");
  }

  // Close settings modal
  function closeSettingsModal() {
    groupSettingsModal.classList.remove("show");
  }

  // Leave group
  function leaveGroup() {
    if (!selectedGroupId || !currentUser) return;

    if (
      !confirm(
        "Möchtest du die Gruppe wirklich verlassen?"
      )
    )
      return;

    try {
      db.collection("groups")
        .doc(selectedGroupId)
        .update({
          members: firebase.firestore.FieldValue.arrayRemove(currentUser.uid)
        });

      window.notify?.show({
        type: "success",
        title: "Erfolgreich",
        message: "Gruppe verlassen",
        duration: 3500
      });

      window.dispatchEvent(new CustomEvent("echtlucky:reload-groups"));
    } catch (err) {
      console.error("Error leaving group:", err);
    }
  }

  // Delete group
  function deleteGroup() {
    if (!selectedGroupId || !currentUser) return;

    if (!confirm("Möchtest du die Gruppe wirklich löschen? Dies ist nicht rückgängig zu machen!"))
      return;

    try {
      db.collection("groups").doc(selectedGroupId).delete();

      window.notify?.show({
        type: "success",
        title: "Erfolgreich",
        message: "Gruppe gelöscht",
        duration: 3500
      });

      window.dispatchEvent(new CustomEvent("echtlucky:reload-groups"));
    } catch (err) {
      console.error("Error deleting group:", err);
    }
  }

  // Search members for modal
  function searchMembersForModal(query) {
    if (!selectedGroupId) return;

    try {
      const lowerQuery = query.toLowerCase();
      db.collection("users").get().then((snapshot) => {
        const currentMembers = [];
        const results = [];

        // Get current group members
        db.collection("groups").doc(selectedGroupId).get().then(doc => {
          if (doc.exists) {
            currentMembers.push(...(doc.data().members || []));
          }

          // Search users
          snapshot.forEach((userDoc) => {
            const user = userDoc.data();
            const displayName = user.displayName || user.email?.split("@")[0] || "User";

            if (currentMembers.includes(userDoc.id) || userDoc.id === currentUser.uid) {
              return;
            }

            if (displayName.toLowerCase().includes(lowerQuery) || 
                user.email?.toLowerCase().includes(lowerQuery)) {
              results.push({
                uid: userDoc.id,
                displayName,
                email: user.email
              });
            }
          });

          if (results.length === 0) {
            modalMemberResults.innerHTML = '<div class="empty-state"><p>😞 Keine Benutzer gefunden</p></div>';
            return;
          }

          modalMemberResults.innerHTML = results.map((user) => {
            const initials = (user.displayName || "U")
              .split(" ")
              .map((n) => n[0])
              .join("")
              .toUpperCase()
              .substring(0, 2);

            return `
              <div class="member-search-item" data-member-to-add="${user.uid}" data-member-name="${user.displayName}">
                <div class="member-avatar">${initials}</div>
                <div class="member-details">
                  <div class="member-name">${escapeHtml(user.displayName)}</div>
                  <div style="font-size: 0.8rem; color: rgba(224,255,224,0.6);">${escapeHtml(user.email)}</div>
                </div>
              </div>
            `;
          }).join("");

          // Add click listeners
          modalMemberResults.querySelectorAll('.member-search-item').forEach(item => {
            item.addEventListener('click', () => {
              modalMemberResults.querySelectorAll('.member-search-item').forEach(i => i.style.background = '');
              item.style.background = 'rgba(0, 255, 136, 0.2)';
              addMemberSearchInput.value = item.dataset.memberName;
            });
          });
        });
      });
    } catch (err) {
      console.error("Error searching members:", err);
      modalMemberResults.innerHTML = '<div class="empty-state"><p>❌ Fehler</p></div>';
    }
  }

  // Add member to group
  function addMemberToGroup(memberId, memberName) {
    if (!selectedGroupId || !currentUser) return;

    try {
      db.collection("groups").doc(selectedGroupId).update({
        members: firebase.firestore.FieldValue.arrayUnion(memberId),
        [`roles.${memberId}`]: "user"
      });

      window.notify?.show({
        type: "success",
        title: "Erfolgreich",
        message: `${memberName} wurde hinzugefügt`,
        duration: 3500
      });

      addMemberSearchInput.value = "";
      modalMemberResults.innerHTML = '<div class="empty-state"><p>🔍 Suche...</p></div>';
      
    } catch (err) {
      console.error("Error adding member:", err);
      window.notify?.show({
        type: "error",
        title: "Fehler",
        message: "Konnte Mitglied nicht hinzufügen",
        duration: 4500
      });
    }
  }

  // Setup listeners
  function init() {
    console.log("🟢 connect.js: init() called");

    // Message input
    if (messageInput && btnSendMessage) {
      messageInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          sendMessage();
        }
      });
      btnSendMessage.addEventListener("click", sendMessage);
    }

    // Settings modal
    if (btnGroupSettings) {
      btnGroupSettings.addEventListener("click", openGroupSettings);
    }
    if (closeGroupSettings) {
      closeGroupSettings.addEventListener("click", closeSettingsModal);
    }

    // Add member search in modal
    if (addMemberSearchInput) {
      addMemberSearchInput.addEventListener("input", (e) => {
        const query = e.target.value.trim();
        if (query.length < 2) {
          modalMemberResults.innerHTML = '<div class="empty-state"><p>🔍 Suche...</p></div>';
          return;
        }
        searchMembersForModal(query);
      });
    }

    // Add member button in modal
    if (btnModalAddMember) {
      btnModalAddMember.addEventListener("click", () => {
        const selected = document.querySelector('[data-member-to-add]');
        if (selected) {
          const memberId = selected.dataset.memberToAdd;
          const memberName = selected.dataset.memberName;
          addMemberToGroup(memberId, memberName);
        } else {
          window.notify?.show({
            type: "warn",
            title: "Hinweis",
            message: "Bitte wähle einen Benutzer aus",
            duration: 4000
          });
        }
      });
    }

    // Settings modal buttons
    if (btnLeaveGroupModal) {
      btnLeaveGroupModal.addEventListener("click", leaveGroup);
    }
    if (btnDeleteGroupModal) {
      btnDeleteGroupModal.addEventListener("click", deleteGroup);
    }

    // Group selected event
    window.addEventListener("echtlucky:group-selected", (e) => {
      const { groupId, groupData } = e.detail;
      selectedGroupId = groupId;

      console.log("🔵 Group selected:", groupId);
      loadMessages();
      loadMembers();
      closeSettingsModal();
    });
  }

  // Initialize module
  async function initModule() {
    if (initialized) return;
    initialized = true;

    console.log("🔵 connect.js initializing");
    await waitForFirebase();

    if (!auth || !db) {
      console.error("❌ connect.js: Firebase not ready");
      return;
    }

    currentUser = auth.currentUser;
    if (!currentUser) return;

    init();
  }

  // Start
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initModule);
  } else {
    initModule();
  }

  console.log("✅ connect.js initialized");
})();
