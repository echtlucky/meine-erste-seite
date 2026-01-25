// ======================================================
// echtlucky Connect — V2 (saubere Modernisierung)
// Groups • Live Chat • Members • Presence • Activity
// Firestore COMPAT • Firebase Namespace-safe
// ======================================================

(() => {
  "use strict";

  /* ======================================================
     🔌 Firebase / Globals
  ====================================================== */
  const auth = window.echtlucky?.auth || window.auth || null;
  const db   = window.echtlucky?.db   || window.db   || null;

  if (!db) {
    console.error("❌ connect.js: Firestore db fehlt.");
    return;
  }

  const notify = (type, msg) => {
    const n = window.notify;
    if (n?.show) return n.show(type, msg);
    if (type === "success" && n?.success) return n.success(msg);
    if (type === "error" && n?.error) return n.error(msg);
    if (type === "warn" && (n?.warn || n?.warning)) return (n.warn || n.warning)(msg);
    if (n?.info) return n.info(msg);
    console.log(`[${type}]`, msg);
  };

  const serverTS = () => firebase.firestore.FieldValue.serverTimestamp();

  /* ======================================================
     🧠 State
  ====================================================== */
  const state = {
    user: null,
    readOnly: false,
    selectedGroup: null,
    isMember: false,

    listeners: {
      groups: null,
      messages: null,
      members: null,
      presenceHeart: null,
      presenceSubs: [],
    }
  };

  /* ======================================================
     📦 DOM Cache
  ====================================================== */
  const $ = (id) => document.getElementById(id);

  const dom = {
    loginGate: $("loginGate"),

    groupList: $("groupList"),
    btnRefreshGroups: $("btnRefreshGroups"),
    btnCreateGroup: $("btnCreateGroup"),
    btnSetActivity: $("btnSetActivity"),

    chatTitle: $("chatTitle"),
    chatHint: $("chatHint"),
    chatScroll: $("chatScroll"),
    chatForm: $("chatForm"),
    chatInput: $("chatInput"),

    btnJoinLeave: $("btnJoinLeave"),

    memberList: $("memberList"),
    membersHint: $("membersHint"),

    meName: $("meName"),
    meDot: $("meDot"),
    btnLogout: $("btnLogout"),

    groupSearch: $("groupSearch"),
    typingIndicator: $("typingIndicator"),
  };

  /* ======================================================
     🛠 Utils
  ====================================================== */
  function escapeHtml(str) {
    return String(str ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function fmtTime(ts) {
    try {
      const d = ts?.toDate ? ts.toDate() : new Date(ts);
      return d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "";
    }
  }

  function setPageLock(locked) {
    document.body.classList.toggle("is-locked", !!locked);
    if (dom.loginGate) dom.loginGate.style.display = locked ? "flex" : "none";
  }

  function setMeDot(stateName) {
    if (!dom.meDot) return;
    const map = {
      online: "rgba(0,255,136,.95)",
      idle: "rgba(255,204,0,.95)",
      dnd: "rgba(255,51,102,.95)",
      offline: "rgba(255,255,255,.18)",
    };
    dom.meDot.style.background = map[stateName] || map.offline;
  }

  function clearPresenceSubs() {
    state.listeners.presenceSubs.forEach(u => { try { u(); } catch {} });
    state.listeners.presenceSubs = [];
  }

  /* ======================================================
     🟢 Presence
  ====================================================== */
  async function writePresence(patch = {}) {
    if (!state.user) return;
    try {
      await db.collection("presence").doc(state.user.uid).set({
        uid: state.user.uid,
        displayName:
          state.user.displayName ||
          (state.user.email ? state.user.email.split("@")[0] : "User"),
        lastSeenAt: serverTS(),
        ...patch,
      }, { merge: true });
    } catch (e) {
      console.warn("Presence write failed:", e);
    }
  }

  function startPresence() {
    if (!state.user) return;

    writePresence({ state: "online" });
    setMeDot("online");

    stopPresence();
    state.listeners.presenceHeart = setInterval(() => {
      writePresence({ state: document.hidden ? "idle" : "online" });
    }, 25000);

    document.addEventListener("visibilitychange", () => {
      const st = document.hidden ? "idle" : "online";
      writePresence({ state: st });
      setMeDot(st);
    });

    window.addEventListener("beforeunload", () => {
      writePresence({ state: "offline" });
    });
  }

  function stopPresence() {
    if (state.listeners.presenceHeart) {
      clearInterval(state.listeners.presenceHeart);
      state.listeners.presenceHeart = null;
    }
    setMeDot("offline");
  }

  /* ======================================================
     👥 Groups
  ====================================================== */
  function renderGroupCard(id, data) {
    const el = document.createElement("div");
    el.className = "group-card" + (state.selectedGroup?.id === id ? " is-active" : "");
    el.innerHTML = `
      <div class="group-name">${escapeHtml(data.name || "Group")}</div>
      <div class="group-meta">
        ${data.isPublic ? "Public" : "Private"} • ${escapeHtml(data.topic || "Chat")}
      </div>
    `;
    el.onclick = () => selectGroup(id, data);
    return el;
  }

  function listenGroups() {
    state.listeners.groups?.();

    state.listeners.groups = db
      .collection("groups")
      .where("isPublic", "==", true)
      .limit(50)
      .onSnapshot(snap => {
        dom.groupList.innerHTML = "";

        if (snap.empty) {
          dom.groupList.innerHTML =
            `<div class="group-meta" style="padding:.8rem;">Noch keine Groups.</div>`;
          return;
        }

        const docs = [];
        snap.forEach(d => docs.push({ id: d.id, data: d.data() }));
        docs.sort((a, b) =>
          (b.data.lastMessageAt?.toMillis?.() || 0) -
          (a.data.lastMessageAt?.toMillis?.() || 0)
        );

        docs.forEach(d => dom.groupList.appendChild(renderGroupCard(d.id, d.data)));
      }, () => notify("error", "Groups konnten nicht geladen werden."));
  }

  async function createGroupFlow() {
    if (!state.user) return notify("warn", "Bitte anmelden.");
    const name = prompt("Group Name:");
    if (!name) return;

    const clean = name.trim().slice(0, 40);
    if (clean.length < 3) return notify("warn", "Name zu kurz.");

    const ref = await db.collection("groups").add({
      name: clean,
      topic: "Chat",
      isPublic: true,
      createdAt: serverTS(),
      createdBy: state.user.uid,
      lastMessageAt: serverTS(),
    });

    await db.collection("groups").doc(ref.id)
      .collection("members").doc(state.user.uid).set({
        uid: state.user.uid,
        role: "owner",
        displayName: state.user.displayName || "User",
        joinedAt: serverTS(),
      });

    notify("success", "Group erstellt ✅");
    const snap = await db.collection("groups").doc(ref.id).get();
    selectGroup(ref.id, snap.data());
  }

  /* ======================================================
     🔑 Membership
  ====================================================== */
  async function checkMembership(groupId) {
    if (!state.user) return false;
    const snap = await db.collection("groups").doc(groupId)
      .collection("members").doc(state.user.uid).get();
    return snap.exists;
  }

  async function updateJoinUI(groupId) {
    state.isMember = await checkMembership(groupId);

    if (!state.user || state.readOnly) {
      dom.btnJoinLeave.disabled = true;
      dom.chatInput.disabled = true;
      return;
    }

    dom.btnJoinLeave.disabled = false;
    dom.btnJoinLeave.textContent = state.isMember ? "Leave" : "Join";
    dom.chatInput.disabled = !state.isMember;
  }

  /* ======================================================
     💬 Chat
  ====================================================== */
  function clearChat() {
    dom.chatScroll.innerHTML = "";
    dom.memberList.innerHTML = "";
    dom.membersHint.textContent = "—";
  }

  async function selectGroup(id, data) {
    state.selectedGroup = { id, ...data };
    dom.chatTitle.textContent = data.name || "Group";
    dom.chatHint.textContent = "Lade…";

    clearChat();
    clearPresenceSubs();

    await updateJoinUI(id);

    state.listeners.messages?.();
    state.listeners.members?.();

    if (state.user && state.isMember) {
      listenMessages(id);
      listenMembers(id);
    } else {
      dom.chatScroll.innerHTML =
        `<div class="group-meta" style="padding:.6rem;">Join die Group, um Messages zu sehen.</div>`;
    }

    listenGroups();
  }

  function listenMessages(groupId) {
    state.listeners.messages?.();

    state.listeners.messages = db
      .collection("groups").doc(groupId)
      .collection("messages")
      .orderBy("createdAt", "asc")
      .limitToLast(80)
      .onSnapshot(snap => {
        dom.chatScroll.innerHTML = "";
        snap.forEach(doc => {
          const m = doc.data();
          const mine = m.uid === state.user?.uid;

          const el = document.createElement("div");
          el.className = "msg" + (mine ? " me" : "");
          el.innerHTML = `
            <div class="msg-top">
              <div class="msg-name">${escapeHtml(m.displayName)}</div>
              <div class="msg-time">${fmtTime(m.createdAt)}</div>
            </div>
            <div class="msg-text">${escapeHtml(m.text)}</div>
          `;
          dom.chatScroll.appendChild(el);
        });
        dom.chatScroll.scrollTop = dom.chatScroll.scrollHeight;
      });
  }

  async function sendMessage(e) {
    e.preventDefault();
    if (!state.user || !state.isMember) return;

    const text = dom.chatInput.value.trim();
    if (!text) return;
    dom.chatInput.value = "";

    await db.collection("groups").doc(state.selectedGroup.id)
      .collection("messages").add({
        uid: state.user.uid,
        displayName: state.user.displayName || "User",
        text: text.slice(0, 900),
        createdAt: serverTS(),
      });

    await db.collection("groups").doc(state.selectedGroup.id)
      .set({ lastMessageAt: serverTS() }, { merge: true });
  }

  /* ======================================================
     👤 Members
  ====================================================== */
  function listenMembers(groupId) {
    state.listeners.members?.();

    state.listeners.members = db
      .collection("groups").doc(groupId)
      .collection("members")
      .orderBy("joinedAt", "asc")
      .onSnapshot(snap => {
        dom.memberList.innerHTML = "";
        dom.membersHint.textContent = `${snap.size} Member`;
        clearPresenceSubs();

        snap.forEach(doc => {
          const m = doc.data();
          const row = document.createElement("div");
          row.className = "member";
          row.innerHTML = `
            <div class="member-left">
              <span class="dot" id="dot_${m.uid}"></span>
              <div>
                <div class="member-name">${escapeHtml(m.displayName)}</div>
                <div class="member-activity" id="act_${m.uid}">—</div>
              </div>
            </div>
            <div class="group-meta">${escapeHtml(m.role)}</div>
          `;
          dom.memberList.appendChild(row);

          const unsub = db.collection("presence").doc(m.uid)
            .onSnapshot(ps => {
              const p = ps.data() || {};
              const dot = $(`dot_${m.uid}`);
              const act = $(`act_${m.uid}`);

              if (dot) setMeDot.call({ meDot: dot }, p.state);
              if (act) act.textContent = p.activity || "—";
            });

          state.listeners.presenceSubs.push(unsub);
        });
      });
  }

  /* ======================================================
     🔘 UI Wiring
  ====================================================== */
  dom.btnRefreshGroups?.addEventListener("click", listenGroups);
  dom.btnCreateGroup?.addEventListener("click", createGroupFlow);
  dom.btnSetActivity?.addEventListener("click", async () => {
    const txt = prompt("Activity:");
    if (txt != null) await writePresence({ activity: txt.slice(0, 48) });
  });

  dom.btnJoinLeave?.addEventListener("click", async () => {
    if (!state.user) return;
    const ref = db.collection("groups").doc(state.selectedGroup.id)
      .collection("members").doc(state.user.uid);

    if (state.isMember) await ref.delete();
    else await ref.set({
      uid: state.user.uid,
      role: "member",
      displayName: state.user.displayName || "User",
      joinedAt: serverTS(),
    });

    await updateJoinUI(state.selectedGroup.id);
  });

  dom.chatForm?.addEventListener("submit", sendMessage);

  dom.btnLogout?.addEventListener("click", async () => {
    await writePresence({ state: "offline" });
    await auth.signOut();
    notify("success", "Ausgeloggt ✅");
  });

  dom.groupSearch?.addEventListener("input", e => {
    const q = e.target.value.toLowerCase();
    document.querySelectorAll(".group-card").forEach(c => {
      c.style.display = c.textContent.toLowerCase().includes(q) ? "" : "none";
    });
  });

  /* ======================================================
     🔐 Auth Binding
  ====================================================== */
  auth?.onAuthStateChanged(async user => {
    state.user = user || null;
    dom.meName.textContent = user
      ? (user.displayName || user.email.split("@")[0])
      : "Gast";

    if (!user) {
      stopPresence();
      setPageLock(true);
      return;
    }

    setPageLock(false);
    startPresence();
  });

  /* ======================================================
     🚀 Init
  ====================================================== */
  listenGroups();
  setPageLock(true);

  console.log("🚀 echtlucky Connect V2 geladen");
})();