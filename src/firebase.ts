import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

/**
 * Firebase web config for the "alram-bet" project, using Realtime Database
 * (not Firestore) since that's the database provisioned in this project.
 * This is safe to ship in client code (it identifies the project, it isn't
 * a secret) - the actual access control is the database's security rules,
 * which need to allow read/write on `rooms/{code}` for multi-device mode.
 */
const firebaseConfig = {
  apiKey: 'AIzaSyADs2n5UTl850wVbUaLL40ABBpsP6sr79M',
  authDomain: 'alram-bet.firebaseapp.com',
  databaseURL: 'https://alram-bet-default-rtdb.europe-west1.firebasedatabase.app',
  projectId: 'alram-bet',
  storageBucket: 'alram-bet.firebasestorage.app',
  messagingSenderId: '335311781186',
  appId: '1:335311781186:web:69ab4a134a284b0c965cdb',
};

export const firebaseApp = initializeApp(firebaseConfig);
export const db = getDatabase(firebaseApp);
