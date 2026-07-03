import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import {
  getSessionStats, getVisitedSpots,
  type SessionStats, type VisitedSpot,
} from '../../core/db/repositories/sessionRepo';
import {
  computeAchievements, type Achievement, type AchievementIcon,
} from '../../core/services/achievements';
import { useGameStore } from '../../state/gameStore';
import { useLeagueStore } from '../../state/leagueStore';
import { Card, SectionTitle } from '../../ui/components';
import { Crest } from '../../ui/Crest';
import {
  IconBall, IconCheck, IconClock, IconFlash, IconMap, IconPack, IconPin, IconStar,
  IconTrophy, type IconProps,
} from '../../ui/icons';
import { colors, font, radius, spacing } from '../../ui/theme';

/**
 * Profile & progress (chapter 3.5): club name, crest, division,
 * achievements, visited pitches and real-world activity statistics.
 */

const ACHIEVEMENT_ICON: Record<AchievementIcon, React.ComponentType<IconProps>> = {
  ball: IconBall,
  map: IconMap,
  clock: IconClock,
  pack: IconPack,
  star: IconStar,
  trophy: IconTrophy,
  check: IconCheck,
  flash: IconFlash,
};

function formatLastVisit(ts: number): string {
  const days = Math.floor((Date.now() - ts) / 86400000);
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
}

export function ProfileScreen() {
  const club = useGameStore((s) => s.club);
  const players = useGameStore((s) => s.players);
  const packs = useGameStore((s) => s.packs);
  const season = useLeagueStore((s) => s.season);
  const [stats, setStats] = useState<SessionStats | null>(null);
  const [visited, setVisited] = useState<VisitedSpot[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const s = await getSessionStats();
        setStats(s);
        setVisited(await getVisitedSpots());
        setAchievements(
          await computeAchievements({
            stats: s,
            players,
            packs,
            division: club?.division ?? 4,
          }),
        );
      })();
    }, [players, packs, club?.division]),
  );

  const legendaries = players.filter((p) => p.pool.rarity === 'legendaer').length;
  const unlockedCount = achievements.filter((a) => a.unlocked).length;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.clubHero}>
          <Crest crestId={club?.crest} size={80} />
          <Text style={styles.clubName}>{club?.name ?? 'My Club'}</Text>
          <Text style={styles.clubMeta}>
            Division {club?.division ?? 4} · Season {season}
          </Text>
        </View>

        <SectionTitle>Real-world activity</SectionTitle>
        <View style={styles.statsGrid}>
          <Card style={styles.statCard}>
            <Text style={styles.statValue}>{stats?.totalSessions ?? 0}</Text>
            <Text style={styles.statLabel}>Sessions</Text>
          </Card>
          <Card style={styles.statCard}>
            <Text style={styles.statValue}>{stats?.distinctSpots ?? 0}</Text>
            <Text style={styles.statLabel}>Pitches visited</Text>
          </Card>
          <Card style={styles.statCard}>
            <Text style={styles.statValue}>{stats?.totalMinutes ?? 0}</Text>
            <Text style={styles.statLabel}>Minutes on pitch</Text>
          </Card>
          <Card style={styles.statCard}>
            <Text style={styles.statValue}>{stats?.totalCoins ?? 0}</Text>
            <Text style={styles.statLabel}>Coins earned</Text>
          </Card>
        </View>

        <SectionTitle>
          Achievements ({unlockedCount}/{achievements.length})
        </SectionTitle>
        <View style={styles.achievementGrid}>
          {achievements.map((a) => {
            const AIcon = ACHIEVEMENT_ICON[a.icon];
            return (
              <Card
                key={a.id}
                style={[styles.achievementCard, !a.unlocked && styles.achievementLocked]}
              >
                <AIcon size={26} color={a.unlocked ? colors.pitch : colors.inkSoft} />
                <Text style={styles.achievementTitle} numberOfLines={1}>
                  {a.title}
                </Text>
                <Text style={styles.achievementDesc} numberOfLines={2}>
                  {a.description}
                </Text>
              </Card>
            );
          })}
        </View>

        <SectionTitle>Visited pitches</SectionTitle>
        {visited.length === 0 ? (
          <Card>
            <Text style={styles.aboutText}>
              No pitches visited yet - check in at a pitch on the map to get started!
            </Text>
          </Card>
        ) : (
          visited.map((v) => (
            <Card key={v.spotId} style={styles.visitedCard}>
              <IconPin size={20} color={colors.pitch} />
              <View style={styles.visitedInfo}>
                <Text style={styles.visitedName} numberOfLines={1}>
                  {v.name}
                </Text>
                <Text style={styles.visitedMeta}>
                  {v.visits} visit{v.visits === 1 ? '' : 's'} · {v.totalMinutes} min · last{' '}
                  {formatLastVisit(v.lastVisit)}
                </Text>
              </View>
            </Card>
          ))
        )}

        <SectionTitle>Club</SectionTitle>
        <Card>
          <Text style={styles.infoRow}>Squad size: {players.length} players</Text>
          <Text style={styles.infoRow}>Legendary players: {legendaries}</Text>
          <Text style={styles.infoRow}>Coins: {club?.coins ?? 0}</Text>
        </Card>

        <SectionTitle>About</SectionTitle>
        <Card>
          <Text style={styles.aboutText}>
            Geo-Kick version 1 (MVP) - all data is stored locally on your device only.
          </Text>
          <Text style={styles.aboutText}>
            Map data: © OpenStreetMap contributors (ODbL). All player and club names are
            entirely fictional.
          </Text>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  clubHero: {
    alignItems: 'center',
    backgroundColor: colors.pitch,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  clubName: {
    fontSize: font.h1,
    fontWeight: '900',
    color: '#fff',
    marginTop: spacing.sm,
  },
  clubMeta: {
    color: colors.grass,
    fontWeight: '700',
    marginTop: 4,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  statCard: {
    flexBasis: '47%',
    flexGrow: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 30,
    fontWeight: '900',
    color: colors.pitchDark,
  },
  statLabel: {
    fontSize: font.small,
    color: colors.inkSoft,
    marginTop: 2,
  },
  achievementGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  achievementCard: {
    flexBasis: '30%',
    flexGrow: 1,
    alignItems: 'center',
    padding: spacing.sm,
  },
  achievementLocked: {
    opacity: 0.45,
  },
  achievementTitle: {
    fontWeight: '800',
    color: colors.ink,
    fontSize: font.small,
    marginTop: 6,
    textAlign: 'center',
  },
  achievementDesc: {
    fontSize: 10,
    color: colors.inkSoft,
    textAlign: 'center',
    marginTop: 2,
  },
  visitedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    marginBottom: spacing.xs,
  },
  visitedInfo: {
    flex: 1,
  },
  visitedName: {
    fontWeight: '800',
    color: colors.ink,
    fontSize: font.body,
  },
  visitedMeta: {
    fontSize: font.small,
    color: colors.inkSoft,
    marginTop: 2,
  },
  infoRow: {
    fontSize: font.body,
    color: colors.ink,
    marginBottom: 6,
  },
  aboutText: {
    fontSize: font.small,
    color: colors.inkSoft,
    marginBottom: spacing.sm,
  },
});
