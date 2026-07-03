import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { getSessionStats, type SessionStats } from '../../core/db/repositories/sessionRepo';
import { useGameStore } from '../../state/gameStore';
import { useLeagueStore } from '../../state/leagueStore';
import { Card, SectionTitle } from '../../ui/components';
import { Crest } from '../../ui/Crest';
import { colors, font, radius, spacing } from '../../ui/theme';

/**
 * Profile & progress (chapter 3.5): club name, crest, division plus
 * statistics about real-world activity (visited pitches, sessions, coins).
 */
export function ProfileScreen() {
  const club = useGameStore((s) => s.club);
  const players = useGameStore((s) => s.players);
  const season = useLeagueStore((s) => s.season);
  const [stats, setStats] = useState<SessionStats | null>(null);

  useFocusEffect(
    useCallback(() => {
      getSessionStats().then(setStats);
    }, []),
  );

  const legendaries = players.filter((p) => p.pool.rarity === 'legendaer').length;

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
