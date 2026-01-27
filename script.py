from pathlib import Path
import re
path = Path('connect.html')
data = path.read_text(encoding='utf-8')
pattern = r'(\s*<section class="connect-single-card-shell">.*?</section>)'
match = re.search(pattern, data, flags=re.S)
if not match:
    raise SystemExit('section block not found')
new_block = '''          <section class="connect-single-card-shell">
            <div class="connect-hero">
              <div class="connect-hero__inner">
                <h1 class="connect-title">Connect</h1>
              </div>
            </div>

            <div class="connect-main-card">
              <div class="auth-status-card" id="authStatusCard" hidden>
                <div class="auth-status-card__row">
                  <div id="statusLabel">Status</div>
                  <button class="btn" id="btnLogin" type="button">Login</button>
                </div>
              </div>

              <div class="connect-workspace" id="connectLayout" hidden>
                <aside class="connect-left-panel" aria-label="Gruppen-Navigation">
                  <div class="connect-left-header">
                    <div class="connect-left-search">
                      <i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
                      <input type="search" placeholder="Finde oder starte ein Gespräch" aria-label="Gruppen suchen" />
                    </div>
                    <button class="btn btn-sm" id="btnCreateGroup" type="button" title="Neue Gruppe">+</button>
                  </div>

                  <div class="connect-groups-list" id="groupsListPanel"></div>

                  <div class="friends-section">
                    <div class="friends-title"><span>Freunde hinzufügen</span></div>
                    <input
                      type="text"
                      id="friendSearchInput"
                      class="friend-search-input"
                      placeholder="Benutzer suchen…"
                      autocomplete="off"
                    />
                    <div class="friends-search-results" id="friendsSearchResults">
                      <div class="empty-state"><p>?? Suche…</p></div>
                    </div>
                  </div>
                </aside>

                <section class="connect-chat-area" aria-label="Chat und Anrufe">
                  <div class="chat-container" id="chatContainer" hidden>
                    <div class="chat-header">
                      <div class="chat-group-info">
                        <h2 class="chat-group-title" id="chatGroupTitle">Gruppe</h2>
                        <div class="chat-header-actions" aria-label="Chat Aktionen">
                          <button class="chat-settings-btn" id="btnStartCall" type="button" title="Anruf starten" aria-label="Anruf starten">
                            <i class="fa-solid fa-phone" aria-hidden="true"></i>
                          </button>
                          <button class="chat-settings-btn" id="btnGroupSettings" type="button" title="Einstellungen" aria-label="Gruppeneinstellungen">
                            <i class="fas fa-cog" aria-hidden="true"></i>
                          </button>
                        </div>
                      </div>

                      <div class="chat-call-bar" id="chatCallBar" hidden>
                        <div class="chat-call-bar__status" id="voiceStatus">Nicht im Call</div>
                        <div class="chat-call-bar__actions">
                          <label class="chat-call-bar__quality" for="shareQuality">
                            Qualität
                            <select id="shareQuality" class="chat-call-bar__quality-select">
                              <option value="720">720p</option>
                              <option value="1080" selected>1080p</option>
                              <option value="1440">1440p</option>
                            </select>
                          </label>
                          <button class="btn btn-secondary" id="btnShareScreen" type="button">?? Teilen</button>
                          <button class="btn btn-secondary" id="btnToggleMic" type="button" hidden>?? Stummschalten</button>
                          <button class="btn btn-danger" id="btnEndVoice" type="button" hidden>?? Beenden</button>
                        </div>
                      </div>
                    </div>

                    <div class="screen-share-area" id="screenShareArea" hidden aria-label="Bildschirmübertragung">
                      <div class="screen-share-sheet__header" aria-label="Screen Share Steuerung">
                        <div class="screen-share-sheet__handle" aria-hidden="true"></div>
                        <div class="screen-share-sheet__title">Bildschirm teilen</div>
                        <button class="screen-share-sheet__close" id="btnCloseScreenShare" type="button" aria-label="Schliessen">
                          <i class="fa-solid fa-xmark" aria-hidden="true"></i>
                        </button>
                      </div>
                      <div class="screen-share-grid" id="screenShareGrid"></div>
                    </div>

                    <div class="chat-tabs" role="tablist" aria-label="Chat/Voice Tabs">
                      <button class="chat-tab-btn is-active" type="button" data-tab="chat" role="tab" aria-selected="true">?? Chat</button>
                      <button class="chat-tab-btn" type="button" data-tab="voice" role="tab" aria-selected="false">?? Voice</button>
                    </div>

                    <div class="chat-tab-content is-active" data-tab="chat" role="tabpanel">
                      <div class="messages-box">
                        <div class="messages-list" id="messagesList"></div>
                      </div>
                      <div class="chat-input-area">
                        <input
                          type="text"
                          id="messageInput"
                          class="message-input"
                          placeholder="Schreibe eine Nachricht…"
                          autocomplete="off"
                        />
                        <button class="btn btn-sm" id="btnSendMessage" type="button" aria-label="Senden">
                          <i class="fas fa-paper-plane" aria-hidden="true"></i>
                        </button>
                      </div>
                    </div>

                    <div class="chat-tab-content" data-tab="voice" role="tabpanel">
                      <div class="voice-section">
                        <div class="voice-buttons">
                          <button class="btn btn-secondary" id="btnStartVoice" type="button">?? Voice beitreten</button>
                        </div>
                        <div class="voice-participants" id="voiceParticipants"></div>
                      </div>
                    </div>
                  </div>

                  <div class="empty-chat-state" id="emptyChatState">
                    <div class="empty-chat-inner">
                      <p class="empty-chat-icon">??</p>
                      <h3>Keine Gruppe ausgewählt</h3>
                      <p>Wähle eine Gruppe aus der linken Spalte, um zu chatten.</p>
                    </div>
                  </div>
                </section>

                <aside class="connect-right-panel" aria-label="Mitglieder">
                  <div class="members-header">
                    <h3 class="members-title">Mitglieder</h3>
                    <div class="members-count" id="membersCount">0</div>
                  </div>

                  <div class="members-add-section" id="membersAddSection" hidden>
                    <input
                      type="text"
                      id="addMemberInput"
                      class="add-member-input"
                      placeholder="Benutzer hinzufügen…"
                      autocomplete="off"
                    />
                    <div class="members-search-results" id="addMemberResults"></div>
                  </div>

                  <div class="members-list" id="membersList">
                    <div class="empty-state">
                      <p>Keine Mitglieder</p>
                    </div>
                  </div>
                </aside>
              </div>
            </div>
          </section>'''
new_data = data[:match.start()] + new_block + data[match.end():]
path.write_text(new_data, encoding='utf-8')
