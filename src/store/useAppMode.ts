import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AppModeState {
  roomCode: string | null;
  /** True only for the device that created the current room. Independent of
   *  which player identity that device picked - the creator is also a real
   *  player with their own wallet, just with admin rights on top. */
  isRoomAdmin: boolean;
  /** True once this device has dismissed the risk disclaimer - shown only once, ever. */
  hasSeenDisclaimer: boolean;
  setRoomCode: (roomCode: string | null) => void;
  setIsRoomAdmin: (isRoomAdmin: boolean) => void;
  dismissDisclaimer: () => void;
  /** Leave the current room and go back to the create/join screen. */
  leaveRoom: () => void;
}

/**
 * Which room this device is in, kept separate from the tournament data
 * store: it must survive independently of tournament resets and must never
 * be synced to the Firebase room (it's per-device, not shared).
 */
export const useAppMode = create<AppModeState>()(
  persist(
    (set) => ({
      roomCode: null,
      isRoomAdmin: false,
      hasSeenDisclaimer: false,
      setRoomCode: (roomCode) => set({ roomCode }),
      setIsRoomAdmin: (isRoomAdmin) => set({ isRoomAdmin }),
      dismissDisclaimer: () => set({ hasSeenDisclaimer: true }),
      leaveRoom: () => set({ roomCode: null, isRoomAdmin: false }),
    }),
    { name: 'alram-bet-mode' }
  )
);
