import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { getSessionStats, type SessionStats } from '../../core/db/repositories/sessionRepo';
import { useGameStore } from '../../state/gameStore';
import { useLeagueStore } from '../../state/leagueStore';
import { Card, SectionTitle } from '../../ui/components';
import { colors, font, radius, spacing } from '../../ui/theme';

/**
 * Profil & Fortschritt (Kapitel 3.5): Klubname, Wappen, Division sowie
 * Statistiken zur realen Aktivität (besuchte Plätze, Sessions, Coins).
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
          <Text style={styles.clubCrest}>{club?.crest ?? '⚽'}</Text>
          <Text style={styles.clubName}>{club?.name ?? 'Mein Klub'}</Text>
          <Text style={styles.clubMeta}>
            Division {club?.division ?? 4} · Saison {season}
          </Text>
        </View>

        <SectionTitle>Reale Aktivität</SectionTitle>
        <View style={styles.statsGrid}>
          <Card style={styles.statCard}>
            <Text style={styles.statValue}>{stats?.totalSessions ?? 0}</Text>
            <Text style={styles.statLabel}>Sessions</Text>
          </Card>
          <Card style={styles.statCard}>
            <Text style={styles.statValue}>{stats?.distinctSpots ?? 0}</Text>
            <Text style={styles.statLabel}>Besuchte Plätze</Text>
          </Card>
          <Card style={styles.statCard}>
            <Text style={styles.statValue}>{stats?.totalMinutes ?? 0}</Text>
            <Text style={styles.statLabel}>Minuten am Platz</Text>
          </Card>
          <Card style={styles.statCard}>
            <Text style={styles.statValue}>{stats?.totalCoins ?? 0}</Text>
            <Text style={styles.statLabel}>Coins verdient</Text>
          </Card>
        </View>

        <SectionTitle>Klub</SectionTitle>
        <Card>
          <Text style={styles.infoRow}>👥 Kadergröße: {players.length} Spieler</Text>
          <Text style={styles.infoRow}>🌟 Legendäre Spieler: {legendaries}</Text>
          <Text style={styles.infoRow}>🪙 Coins: {club?.coins ?? 0}</Text>
        </Card>

        <SectionTitle>Info</SectionTitle>
        <Card>
          <Text style={styles.aboutText}>
            Geo-Kick Version 1 (MVP) – alle Daten werden ausschließlich lokal auf deinem
            Gerät gespeichert.
          </Text>
          <Text style={styles.aboutText}>
            Kartendaten: © OpenStreetMap-Mitwirkende (ODbL). Alle Spieler- und Klubnamen
            sind frei erfunden.
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
  clubCrest: {
    fontSize: 64,
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
