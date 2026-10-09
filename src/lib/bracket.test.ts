import { describe, expect, it } from 'vitest';
import {
  BYE,
  buildDoubleEliminationBracket,
  canCorrectMatch,
  computePlacements,
  propagateLoser,
  propagateWinner,
  revertMatchResult,
  settleByes,
} from './bracket';
import type { Match } from '../types';

const SEVEN_PLUS_BYE = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', BYE];

function finishMatch(matches: Match[], id: string, winnerId: string): Match[] {
  const m = matches.find((mm) => mm.id === id)!;
  const finished: Match = {
    ...m,
    winnerId,
    scoreA: winnerId === m.playerAId ? 3 : 0,
    scoreB: winnerId === m.playerAId ? 0 : 3,
    status: 'finished',
  };
  let updated = matches.map((mm) => (mm.id === id ? finished : mm));
  updated = propagateWinner(updated, finished);
  updated = propagateLoser(updated, finished);
  return settleByes(updated);
}

describe('buildDoubleEliminationBracket with a bye', () => {
  it('auto-resolves the bye match and propagates the advance, but nothing beyond that', () => {
    const matches = buildDoubleEliminationBracket(SEVEN_PLUS_BYE);
    const wb4 = matches.find((m) => m.slot === 'WB4')!;
    expect(wb4.status).toBe('finished');
    expect(wb4.winnerId).toBe('p7');

    const wb6 = matches.find((m) => m.slot === 'WB6')!;
    expect(wb6.playerBId).toBe('p7');
    expect(wb6.status).toBe('pending'); // still waiting on WB3's winner

    const lb2 = matches.find((m) => m.slot === 'LB2')!;
    expect(lb2.playerBId).toBe(BYE);
    expect(lb2.status).toBe('pending'); // still waiting on WB3's loser
  });

  it('cascades a second time once the real opponent arrives, exactly like a normal settleByes sweep', () => {
    let matches = buildDoubleEliminationBracket(SEVEN_PLUS_BYE);
    // WB3 (p5 vs p6) finishes, p6 loses and drops into LB2 alongside the BYE already sitting there
    matches = finishMatch(matches, 'WB3', 'p5');
    const lb2 = matches.find((m) => m.slot === 'LB2')!;
    expect(lb2.status).toBe('finished');
    expect(lb2.winnerId).toBe('p6'); // the only real player in a bye match always "wins" it
    const lb4 = matches.find((m) => m.slot === 'LB4')!;
    expect(lb4.playerAId).toBe('p6');
  });
});

describe('computePlacements', () => {
  it('fills in placements incrementally as losers-bracket slots finish, independent of the final', () => {
    let matches = buildDoubleEliminationBracket(SEVEN_PLUS_BYE);
    matches = finishMatch(matches, 'WB1', 'p1'); // p2 -> LB1
    matches = finishMatch(matches, 'WB2', 'p3'); // p4 -> LB1
    matches = finishMatch(matches, 'LB1', 'p2'); // p4 eliminated, now fixed at 7th/8th tier
    const placements = computePlacements(matches);
    expect(placements.find((r) => r.playerId === 'p4')?.place).toBe(7);
    // nobody else is decided yet
    expect(placements).toHaveLength(1);
  });
});

describe('canCorrectMatch / revertMatchResult', () => {
  it('allows correcting a freshly entered result with nothing played downstream yet', () => {
    let matches = buildDoubleEliminationBracket(SEVEN_PLUS_BYE);
    matches = finishMatch(matches, 'WB1', 'p1');
    expect(canCorrectMatch(matches, 'WB1')).toBe(true);
  });

  it('fully reverts the match, the winner slot, and the loser slot back to how they were before', () => {
    let matches = buildDoubleEliminationBracket(SEVEN_PLUS_BYE);
    const before = matches;
    matches = finishMatch(matches, 'WB1', 'p1');

    const reverted = revertMatchResult(matches, 'WB1')!;
    const wb1 = reverted.matches.find((m) => m.slot === 'WB1')!;
    expect(wb1.status).toBe('ready');
    expect(wb1.winnerId).toBeNull();
    expect(wb1.scoreA).toBeNull();

    const wb5 = reverted.matches.find((m) => m.slot === 'WB5')!;
    expect(wb5.playerAId).toBeNull();
    expect(wb5.status).toBe('pending');

    const lb1 = reverted.matches.find((m) => m.slot === 'LB1')!;
    expect(lb1.playerAId).toBeNull();
    expect(lb1.status).toBe('pending');

    // and the rest of the bracket is byte-for-byte identical to before WB1 was ever played
    const untouchedBefore = before.filter((m) => !['WB1', 'WB5', 'LB1'].includes(m.slot));
    const untouchedAfter = reverted.matches.filter((m) => !['WB1', 'WB5', 'LB1'].includes(m.slot));
    expect(untouchedAfter).toEqual(untouchedBefore);
  });

  it('still allows correction while the downstream match is merely ready, with no result and no bets', () => {
    let matches = buildDoubleEliminationBracket(SEVEN_PLUS_BYE);
    matches = finishMatch(matches, 'WB1', 'p1');
    matches = finishMatch(matches, 'WB2', 'p3'); // WB5 (fed by WB1 + WB2) is now 'ready'
    expect(matches.find((m) => m.slot === 'WB5')?.status).toBe('ready');
    expect(canCorrectMatch(matches, 'WB1')).toBe(true);
  });

  it('blocks correction once the downstream match has been played', () => {
    let matches = buildDoubleEliminationBracket(SEVEN_PLUS_BYE);
    matches = finishMatch(matches, 'WB1', 'p1');
    matches = finishMatch(matches, 'WB2', 'p3');
    matches = finishMatch(matches, 'WB5', 'p1'); // WB1's winner has now played again
    expect(canCorrectMatch(matches, 'WB1')).toBe(false);
  });

  it('blocks correction once money has been staked on the downstream match', () => {
    let matches = buildDoubleEliminationBracket(SEVEN_PLUS_BYE);
    matches = finishMatch(matches, 'WB1', 'p1');
    matches = finishMatch(matches, 'WB2', 'p3');
    matches = matches.map((m) => (m.slot === 'WB5' ? { ...m, poolA: 10 } : m));
    expect(canCorrectMatch(matches, 'WB1')).toBe(false);
  });

  it('refuses to correct a bye-resolved match - there was never a real result to fix', () => {
    const matches = buildDoubleEliminationBracket(SEVEN_PLUS_BYE);
    expect(matches.find((m) => m.slot === 'WB4')?.status).toBe('finished');
    expect(canCorrectMatch(matches, 'WB4')).toBe(false);
  });

  it('clears a grand-final reset (GF2) when GF1 itself is corrected', () => {
    let matches = buildDoubleEliminationBracket(SEVEN_PLUS_BYE);
    matches = matches.map((m) => (m.slot === 'GF1' ? { ...m, playerAId: 'p1', playerBId: 'p2', status: 'ready' as const } : m));
    matches = finishMatch(matches, 'GF1', 'p2'); // the losers-bracket side wins GF1 outright -> triggers a reset
    matches = matches.map((m) => (m.slot === 'GF2' ? { ...m, playerAId: 'p1', playerBId: 'p2', status: 'ready' as const } : m));

    expect(canCorrectMatch(matches, 'GF1')).toBe(true);
    const reverted = revertMatchResult(matches, 'GF1')!;
    const gf2 = reverted.matches.find((m) => m.slot === 'GF2')!;
    expect(gf2.playerAId).toBeNull();
    expect(gf2.playerBId).toBeNull();
    expect(gf2.status).toBe('pending');
  });

  it('blocks correcting GF1 once GF2 has actually been played', () => {
    let matches = buildDoubleEliminationBracket(SEVEN_PLUS_BYE);
    matches = matches.map((m) => (m.slot === 'GF1' ? { ...m, playerAId: 'p1', playerBId: 'p2', status: 'ready' as const } : m));
    matches = finishMatch(matches, 'GF1', 'p2');
    matches = matches.map((m) => (m.slot === 'GF2' ? { ...m, playerAId: 'p1', playerBId: 'p2', status: 'ready' as const } : m));
    matches = finishMatch(matches, 'GF2', 'p1');
    expect(canCorrectMatch(matches, 'GF1')).toBe(false);
  });
});
