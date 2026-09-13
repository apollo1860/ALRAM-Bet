import { initializeApp } from 'firebase/app';
import { initializeFirestore } from 'firebase/firestore';

/**
 * Firebase web config for the "alram-bet" project. This is safe to ship in
 * client code (it identifies the project, it isn't a secret) - the actual
 * access control is the Firestore security rules on the project, which need
 * to allow read/write on `rooms/{code}` for multi-device mode to work.
 */
const firebaseConfig = {
  apiKey: 'AIzaSyADs2n5UTl850wVbUaLL40ABBpsP6sr79M',
  authDomain: 'alram-bet.firebaseapp.com',
  projectId: 'alram-bet',
  storageBucket: 'alram-bet.firebasestorage.app',
  messagingSenderId: '335311781186',
  appId: '1:335311781186:web:69ab4a134a284b0c965cdb',
};

export const firebaseApp = initializeApp(firebaseConfig);

// Some networks (restrictive proxies/firewalls) break Firestore's normal
// streaming connection; auto-detecting long-polling falls back to plain
// HTTP requests there while still using the fast path everywhere else.
export const db = initializeFirestore(firebaseApp, {
  experimentalAutoDetectLongPolling: true,
});
