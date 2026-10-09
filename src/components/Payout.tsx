import { useState } from 'react';
import { useStore } from '../store/useStore';
import { getChampion } from '../lib/bracket';
import { computeFinalPayout, formatResultSummary } from '../lib/payout';
import { fmtCoins, fmtEuro, playerName } from '../lib/format';

export function Payout() {
  const players = useStore((s) => s.players);
  const guests = useStore((s) => s.guests);
  const wallets = useStore((s) => s.wallets);
  const transactions = useStore((s) => s.transactions);
  const phase = useStore((s) => s.phase);
  const matches = useStore((s) => s.matches);
  const [shareStatus, setShareStatus] = useState<'idle' | 'copied' | 'error'>('idle');

  const champion = getChampion(matches);

  // Only guests who actually took part (deposited or hold coins) clutter up the final table -
  // someone who only ever opened the "Gast beitreten" screen shouldn't show up as a payout row.
  const activeGuests = guests.filter(
    (g) => (wallets[g.id] ?? 0) > 0 || transactions.some((t) => t.playerId === g.id && t.type === 'deposit')
  );
  const { totalPot, rows } = computeFinalPayout(players, activeGuests, wallets, transactions);
  const sortedRows = [...rows].sort((a, b) => b.payout - a.payout);
  const sumPayout = rows.reduce((a, r) => a + r.payout, 0);

  async function handleShare() {
    const text = formatResultSummary(players, activeGuests, matches, wallets, transactions);
    const nav = navigator as Navigator & { share?: (data: ShareData) => Promise<void> };
    if (nav.share) {
      try {
        await nav.share({ title: 'ALRAM Bet Ergebnis', text });
      } catch {
        // the user closed the share sheet without picking anything - not worth surfacing as an error
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setShareStatus('copied');
      setTimeout(() => setShareStatus('idle'), 2500);
    } catch {
      setShareStatus('error');
      setTimeout(() => setShareStatus('idle'), 2500);
    }
  }

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
      <button className="button-secondary" onClick={handleShare}>
        📤 Ergebnis teilen
      </button>
      {shareStatus === 'copied' && <p className="hint">In die Zwischenablage kopiert ✓</p>}
      {shareStatus === 'error' && <p className="error">Konnte nicht kopiert werden.</p>}
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
              <td data-label="Spieler">{playerName(players, row.playerId, guests)}</td>
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
