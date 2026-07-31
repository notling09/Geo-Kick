import type { OwnedPlayer, Pack } from '../domain/types';
import { t } from '../i18n';
import type { SessionStats } from '../db/repositories/sessionRepo';
import { countUserWins } from '../db/repositories/leagueRepo';
import { getMetaNumber } from '../db/repositories/metaRepo';
import { getPool } from '../db/repositories/playerRepo';
import { loadTrophies } from './trophies';
import { loadDexSeen } from './dex';

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
  const goldCount = players.filter((p) => p.pool.rarity === 'gold').length;
  // Trophäen-basierte Erfolge (V7.4): karriereübergreifend, bleiben erhalten
  const cab = await loadTrophies();
  const cupWins = cab.cupTitles;
  const clWins = cab.clTitles;
  const podiums = cab.clRunnerUps + cab.clThird + cab.cupRunnerUps + cab.cupThird;
  const leagueTitleTotal = Object.values(cab.leagueTitles).reduce((a, b) => a + b, 0);
  // Sammel-Fortschritt (V7.6): Anteil der schon einmal besessenen Gold-/
  // Legendär-Spieler aus dem Sammelalbum (karriereübergreifend, dexSeen).
  const dexSeen = await loadDexSeen();
  const pool = await getPool();
  const goldNames = pool.filter((p) => p.rarity === 'gold').map((p) => p.name);
  const legNames = pool.filter((p) => p.rarity === 'legendaer').map((p) => p.name);
  const goldPct = goldNames.length
    ? goldNames.filter((n) => dexSeen.has(n)).length / goldNames.length : 0;
  const legPct = legNames.length
    ? legNames.filter((n) => dexSeen.has(n)).length / legNames.length : 0;

  return [
    {
      id: 'first-session',
      title: t('achFirstSession'),
      description: t('achFirstSessionD'),
      icon: 'ball',
      unlocked: stats.totalSessions >= 1,
    },
    {
      id: 'regular',
      title: t('achRegular'),
      description: t('achRegularD'),
      icon: 'clock',
      unlocked: stats.totalSessions >= 5,
    },
    {
      id: 'explorer',
      title: t('achExplorer'),
      description: t('achExplorerD'),
      icon: 'map',
      unlocked: stats.distinctSpots >= 3,
    },
    // Platz-Pass-Abzeichen (V4)
    {
      id: 'passport-5',
      title: t('achScout'),
      description: t('achScoutD'),
      icon: 'map',
      unlocked: stats.distinctSpots >= 5,
    },
    {
      id: 'passport-10',
      title: t('achGlobetrotter'),
      description: t('achGlobetrotterD'),
      icon: 'map',
      unlocked: stats.distinctSpots >= 10,
    },
    {
      id: 'passport-25',
      title: t('achHunter'),
      description: t('achHunterD'),
      icon: 'map',
      unlocked: stats.distinctSpots >= 25,
    },
    {
      id: 'streak-7',
      title: t('achWeek'),
      description: t('achWeekD'),
      icon: 'flash',
      unlocked: (await getMetaNumber('bestStreak', 0)) >= 7,
    },
    {
      id: 'full-ninety',
      title: t('achNinety'),
      description: t('achNinetyD'),
      icon: 'clock',
      unlocked: stats.totalMinutes >= 90,
    },
    {
      id: 'coin-collector',
      title: t('achCoins'),
      description: t('achCoinsD'),
      icon: 'coin',
      unlocked: stats.totalCoins >= 1000,
    },
    {
      id: 'first-pack',
      title: t('achPack'),
      description: t('achPackD'),
      icon: 'pack',
      unlocked: packsOpened >= 1,
    },
    {
      id: 'collector',
      title: t('achCollector'),
      description: t('achCollectorD'),
      icon: 'pack',
      unlocked: packsOpened >= 10,
    },
    {
      id: 'legend-hunter',
      title: t('achLegend'),
      description: t('achLegendD'),
      icon: 'star',
      unlocked: hasLegendary,
    },
    {
      id: 'first-win',
      title: t('achWin'),
      description: t('achWinD'),
      icon: 'check',
      unlocked: wins >= 1,
    },
    {
      id: 'winning-streak',
      title: t('achSerial'),
      description: t('achSerialD'),
      icon: 'flash',
      unlocked: wins >= 10,
    },
    {
      id: 'climber',
      title: t('achClimber'),
      description: t('achClimberD'),
      icon: 'trophy',
      unlocked: bestDivision <= 3,
    },
    {
      id: 'top-flight',
      title: t('achTop'),
      description: t('achTopD'),
      icon: 'trophy',
      unlocked: bestDivision === 1,
    },
    // V7.4: mehr Ziele
    {
      id: 'wins-50',
      title: t('achWins50'),
      description: t('achWins50D'),
      icon: 'flash',
      unlocked: wins >= 50,
    },
    {
      id: 'rich',
      title: t('achRich'),
      description: t('achRichD'),
      icon: 'coin',
      unlocked: stats.totalCoins >= 5000,
    },
    {
      id: 'gold-squad',
      title: t('achGoldSquad'),
      description: t('achGoldSquadD'),
      icon: 'star',
      unlocked: goldCount >= 5,
    },
    {
      id: 'passport-50',
      title: t('achPilgrim'),
      description: t('achPilgrimD'),
      icon: 'map',
      unlocked: stats.distinctSpots >= 50,
    },
    {
      id: 'league-champ',
      title: t('achLeagueChamp'),
      description: t('achLeagueChampD'),
      icon: 'trophy',
      unlocked: leagueTitleTotal >= 1,
    },
    {
      id: 'podium',
      title: t('achPodium'),
      description: t('achPodiumD'),
      icon: 'trophy',
      unlocked: podiums >= 1,
    },
    {
      id: 'cup-winner',
      title: t('achCupWin'),
      description: t('achCupWinD'),
      icon: 'trophy',
      unlocked: cupWins >= 1,
    },
    {
      id: 'cl-winner',
      title: t('achClWin'),
      description: t('achClWinD'),
      icon: 'trophy',
      unlocked: clWins >= 1,
    },
    // Sammel-Erfolge (V7.6): Fortschritt im Sammelalbum, karriereübergreifend.
    {
      id: 'coll-gold-25', title: t('achCollGold25'), description: t('achCollGold25D'),
      icon: 'star', unlocked: goldPct >= 0.25,
    },
    {
      id: 'coll-gold-50', title: t('achCollGold50'), description: t('achCollGold50D'),
      icon: 'star', unlocked: goldPct >= 0.5,
    },
    {
      id: 'coll-gold-75', title: t('achCollGold75'), description: t('achCollGold75D'),
      icon: 'star', unlocked: goldPct >= 0.75,
    },
    {
      id: 'coll-gold-100', title: t('achCollGold100'), description: t('achCollGold100D'),
      icon: 'trophy', unlocked: goldPct >= 1,
    },
    {
      id: 'coll-leg-25', title: t('achCollLeg25'), description: t('achCollLeg25D'),
      icon: 'star', unlocked: legPct >= 0.25,
    },
    {
      id: 'coll-leg-50', title: t('achCollLeg50'), description: t('achCollLeg50D'),
      icon: 'star', unlocked: legPct >= 0.5,
    },
    {
      id: 'coll-leg-100', title: t('achCollLeg100'), description: t('achCollLeg100D'),
      icon: 'trophy', unlocked: legPct >= 1,
    },
    // Das große Ziel: Liga + Champions League in derselben Saison (Double) →
    // Karriere vollendet. Karriereübergreifend, bleibt für immer erhalten.
    {
      id: 'the-double',
      title: t('achDouble'),
      description: t('achDoubleD'),
      icon: 'star',
      unlocked: cab.doubles >= 1,
    },
  ];
}
