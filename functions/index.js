const functions = require("firebase-functions");
const admin = require("firebase-admin");
const express = require("express");
const cors = require("cors");

admin.initializeApp();

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

const parseServiceAccount = () => {
  const raw = process.env.APP_SERVICE_ACCOUNT_JSON || (functions.config().app && functions.config().app.service_account);
  if (!raw) {
    return null;
  }
  try {
    return typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch (error) {
    console.error("Failed to parse APP_SERVICE_ACCOUNT_JSON", error);
    return null;
  }
};

const appServiceAccount = parseServiceAccount();
const appProjectId = process.env.APP_PROJECT_ID || (appServiceAccount && appServiceAccount.project_id);

const appAdmin = appServiceAccount
  ? admin.initializeApp(
      {
        credential: admin.credential.cert(appServiceAccount),
        projectId: appProjectId
      },
      "appProject"
    )
  : null;

const requireAppAdmin = (res) => {
  if (!appAdmin) {
    res.status(500).json({
      error: "APP_PROJECT_NOT_CONFIGURED",
      message: "APP_SERVICE_ACCOUNT_JSON or functions.config().app.service_account is missing"
    });
    return false;
  }
  return true;
};

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.post("/auth/bridge-token", async (req, res) => {
  if (!requireAppAdmin(res)) return;

  const { appIdToken } = req.body || {};
  if (!appIdToken) {
    res.status(400).json({ error: "MISSING_TOKEN" });
    return;
  }

  try {
    const decoded = await appAdmin.auth().verifyIdToken(appIdToken);
    const customToken = await admin.auth().createCustomToken(decoded.uid, {
      bridged: true,
      source: "app-project"
    });
    res.json({ customToken });
  } catch (error) {
    console.error(error);
    res.status(401).json({ error: "INVALID_TOKEN" });
  }
});

app.post("/admin/set-admin", async (req, res) => {
  if (!requireAppAdmin(res)) return;

  const secret = req.header("x-admin-secret");
  const adminSecret = process.env.ADMIN_SECRET || (functions.config().app && functions.config().app.admin_secret);

  if (!adminSecret || secret !== adminSecret) {
    res.status(403).json({ error: "FORBIDDEN" });
    return;
  }

  const { uid } = req.body || {};
  if (!uid) {
    res.status(400).json({ error: "MISSING_UID" });
    return;
  }

  try {
    await appAdmin.auth().setCustomUserClaims(uid, { admin: true });
    await appAdmin.firestore().collection("users").doc(uid).set(
      {
        role: "admin",
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      },
      { merge: true }
    );
    res.json({ status: "ok" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "FAILED_TO_SET_ADMIN" });
  }
});

exports.api = functions.https.onRequest(app);
