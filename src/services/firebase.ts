import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, setPersistence, browserLocalPersistence } from "firebase/auth";
import {
  initializeFirestore,
  getFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  persistentSingleTabManager,
  setLogLevel,
  doc,
  getDocFromServer,
  disableNetwork,
} from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";
import { getStoredOfflineMode } from "./syncUtils";
import appletConfigRaw from "../../firebase-applet-config.json";
const appletConfig = appletConfigRaw as any;

const getEnv = (key: string) => {
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key] !== undefined) {
    return import.meta.env[key];
  }
  return process.env[key];
};

const firebaseConfig = {
  apiKey: getEnv('VITE_FIREBASE_API_KEY') || appletConfig.apiKey,
  authDomain: getEnv('VITE_FIREBASE_AUTH_DOMAIN') || appletConfig.authDomain,
  projectId: getEnv('VITE_FIREBASE_PROJECT_ID') || appletConfig.projectId,
  storageBucket: getEnv('VITE_FIREBASE_STORAGE_BUCKET') || appletConfig.storageBucket,
  messagingSenderId: getEnv('VITE_FIREBASE_MESSAGING_SENDER_ID') || appletConfig.messagingSenderId,
  appId: getEnv('VITE_FIREBASE_APP_ID') || appletConfig.appId,
};

const firestoreDatabaseId =
  getEnv('VITE_FIREBASE_DATABASE_ID') ||
  appletConfig.firestoreDatabaseId ||
  '(default)';

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Suppress verbose Firestore backend connectivity warnings in isolated sandbox/iframe proxy environments
try {
  setLogLevel('silent');
} catch {}

const isInIframe = (() => {
  try {
    return typeof window !== 'undefined' && window.self !== window.top;
  } catch {
    return true;
  }
})();

let firestoreInstance;
try {
  firestoreInstance = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: isInIframe ? persistentSingleTabManager({}) : persistentMultipleTabManager(),
    }),
    experimentalAutoDetectLongPolling: true,
    ignoreUndefinedProperties: true,
  }, firestoreDatabaseId);
} catch (err: any) {
  firestoreInstance = getFirestore(app, firestoreDatabaseId);
}

if (typeof window !== 'undefined' && getStoredOfflineMode()) {
  disableNetwork(firestoreInstance).catch(() => {});
}

export const db = firestoreInstance;
export const auth = getAuth(app);
export const storage = getStorage(app);
export const functions = getFunctions(app, 'europe-west3');
export { firestoreDatabaseId };

setPersistence(auth, browserLocalPersistence).catch(() => {});

export async function testFirestoreConnection(): Promise<boolean> {
  if (typeof navigator !== 'undefined' && (!navigator.onLine || getStoredOfflineMode())) {
    return false;
  }
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error: any) {
    // Gracefully handle backend timeout in sandbox environments without flooding developer console
    return false;
  }
}

if (typeof window !== 'undefined') {
  setTimeout(() => {
    testFirestoreConnection().catch(() => {});
  }, 1500);
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errMessage = error instanceof Error ? error.message : String(error);
  const lower = errMessage.toLowerCase();
  if (
    lower.includes('could not reach cloud firestore backend') ||
    lower.includes('the client is offline') ||
    lower.includes('unavailable') ||
    lower.includes('offline')
  ) {
    console.warn('[Firestore Notice] Operating in offline mode due to network constraint:', errMessage);
    return;
  }

  const errInfo: FirestoreErrorInfo = {
    error: errMessage,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.warn('Firestore Notice: ', JSON.stringify(errInfo));
}

export default app;

