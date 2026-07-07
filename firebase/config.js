const admin = require('firebase-admin');
const { getFirestore: getFirebaseFirestore } = require('firebase-admin/firestore');
const path = require('path');
const fs = require('fs');

let db = null;
let isInitialized = false;

function initFirebase() {
  if (isInitialized) return db;

  try {
    // Service account via env var (Railway, Render, etc.)
    const envJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (envJson) {
      const serviceAccount = JSON.parse(envJson);
      const app = admin.initializeApp({ credential: admin.cert(serviceAccount) });
      db = getFirebaseFirestore(app);
    } else {
      // Try service account file (local development)
      const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || './serviceAccountKey.json';
      const resolvedPath = path.resolve(__dirname, '..', serviceAccountPath);
      if (fs.existsSync(resolvedPath)) {
        const serviceAccount = require(resolvedPath);
        const app = admin.initializeApp({ credential: admin.cert(serviceAccount) });
        db = getFirebaseFirestore(app);
      } else {
        // App Hosting: use built-in credentials
        console.log('[Firebase] Usando credenciales integradas de App Hosting');
        const app = admin.initializeApp({});
        db = getFirebaseFirestore(app);
      }
    }

    db.settings({ ignoreUndefinedProperties: true });
    isInitialized = true;
    console.log('[Firebase] Firestore inicializado correctamente');
    return db;
  } catch (err) {
    console.error('[Firebase] Error al inicializar:', err.message);
    return null;
  }
}

function getFirestore() {
  if (!db) return initFirebase();
  return db;
}

function isFirebaseReady() {
  return isInitialized && db !== null;
}

module.exports = { initFirebase, getFirestore, isFirebaseReady };
