(() => {
  "use strict";

  if (window.__ECHTLUCKY_TICKETS_LOADED__) return;
  window.__ECHTLUCKY_TICKETS_LOADED__ = true;

  const LS_LAST_TICKET = "echtlucky:tickets:last-create-at:v1";
  const OVERLAY_OPEN_EVENT = "echtlucky:overlay-open";

  const allowedCategories = ["bug", "account", "payments", "feedback", "other"];
  const allowedPriorities = ["low", "normal", "high", "urgent"];
  const allowedStatuses = ["open", "waiting_user", "waiting_staff", "closed"];

  const state = {
    authUser: null,
    role: "guest",
    isStaff: false,
    isAdmin: false,

    selectedMyTicketId: null,
    selectedQueueTicketId: null,

    unsubMyList: null,
    unsubQueueList: null,
    unsubMyThread: null,
    unsubStaffThread: null,
    unsubStaffInternal: null,

    inflight: {
      createTicket: false,
      sendMyReply: false,
      sendStaffReply: false,
      updateTicket: false,
      claim: false,
    },
  };

  function el(id) {
    return document.getElementById(id);
  }

  const ui = {
    supportOverlay: () => document.querySelector('[data-overlay-name="support"]'),

    banner: el("supportBanner"),
    subline: el("supportSubline"),

    tabs: () => Array.from(document.querySelectorAll("[data-support-tab]")),
    panes: () => Array.from(document.querySelectorAll("[data-support-pane]")),
    staffOnlyTabs: () => Array.from(document.querySelectorAll("[data-staff-only]")),

    form: el("supportTicketForm"),
    category: el("ticketCategory"),
    priority: el("ticketPriority"),
    title: el("ticketTitle"),
    body: el("ticketBody"),
    files: el("ticketFiles"),
    filesList: el("ticketFilesList"),
    contextMeta: el("ticketContextMeta"),
    btnSubmit: el("btnSubmitTicket"),

    myList: el("myTicketsList"),
    btnRefreshMy: el("btnRefreshMyTickets"),
    myHead: el("ticketThreadHead"),
    myBody: el("ticketThreadBody"),
    myReplyForm: el("ticketReplyForm"),
    myReplyInput: el("ticketReplyInput"),
    btnSendMyReply: el("btnSendTicketReply"),
    btnCloseMyTicket: el("btnCloseTicket"),

    queueList: el("queueTicketsList"),
    btnRefreshQueue: el("btnRefreshQueue"),
    queueStatus: el("queueStatus"),
    queuePriority: el("queuePriority"),
    staffHead: el("staffThreadHead"),
    staffBody: el("staffThreadBody"),
    staffControls: el("staffControls"),
    btnClaim: el("btnClaimTicket"),
    btnUnclaim: el("btnUnclaimTicket"),
    staffStatus: el("staffStatus"),
    staffPriority: el("staffPriority"),
    btnInternalNote: el("btnAddInternalNote"),
    btnBanUser: el("btnBanUser"),
    btnMergeTicket: el("btnMergeTicket"),
    staffReplyForm: el("staffReplyForm"),
    staffReplyInput: el("staffReplyInput"),
    btnSendStaffReply: el("btnSendStaffReply"),
  };

  function hasFirebase() {
    return !!(window.echtlucky?.db && window.echtlucky?.auth && window.firebase?.firestore);
  }

  function db() {
    return window.echtlucky.db;
  }

  function auth() {
    return window.echtlucky.auth;
  }

  function safeText(v) {
    return String(v ?? "");
  }

  function escHtml(s) {
    return safeText(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function clampText(s, max) {
    const v = safeText(s).trim();
    if (v.length <= max) return v;
    return v.slice(0, max - 1) + "…";
  }

  function formatTime(ts) {
    try {
      const date = ts?.toDate ? ts.toDate() : ts instanceof Date ? ts : null;
      if (!date) return "";
      return date.toLocaleString("de-DE", {
        year: "2-digit",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "";
    }
  }

  function toast(type, title, message, duration = 4000) {
    if (window.notify?.show) {
      window.notify.show({ type, title, message, duration });
      return;
    }
    console[type === "error" ? "error" : "log"](title, message);
  }

  function showBanner(message, type = "info") {
    if (!ui.banner) return;
    if (!message) {
      ui.banner.hidden = true;
      ui.banner.textContent = "";
      ui.banner.dataset.type = "";
      return;
    }
    ui.banner.hidden = false;
    ui.banner.textContent = message;
    ui.banner.dataset.type = type;
  }

  function isOffline() {
    return navigator && "onLine" in navigator ? !navigator.onLine : false;
  }

  function setDisabled(node, disabled) {
    if (!node) return;
    if (disabled) node.setAttribute("disabled", "disabled");
    else node.removeAttribute("disabled");
  }

  function cleanupUnsubs(keys) {
    keys.forEach((k) => {
      const fn = state[k];
      if (typeof fn === "function") fn();
      state[k] = null;
    });
  }

  function setActiveTab(name) {
    ui.tabs().forEach((btn) => {
      const is = btn.getAttribute("data-support-tab") === name;
      btn.classList.toggle("is-active", is);
      btn.setAttribute("aria-selected", is ? "true" : "false");
    });
    ui.panes().forEach((pane) => {
      const is = pane.getAttribute("data-support-pane") === name;
      pane.hidden = !is;
    });
  }

  function ensureContextMeta() {
    if (!ui.contextMeta) return;
    const path = location.pathname.split("/").filter(Boolean).slice(-1)[0] || "index.html";
    ui.contextMeta.textContent = `Kontext: ${document.title} (${path})`;
  }

  function renderFilesList(files) {
    if (!ui.filesList) return;
    ui.filesList.innerHTML = "";
    if (!files || !files.length) return;
    files.forEach((f) => {
      const pill = document.createElement("div");
      pill.className = "support-file";
      pill.textContent = `${clampText(f.name, 32)} • ${Math.max(1, Math.round(f.size / 1024))}KB`;
      ui.filesList.appendChild(pill);
    });
  }

  function getRateLimitOk() {
    try {
      const last = Number(localStorage.getItem(LS_LAST_TICKET) || "0");
      const delta = Date.now() - last;
      return delta >= 12000;
    } catch {
      return true;
    }
  }

  function markTicketCreatedNow() {
    try {
      localStorage.setItem(LS_LAST_TICKET, String(Date.now()));
    } catch {}
  }

  function applyStaffUiVisibility() {
    ui.staffOnlyTabs().forEach((btn) => {
      btn.hidden = !state.isStaff;
    });

    if (ui.subline) {
      ui.subline.textContent = state.isStaff
        ? "Queue & Claims sind für Staff sichtbar."
        : "Erstelle ein Ticket — Kontext wird automatisch gespeichert.";
    }
  }

  function validateTicketPayload() {
    const category = safeText(ui.category?.value).trim();
    const priority = safeText(ui.priority?.value).trim();
    const title = safeText(ui.title?.value).trim();
    const body = safeText(ui.body?.value).trim();

    if (!state.authUser) throw new Error("Bitte einloggen, um ein Ticket zu erstellen.");
    if (!allowedCategories.includes(category)) throw new Error("Ungültige Kategorie.");
    if (!allowedPriorities.includes(priority)) throw new Error("Ungültige Priorität.");
    if (title.length < 5) throw new Error("Titel ist zu kurz.");
    if (body.length < 10) throw new Error("Beschreibung ist zu kurz.");
    if (title.length > 80) throw new Error("Titel ist zu lang.");
    if (body.length > 2000) throw new Error("Beschreibung ist zu lang.");

    const files = ui.files?.files ? Array.from(ui.files.files).slice(0, 5) : [];
    const metaFiles = files.map((f) => ({
      name: clampText(f.name, 140),
      size: Number(f.size || 0),
      type: clampText(f.type || "application/octet-stream", 120),
    }));

    return { category, priority, title, body, files, metaFiles };
  }

  function statusLabel(s) {
    if (s === "open") return "Open";
    if (s === "waiting_user") return "Waiting User";
    if (s === "waiting_staff") return "Waiting Staff";
    if (s === "closed") return "Closed";
    return safeText(s);
  }

  function priorityLabel(p) {
    if (p === "urgent") return "Urgent";
    if (p === "high") return "High";
    if (p === "normal") return "Normal";
    if (p === "low") return "Low";
    return safeText(p);
  }

  function ticketBadges(data) {
    const status = statusLabel(data.status || "open");
    const prio = priorityLabel(data.priority || "normal");
    const cat = safeText(data.category || "other");
    return `
      <span class="badge">${escHtml(status)}</span>
      <span class="badge">${escHtml(prio)}</span>
      <span class="badge">${escHtml(cat)}</span>
    `;
  }

  function renderListEmpty(listEl, title, desc) {
    if (!listEl) return;
    listEl.innerHTML = `
      <div class="ticket-item" style="cursor:default;">
        <div class="ticket-item__title">${escHtml(title)}</div>
        <div class="ticket-item__meta">${escHtml(desc || "")}</div>
      </div>
    `;
  }

  function renderListSkeleton(listEl, count = 6) {
    if (!listEl) return;
    listEl.innerHTML = "";
    for (let i = 0; i < count; i += 1) {
      const item = document.createElement("div");
      item.className = "ticket-item";
      item.style.cursor = "default";
      item.innerHTML = `
        <div class="ticket-item__top">
          <div class="skeleton" style="width: 72%; height: 16px;"></div>
          <div class="skeleton" style="width: 64px; height: 16px;"></div>
        </div>
        <div class="ticket-item__meta">
          <div class="skeleton" style="width: 48%; height: 12px;"></div>
          <div class="skeleton" style="width: 36%; height: 12px;"></div>
        </div>
      `;
      listEl.appendChild(item);
    }
  }

  function renderTicketList(listEl, tickets, activeId, onSelect) {
    if (!listEl) return;
    listEl.innerHTML = "";

    tickets.forEach(({ id, data }) => {
      const div = document.createElement("div");
      div.className = "ticket-item" + (id === activeId ? " is-active" : "");
      div.dataset.ticketId = id;
      div.innerHTML = `
        <div class="ticket-item__top">
          <div class="ticket-item__title">${escHtml(clampText(data.title || `Ticket ${id}`, 52))}</div>
          <span class="badge">${escHtml(priorityLabel(data.priority || "normal"))}</span>
        </div>
        <div class="ticket-item__meta">
          ${ticketBadges(data)}
          <span>${escHtml(formatTime(data.updatedAt || data.createdAt) || "")}</span>
        </div>
      `;
      div.addEventListener("click", () => onSelect(id));
      listEl.appendChild(div);
    });
  }

  function renderThreadHeader(headEl, ticketId, data, mode) {
    if (!headEl) return;
    if (!ticketId || !data) {
      headEl.innerHTML = `<div style="color: var(--text-muted);">Ticket auswählen…</div>`;
      return;
    }

    const left = `
      <div>
        <div style="font-weight: 900; letter-spacing: -0.2px; color: rgba(224,255,224,0.95);">
          ${escHtml(clampText(data.title || `Ticket ${ticketId}`, 80))}
        </div>
        <div class="ticket-item__meta" style="margin-top: 0.35rem;">
          ${ticketBadges(data)}
          <span>#${escHtml(ticketId.slice(0, 8))}</span>
        </div>
      </div>
    `;

    const right =
      mode === "staff"
        ? `<div style="text-align:right; color: var(--text-muted); font-size: 0.85rem;">
            <div>${escHtml(data.createdByName || data.createdByEmail || data.createdBy || "")}</div>
            <div>${escHtml(data.contextPage || "")}</div>
          </div>`
        : `<div style="text-align:right; color: var(--text-muted); font-size: 0.85rem;">
            <div>${escHtml(formatTime(data.createdAt) || "")}</div>
          </div>`;

    headEl.innerHTML = `<div style="display:flex; align-items:flex-start; justify-content:space-between; gap:1rem;">${left}${right}</div>`;
  }

  function renderMessages(bodyEl, messages, currentUid) {
    if (!bodyEl) return;
    bodyEl.innerHTML = "";
    if (!messages.length) {
      bodyEl.innerHTML = `<div style="color: var(--text-muted);">Noch keine Nachrichten.</div>`;
      return;
    }

    messages.forEach((m) => {
      const mine = currentUid && m.authorUid === currentUid;
      const div = document.createElement("div");
      div.className = "msg" + (mine ? " is-me" : "");
      div.innerHTML = `
        <div>${escHtml(m.text || "")}</div>
        <div class="msg__meta">${escHtml(m.authorName || m.authorRole || "")}${m.createdAt ? ` • ${escHtml(formatTime(m.createdAt))}` : ""}</div>
      `;
      bodyEl.appendChild(div);
    });

    bodyEl.scrollTop = bodyEl.scrollHeight;
  }

  async function createTicket() {
    if (!hasFirebase()) return;
    if (state.inflight.createTicket) return;
    if (isOffline()) {
      toast("warn", "Offline", "Du bist offline. Ticket kann nicht gesendet werden.");
      return;
    }
    if (!getRateLimitOk()) {
      toast("warn", "Langsam", "Bitte warte kurz bevor du ein neues Ticket erstellst.");
      return;
    }

    state.inflight.createTicket = true;
    setDisabled(ui.btnSubmit, true);

    try {
      const payload = validateTicketPayload();
      const user = state.authUser;
      const ticketRef = db().collection("tickets").doc();
      const msgRef = ticketRef.collection("messages").doc();
      const ts = window.firebase.firestore.FieldValue.serverTimestamp();

      const path = location.pathname.split("/").filter(Boolean).slice(-1)[0] || "index.html";

      const ticketDoc = {
        createdBy: user.uid,
        createdByName: user.displayName || "",
        createdByEmail: user.email || "",
        createdAt: ts,
        updatedAt: ts,
        status: "open",
        category: payload.category,
        priority: payload.priority,
        title: payload.title,
        contextPage: path,
        contextTitle: document.title || "",
        contextUrl: location.href || "",
        assignedTo: null,
        assignedToName: null,
        claimedAt: null,
        lastMessagePreview: clampText(payload.body, 220),
        attachmentMeta: payload.metaFiles,
      };

      const msgDoc = {
        authorUid: user.uid,
        authorName: user.displayName || "",
        authorRole: "user",
        text: payload.body,
        createdAt: ts,
        attachments: payload.metaFiles,
      };

      const batch = db().batch();
      batch.set(ticketRef, ticketDoc);
      batch.set(msgRef, msgDoc);
      await batch.commit();
      markTicketCreatedNow();

      toast("success", "Ticket erstellt", "Dein Ticket ist eingegangen.");
      if (ui.title) ui.title.value = "";
      if (ui.body) ui.body.value = "";
      if (ui.files) ui.files.value = "";
      renderFilesList([]);

      setActiveTab("mine");
      state.selectedMyTicketId = ticketRef.id;
      startMyTickets();
      openMyTicket(ticketRef.id);
    } catch (err) {
      toast("error", "Ticket fehlgeschlagen", safeText(err?.message || err));
    } finally {
      state.inflight.createTicket = false;
      setDisabled(ui.btnSubmit, false);
    }
  }

  function startMyTickets() {
    cleanupUnsubs(["unsubMyList", "unsubMyThread"]);

    if (!ui.myList) return;
    if (!state.authUser) {
      renderListEmpty(ui.myList, "Nicht eingeloggt", "Bitte anmelden, um deine Tickets zu sehen.");
      renderThreadHeader(ui.myHead, null, null);
      if (ui.myBody) ui.myBody.innerHTML = "";
      return;
    }

    renderListSkeleton(ui.myList, 6);

    const q = db()
      .collection("tickets")
      .where("createdBy", "==", state.authUser.uid)
      .orderBy("updatedAt", "desc")
      .limit(50);

    state.unsubMyList = q.onSnapshot(
      (snap) => {
        const tickets = snap.docs.map((d) => ({ id: d.id, data: d.data() || {} }));
        if (!tickets.length) {
          renderListEmpty(ui.myList, "Keine Tickets", "Erstelle dein erstes Ticket im Tab „Neues Ticket“.");
          renderThreadHeader(ui.myHead, null, null);
          if (ui.myBody) ui.myBody.innerHTML = "";
          return;
        }

        if (!state.selectedMyTicketId) state.selectedMyTicketId = tickets[0].id;
        renderTicketList(ui.myList, tickets, state.selectedMyTicketId, (id) => {
          state.selectedMyTicketId = id;
          openMyTicket(id);
        });

        if (state.selectedMyTicketId) openMyTicket(state.selectedMyTicketId, { soft: true });
      },
      (err) => {
        renderListEmpty(ui.myList, "Fehler", safeText(err?.message || err));
      }
    );
  }

  function openMyTicket(ticketId, opts = {}) {
    if (!ticketId || !state.authUser) return;
    if (!hasFirebase()) return;

    if (!opts.soft) cleanupUnsubs(["unsubMyThread"]);

    const ticketRef = db().collection("tickets").doc(ticketId);
    const msgQ = ticketRef.collection("messages").orderBy("createdAt", "asc").limit(200);

    state.unsubMyThread = msgQ.onSnapshot(
      async (snap) => {
        try {
          const ticketSnap = await ticketRef.get();
          const ticketData = ticketSnap.exists ? ticketSnap.data() : null;

          renderThreadHeader(ui.myHead, ticketId, ticketData || {}, "user");
          const msgs = snap.docs.map((d) => d.data() || {});
          renderMessages(ui.myBody, msgs, state.authUser.uid);

          const status = ticketData?.status || "open";
          if (ui.btnCloseMyTicket) ui.btnCloseMyTicket.hidden = status === "closed";
        } catch (e) {
          renderListEmpty(ui.myBody, "Fehler", safeText(e?.message || e));
        }
      },
      (err) => {
        renderListEmpty(ui.myBody, "Fehler", safeText(err?.message || err));
      }
    );
  }

  async function sendMyReply() {
    if (!hasFirebase()) return;
    if (!state.authUser) {
      toast("warn", "Login", "Bitte einloggen.");
      return;
    }
    if (!state.selectedMyTicketId) return;
    if (state.inflight.sendMyReply) return;
    if (isOffline()) {
      toast("warn", "Offline", "Du bist offline. Nachricht kann nicht gesendet werden.");
      return;
    }

    const text = safeText(ui.myReplyInput?.value).trim();
    if (!text) return;
    if (text.length > 1200) {
      toast("warn", "Zu lang", "Bitte kürzer.");
      return;
    }

    state.inflight.sendMyReply = true;
    setDisabled(ui.btnSendMyReply, true);
    setDisabled(ui.myReplyInput, true);

    try {
      const ticketId = state.selectedMyTicketId;
      const ticketRef = db().collection("tickets").doc(ticketId);
      const msgRef = ticketRef.collection("messages").doc();
      const ts = window.firebase.firestore.FieldValue.serverTimestamp();

      await db().runTransaction(async (tx) => {
        const snap = await tx.get(ticketRef);
        if (!snap.exists) throw new Error("Ticket nicht gefunden.");
        const data = snap.data() || {};
        if (data.createdBy !== state.authUser.uid) throw new Error("Keine Berechtigung.");

        tx.set(msgRef, {
          authorUid: state.authUser.uid,
          authorName: state.authUser.displayName || "",
          authorRole: "user",
          text,
          createdAt: ts,
        });

        tx.update(ticketRef, {
          updatedAt: ts,
          lastMessagePreview: clampText(text, 220),
          status: data.status === "closed" ? "waiting_staff" : "waiting_staff",
        });
      });

      if (ui.myReplyInput) ui.myReplyInput.value = "";
    } catch (err) {
      toast("error", "Senden fehlgeschlagen", safeText(err?.message || err));
    } finally {
      state.inflight.sendMyReply = false;
      setDisabled(ui.btnSendMyReply, false);
      setDisabled(ui.myReplyInput, false);
      ui.myReplyInput?.focus?.();
    }
  }

  async function closeMyTicket() {
    if (!hasFirebase()) return;
    if (!state.authUser || !state.selectedMyTicketId) return;
    if (state.inflight.updateTicket) return;
    if (isOffline()) {
      toast("warn", "Offline", "Du bist offline.");
      return;
    }

    state.inflight.updateTicket = true;
    setDisabled(ui.btnCloseMyTicket, true);
    try {
      const ticketRef = db().collection("tickets").doc(state.selectedMyTicketId);
      const ts = window.firebase.firestore.FieldValue.serverTimestamp();
      await db().runTransaction(async (tx) => {
        const snap = await tx.get(ticketRef);
        if (!snap.exists) throw new Error("Ticket nicht gefunden.");
        const data = snap.data() || {};
        if (data.createdBy !== state.authUser.uid) throw new Error("Keine Berechtigung.");
        tx.update(ticketRef, { status: "closed", updatedAt: ts });
      });
      toast("success", "Ticket geschlossen", "Danke! Wenn nötig, kannst du jederzeit ein neues Ticket erstellen.");
    } catch (err) {
      toast("error", "Schließen fehlgeschlagen", safeText(err?.message || err));
    } finally {
      state.inflight.updateTicket = false;
      setDisabled(ui.btnCloseMyTicket, false);
    }
  }

  async function resolveRole(user) {
    if (!user) {
      state.role = "guest";
      state.isStaff = false;
      state.isAdmin = false;
      return;
    }

    let role = "user";
    try {
      role = (await window.echtlucky.getRole(user.uid)) || "user";
    } catch {
      role = "user";
    }

    const isAdminEmail = !!window.echtlucky?.isAdminByEmail?.(user);
    const isAdmin = role === "admin" || isAdminEmail;
    const isStaff = isAdmin || role === "support" || role === "moderator";

    state.role = role;
    state.isAdmin = isAdmin;
    state.isStaff = isStaff;
  }

  function startQueue() {
    cleanupUnsubs(["unsubQueueList", "unsubStaffThread", "unsubStaffInternal"]);

    if (!ui.queueList) return;
    if (!state.isStaff) {
      renderListEmpty(ui.queueList, "Kein Zugriff", "Du bist kein Support/Moderator/Admin.");
      renderThreadHeader(ui.staffHead, null, null);
      if (ui.staffBody) ui.staffBody.innerHTML = "";
      if (ui.staffControls) ui.staffControls.hidden = true;
      return;
    }

    renderListSkeleton(ui.queueList, 7);

    const status = safeText(ui.queueStatus?.value || "open");
    const prio = safeText(ui.queuePriority?.value || "all");

    let q = db().collection("tickets");
    if (status && status !== "all") q = q.where("status", "==", status);
    if (prio && prio !== "all") q = q.where("priority", "==", prio);
    q = q.orderBy("updatedAt", "desc").limit(60);

    state.unsubQueueList = q.onSnapshot(
      (snap) => {
        const tickets = snap.docs.map((d) => ({ id: d.id, data: d.data() || {} }));
        if (!tickets.length) {
          renderListEmpty(ui.queueList, "Keine Tickets", "Aktuell ist die Queue leer.");
          renderThreadHeader(ui.staffHead, null, null);
          if (ui.staffBody) ui.staffBody.innerHTML = "";
          if (ui.staffControls) ui.staffControls.hidden = true;
          return;
        }

        if (!state.selectedQueueTicketId) state.selectedQueueTicketId = tickets[0].id;
        renderTicketList(ui.queueList, tickets, state.selectedQueueTicketId, (id) => {
          state.selectedQueueTicketId = id;
          openStaffTicket(id);
        });

        if (state.selectedQueueTicketId) openStaffTicket(state.selectedQueueTicketId, { soft: true });
      },
      (err) => {
        renderListEmpty(ui.queueList, "Fehler / Index fehlt?", safeText(err?.message || err));
      }
    );
  }

  function openStaffTicket(ticketId, opts = {}) {
    if (!ticketId || !state.isStaff) return;
    if (!hasFirebase()) return;

    if (!opts.soft) cleanupUnsubs(["unsubStaffThread", "unsubStaffInternal"]);

    const ticketRef = db().collection("tickets").doc(ticketId);
    const msgQ = ticketRef.collection("messages").orderBy("createdAt", "asc").limit(300);

    if (ui.staffControls) ui.staffControls.hidden = false;

    state.unsubStaffThread = msgQ.onSnapshot(
      async (snap) => {
        try {
          const ticketSnap = await ticketRef.get();
          const ticketData = ticketSnap.exists ? ticketSnap.data() : null;
          renderThreadHeader(ui.staffHead, ticketId, ticketData || {}, "staff");

          const msgs = snap.docs.map((d) => d.data() || {});
          renderMessages(ui.staffBody, msgs, state.authUser?.uid || "");

          const status = ticketData?.status || "open";
          const priority = ticketData?.priority || "normal";
          const claimedBy = ticketData?.assignedTo || null;

          if (ui.staffStatus) ui.staffStatus.value = allowedStatuses.includes(status) ? status : "open";
          if (ui.staffPriority) ui.staffPriority.value = allowedPriorities.includes(priority) ? priority : "normal";

          if (ui.btnClaim) setDisabled(ui.btnClaim, !!claimedBy && claimedBy !== state.authUser?.uid);
          if (ui.btnUnclaim) setDisabled(ui.btnUnclaim, !claimedBy || claimedBy !== state.authUser?.uid);

          if (ui.btnBanUser) ui.btnBanUser.hidden = !state.isAdmin;
          if (ui.btnMergeTicket) ui.btnMergeTicket.hidden = !state.isAdmin;
        } catch (e) {
          renderListEmpty(ui.staffBody, "Fehler", safeText(e?.message || e));
        }
      },
      (err) => {
        renderListEmpty(ui.staffBody, "Fehler", safeText(err?.message || err));
      }
    );

    state.unsubStaffInternal = ticketRef
      .collection("internal")
      .orderBy("createdAt", "asc")
      .limit(120)
      .onSnapshot(
        (snap) => {
          if (!ui.staffBody) return;
          if (!snap.size) return;

          const wrap = document.createElement("div");
          wrap.style.marginTop = "1rem";
          wrap.style.paddingTop = "0.65rem";
          wrap.style.borderTop = "1px dashed rgba(0,255,136,0.18)";
          wrap.style.color = "rgba(224,255,224,0.80)";
          wrap.innerHTML = `<div style="font-weight:850; margin-bottom:0.35rem;">Interne Notizen</div>`;

          snap.docs.forEach((d) => {
            const data = d.data() || {};
            const div = document.createElement("div");
            div.className = "msg";
            div.style.maxWidth = "100%";
            div.style.borderStyle = "dashed";
            div.innerHTML = `
              <div>${escHtml(data.text || "")}</div>
              <div class="msg__meta">${escHtml(data.authorName || data.authorUid || "")}${data.createdAt ? ` • ${escHtml(formatTime(data.createdAt))}` : ""}</div>
            `;
            wrap.appendChild(div);
          });

          const existing = ui.staffBody.querySelector("[data-internal-notes]");
          if (existing) existing.remove();
          wrap.setAttribute("data-internal-notes", "1");
          ui.staffBody.appendChild(wrap);
        },
        () => {}
      );
  }

  async function sendStaffReply() {
    if (!hasFirebase()) return;
    if (!state.isStaff || !state.authUser) return;
    if (!state.selectedQueueTicketId) return;
    if (state.inflight.sendStaffReply) return;
    if (isOffline()) {
      toast("warn", "Offline", "Du bist offline. Nachricht kann nicht gesendet werden.");
      return;
    }

    const text = safeText(ui.staffReplyInput?.value).trim();
    if (!text) return;
    if (text.length > 1200) {
      toast("warn", "Zu lang", "Bitte kürzer.");
      return;
    }

    state.inflight.sendStaffReply = true;
    setDisabled(ui.btnSendStaffReply, true);
    setDisabled(ui.staffReplyInput, true);

    try {
      const ticketId = state.selectedQueueTicketId;
      const ticketRef = db().collection("tickets").doc(ticketId);
      const msgRef = ticketRef.collection("messages").doc();
      const ts = window.firebase.firestore.FieldValue.serverTimestamp();

      await db().runTransaction(async (tx) => {
        const snap = await tx.get(ticketRef);
        if (!snap.exists) throw new Error("Ticket nicht gefunden.");
        const data = snap.data() || {};

        tx.set(msgRef, {
          authorUid: state.authUser.uid,
          authorName: state.authUser.displayName || "",
          authorRole: state.isAdmin ? "admin" : state.role,
          text,
          createdAt: ts,
        });

        tx.update(ticketRef, {
          updatedAt: ts,
          lastMessagePreview: clampText(text, 220),
          status: data.status === "closed" ? "open" : "waiting_user",
        });
      });

      if (ui.staffReplyInput) ui.staffReplyInput.value = "";
    } catch (err) {
      toast("error", "Senden fehlgeschlagen", safeText(err?.message || err));
    } finally {
      state.inflight.sendStaffReply = false;
      setDisabled(ui.btnSendStaffReply, false);
      setDisabled(ui.staffReplyInput, false);
      ui.staffReplyInput?.focus?.();
    }
  }

  async function claimTicket(nextUid) {
    if (!hasFirebase()) return;
    if (!state.isStaff || !state.authUser || !state.selectedQueueTicketId) return;
    if (state.inflight.claim) return;
    if (isOffline()) {
      toast("warn", "Offline", "Du bist offline.");
      return;
    }

    state.inflight.claim = true;
    setDisabled(ui.btnClaim, true);
    setDisabled(ui.btnUnclaim, true);

    try {
      const ticketRef = db().collection("tickets").doc(state.selectedQueueTicketId);
      const ts = window.firebase.firestore.FieldValue.serverTimestamp();
      await db().runTransaction(async (tx) => {
        const snap = await tx.get(ticketRef);
        if (!snap.exists) throw new Error("Ticket nicht gefunden.");
        const data = snap.data() || {};

        const desired = nextUid || null;
        const current = data.assignedTo || null;

        if (desired && current && current !== desired) throw new Error("Ticket ist bereits geclaimed.");

        tx.update(ticketRef, {
          assignedTo: desired,
          assignedToName: desired ? state.authUser.displayName || "" : null,
          claimedAt: desired ? ts : null,
          updatedAt: ts,
        });
      });

      toast(
        "success",
        nextUid ? "Geclaimed" : "Freigegeben",
        nextUid ? "Ticket ist jetzt dir zugewiesen." : "Ticket ist wieder frei."
      );
    } catch (err) {
      toast("error", "Claim fehlgeschlagen", safeText(err?.message || err));
    } finally {
      state.inflight.claim = false;
      setDisabled(ui.btnClaim, false);
      setDisabled(ui.btnUnclaim, false);
    }
  }

  async function updateStaffField(field, value) {
    if (!hasFirebase()) return;
    if (!state.isStaff || !state.authUser || !state.selectedQueueTicketId) return;
    if (state.inflight.updateTicket) return;
    if (isOffline()) return;

    state.inflight.updateTicket = true;
    try {
      const ticketRef = db().collection("tickets").doc(state.selectedQueueTicketId);
      const ts = window.firebase.firestore.FieldValue.serverTimestamp();
      const patch = { updatedAt: ts };
      patch[field] = value;
      await ticketRef.update(patch);
    } catch (err) {
      toast("error", "Update fehlgeschlagen", safeText(err?.message || err));
    } finally {
      state.inflight.updateTicket = false;
    }
  }

  async function addInternalNote() {
    if (!hasFirebase()) return;
    if (!state.isStaff || !state.authUser || !state.selectedQueueTicketId) return;
    if (isOffline()) return;

    const input = window.echtluckyModal?.input;
    if (typeof input !== "function") {
      toast("warn", "Modal fehlt", "modal-dialog.js ist nicht geladen.");
      return;
    }

    const text = await input({
      title: "Interne Notiz",
      placeholder: "Nur Staff sichtbar…",
      confirmText: "Speichern",
      cancelText: "Abbrechen",
    });
    if (!text) return;
    if (text.length > 2000) {
      toast("warn", "Zu lang", "Bitte kürzer.");
      return;
    }

    try {
      const ticketRef = db().collection("tickets").doc(state.selectedQueueTicketId);
      const noteRef = ticketRef.collection("internal").doc();
      const ts = window.firebase.firestore.FieldValue.serverTimestamp();
      await noteRef.set({
        authorUid: state.authUser.uid,
        authorName: state.authUser.displayName || "",
        authorRole: state.isAdmin ? "admin" : state.role,
        text,
        createdAt: ts,
      });
      toast("success", "Notiz gespeichert", "");
    } catch (err) {
      toast("error", "Notiz fehlgeschlagen", safeText(err?.message || err));
    }
  }

  async function banUserFromTicket() {
    if (!hasFirebase()) return;
    if (!state.isAdmin || !state.authUser || !state.selectedQueueTicketId) return;
    if (isOffline()) return;

    const ticketRef = db().collection("tickets").doc(state.selectedQueueTicketId);
    const snap = await ticketRef.get();
    const data = snap.exists ? snap.data() || {} : {};
    const uid = data.createdBy;
    if (!uid) return;

    const input = window.echtluckyModal?.input;
    if (typeof input !== "function") return;

    const reason = await input({
      title: "User sperren",
      placeholder: "Grund (intern)…",
      confirmText: "Sperren",
      cancelText: "Abbrechen",
    });
    if (!reason) return;

    try {
      const ts = window.firebase.firestore.FieldValue.serverTimestamp();
      await db().collection("bans").add({
        uid,
        reason: clampText(reason, 400),
        createdAt: ts,
        createdBy: state.authUser.uid,
      });
      toast("success", "User gesperrt", "Ban wurde gespeichert.");
    } catch (err) {
      toast("error", "Ban fehlgeschlagen", safeText(err?.message || err));
    }
  }

  async function mergeTicket() {
    if (!hasFirebase()) return;
    if (!state.isAdmin || !state.authUser || !state.selectedQueueTicketId) return;
    if (isOffline()) return;

    const input = window.echtluckyModal?.input;
    if (typeof input !== "function") return;

    const target = await input({
      title: "Ticket zusammenführen",
      placeholder: "Ziel Ticket-ID…",
      confirmText: "Merge",
      cancelText: "Abbrechen",
    });
    if (!target) return;

    try {
      const srcId = state.selectedQueueTicketId;
      const srcRef = db().collection("tickets").doc(srcId);
      const dstRef = db().collection("tickets").doc(target.trim());
      const ts = window.firebase.firestore.FieldValue.serverTimestamp();

      await db().runTransaction(async (tx) => {
        const srcSnap = await tx.get(srcRef);
        const dstSnap = await tx.get(dstRef);
        if (!srcSnap.exists) throw new Error("Source Ticket nicht gefunden.");
        if (!dstSnap.exists) throw new Error("Target Ticket nicht gefunden.");

        tx.update(srcRef, { status: "closed", mergedInto: dstRef.id, updatedAt: ts });
        tx.update(dstRef, { updatedAt: ts });
        tx.set(srcRef.collection("messages").doc(), {
          authorUid: state.authUser.uid,
          authorName: state.authUser.displayName || "",
          authorRole: "admin",
          text: `Merged into #${dstRef.id}`,
          createdAt: ts,
        });
      });

      toast("success", "Merged", `Ticket wurde in ${target.trim()} zusammengeführt.`);
    } catch (err) {
      toast("error", "Merge fehlgeschlagen", safeText(err?.message || err));
    }
  }

  function onSupportOpen() {
    ensureContextMeta();
    showBanner(isOffline() ? "Offline: Senden/Updates sind deaktiviert." : "", isOffline() ? "warn" : "info");
    applyStaffUiVisibility();
    if (state.isStaff) startQueue();
    startMyTickets();
  }

  function bindUi() {
    ui.tabs().forEach((btn) => {
      btn.addEventListener("click", () => {
        const name = btn.getAttribute("data-support-tab");
        if (!name) return;
        if (name === "queue" && !state.isStaff) return;
        setActiveTab(name);
        if (name === "mine") startMyTickets();
        if (name === "queue") startQueue();
      });
    });

    ui.files?.addEventListener("change", () => {
      const files = ui.files?.files ? Array.from(ui.files.files).slice(0, 5) : [];
      renderFilesList(files);
    });

    ui.form?.addEventListener("submit", (e) => {
      e.preventDefault();
      createTicket();
    });

    ui.btnRefreshMy?.addEventListener("click", () => startMyTickets());
    ui.btnRefreshQueue?.addEventListener("click", () => startQueue());
    ui.queueStatus?.addEventListener("change", () => startQueue());
    ui.queuePriority?.addEventListener("change", () => startQueue());

    ui.myReplyForm?.addEventListener("submit", (e) => {
      e.preventDefault();
      sendMyReply();
    });
    ui.btnCloseMyTicket?.addEventListener("click", () => closeMyTicket());

    ui.staffReplyForm?.addEventListener("submit", (e) => {
      e.preventDefault();
      sendStaffReply();
    });

    ui.btnClaim?.addEventListener("click", () => claimTicket(state.authUser?.uid || null));
    ui.btnUnclaim?.addEventListener("click", () => claimTicket(null));

    ui.staffStatus?.addEventListener("change", () => {
      const v = safeText(ui.staffStatus.value);
      if (!allowedStatuses.includes(v)) return;
      updateStaffField("status", v);
    });

    ui.staffPriority?.addEventListener("change", () => {
      const v = safeText(ui.staffPriority.value);
      if (!allowedPriorities.includes(v)) return;
      updateStaffField("priority", v);
    });

    ui.btnInternalNote?.addEventListener("click", () => addInternalNote());
    ui.btnBanUser?.addEventListener("click", () => banUserFromTicket());
    ui.btnMergeTicket?.addEventListener("click", () => mergeTicket());

    window.addEventListener("online", () => showBanner("", "info"));
    window.addEventListener("offline", () => showBanner("Offline: Senden/Updates sind deaktiviert.", "warn"));
  }

  function bindOverlayOpenEvents() {
    window.addEventListener(OVERLAY_OPEN_EVENT, (e) => {
      const name = e?.detail?.name;
      if (name === "support") onSupportOpen();
    });

    const overlay = ui.supportOverlay();
    if (!overlay) return;
    const obs = new MutationObserver(() => {
      const isOpen = !overlay.hidden && overlay.getAttribute("aria-hidden") !== "true";
      if (isOpen) onSupportOpen();
    });
    obs.observe(overlay, { attributes: true, attributeFilter: ["hidden", "aria-hidden"] });
  }

  function init() {
    if (!ui.form) return;

    bindUi();
    bindOverlayOpenEvents();

    auth().onAuthStateChanged(async (user) => {
      state.authUser = user || null;
      await resolveRole(user);
      applyStaffUiVisibility();
    });
  }

  function waitForFirebase() {
    if (hasFirebase()) {
      init();
      return;
    }

    document.addEventListener(
      "firebaseReady",
      () => {
        if (!hasFirebase()) return;
        init();
      },
      { once: true }
    );
  }

  waitForFirebase();
})();
