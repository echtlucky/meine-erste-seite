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
    if (!currentUser || currentUser.uid !== selectedGroupId.creator) {
      window.notify?.show({
        type: "error",
        title: "Fehler",
        message: "Nur der Admin kann Rollen ändern",
        duration: 3000
      });
      return;
    }

    try {
      db.collection("groups")
        .doc(groupId)
        .update({
          [`roles.${memberId}`]: newRole
        });

      window.notify?.show({
        type: "success",
        title: "Erfolgreich",
        message: `Rolle geändert zu ${newRole}`,
        duration: 2000
      });
    } catch (err) {
      console.error("Error changing role:", err);
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
        duration: 2000
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
        duration: 2000
      });

      window.dispatchEvent(new CustomEvent("echtlucky:reload-groups"));
    } catch (err) {
      console.error("Error deleting group:", err);
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
