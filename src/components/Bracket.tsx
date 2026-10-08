import { useState } from 'react';
import { useStore } from '../store/useStore';
import { playerName } from '../lib/format';
import type { Match, MatchStage } from '../types';

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

function PlayerLine({ name, isWinner, isDone }: { name: string; isWinner: boolean; isDone: boolean }) {
  return (
    <div className={`bracket-player ${isDone && !isWinner ? 'bracket-player-lost' : ''}`}>
      {name}
      {isWinner && ' 🏆'}
    </div>
  );
}

function MatchCard({ match, isAdmin }: { match: Match; isAdmin: boolean }) {
  const players = useStore((s) => s.players);
  const enterMatchResult = useStore((s) => s.enterMatchResult);
  const nameA = playerName(players, match.playerAId);
  const nameB = playerName(players, match.playerBId);
  const ready = match.playerAId && match.playerBId;
  const done = match.status === 'finished';

  return (
    <div className={`bracket-match ${match.status}`}>
      <div className="bracket-slot">{match.slot}</div>
      <PlayerLine name={match.playerAId ? nameA : '—'} isWinner={done && match.winnerId === match.playerAId} isDone={done} />
      <PlayerLine name={match.playerBId ? nameB : '—'} isWinner={done && match.winnerId === match.playerBId} isDone={done} />
      {done ? (
        <div className="bracket-score">
          {match.scoreA}:{match.scoreB}
        </div>
      ) : ready && isAdmin ? (
        <ResultForm onSubmit={(a, b) => enterMatchResult(match.id, a, b)} />
      ) : (
        <div className="hint">{ready ? 'offen' : 'wartet auf Gegner'}</div>
      )}
    </div>
  );
}

function Round({ title, stage, matches, isAdmin }: { title: string; stage: MatchStage; matches: Match[]; isAdmin: boolean }) {
  if (matches.length === 0) return null;
  return (
    <div className={`bracket-round ${stage === 'gf' ? 'bracket-round-gf' : ''}`}>
      <h3>{title}</h3>
      {matches.map((m) => (
        <MatchCard key={m.id} match={m} isAdmin={isAdmin} />
      ))}
    </div>
  );
}

const ROUND_TITLES: Record<MatchStage, string> = {
  'wb-r1': 'Gewinner R1',
  'wb-r2': 'Gewinner HF',
  'wb-r3': 'Gewinner Finale',
  'lb-r1': 'Verlierer R1',
  'lb-r2': 'Verlierer R2',
  'lb-r3': 'Verlierer HF',
  'lb-r4': 'Verlierer Finale',
  gf: 'Grand Final',
};

const ROUND_ORDER: MatchStage[] = ['wb-r1', 'wb-r2', 'wb-r3', 'lb-r1', 'lb-r2', 'lb-r3', 'lb-r4', 'gf'];

export function Bracket({ isAdmin }: { isAdmin: boolean }) {
  const matches = useStore((s) => s.matches);
  const phase = useStore((s) => s.phase);

  if (phase === 'setup') {
    return <p className="hint">Die Bracket-Auslosung läuft noch im Setup-Schritt oben in diesem Tab.</p>;
  }

  const byStage = (stage: MatchStage) =>
    matches.filter((m) => m.stage === stage && (stage !== 'gf' || m.slot === 'GF1' || m.playerAId));

  return (
    <div className="bracket-scroll">
      <div className="bracket">
        {ROUND_ORDER.map((stage) => (
          <Round key={stage} title={ROUND_TITLES[stage]} stage={stage} matches={byStage(stage)} isAdmin={isAdmin} />
        ))}
      </div>
    </div>
  );
}
