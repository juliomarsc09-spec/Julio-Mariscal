import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  User,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  getDocFromServer,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

const CLIENT_ACTOR_KEY = 'qbiocheck_client_actor_id_v1';

export function getSharedActorId(): string {
  if (auth.currentUser?.uid) {
    return auth.currentUser.uid;
  }
  try {
    const existing = localStorage.getItem(CLIENT_ACTOR_KEY);
    if (existing && /^[a-zA-Z0-9_\-]+$/.test(existing)) {
      return existing;
    }
    const generated = `bbkhit_client_${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(CLIENT_ACTOR_KEY, generated);
    return generated;
  } catch {
    return 'bbkhit_shared_client';
  }
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
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
void testConnection();

export async function signInWithGoogle() {
  return signInWithPopup(auth, googleProvider);
}

export async function signOutUser() {
  return signOut(auth);
}

export async function ensureOfficerProfile(user: User): Promise<void> {
  if (!user?.uid) return;
  const userPath = `users/${user.uid}`;
  const privatePath = `users/${user.uid}/private/info`;

  try {
    const userRef = doc(db, 'users', user.uid);
    const snap = await getDoc(userRef);
    const displayName = (user.displayName || user.email?.split('@')[0] || 'Petugas BBKHIT').slice(0, 100);
    const role = user.email === 'juliomarsc09@gmail.com' ? 'admin' : 'officer';

    if (!snap.exists()) {
      await setDoc(userRef, {
        uid: user.uid,
        displayName,
        role,
        unit: 'BBKHIT DKI Jakarta',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, userPath);
  }

  try {
    const privRef = doc(db, 'users', user.uid, 'private', 'info');
    const privSnap = await getDoc(privRef);
    const email = (user.email || 'petugas@bbkhit.go.id').slice(0, 200);
    if (!privSnap.exists()) {
      await setDoc(privRef, {
        uid: user.uid,
        email,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, privatePath);
  }
}
