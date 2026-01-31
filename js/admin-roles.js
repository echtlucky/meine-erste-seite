import {
  onAuthStateChanged,
  getIdTokenResult,
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import { appAuth, appDb } from "./firebase-init.js";
import { loadLayout } from "./layout.js";

const rolesStatus = document.getElementById("roles-status");
const rolesStatusText = rolesStatus.querySelector(".admin-status-text");
const rolesLoginForm = document.getElementById("roles-login-form");
const rolesLoginMessage = document.getElementById("roles-login-message");
const rolesLogoutBtn = document.getElementById("roles-logout");
const rolesGrid = document.getElementById("roles-grid");
const rolesHint = document.getElementById("roles-hint");
const rolesUserList = document.getElementById("roles-user-list");

const ensureAdmin = async (user) => {
  const token = await getIdTokenResult(user, true);
  return token.claims && token.claims.admin === true;
};

const createActionButton = (label, icon, onClick) => {
  const button = document.createElement("button");
  button.className = "action-btn";
  button.title = label;
  button.textContent = icon;
  button.addEventListener("click", onClick);
  return button;
};

const renderUserRow = (docSnap) => {
  const data = docSnap.data();

  const row = document.createElement("div");
  row.className = "role-row";

  const meta = document.createElement("div");
  meta.className = "role-meta";
  meta.innerHTML = `
    <strong>${data.displayName || data.email || docSnap.id}</strong>
    <span>${data.email || "-"}</span>
  `;

  const roleSelect = document.createElement("select");
  roleSelect.className = "role-select";
  ["user", "moderator", "admin"].forEach((role) => {
    const option = document.createElement("option");
    option.value = role;
    option.textContent = role;
    if ((data.role || "user") === role) option.selected = true;
    roleSelect.appendChild(option);
  });

  const statusSelect = document.createElement("select");
  statusSelect.className = "role-select";
  ["active", "disabled"].forEach((status) => {
    const option = document.createElement("option");
    option.value = status;
    option.textContent = status;
    if ((data.status || "active") === status) option.selected = true;
    statusSelect.appendChild(option);
  });

  const saveButton = createActionButton("Speichern", "💾", async () => {
    await setDoc(docSnap.ref, {
      role: roleSelect.value,
      status: statusSelect.value
    }, { merge: true });
  });

  const actions = document.createElement("div");
  actions.className = "role-actions";
  actions.append(roleSelect, statusSelect, saveButton);

  row.append(meta, actions);
  return row;
};

const loadUsers = async () => {
  rolesUserList.innerHTML = "";
  const usersQuery = query(collection(appDb, "users"), orderBy("createdAt", "desc"), limit(50));
  const snapshot = await getDocs(usersQuery);

  if (snapshot.empty) {
    rolesUserList.innerHTML = "<p class=\"comment-meta\">Keine Nutzer gefunden.</p>";
    return;
  }

  snapshot.forEach((docSnap) => {
    rolesUserList.appendChild(renderUserRow(docSnap));
  });
};

rolesLoginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  rolesLoginMessage.textContent = "";

  const email = document.getElementById("roles-login-email").value.trim();
  const password = document.getElementById("roles-login-password").value.trim();

  try {
    await signInWithEmailAndPassword(appAuth, email, password);
    rolesLoginMessage.textContent = "Login erfolgreich.";
  } catch (error) {
    rolesLoginMessage.textContent = `Fehler: ${error.message}`;
  }
});

rolesLogoutBtn.addEventListener("click", async () => {
  await signOut(appAuth);
});

loadLayout();

if (!appAuth || !appDb) {
  rolesStatusText.textContent = "Firebase ist noch nicht konfiguriert.";
} else {
  onAuthStateChanged(appAuth, async (user) => {
    if (!user) {
      rolesStatusText.textContent = "Bitte einloggen, um fortzufahren.";
      rolesGrid.style.display = "none";
      rolesLoginForm.style.display = "block";
      rolesHint.style.display = "none";
      return;
    }

    const isAdmin = await ensureAdmin(user);
    if (!isAdmin) {
      rolesStatusText.textContent = "Kein Admin-Zugriff. Bitte Admin-Rechte vergeben.";
      rolesGrid.style.display = "none";
      rolesLoginForm.style.display = "block";
      rolesHint.style.display = "none";
      return;
    }

    rolesStatusText.textContent = `Eingeloggt als ${user.email}`;
    rolesGrid.style.display = "grid";
    rolesLoginForm.style.display = "none";
    rolesHint.style.display = "block";
    loadUsers();
  });
}
