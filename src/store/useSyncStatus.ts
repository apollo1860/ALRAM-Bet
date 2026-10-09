import { create } from 'zustand';

export type SyncStatus = 'idle' | 'connected' | 'offline' | 'error';

interface SyncStatusState {
  status: SyncStatus;
  setStatus: (status: SyncStatus) => void;
}

/**
 * Live connection/sync state for the current multi-device room, kept out of
 * the persisted stores on purpose - it reflects "is Firebase reachable right
 * now", not something that should survive a reload with a stale value.
 */
export const useSyncStatus = create<SyncStatusState>((set) => ({
  status: 'idle',
  setStatus: (status) => set({ status }),
}));
