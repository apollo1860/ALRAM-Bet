import { describe, expect, it } from 'vitest';
import { poolOdds, ratingFromDecimalOdds, updateRating, winProbability } from './odds';

describe('ratingFromDecimalOdds / winProbability', () => {
  it('gives even-money odds a 50/50 win probability against each other', () => {
    const r = ratingFromDecimalOdds(2);
    expect(winProbability(r, r)).toBeCloseTo(0.5, 5);
  });

  it('gives the favorite (lower decimal odds) the higher win probability', () => {
    const favorite = ratingFromDecimalOdds(1.2);
    const underdog = ratingFromDecimalOdds(10);
    expect(winProbability(favorite, underdog)).toBeGreaterThan(0.5);
    expect(winProbability(favorite, underdog) + winProbability(underdog, favorite)).toBeCloseTo(1, 10);
  });
});

describe('updateRating', () => {
  it('raises the winner rating and lowers the loser rating by the same amount', () => {
    const a = 0;
    const b = 0;
    const aAfterWin = updateRating(a, b, 1);
    const bAfterLoss = updateRating(b, a, 0);
    expect(aAfterWin).toBeGreaterThan(a);
    expect(bAfterLoss).toBeLessThan(b);
    expect(aAfterWin).toBeCloseTo(-bAfterLoss, 10);
  });

  it('moves a heavy favorite only a little for an expected win, and a lot for an upset loss', () => {
    const favorite = 400; // big rating gap
    const underdog = -400;
    const favoriteAfterExpectedWin = updateRating(favorite, underdog, 1);
    const favoriteAfterUpsetLoss = updateRating(favorite, underdog, 0);
    expect(favoriteAfterExpectedWin - favorite).toBeLessThan(5);
    expect(favorite - favoriteAfterUpsetLoss).toBeGreaterThan(30);
  });
});

describe('poolOdds', () => {
  it('never pays out less than the stake, even on a wildly lopsided pool', () => {
    expect(poolOdds(10_000, 1, 0.5)).toBeGreaterThanOrEqual(1.01);
  });

  it('keeps the house margin: the implied payout pool is less than the total money in play', () => {
    const odds = poolOdds(100, 100, 0.5);
    // paying `odds` per coin staked on a pool of 100 should cost less than the combined 200 pool
    expect(odds * 100).toBeLessThan(200);
  });

  it('starts close to the fair odds before any real money is in the pool', () => {
    // with zero real stakes on either side, odds are driven entirely by the virtual seed liquidity,
    // which is split in proportion to the fair probability - so they should track 1/fairProb closely
    const fairProbSide = 0.8;
    const odds = poolOdds(0, 0, fairProbSide);
    expect(odds).toBeGreaterThan(1.01);
    expect(odds).toBeLessThan(1 / fairProbSide + 0.3);
  });

  it('shifts toward a pure pool split as real stakes dwarf the virtual seed', () => {
    // a huge, perfectly even real pool should land close to even money regardless of fair probability
    const odds = poolOdds(1_000_000, 1_000_000, 0.9);
    expect(odds).toBeGreaterThan(1.8);
    expect(odds).toBeLessThan(2.0);
  });
});
