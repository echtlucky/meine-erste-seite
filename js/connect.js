// Discord-style Connect Page Logic
// Modular, event-driven, dynamic content for sidebar navigation, friends, groups, requests, calls, and settings

document.addEventListener('DOMContentLoaded', () => {
  // Sidebar navigation
  const navBtns = document.querySelectorAll('.sidebar-nav-btn');
  const content = document.getElementById('connectContent');
  const details = document.getElementById('connectDetails');
  let currentSection = 'friends';

  navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      navBtns.forEach(b => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      currentSection = btn.dataset.section;
      renderSection(currentSection);
    });
  });

  // Render main section
  function renderSection(section) {
    details.innerHTML = '';
    switch (section) {
      case 'friends':
        renderFriends(); break;
      case 'groups':
        renderGroups(); break;
      case 'requests':
        renderRequests(); break;
      case 'settings':
        renderSettings(); break;
      default:
        content.innerHTML = '<div class="discord-card"><h2>Unbekannter Bereich</h2></div>';
    }
  }

  // --- FRIENDS ---
  function renderFriends() {
    content.innerHTML = `
      <div class="discord-card">
        <h2>Freunde</h2>
        <div id="friendsList"></div>
        <button class="btn btn-primary" id="addFriendBtn"><i class="fa fa-user-plus"></i> Freund hinzufügen</button>
        <div id="addFriendForm" style="display:none; margin-top:1.2rem;">
          <input type="text" id="addFriendInput" placeholder="Benutzername#Tag" autocomplete="off" />
          <button class="btn btn-success" id="submitAddFriend">Anfrage senden</button>
          <div id="addFriendFeedback" style="margin-top:0.5rem; font-size:0.98em;"></div>
        </div>
      </div>
      <div class="discord-card" id="friendRequestsCard">
        <h2>Freundschaftsanfragen</h2>
        <div id="requestsList"></div>
      </div>
      <div class="discord-card" id="callCard">
        <h2>Anrufe</h2>
        <div id="callStatus">Nicht verbunden</div>
        <div style="display:flex; gap:1rem; margin:1.2rem 0;">
          <button class="btn btn-primary" id="startDirectCallBtn"><i class="fa fa-phone"></i> 1:1 Call</button>
          <button class="btn btn-primary" id="startGroupCallBtn"><i class="fa fa-users"></i> Gruppen-Call</button>
          <button class="btn btn-danger" id="leaveCallBtn"><i class="fa fa-phone-slash"></i> Auflegen</button>
        </div>
        <div id="callParticipants" style="margin-top:0.5rem; color:#b9bbbe;"></div>
      </div>
    `;
    // Add Friend Button
    document.getElementById('addFriendBtn').onclick = () => {
      const form = document.getElementById('addFriendForm');
      form.style.display = form.style.display === 'none' ? 'block' : 'none';
    };
    // Submit Add Friend
    document.getElementById('submitAddFriend').onclick = async () => {
      const input = document.getElementById('addFriendInput');
      const feedback = document.getElementById('addFriendFeedback');
      const value = input.value.trim();
      if (!/^.{3,32}#\d{4}$/.test(value)) {
        feedback.textContent = 'Bitte im Format Benutzername#1234 eingeben.';
        feedback.style.color = '#ed4245';
        return;
      }
      feedback.textContent = 'Sende Anfrage...';
      feedback.style.color = '#b9bbbe';
      // TODO: Backend-Request zum Hinzufügen
      setTimeout(() => {
        feedback.textContent = 'Anfrage gesendet!';
        feedback.style.color = '#43b581';
        input.value = '';
      }, 1200);
    };
    // Call-Buttons
    document.getElementById('startDirectCallBtn').onclick = () => {
      document.getElementById('callStatus').textContent = 'Starte 1:1 Call...';
      // TODO: Backend-Logik für Direktanruf
      setTimeout(() => {
        document.getElementById('callStatus').textContent = 'Im 1:1 Call (Demo)';
        document.getElementById('callParticipants').textContent = 'Du, Freund';
      }, 1200);
    };
    document.getElementById('startGroupCallBtn').onclick = () => {
      document.getElementById('callStatus').textContent = 'Starte Gruppen-Call...';
      // TODO: Backend-Logik für Gruppenanruf
      setTimeout(() => {
        document.getElementById('callStatus').textContent = 'Im Gruppen-Call (Demo)';
        document.getElementById('callParticipants').textContent = 'Du, Freund 1, Freund 2';
      }, 1200);
    };
    document.getElementById('leaveCallBtn').onclick = () => {
      document.getElementById('callStatus').textContent = 'Nicht verbunden';
      document.getElementById('callParticipants').textContent = '';
    };
    // TODO: Load friends and requests from backend, render lists
    document.getElementById('friendsList').innerHTML = '<div style="color:#b9bbbe;">(Freunde werden geladen...)</div>';
    document.getElementById('requestsList').innerHTML = '<div style="color:#b9bbbe;">(Anfragen werden geladen...)</div>';
  }

  // --- GROUPS ---
  function renderGroups() {
    content.innerHTML = `
      <div class="discord-card">
        <h2>Gruppen</h2>
        <div id="groupsList"></div>
        <button class="btn btn-primary" id="createGroupBtn"><i class="fa fa-plus"></i> Neue Gruppe</button>
      </div>
    `;
    // TODO: Load groups, render list, handle create/join
  }

  // --- REQUESTS ---
  function renderRequests() {
    content.innerHTML = `
      <div class="discord-card">
        <h2>Freundschaftsanfragen</h2>
        <div id="requestsList"></div>
      </div>
    `;
    // TODO: Load friend requests, render accept/decline
  }

  // --- SETTINGS ---
  function renderSettings() {
    content.innerHTML = `
      <div class="discord-card">
        <h2>Profil & Einstellungen</h2>
        <div style="display:flex;align-items:center;gap:1.2rem;">
          <div style="width:56px;height:56px;border-radius:50%;background:#5865f2;color:#fff;display:flex;align-items:center;justify-content:center;font-size:2rem;">U</div>
          <div>
            <div style="font-weight:700;font-size:1.1rem;">Username#1234</div>
            <div style="color:#b9bbbe;font-size:0.95rem;">Status: <span id="settingsStatusText">Online</span></div>
          </div>
        </div>
        <div style="margin-top:1.5rem;">
          <label>Benutzername</label>
          <input type="text" id="settingsUsername" value="Gast" />
          <label>Status</label>
          <select id="settingsStatus">
            <option value="online">Online</option>
            <option value="offline">Offline</option>
            <option value="dnd">Nicht stören</option>
          </select>
          <button class="btn btn-success" id="saveSettingsBtn">Speichern</button>
        </div>
      </div>
      <div class="discord-card">
        <h2>Gruppenverwaltung</h2>
        <div id="groupsManageList"></div>
        <button class="btn btn-primary" id="createGroupBtn"><i class="fa fa-plus"></i> Neue Gruppe</button>
      </div>
    `;
    // Save Settings
    document.getElementById('saveSettingsBtn').onclick = () => {
      document.getElementById('settingsStatusText').textContent = document.getElementById('settingsStatus').selectedOptions[0].text;
      // TODO: Backend-Update für Profil/Status
      window.notify?.show({type:'success',title:'Gespeichert',message:'Profil aktualisiert!',duration:3000});
    };
    // TODO: Gruppen laden, verwalten, erstellen
    document.getElementById('groupsManageList').innerHTML = '<div style="color:#b9bbbe;">(Gruppen werden geladen...)</div>';
  }

  // Initial render
  renderSection(currentSection);
});
      for (const uid of members) {
        if (uid === currentUser.uid) continue;
        await db.collection("users").doc(uid).collection("callRequests").add({
          from: currentUser.uid,
          fromName: currentUser.displayName || "User",
          callId,
          groupId: selectedGroupId,
          type: "group",
          createdAt: new Date(),
          status: "pending"
        });
        // Push-Benachrichtigung (Demo, echtes Senden via Backend)
        if (window.echtlucky?.voiceChat?.sendCallPush) {
          window.echtlucky.voiceChat.sendCallPush(uid, "Eingehender Gruppenanruf", `${currentUser.displayName || "User"} ruft dich in einer Gruppe an.`, { callId, groupId: selectedGroupId, type: "group" });
        }
      }
      window.notify?.show({
        type: "success",
        title: "Anruf gestartet",
        message: "Die Mitglieder werden jetzt angerufen...",
        duration: 4000
      });
    } catch (err) {
      console.error("Fehler beim Starten des Anrufs:", err);
      window.notify?.show({
        type: "error",
        title: "Fehler",
        message: "Anruf konnte nicht gestartet werden",
        duration: 4000
      });
    }
  }
// js/connect.js v2 — Chat, Members, Roles, and Settings for 3-Column Layout

(function () {
  "use strict";

  if (window.__ECHTLUCKY_CONNECT_EXT_LOADED__) {
    // Discord-style Connect: Single Card, Tabs, Clean Chat, Adden, Settings
    document.addEventListener('DOMContentLoaded', () => {
      const content = document.getElementById('connectContent');
      const tabs = document.querySelectorAll('.connect-tab');
      const addFriendBtn = document.getElementById('addFriendBtn');
      const settingsBtn = document.getElementById('settingsBtn');
      let currentTab = 'friends';

      tabs.forEach(tab => {
        tab.addEventListener('click', () => {
          tabs.forEach(t => t.classList.remove('is-active'));
          tab.classList.add('is-active');
          currentTab = tab.dataset.tab;
          renderTab(currentTab);
        });
      });
      if (addFriendBtn) addFriendBtn.onclick = () => renderAddFriend();
      if (settingsBtn) settingsBtn.onclick = () => renderTab('settings');

      function renderTab(tab) {
        switch (tab) {
          case 'friends': renderFriends(); break;
          case 'groups': renderGroups(); break;
          case 'requests': renderRequests(); break;
          case 'settings': renderSettings(); break;
          default: content.innerHTML = '<div class="discord-card"><h2>Unbekannter Bereich</h2></div>';
        }
      }

      function renderFriends() {
        content.innerHTML = `
          <div class="friends-list-section">
            <h2>Freunde</h2>
            <div id="friendsList"></div>
          </div>
          <div class="chat-section">
            <div class="chat-header-row">
              <span class="chat-title">Chat</span>
              <button class="btn btn-primary" id="callBtn" title="Anrufen"><i class="fa fa-phone"></i></button>
            </div>
            <div class="messages-box">
              <div class="messages-list" id="messagesList"></div>
            </div>
            <div class="chat-input-area">
              <input type="text" id="messageInput" class="message-input" placeholder="Schreibe eine Nachricht..." />
              <button class="btn btn-primary btn-sm" id="btnSendMessage"><i class="fa fa-paper-plane"></i></button>
            </div>
          </div>
        `;
        document.getElementById('callBtn').onclick = () => {
          alert('Anruf gestartet! (Demo)');
        };
        document.getElementById('btnSendMessage').onclick = () => {
          const input = document.getElementById('messageInput');
          const list = document.getElementById('messagesList');
          if (input.value.trim()) {
            const msg = document.createElement('div');
            msg.className = 'message';
            msg.textContent = input.value;
            list.appendChild(msg);
            input.value = '';
            list.scrollTop = list.scrollHeight;
          }
        };
      }

      function renderAddFriend() {
        content.innerHTML = `
          <div class="add-friend-section">
            <h2>Freund hinzufügen</h2>
            <input type="text" id="addFriendInput" placeholder="Benutzername#Tag" autocomplete="off" />
            <button class="btn btn-success" id="submitAddFriend">Anfrage senden</button>
            <div id="addFriendFeedback" style="margin-top:0.5rem; font-size:0.98em;"></div>
          </div>
        `;
        document.getElementById('submitAddFriend').onclick = async () => {
          const input = document.getElementById('addFriendInput');
          const feedback = document.getElementById('addFriendFeedback');
          const value = input.value.trim();
          if (!/^.{3,32}#\d{4}$/.test(value)) {
            feedback.textContent = 'Bitte im Format Benutzername#1234 eingeben.';
            feedback.style.color = '#ed4245';
            return;
          }
          feedback.textContent = 'Sende Anfrage...';
          feedback.style.color = '#b9bbbe';
          setTimeout(() => {
            feedback.textContent = 'Anfrage gesendet!';
            feedback.style.color = '#43b581';
            input.value = '';
          }, 1200);
        };
      }

      function renderGroups() {
        content.innerHTML = `<div class="groups-section"><h2>Gruppen</h2><div id="groupsList"></div></div>`;
      }
      function renderRequests() {
        content.innerHTML = `<div class="requests-section"><h2>Anfragen</h2><div id="requestsList"></div></div>`;
      }
      function renderSettings() {
        content.innerHTML = `
          <div class="settings-section">
            <h2 style="margin-bottom:1.2rem;">Einstellungen</h2>
            <div class="settings-user-card">
              <div class="avatar"><i class="fa fa-user"></i></div>
              <div style="flex:1;">
                <div style="font-weight:700;">Benutzername</div>
                <div style="color:#b9bbbe;font-size:0.98rem;">user@email.com</div>
              </div>
              <button class="btn btn-danger btn-sm" style="margin-left:1rem;">Abmelden</button>
            </div>
            <div class="settings-list" style="margin-top:2rem;">
              <div class="setting-item">
                <label class="switch-label">Benachrichtigungen
                  <input type="checkbox" class="switch" checked />
                  <span class="slider"></span>
                </label>
              </div>
              <div class="setting-item">
                <label class="switch-label">Online-Status anzeigen
                  <input type="checkbox" class="switch" checked />
                  <span class="slider"></span>
                </label>
              </div>
              <div class="setting-item">
                <label class="switch-label">Soundeffekte
                  <input type="checkbox" class="switch" />
                  <span class="slider"></span>
                </label>
              </div>
              <div class="setting-item">
                <label class="switch-label">Theme
                  <select class="theme-select">
                    <option value="dark">Dark</option>
                    <option value="light">Light</option>
                    <option value="system">System</option>
                  </select>
                </label>
              </div>
              <div class="setting-item">
                <label class="switch-label">Account löschen
                  <button class="btn btn-danger btn-sm" style="margin-left:1rem;">Löschen</button>
                </label>
              </div>
            </div>
          </div>
        `;
      }
      renderTab(currentTab);
    });
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


              // Direktanruf-Button (außer man selbst)
              const directCallBtn = memberId !== currentUser.uid
                ? `<button class="btn btn-xs btn-direct-call" data-direct-call-uid="${memberId}" data-direct-call-name="${escapeHtml(userData.displayName || userData.email?.split("@")?.[0] || "User")}" title="Direktanruf"><span style="font-size:1.1em;">📞</span></button>`
                : "";

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
                    <div class="member-name">${escapeHtml(userData.displayName || (userData.email?.split("@")[0]))}</div>
                  </div>
                </div>
                <div style="display: flex; gap: 0.5rem; align-items: center;">
                  ${roleSelect}
                  ${directCallBtn}
                </div>
              `;
              // Direktanruf-Button Listener
              if (div.querySelector('.btn-direct-call')) {
                div.querySelector('.btn-direct-call').addEventListener('click', (e) => {
                  const uid = e.currentTarget.getAttribute('data-direct-call-uid');
                  const name = e.currentTarget.getAttribute('data-direct-call-name');
                  startDirectCall(uid, name);
                });
              }

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

    echtluckyModal.confirm({
      title: "Gruppe verlassen",
      message: "Möchtest du diese Gruppe wirklich verlassen? Du kannst ihr später wieder beitreten.",
      confirmText: "Ja, verlassen",
      cancelText: "Abbrechen",
      type: "warning"
    }).then(confirmed => {
      if (!confirmed) return;

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
        window.notify?.show({
          type: "error",
          title: "Fehler",
          message: "Konnte Gruppe nicht verlassen",
          duration: 4500
        });
      }
    });
  }

  // Delete group
  function deleteGroup() {
    if (!selectedGroupId || !currentUser) return;

    echtluckyModal.confirm({
      title: "Gruppe löschen",
      message: "Möchtest du diese Gruppe wirklich löschen? Dies ist nicht rückgängig zu machen! Alle Nachrichten und Daten gehen verloren.",
      confirmText: "Ja, löschen",
      cancelText: "Abbrechen",
      type: "danger"
    }).then(confirmed => {
      if (!confirmed) return;

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
        window.notify?.show({
          type: "error",
          title: "Fehler",
          message: "Konnte Gruppe nicht löschen",
          duration: 4500
        });
      }
    });
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


    // Voice/Call Buttons
    const btnStartCall = document.getElementById("btnStartCall");
    if (btnStartCall) {
      btnStartCall.addEventListener("click", startGroupCall);
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
