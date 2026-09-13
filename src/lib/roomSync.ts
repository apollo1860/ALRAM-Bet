import { doc, getDoc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useStore, freshSyncedState } from '../store/useStore';
import type { SyncedState } from '../types';

const SYNCED_KEYS = ['players', 'matches', 'wallets', 'transactions', 'bets', 'phase'] as const;

function pickSynced(state: ReturnType<typeof useStore.getState>): SyncedState {
  return {
    players: state.players,
    matches: state.matches,
    wallets: state.wallets,
    transactions: state.transactions,
    bets: state.bets,
    phase: state.phase,
  };
}

function roomRef(code: string) {
  return doc(db, 'rooms', code);
}

export function generateRoomCode(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

/** A misconfigured or unreachable Firebase project can leave a request hanging
 *  instead of rejecting quickly, which would freeze the join/create UI with no
 *  feedback - so give every Firestore call in the gate screens a hard ceiling. */
function withTimeout<T>(promise: Promise<T>, ms = 8000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Zeitüberschreitung - keine Antwort von Firebase.')), ms)
    ),
  ]);
}

export async function roomExists(code: string): Promise<boolean> {
  const snap = await withTimeout(getDoc(roomRef(code)));
  return snap.exists();
}

/** Create a brand new room doc, starting from a fresh (unstarted) tournament. */
export async function createRoomDoc(code: string): Promise<void> {
  await withTimeout(setDoc(roomRef(code), freshSyncedState()));
}

let unsubscribeSnapshot: (() => void) | null = null;
let unsubscribeStore: (() => void) | null = null;
let applyingRemote = false;
let pushTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Two-way sync between the local store and a room document: remote changes
 * are applied locally, and local changes are pushed (debounced) to Firestore.
 * activePlayerId never crosses this boundary - see SyncedState.
 */
export function startRoomSync(code: string) {
  stopRoomSync();

  unsubscribeSnapshot = onSnapshot(roomRef(code), (snap) => {
    const data = snap.data() as SyncedState | undefined;
    if (!data) return;
    applyingRemote = true;
    useStore.getState().applyRemoteState(data);
    applyingRemote = false;
  });

  let prev = pickSynced(useStore.getState());
  unsubscribeStore = useStore.subscribe((state) => {
    if (applyingRemote) return;
    const next = pickSynced(state);
    if (SYNCED_KEYS.every((k) => next[k] === prev[k])) return;
    prev = next;
    if (pushTimer) clearTimeout(pushTimer);
    pushTimer = setTimeout(() => {
      setDoc(roomRef(code), next).catch((err) => {
        console.error('room sync push failed', err);
      });
    }, 250);
  });
}

export function stopRoomSync() {
  unsubscribeSnapshot?.();
  unsubscribeSnapshot = null;
  unsubscribeStore?.();
  unsubscribeStore = null;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = null;
}
