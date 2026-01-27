(() => {
  "use strict";

  if (window.__ECHTLUCKY_OVERLAYS_LOADED__) return;
  window.__ECHTLUCKY_OVERLAYS_LOADED__ = true;

  const OVERLAY_OPEN_KEY = "echtlucky:overlay:open";
  const focusableSelector =
    "a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex='-1'])";

  const state = {
    openName: null,
    lastFocus: null,
    trapHandler: null,
  };

  function qs(sel, root = document) {
    return root.querySelector(sel);
  }

  function qsa(sel, root = document) {
    return Array.from(root.querySelectorAll(sel));
  }

  function ensureOverlayRoot() {
    let root = document.getElementById("echtlckyOverlayRoot");
    if (root) return root;

    root = document.createElement("div");
    root.id = "echtlckyOverlayRoot";
    document.body.appendChild(root);
    return root;
  }

  function fontsOverlayHtml() {
    return `
      <section class="overlay overlay--fonts" data-overlay-name="fonts" hidden aria-hidden="true">
        <div class="overlay__backdrop" data-overlay-close="1"></div>

        <div class="overlay__panel" role="dialog" aria-modal="true" aria-labelledby="overlayFontsTitle">
          <header class="overlay__header">
            <div class="overlay__headText">
              <div class="overlay__kicker">Tools</div>
              <h2 class="overlay__title" id="overlayFontsTitle">Schriftgenerator</h2>
              <p class="overlay__sub">Styles für Games, Socials & Connect — klick zum Kopieren.</p>
            </div>

            <div class="overlay__headActions">
              <button class="overlay__iconBtn" type="button" data-overlay-close="1" aria-label="Schließen">
                ×
              </button>
            </div>
          </header>

          <div class="overlay__body overlay__body--scroll">
            <div class="fonts-shell fonts-shell--overlay">
              <section class="fonts-card">
                <header class="fonts-card__head">
                  <div>
                    <p class="card-label">Input</p>
                    <h2>Dein Text</h2>
                  </div>
                  <div class="fonts-tools">
                    <input
                      id="fontsFilter"
                      class="fonts-filter"
                      type="search"
                      placeholder="Style suchen…"
                      autocomplete="off"
                    />
                    <button class="btn btn-sm btn-secondary" id="btnResetFonts" type="button">Reset</button>
                  </div>
                </header>

                <div class="fonts-input">
                  <label for="fontsText" class="fonts-label">Text</label>
                  <input
                    id="fontsText"
                    type="text"
                    placeholder="z.B. lucassteckel"
                    autocomplete="off"
                    maxlength="40"
                  />
                  <p class="fonts-hint" id="fontsHint">Tipp: Klick auf einen Style kopiert ihn direkt.</p>
                </div>

                <div class="fonts-hero__actions">
                  <button class="btn btn-secondary" id="btnUseLcky" type="button">„ˡᶜᵏʸ“ preset</button>
                  <button class="btn" id="btnCopyBest" type="button">Besten Style kopieren</button>
                </div>
              </section>

              <section class="fonts-card">
                <header class="fonts-card__head">
                  <div>
                    <p class="card-label">Styles</p>
                    <h2>Vorschau</h2>
                  </div>
                  <div class="fonts-pill" id="fontsCount">0 Styles</div>
                </header>

                <div class="fonts-grid" id="fontsGrid" aria-label="Schriften Vorschau"></div>
              </section>
            </div>
          </div>
        </div>
      </section>
    `;
  }

  function supportOverlayHtml() {
    return `
      <section class="overlay overlay--support" data-overlay-name="support" hidden aria-hidden="true">
        <div class="overlay__backdrop" data-overlay-close="1"></div>

        <div class="overlay__panel overlay__panel--wide" role="dialog" aria-modal="true" aria-labelledby="overlaySupportTitle">
          <header class="overlay__header">
            <div class="overlay__headText">
              <div class="overlay__kicker">Support</div>
              <h2 class="overlay__title" id="overlaySupportTitle">Tickets</h2>
              <p class="overlay__sub" id="supportSubline">Erstelle ein Ticket — Kontext wird automatisch gespeichert.</p>
            </div>

            <div class="overlay__headActions">
              <nav class="overlay-tabs" role="tablist" aria-label="Support Tabs">
                <button class="overlay-tab is-active" type="button" role="tab" aria-selected="true" data-support-tab="new">Neues Ticket</button>
                <button class="overlay-tab" type="button" role="tab" aria-selected="false" data-support-tab="mine">Meine Tickets</button>
                <button class="overlay-tab" type="button" role="tab" aria-selected="false" data-support-tab="queue" data-staff-only hidden>Queue</button>
              </nav>

              <button class="overlay__iconBtn" type="button" data-overlay-close="1" aria-label="Schließen">
                ×
              </button>
            </div>
          </header>

          <div class="overlay__body">
            <div class="support-banner" id="supportBanner" hidden></div>

            <div class="support-pane" data-support-pane="new">
              <form class="support-form" id="supportTicketForm">
                <div class="support-grid">
                  <label class="support-field">
                    <span>Kategorie</span>
                    <select id="ticketCategory" required>
                      <option value="bug">Bug</option>
                      <option value="account">Account</option>
                      <option value="payments">Payments</option>
                      <option value="feedback">Feedback</option>
                      <option value="other">Sonstiges</option>
                    </select>
                  </label>

                  <label class="support-field">
                    <span>Priorität</span>
                    <select id="ticketPriority" required>
                      <option value="normal">Normal</option>
                      <option value="low">Low</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </label>

                  <label class="support-field support-field--full">
                    <span>Titel</span>
                    <input id="ticketTitle" type="text" minlength="5" maxlength="80" autocomplete="off" required />
                  </label>

                  <label class="support-field support-field--full">
                    <span>Beschreibung</span>
                    <textarea id="ticketBody" rows="6" minlength="10" maxlength="2000" required></textarea>
                  </label>

                  <label class="support-field support-field--full">
                    <span>Datei / Screenshot (optional)</span>
                    <input id="ticketFiles" type="file" multiple />
                    <div class="support-files" id="ticketFilesList"></div>
                  </label>
                </div>

                <div class="support-form__actions">
                  <div class="support-meta" id="ticketContextMeta"></div>
                  <button class="btn btn-primary" id="btnSubmitTicket" type="submit">Ticket erstellen</button>
                </div>
              </form>
            </div>

            <div class="support-pane" data-support-pane="mine" hidden>
              <div class="support-split">
                <aside class="support-list">
                  <div class="support-list__head">
                    <h3>Meine Tickets</h3>
                    <button class="btn btn-sm btn-secondary" type="button" id="btnRefreshMyTickets">Refresh</button>
                  </div>
                  <div class="support-list__body" id="myTicketsList"></div>
                </aside>

                <section class="support-thread">
                  <div class="support-thread__head" id="ticketThreadHead"></div>
                  <div class="support-thread__body" id="ticketThreadBody"></div>
                  <form class="support-reply" id="ticketReplyForm">
                    <input id="ticketReplyInput" type="text" placeholder="Antwort schreiben…" autocomplete="off" />
                    <button class="btn btn-sm btn-primary" type="submit" id="btnSendTicketReply">Senden</button>
                    <button class="btn btn-sm btn-secondary" type="button" id="btnCloseTicket" hidden>Ticket schließen</button>
                  </form>
                </section>
              </div>
            </div>

            <div class="support-pane" data-support-pane="queue" hidden>
              <div class="support-split">
                <aside class="support-list">
                  <div class="support-list__head">
                    <h3>Ticket-Queue</h3>
                    <button class="btn btn-sm btn-secondary" type="button" id="btnRefreshQueue">Refresh</button>
                  </div>
                  <div class="support-filters">
                    <select id="queueStatus">
                      <option value="open">Open</option>
                      <option value="waiting_user">Waiting User</option>
                      <option value="waiting_staff">Waiting Staff</option>
                      <option value="closed">Closed</option>
                      <option value="all">Alle</option>
                    </select>
                    <select id="queuePriority">
                      <option value="all">Priorität</option>
                      <option value="urgent">Urgent</option>
                      <option value="high">High</option>
                      <option value="normal">Normal</option>
                      <option value="low">Low</option>
                    </select>
                  </div>
                  <div class="support-list__body" id="queueTicketsList"></div>
                </aside>

                <section class="support-thread">
                  <div class="support-thread__head" id="staffThreadHead"></div>
                  <div class="support-thread__body" id="staffThreadBody"></div>

                  <div class="support-staffbar" id="staffControls" hidden>
                    <button class="btn btn-sm btn-primary" type="button" id="btnClaimTicket">Claim</button>
                    <button class="btn btn-sm btn-secondary" type="button" id="btnUnclaimTicket">Unclaim</button>
                    <select id="staffStatus">
                      <option value="open">Open</option>
                      <option value="waiting_user">Waiting User</option>
                      <option value="waiting_staff">Waiting Staff</option>
                      <option value="closed">Closed</option>
                    </select>
                    <select id="staffPriority">
                      <option value="low">Low</option>
                      <option value="normal">Normal</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                    <button class="btn btn-sm btn-secondary" type="button" id="btnAddInternalNote">Interne Notiz</button>
                    <button class="btn btn-sm btn-danger" type="button" id="btnBanUser" hidden>User sperren</button>
                    <button class="btn btn-sm btn-secondary" type="button" id="btnMergeTicket" hidden>Merge</button>
                  </div>

                  <form class="support-reply" id="staffReplyForm">
                    <input id="staffReplyInput" type="text" placeholder="Antwort an User…" autocomplete="off" />
                    <button class="btn btn-sm btn-primary" type="submit" id="btnSendStaffReply">Senden</button>
                  </form>
                </section>
              </div>
            </div>
          </div>
        </div>
      </section>
    `;
  }

  function ensureOverlays() {
    const root = ensureOverlayRoot();
    if (root.dataset.ready === "1") return;

    root.innerHTML = fontsOverlayHtml() + supportOverlayHtml();
    root.dataset.ready = "1";
  }

  function getOverlayEl(name) {
    const safe = CSS.escape(String(name || ""));
    return qs(`[data-overlay-name="${safe}"]`);
  }

  function setBodyLocked(locked) {
    document.body.classList.toggle("overlay-open", !!locked);
  }

  function focusFirst(overlayEl) {
    const first = qs(focusableSelector, overlayEl);
    if (first) first.focus({ preventScroll: true });
  }

  function installFocusTrap(overlayEl) {
    const handler = (e) => {
      if (e.key !== "Tab") return;
      const focusables = qsa(focusableSelector, overlayEl).filter((node) => {
        if (!(node instanceof HTMLElement)) return false;
        if (node.hasAttribute("disabled")) return false;
        if (node.getAttribute("aria-hidden") === "true") return false;
        return node.offsetParent !== null || node === document.activeElement;
      });

      if (!focusables.length) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    state.trapHandler = handler;
    overlayEl.addEventListener("keydown", handler);
  }

  function uninstallFocusTrap(overlayEl) {
    if (!state.trapHandler) return;
    overlayEl.removeEventListener("keydown", state.trapHandler);
    state.trapHandler = null;
  }

  function open(name) {
    ensureOverlays();

    const overlayEl = getOverlayEl(name);
    if (!overlayEl) return;

    if (state.openName && state.openName !== name) close(state.openName);

    state.openName = name;
    state.lastFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    overlayEl.hidden = false;
    overlayEl.setAttribute("aria-hidden", "false");
    setBodyLocked(true);
    installFocusTrap(overlayEl);
    setTimeout(() => focusFirst(overlayEl), 0);

    try {
      const ev = new CustomEvent("echtlucky:overlay-open", { detail: { name } });
      window.dispatchEvent(ev);
      document.dispatchEvent(ev);
    } catch {}
  }

  function close(name) {
    const overlayEl = getOverlayEl(name);
    if (!overlayEl) return;

    uninstallFocusTrap(overlayEl);
    overlayEl.setAttribute("aria-hidden", "true");
    overlayEl.hidden = true;

    if (state.openName === name) state.openName = null;
    setBodyLocked(false);

    if (state.lastFocus) {
      state.lastFocus.focus({ preventScroll: true });
      state.lastFocus = null;
    }

    try {
      const ev = new CustomEvent("echtlucky:overlay-close", { detail: { name } });
      window.dispatchEvent(ev);
      document.dispatchEvent(ev);
    } catch {}
  }

  function toggle(name) {
    const overlayEl = getOverlayEl(name);
    if (!overlayEl) return;
    const isOpen = !overlayEl.hidden && overlayEl.getAttribute("aria-hidden") !== "true";
    if (isOpen) close(name);
    else open(name);
  }

  function bindTriggers() {
    document.addEventListener("click", (e) => {
      const target = e.target instanceof Element ? e.target : null;
      if (!target) return;

      const trigger = target.closest("[data-overlay]");
      if (trigger) {
        e.preventDefault();
        const name = trigger.getAttribute("data-overlay");
        if (name) open(name);
        return;
      }

      const closer = target.closest("[data-overlay-close]");
      if (closer) {
        e.preventDefault();
        const overlay = closer.closest("[data-overlay-name]");
        const name = overlay?.getAttribute("data-overlay-name");
        if (name) close(name);
      }
    });

    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      if (!state.openName) return;
      close(state.openName);
    });
  }

  function maybeAutoOpenFromSession() {
    try {
      const pending = sessionStorage.getItem(OVERLAY_OPEN_KEY);
      if (!pending) return;
      sessionStorage.removeItem(OVERLAY_OPEN_KEY);
      setTimeout(() => open(pending), 50);
    } catch {}
  }

  ensureOverlays();
  bindTriggers();
  maybeAutoOpenFromSession();

  window.echtluckyOverlays = {
    open,
    close,
    toggle,
    ensure: ensureOverlays,
    isOpen: (name) => {
      const el = getOverlayEl(name);
      return !!el && !el.hidden && el.getAttribute("aria-hidden") !== "true";
    },
  };
})();
