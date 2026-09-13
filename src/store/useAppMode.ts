import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type AppMode = 'single' | 'multi';

interface AppModeState {
  mode: AppMode | null;
  roomCode: string | null;
  setMode: (mode: AppMode | null) => void;
  setRoomCode: (roomCode: string | null) => void;
}

/**
 * Which testing mode this device is in, kept separate from the tournament
 * data store: it must survive independently of resets and must never be
 * synced to a Firestore room (it's per-device, not shared).
 */
export const useAppMode = create<AppModeState>()(
  persist(
    (set) => ({
      mode: null,
      roomCode: null,
      setMode: (mode) => set({ mode, roomCode: null }),
      setRoomCode: (roomCode) => set({ roomCode }),
    }),
    { name: 'alram-bet-mode' }
  )
);
