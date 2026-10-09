import type { Player } from '../types';
import { ratingFromDecimalOdds } from '../lib/odds';

interface SeedPlayer {
  name: string;
  odds: number;
}

// The 7 players who qualified for the double-elimination bracket, with
// their fixed starting title odds. The bracket has 8 slots, so one player
// gets a bye in round 1 - see lib/bracket.ts's BYE handling.
const SEED: SeedPlayer[] = [
  { name: 'Felix', odds: 1.45 },
  { name: 'Philippe', odds: 1.52 },
  { name: 'Anton', odds: 2.3 },
  { name: 'Julia', odds: 20 },
  { name: 'Feli', odds: 30 },
  { name: 'Vitus', odds: 15 },
  { name: 'Anna', odds: 30 },
];

export function buildDefaultPlayers(): Player[] {
  return SEED.map((s) => {
    const rating = ratingFromDecimalOdds(s.odds);
    return {
      id: s.name.toLowerCase(),
      name: s.name,
      initialOdds: s.odds,
      baseRating: rating,
      currentRating: rating,
      eliminated: false,
    };
  });
}
