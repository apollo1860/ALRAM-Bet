import { useState } from 'react';
import { useStore } from '../store/useStore';
import { fmtCoins, fmtOdds, playerName } from '../lib/format';

export function Wallet({ playerId }: { playerId: string | null }) {
  const players = useStore((s) => s.players);
  const wallets = useStore((s) => s.wallets);
  const bets = useStore((s) => s.bets);
  const matches = useStore((s) => s.matches);
  const depositCoins = useStore((s) => s.depositCoins);
  const [amount, setAmount] = useState('');

  if (!playerId) {
    return <p className="hint">Bitte oben einen Spieler auswählen.</p>;
  }

  const balance = wallets[playerId] ?? 0;
  const myBets = bets.filter((b) => b.bettorId === playerId).sort((a, b) => b.createdAt - a.createdAt);

  return (
    <div className="card">
      <h2>Mein Konto</h2>
      <p className="balance-big">{fmtCoins(balance)}</p>
      <form
        className="deposit-form"
        onSubmit={(e) => {
          e.preventDefault();
          const n = Number(amount);
          if (n > 0) {
            depositCoins(playerId, n);
            setAmount('');
          }
        }}
      >
        <input
          type="number"
          min="1"
          step="1"
          placeholder="Betrag in € einzahlen"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <button type="submit">Einzahlen (1€ = 1 Coin)</button>
      </form>
      <p className="hint">Hinweis: Das ist reine Buchhaltung im Browser, es fließt kein echtes Geld.</p>

      <h3>Meine Wetten</h3>
      {myBets.length === 0 && <p className="hint">Noch keine Wetten platziert.</p>}
      <table className="table">
        <thead>
          <tr>
            <th>Spiel</th>
            <th>Tipp</th>
            <th>Einsatz</th>
            <th>Quote</th>
            <th>Status</th>
            <th>Auszahlung</th>
          </tr>
        </thead>
        <tbody>
          {myBets.map((b) => {
            const m = matches.find((mm) => mm.id === b.matchId);
            return (
              <tr key={b.id}>
                <td>
                  {m ? `${playerName(players, m.playerAId)} vs ${playerName(players, m.playerBId)}` : b.matchId}
                </td>
                <td>{playerName(players, b.pickedPlayerId)}</td>
                <td>{fmtCoins(b.amount)}</td>
                <td>{fmtOdds(b.oddsAtPlacement)}</td>
                <td className={`status-${b.status}`}>{b.status}</td>
                <td>{b.payout !== null ? fmtCoins(b.payout) : '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
