import { useState } from 'react';
import { useStore } from '../store/useStore';
import { BYE, canCorrectMatch, computePlacements } from '../lib/bracket';
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
  const matches = useStore((s) => s.matches);
  const enterMatchResult = useStore((s) => s.enterMatchResult);
  const correctMatchResult = useStore((s) => s.correctMatchResult);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nameA = playerName(players, match.playerAId);
  const nameB = playerName(players, match.playerBId);
  const ready = match.playerAId && match.playerBId;
  const done = match.status === 'finished';
  const isBye = match.playerAId === BYE || match.playerBId === BYE;
  const correctable = isAdmin && done && !isBye && canCorrectMatch(matches, match.id);

  return (
    <div className={`bracket-match ${match.status}`}>
      <div className="bracket-slot">{match.slot}</div>
      <PlayerLine name={match.playerAId ? nameA : '—'} isWinner={done && match.winnerId === match.playerAId} isDone={done} />
      <PlayerLine name={match.playerBId ? nameB : '—'} isWinner={done && match.winnerId === match.playerBId} isDone={done} />
      {done ? (
        <div className="bracket-score">{isBye ? 'Freilos' : `${match.scoreA}:${match.scoreB}`}</div>
      ) : ready && isAdmin ? (
        <ResultForm onSubmit={(a, b) => enterMatchResult(match.id, a, b)} />
      ) : (
        <div className="hint">{ready ? 'offen' : 'wartet auf Gegner'}</div>
      )}

      {correctable && !confirming && (
        <button className="button-secondary correct-result-btn" onClick={() => setConfirming(true)}>
          ✏️ Ergebnis korrigieren
        </button>
      )}
      {correctable && confirming && (
        <div className="correct-result-confirm">
          <p className="hint">Sicher? Schon ausgezahlte Wetten auf dieses Spiel werden zurückgesetzt.</p>
          <div className="button-col">
            <button
              className="danger"
              onClick={() => {
                const err = correctMatchResult(match.id);
                if (err) setError(err);
                setConfirming(false);
              }}
            >
              Ja, zurücksetzen
            </button>
            <button className="button-secondary" onClick={() => setConfirming(false)}>
              Abbrechen
            </button>
          </div>
        </div>
      )}
      {error && <p className="error">{error}</p>}
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
  'wb-r1': 'Runde 1',
  'wb-r2': 'Halbfinale',
  'wb-r3': 'Finale',
  'lb-r1': 'Runde 1',
  'lb-r2': 'Runde 2',
  'lb-r3': 'Halbfinale',
  'lb-r4': 'Finale',
  gf: 'Grand Final',
};

const WB_STAGES: MatchStage[] = ['wb-r1', 'wb-r2', 'wb-r3'];
const LB_STAGES: MatchStage[] = ['lb-r1', 'lb-r2', 'lb-r3', 'lb-r4'];
const GF_STAGES: MatchStage[] = ['gf'];

function BracketSection({
  title,
  icon,
  variant,
  stages,
  byStage,
  isAdmin,
}: {
  title: string;
  icon: string;
  variant: 'wb' | 'lb' | 'gf';
  stages: MatchStage[];
  byStage: (stage: MatchStage) => Match[];
  isAdmin: boolean;
}) {
  const rounds = stages.map((stage) => ({ stage, matches: byStage(stage) })).filter((r) => r.matches.length > 0);
  if (rounds.length === 0) return null;
  return (
    <section className={`bracket-section bracket-section-${variant}`}>
      <h2 className="bracket-section-title">
        {icon} {title}
      </h2>
      <div className="bracket-scroll">
        <div className="bracket">
          {rounds.map(({ stage, matches }) => (
            <Round key={stage} title={ROUND_TITLES[stage]} stage={stage} matches={matches} isAdmin={isAdmin} />
          ))}
        </div>
      </div>
    </section>
  );
}

function PlacementList({ matches }: { matches: Match[] }) {
  const players = useStore((s) => s.players);
  const rows = computePlacements(matches);
  if (rows.length === 0) return null;

  return (
    <section className="bracket-section">
      <h2 className="bracket-section-title placement-title">🏅 Platzierungen</h2>
      <p className="hint">Wird laufend aktualisiert, sobald eine Platzierung feststeht.</p>
      <div className="placement-list">
        {rows.map((row) => (
          <div key={row.playerId} className="placement-row">
            <span className="placement-rank">{row.place}.</span>
            <span className="placement-name">{playerName(players, row.playerId)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

export function Bracket({ isAdmin }: { isAdmin: boolean }) {
  const matches = useStore((s) => s.matches);
  const phase = useStore((s) => s.phase);

  if (phase === 'setup') {
    return <p className="hint">Die Bracket-Auslosung läuft noch im Setup-Schritt oben in diesem Tab.</p>;
  }

  const byStage = (stage: MatchStage) =>
    matches.filter((m) => m.stage === stage && (stage !== 'gf' || m.slot === 'GF1' || m.playerAId));

  return (
    <>
      <BracketSection title="Gewinner-Bracket" icon="🏆" variant="wb" stages={WB_STAGES} byStage={byStage} isAdmin={isAdmin} />
      <BracketSection title="Verlierer-Bracket" icon="🔁" variant="lb" stages={LB_STAGES} byStage={byStage} isAdmin={isAdmin} />
      <BracketSection title="Grand Final" icon="👑" variant="gf" stages={GF_STAGES} byStage={byStage} isAdmin={isAdmin} />
      <PlacementList matches={matches} />
    </>
  );
}
