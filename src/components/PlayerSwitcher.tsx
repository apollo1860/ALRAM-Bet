import { useStore } from '../store/useStore';
import { useAppMode } from '../store/useAppMode';
import { ADMIN_ID, fmtCoinsShort, playerName } from '../lib/format';

export function PlayerSwitcher() {
  const players = useStore((s) => s.players);
  const activePlayerId = useStore((s) => s.activePlayerId);
  const setActivePlayer = useStore((s) => s.setActivePlayer);
  const wallets = useStore((s) => s.wallets);
  const mode = useAppMode((s) => s.mode);
  const isRoomAdmin = useAppMode((s) => s.isRoomAdmin);

  const isSingleAdmin = activePlayerId === ADMIN_ID;
  const balance = activePlayerId && !isSingleAdmin ? wallets[activePlayerId] ?? 0 : null;

  // In a shared multi-device room your identity was fixed when you joined -
  // no free swapping between people's personal accounts. The room creator
  // is still a real player (own wallet), just with admin rights on top.
  if (mode === 'multi') {
    return (
      <div className="player-switcher">
        {balance !== null && <span className="balance-pill">{fmtCoinsShort(balance)}</span>}
        <span className="identity-label">
          {playerName(players, activePlayerId)}
          {isRoomAdmin && ' 🛠'}
        </span>
      </div>
    );
  }

  return (
    <div className="player-switcher">
      {balance !== null && <span className="balance-pill">{fmtCoinsShort(balance)}</span>}
      <select
        aria-label="Aktive Identität wählen"
        value={activePlayerId ?? ''}
        onChange={(e) => setActivePlayer(e.target.value)}
      >
        <option value={ADMIN_ID}>🛠 Admin</option>
        {players.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
            {p.eliminated ? ' ✗' : ''}
          </option>
        ))}
      </select>
    </div>
  );
}
