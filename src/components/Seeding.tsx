import { useState } from 'react';
import { useStore } from '../store/useStore';
import { BYE } from '../lib/bracket';

export function Seeding({ isAdmin }: { isAdmin: boolean }) {
  const players = useStore((s) => s.players);
  const seedSlots = useStore((s) => s.seedSlots);
  const setSeedSlot = useStore((s) => s.setSeedSlot);
  const startBracket = useStore((s) => s.startBracket);
  const [error, setError] = useState<string | null>(null);

  if (!isAdmin) {
    return <p className="hint">Der Admin lost gerade die Bracket-Positionen aus. Gleich geht's los.</p>;
  }

  const pairLabels = ['WB1', 'WB2', 'WB3', 'WB4'];

  return (
    <div className="card">
      <h2>Bracket-Auslosung</h2>
      <p className="hint">
        Trag hier die physische Auslosung ein: wer auf Position 1-8 steht. Positionen 1&amp;2, 3&amp;4, 5&amp;6 und
        7&amp;8 spielen jeweils die erste Runde gegeneinander. Bei weniger als 8 Spielern eine Position auf
        "Freilos" setzen - der jeweilige Gegner steigt dann automatisch ohne Spiel in die nächste Runde auf.
      </p>
      <table className="table stack">
        <thead>
          <tr>
            <th>Position</th>
            <th>Spieler</th>
          </tr>
        </thead>
        <tbody>
          {seedSlots.map((playerId, i) => (
            <tr key={i}>
              <td data-label="Position">
                {i + 1}
                {i % 2 === 0 && <span className="hint"> ({pairLabels[i / 2]})</span>}
              </td>
              <td data-label="Spieler">
                <select value={playerId ?? ''} onChange={(e) => setSeedSlot(i, e.target.value)}>
                  {players.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                  <option value={BYE}>Freilos</option>
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button
        onClick={() => {
          const err = startBracket();
          setError(err);
        }}
      >
        Doppel-K.O. starten
      </button>
      {error && <p className="error">{error}</p>}
    </div>
  );
}
