# Backend Setup (Firebase Functions)

Die Funktionen laufen im **Website-Projekt** und verbinden sich per Admin SDK mit dem **App-Projekt**.

## 1) Service Account (App-Projekt)
Exportiere einen Service Account vom App-Projekt und speichere ihn als JSON.

Option A (empfohlen, Config):
```
firebase functions:config:set app.service_account='{"type":"service_account", ... }'
```

Option B (Environment):
- `APP_SERVICE_ACCOUNT_JSON` als JSON-String setzen
- Optional: `APP_PROJECT_ID`

## 2) Admin Secret
Wird für den Admin-Claim benötigt.
```
firebase functions:config:set app.admin_secret='DEIN_SECRET'
```

Beim Request:
```
POST /api/admin/set-admin
Header: x-admin-secret: DEIN_SECRET
Body: { "uid": "USER_UID" }
```

## 3) Bridge Token (Website <-> App)
```
POST /api/auth/bridge-token
Body: { "appIdToken": "<ID_TOKEN_AUS_APP_PROJEKT>" }
```
Antwort: `{ "customToken": "..." }`

Damit kannst du im Website-Projekt `signInWithCustomToken` nutzen, falls du dort Firestore/Storage brauchst.

## 4) Deployment
```
firebase deploy --only functions
```

## 5) Firestore Rules
Die Datei `firestore.rules` ist für das **App-Projekt** gedacht.
Deploy:
```
firebase deploy --only firestore:rules
```
