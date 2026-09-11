import { useStore } from '../store/useStore';
import { ADMIN_ID, fmtCoinsShort } from '../lib/format';

export function PlayerSwitcher() {
  const players = useStore((s) => s.players);
  const activePlayerId = useStore((s) => s.activePlayerId);
  const setActivePlayer = useStore((s) => s.setActivePlayer);
  const wallets = useStore((s) => s.wallets);

  const isAdmin = activePlayerId === ADMIN_ID;
  const balance = activePlayerId && !isAdmin ? wallets[activePlayerId] ?? 0 : null;

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
