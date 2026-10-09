import { computePlacements, getChampion } from './bracket';
import { fmtCoins, fmtEuro, playerName } from './format';
import type { Guest, Match, Player, Transaction } from '../types';

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
 * person's final coin balance - how well they did across all their bets,
 * not just what they put in. Whole numbers only, and they always add up to
 * exactly the total pot. Guests deposit and bet just like tournament
 * players, so they're settled the same way - they just never appear in the
 * bracket itself.
 */
export function computeFinalPayout(
  players: Player[],
  guests: Guest[],
  wallets: Record<string, number>,
  transactions: Transaction[]
): { totalPot: number; rows: PayoutRow[] } {
  const identities: { id: string }[] = [...players, ...guests];
  const deposited: Record<string, number> = {};
  for (const p of identities) deposited[p.id] = 0;
  for (const t of transactions) {
    if (t.type === 'deposit' && t.playerId in deposited) deposited[t.playerId] += t.amount;
  }

  const totalPot = Object.values(deposited).reduce((a, b) => a + b, 0);
  const finalCoins = identities.map((p) => Math.round(Math.max(0, wallets[p.id] ?? 0)));
  const totalCoins = finalCoins.reduce((a, b) => a + b, 0);
  const payouts = apportion(finalCoins, totalPot);

  const rows: PayoutRow[] = identities.map((p, i) => ({
    playerId: p.id,
    deposited: deposited[p.id],
    finalCoins: finalCoins[i],
    sharePercent: totalCoins > 0 ? (finalCoins[i] / totalCoins) * 100 : 100 / identities.length,
    payout: payouts[i],
  }));

  return { totalPot: Math.round(totalPot), rows };
}

const PLACE_LABEL: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

/**
 * A plain-text recap of the tournament so far - placements and the payout
 * table - meant to be shared to the group chat (via the Web Share API, or
 * copied to the clipboard as a fallback). Works just as well mid-tournament
 * as at the very end: placements fill in incrementally already, and the
 * payout table is always "if it ended right now".
 */
export function formatResultSummary(
  players: Player[],
  guests: Guest[],
  matches: Match[],
  wallets: Record<string, number>,
  transactions: Transaction[]
): string {
  const isFinal = getChampion(matches) !== null;
  const placements = computePlacements(matches);
  const { totalPot, rows } = computeFinalPayout(players, guests, wallets, transactions);
  const sortedRows = [...rows].sort((a, b) => b.payout - a.payout);

  const lines: string[] = [`🏓 ALRAM BET - ${isFinal ? 'Endergebnis' : 'Zwischenstand'}`, ''];

  if (placements.length > 0) {
    lines.push('Platzierungen:');
    for (const row of placements) {
      lines.push(`${PLACE_LABEL[row.place] ?? `${row.place}.`} ${playerName(players, row.playerId, guests)}`);
    }
    lines.push('');
  }

  lines.push(`💰 Abrechnung (Gesamttopf: ${fmtEuro(totalPot)}):`);
  for (const row of sortedRows) {
    lines.push(`${playerName(players, row.playerId, guests)}: ${fmtCoins(row.finalCoins)} → ${fmtEuro(row.payout)}`);
  }

  return lines.join('\n');
}
