import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Bet, Match, Phase, Player, Transaction } from '../types';
import { buildGroupMatches, buildKnockoutMatches, computeStandings, isGroupStageComplete } from '../lib/bracket';
import { poolOdds, updateRating, winProbability } from '../lib/odds';
import { buildSeedPlayers } from './seed';
import { ADMIN_ID } from '../lib/format';

interface State {
  players: Player[];
  matches: Match[];
  wallets: Record<string, number>;
  transactions: Transaction[];
  bets: Bet[];
  activePlayerId: string | null;
  phase: Phase;

  setActivePlayer: (id: string | null) => void;
  updatePlayer: (id: string, patch: Partial<Pick<Player, 'name' | 'group' | 'initialOdds'>>) => void;
  startGroupStage: () => void;
  enterGroupResult: (matchId: string, scoreA: number, scoreB: number) => void;
  startKnockoutStage: () => void;
  enterKnockoutResult: (matchId: string, scoreA: number, scoreB: number) => void;
  lockMatch: (matchId: string) => void;
  depositCoins: (playerId: string, amount: number) => void;
  placeBet: (matchId: string, bettorId: string, pickedPlayerId: string, amount: number) => string | null;
  resetTournament: () => void;
  /** Internal: settle open bets on a finished match. Not meant for UI use. */
  _resolveBetsFor: (matchId: string, winnerId: string, finishedMatch: Match) => void;
}

function initialWallets(players: Player[]): Record<string, number> {
  const w: Record<string, number> = {};
  for (const p of players) w[p.id] = 0;
  return w;
}

function freshState() {
  const players = buildSeedPlayers();
  return {
    players,
    matches: [] as Match[],
    wallets: initialWallets(players),
    transactions: [] as Transaction[],
    bets: [] as Bet[],
    activePlayerId: ADMIN_ID,
    phase: 'setup' as Phase,
  };
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

/** Fill in a fair win-probability snapshot for every match that now has both players but no snapshot yet. */
function stampFairProbs(players: Player[], matches: Match[]): Match[] {
  return matches.map((m) => {
    if (m.fairProbA !== null || !m.playerAId || !m.playerBId) return m;
    const pa = players.find((p) => p.id === m.playerAId);
    const pb = players.find((p) => p.id === m.playerBId);
    if (!pa || !pb) return m;
    return { ...m, fairProbA: winProbability(pa.currentRating, pb.currentRating), status: m.status === 'pending' ? 'ready' : m.status };
  });
}

/** Push a finished match's winner into the next bracket slot it feeds. */
function propagateWinner(matches: Match[], finished: Match): Match[] {
  if (!finished.winnerTo || !finished.winnerId) return matches;
  const { matchSlot, as } = finished.winnerTo;
  return matches.map((m) => {
    if (m.slot !== matchSlot) return m;
    const patch = as === 'A' ? { playerAId: finished.winnerId } : { playerBId: finished.winnerId };
    const merged = { ...m, ...patch };
    const bothFilled = !!merged.playerAId && !!merged.playerBId;
    return { ...merged, status: bothFilled ? ('ready' as const) : m.status };
  });
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

      startGroupStage: () => {
        const { players } = get();
        const groupA = players.filter((p) => p.group === 'A').map((p) => p.id);
        const groupB = players.filter((p) => p.group === 'B').map((p) => p.id);
        const matches = [...buildGroupMatches('A', groupA), ...buildGroupMatches('B', groupB)];
        set({ matches: stampFairProbs(players, matches), phase: 'group' });
      },

      enterGroupResult: (matchId, scoreA, scoreB) => {
        const { matches, players } = get();
        const match = matches.find((m) => m.id === matchId);
        if (!match || !match.playerAId || !match.playerBId) return;
        const winnerId = scoreA > scoreB ? match.playerAId : match.playerBId;
        const loserId = scoreA > scoreB ? match.playerBId : match.playerAId;
        const updatedPlayers = applyRatingUpdate(players, winnerId, loserId);
        const updatedMatches = matches.map((m) =>
          m.id === matchId ? { ...m, scoreA, scoreB, winnerId, status: 'finished' as const } : m
        );
        const finished = updatedMatches.find((m) => m.id === matchId)!;
        set({ players: updatedPlayers, matches: stampFairProbs(updatedPlayers, updatedMatches) });
        get()._resolveBetsFor(matchId, winnerId, finished);
      },

      startKnockoutStage: () => {
        const { players, matches } = get();
        if (!isGroupStageComplete('A', matches) || !isGroupStageComplete('B', matches)) return;
        const standingsA = computeStandings('A', players, matches);
        const standingsB = computeStandings('B', players, matches);
        const eliminatedIds = new Set([
          standingsA.find((r) => r.rank === 5)?.playerId,
          standingsB.find((r) => r.rank === 5)?.playerId,
        ]);
        const knockout = buildKnockoutMatches(standingsA, standingsB);
        const updatedPlayers = players.map((p) => (eliminatedIds.has(p.id) ? { ...p, eliminated: true } : p));
        const allMatches = stampFairProbs(updatedPlayers, [...matches, ...knockout]);
        set({ players: updatedPlayers, matches: allMatches, phase: 'knockout' });
      },

      enterKnockoutResult: (matchId, scoreA, scoreB) => {
        const { matches, players } = get();
        const match = matches.find((m) => m.id === matchId);
        if (!match || !match.playerAId || !match.playerBId) return;
        const winnerId = scoreA > scoreB ? match.playerAId : match.playerBId;
        const loserId = scoreA > scoreB ? match.playerBId : match.playerAId;
        const updatedPlayers = applyRatingUpdate(players, winnerId, loserId).map((p) =>
          p.id === loserId ? { ...p, eliminated: true } : p
        );
        let updatedMatches = matches.map((m) =>
          m.id === matchId ? { ...m, scoreA, scoreB, winnerId, status: 'finished' as const } : m
        );
        const finished = updatedMatches.find((m) => m.id === matchId)!;
        updatedMatches = propagateWinner(updatedMatches, finished);
        updatedMatches = stampFairProbs(updatedPlayers, updatedMatches);
        const finalMatch = updatedMatches.find((m) => m.stage === 'final');
        const phase: Phase = finalMatch?.status === 'finished' ? 'done' : 'knockout';
        set({ players: updatedPlayers, matches: updatedMatches, phase });

        // resolve bets placed on this match now that we know the winner
        get()._resolveBetsFor(matchId, winnerId, finished);
      },

      lockMatch: (matchId) =>
        set((state) => ({
          matches: state.matches.map((m) => (m.id === matchId && m.status === 'ready' ? { ...m, status: 'live' } : m)),
        })),

      depositCoins: (playerId, amount) => {
        if (amount <= 0) return;
        set((state) => ({
          wallets: { ...state.wallets, [playerId]: (state.wallets[playerId] ?? 0) + amount },
          transactions: [
            ...state.transactions,
            { id: crypto.randomUUID(), playerId, type: 'deposit', amount, createdAt: Date.now() },
          ],
        }));
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
        if (amount <= 0) return 'Ungültiger Betrag.';
        const balance = state.wallets[bettorId] ?? 0;
        if (balance < amount) return 'Nicht genug Guthaben.';
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
          amount,
          oddsAtPlacement: currentOdds,
          status: 'open',
          payout: null,
          createdAt: Date.now(),
        };

        set({
          wallets: { ...state.wallets, [bettorId]: balance - amount },
          bets: [...state.bets, bet],
          matches: state.matches.map((m) =>
            m.id === matchId
              ? isSideA
                ? { ...m, poolA: m.poolA + amount }
                : { ...m, poolB: m.poolB + amount }
              : m
          ),
          transactions: [
            ...state.transactions,
            { id: crypto.randomUUID(), playerId: bettorId, type: 'bet', amount: -amount, createdAt: Date.now(), note: matchId },
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

        const wallets = { ...state.wallets };
        const newTx: Transaction[] = [];
        const updatedBets = state.bets.map((b) => {
          if (b.matchId !== matchId || b.status !== 'open') return b;
          if (b.pickedPlayerId === winnerId) {
            const payout = Math.round(b.amount * finalOdds * 100) / 100;
            wallets[b.bettorId] = (wallets[b.bettorId] ?? 0) + payout;
            newTx.push({ id: crypto.randomUUID(), playerId: b.bettorId, type: 'payout', amount: payout, createdAt: Date.now(), note: matchId });
            return { ...b, status: 'won' as const, payout };
          }
          return { ...b, status: 'lost' as const, payout: 0 };
        });
        set({ wallets, bets: updatedBets, transactions: [...state.transactions, ...newTx] });
      },

      resetTournament: () => set(freshState()),
    }),
    { name: 'alram-bet-storage' }
  )
);
