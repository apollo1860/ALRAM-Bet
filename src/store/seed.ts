import type { GroupId, Player } from '../types';
import { ratingFromDecimalOdds } from '../lib/odds';

const PLAYERS_PER_GROUP = 5;
const DEFAULT_ODDS = 2;

/**
 * Blank starting roster for a new tournament: generic placeholder names and
 * a neutral title-win odds for everyone, split evenly into the two groups.
 * The admin fills in real names and quotes by hand in the Setup tab before
 * starting the group stage.
 */
export function buildDefaultPlayers(): Player[] {
  const rating = ratingFromDecimalOdds(DEFAULT_ODDS);
  return Array.from({ length: PLAYERS_PER_GROUP * 2 }, (_, i) => {
    const group: GroupId = i < PLAYERS_PER_GROUP ? 'A' : 'B';
    return {
      id: `spieler-${i + 1}`,
      name: `Spieler ${i + 1}`,
      group,
      initialOdds: DEFAULT_ODDS,
      baseRating: rating,
      currentRating: rating,
      eliminated: false,
    };
  });
}
