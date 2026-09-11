/**
 * Rating & odds engine.
 *
 * Model: every player has a log-odds ("Elo-like") rating. The rating derived
 * from the admin-entered pre-tournament title odds is the *base* rating and
 * never changes. A *current* rating starts equal to the base rating and
 * shifts after every finished match (win -> up, loss -> down), so a player's
 * match odds reflect both who they're facing and their form so far.
 *
 * Win probability between two ratings uses the standard logistic (Elo) curve.
 * Payout odds for a live bet use a pari-mutuel pool: everyone's stakes on a
 * match go into one pot per outcome, and payout odds are pot-implied, not
 * fixed - they move as people bet. The fair/algorithmic probability is only
 * used to seed the *opening* odds before any money is in the pool.
 */

const RATING_SCALE = 400; // same convention as chess Elo, purely a scale choice
const HOUSE_MARGIN = 0.05; // 5% overround kept by "the house" on pari-mutuel payouts
const K_FACTOR = 40; // how much one result moves a player's current rating

/** Clamp a probability away from 0/1 so log-odds stay finite. */
function clampProb(p: number): number {
  return Math.min(0.98, Math.max(0.02, p));
}

/** Convert admin-entered decimal odds (e.g. 2.5) into a log-odds rating. */
export function ratingFromDecimalOdds(decimalOdds: number): number {
  const p = clampProb(1 / decimalOdds);
  return RATING_SCALE * Math.log10(p / (1 - p));
}

/** Probability that a player with ratingA beats a player with ratingB. */
export function winProbability(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / RATING_SCALE));
}

/** Convert a probability to fair decimal odds (no margin). */
export function probToDecimalOdds(p: number): number {
  return 1 / clampProb(p);
}

/**
 * New current rating for a player after a match result.
 * actualScore is 1 for a win, 0 for a loss.
 */
export function updateRating(
  currentRating: number,
  opponentRating: number,
  actualScore: 0 | 1
): number {
  const expected = winProbability(currentRating, opponentRating);
  return currentRating + K_FACTOR * (actualScore - expected);
}

/**
 * Pari-mutuel payout odds for one side of a match, given both pools.
 * Falls back to the fair algorithmic odds while a pool is still empty.
 */
export function poolOdds(
  poolForSide: number,
  poolForOtherSide: number,
  fairProbForSide: number
): number {
  const totalPool = poolForSide + poolForOtherSide;
  if (totalPool <= 0) {
    return roundOdds(probToDecimalOdds(fairProbForSide));
  }
  if (poolForSide <= 0) {
    // nobody has backed this side yet: cap generously instead of returning Infinity
    return roundOdds(Math.max(probToDecimalOdds(fairProbForSide), 20));
  }
  const payoutPool = totalPool * (1 - HOUSE_MARGIN);
  // never let a winning bet pay out less than the stake, even in a lopsided pool
  return roundOdds(Math.max(payoutPool / poolForSide, 1.01));
}

function roundOdds(odds: number): number {
  return Math.round(odds * 100) / 100;
}
