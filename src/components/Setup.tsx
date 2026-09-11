import { useStore } from '../store/useStore';
import type { GroupId } from '../types';

export function Setup() {
  const players = useStore((s) => s.players);
  const phase = useStore((s) => s.phase);
  const updatePlayer = useStore((s) => s.updatePlayer);
  const startGroupStage = useStore((s) => s.startGroupStage);
  const resetTournament = useStore((s) => s.resetTournament);

  const groupA = players.filter((p) => p.group === 'A');
  const groupB = players.filter((p) => p.group === 'B');
  const locked = phase !== 'setup';
  const canStart = groupA.length === 5 && groupB.length === 5;

  return (
    <div className="card">
      <h2>Spieler &amp; Startquoten</h2>
      <p className="hint">
        Die Gesamtsieg-Quote bestimmt die Ausgangsstärke jedes Spielers. Daraus werden die Quoten für
        einzelne Spiele berechnet (wer ist Favorit gegen wen) – die Stärke passt sich danach automatisch an
        Sieg/Niederlage im Turnierverlauf an.
      </p>
      <table className="table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Gruppe</th>
            <th>Gesamtsieg-Quote</th>
          </tr>
        </thead>
        <tbody>
          {players.map((p) => (
            <tr key={p.id}>
              <td>
                <input
                  value={p.name}
                  disabled={locked}
                  onChange={(e) => updatePlayer(p.id, { name: e.target.value })}
                />
              </td>
              <td>
                <select
                  value={p.group}
                  disabled={locked}
                  onChange={(e) => updatePlayer(p.id, { group: e.target.value as GroupId })}
                >
                  <option value="A">Gruppe A</option>
                  <option value="B">Gruppe B</option>
                </select>
              </td>
              <td>
                <input
                  type="number"
                  step="0.01"
                  min="1.01"
                  value={p.initialOdds}
                  disabled={locked}
                  onChange={(e) => updatePlayer(p.id, { initialOdds: Number(e.target.value) })}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="hint">
        Gruppe A: {groupA.length}/5 &nbsp;·&nbsp; Gruppe B: {groupB.length}/5
      </p>
      {!locked && (
        <button disabled={!canStart} onClick={startGroupStage}>
          Turnier starten (Gruppenphase erzeugen)
        </button>
      )}
      {locked && (
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
