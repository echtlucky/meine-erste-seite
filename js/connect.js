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
