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
  const enterKnockoutResult = useStore((s) => s.enterKnockoutResult);
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
        <ResultForm onSubmit={(a, b) => enterKnockoutResult(match.id, a, b)} />
      ) : (
        <div className="hint">{ready ? 'offen' : 'wartet auf Gegner'}</div>
      )}
    </div>
  );
}

function Round({ title, matches, isAdmin }: { title: string; matches: Match[]; isAdmin: boolean }) {
  if (matches.length === 0) return null;
  return (
    <div className="bracket-round">
      <h3>{title}</h3>
      {matches.map((m) => (
        <MatchCard key={m.id} match={m} isAdmin={isAdmin} />
      ))}
    </div>
  );
}

export function Bracket({ isAdmin }: { isAdmin: boolean }) {
  const matches = useStore((s) => s.matches);
  const phase = useStore((s) => s.phase);

  if (phase === 'setup' || phase === 'group') {
    return <p className="hint">Die K.O.-Runde wird nach der Gruppenphase aus den Plätzen 1-4 jeder Gruppe ausgelost.</p>;
  }

  const byStage = (stage: MatchStage) => matches.filter((m) => m.stage === stage);

  return (
    <div className="bracket-scroll">
      <div className="bracket">
        <Round title="Viertelfinale" matches={byStage('qf')} isAdmin={isAdmin} />
        <Round title="Halbfinale" matches={byStage('sf')} isAdmin={isAdmin} />
        <Round title="Finale" matches={byStage('final')} isAdmin={isAdmin} />
      </div>
    </div>
  );
}
