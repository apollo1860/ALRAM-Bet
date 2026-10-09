import type { Match, MatchStage } from '../types';

/** Sentinel "player id" for an empty bracket slot nobody fills - a bye. Flows through
 *  the same winner/loser propagation as a real id so byes cascade automatically. */
export const BYE = 'BYE';

function makeMatch(
  slot: string,
  stage: MatchStage,
  aId: string | null,
  bId: string | null,
  winnerTo: Match['winnerTo'],
  loserTo: Match['loserTo']
): Match {
  return {
    id: slot,
    stage,
    slot,
    playerAId: aId,
    playerBId: bId,
    winnerTo,
    loserTo,
    scoreA: null,
    scoreB: null,
    winnerId: null,
    status: aId && bId ? 'ready' : 'pending',
    fairProbA: null,
    preMatchRatingA: null,
    preMatchRatingB: null,
    poolA: 0,
    poolB: 0,
  };
}

/** Push a finished match's winner into the next bracket slot it feeds. */
export function propagateWinner(matches: Match[], finished: Match): Match[] {
  if (!finished.winnerTo || !finished.winnerId) return matches;
  const { matchSlot, as } = finished.winnerTo;
  return matches.map((m) => {
    if (m.slot !== matchSlot) return m;
    const patch = as === 'A' ? { playerAId: finished.winnerId } : { playerBId: finished.winnerId };
    const merged = { ...m, ...patch };
    const bothFilled = !!merged.playerAId && !!merged.playerBId;
    return { ...merged, status: bothFilled ? ('ready' as const) : m.status };
  });
}

/** Push a finished winners-bracket match's loser down into its losers-bracket slot. */
export function propagateLoser(matches: Match[], finished: Match): Match[] {
  if (!finished.loserTo || !finished.winnerId) return matches;
  const loserId = finished.winnerId === finished.playerAId ? finished.playerBId : finished.playerAId;
  if (!loserId) return matches;
  const { matchSlot, as } = finished.loserTo;
  return matches.map((m) => {
    if (m.slot !== matchSlot) return m;
    const patch = as === 'A' ? { playerAId: loserId } : { playerBId: loserId };
    const merged = { ...m, ...patch };
    const bothFilled = !!merged.playerAId && !!merged.playerBId;
    return { ...merged, status: bothFilled ? ('ready' as const) : m.status };
  });
}

/**
 * Auto-resolve every match that ended up with one real player and a BYE in
 * the other slot: the real player advances without playing, and that
 * "result" is propagated onward exactly like a normal win/loss (including
 * the BYE itself cascading further if it lands in another match's slot).
 * Safe to call unconditionally - a no-op when there's no bye in play.
 */
export function settleByes(matches: Match[]): Match[] {
  let current = matches;
  let changed = true;
  while (changed) {
    changed = false;
    for (const m of current) {
      if (m.status === 'finished') continue;
      const aIsBye = m.playerAId === BYE;
      const bIsBye = m.playerBId === BYE;
      if (!aIsBye && !bIsBye) continue;
      const realId = aIsBye ? m.playerBId : m.playerAId;
      if (!realId) continue; // the bye side is known, but the real side hasn't been decided yet
      const finished: Match = { ...m, winnerId: realId, status: 'finished' };
      current = current.map((mm) => (mm.id === m.id ? finished : mm));
      current = propagateWinner(current, finished);
      current = propagateLoser(current, finished);
      changed = true;
      break; // matches changed underneath the loop - rescan from the top
    }
  }
  return current;
}

/**
 * Standard 8-slot double-elimination bracket. `seedSlots` is the admin's
 * manual draw order (position 1..8, using BYE for an empty slot when there
 * are fewer than 8 real players); WB round 1 pairs them 1v2, 3v4, 5v6, 7v8.
 * Losers of the winners bracket (WB) drop into the losers bracket (LB);
 * losing in the LB eliminates you outright, since by construction you can
 * only reach the LB after one loss already. The grand final (GF1) pits the
 * undefeated WB champion against the LB champion; if the LB champion wins,
 * a second decisive match (GF2) is required, since the WB champion would
 * otherwise be out after a single loss - that activation is handled in the
 * store, not here, so GF2 starts empty. Any bye is resolved immediately so
 * nobody sees a "match" they were never meant to play.
 */
export function buildDoubleEliminationBracket(seedSlots: string[]): Match[] {
  const [s1, s2, s3, s4, s5, s6, s7, s8] = seedSlots;

  const matches = [
    // Winners bracket, round 1
    makeMatch('WB1', 'wb-r1', s1, s2, { matchSlot: 'WB5', as: 'A' }, { matchSlot: 'LB1', as: 'A' }),
    makeMatch('WB2', 'wb-r1', s3, s4, { matchSlot: 'WB5', as: 'B' }, { matchSlot: 'LB1', as: 'B' }),
    makeMatch('WB3', 'wb-r1', s5, s6, { matchSlot: 'WB6', as: 'A' }, { matchSlot: 'LB2', as: 'A' }),
    makeMatch('WB4', 'wb-r1', s7, s8, { matchSlot: 'WB6', as: 'B' }, { matchSlot: 'LB2', as: 'B' }),

    // Winners bracket semis
    makeMatch('WB5', 'wb-r2', null, null, { matchSlot: 'WB7', as: 'A' }, { matchSlot: 'LB3', as: 'B' }),
    makeMatch('WB6', 'wb-r2', null, null, { matchSlot: 'WB7', as: 'B' }, { matchSlot: 'LB4', as: 'B' }),

    // Winners bracket final
    makeMatch('WB7', 'wb-r3', null, null, { matchSlot: 'GF1', as: 'A' }, { matchSlot: 'LB6', as: 'B' }),

    // Losers bracket, round 1 (WB round-1 losers meet each other)
    makeMatch('LB1', 'lb-r1', null, null, { matchSlot: 'LB3', as: 'A' }, null),
    makeMatch('LB2', 'lb-r1', null, null, { matchSlot: 'LB4', as: 'A' }, null),

    // Losers bracket, round 2 (round-1 LB winners meet the WB semi losers)
    makeMatch('LB3', 'lb-r2', null, null, { matchSlot: 'LB5', as: 'A' }, null),
    makeMatch('LB4', 'lb-r2', null, null, { matchSlot: 'LB5', as: 'B' }, null),

    // Losers bracket semifinal
    makeMatch('LB5', 'lb-r3', null, null, { matchSlot: 'LB6', as: 'A' }, null),

    // Losers bracket final (meets the WB final loser)
    makeMatch('LB6', 'lb-r4', null, null, { matchSlot: 'GF1', as: 'B' }, null),

    // Grand final - GF2 (bracket reset) is only populated if the LB side wins GF1; see store.
    makeMatch('GF1', 'gf', null, null, null, null),
    makeMatch('GF2', 'gf', null, null, null, null),
  ];

  return settleByes(matches);
}

/** True for any winners-bracket round: losing there drops you to the LB instead of eliminating you. */
export function isWinnersBracketStage(stage: MatchStage): boolean {
  return stage === 'wb-r1' || stage === 'wb-r2' || stage === 'wb-r3';
}

/** The tournament winner, if decided: GF2's winner if it was played, otherwise GF1's winner when the undefeated (slot A) side took it outright. */
export function getChampion(matches: Match[]): string | null {
  const gf2 = matches.find((m) => m.slot === 'GF2');
  if (gf2?.status === 'finished') return gf2.winnerId;
  const gf1 = matches.find((m) => m.slot === 'GF1');
  if (gf1?.status === 'finished' && gf1.winnerId === gf1.playerAId) return gf1.winnerId;
  return null;
}

export interface PlacementRow {
  place: number;
  playerId: string;
}

/** Fixed placement tier per losers-bracket slot: losing there is a player's
 *  final result, so the slot alone determines the rank. A bye just means
 *  one tier's tied group has one less player in it - the tier numbers
 *  themselves never change. */
const PLACEMENT_BY_SLOT: Record<string, number> = {
  LB6: 3,
  LB5: 4,
  LB3: 5,
  LB4: 5,
  LB1: 7,
  LB2: 7,
};

/**
 * Final standings, filled in as soon as each result is determined - most
 * placements (3rd through 7th) are known well before the grand final, since
 * they're decided by losers-bracket matches earlier in the bracket. 1st and
 * 2nd only appear once the title is actually decided (which, with a bracket
 * reset, might take a second grand-final match).
 */
export function computePlacements(matches: Match[]): PlacementRow[] {
  const rows: PlacementRow[] = [];

  const champion = getChampion(matches);
  if (champion) {
    rows.push({ place: 1, playerId: champion });
    const gf2 = matches.find((m) => m.slot === 'GF2');
    const decidingGF = gf2?.status === 'finished' ? gf2 : matches.find((m) => m.slot === 'GF1');
    if (decidingGF?.winnerId) {
      const runnerUp = decidingGF.winnerId === decidingGF.playerAId ? decidingGF.playerBId : decidingGF.playerAId;
      if (runnerUp) rows.push({ place: 2, playerId: runnerUp });
    }
  }

  for (const [slot, place] of Object.entries(PLACEMENT_BY_SLOT)) {
    const m = matches.find((mm) => mm.slot === slot);
    if (m?.status !== 'finished' || !m.winnerId) continue;
    const loser = m.winnerId === m.playerAId ? m.playerBId : m.playerAId;
    if (loser && loser !== BYE) rows.push({ place, playerId: loser });
  }

  return rows.sort((a, b) => a.place - b.place);
}

/** True once a match the result flowed into has itself been locked in some way -
 *  played, started, or already has real money riding on it - so undoing the
 *  original result would orphan that state instead of cleanly rewinding it. */
function isLockedBy(matches: Match[], slot: string): boolean {
  const m = matches.find((mm) => mm.slot === slot);
  if (!m) return false;
  return m.status === 'live' || m.status === 'finished' || m.poolA > 0 || m.poolB > 0;
}

/**
 * Whether a human-entered result can still be corrected: only true for a
 * finished, non-bye match whose winner and loser haven't been able to do
 * anything yet because of it - nobody has started or finished the next match
 * either of them dropped into, and nobody has bet on it. Byes aren't real
 * results, so there's nothing to correct there - the draw itself would need
 * to change instead.
 */
export function canCorrectMatch(matches: Match[], matchId: string): boolean {
  const m = matches.find((mm) => mm.id === matchId);
  if (!m || m.status !== 'finished' || !m.winnerId) return false;
  if (m.playerAId === BYE || m.playerBId === BYE) return false;
  if (m.winnerTo && isLockedBy(matches, m.winnerTo.matchSlot)) return false;
  if (m.loserTo && isLockedBy(matches, m.loserTo.matchSlot)) return false;
  if (m.slot === 'GF1' && isLockedBy(matches, 'GF2')) return false;
  return true;
}

/** Remove whatever this match's result pushed into a downstream slot, putting that slot back to pending. */
function clearPropagatedSlot(matches: Match[], target: Match['winnerTo'], expectedId: string | null): Match[] {
  if (!target || !expectedId) return matches;
  return matches.map((m) => {
    if (m.slot !== target.matchSlot) return m;
    const field = target.as === 'A' ? 'playerAId' : 'playerBId';
    if (m[field] !== expectedId) return m;
    return { ...m, [field]: null, status: 'pending' as const };
  });
}

/**
 * Undo a finished match's result, assuming canCorrectMatch(matches, matchId)
 * is true - callers must check that first. Restores the match itself to
 * 'ready' for re-entry, clears whatever it pushed downstream (including a
 * grand-final reset it may have triggered), and reports who needs their
 * rating/elimination state rolled back so the store can apply that too.
 */
export function revertMatchResult(
  matches: Match[],
  matchId: string
): { matches: Match[]; winnerId: string; loserId: string } | null {
  const m = matches.find((mm) => mm.id === matchId);
  if (!m || !m.winnerId || !m.playerAId || !m.playerBId) return null;
  const loserId = m.winnerId === m.playerAId ? m.playerBId : m.playerAId;

  let updated = matches.map((mm) =>
    mm.id === matchId ? { ...mm, scoreA: null, scoreB: null, winnerId: null, status: 'ready' as const } : mm
  );
  updated = clearPropagatedSlot(updated, m.winnerTo, m.winnerId);
  updated = clearPropagatedSlot(updated, m.loserTo, loserId);
  if (m.slot === 'GF1') {
    updated = updated.map((mm) => (mm.slot === 'GF2' ? { ...mm, playerAId: null, playerBId: null, status: 'pending' as const } : mm));
  }

  return { matches: updated, winnerId: m.winnerId, loserId };
}
