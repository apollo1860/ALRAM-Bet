import { useState } from 'react';
import { useStore } from '../store/useStore';
import { poolOdds } from '../lib/odds';
import { fmtCoins, fmtOdds, playerName } from '../lib/format';
import type { Match } from '../types';

function BetRow({ match, bettorId }: { match: Match; bettorId: string }) {
  const players = useStore((s) => s.players);
  const placeBet = useStore((s) => s.placeBet);
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [side, setSide] = useState<'A' | 'B'>('A');

  const fairProbA = match.fairProbA ?? 0.5;
  const oddsA = poolOdds(match.poolA, match.poolB, fairProbA);
  const oddsB = poolOdds(match.poolB, match.poolA, 1 - fairProbA);
  const isOwnMatch = bettorId === match.playerAId || bettorId === match.playerBId;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
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
        <span className="pill">{match.status === 'live' ? 'läuft' : 'offen'}</span>
      </div>
      <div className="odds-row">
        <div className={`odds-box ${side === 'A' ? 'selected' : ''}`} onClick={() => setSide('A')}>
          <div>{playerName(players, match.playerAId)}</div>
          <div className="odds-value">{fmtOdds(oddsA)}</div>
          <div className="hint">Pool: {fmtCoins(match.poolA)}</div>
        </div>
        <div className={`odds-box ${side === 'B' ? 'selected' : ''}`} onClick={() => setSide('B')}>
          <div>{playerName(players, match.playerBId)}</div>
          <div className="odds-value">{fmtOdds(oddsB)}</div>
          <div className="hint">Pool: {fmtCoins(match.poolB)}</div>
        </div>
      </div>
      {isOwnMatch ? (
        <p className="hint">Du spielst selbst in diesem Match – keine Wette möglich.</p>
      ) : match.status !== 'ready' ? (
        <p className="hint">Wetten geschlossen.</p>
      ) : (
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
    </div>
  );
}

export function Betting({ bettorId }: { bettorId: string | null }) {
  const matches = useStore((s) => s.matches);
  const open = matches.filter((m) => (m.status === 'ready' || m.status === 'live') && m.playerAId && m.playerBId);

  if (!bettorId) {
    return <p className="hint">Bitte oben einen Spieler auswählen, um Wetten platzieren zu können.</p>;
  }

  if (open.length === 0) {
    return <p className="hint">Aktuell keine offenen Spiele zum Wetten.</p>;
  }

  return (
    <div className="bet-list">
      {open.map((m) => (
        <BetRow key={m.id} match={m} bettorId={bettorId} />
      ))}
    </div>
  );
}
