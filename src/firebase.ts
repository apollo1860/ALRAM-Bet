import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

/**
 * Paste your Firebase project config here: Firebase console -> Project
 * settings -> General -> "Your apps" -> SDK setup and configuration -> Config.
 * Until this is filled in, multi-device mode will fail with a clear error
 * when trying to create or join a room - single-device mode doesn't touch
 * Firebase at all and works regardless.
 */
const firebaseConfig = {
  apiKey: 'REPLACE_ME',
  authDomain: 'REPLACE_ME.firebaseapp.com',
  projectId: 'REPLACE_ME',
  storageBucket: 'REPLACE_ME.appspot.com',
  messagingSenderId: 'REPLACE_ME',
  appId: 'REPLACE_ME',
};

export const firebaseApp = initializeApp(firebaseConfig);
export const db = getFirestore(firebaseApp);
