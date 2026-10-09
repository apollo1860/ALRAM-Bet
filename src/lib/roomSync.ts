import { get, onValue, ref, set as dbSet } from 'firebase/database';
import { db } from '../firebase';
import { useStore, freshSyncedState } from '../store/useStore';
import { useSyncStatus } from '../store/useSyncStatus';
import { createMessage, WELCOME_TEXT } from './messages';
import type { Guest, Message, Player, SyncedState } from '../types';

const SYNCED_KEYS = [
  'players',
  'guests',
  'claimedPlayerIds',
  'seedSlots',
  'matches',
  'wallets',
  'transactions',
  'bets',
  'messages',
  'phase',
] as const;

function pickSynced(state: ReturnType<typeof useStore.getState>): SyncedState {
  return {
    players: state.players,
    guests: state.guests,
    claimedPlayerIds: state.claimedPlayerIds,
    seedSlots: state.seedSlots,
    matches: state.matches,
    wallets: state.wallets,
    transactions: state.transactions,
    bets: state.bets,
    messages: state.messages,
    phase: state.phase,
  };
}

/** Realtime Database drops empty arrays/objects entirely instead of storing
 *  them as [] / {}, so a freshly-created room's `matches: []` comes back as
 *  `null` on read - patch those back to the empty containers the rest of
 *  the app expects. */
function normalizeSyncedState(raw: Partial<SyncedState> | null): SyncedState {
  const fresh = freshSyncedState();
  return {
    players: raw?.players ?? fresh.players,
    guests: raw?.guests ?? [],
    claimedPlayerIds: raw?.claimedPlayerIds ?? [],
    seedSlots: raw?.seedSlots ?? fresh.seedSlots,
    matches: raw?.matches ?? [],
    wallets: raw?.wallets ?? fresh.wallets,
    transactions: raw?.transactions ?? [],
    bets: raw?.bets ?? [],
    messages: raw?.messages ?? [],
    phase: raw?.phase ?? 'setup',
  };
}

function roomRef(code: string) {
  return ref(db, `rooms/${code}`);
}

export function generateRoomCode(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

/** A misconfigured or unreachable Firebase project can leave a request hanging
 *  instead of rejecting quickly, which would freeze the join/create UI with no
 *  feedback - so give every call in the gate screens a hard ceiling. */
function withTimeout<T>(promise: Promise<T>, ms = 8000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Zeitüberschreitung - keine Antwort von Firebase.')), ms)
    ),
  ]);
}

export async function roomExists(code: string): Promise<boolean> {
  const snap = await withTimeout(get(roomRef(code)));
  return snap.exists();
}

/** Read a room's current roster, so a joining device can offer "which of these are you?". */
export async function getRoomPlayers(code: string): Promise<Player[]> {
  const snap = await withTimeout(get(ref(db, `rooms/${code}/players`)));
  return (snap.val() as Player[] | null) ?? [];
}

/** Read which player ids some device has already claimed as its identity in this room. */
export async function getRoomClaims(code: string): Promise<string[]> {
  const snap = await withTimeout(get(ref(db, `rooms/${code}/claimedPlayerIds`)));
  return (snap.val() as string[] | null) ?? [];
}

/**
 * Claim a player identity for this device, straight in Firebase and ahead of
 * `setRoomCode` for the same reason guests are added there instead of
 * through the store - the very first room snapshot this device applies
 * would otherwise wipe out a claim that only existed locally. Re-checks
 * right before writing and throws if someone else grabbed the same player
 * in the meantime, so two devices can't both end up as the same person.
 */
export async function claimPlayerInRoom(code: string, playerId: string): Promise<void> {
  const snap = await withTimeout(get(ref(db, `rooms/${code}/claimedPlayerIds`)));
  const existing = (snap.val() as string[] | null) ?? [];
  if (existing.includes(playerId)) {
    throw new Error('Diese Person wurde inzwischen schon von jemand anderem ausgewählt.');
  }
  await withTimeout(dbSet(ref(db, `rooms/${code}/claimedPlayerIds`), [...existing, playerId]));
}

/** Create a brand new room, starting from a fresh (unstarted) tournament. */
export async function createRoomDoc(code: string): Promise<void> {
  await withTimeout(dbSet(roomRef(code), freshSyncedState()));
}

/**
 * Write a new guest straight into the room, before this device switches
 * into it. Room sync only starts once `roomCode` is set locally, and its
 * very first snapshot would otherwise overwrite a guest added purely in the
 * local store with the older remote state that doesn't have them yet - so
 * guests are added here, directly in Firebase, ahead of that.
 */
export async function addGuestToRoom(code: string, guest: Guest): Promise<void> {
  const snap = await withTimeout(get(ref(db, `rooms/${code}/guests`)));
  const existing = (snap.val() as Guest[] | null) ?? [];
  await withTimeout(dbSet(ref(db, `rooms/${code}/guests`), [...existing, guest]));

  const messagesSnap = await withTimeout(get(ref(db, `rooms/${code}/messages`)));
  const existingMessages = (messagesSnap.val() as Message[] | null) ?? [];
  const welcome = createMessage(guest.id, 'welcome', WELCOME_TEXT);
  await withTimeout(dbSet(ref(db, `rooms/${code}/messages`), [...existingMessages, welcome]));
}

let unsubscribeSnapshot: (() => void) | null = null;
let unsubscribeStore: (() => void) | null = null;
let unsubscribeConnection: (() => void) | null = null;
let applyingRemote = false;
let pushTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Two-way sync between the local store and a room: remote changes are
 * applied locally, and local changes are pushed (debounced) to Firebase.
 * activePlayerId never crosses this boundary - see SyncedState.
 */
export function startRoomSync(code: string) {
  stopRoomSync();

  // Firebase's special ".info/connected" path reflects this client's own
  // socket state (not just "is the internet up") - the one signal that
  // tells the UI a bet or deposit might not actually have gone through yet.
  unsubscribeConnection = onValue(ref(db, '.info/connected'), (snap) => {
    useSyncStatus.getState().setStatus(snap.val() === true ? 'connected' : 'offline');
  });

  unsubscribeSnapshot = onValue(roomRef(code), (snap) => {
    const data = snap.val() as Partial<SyncedState> | null;
    applyingRemote = true;
    useStore.getState().applyRemoteState(normalizeSyncedState(data));
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
      dbSet(roomRef(code), next)
        .then(() => {
          // a push landing again after a failure means we've recovered - follow the
          // live socket state rather than hardcoding "connected" in case it dropped again meanwhile
          if (useSyncStatus.getState().status === 'error') {
            useSyncStatus.getState().setStatus('connected');
          }
        })
        .catch((err) => {
          console.error('room sync push failed', err);
          useSyncStatus.getState().setStatus('error');
        });
    }, 250);
  });
}

export function stopRoomSync() {
  unsubscribeSnapshot?.();
  unsubscribeSnapshot = null;
  unsubscribeStore?.();
  unsubscribeStore = null;
  unsubscribeConnection?.();
  unsubscribeConnection = null;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = null;
  useSyncStatus.getState().setStatus('idle');
}
