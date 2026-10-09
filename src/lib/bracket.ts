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
