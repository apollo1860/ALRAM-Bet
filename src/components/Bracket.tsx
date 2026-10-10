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

/**
 * Fixed position of every stage in the tournament tree: which grid column it
 * sits in (columns grow to the right as the tournament progresses, so a
 * finished match's winner always appears one column over in its next slot -
 * that's the "who would I play if I win" preview) and which track it belongs
 * to (winners bracket on top, losers bracket below). Derived straight from
 * the fixed double-elimination wiring in lib/bracket.ts: a stage's column is
 * simply how many rounds - on its own track and whatever it waits on from the
 * other track - have to finish before it can be played.
 */
const WB_STAGES: { stage: MatchStage; column: number; title: string }[] = [
  { stage: 'wb-r1', column: 2, title: 'Runde 1' },
  { stage: 'wb-r2', column: 3, title: 'Halbfinale' },
  { stage: 'wb-r3', column: 4, title: 'Finale' },
];
const LB_STAGES: { stage: MatchStage; column: number; title: string }[] = [
  { stage: 'lb-r1', column: 3, title: 'Runde 1' },
  { stage: 'lb-r2', column: 4, title: 'Runde 2' },
  { stage: 'lb-r3', column: 5, title: 'Halbfinale' },
  { stage: 'lb-r4', column: 6, title: 'Finale' },
];
const GF_COLUMN = 7;

function BracketColumn({
  title,
  column,
  row,
  rowSpan,
  matches,
  isAdmin,
  variant,
}: {
  title: string;
  column: number;
  row: number;
  rowSpan?: number;
  matches: Match[];
  isAdmin: boolean;
  variant?: 'gf';
}) {
  if (matches.length === 0) return null;
  return (
    <div
      className={`bracket-col ${variant ? `bracket-col-${variant}` : ''}`}
      style={{ gridColumn: column, gridRow: rowSpan ? `${row} / span ${rowSpan}` : row }}
    >
      <h3 className="bracket-col-title">{title}</h3>
      <div className="bracket-col-matches">
        {matches.map((m) => (
          <MatchCard key={m.id} match={m} isAdmin={isAdmin} />
        ))}
      </div>
    </div>
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
      <div className="bracket-tree-wrap">
        <div className="bracket-tree">
          <div className="bracket-row-label" style={{ gridColumn: 1, gridRow: 1 }}>
            🏆 Gewinnerseite
          </div>
          <div className="bracket-row-label" style={{ gridColumn: 1, gridRow: 2 }}>
            🔁 Verliererseite
          </div>
          {WB_STAGES.map((s) => (
            <BracketColumn key={s.stage} title={s.title} column={s.column} row={1} matches={byStage(s.stage)} isAdmin={isAdmin} />
          ))}
          {LB_STAGES.map((s) => (
            <BracketColumn key={s.stage} title={s.title} column={s.column} row={2} matches={byStage(s.stage)} isAdmin={isAdmin} />
          ))}
          <BracketColumn
            title="👑 Grand Final"
            column={GF_COLUMN}
            row={1}
            rowSpan={2}
            matches={byStage('gf')}
            isAdmin={isAdmin}
            variant="gf"
          />
        </div>
      </div>
      <PlacementList matches={matches} />
    </>
  );
}
