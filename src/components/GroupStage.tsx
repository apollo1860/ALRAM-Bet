import { useState } from 'react';
import { useStore } from '../store/useStore';
import { computeStandings, isGroupStageComplete } from '../lib/bracket';
import { playerName } from '../lib/format';
import type { GroupId } from '../types';

function ResultForm({ onSubmit }: { onSubmit: (a: number, b: number) => void }) {
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  return (
    <form
      className="score-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (a === '' || b === '' || Number(a) === Number(b)) return;
        onSubmit(Number(a), Number(b));
      }}
    >
      <input type="number" min="0" value={a} onChange={(e) => setA(e.target.value)} placeholder="Sätze A" />
      <span>:</span>
      <input type="number" min="0" value={b} onChange={(e) => setB(e.target.value)} placeholder="Sätze B" />
      <button type="submit">Speichern</button>
    </form>
  );
}

function GroupTable({ groupId, isAdmin }: { groupId: GroupId; isAdmin: boolean }) {
  const players = useStore((s) => s.players);
  const matches = useStore((s) => s.matches);
  const enterGroupResult = useStore((s) => s.enterGroupResult);
  const groupMatches = matches.filter((m) => m.stage === 'group' && m.groupId === groupId);
  const standings = computeStandings(groupId, players, matches);

  return (
    <div className="card">
      <h3>Gruppe {groupId}</h3>
      <table className="table">
        <thead>
          <tr>
            <th>#</th>
            <th>Spieler</th>
            <th>Sp</th>
            <th>S</th>
            <th>N</th>
            <th>Punkte +/-</th>
            <th>Diff</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((row) => (
            <tr key={row.playerId} className={row.rank <= 4 ? 'qualified' : 'eliminated-row'}>
              <td>{row.rank}</td>
              <td>{playerName(players, row.playerId)}</td>
              <td>{row.played}</td>
              <td>{row.wins}</td>
              <td>{row.losses}</td>
              <td>
                {row.pointsFor}:{row.pointsAgainst}
              </td>
              <td>{row.diff > 0 ? `+${row.diff}` : row.diff}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="hint">Beste 4 kommen weiter, Platz 5 scheidet aus.</p>

      <table className="table matches-table">
        <tbody>
          {groupMatches.map((m) => (
            <tr key={m.id}>
              <td>
                {playerName(players, m.playerAId)} vs {playerName(players, m.playerBId)}
              </td>
              <td>
                {m.status === 'finished' ? (
                  <strong>
                    {m.scoreA}:{m.scoreB}
                  </strong>
                ) : isAdmin ? (
                  <ResultForm onSubmit={(a, b) => enterGroupResult(m.id, a, b)} />
                ) : (
                  <em>offen</em>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function GroupStage({ isAdmin }: { isAdmin: boolean }) {
  const matches = useStore((s) => s.matches);
  const phase = useStore((s) => s.phase);
  const startKnockoutStage = useStore((s) => s.startKnockoutStage);

  if (phase === 'setup') {
    return <p className="hint">Die Gruppenphase startet, sobald das Turnier im Setup gestartet wurde.</p>;
  }

  const bothDone = isGroupStageComplete('A', matches) && isGroupStageComplete('B', matches);

  return (
    <div className="two-col">
      <GroupTable groupId="A" isAdmin={isAdmin} />
      <GroupTable groupId="B" isAdmin={isAdmin} />
      {isAdmin && bothDone && phase === 'group' && (
        <div className="card">
          <button onClick={startKnockoutStage}>K.O.-Runde auslosen &amp; starten</button>
        </div>
      )}
    </div>
  );
}
