import type { Player } from '../types';
import { ratingFromDecimalOdds } from '../lib/odds';

interface SeedPlayer {
  name: string;
  odds: number;
  group: 'A' | 'B';
}

// Snake-drafted into balanced groups by pre-tournament title odds (strongest first).
const SEED: SeedPlayer[] = [
  { name: 'Felix', odds: 1.5, group: 'A' },
  { name: 'Philippe', odds: 1.55, group: 'B' },
  { name: 'Robin', odds: 1.65, group: 'B' },
  { name: 'Anton', odds: 2.5, group: 'A' },
  { name: 'Michi', odds: 3.55, group: 'A' },
  { name: 'Vitus', odds: 8.75, group: 'B' },
  { name: 'Julia', odds: 25, group: 'B' },
  { name: 'Anna', odds: 25, group: 'A' },
  { name: 'Feli', odds: 30, group: 'A' },
  { name: 'Bianca', odds: 35, group: 'B' },
];

export function buildSeedPlayers(): Player[] {
  return SEED.map((s) => {
    const rating = ratingFromDecimalOdds(s.odds);
    return {
      id: s.name.toLowerCase(),
      name: s.name,
      group: s.group,
      initialOdds: s.odds,
      baseRating: rating,
      currentRating: rating,
      eliminated: false,
    };
  });
}
