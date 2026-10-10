import { useStore } from '../store/useStore';
import { useAppMode } from '../store/useAppMode';
import { usePulseOnChange } from '../hooks/usePulseOnChange';
import { fmtCoinsShort, playerName } from '../lib/format';

// Your identity was fixed when you joined the room - no free swapping between
// people's personal accounts. The room creator is still a real player with
// their own wallet, just with admin rights on top (shown as a small badge).
export function PlayerSwitcher() {
  const players = useStore((s) => s.players);
  const guests = useStore((s) => s.guests);
  const activePlayerId = useStore((s) => s.activePlayerId);
  const wallets = useStore((s) => s.wallets);
  const isRoomAdmin = useAppMode((s) => s.isRoomAdmin);

  const balance = activePlayerId ? wallets[activePlayerId] ?? 0 : null;
  const balancePulsing = usePulseOnChange(balance ?? 0);

  return (
    <div className="player-switcher">
      {balance !== null && (
        <span className={`balance-pill ${balancePulsing ? 'pulse' : ''}`}>{fmtCoinsShort(balance)}</span>
      )}
      <span className="identity-label">
        {playerName(players, activePlayerId, guests)}
        {isRoomAdmin && ' 🛠'}
      </span>
    </div>
  );
}
