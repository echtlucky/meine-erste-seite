// js/connect.js — echtlucky Connect (MVP v1)
// Groups + Live Chat + Members + Presence + Activity (Firestore)
// NOTE: Presence in Firestore ist "best effort" (Browser kann offline nicht perfekt).

(() => {
  "use strict";

  const auth = window.echtlucky?.auth || window.auth || null;
  const db   = window.echtlucky?.db   || window.db   || null;

  const notify = (type, msg) => {
    if (typeof window.notify === "function") return window.notify(type, msg);
    // fallback:
    if (type === "error") return alert(msg);
    console.log(type + ":", msg);
  };

  if (!db) {
    console.error("connect.js: Firestore db fehlt. Prüfe firebase.js (window.db).");
    return;
  }

  // DOM
  const loginGate = document.getElementById("loginGate");
  const btnContinueReadOnly = document.getElementById("btnContinueReadOnly");

  const groupList = document.getElementById("groupList");
  const btnRefreshGroups = document.getElementById("btnRefreshGroups");
  const btnCreateGroup = document.getElementById("btnCreateGroup");
  const btnSetActivity = document.getElementById("btnSetActivity");

  const chatTitle = document.getElementById("chatTitle");
  const chatHint = document.getElementById("chatHint");
  const chatScroll = document.getElementById("chatScroll");
  const chatForm = document.getElementById("chatForm");
  const chatInput = document.getElementById("chatInput");
  const btnSend = document.getElementById("btnSend");

  const btnJoinLeave = document.getElementById("btnJoinLeave");

  const memberList = document.getElementById("memberList");
  const membersHint = document.getElementById("membersHint");

  const meName = document.getElementById("meName");
  const meDot = document.getElementById("meDot");
  const btnLogout = document.getElementById("btnLogout");

  // State
  let currentUser = null;
  let readOnly = false;

  let groupsUnsub = null;
  let messagesUnsub = null;
  let membersUnsub = null;
  let presenceHeart = null;

  let presenceUnsubs = []; // per member presence onSnapshot
  let selectedGroup = null; // {id, ...data}
  let isMemberOfSelected = false;

  // Helpers
  const serverTS = () => firebase.firestore.FieldValue.serverTimestamp();

  function escapeHtml(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function fmtTime(ts) {
    try {
      const d = ts?.toDate ? ts.toDate() : (ts instanceof Date ? ts : null);
      if (!d) return "";
      return d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "";
    }
  }

  function setMeDot(state) {
    if (!meDot) return;
    if (state === "online") meDot.style.background = "rgba(0,255,136,.95)";
    else if (state === "idle") meDot.style.background = "rgba(255,204,0,.95)";
    else if (state === "dnd") meDot.style.background = "rgba(255,51,102,.95)";
    else meDot.style.background = "rgba(255,255,255,.18)";
  }

  function setChatEnabled(enabled) {
    chatInput.disabled = !enabled;
    btnSend.disabled = !enabled;
    btnJoinLeave.disabled = !selectedGroup; // join/leave needs group selected
  }

  function clearPresenceSubs() {
    presenceUnsubs.forEach((u) => { try { u(); } catch(_){} });
    presenceUnsubs = [];
  }

  // ===== Presence (Firestore best-effort)
  async function writePresence(patch) {
    if (!currentUser) return;
    try {
      await db.collection("presence").doc(currentUser.uid).set({
        uid: currentUser.uid,
        displayName: currentUser.displayName || (currentUser.email ? currentUser.email.split("@")[0] : "User"),
        lastSeenAt: serverTS(),
        ...patch
      }, { merge: true });
    } catch (e) {
      // Presence darf leise failen
      console.warn("presence write failed:", e?.message || e);
    }
  }

  function startPresence() {
    if (!currentUser) return;

    // initial online
    writePresence({ state: "online" });
    setMeDot("online");

    // heartbeat (keeps it fresh)
    if (presenceHeart) clearInterval(presenceHeart);
    presenceHeart = setInterval(() => writePresence({ state: document.hidden ? "idle" : "online" }), 25000);

    // tab visibility => idle/online
    document.addEventListener("visibilitychange", () => {
      if (!currentUser) return;
      const st = document.hidden ? "idle" : "online";
      writePresence({ state: st });
      setMeDot(st);
    });

    // best-effort offline
    window.addEventListener("beforeunload", () => {
      try {
        navigator.sendBeacon?.(
          "/",
          "" // noop, we still try a normal write below
        );
      } catch (_) {}
      writePresence({ state: "offline" });
    });
  }

  function stopPresence() {
    if (presenceHeart) clearInterval(presenceHeart);
    presenceHeart = null;
    setMeDot("offline");
  }

  // ===== Groups
  function renderGroupCard(id, data) {
    const el = document.createElement("div");
    el.className = "group-card" + (selectedGroup?.id === id ? " is-active" : "");
    el.innerHTML = `
      <div class="group-name">${escapeHtml(data?.name || "Group")}</div>
      <div class="group-meta">${data?.isPublic ? "Public" : "Private"} • ${escapeHtml(data?.topic || "Chat")}</div>
    `;
    el.addEventListener("click", () => selectGroup(id, data));
    return el;
  }

  function listenGroups() {
    if (groupsUnsub) groupsUnsub();

    const q = db
      .collection("groups")
      .where("isPublic", "==", true)
      .orderBy("lastMessageAt", "desc")
      .limit(50);

    groupsUnsub = q.onSnapshot((snap) => {
      groupList.innerHTML = "";
      if (snap.empty) {
        const empty = document.createElement("div");
        empty.className = "group-meta";
        empty.style.padding = ".8rem";
        empty.textContent = "Noch keine Groups. Erstelle die erste 😤";
        groupList.appendChild(empty);
        return;
      }

      snap.forEach((doc) => {
        groupList.appendChild(renderGroupCard(doc.id, doc.data() || {}));
      });
    }, (err) => {
      console.error(err);
      notify("error", "Groups konnten nicht geladen werden.");
    });
  }

  async function createGroupFlow() {
    if (!currentUser) return notify("warn", "Bitte anmelden, um eine Group zu erstellen.");
    const name = prompt("Group Name (z.B. EU Ranked Grind):");
    if (!name) return;

    const clean = name.trim().slice(0, 40);
    if (clean.length < 3) return notify("warn", "Name zu kurz.");

    try {
      const ref = await db.collection("groups").add({
        name: clean,
        topic: "Chat",
        isPublic: true,
        createdAt: serverTS(),
        createdBy: currentUser.uid,
        lastMessageAt: serverTS()
      });

      // auto-join as owner
      await db.collection("groups").doc(ref.id).collection("members").doc(currentUser.uid).set({
        uid: currentUser.uid,
        role: "owner",
        displayName: currentUser.displayName || (currentUser.email ? currentUser.email.split("@")[0] : "User"),
        joinedAt: serverTS()
      });

      notify("success", "Group erstellt ✅");
      // select it
      const snap = await db.collection("groups").doc(ref.id).get();
      selectGroup(ref.id, snap.data() || {});
    } catch (e) {
      console.error(e);
      notify("error", e?.message || "Group erstellen fehlgeschlagen.");
    }
  }

  // ===== Select Group + Chat + Members
  async function checkMembership(groupId) {
    if (!currentUser) return false;
    try {
      const m = await db.collection("groups").doc(groupId).collection("members").doc(currentUser.uid).get();
      return m.exists;
    } catch {
      return false;
    }
  }

  async function updateJoinLeaveUI(groupId) {
    isMemberOfSelected = await checkMembership(groupId);

    if (!currentUser || readOnly) {
      btnJoinLeave.textContent = "Join";
      btnJoinLeave.disabled = true;
      return;
    }

    btnJoinLeave.disabled = false;
    btnJoinLeave.textContent = isMemberOfSelected ? "Leave" : "Join";
    setChatEnabled(isMemberOfSelected);
    chatHint.textContent = isMemberOfSelected
      ? "Du bist drin. Schreib was Cleanes."
      : "Join die Group, um zu chatten.";
  }

  function clearChatUI() {
    chatScroll.innerHTML = "";
    memberList.innerHTML = "";
    membersHint.textContent = "—";
    setChatEnabled(false);
  }

  async function selectGroup(id, data) {
    selectedGroup = { id, ...(data || {}) };

    // highlight selection
    document.querySelectorAll(".group-card").forEach((c) => c.classList.remove("is-active"));
    // we re-render often; so just set by matching click’s element is enough via re-render;
    // quick hack: re-listen triggers. We’ll just update chat title now:
    chatTitle.textContent = selectedGroup.name || "Group";
    chatHint.textContent = "Checke Membership…";

    clearChatUI();
    clearPresenceSubs();

    await updateJoinLeaveUI(id);

    // listen messages ONLY if member (keeps rules clean)
    if (messagesUnsub) messagesUnsub();
    if (membersUnsub) membersUnsub();

    if (currentUser && isMemberOfSelected) {
      listenMessages(id);
      listenMembers(id);
    } else {
      chatScroll.innerHTML = `<div class="group-meta" style="padding:.4rem;">Join die Group, um Messages zu sehen.</div>`;
    }

    // refresh left highlight by reloading groups UI quickly
    listenGroups();
  }

  function listenMessages(groupId) {
    if (messagesUnsub) messagesUnsub();

    const q = db
      .collection("groups").doc(groupId)
      .collection("messages")
      .orderBy("createdAt", "asc")
      .limitToLast(80);

    messagesUnsub = q.onSnapshot((snap) => {
      chatScroll.innerHTML = "";
      snap.forEach((doc) => {
        const m = doc.data() || {};
        const mine = currentUser && m.uid === currentUser.uid;

        const el = document.createElement("div");
        el.className = "msg" + (mine ? " me" : "");
        el.innerHTML = `
          <div class="msg-top">
            <div class="msg-name">${escapeHtml(m.displayName || "User")}</div>
            <div class="msg-time">${escapeHtml(fmtTime(m.createdAt))}</div>
          </div>
          <div class="msg-text">${escapeHtml(m.text || "")}</div>
        `;
        chatScroll.appendChild(el);
      });

      // auto-scroll
      chatScroll.scrollTop = chatScroll.scrollHeight;
    }, (err) => {
      console.error(err);
      notify("error", "Messages konnten nicht geladen werden.");
    });
  }

  function listenMembers(groupId) {
    if (membersUnsub) membersUnsub();
    membersUnsub = db
      .collection("groups").doc(groupId)
      .collection("members")
      .orderBy("joinedAt", "asc")
      .onSnapshot((snap) => {
        memberList.innerHTML = "";
        membersHint.textContent = `${snap.size} Member`;

        clearPresenceSubs();

        const members = [];
        snap.forEach((doc) => members.push(doc.data() || {}));

        members.forEach((m) => {
          const row = document.createElement("div");
          row.className = "member";
          row.innerHTML = `
            <div class="member-left">
              <span class="dot" id="dot_${m.uid}"></span>
              <div style="min-width:0;">
                <div class="member-name">${escapeHtml(m.displayName || "User")}</div>
                <div class="member-activity" id="act_${m.uid}">—</div>
              </div>
            </div>
            <div class="group-meta" style="opacity:.75;">${escapeHtml(m.role || "member")}</div>
          `;
          memberList.appendChild(row);

          // presence live
          const unsub = db.collection("presence").doc(m.uid).onSnapshot((ps) => {
            const p = ps.data() || {};
            const dot = document.getElementById(`dot_${m.uid}`);
            const act = document.getElementById(`act_${m.uid}`);

            const st = p.state || "offline";
            if (dot) {
              if (st === "online") dot.style.background = "rgba(0,255,136,.95)";
              else if (st === "idle") dot.style.background = "rgba(255,204,0,.95)";
              else if (st === "dnd") dot.style.background = "rgba(255,51,102,.95)";
              else dot.style.background = "rgba(255,255,255,.18)";
            }

            if (act) act.textContent = p.activity ? String(p.activity).slice(0, 38) : "—";
          });

          presenceUnsubs.push(unsub);
        });
      }, (err) => {
        console.error(err);
        notify("error", "Memberliste konnte nicht geladen werden.");
      });
  }

  async function joinSelected() {
    if (!currentUser || readOnly) return notify("warn", "Bitte anmelden.");
    if (!selectedGroup) return;

    try {
      await db.collection("groups").doc(selectedGroup.id)
        .collection("members").doc(currentUser.uid).set({
          uid: currentUser.uid,
          role: "member",
          displayName: currentUser.displayName || (currentUser.email ? currentUser.email.split("@")[0] : "User"),
          joinedAt: serverTS()
        }, { merge: true });

      notify("success", "Joined ✅");
      await updateJoinLeaveUI(selectedGroup.id);

      // start listeners
      listenMessages(selectedGroup.id);
      listenMembers(selectedGroup.id);
    } catch (e) {
      console.error(e);
      notify("error", e?.message || "Join fehlgeschlagen.");
    }
  }

  async function leaveSelected() {
    if (!currentUser || readOnly) return;
    if (!selectedGroup) return;

    // Owner can't leave (MVP rule)
    try {
      const mRef = db.collection("groups").doc(selectedGroup.id).collection("members").doc(currentUser.uid);
      const mSnap = await mRef.get();
      const role = mSnap.data()?.role || "member";
      if (role === "owner") {
        return notify("warn", "Owner kann die Group im MVP nicht verlassen. (Später: Ownership transfer)");
      }

      await mRef.delete();
      notify("success", "Left ✅");

      // stop listeners
      if (messagesUnsub) messagesUnsub();
      if (membersUnsub) membersUnsub();
      clearPresenceSubs();

      clearChatUI();
      await updateJoinLeaveUI(selectedGroup.id);
    } catch (e) {
      console.error(e);
      notify("error", e?.message || "Leave fehlgeschlagen.");
    }
  }

  async function sendMessage(e) {
    e.preventDefault();
    if (!currentUser || readOnly) return notify("warn", "Bitte anmelden.");
    if (!selectedGroup || !isMemberOfSelected) return;

    const text = String(chatInput.value || "").trim();
    if (!text) return;

    chatInput.value = "";

    try {
      const payload = {
        uid: currentUser.uid,
        displayName: currentUser.displayName || (currentUser.email ? currentUser.email.split("@")[0] : "User"),
        text: text.slice(0, 900),
        createdAt: serverTS()
      };

      const gRef = db.collection("groups").doc(selectedGroup.id);
      await gRef.collection("messages").add(payload);

      // bump group
      await gRef.set({ lastMessageAt: serverTS() }, { merge: true });

    } catch (e2) {
      console.error(e2);
      notify("error", e2?.message || "Senden fehlgeschlagen.");
    }
  }

  async function setActivityFlow() {
    if (!currentUser) return notify("warn", "Bitte anmelden.");
    const txt = prompt("Activity (z.B. In Reflex Lab / In Ranked / Playing: Valorant):", "");
    if (txt === null) return;

    const clean = String(txt).trim().slice(0, 48);
    await writePresence({ activity: clean });
    notify("success", "Activity updated ✅");
  }

  // ===== Auth binding
  function applyAuthUI() {
    const name = currentUser
      ? (currentUser.displayName || (currentUser.email ? currentUser.email.split("@")[0] : "User"))
      : "Guest";

    meName.textContent = name;

    if (currentUser) {
      btnLogout.style.display = "inline-flex";
      if (loginGate) loginGate.style.display = "none";
      setMeDot("online");
    } else {
      btnLogout.style.display = "none";
      setMeDot("offline");
    }
  }

  function showGateIfNeeded() {
    if (!currentUser && !readOnly) {
      if (loginGate) loginGate.style.display = "block";
    } else {
      if (loginGate) loginGate.style.display = "none";
    }
  }

  // ===== Wire UI
  btnRefreshGroups?.addEventListener("click", () => listenGroups());
  btnCreateGroup?.addEventListener("click", createGroupFlow);
  btnSetActivity?.addEventListener("click", setActivityFlow);

  btnContinueReadOnly?.addEventListener("click", () => {
    readOnly = true;
    showGateIfNeeded();
    notify("info", "Read-only aktiv. Für Chat brauchst du Login.");
  });

  btnJoinLeave?.addEventListener("click", async () => {
    if (!selectedGroup) return;
    if (!currentUser || readOnly) return notify("warn", "Bitte anmelden.");
    if (isMemberOfSelected) return leaveSelected();
    return joinSelected();
  });

  chatForm?.addEventListener("submit", sendMessage);

  btnLogout?.addEventListener("click", async () => {
    if (!auth) return;
    try {
      await writePresence({ state: "offline" });
      await auth.signOut();
      notify("success", "Ausgeloggt ✅");
    } catch (e) {
      notify("error", e?.message || "Logout fehlgeschlagen.");
    }
  });

  // ===== Init
  listenGroups();
  setChatEnabled(false);
  applyAuthUI();
  showGateIfNeeded();

  if (auth && typeof auth.onAuthStateChanged === "function") {
    auth.onAuthStateChanged(async (u) => {
      currentUser = u || null;
      readOnly = readOnly && !currentUser; // if user logs in, keep normal mode
      applyAuthUI();
      showGateIfNeeded();

      // stop listeners if user logs out
      if (!currentUser) {
        stopPresence();
        if (messagesUnsub) messagesUnsub();
        if (membersUnsub) membersUnsub();
        clearPresenceSubs();
        isMemberOfSelected = false;
        setChatEnabled(false);
        chatHint.textContent = "Bitte anmelden, um zu chatten.";
        return;
      }

      // start presence
      startPresence();

      // If a group is selected, refresh membership & listeners
      if (selectedGroup?.id) {
        await updateJoinLeaveUI(selectedGroup.id);
        if (isMemberOfSelected) {
          listenMessages(selectedGroup.id);
          listenMembers(selectedGroup.id);
        }
      }
    });
  } else {
    // no auth: gate
    currentUser = null;
    showGateIfNeeded();
  }
})();