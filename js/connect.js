// js/connect.js — Chat und Voice Extensions für Connect Page
// Ergänzt connect-minimal.js mit Chat-, Nachrichten- und Voice-Funktionalität
// Guard: prevent double-load

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
  let messagesUnsubscribe = null;

  // DOM Elements
  const messagesList = document.getElementById("messagesList");
  const messageInput = document.getElementById("messageInput");
  const btnSendMessage = document.getElementById("btnSendMessage");
  const membersList = document.getElementById("membersList");
  const btnStartVoice = document.getElementById("btnStartVoice");
  const btnEndVoice = document.getElementById("btnEndVoice");
  const groupTabs = document.querySelectorAll(".tab-btn");
  const tabContents = document.querySelectorAll(".tab-content");
  const btnDeleteGroup = document.getElementById("btnDeleteGroup");
  const btnLeaveGroup = document.getElementById("btnLeaveGroup");
  const addMemberInput = document.getElementById("addMemberInput");
  const btnAddMember = document.getElementById("btnAddMember");
  const addMemberResults = document.getElementById("addMemberResults");

  // ============================================
  // SETUP EVENT LISTENERS
  // ============================================

  function init() {
    // Message send
    if (messageInput && btnSendMessage) {
      messageInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          sendMessage();
        }
      });
      btnSendMessage.addEventListener("click", sendMessage);
    }

    // Tab switching
    groupTabs.forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const tabName = e.target.dataset.tab;
        switchTab(tabName);
      });
    });

    // Voice buttons
    if (btnStartVoice) {
      btnStartVoice.addEventListener("click", startVoiceCall);
    }
    if (btnEndVoice) {
      btnEndVoice.addEventListener("click", endVoiceCall);
    }

    // Settings buttons
    if (btnDeleteGroup) {
      btnDeleteGroup.addEventListener("click", deleteGroup);
    }
    if (btnLeaveGroup) {
      btnLeaveGroup.addEventListener("click", leaveGroup);
    }

    // Add member functionality
    if (btnAddMember && addMemberInput) {
      btnAddMember.addEventListener("click", searchAndAddMember);
      addMemberInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          searchAndAddMember();
        }
      });
    }

    // Listen to group selection changes (from connect-minimal.js)
    window.addEventListener("echtlucky:group-selected", (e) => {
      selectedGroupId = e.detail?.groupId;
      if (selectedGroupId) {
        // Enable message input when group selected
        if (messageInput) messageInput.disabled = false;
        if (btnSendMessage) btnSendMessage.disabled = false;
        
        loadGroupMessages();
        loadGroupMembers();
      }
    });

    console.log("✅ connect.js chat extensions loaded");
  }

  // ============================================
  // MESSAGES
  // ============================================

  function loadGroupMessages() {
    if (!selectedGroupId) return;

    // Unsubscribe from previous listener
    if (messagesUnsubscribe) messagesUnsubscribe();

    if (!messagesList) return;

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
            displayMessage(msg);
          });

          // Scroll to bottom
          setTimeout(() => {
            messagesList.scrollTop = messagesList.scrollHeight;
          }, 50);
        });
    } catch (err) {
      console.error("Error loading messages:", err);
    }
  }

  function displayMessage(msg) {
    if (!messagesList) return;

    const div = document.createElement("div");
    div.className = "message-item";

    const authorName = msg.authorName || "Anonymous";
    const text = msg.text || "";
    const time = msg.createdAt ? new Date(msg.createdAt.toDate()).toLocaleTimeString("de-DE", {
      hour: "2-digit",
      minute: "2-digit"
    }) : "";

    const initials = authorName.split(" ")[0][0].toUpperCase();

    div.innerHTML = `
      <div class="message-avatar" style="background: linear-gradient(135deg, var(--accent), #0088ff);">
        ${initials}
      </div>
      <div class="message-content">
        <div class="message-header">
          <strong class="message-author">${escapeHtml(authorName)}</strong>
          <span class="message-time">${time}</span>
        </div>
        <div class="message-text">${escapeHtml(text)}</div>
      </div>
    `;

    messagesList.appendChild(div);
  }

  function sendMessage() {
    const text = messageInput.value.trim();
    if (!text || !selectedGroupId || !auth.currentUser) {
      return;
    }

    const groupRef = db.collection("groups").doc(selectedGroupId);

    groupRef
      .collection("messages")
      .add({
        authorUid: auth.currentUser.uid,
        authorName: auth.currentUser.displayName || auth.currentUser.email?.split("@")[0] || "User",
        text: text,
        createdAt: new Date()
      })
      .then(() => {
        messageInput.value = "";
        messageInput.focus();
      })
      .catch((err) => {
        console.error("Error sending message:", err);
      });
  }

  // ============================================
  // MEMBERS
  // ============================================

  function loadGroupMembers() {
    if (!selectedGroupId || !membersList) return;

    try {
      db.collection("groups")
        .doc(selectedGroupId)
        .get()
        .then((doc) => {
          if (!doc.exists) return;

          const group = doc.data();
          const members = group.members || [];

          membersList.innerHTML = "";

          members.forEach((uid) => {
            db.collection("users")
              .doc(uid)
              .get()
              .then((userDoc) => {
                if (!userDoc.exists) return;

                const user = userDoc.data();
                const displayName = user.displayName || user.email?.split("@")[0] || "User";
                const isOnline = user.isOnline || false;
                const avatar = user.photoURL;

                const memberDiv = document.createElement("div");
                memberDiv.className = "member-item";
                memberDiv.innerHTML = `
                  <img
                    src="${avatar || 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22%3E%3Crect fill=%2300ff88%22 width=%22100%25%22 height=%22100%25%22/%3E%3C/svg%3E'}"
                    alt="${displayName}"
                    class="member-avatar"
                  />
                  <div class="member-info">
                    <div class="member-name">${escapeHtml(displayName)}</div>
                    <div class="member-status" style="color: ${isOnline ? '#00ff88' : '#888'};">
                      ${isOnline ? "🟢 Online" : "⚫ Offline"}
                    </div>
                  </div>
                `;
                membersList.appendChild(memberDiv);
              });
          });
        });
    } catch (err) {
      console.error("Error loading members:", err);
    }
  }

  // ============================================
  // TABS
  // ============================================

  function switchTab(tabName) {
    // Update button styles
    groupTabs.forEach((btn) => {
      btn.classList.remove("is-active");
      if (btn.dataset.tab === tabName) {
        btn.classList.add("is-active");
      }
    });

    // Update content visibility
    tabContents.forEach((content) => {
      content.style.display = "none";
      if (content.id === `${tabName}-content`) {
        content.style.display = "block";
      }
    });
  }

  // ============================================
  // VOICE CALLS (Placeholder)
  // ============================================

  function startVoiceCall() {
    if (!selectedGroupId) return;

    window.notify?.show({
      type: "info",
      title: "Voice Call",
      message: "Starting voice call in " + selectedGroupId + "..."
    });

    // Voice call logic handled by voice-chat.js
    window.dispatchEvent(new CustomEvent("echtlucky:voice-start", { detail: { groupId: selectedGroupId } }));
  }

  function endVoiceCall() {
    window.notify?.show({
      type: "info",
      title: "Voice Call",
      message: "Ending voice call..."
    });

    window.dispatchEvent(new CustomEvent("echtlucky:voice-end"));
  }

  // ============================================
  // GROUP SETTINGS
  // ============================================

  function deleteGroup() {
    if (!selectedGroupId || !auth.currentUser) return;

    const confirmed = confirm("Bist du sicher? Die Gruppe wird gelöscht (alle Daten!)");
    if (!confirmed) return;

    try {
      db.collection("groups")
        .doc(selectedGroupId)
        .delete()
        .then(() => {
          window.notify?.show({
            type: "success",
            title: "Gruppe gelöscht",
            message: "Deine Gruppe wurde gelöscht",
            duration: 3000
          });
          selectedGroupId = null;
          document.getElementById("selectedGroupSection").style.display = "none";
          // Reload groups list
          window.dispatchEvent(new CustomEvent("echtlucky:reload-groups"));
        })
        .catch((err) => {
          window.notify?.show({
            type: "error",
            title: "Fehler",
            message: "Gruppe konnte nicht gelöscht werden: " + err.message,
            duration: 4000
          });
        });
    } catch (err) {
      console.error("Delete group error:", err);
    }
  }

  function leaveGroup() {
    if (!selectedGroupId || !auth.currentUser) return;

    const confirmed = confirm("Bist du sicher, dass du die Gruppe verlassen möchtest?");
    if (!confirmed) return;

    try {
      const groupRef = db.collection("groups").doc(selectedGroupId);
      const userId = auth.currentUser.uid;
      
      // Use firebase.firestore.FieldValue for Compat SDK
      if (!firebase) {
        console.error("Firebase not available");
        return;
      }
      
      groupRef
        .update({
          members: firebase.firestore.FieldValue.arrayRemove(userId)
        })
        .then(() => {
          window.notify?.show({
            type: "success",
            title: "Gruppe verlassen",
            message: "Du hast die Gruppe verlassen",
            duration: 3000
          });
          selectedGroupId = null;
          document.getElementById("selectedGroupSection").style.display = "none";
          // Reload groups list
          window.dispatchEvent(new CustomEvent("echtlucky:reload-groups"));
        })
        .catch((err) => {
          console.error("Leave group error:", err);
          window.notify?.show({
            type: "error",
            title: "Fehler",
            message: "Fehler beim Verlassen: " + err.message,
            duration: 4000
          });
        });
    } catch (err) {
      console.error("Leave group error:", err);
      window.notify?.show({
        type: "error",
        title: "Fehler",
        message: "Fehler beim Verlassen der Gruppe",
        duration: 4000
      });
    }
  }

  // Search and add member to group
  async function searchAndAddMember() {
    if (!selectedGroupId || !addMemberInput || !addMemberResults) return;

    const username = addMemberInput.value.trim().toLowerCase();
    if (!username || username.length < 2) {
      if (addMemberResults) {
        addMemberResults.innerHTML = '<p style="color: var(--text-muted);">Bitte mindestens 2 Zeichen eingeben</p>';
      }
      return;
    }

    try {
      // Search for username
      const usernamesRef = db.collection("usernames");
      const querySnapshot = await usernamesRef
        .where("__name__", ">=", username)
        .where("__name__", "<", username + "z")
        .limit(10)
        .get();

      if (querySnapshot.empty) {
        addMemberResults.innerHTML = '<p style="color: var(--text-muted);">🔍 Kein Benutzer gefunden</p>';
        return;
      }

      // Get group data to check current members
      const groupDoc = await db.collection("groups").doc(selectedGroupId).get();
      const currentMembers = groupDoc.data()?.members || [];

      // Render results
      addMemberResults.innerHTML = '';
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        const userId = data.uid;
        const isAlreadyMember = currentMembers.includes(userId);

        const resultItem = document.createElement('div');
        resultItem.className = 'member-search-result';
        resultItem.style.cssText = `
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.8rem 1rem;
          background: rgba(255,255,255,0.05);
          border-radius: 12px;
          margin-bottom: 0.6rem;
          border: 1px solid rgba(255,255,255,0.1);
        `;

        resultItem.innerHTML = `
          <div style="flex: 1;">
            <div style="font-weight: 600; color: white;">${doc.id}</div>
            <div style="font-size: 0.85rem; color: var(--text-muted);">${data.email || 'Kein Email'}</div>
          </div>
          <button class="btn btn-sm ${isAlreadyMember ? 'btn-secondary' : 'btn-primary'}" 
                  ${isAlreadyMember ? 'disabled' : ''}
                  onclick="window.echtluckyAddMemberToGroup('${userId}', '${doc.id}')">
            ${isAlreadyMember ? '✓ Mitglied' : '+ Hinzufügen'}
          </button>
        `;

        addMemberResults.appendChild(resultItem);
      });
    } catch (err) {
      console.error("Search error:", err);
      addMemberResults.innerHTML = `<p style="color: #ff6b6b;">❌ Suche fehlgeschlagen</p>`;
    }
  }

  // Add member to group (global function)
  window.echtluckyAddMemberToGroup = async function(userId, username) {
    if (!selectedGroupId || !firebase) return;

    try {
      const groupRef = db.collection("groups").doc(selectedGroupId);
      
      await groupRef.update({
        members: firebase.firestore.FieldValue.arrayUnion(userId)
      });

      window.notify?.show({
        type: "success",
        title: "Mitglied hinzugefügt",
        message: `${username} wurde zur Gruppe hinzugefügt!`,
        duration: 3000
      });

      // Reload members list
      loadGroupMembers(selectedGroupId);
      
      // Clear search
      if (addMemberInput) addMemberInput.value = '';
      if (addMemberResults) addMemberResults.innerHTML = '';
    } catch (err) {
      console.error("Add member error:", err);
      window.notify?.show({
        type: "error",
        title: "Fehler",
        message: "Mitglied konnte nicht hinzugefügt werden",
        duration: 3000
      });
    }
  };

  // ============================================
  // UTILITIES
  // ============================================

  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  // ============================================
  // STARTUP
  // ============================================

  async function initModule() {
    if (initialized) return;
    initialized = true;

    console.log("🔵 connect.js initializing");
    await waitForFirebase();

    if (!auth || !db) {
      console.error("❌ connect.js: Firebase not ready");
      return;
    }

    init();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initModule);
  } else {
    initModule();
  }

  console.log("✅ connect.js extensions initialized");
})();
