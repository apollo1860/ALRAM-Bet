import { useStore } from '../store/useStore';
import { computeFinalPayout } from '../lib/payout';
import { fmtCoins, fmtEuro, playerName } from '../lib/format';

export function Payout() {
  const players = useStore((s) => s.players);
  const wallets = useStore((s) => s.wallets);
  const transactions = useStore((s) => s.transactions);
  const phase = useStore((s) => s.phase);
  const matches = useStore((s) => s.matches);

  const finalMatch = matches.find((m) => m.stage === 'final');
  const champion = finalMatch?.status === 'finished' ? finalMatch.winnerId : null;

  const { totalPot, rows } = computeFinalPayout(players, wallets, transactions);
  const sortedRows = [...rows].sort((a, b) => b.payout - a.payout);
  const sumPayout = rows.reduce((a, r) => a + r.payout, 0);

  return (
    <div className="card">
      <h2>Abrechnung</h2>
      {phase !== 'done' ? (
        <p className="hint">
          Die Endabrechnung wird final, sobald das Finale gespielt ist. Bis dahin ist das hier ein Zwischenstand -
          Coins-Guthaben ändert sich noch mit jedem weiteren Spiel.
        </p>
      ) : (
        champion && (
          <p>
            🏆 Turniersieger: <strong>{playerName(players, champion)}</strong>
          </p>
        )
      )}
      <p>
        Gesamttopf (alle Einzahlungen zusammen): <strong>{fmtEuro(totalPot)}</strong>
      </p>
      <p className="hint">
        Der Topf wird am Ende anteilig nach Coin-Endstand ausgezahlt - wer mit mehr Coins dasteht, kriegt einen
        größeren Anteil vom echten eingezahlten Geld. Auszahlungen sind ganze Zahlen und summieren sich exakt auf
        den Gesamttopf.
      </p>
      <table className="table stack">
        <thead>
          <tr>
            <th>Spieler</th>
            <th>Eingezahlt</th>
            <th>Coins am Ende</th>
            <th>Anteil</th>
            <th>Auszahlung</th>
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((row) => (
            <tr key={row.playerId}>
              <td data-label="Spieler">{playerName(players, row.playerId)}</td>
              <td data-label="Eingezahlt">{fmtEuro(row.deposited)}</td>
              <td data-label="Coins am Ende">{fmtCoins(row.finalCoins)}</td>
              <td data-label="Anteil">{row.sharePercent.toFixed(1)}%</td>
              <td data-label="Auszahlung">
                <strong>{fmtEuro(row.payout)}</strong>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={4}>Summe Auszahlungen</td>
            <td data-label="Gesamt">
              <strong>{fmtEuro(sumPayout)}</strong>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
