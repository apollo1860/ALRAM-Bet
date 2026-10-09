import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type AppMode = 'single' | 'multi';

interface AppModeState {
  mode: AppMode | null;
  roomCode: string | null;
  /** True only for the device that created the current room. Independent of
   *  which player identity that device picked - the creator is also a real
   *  player with their own wallet, just with admin rights on top. */
  isRoomAdmin: boolean;
  /** True once this device has dismissed the risk disclaimer - shown only once, ever, regardless
   *  of mode/room switches, so it's not reset by setMode like roomCode/isRoomAdmin are. */
  hasSeenDisclaimer: boolean;
  setMode: (mode: AppMode | null) => void;
  setRoomCode: (roomCode: string | null) => void;
  setIsRoomAdmin: (isRoomAdmin: boolean) => void;
  dismissDisclaimer: () => void;
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
      isRoomAdmin: false,
      hasSeenDisclaimer: false,
      setMode: (mode) => set({ mode, roomCode: null, isRoomAdmin: false }),
      setRoomCode: (roomCode) => set({ roomCode }),
      setIsRoomAdmin: (isRoomAdmin) => set({ isRoomAdmin }),
      dismissDisclaimer: () => set({ hasSeenDisclaimer: true }),
    }),
    { name: 'alram-bet-mode' }
  )
);
