import { useStore } from '../store/useStore';
import { ADMIN_ID, fmtCoins } from '../lib/format';

export function PlayerSwitcher() {
  const players = useStore((s) => s.players);
  const activePlayerId = useStore((s) => s.activePlayerId);
  const setActivePlayer = useStore((s) => s.setActivePlayer);
  const wallets = useStore((s) => s.wallets);

  const isAdmin = activePlayerId === ADMIN_ID;
  const balance = activePlayerId && !isAdmin ? wallets[activePlayerId] ?? 0 : null;

  return (
    <div className="player-switcher">
      <label>
        Ich bin gerade:
        <select value={activePlayerId ?? ''} onChange={(e) => setActivePlayer(e.target.value)}>
          <option value={ADMIN_ID}>🛠 Admin / Turnierleitung</option>
          {players.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
              {p.eliminated ? ' (ausgeschieden)' : ''}
            </option>
          ))}
        </select>
      </label>
      {balance !== null && <span className="balance-pill">{fmtCoins(balance)}</span>}
    </div>
  );
}
