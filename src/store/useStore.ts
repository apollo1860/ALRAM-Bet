import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Bet, Guest, Match, Message, Phase, Player, SyncedState, Transaction } from '../types';
import {
  BYE,
  buildDoubleEliminationBracket,
  canCorrectMatch,
  isWinnersBracketStage,
  propagateLoser,
  propagateWinner,
  revertMatchResult,
  settleByes,
} from '../lib/bracket';
import { poolOdds, updateRating, winProbability } from '../lib/odds';
import { buildDefaultPlayers } from './seed';
import { fmtCoins, playerName } from '../lib/format';
import { createMessage, WELCOME_TEXT } from '../lib/messages';

interface State {
  players: Player[];
  guests: Guest[];
  /** Player ids already claimed by some device in this room - see lib/roomSync.ts's claimPlayerInRoom,
   *  which writes this directly to Firebase before a device joins, for the same race-avoidance reasons
   *  guests are written there instead of through this store's normal actions. */
  claimedPlayerIds: string[];
  seedSlots: string[];
  matches: Match[];
  wallets: Record<string, number>;
  transactions: Transaction[];
  bets: Bet[];
  messages: Message[];
  activePlayerId: string | null;
  phase: Phase;

  setActivePlayer: (id: string | null) => void;
  updatePlayer: (id: string, patch: Partial<Pick<Player, 'name' | 'initialOdds'>>) => void;
  /** Mark every message addressed to this identity as read - called once the inbox is opened. */
  markMessagesRead: (recipientId: string) => void;
  setSeedSlot: (index: number, playerId: string) => void;
  /** Build the double-elimination bracket from the current seed slots. Returns an error message, or null on success. */
  startBracket: () => string | null;
  enterMatchResult: (matchId: string, scoreA: number, scoreB: number) => void;
  /** Undo an admin's typo'd result and put the match back up for re-entry. Returns an error message
   *  (nothing happens) if anything downstream has already moved on, or null on success. */
  correctMatchResult: (matchId: string) => string | null;
  lockMatch: (matchId: string) => void;
  depositCoins: (playerId: string, amount: number) => void;
  /** Admin-only: void a deposit that was entered wrong (typo'd amount, wrong person) - reverses the
   *  wallet credit and removes it from the ledger entirely, as if it never happened. Clamps at 0
   *  instead of going negative if the money's already been spent. Returns an error, or null on success. */
  cancelDeposit: (transactionId: string) => string | null;
  placeBet: (matchId: string, bettorId: string, pickedPlayerId: string, amount: number) => string | null;
  resetTournament: () => void;
  /** Replace the shared slice of state with data received from a multi-device room, leaving activePlayerId untouched. */
  applyRemoteState: (data: SyncedState) => void;
  /** Internal: settle open bets on a finished match. Not meant for UI use. */
  _resolveBetsFor: (matchId: string, winnerId: string, finishedMatch: Match) => void;
}

function initialWallets(players: Player[]): Record<string, number> {
  const w: Record<string, number> = {};
  for (const p of players) w[p.id] = 0;
  return w;
}

const BRACKET_SIZE = 8;

/** Default draw order: the real players in seed order, padded with byes to fill the bracket. */
function defaultSeedSlots(players: Player[]): string[] {
  const slots = players.map((p) => p.id);
  while (slots.length < BRACKET_SIZE) slots.push(BYE);
  return slots;
}

/** The shared/syncable slice only - what a brand new multi-device room starts from. */
export function freshSyncedState(): SyncedState {
  const players = buildDefaultPlayers();
  return {
    players,
    guests: [],
    claimedPlayerIds: [],
    seedSlots: defaultSeedSlots(players),
    matches: [],
    wallets: initialWallets(players),
    transactions: [],
    bets: [],
    messages: players.map((p) => createMessage(p.id, 'welcome', WELCOME_TEXT)),
    phase: 'setup',
  };
}

function freshState() {
  return { ...freshSyncedState(), activePlayerId: null };
}

function applyRatingUpdate(players: Player[], winnerId: string, loserId: string): Player[] {
  return players.map((p) => {
    if (p.id === winnerId) {
      const opp = players.find((x) => x.id === loserId)!;
      return { ...p, currentRating: updateRating(p.currentRating, opp.currentRating, 1) };
    }
    if (p.id === loserId) {
      const opp = players.find((x) => x.id === winnerId)!;
      return { ...p, currentRating: updateRating(p.currentRating, opp.currentRating, 0) };
    }
    return p;
  });
}

function markEliminated(players: Player[], loserId: string): Player[] {
  return players.map((p) => (p.id === loserId ? { ...p, eliminated: true } : p));
}

/** Fill in a fair win-probability snapshot for every match that now has both players but no snapshot yet -
 *  alongside each player's rating right before the match, so a later result correction can restore it exactly. */
function stampFairProbs(players: Player[], matches: Match[]): Match[] {
  return matches.map((m) => {
    if (m.fairProbA !== null || !m.playerAId || !m.playerBId) return m;
    const pa = players.find((p) => p.id === m.playerAId);
    const pb = players.find((p) => p.id === m.playerBId);
    if (!pa || !pb) return m;
    return {
      ...m,
      fairProbA: winProbability(pa.currentRating, pb.currentRating),
      preMatchRatingA: pa.currentRating,
      preMatchRatingB: pb.currentRating,
      status: m.status === 'pending' ? 'ready' : m.status,
    };
  });
}

/** LB-side won GF1: the undefeated WB side now has one loss, so a decisive rematch is required. */
function activateGrandFinalReset(matches: Match[], aId: string, bId: string): Match[] {
  return matches.map((m) => (m.slot === 'GF2' ? { ...m, playerAId: aId, playerBId: bId, status: 'ready' as const } : m));
}

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      ...freshState(),

      setActivePlayer: (id) => set({ activePlayerId: id }),

      updatePlayer: (id, patch) =>
        set((state) => ({
          players: state.players.map((p) => (p.id === id ? { ...p, ...patch } : p)),
        })),

      markMessagesRead: (recipientId) =>
        set((state) => ({
          messages: state.messages.map((m) => (m.recipientId === recipientId && !m.read ? { ...m, read: true } : m)),
        })),

      setSeedSlot: (index, playerId) =>
        set((state) => {
          const seedSlots = [...state.seedSlots];
          seedSlots[index] = playerId;
          return { seedSlots };
        }),

      startBracket: () => {
        const { players, seedSlots } = get();
        const byesNeeded = BRACKET_SIZE - players.length;
        const realEntries = seedSlots.filter((id) => id !== BYE);
        const byeCount = seedSlots.length - realEntries.length;
        const validIds = new Set(players.map((p) => p.id));
        const distinctReal = new Set(realEntries);
        if (
          seedSlots.length !== BRACKET_SIZE ||
          byeCount !== byesNeeded ||
          distinctReal.size !== players.length ||
          realEntries.some((id) => !validIds.has(id))
        ) {
          return `Jeder Spieler braucht genau eine Position, die restlichen ${byesNeeded} Position(en) müssen "Freilos" sein.`;
        }
        const matches = buildDoubleEliminationBracket(seedSlots);
        set({ matches: stampFairProbs(players, matches), phase: 'knockout' });
        return null;
      },

      enterMatchResult: (matchId, scoreA, scoreB) => {
        const { matches, players } = get();
        const match = matches.find((m) => m.id === matchId);
        if (!match || !match.playerAId || !match.playerBId) return;
        const winnerId = scoreA > scoreB ? match.playerAId : match.playerBId;
        const loserId = scoreA > scoreB ? match.playerBId : match.playerAId;

        let updatedPlayers = applyRatingUpdate(players, winnerId, loserId);
        let updatedMatches = matches.map((m) =>
          m.id === matchId ? { ...m, scoreA, scoreB, winnerId, status: 'finished' as const } : m
        );
        const finished = updatedMatches.find((m) => m.id === matchId)!;

        updatedMatches = propagateWinner(updatedMatches, finished);
        updatedMatches = propagateLoser(updatedMatches, finished);
        updatedMatches = settleByes(updatedMatches);

        let phase: Phase = 'knockout';
        if (finished.slot === 'GF1') {
          if (winnerId === finished.playerAId) {
            // undefeated winners-bracket side took it outright - tournament over
            updatedPlayers = markEliminated(updatedPlayers, loserId);
            phase = 'done';
          } else {
            // losers-bracket side won - the WB side has only one loss, so a decisive rematch is required
            updatedMatches = activateGrandFinalReset(updatedMatches, finished.playerAId!, finished.playerBId!);
          }
        } else if (finished.slot === 'GF2') {
          updatedPlayers = markEliminated(updatedPlayers, loserId);
          phase = 'done';
        } else if (!isWinnersBracketStage(finished.stage)) {
          // losers-bracket loss is a second loss - eliminated outright
          updatedPlayers = markEliminated(updatedPlayers, loserId);
        }
        // a winners-bracket loss drops the loser to the LB via propagateLoser above - no elimination yet

        updatedMatches = stampFairProbs(updatedPlayers, updatedMatches);
        set({ players: updatedPlayers, matches: updatedMatches, phase });

        get()._resolveBetsFor(matchId, winnerId, finished);
      },

      correctMatchResult: (matchId) => {
        const { matches, players, bets, wallets, transactions } = get();
        if (!canCorrectMatch(matches, matchId)) {
          return 'Dieses Ergebnis kann nicht mehr korrigiert werden - es wurde schon weitergespielt oder es liegen Wetten auf dem Folgespiel.';
        }
        const original = matches.find((m) => m.id === matchId)!;
        const reverted = revertMatchResult(matches, matchId);
        if (!reverted) return 'Ergebnis nicht gefunden.';
        const { matches: revertedMatches, winnerId, loserId } = reverted;

        let updatedPlayers = players;
        if (original.preMatchRatingA !== null && original.preMatchRatingB !== null) {
          updatedPlayers = players.map((p) => {
            if (p.id === original.playerAId) return { ...p, currentRating: original.preMatchRatingA! };
            if (p.id === original.playerBId) return { ...p, currentRating: original.preMatchRatingB! };
            return p;
          });
        }

        let phase: Phase = get().phase;
        const wasOutrightGF1 = original.slot === 'GF1' && winnerId === original.playerAId;
        if (wasOutrightGF1 || original.slot === 'GF2') {
          updatedPlayers = updatedPlayers.map((p) => (p.id === loserId ? { ...p, eliminated: false } : p));
          phase = 'knockout';
        } else if (!isWinnersBracketStage(original.stage) && original.stage !== 'gf') {
          updatedPlayers = updatedPlayers.map((p) => (p.id === loserId ? { ...p, eliminated: false } : p));
        }
        // a WB-stage loss, or the LB side winning GF1, never eliminated anyone - nothing to undo there

        // put every bet on this match back to open, reversing any payout already credited
        const newWallets = { ...wallets };
        for (const b of bets) {
          if (b.matchId === matchId && b.status === 'won' && b.payout) {
            newWallets[b.bettorId] = (newWallets[b.bettorId] ?? 0) - b.payout;
          }
        }
        const updatedBets = bets.map((b) => (b.matchId === matchId ? { ...b, status: 'open' as const, payout: null } : b));
        const updatedTransactions = transactions.filter((t) => !(t.type === 'payout' && t.note === matchId));

        set({
          players: updatedPlayers,
          matches: revertedMatches,
          phase,
          wallets: newWallets,
          bets: updatedBets,
          transactions: updatedTransactions,
        });
        return null;
      },

      lockMatch: (matchId) =>
        set((state) => ({
          matches: state.matches.map((m) => (m.id === matchId && m.status === 'ready' ? { ...m, status: 'live' } : m)),
        })),

      depositCoins: (playerId, amount) => {
        // Coins are always whole numbers - 1€ = 1 Coin, and nobody deposits fractional euros here.
        const wholeAmount = Math.round(amount);
        if (wholeAmount <= 0) return;
        set((state) => {
          const depositorName = playerName(state.players, playerId, state.guests);
          const otherIds = [...state.players.map((p) => p.id), ...state.guests.map((g) => g.id)].filter(
            (id) => id !== playerId
          );
          const notifications = otherIds.map((id) =>
            createMessage(id, 'deposit', `💶 ${depositorName} hat ${fmtCoins(wholeAmount)} eingezahlt.`)
          );
          return {
            wallets: { ...state.wallets, [playerId]: (state.wallets[playerId] ?? 0) + wholeAmount },
            transactions: [
              ...state.transactions,
              { id: crypto.randomUUID(), playerId, type: 'deposit', amount: wholeAmount, createdAt: Date.now() },
            ],
            messages: [...state.messages, ...notifications],
          };
        });
      },

      cancelDeposit: (transactionId) => {
        const state = get();
        const tx = state.transactions.find((t) => t.id === transactionId);
        if (!tx || tx.type !== 'deposit') return 'Einzahlung nicht gefunden.';

        const currentBalance = state.wallets[tx.playerId] ?? 0;
        const newBalance = Math.max(0, currentBalance - tx.amount);
        const note =
          newBalance === currentBalance - tx.amount
            ? createMessage(tx.playerId, 'deposit-cancelled', `⚠️ Deine Einzahlung von ${fmtCoins(tx.amount)} wurde vom Admin storniert.`)
            : createMessage(
                tx.playerId,
                'deposit-cancelled',
                `⚠️ Deine Einzahlung von ${fmtCoins(tx.amount)} wurde vom Admin storniert. Da du inzwischen Coins ausgegeben hast, steht dein Konto jetzt bei 0 statt im Minus.`
              );

        set({
          wallets: { ...state.wallets, [tx.playerId]: newBalance },
          transactions: state.transactions.filter((t) => t.id !== transactionId),
          messages: [...state.messages, note],
        });
        return null;
      },

      placeBet: (matchId, bettorId, pickedPlayerId, amount) => {
        const state = get();
        const match = state.matches.find((m) => m.id === matchId);
        if (!match) return 'Spiel nicht gefunden.';
        if (match.status !== 'ready') return 'Wetten auf dieses Spiel sind geschlossen.';
        if (!match.playerAId || !match.playerBId) return 'Spielpaarung steht noch nicht fest.';
        if (bettorId === match.playerAId || bettorId === match.playerBId) {
          return 'Du kannst nicht auf dein eigenes Spiel wetten.';
        }
        // Coins are always whole numbers - round the stake the same way deposits are.
        const wholeAmount = Math.round(amount);
        if (wholeAmount <= 0) return 'Ungültiger Betrag.';
        const balance = state.wallets[bettorId] ?? 0;
        if (balance < wholeAmount) return 'Nicht genug Guthaben.';
        const alreadyBet = state.bets.some((b) => b.matchId === matchId && b.bettorId === bettorId && b.status === 'open');
        if (alreadyBet) return 'Du hast auf dieses Spiel schon getippt.';

        const isSideA = pickedPlayerId === match.playerAId;
        const fairProbA = match.fairProbA ?? 0.5;
        const fairProbSide = isSideA ? fairProbA : 1 - fairProbA;
        const [poolSide, poolOther] = isSideA ? [match.poolA, match.poolB] : [match.poolB, match.poolA];
        const currentOdds = poolOdds(poolSide, poolOther, fairProbSide);

        const bet: Bet = {
          id: crypto.randomUUID(),
          matchId,
          bettorId,
          pickedPlayerId,
          amount: wholeAmount,
          oddsAtPlacement: currentOdds,
          status: 'open',
          payout: null,
          createdAt: Date.now(),
        };

        set({
          wallets: { ...state.wallets, [bettorId]: balance - wholeAmount },
          bets: [...state.bets, bet],
          matches: state.matches.map((m) =>
            m.id === matchId
              ? isSideA
                ? { ...m, poolA: m.poolA + wholeAmount }
                : { ...m, poolB: m.poolB + wholeAmount }
              : m
          ),
          transactions: [
            ...state.transactions,
            {
              id: crypto.randomUUID(),
              playerId: bettorId,
              type: 'bet',
              amount: -wholeAmount,
              createdAt: Date.now(),
              note: matchId,
            },
          ],
        });
        return null;
      },

      // internal helper, not part of the public component-facing API
      _resolveBetsFor: (matchId: string, winnerId: string, finishedMatch: Match) => {
        const state = get();
        const matchBets = state.bets.filter((b) => b.matchId === matchId && b.status === 'open');
        if (matchBets.length === 0) return;
        const fairProbA = finishedMatch.fairProbA ?? 0.5;
        const winnerIsA = winnerId === finishedMatch.playerAId;
        const winPool = winnerIsA ? finishedMatch.poolA : finishedMatch.poolB;
        const losePool = winnerIsA ? finishedMatch.poolB : finishedMatch.poolA;
        const winFairProb = winnerIsA ? fairProbA : 1 - fairProbA;
        const finalOdds = poolOdds(winPool, losePool, winFairProb);

        const matchLabel = `${playerName(state.players, finishedMatch.playerAId, state.guests)} vs ${playerName(state.players, finishedMatch.playerBId, state.guests)}`;

        const wallets = { ...state.wallets };
        const newTx: Transaction[] = [];
        const newMsgs: Message[] = [];
        const updatedBets = state.bets.map((b) => {
          if (b.matchId !== matchId || b.status !== 'open') return b;
          const pickName = playerName(state.players, b.pickedPlayerId, state.guests);
          if (b.pickedPlayerId === winnerId) {
            // whole coins only, same as every other coin amount in the app
            const payout = Math.round(b.amount * finalOdds);
            wallets[b.bettorId] = (wallets[b.bettorId] ?? 0) + payout;
            newTx.push({ id: crypto.randomUUID(), playerId: b.bettorId, type: 'payout', amount: payout, createdAt: Date.now(), note: matchId });
            newMsgs.push(
              createMessage(
                b.bettorId,
                'bet-won',
                `🎉 Deine Wette auf ${pickName} (${matchLabel}) hat gewonnen! Auszahlung: ${fmtCoins(payout)}.`
              )
            );
            return { ...b, status: 'won' as const, payout };
          }
          newMsgs.push(
            createMessage(
              b.bettorId,
              'bet-lost',
              `😬 Deine Wette auf ${pickName} (${matchLabel}) hat nicht gewonnen. Einsatz verloren: ${fmtCoins(b.amount)}.`
            )
          );
          return { ...b, status: 'lost' as const, payout: 0 };
        });
        set({ wallets, bets: updatedBets, transactions: [...state.transactions, ...newTx], messages: [...state.messages, ...newMsgs] });
      },

      // Resets only the shared tournament data, not activePlayerId - that's this device's own
      // identity, and in a multi-device room the admin is also a real player who should stay
      // logged in as themselves after a reset, not get bumped to the single-device "Admin" sentinel.
      resetTournament: () => set(freshSyncedState()),

      applyRemoteState: (data) => set(data),
    }),
    { name: 'alram-bet-storage' }
  )
);
