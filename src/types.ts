export type GroupId = 'A' | 'B';

export interface Player {
  id: string;
  name: string;
  group: GroupId;
  /** Decimal odds for overall tournament win, as entered by the admin before the tournament. */
  initialOdds: number;
  /** log-odds rating derived from initialOdds, fixed for the whole tournament. */
  baseRating: number;
  /** log-odds rating that moves as results come in ("form"). */
  currentRating: number;
  eliminated: boolean;
}

export type MatchStage = 'group' | 'qf' | 'sf' | 'final';

export interface Match {
  id: string;
  stage: MatchStage;
  groupId?: GroupId;
  /** Slot label used to wire bracket winners into the next round, e.g. "QF1". */
  slot?: string;
  playerAId: string | null;
  playerBId: string | null;
  /** Slots this match's winner feeds into, e.g. { winnerTo: 'SF1', asSlot: 'A' } */
  winnerTo?: { matchSlot: string; as: 'A' | 'B' };
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

export type Phase = 'setup' | 'group' | 'knockout' | 'done';

/**
 * The slice of app state that's shared across devices in a multi-device
 * room. Deliberately excludes activePlayerId, which stays local to each
 * device - it's "who is holding this phone right now", not shared state.
 */
export interface SyncedState {
  players: Player[];
  matches: Match[];
  wallets: Record<string, number>;
  transactions: Transaction[];
  bets: Bet[];
  phase: Phase;
}
