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

  // Load groups from Firestore
  function loadGroups() {
    if (!currentUser) {
      groupsContainer.innerHTML = '<div class="empty-state"><p>📭 Nicht eingeloggt</p><small>Melde dich an um Gruppen zu sehen</small></div>';
      return;
    }

    try {
      db.collection("users")
        .doc(currentUser.uid)
        .collection("groups")
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
      db.collection("users")
        .doc(currentUser.uid)
        .collection("groups")
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
  }

  // Event listeners
  btnCreateGroup.addEventListener("click", createGroup);

  // Listen to auth changes
  auth.onAuthStateChanged((user) => {
    updateAuthStatus();
  });

  console.log("✅ connect-minimal.js initialized");
})();
