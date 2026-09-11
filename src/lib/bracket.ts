import type { GroupId, Match, Player } from '../types';

/** Round-robin schedule (circle method) for one group, incl. a bye row if n is odd. */
export function roundRobinRounds(playerIds: string[]): Array<Array<[string, string]>> {
  const ids: (string | null)[] = [...playerIds];
  if (ids.length % 2 !== 0) ids.push(null);
  const n = ids.length;
  const rounds: Array<Array<[string, string]>> = [];
  const arr = [...ids];
  for (let r = 0; r < n - 1; r++) {
    const pairs: Array<[string, string]> = [];
    for (let i = 0; i < n / 2; i++) {
      const a = arr[i];
      const b = arr[n - 1 - i];
      if (a !== null && b !== null) pairs.push([a, b]);
    }
    rounds.push(pairs);
    // rotate all but the first element
    const fixed = arr[0];
    const rest = arr.slice(1);
    rest.unshift(rest.pop() as string | null);
    arr.splice(0, arr.length, fixed, ...rest);
  }
  return rounds;
}

function makeGroupMatch(groupId: GroupId, seq: number, pair: [string, string]): Match {
  return {
    id: `${groupId}${seq}`,
    stage: 'group',
    groupId,
    slot: `${groupId}${seq}`,
    playerAId: pair[0],
    playerBId: pair[1],
    winnerTo: undefined,
    scoreA: null,
    scoreB: null,
    winnerId: null,
    status: 'ready',
    fairProbA: null,
    poolA: 0,
    poolB: 0,
  };
}

/**
 * Full group-stage schedule for a single table: group A's and group B's
 * round-robin matches interleaved round-by-round (A, B, A, B, ...) instead
 * of playing out one group before the other, so whoever runs the one table
 * can just work down this list in order.
 */
export function buildTournamentSchedule(groupAIds: string[], groupBIds: string[]): Match[] {
  const roundsA = roundRobinRounds(groupAIds);
  const roundsB = roundRobinRounds(groupBIds);
  const numRounds = Math.max(roundsA.length, roundsB.length);
  const matches: Match[] = [];
  let seqA = 0;
  let seqB = 0;

  for (let r = 0; r < numRounds; r++) {
    const pairsA = roundsA[r] ?? [];
    const pairsB = roundsB[r] ?? [];
    const maxLen = Math.max(pairsA.length, pairsB.length);
    for (let i = 0; i < maxLen; i++) {
      if (pairsA[i]) matches.push(makeGroupMatch('A', ++seqA, pairsA[i]));
      if (pairsB[i]) matches.push(makeGroupMatch('B', ++seqB, pairsB[i]));
    }
  }
  return matches;
}

export interface StandingRow {
  playerId: string;
  played: number;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  diff: number;
  rank: number;
}

export function computeStandings(groupId: GroupId, players: Player[], matches: Match[]): StandingRow[] {
  const groupPlayers = players.filter((p) => p.group === groupId);
  const rows = new Map<string, StandingRow>();
  for (const p of groupPlayers) {
    rows.set(p.id, {
      playerId: p.id,
      played: 0,
      wins: 0,
      losses: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      diff: 0,
      rank: 0,
    });
  }
  for (const m of matches) {
    if (m.stage !== 'group' || m.groupId !== groupId || m.status !== 'finished') continue;
    if (!m.playerAId || !m.playerBId || m.scoreA === null || m.scoreB === null) continue;
    const rowA = rows.get(m.playerAId);
    const rowB = rows.get(m.playerBId);
    if (!rowA || !rowB) continue;
    rowA.played++;
    rowB.played++;
    rowA.pointsFor += m.scoreA;
    rowA.pointsAgainst += m.scoreB;
    rowB.pointsFor += m.scoreB;
    rowB.pointsAgainst += m.scoreA;
    if (m.winnerId === m.playerAId) {
      rowA.wins++;
      rowB.losses++;
    } else if (m.winnerId === m.playerBId) {
      rowB.wins++;
      rowA.losses++;
    }
  }
  const sorted = [...rows.values()].map((r) => ({ ...r, diff: r.pointsFor - r.pointsAgainst }));
  sorted.sort((a, b) => b.wins - a.wins || b.diff - a.diff || b.pointsFor - a.pointsFor);
  sorted.forEach((r, i) => (r.rank = i + 1));
  return sorted;
}

export function isGroupStageComplete(groupId: GroupId, matches: Match[]): boolean {
  const groupMatches = matches.filter((m) => m.stage === 'group' && m.groupId === groupId);
  return groupMatches.length > 0 && groupMatches.every((m) => m.status === 'finished');
}

/**
 * Crossover knockout bracket for the top 4 of each group:
 * QF1 A1-B4, QF2 A3-B2, QF3 B1-A4, QF4 B3-A2
 * Winners cross so group-1/2 seeds only meet in the final.
 */
export function buildKnockoutMatches(standingsA: StandingRow[], standingsB: StandingRow[]): Match[] {
  const a = (rank: number) => standingsA.find((r) => r.rank === rank)!.playerId;
  const b = (rank: number) => standingsB.find((r) => r.rank === rank)!.playerId;

  const blank = (id: string, slot: string, aId: string | null, bId: string | null, stage: Match['stage'], winnerTo?: Match['winnerTo']): Match => ({
    id,
    stage,
    slot,
    playerAId: aId,
    playerBId: bId,
    winnerTo,
    scoreA: null,
    scoreB: null,
    winnerId: null,
    status: aId && bId ? 'ready' : 'pending',
    fairProbA: null,
    poolA: 0,
    poolB: 0,
  });

  return [
    blank('QF1', 'QF1', a(1), b(4), 'qf', { matchSlot: 'SF1', as: 'A' }),
    blank('QF2', 'QF2', a(3), b(2), 'qf', { matchSlot: 'SF1', as: 'B' }),
    blank('QF3', 'QF3', b(1), a(4), 'qf', { matchSlot: 'SF2', as: 'A' }),
    blank('QF4', 'QF4', b(3), a(2), 'qf', { matchSlot: 'SF2', as: 'B' }),
    blank('SF1', 'SF1', null, null, 'sf', { matchSlot: 'F1', as: 'A' }),
    blank('SF2', 'SF2', null, null, 'sf', { matchSlot: 'F1', as: 'B' }),
    blank('F1', 'F1', null, null, 'final', undefined),
  ];
}
