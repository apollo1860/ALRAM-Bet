import { describe, expect, it } from 'vitest';
import { computeFinalPayout } from './payout';
import type { Guest, Player, Transaction } from '../types';

function player(id: string): Player {
  return { id, name: id, initialOdds: 2, baseRating: 0, currentRating: 0, eliminated: false };
}

function deposit(playerId: string, amount: number): Transaction {
  return { id: `${playerId}-${amount}`, playerId, type: 'deposit', amount, createdAt: Date.now() };
}

describe('computeFinalPayout', () => {
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
