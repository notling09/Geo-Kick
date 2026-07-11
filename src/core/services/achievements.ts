import type { OwnedPlayer, Pack } from '../domain/types';
import type { SessionStats } from '../db/repositories/sessionRepo';
import { countUserWins } from '../db/repositories/leagueRepo';
import { getMetaNumber } from '../db/repositories/metaRepo';

/**
 * Erfolge (Kapitel 3.5): werden aus dem gespeicherten Spielstand abgeleitet,
 * keine eigene Tabelle nötig. Icon-Namen werden im Profil auf das gezeichnete
 * Icon-Set gemappt.
 */

export type AchievementIcon =
  | 'ball' | 'map' | 'clock' | 'pack' | 'star' | 'trophy' | 'check' | 'flash' | 'coin';

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: AchievementIcon;
  unlocked: boolean;
}

export interface AchievementInput {
  stats: SessionStats;
  players: OwnedPlayer[];
  packs: Pack[];
  division: number;
}

export async function computeAchievements(input: AchievementInput): Promise<Achievement[]> {
  const { stats, players, packs, division } = input;
  const wins = await countUserWins();
  const bestDivision = Math.min(await getMetaNumber('bestDivision', 4), division);
  const packsOpened = packs.filter((p) => p.openedAt !== null).length;
  const hasLegendary = players.some((p) => p.pool.rarity === 'legendaer');

  return [
    {
      id: 'first-session',
      title: 'First Kick-off',
      description: 'Complete your first session at a pitch',
      icon: 'ball',
      unlocked: stats.totalSessions >= 1,
    },
    {
      id: 'regular',
      title: 'Regular',
      description: 'Complete 5 sessions',
      icon: 'clock',
      unlocked: stats.totalSessions >= 5,
    },
    {
      id: 'explorer',
      title: 'Explorer',
      description: 'Visit 3 different pitches',
      icon: 'map',
      unlocked: stats.distinctSpots >= 3,
    },
    // Platz-Pass-Abzeichen (V4)
    {
      id: 'passport-5',
      title: 'Scout',
      description: 'Discover 5 different pitches',
      icon: 'map',
      unlocked: stats.distinctSpots >= 5,
    },
    {
      id: 'passport-10',
      title: 'Globetrotter',
      description: 'Discover 10 different pitches',
      icon: 'map',
      unlocked: stats.distinctSpots >= 10,
    },
    {
      id: 'passport-25',
      title: 'Pitch Hunter',
      description: 'Discover 25 different pitches',
      icon: 'map',
      unlocked: stats.distinctSpots >= 25,
    },
    {
      id: 'streak-7',
      title: 'One Week Wonder',
      description: 'Check in 7 days in a row',
      icon: 'flash',
      unlocked: (await getMetaNumber('bestStreak', 0)) >= 7,
    },
    {
      id: 'full-ninety',
      title: 'The Full Ninety',
      description: 'Spend 90 minutes on pitches in total',
      icon: 'clock',
      unlocked: stats.totalMinutes >= 90,
    },
    {
      id: 'coin-collector',
      title: 'Coin Collector',
      description: 'Earn 1,000 coins at pitches in total',
      icon: 'coin',
      unlocked: stats.totalCoins >= 1000,
    },
    {
      id: 'first-pack',
      title: 'Pack Opener',
      description: 'Open your first pack',
      icon: 'pack',
      unlocked: packsOpened >= 1,
    },
    {
      id: 'collector',
      title: 'Collector',
      description: 'Open 10 packs',
      icon: 'pack',
      unlocked: packsOpened >= 10,
    },
    {
      id: 'legend-hunter',
      title: 'Legend Hunter',
      description: 'Own a legendary player',
      icon: 'star',
      unlocked: hasLegendary,
    },
    {
      id: 'first-win',
      title: 'First Win',
      description: 'Win a league match',
      icon: 'check',
      unlocked: wins >= 1,
    },
    {
      id: 'winning-streak',
      title: 'Serial Winner',
      description: 'Win 10 league matches',
      icon: 'flash',
      unlocked: wins >= 10,
    },
    {
      id: 'climber',
      title: 'Climber',
      description: 'Get promoted to Division 3',
      icon: 'trophy',
      unlocked: bestDivision <= 3,
    },
    {
      id: 'top-flight',
      title: 'Top Flight',
      description: 'Reach Division 1',
      icon: 'trophy',
      unlocked: bestDivision === 1,
    },
  ];
}
