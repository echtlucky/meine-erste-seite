// =====================================================
// connect.js — echtlucky Connect V3
// Navigation Tabs + Groups + Chat + Presence
// =====================================================

(() => {
  "use strict";

  /* =====================================================
     FIREBASE
  ===================================================== */
  const auth = window.echtlucky?.auth || window.auth || null;
  const db   = window.echtlucky?.db   || window.db   || null;

  if (!db) {
    console.error("connect.js: Firestore fehlt (window.db).");
    return;
  }

  const serverTS = () => firebase.firestore.FieldValue.serverTimestamp();

  const notify = (type, msg) => {
    if (window.notify?.show) return window.notify.show(type, msg);
    console.log(type.toUpperCase() + ":", msg);
  };

  /* =====================================================
     DOM HELPERS
  ===================================================== */
  const $ = (id) => document.getElementById(id);
  const $$ = (sel) => document.querySelectorAll(sel);

  function esc(s){
    return String(s ?? "")
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;");
  }

  /* =====================================================
     STATE
  ===================================================== */
  let currentUser = null;
  let selectedGroup = null;
  let isMember = false;

  let unsubGroups = null;
  let unsubMessages = null;
  let unsubMembers = null;
  let presenceTimer = null;
  let presenceUnsubs = [];

  let activeTab = "chat";

  /* =====================================================
     ELEMENTS
  ===================================================== */
  const loginGate = $("loginGate");

  const groupList = $("groupList");
  const groupSearch = $("groupSearch");

  const chatTitle = $("chatTitle");
  const chatHint = $("chatHint");
  const chatScroll = $("chatScroll");
  const chatForm = $("chatForm");
  const chatInput = $("chatInput");

  const btnJoinLeave = $("btnJoinLeave");
  const btnCreateGroup = $("btnCreateGroup");
  const btnRefreshGroups = $("btnRefreshGroups");
  const btnSetActivity = $("btnSetActivity");
  const btnLogout = $("btnLogout");

  const memberList = $("memberList");
  const membersHint = $("membersHint");

  const meDot = $("meDot");
  const meName = $("meName");

  /* =====================================================
     NAVIGATION (LEFT PANEL)
  ===================================================== */

  function initNavigation(){
    const navItems = $$(".nav-item");

    navItems.forEach(item => {
      item.addEventListener("click", () => {
        navItems.forEach(n => n.classList.remove("is-active"));
        item.classList.add("is-active");

        const label = item.textContent.toLowerCase();

        if (label.includes("chat")) switchTab("chat");
        else if (label.includes("discover")) switchTab("discover");
        else if (label.includes("stats")) switchTab("stats");
        else if (label.includes("profil")) switchTab("profile");
        else if (label.includes("einstellung")) switchTab("settings");
        else if (label.includes("hilfe")) switchTab("help");
      });
    });
  }

  function switchTab(tab){
    activeTab = tab;

    // App Hauptbereich steuern (nur visuell)
    document.body.dataset.connectTab = tab;

    notify("info", "Tab: " + tab);
  }

  /* =====================================================
     PRESENCE
  ===================================================== */

  async function writePresence(patch){
    if (!currentUser) return;
    try {
      await db.collection("presence").doc(currentUser.uid).set({
        uid: currentUser.uid,
        displayName: currentUser.displayName || "User",
        lastSeenAt: serverTS(),
        ...patch
      }, { merge:true });
    } catch(e){}
  }

  function startPresence(){
    writePresence({ state:"online" });
    setDot("online");

    if (presenceTimer) clearInterval(presenceTimer);
    presenceTimer = setInterval(() => {
      writePresence({ state: document.hidden ? "idle" : "online" });
    }, 25000);

    window.addEventListener("beforeunload", () => {
      writePresence({ state:"offline" });
    });
  }

  function stopPresence(){
    if (presenceTimer) clearInterval(presenceTimer);
    setDot("offline");
  }

  function setDot(state){
    if (!meDot) return;
    if (state === "online") meDot.style.background = "#00ff88";
    else if (state === "idle") meDot.style.background = "#ffcc00";
    else meDot.style.background = "rgba(255,255,255,.3)";
  }

  /* =====================================================
     GROUPS
  ===================================================== */

  function renderGroup(id, data){
    const el = document.createElement("div");
    el.className = "group-card" + (selectedGroup?.id === id ? " is-active":"");
    el.innerHTML = `
      <div class="group-name">${esc(data.name)}</div>
      <div class="group-meta">${data.isPublic ? "Public":"Private"}</div>
    `;
    el.onclick = () => selectGroup(id, data);
    return el;
  }

  function listenGroups(){
    unsubGroups?.();

    unsubGroups = db.collection("groups")
      .where("isPublic","==",true)
      .limit(50)
      .onSnapshot(snap => {
        groupList.innerHTML = "";
        snap.forEach(doc => {
          groupList.appendChild(renderGroup(doc.id, doc.data()));
        });
      });
  }

  async function selectGroup(id, data){
    selectedGroup = { id, ...data };
    chatTitle.textContent = data.name;
    chatHint.textContent = "Lade Group…";

    cleanupGroupListeners();

    isMember = await checkMembership(id);
    updateJoinLeave();

    if (isMember) {
      listenMessages(id);
      listenMembers(id);
    } else {
      chatScroll.innerHTML = `<div class="group-meta">Join die Group um zu chatten.</div>`;
    }
  }

  async function checkMembership(groupId){
    if (!currentUser) return false;
    const snap = await db.collection("groups").doc(groupId)
      .collection("members").doc(currentUser.uid).get();
    return snap.exists;
  }

  /* =====================================================
     CHAT
  ===================================================== */

  function listenMessages(groupId){
    unsubMessages?.();

    unsubMessages = db.collection("groups").doc(groupId)
      .collection("messages")
      .orderBy("createdAt","asc")
      .limitToLast(80)
      .onSnapshot(snap => {
        chatScroll.innerHTML = "";
        snap.forEach(doc => {
          const m = doc.data();
          const mine = m.uid === currentUser?.uid;

          const el = document.createElement("div");
          el.className = "msg" + (mine ? " me":"");
          el.innerHTML = `
            <div class="msg-top">
              <div class="msg-name">${esc(m.displayName)}</div>
              <div class="msg-time">${new Date(m.createdAt?.toDate?.()||Date.now()).toLocaleTimeString()}</div>
            </div>
            <div class="msg-text">${esc(m.text)}</div>
          `;
          chatScroll.appendChild(el);
        });
        chatScroll.scrollTop = chatScroll.scrollHeight;
      });
  }

  async function sendMessage(e){
    e.preventDefault();
    if (!chatInput.value || !selectedGroup) return;

    const text = chatInput.value.trim();
    chatInput.value = "";

    await db.collection("groups").doc(selectedGroup.id)
      .collection("messages").add({
        uid: currentUser.uid,
        displayName: currentUser.displayName || "User",
        text,
        createdAt: serverTS()
      });

    await db.collection("groups").doc(selectedGroup.id)
      .set({ lastMessageAt: serverTS() }, { merge:true });
  }

  /* =====================================================
     MEMBERS
  ===================================================== */

  function listenMembers(groupId){
    unsubMembers?.();
    clearPresenceSubs();

    unsubMembers = db.collection("groups").doc(groupId)
      .collection("members")
      .onSnapshot(snap => {
        memberList.innerHTML = "";
        membersHint.textContent = snap.size + " Member";

        snap.forEach(doc => {
          const m = doc.data();
          const row = document.createElement("div");
          row.className = "member";
          row.innerHTML = `
            <div class="member-left">
              <span class="dot" id="dot_${m.uid}"></span>
              <div>
                <div class="member-name">${esc(m.displayName)}</div>
                <div class="member-activity" id="act_${m.uid}">—</div>
              </div>
            </div>
            <span class="group-meta">${m.role || "member"}</span>
          `;
          memberList.appendChild(row);

          const unsub = db.collection("presence").doc(m.uid)
            .onSnapshot(ps => {
              const p = ps.data() || {};
              const dot = $("dot_"+m.uid);
              const act = $("act_"+m.uid);
              if (dot) dot.style.background =
                p.state==="online"?"#00ff88":p.state==="idle"?"#ffcc00":"rgba(255,255,255,.3)";
              if (act) act.textContent = p.activity || "—";
            });

          presenceUnsubs.push(unsub);
        });
      });
  }

  function clearPresenceSubs(){
    presenceUnsubs.forEach(u=>u());
    presenceUnsubs=[];
  }

  function cleanupGroupListeners(){
    unsubMessages?.();
    unsubMembers?.();
    clearPresenceSubs();
  }

  /* =====================================================
     JOIN / LEAVE
  ===================================================== */

  async function joinLeave(){
    if (!currentUser || !selectedGroup) return;

    const ref = db.collection("groups").doc(selectedGroup.id)
      .collection("members").doc(currentUser.uid);

    if (isMember){
      const snap = await ref.get();
      if (snap.data()?.role === "owner"){
        notify("warn","Owner kann nicht verlassen.");
        return;
      }
      await ref.delete();
      isMember = false;
      cleanupGroupListeners();
    } else {
      await ref.set({
        uid: currentUser.uid,
        displayName: currentUser.displayName || "User",
        role:"member",
        joinedAt: serverTS()
      });
      isMember = true;
      listenMessages(selectedGroup.id);
      listenMembers(selectedGroup.id);
    }

    updateJoinLeave();
  }

  function updateJoinLeave(){
    if (!currentUser){
      btnJoinLeave.disabled = true;
      chatInput.disabled = true;
      return;
    }

    btnJoinLeave.disabled = false;
    btnJoinLeave.textContent = isMember ? "Leave" : "Join";
    chatInput.disabled = !isMember;
    chatHint.textContent = isMember
      ? "Du bist drin."
      : "Join die Group um zu chatten.";
  }

  /* =====================================================
     INIT
  ===================================================== */

  btnJoinLeave?.addEventListener("click", joinLeave);
  chatForm?.addEventListener("submit", sendMessage);
  btnCreateGroup?.addEventListener("click", () => notify("info","Group erstellen (Flow folgt)"));
  btnRefreshGroups?.addEventListener("click", listenGroups);
  btnSetActivity?.addEventListener("click", () => notify("info","Activity setzen (Flow folgt)"));

  btnLogout?.addEventListener("click", async ()=>{
    await writePresence({ state:"offline" });
    await auth.signOut();
    notify("success","Logout");
  });

  initNavigation();
  listenGroups();

  if (auth){
    auth.onAuthStateChanged(user=>{
      currentUser = user || null;
      if (user){
        meName.textContent = user.displayName || "User";
        startPresence();
        loginGate.style.display = "none";
      } else {
        stopPresence();
        loginGate.style.display = "flex";
      }
    });
  }

})();