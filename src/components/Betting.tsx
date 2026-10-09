import { useState } from 'react';
import { useStore } from '../store/useStore';
import { poolOdds } from '../lib/odds';
import { fmtCoins, fmtOdds, playerName } from '../lib/format';
import type { Match } from '../types';

function OddsBox({
  name,
  odds,
  pool,
  selected,
  onClick,
}: {
  name: string;
  odds: number;
  pool: number;
  selected?: boolean;
  onClick?: () => void;
}) {
  return (
    <div className={`odds-box ${selected ? 'selected' : ''}`} onClick={onClick}>
      <div>{name}</div>
      <div className="odds-value">{fmtOdds(odds)}</div>
      <div className="hint">Pool: {fmtCoins(pool)}</div>
    </div>
  );
}

function MatchRow({ match, bettorId, isAdmin }: { match: Match; bettorId: string | null; isAdmin: boolean }) {
  const players = useStore((s) => s.players);
  const placeBet = useStore((s) => s.placeBet);
  const lockMatch = useStore((s) => s.lockMatch);
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [side, setSide] = useState<'A' | 'B'>('A');

  const fairProbA = match.fairProbA ?? 0.5;
  const oddsA = poolOdds(match.poolA, match.poolB, fairProbA);
  const oddsB = poolOdds(match.poolB, match.poolA, 1 - fairProbA);
  const isOwnMatch = bettorId !== null && (bettorId === match.playerAId || bettorId === match.playerBId);
  const canBet = bettorId !== null && !isOwnMatch && match.status === 'ready';

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bettorId) return;
    setError(null);
    const picked = side === 'A' ? match.playerAId : match.playerBId;
    if (!picked) return;
    const err = placeBet(match.id, bettorId, picked, Number(amount));
    if (err) setError(err);
    else setAmount('');
  };

  return (
    <div className="card bet-card">
      <div className="bet-header">
        <span>
          {playerName(players, match.playerAId)} <em>vs</em> {playerName(players, match.playerBId)}
        </span>
        <span className={`pill ${match.status === 'live' ? 'live' : ''}`}>{match.status === 'live' ? 'läuft' : 'offen'}</span>
      </div>
      <div className="odds-row">
        <OddsBox
          name={playerName(players, match.playerAId)}
          odds={oddsA}
          pool={match.poolA}
          selected={canBet && side === 'A'}
          onClick={canBet ? () => setSide('A') : undefined}
        />
        <OddsBox
          name={playerName(players, match.playerBId)}
          odds={oddsB}
          pool={match.poolB}
          selected={canBet && side === 'B'}
          onClick={canBet ? () => setSide('B') : undefined}
        />
      </div>

      {bettorId !== null && isOwnMatch && <p className="hint">Du spielst selbst in diesem Match – keine Wette möglich.</p>}
      {bettorId !== null && !isOwnMatch && match.status !== 'ready' && <p className="hint">Wetten geschlossen.</p>}
      {canBet && (
        <form className="bet-form" onSubmit={submit}>
          <input
            type="number"
            min="1"
            step="1"
            placeholder="Einsatz in Coins"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <button type="submit">
            Auf {side === 'A' ? playerName(players, match.playerAId) : playerName(players, match.playerBId)} wetten
          </button>
        </form>
      )}
      {error && <p className="error">{error}</p>}

      {isAdmin && match.status === 'ready' && (
        <div className="admin-lock-row">
          <button className="button-secondary" onClick={() => lockMatch(match.id)}>
            Wetten schließen &amp; Spiel starten
          </button>
        </div>
      )}
      {isAdmin && bettorId === null && match.status !== 'ready' && (
        <p className="hint">Wetten geschlossen – Ergebnis im Gruppen- bzw. K.O.-Tab eintragen.</p>
      )}
    </div>
  );
}

export function Betting({ bettorId, isAdmin }: { bettorId: string | null; isAdmin: boolean }) {
  const matches = useStore((s) => s.matches);
  const open = matches.filter((m) => (m.status === 'ready' || m.status === 'live') && m.playerAId && m.playerBId);

  if (!bettorId && !isAdmin) {
    return <p className="hint">Bitte oben einen Spieler auswählen, um Wetten platzieren zu können.</p>;
  }

  if (open.length === 0) {
    return <p className="hint">Aktuell keine offenen Spiele zum Wetten.</p>;
  }

  return (
    <div className="bet-list">
      {open.map((m) => (
        <MatchRow key={m.id} match={m} bettorId={bettorId} isAdmin={isAdmin} />
      ))}
    </div>
  );
}
