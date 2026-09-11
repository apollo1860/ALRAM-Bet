import { useState } from 'react';
import { useStore } from '../store/useStore';
import { computeStandings, isGroupStageComplete } from '../lib/bracket';
import { playerName } from '../lib/format';
import type { GroupId, Match } from '../types';

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

function Schedule({ isAdmin }: { isAdmin: boolean }) {
  const players = useStore((s) => s.players);
  const matches = useStore((s) => s.matches);
  const enterGroupResult = useStore((s) => s.enterGroupResult);
  const groupMatches = matches.filter((m): m is Match => m.stage === 'group');
  const nextMatchId = groupMatches.find((m) => m.status !== 'finished')?.id;

  return (
    <div className="card">
      <h3>Spielplan (eine Platte)</h3>
      <p className="hint">
        Gruppe A und Gruppe B wechseln sich ab, damit an einer Platte immer klar ist, wer als nächstes spielt.
      </p>
      <table className="table matches-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Gruppe</th>
            <th>Paarung</th>
            <th>Ergebnis</th>
          </tr>
        </thead>
        <tbody>
          {groupMatches.map((m, i) => (
            <tr key={m.id} className={m.id === nextMatchId ? 'qualified' : undefined}>
              <td>{i + 1}</td>
              <td>{m.groupId}</td>
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

function StandingsTable({ groupId }: { groupId: GroupId }) {
  const players = useStore((s) => s.players);
  const matches = useStore((s) => s.matches);
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
    <>
      <Schedule isAdmin={isAdmin} />
      <div className="two-col">
        <StandingsTable groupId="A" />
        <StandingsTable groupId="B" />
      </div>
      {isAdmin && bothDone && phase === 'group' && (
        <div className="card">
          <button onClick={startKnockoutStage}>K.O.-Runde auslosen &amp; starten</button>
        </div>
      )}
    </>
  );
}
