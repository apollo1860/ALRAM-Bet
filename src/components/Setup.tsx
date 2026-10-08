import { useStore } from '../store/useStore';

export function Setup({ isAdmin }: { isAdmin: boolean }) {
  const players = useStore((s) => s.players);
  const phase = useStore((s) => s.phase);
  const updatePlayer = useStore((s) => s.updatePlayer);
  const resetTournament = useStore((s) => s.resetTournament);

  const editable = phase === 'setup' && isAdmin;

  return (
    <div className="card">
      <h2>Spieler &amp; Startquoten</h2>
      <p className="hint">
        Die Gesamtsieg-Quote bestimmt die Ausgangsstärke jedes Spielers. Daraus werden die Quoten für
        einzelne Spiele berechnet (wer ist Favorit gegen wen) – die Stärke passt sich danach automatisch an
        Sieg/Niederlage im Turnierverlauf an.
      </p>
      {!isAdmin && <p className="hint">Nur der Admin kann Spieler und Quoten bearbeiten.</p>}
      <table className="table stack">
        <thead>
          <tr>
            <th>Name</th>
            <th>Gesamtsieg-Quote</th>
          </tr>
        </thead>
        <tbody>
          {players.map((p) => (
            <tr key={p.id}>
              <td data-label="Name">
                <input
                  type="text"
                  value={p.name}
                  disabled={!editable}
                  onChange={(e) => updatePlayer(p.id, { name: e.target.value })}
                />
              </td>
              <td data-label="Quote">
                <input
                  type="number"
                  step="0.01"
                  min="1.01"
                  value={p.initialOdds}
                  disabled={!editable}
                  onChange={(e) => updatePlayer(p.id, { initialOdds: Number(e.target.value) })}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {editable && <p className="hint">Weiter geht's im K.O.-Tab: dort die Bracket-Positionen zuweisen und starten.</p>}
      {isAdmin && !editable && (
        <div className="danger-zone">
          <p className="hint">Turnier läuft bereits (Phase: {phase}).</p>
          <button className="danger" onClick={() => confirm('Wirklich das ganze Turnier zurücksetzen?') && resetTournament()}>
            Turnier zurücksetzen
          </button>
        </div>
      )}
    </div>
  );
}
