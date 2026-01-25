// js/connect.js — echtlucky Connect Page Controller
// Manages chat, groups, voice calls, and real-time presence
// Guard: prevent double-load

(function () {
  "use strict";

  if (window.__ECHTLUCKY_CONNECT_LOADED__) {
    console.warn("connect.js already loaded – skipping");
    return;
  }
  window.__ECHTLUCKY_CONNECT_LOADED__ = true;

  const auth = window.auth || window.echtlucky?.auth;
  const db = window.db || window.echtlucky?.db;

  if (!auth || !db) {
    console.error("connect.js: auth/db missing. firebase.js must load first.");
    return;
  }

  // ============================================
  // STATE
  // ============================================

  let selectedGroupId = null;
  let currentUserGroups = [];
  let onlineUsers = new Map();
  let messageUnsubscribe = null;
  let groupsUnsubscribe = null;
  let presenceUnsubscribe = null;

  // ============================================
  // DOM ELEMENTS
  // ============================================

  const groupsList = document.getElementById("groupsList");
  const messageInput = document.getElementById("messageInput");
  const btnSendMessage = document.getElementById("btnSendMessage");
  const messagesArea = document.getElementById("messagesArea");
  const btnCreateGroup = document.getElementById("btnCreateGroup");
  const btnCreateGroupWelcome = document.getElementById("btnCreateGroupWelcome");
  const headerInfo = document.getElementById("headerInfo");
  const onlineUsersContainer = document.getElementById("onlineUsers");
  const membersList = document.getElementById("membersList");
  const statsGrid = document.getElementById("statsGrid");
  const userInfo = document.getElementById("userInfo");
  const btnUserMenu = document.getElementById("btnUserMenu");

  // ============================================
  // INITIALIZE
  // ============================================

  function init() {
    // Setup message send
    messageInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    btnSendMessage.addEventListener("click", sendMessage);

    // Create group buttons
    btnCreateGroup.addEventListener("click", createGroupPrompt);
    btnCreateGroupWelcome.addEventListener("click", createGroupPrompt);

    // View navigation
    document.querySelectorAll(".nav-item").forEach((item) => {
      item.addEventListener("click", (e) => {
        e.preventDefault();
        const view = item.dataset.view;
        if (view) switchView(view);
      });
    });

    // Settings
    document.querySelectorAll(".settings-form input").forEach((input) => {
      input.addEventListener("change", (e) => {
        const key = e.target.id;
        localStorage.setItem(key, e.target.checked);
      });
    });

    // User menu
    btnUserMenu.addEventListener("click", showUserMenu);

    // Listen to auth state
    auth.onAuthStateChanged(handleAuthStateChange);
  }

  // ============================================
  // AUTH STATE
  // ============================================

  function handleAuthStateChange(user) {
    if (user) {
      window.__ECHTLUCKY_CURRENT_USER__ = {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || "Anonymous"
      };

      // Update UI
      userInfo.textContent = user.displayName || user.email;

      // Load groups
      loadUserGroups();

      // Setup presence
      setupPresence(user.uid);
    } else {
      // Not logged in
      userInfo.innerHTML = '<span class="user-status">Not logged in</span>';
      messageInput.disabled = true;
      btnSendMessage.disabled = true;
      
      // Clear listeners
      if (messageUnsubscribe) messageUnsubscribe();
      if (groupsUnsubscribe) groupsUnsubscribe();
      if (presenceUnsubscribe) presenceUnsubscribe();
    }
  }

  // ============================================
  // PRESENCE (Online Status)
  // ============================================

  function setupPresence(uid) {
    const presenceRef = db.collection("presence").doc(uid);
    const userRef = db.collection("users").doc(uid);

    // Set presence as online
    presenceRef.set({
      uid,
      lastSeen: new Date(),
      status: "online"
    });

    // Listen to all presence docs
    presenceUnsubscribe = db.collection("presence").onSnapshot((snap) => {
      onlineUsers.clear();
      snap.forEach((doc) => {
        const data = doc.data();
        if (data.status === "online") {
          onlineUsers.set(doc.id, data);
        }
      });
      updateOnlineUsersList();
    });

    // Set offline on page unload
    window.addEventListener("beforeunload", () => {
      presenceRef.set({ status: "offline", lastSeen: new Date() });
    });
  }

  // ============================================
  // LOAD & DISPLAY GROUPS
  // ============================================

  function loadUserGroups() {
    const uid = auth.currentUser.uid;

    groupsUnsubscribe = db
      .collection("groups")
      .where("members", "array-contains", uid)
      .onSnapshot((snap) => {
        currentUserGroups = [];
        snap.forEach((doc) => {
          currentUserGroups.push({ id: doc.id, ...doc.data() });
        });
        displayGroupsList();
      });
  }

  function displayGroupsList() {
    groupsList.innerHTML = "";

    if (currentUserGroups.length === 0) {
      groupsList.innerHTML =
        '<p style="padding: 12px; color: var(--c-text-secondary); text-align: center;">Keine Groups. Erstelle eine neue!</p>';
      return;
    }

    currentUserGroups.forEach((group) => {
      const div = document.createElement("div");
      div.className = "group-item";
      if (group.id === selectedGroupId) div.classList.add("is-active");

      const memberCount = group.members?.length || 0;

      div.innerHTML = `
        <div class="group-name">${group.name}</div>
        <div class="group-users">${memberCount} member${memberCount !== 1 ? "s" : ""}</div>
      `;

      div.addEventListener("click", () => selectGroup(group.id, group));
      groupsList.appendChild(div);
    });
  }

  // ============================================
  // SELECT GROUP
  // ============================================

  function selectGroup(groupId, groupData) {
    selectedGroupId = groupId;
    window.__ECHTLUCKY_SELECTED_GROUP__ = groupId;

    // Update UI
    displayGroupsList();
    updateHeaderInfo(groupData);
    loadGroupMessages();
    loadGroupMembers();
    loadGroupStats();

    // Switch to chat view
    switchView("chat");

    // Enable input
    messageInput.disabled = false;
    btnSendMessage.disabled = false;
  }

  function updateHeaderInfo(groupData) {
    headerInfo.innerHTML = `
      <h2 class="header-title"># ${groupData.name}</h2>
      <p class="header-subtitle">${groupData.description || "No description"}</p>
    `;
  }

  // ============================================
  // MESSAGES
  // ============================================

  function loadGroupMessages() {
    if (!selectedGroupId) return;

    // Unsubscribe from previous group
    if (messageUnsubscribe) messageUnsubscribe();

    // Listen to messages from this group
    messageUnsubscribe = db
      .collection("groups")
      .doc(selectedGroupId)
      .collection("messages")
      .orderBy("createdAt", "asc")
      .limitToLast(50)
      .onSnapshot((snap) => {
        messagesArea.innerHTML = "";

        snap.forEach((doc) => {
          const msg = doc.data();
          displayMessage(msg);
        });

        // Scroll to bottom
        messagesArea.scrollTop = messagesArea.scrollHeight;
      });
  }

  function displayMessage(msg) {
    const div = document.createElement("div");
    div.className = "message";

    const initials = (msg.authorName || "?").substring(0, 1).toUpperCase();
    const time = new Date(msg.createdAt.toDate()).toLocaleTimeString("de-DE", {
      hour: "2-digit",
      minute: "2-digit"
    });

    div.innerHTML = `
      <div class="message-avatar">${initials}</div>
      <div class="message-content">
        <div class="message-header">
          <span class="message-author">${msg.authorName || "Anonymous"}</span>
          <span class="message-time">${time}</span>
        </div>
        <div class="message-text">${escapeHtml(msg.text)}</div>
      </div>
    `;

    messagesArea.appendChild(div);
  }

  function sendMessage() {
    const text = messageInput.value.trim();
    if (!text || !selectedGroupId || !auth.currentUser) {
      window.notify?.show({
        type: "warn",
        title: "Warnung",
        message: "Select a group first"
      });
      return;
    }

    const groupRef = db.collection("groups").doc(selectedGroupId);

    groupRef.collection("messages").add({
      authorUid: auth.currentUser.uid,
      authorName: auth.currentUser.displayName || auth.currentUser.email,
      text: text,
      createdAt: new Date()
    });

    messageInput.value = "";
    messageInput.focus();
  }

  // ============================================
  // MEMBERS
  // ============================================

  function loadGroupMembers() {
    if (!selectedGroupId) return;

    const group = currentUserGroups.find((g) => g.id === selectedGroupId);
    if (!group || !group.members) return;

    membersList.innerHTML = "";

    group.members.forEach((uid) => {
      db.collection("users")
        .doc(uid)
        .get()
        .then((doc) => {
          if (doc.exists) {
            const user = doc.data();
            const div = document.createElement("div");
            div.className = "member-card";

            const initials = (user.displayName || "?").substring(0, 1).toUpperCase();
            const isOnline = onlineUsers.has(uid);

            div.innerHTML = `
              <div class="member-avatar">${initials}</div>
              <div class="member-name">${user.displayName || "Unknown"}</div>
              <div class="member-status">${isOnline ? "🟢 Online" : "⚫ Offline"}</div>
            `;

            membersList.appendChild(div);
          }
        });
    });
  }

  // ============================================
  // STATS
  // ============================================

  function loadGroupStats() {
    if (!selectedGroupId) return;

    const group = currentUserGroups.find((g) => g.id === selectedGroupId);
    if (!group) return;

    statsGrid.innerHTML = "";

    const stats = [
      { icon: "👥", label: "Members", value: group.members?.length || 0 },
      { icon: "💬", label: "Messages", value: "Loading..." },
      { icon: "📅", label: "Created", value: new Date(group.createdAt.toDate()).toLocaleDateString("de-DE") },
      { icon: "⭐", label: "Activity", value: "High" }
    ];

    stats.forEach((stat) => {
      const div = document.createElement("div");
      div.className = "stat-card";
      div.innerHTML = `
        <div class="stat-icon">${stat.icon}</div>
        <div class="stat-label">${stat.label}</div>
        <div class="stat-value">${stat.value}</div>
      `;
      statsGrid.appendChild(div);
    });

    // Load actual message count
    db.collection("groups")
      .doc(selectedGroupId)
      .collection("messages")
      .get()
      .then((snap) => {
        const cards = statsGrid.querySelectorAll(".stat-card");
        if (cards[1]) {
          cards[1].querySelector(".stat-value").textContent = snap.size;
        }
      });
  }

  // ============================================
  // ONLINE USERS PANEL
  // ============================================

  function updateOnlineUsersList() {
    onlineUsersContainer.innerHTML = "";

    if (onlineUsers.size === 0) {
      onlineUsersContainer.innerHTML =
        '<p style="padding: 12px; text-align: center; color: var(--c-text-secondary); font-size: 0.85rem;">No one online</p>';
      return;
    }

    onlineUsers.forEach((user) => {
      const div = document.createElement("div");
      div.className = "online-user";
      div.innerHTML = `
        <div class="user-dot"></div>
        <div class="online-user-name">${user.displayName || user.email || "User"}</div>
      `;
      onlineUsersContainer.appendChild(div);
    });
  }

  // ============================================
  // CREATE GROUP
  // ============================================

  function createGroupPrompt() {
    const name = prompt("Group name:");
    if (!name) return;

    const description = prompt("Description (optional):");

    const uid = auth.currentUser.uid;

    db.collection("groups")
      .add({
        name: name,
        description: description || "",
        members: [uid],
        createdAt: new Date(),
        createdBy: uid
      })
      .then((docRef) => {
        window.notify?.show({
          type: "success",
          title: "Success",
          message: `Group "${name}" created!`,
          duration: 4500
        });
        selectGroup(docRef.id, { id: docRef.id, name, description });
      })
      .catch((error) => {
        window.notify?.show({
          type: "error",
          title: "Error",
          message: "Could not create group: " + error.message,
          duration: 5000
        });
      });
  }

  // ============================================
  // VIEW NAVIGATION
  // ============================================

  function switchView(viewName) {
    // Update nav items
    document.querySelectorAll(".nav-item").forEach((item) => {
      item.classList.remove("is-active");
      if (item.dataset.view === viewName) {
        item.classList.add("is-active");
      }
    });

    // Update views
    document.querySelectorAll(".connect-view").forEach((view) => {
      view.classList.remove("is-active");
      if (view.dataset.view === viewName) {
        view.classList.add("is-active");
      }
    });
  }

  // ============================================
  // USER MENU
  // ============================================

  function showUserMenu() {
    if (!auth.currentUser) {
      window.location.href = "login.html";
      return;
    }

    const choice = confirm(`Hi ${auth.currentUser.displayName || "User"}!\n\nLogout?`);
    if (choice) {
      auth.signOut();
      window.notify?.show({
        type: "success",
        title: "Logged Out",
        message: "See you later!",
        duration: 3500
      });
    }
  }

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

  document.addEventListener("DOMContentLoaded", init);

  console.log("✅ connect.js initialized");
})();
