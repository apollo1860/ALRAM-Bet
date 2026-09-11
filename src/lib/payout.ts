import type { Player, Transaction } from '../types';

export interface PayoutRow {
  playerId: string;
  deposited: number;
  finalCoins: number;
  sharePercent: number;
  payout: number;
}

/**
 * Split a whole-number pot proportionally to each weight, using the largest
 * remainder method so the individual shares always sum to exactly `total`
 * (plain floor-and-round would leave the pot a few units short or over).
 */
function apportion(weights: number[], total: number): number[] {
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const wholeTotal = Math.round(total);
  const n = weights.length;
  if (n === 0) return [];

  if (totalWeight <= 0) {
    // nobody has any coins: split the pot as evenly as whole numbers allow
    const base = Math.floor(wholeTotal / n);
    const extra = wholeTotal - base * n;
    return weights.map((_, i) => base + (i < extra ? 1 : 0));
  }

  const raw = weights.map((w) => (w / totalWeight) * wholeTotal);
  const floors = raw.map(Math.floor);
  const allocated = floors.reduce((a, b) => a + b, 0);
  const remainder = wholeTotal - allocated;
  const order = raw
    .map((r, i) => ({ i, frac: r - Math.floor(r) }))
    .sort((a, b) => b.frac - a.frac);

  const result = [...floors];
  for (let k = 0; k < remainder; k++) {
    result[order[k % order.length].i] += 1;
  }
  return result;
}

/**
 * Final settlement: everyone's real-money deposits form one pot ("die
 * Tasse"), and at the end it's split back out in proportion to each
 * player's final coin balance - how well they did across all their bets,
 * not just what they put in. Whole numbers only, and they always add up to
 * exactly the total pot.
 */
export function computeFinalPayout(
  players: Player[],
  wallets: Record<string, number>,
  transactions: Transaction[]
): { totalPot: number; rows: PayoutRow[] } {
  const deposited: Record<string, number> = {};
  for (const p of players) deposited[p.id] = 0;
  for (const t of transactions) {
    if (t.type === 'deposit' && t.playerId in deposited) deposited[t.playerId] += t.amount;
  }

  const totalPot = Object.values(deposited).reduce((a, b) => a + b, 0);
  const finalCoins = players.map((p) => Math.max(0, wallets[p.id] ?? 0));
  const totalCoins = finalCoins.reduce((a, b) => a + b, 0);
  const payouts = apportion(finalCoins, totalPot);

  const rows: PayoutRow[] = players.map((p, i) => ({
    playerId: p.id,
    deposited: deposited[p.id],
    finalCoins: finalCoins[i],
    sharePercent: totalCoins > 0 ? (finalCoins[i] / totalCoins) * 100 : 100 / players.length,
    payout: payouts[i],
  }));

  return { totalPot: Math.round(totalPot), rows };
}
