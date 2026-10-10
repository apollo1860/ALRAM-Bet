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
 * The real order these rounds get played in, not grouped by bracket side -
 * winners- and losers-side rounds alternate to match how the tournament
 * actually runs match by match (losers-bracket rounds slot in as soon as
 * their feeder winners-bracket round is decided, rather than waiting for
 * the whole winners bracket to finish first).
 */
const PLAY_ORDER: { title: string; icon: string; variant: 'wb' | 'lb' | 'gf'; stage: MatchStage }[] = [
  { title: 'Runde 1 – Gewinnerseite', icon: '🏆', variant: 'wb', stage: 'wb-r1' },
  { title: 'Runde 1 – Verliererseite', icon: '🔁', variant: 'lb', stage: 'lb-r1' },
  { title: 'Halbfinale – Gewinnerseite', icon: '🏆', variant: 'wb', stage: 'wb-r2' },
  { title: 'Runde 2 – Verliererseite', icon: '🔁', variant: 'lb', stage: 'lb-r2' },
  { title: 'Halbfinale – Verliererseite', icon: '🔁', variant: 'lb', stage: 'lb-r3' },
  { title: 'Finale – Gewinnerseite', icon: '🏆', variant: 'wb', stage: 'wb-r3' },
  { title: 'Finale – Verliererseite', icon: '🔁', variant: 'lb', stage: 'lb-r4' },
  { title: 'Grand Final', icon: '👑', variant: 'gf', stage: 'gf' },
];

function BracketSection({
  title,
  icon,
  variant,
  matches,
  isAdmin,
}: {
  title: string;
  icon: string;
  variant: 'wb' | 'lb' | 'gf';
  matches: Match[];
  isAdmin: boolean;
}) {
  if (matches.length === 0) return null;
  return (
    <section className={`bracket-section bracket-section-${variant}`}>
      <h2 className="bracket-section-title">
        {icon} {title}
      </h2>
      {matches.map((m) => (
        <MatchCard key={m.id} match={m} isAdmin={isAdmin} />
      ))}
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
      {PLAY_ORDER.map((step) => (
        <BracketSection
          key={step.stage}
          title={step.title}
          icon={step.icon}
          variant={step.variant}
          matches={byStage(step.stage)}
          isAdmin={isAdmin}
        />
      ))}
      <PlacementList matches={matches} />
    </>
  );
}
