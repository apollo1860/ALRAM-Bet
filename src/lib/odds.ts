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
 * fixed - they move as people bet.
 *
 * With only a couple of bettors per match (the normal case in a small
 * friend-group tournament), a pure pool split is unstable: the first bet on
 * a side with no other money in it would collapse straight to even-money
 * odds, since there'd be nobody else's stake to pay it out of. To avoid
 * that, "the house" seeds each side with virtual liquidity proportional to
 * the algorithmic fair probability before any real money arrives; real bets
 * are added on top of that seed. Odds start at (roughly) the fair odds and
 * move smoothly as real money comes in, converging to a pure pool split
 * once real stakes dwarf the seed. The house isn't a real wallet - it's
 * just bookkeeping slack, since these are virtual coins with no shared pot
 * that has to balance to zero.
 */

const RATING_SCALE = 400; // same convention as chess Elo, purely a scale choice
const HOUSE_MARGIN = 0.05; // 5% overround kept by "the house" on pari-mutuel payouts
const K_FACTOR = 40; // how much one result moves a player's current rating
const SEED_LIQUIDITY = 300; // virtual "house" stake split across both sides per match

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
 * Pari-mutuel payout odds for one side of a match, given the real pools on
 * each side. Both pools are topped up with virtual "house" liquidity split
 * according to the fair probability before the ratio is taken - see the
 * module-level comment for why.
 */
export function poolOdds(
  poolForSide: number,
  poolForOtherSide: number,
  fairProbForSide: number
): number {
  const fair = clampProb(fairProbForSide);
  const effectiveSide = poolForSide + SEED_LIQUIDITY * fair;
  const effectiveOther = poolForOtherSide + SEED_LIQUIDITY * (1 - fair);
  const payoutPool = (effectiveSide + effectiveOther) * (1 - HOUSE_MARGIN);
  // never let a winning bet pay out less than the stake, even in a lopsided pool
  return roundOdds(Math.max(payoutPool / effectiveSide, 1.01));
}

function roundOdds(odds: number): number {
  return Math.round(odds * 100) / 100;
}
