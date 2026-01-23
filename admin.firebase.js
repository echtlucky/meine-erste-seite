/* ======================================================
   🔥 ADMIN PANEL – FIREBASE LOGIC
====================================================== */

/* =========================
   📊 DASHBOARD STATS
========================= */
async function loadStats() {
  try {
    const [posts, users, bans] = await Promise.all([
      db.collection("posts").get(),
      db.collection("users").get(),
      db.collection("bans").get()
    ]);

    setStat("stat-posts", posts.size);
    setStat("stat-users", users.size);
    setStat("stat-bans", bans.size);
  } catch (err) {
    console.error("Stats load failed", err);
  }
}

function setStat(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

/* =========================
   📝 POSTS
========================= */
async function loadPosts() {
  const list = document.getElementById("post-list");
  list.innerHTML = "";

  const snap = await db
    .collection("posts")
    .orderBy("createdAt", "desc")
    .get();

  if (snap.empty) {
    list.innerHTML = "<div class='list empty'>Keine Beiträge</div>";
    return;
  }

  snap.forEach(doc => {
    const p = doc.data();
    const el = document.createElement("div");
    el.className = "card";

    el.innerHTML = `
      <strong>${p.title}</strong>
      <small>${p.date || ""}</small>
      <div style="margin-top:8px">
        <button class="btn danger" onclick="deletePost('${doc.id}')">
          Löschen
        </button>
      </div>
    `;
    list.appendChild(el);
  });
}

async function savePost() {
  guardRole("mod", async () => {
    const title = document.getElementById("post-title").value.trim();
    const content = document.getElementById("post-content").value.trim();
    const date = document.getElementById("post-date").value;

    if (!title || !content) {
      alert("Titel & Inhalt fehlen");
      return;
    }

    await db.collection("posts").add({
      title,
      content,
      date,
      author: currentUser.email,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    closePostModal();
    loadPosts();
    loadStats();
  });
}

async function deletePost(id) {
  guardRole("mod", async () => {
    if (!confirm("Post wirklich löschen?")) return;
    await db.collection("posts").doc(id).delete();
    loadPosts();
    loadStats();
  });
}

/* =========================
   👥 USERS & ROLES
========================= */
async function loadUsers() {
  const list = document.getElementById("user-list");
  list.innerHTML = "";

  const snap = await db.collection("users").get();

  snap.forEach(doc => {
    const u = doc.data();
    const el = document.createElement("div");
    el.className = "card";

    el.innerHTML = `
      <strong>${u.email}</strong>
      <select onchange="changeUserRole('${doc.id}', this.value)">
        <option ${u.role === "supporter" ? "selected" : ""}>supporter</option>
        <option ${u.role === "mod" ? "selected" : ""}>mod</option>
        <option ${u.role === "admin" ? "selected" : ""}>admin</option>
      </select>
    `;
    list.appendChild(el);
  });
}

async function changeUserRole(uid, role) {
  guardRole("admin", async () => {
    await db.collection("users").doc(uid).update({ role });
    loadUsers();
  });
}

/* =========================
   ⛔ BANS
========================= */
async function banUser() {
  guardRole("mod", async () => {
    const email = document.getElementById("ban-email").value.trim();
    if (!email) return;

    await db.collection("bans").add({
      email,
      bannedAt: firebase.firestore.FieldValue.serverTimestamp(),
      by: currentUser.email
    });

    document.getElementById("ban-email").value = "";
    loadBans();
    loadStats();
  });
}

async function loadBans() {
  const list = document.getElementById("ban-list");
  list.innerHTML = "";

  const snap = await db.collection("bans").get();

  if (snap.empty) {
    list.innerHTML = "<div class='list empty'>Keine Bans</div>";
    return;
  }

  snap.forEach(doc => {
    const b = doc.data();
    const el = document.createElement("div");
    el.className = "card";

    el.innerHTML = `
      <strong>${b.email}</strong>
      <small>${b.bannedAt?.toDate().toLocaleString() || ""}</small>
      <button class="btn" onclick="unban('${doc.id}')">Entbannen</button>
    `;
    list.appendChild(el);
  });
}

async function unban(id) {
  guardRole("mod", async () => {
    await db.collection("bans").doc(id).delete();
    loadBans();
    loadStats();
  });
}

/* =========================
   🧾 LOGS
========================= */
function logAction(action) {
  return db.collection("logs").add({
    action,
    by: currentUser.email,
    at: firebase.firestore.FieldValue.serverTimestamp()
  });
}

/* =========================
   🚀 INIT AFTER LOGIN
========================= */
auth.onAuthStateChanged(user => {
  if (!user) return;
  loadStats();
  loadPosts();
  loadUsers();
  loadBans();
});
