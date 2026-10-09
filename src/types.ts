export interface Player {
  id: string;
  name: string;
  /** Decimal odds for overall tournament win, as entered by the admin before the tournament. */
  initialOdds: number;
  /** log-odds rating derived from initialOdds, fixed for the whole tournament. */
  baseRating: number;
  /** log-odds rating that moves as results come in ("form"). */
  currentRating: number;
  eliminated: boolean;
}

/** Someone who only bets - not part of the tournament roster, so they can bet on every match. */
export interface Guest {
  id: string;
  name: string;
}

/**
 * Round columns of the 8-player double-elimination bracket.
 * wb = winners bracket, lb = losers bracket, gf = grand final.
 */
export type MatchStage = 'wb-r1' | 'wb-r2' | 'wb-r3' | 'lb-r1' | 'lb-r2' | 'lb-r3' | 'lb-r4' | 'gf';

export interface Match {
  id: string;
  stage: MatchStage;
  /** Slot label used to wire bracket winners/losers into the next round, e.g. "WB1". */
  slot: string;
  playerAId: string | null;
  playerBId: string | null;
  /** Where this match's winner goes next, e.g. { matchSlot: 'WB5', as: 'A' }. null (not just omitted) so it serializes cleanly to Firebase, which rejects undefined values. */
  winnerTo: { matchSlot: string; as: 'A' | 'B' } | null;
  /** Where this match's loser drops to in the losers bracket - only set for winners-bracket matches. */
  loserTo: { matchSlot: string; as: 'A' | 'B' } | null;
  scoreA: number | null;
  scoreB: number | null;
  winnerId: string | null;
  status: 'pending' | 'ready' | 'live' | 'finished';
  /** Fair (algorithmic) win probability for player A, snapshotted when the match becomes ready. */
  fairProbA: number | null;
  poolA: number;
  poolB: number;
}

export type BetStatus = 'open' | 'won' | 'lost' | 'refunded';

export interface Bet {
  id: string;
  matchId: string;
  bettorId: string;
  pickedPlayerId: string;
  amount: number;
  oddsAtPlacement: number;
  status: BetStatus;
  payout: number | null;
  createdAt: number;
}

export interface Transaction {
  id: string;
  playerId: string;
  type: 'deposit' | 'bet' | 'payout' | 'refund';
  amount: number;
  createdAt: number;
  note?: string;
}

export type Phase = 'setup' | 'knockout' | 'done';

/**
 * The slice of app state that's shared across devices in a multi-device
 * room. Deliberately excludes activePlayerId, which stays local to each
 * device - it's "who is holding this phone right now", not shared state.
 */
export interface SyncedState {
  players: Player[];
  /** Guests who only bet, never play - added on demand, not part of the fixed roster. */
  guests: Guest[];
  /** Which fixed player sits in each of the 8 bracket slots, in draw order - editable by the admin until the bracket is started. */
  seedSlots: string[];
  matches: Match[];
  wallets: Record<string, number>;
  transactions: Transaction[];
  bets: Bet[];
  phase: Phase;
}
