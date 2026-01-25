// js/connect.js — echtlucky Connect (MVP v1)
// Groups + Live Chat + Members + Presence + Activity (Firestore)
// Presence in Firestore ist "best effort".

(() => {
  "use strict";

  const auth = window.echtlucky?.auth || window.auth || null;
  const db   = window.echtlucky?.db   || window.db   || null;

  const notify = (type, msg) => {
    if (typeof window.notify === "function") return window.notify(type, msg);
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

  let presenceUnsubs = [];
  let selectedGroup = null;
  let isMemberOfSelected = false;

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

  function setPageLock(locked) {
    document.body.classList.toggle("is-locked", !!locked);
    if (loginGate) loginGate.style.display = locked ? "flex" : "none";
  }

  function setMeDot(state) {
    if (!meDot) return;
    if (state === "online") meDot.style.background = "rgba(0,255,136,.95)";
    else if (state === "idle") meDot.style.background = "rgba(255,204,0,.95)";
    else if (state === "dnd") meDot.style.background = "rgba(255,51,102,.95)";
    else meDot.style.background = "rgba(255,255,255,.18)";
  }

  function setChatEnabled(enabled) {
    const ok = !!enabled;
    if (chatInput) chatInput.disabled = !ok;
    if (btnSend) btnSend.disabled = !ok;
    if (btnJoinLeave) btnJoinLeave.disabled = !selectedGroup || (!currentUser || readOnly) ? true : false;
  }

  function clearPresenceSubs() {
    presenceUnsubs.forEach((u) => { try { u(); } catch(_){} });
    presenceUnsubs = [];
  }

  // ===== Presence
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
      console.warn("presence write failed:", e?.message || e);
    }
  }

  function startPresence() {
    if (!currentUser) return;

    writePresence({ state: "online" });
    setMeDot("online");

    if (presenceHeart) clearInterval(presenceHeart);
    presenceHeart = setInterval(() => {
      writePresence({ state: document.hidden ? "idle" : "online" });
    }, 25000);

    document.addEventListener("visibilitychange", () => {
      if (!currentUser) return;
      const st = document.hidden ? "idle" : "online";
      writePresence({ state: st });
      setMeDot(st);
    });

    window.addEventListener("beforeunload", () => {
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
      if (!groupList) return;
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

      await db.collection("groups").doc(ref.id).collection("members").doc(currentUser.uid).set({
        uid: currentUser.uid,
        role: "owner",
        displayName: currentUser.displayName || (currentUser.email ? currentUser.email.split("@")[0] : "User"),
        joinedAt: serverTS()
      });

      notify("success", "Group erstellt ✅");

      const snap = await db.collection("groups").doc(ref.id).get();
      selectGroup(ref.id, snap.data() || {});
    } catch (e) {
      console.error(e);
      notify("error", e?.message || "Group erstellen fehlgeschlagen.");
    }
  }

  // ===== Group membership
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
      if (btnJoinLeave) {
        btnJoinLeave.textContent = "Join";
        btnJoinLeave.disabled = true;
      }
      setChatEnabled(false);
      return;
    }

    if (btnJoinLeave) {
      btnJoinLeave.disabled = false;
      btnJoinLeave.textContent = isMemberOfSelected ? "Leave" : "Join";
    }

    setChatEnabled(isMemberOfSelected);

    if (chatHint) {
      chatHint.textContent = isMemberOfSelected
        ? "Du bist drin. Schreib was Cleanes."
        : "Join die Group, um zu chatten.";
    }
  }

  function clearChatUI() {
    if (chatScroll) chatScroll.innerHTML = "";
    if (memberList) memberList.innerHTML = "";
    if (membersHint) membersHint.textContent = "—";
    setChatEnabled(false);
  }

  async function selectGroup(id, data) {
    selectedGroup = { id, ...(data || {}) };

    if (chatTitle) chatTitle.textContent = selectedGroup.name || "Group";
    if (chatHint) chatHint.textContent = "Checke Membership…";

    clearChatUI();
    clearPresenceSubs();

    await updateJoinLeaveUI(id);

    if (messagesUnsub) messagesUnsub();
    if (membersUnsub) membersUnsub();

    if (currentUser && isMemberOfSelected) {
      listenMessages(id);
      listenMembers(id);
    } else {
      if (chatScroll) {
        chatScroll.innerHTML = `<div class="group-meta" style="padding:.4rem;">Join die Group, um Messages zu sehen.</div>`;
      }
    }

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
      if (!chatScroll) return;
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
        if (!memberList) return;

        memberList.innerHTML = "";
        if (membersHint) membersHint.textContent = `${snap.size} Member`;

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

    try {
      const mRef = db.collection("groups").doc(selectedGroup.id).collection("members").doc(currentUser.uid);
      const mSnap = await mRef.get();
      const role = mSnap.data()?.role || "member";

      if (role === "owner") {
        return notify("warn", "Owner kann im MVP nicht verlassen. (Später: Ownership transfer)");
      }

      await mRef.delete();
      notify("success", "Left ✅");

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

    const text = String(chatInput?.value || "").trim();
    if (!text) return;

    if (chatInput) chatInput.value = "";

    try {
      const payload = {
        uid: currentUser.uid,
        displayName: currentUser.displayName || (currentUser.email ? currentUser.email.split("@")[0] : "User"),
        text: text.slice(0, 900),
        createdAt: serverTS()
      };

      const gRef = db.collection("groups").doc(selectedGroup.id);
      await gRef.collection("messages").add(payload);
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

  function applyAuthUI() {
    const name = currentUser
      ? (currentUser.displayName || (currentUser.email ? currentUser.email.split("@")[0] : "User"))
      : "Guest";

    if (meName) meName.textContent = name;

    if (currentUser) {
      if (btnLogout) btnLogout.style.display = "inline-flex";
      setMeDot("online");
      setPageLock(false);
    } else {
      if (btnLogout) btnLogout.style.display = "none";
      setMeDot("offline");
      setPageLock(!readOnly);
    }
  }

  // ===== Wire UI
  btnRefreshGroups?.addEventListener("click", listenGroups);
  btnCreateGroup?.addEventListener("click", createGroupFlow);
  btnSetActivity?.addEventListener("click", setActivityFlow);

  btnContinueReadOnly?.addEventListener("click", () => {
    readOnly = true;
    setPageLock(false);
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

  // Gate defaults: locked when not logged in
  setPageLock(true);

  // Auth binding
  if (auth && typeof auth.onAuthStateChanged === "function") {
    auth.onAuthStateChanged(async (u) => {
      currentUser = u || null;

      applyAuthUI();

      if (!currentUser) {
        stopPresence();
        if (messagesUnsub) messagesUnsub();
        if (membersUnsub) membersUnsub();
        clearPresenceSubs();
        isMemberOfSelected = false;
        setChatEnabled(false);
        if (chatHint) chatHint.textContent = "Bitte anmelden, um zu chatten.";
        return;
      }

      startPresence();

      // Refresh membership & listeners when logged in
      if (selectedGroup?.id) {
        await updateJoinLeaveUI(selectedGroup.id);
        if (isMemberOfSelected) {
          listenMessages(selectedGroup.id);
          listenMembers(selectedGroup.id);
        }
      }
    });
  } else {
    currentUser = null;
    applyAuthUI();
  }
})();