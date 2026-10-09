import { describe, expect, it } from 'vitest';
import { computeFinalPayout, formatResultSummary } from './payout';
import type { Guest, Match, Player, Transaction } from '../types';

function player(id: string): Player {
  return { id, name: id, initialOdds: 2, baseRating: 0, currentRating: 0, eliminated: false };
}

function deposit(playerId: string, amount: number): Transaction {
  return { id: `${playerId}-${amount}`, playerId, type: 'deposit', amount, createdAt: Date.now() };
}

function finishedMatch(slot: string, winnerId: string, loserId: string): Match {
  return {
    id: slot,
    stage: slot === 'GF1' ? 'gf' : 'lb-r4',
    slot,
    playerAId: winnerId,
    playerBId: loserId,
    winnerTo: null,
    loserTo: null,
    scoreA: 3,
    scoreB: 0,
    winnerId,
    status: 'finished',
    fairProbA: 0.6,
    preMatchRatingA: 0,
    preMatchRatingB: 0,
    poolA: 0,
    poolB: 0,
  };
}

describe('computeFinalPayout', () => {
  it('rounds a stray fractional wallet value to a whole coin before splitting the pot', () => {
    const players = [player('a'), player('b')];
    const transactions = [deposit('a', 10), deposit('b', 10)];
    const wallets = { a: 12.7, b: 7.3 };

    const { rows } = computeFinalPayout(players, [], wallets, transactions);
    expect(rows.find((r) => r.playerId === 'a')?.finalCoins).toBe(13);
    expect(rows.find((r) => r.playerId === 'b')?.finalCoins).toBe(7);
  });

  it('always pays out exactly the total deposited pot, never more', () => {
    const players = [player('a'), player('b'), player('c')];
    const transactions = [deposit('a', 10), deposit('b', 20), deposit('c', 33)];
    // coin balances that don't divide evenly, to exercise the largest-remainder rounding
    const wallets = { a: 17, b: 5, c: 41 };

    const { totalPot, rows } = computeFinalPayout(players, [], wallets, transactions);
    expect(totalPot).toBe(63);
    const sum = rows.reduce((acc, r) => acc + r.payout, 0);
    expect(sum).toBe(totalPot);
    for (const r of rows) {
      expect(Number.isInteger(r.payout)).toBe(true);
      expect(r.payout).toBeGreaterThanOrEqual(0);
    }
  });

  it('splits the pot evenly when nobody has any coins left', () => {
    const players = [player('a'), player('b')];
    const transactions = [deposit('a', 10), deposit('b', 10)];
    const wallets = { a: 0, b: 0 };

    const { totalPot, rows } = computeFinalPayout(players, [], wallets, transactions);
    expect(totalPot).toBe(20);
    expect(rows.reduce((acc, r) => acc + r.payout, 0)).toBe(20);
    expect(rows.find((r) => r.playerId === 'a')?.payout).toBe(10);
    expect(rows.find((r) => r.playerId === 'b')?.payout).toBe(10);
  });

  it('includes guests in the pot and the payout, alongside tournament players', () => {
    const players = [player('a')];
    const guests: Guest[] = [{ id: 'guest-1', name: 'Tim' }];
    const transactions = [deposit('a', 50), deposit('guest-1', 50)];
    const wallets = { a: 0, 'guest-1': 100 };

    const { totalPot, rows } = computeFinalPayout(players, guests, wallets, transactions);
    expect(totalPot).toBe(100);
    expect(rows.find((r) => r.playerId === 'guest-1')?.payout).toBe(100);
    expect(rows.find((r) => r.playerId === 'a')?.payout).toBe(0);
  });

  it('ignores deposits attributed to an id outside the settled group', () => {
    const players = [player('a')];
    const transactions = [deposit('a', 10), deposit('someone-who-left', 999)];
    const wallets = { a: 5 };

    const { totalPot } = computeFinalPayout(players, [], wallets, transactions);
    expect(totalPot).toBe(10);
  });
});

describe('formatResultSummary', () => {
  it('labels it a "Zwischenstand" before there is a champion, and still lists the payout table', () => {
    const players = [player('a'), player('b')];
    const transactions = [deposit('a', 10), deposit('b', 10)];
    const wallets = { a: 15, b: 5 };

    const text = formatResultSummary(players, [], [], wallets, transactions);
    expect(text).toContain('Zwischenstand');
    expect(text).not.toContain('Endergebnis');
    expect(text).toContain('a:');
    expect(text).toContain('b:');
  });

  it('labels it "Endergebnis" and lists placements once a champion is decided', () => {
    const players = [player('a'), player('b')];
    const transactions = [deposit('a', 10), deposit('b', 10)];
    const wallets = { a: 20, b: 0 };
    // GF1 won outright by the slot-A (undefeated winners-bracket) side is enough for getChampion() to resolve
    const matches: Match[] = [finishedMatch('GF1', 'a', 'b')];

    const text = formatResultSummary(players, [], matches, wallets, transactions);
    expect(text).toContain('Endergebnis');
    expect(text).toContain('Platzierungen');
    expect(text).toContain('🥇 a');
  });

  it('always sums the payout lines to the total pot, matching computeFinalPayout', () => {
    const players = [player('a'), player('b'), player('c')];
    const transactions = [deposit('a', 7), deposit('b', 13), deposit('c', 5)];
    const wallets = { a: 9, b: 2, c: 14 };

    const { totalPot, rows } = computeFinalPayout(players, [], wallets, transactions);
    const text = formatResultSummary(players, [], [], wallets, transactions);
    for (const row of rows) {
      expect(text).toContain(`${row.playerId}: `);
    }
    expect(text).toContain(`${totalPot} €`);
  });
});
