import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';
import { LEAGUE, TACTIC_LABEL, USER_CLUB_ID } from '../../core/domain/constants';
import type { Tactic } from '../../core/domain/types';
import { useGameStore } from '../../state/gameStore';
import { useLeagueStore } from '../../state/leagueStore';
import { GKButton, Card, SectionTitle } from '../../ui/components';
import { Crest } from '../../ui/Crest';
import { IconCheck, IconClock, IconCross, IconMinus } from '../../ui/icons';
import { colors, font, radius, spacing } from '../../ui/theme';
import type { TabScreenProps } from '../../navigation/types';

/**
 * League (chapter 3.4): table, fixtures, tactic choice before each match
 * and the live simulation. One match per 24h, 14 rounds, promotion and
 * relegation at the end of the season.
 */

const TACTICS: Tactic[] = ['offensiv', 'ausgewogen', 'defensiv'];

function formatCountdown(ms: number): string {
  const h = Math.floor(ms / 3600000);
  const m = Math.ceil((ms % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}min` : `${m}min`;
}

export function LeagueScreen({ navigation }: TabScreenProps<'League'>) {
  const isFocused = useIsFocused();
  const club = useGameStore((s) => s.club);
  const {
    season, round, standings, matches, seasonMessage,
    hydrate, matchReady, msUntilNextMatch, playUserMatchday, acknowledgeSeasonMessage,
    clubName, clubCrest,
  } = useLeagueStore();

  const [tactic, setTactic] = useState<Tactic>(club?.tactic ?? 'ausgewogen');
  const [starting, setStarting] = useState(false);
  const [, forceTick] = useState(0);

  useEffect(() => {
    if (isFocused) hydrate();
  }, [isFocused, hydrate]);

  // Refresh the countdown label periodically
  useEffect(() => {
    const t = setInterval(() => forceTick((n) => n + 1), 30000);
    return () => clearInterval(t);
  }, []);

  const seasonOver = round > LEAGUE.roundsPerSeason;
  const ready = matchReady();

  const nextUserMatch = useMemo(
    () =>
      matches.find(
        (m) => m.round === round && !m.played && (m.homeId === USER_CLUB_ID || m.awayId === USER_CLUB_ID),
      ) ?? null,
    [matches, round],
  );

  const playedUserMatches = useMemo(
    () =>
      matches
        .filter((m) => m.played && (m.homeId === USER_CLUB_ID || m.awayId === USER_CLUB_ID))
        .sort((a, b) => b.round - a.round),
    [matches],
  );

  const onKickoff = async () => {
    setStarting(true);
    try {
      const played = await playUserMatchday(tactic);
      if (played) navigation.navigate('MatchLive');
    } finally {
      setStarting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>League</Text>
        <Text style={styles.subtitle}>
          Division {club?.division ?? 4} · Season {season} · Matchday{' '}
          {Math.min(round, LEAGUE.roundsPerSeason)}/{LEAGUE.roundsPerSeason}
        </Text>

        {seasonMessage ? (
          <Card style={styles.messageCard}>
            <Text style={styles.messageText}>{seasonMessage}</Text>
            <GKButton title="Got it!" variant="secondary" onPress={acknowledgeSeasonMessage} />
          </Card>
        ) : null}

        <SectionTitle>Next match</SectionTitle>
        {nextUserMatch && !seasonOver ? (
          <Card>
            <View style={styles.matchupRow}>
              <View style={styles.matchupSide}>
                <Crest crestId={clubCrest(nextUserMatch.homeId)} size={52} />
                <Text style={styles.matchupName} numberOfLines={2}>
                  {clubName(nextUserMatch.homeId)}
                </Text>
              </View>
              <Text style={styles.vs}>vs</Text>
              <View style={styles.matchupSide}>
                <Crest crestId={clubCrest(nextUserMatch.awayId)} size={52} />
                <Text style={styles.matchupName} numberOfLines={2}>
                  {clubName(nextUserMatch.awayId)}
                </Text>
              </View>
            </View>

            {ready ? (
              <>
                <Text style={styles.tacticTitle}>Choose your tactic:</Text>
                <View style={styles.tacticRow}>
                  {TACTICS.map((t) => (
                    <Pressable
                      key={t}
                      onPress={() => setTactic(t)}
                      style={[styles.tacticChip, tactic === t && styles.tacticActive]}
                    >
                      <Text style={[styles.tacticText, tactic === t && styles.tacticTextActive]}>
                        {TACTIC_LABEL[t]}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <Text style={styles.tacticHint}>
                  Formation ({club?.formation}) is set on the Squad tab.
                </Text>
                <GKButton title="Kick off!" onPress={onKickoff} loading={starting} />
              </>
            ) : (
              <View style={styles.countdownRow}>
                <IconClock size={20} color={colors.accentDark} />
                <Text style={styles.countdown}>
                  Kick-off in {formatCountdown(msUntilNextMatch())}
                </Text>
              </View>
            )}
          </Card>
        ) : (
          <Card>
            <Text style={styles.countdown}>Season finished - a new season starts right away.</Text>
          </Card>
        )}

        <SectionTitle>Table</SectionTitle>
        <Card style={{ paddingVertical: spacing.sm }}>
          <View style={styles.tableHeader}>
            <Text style={[styles.th, styles.colPos]}>#</Text>
            <Text style={[styles.th, styles.colClub]}>Club</Text>
            <Text style={[styles.th, styles.colNum]}>P</Text>
            <Text style={[styles.th, styles.colNum]}>GD</Text>
            <Text style={[styles.th, styles.colNum]}>Pts</Text>
          </View>
          {standings.map((row, i) => {
            const isUser = row.clubId === USER_CLUB_ID;
            const promo = i < LEAGUE.promotionSpots;
            const releg = i >= standings.length - LEAGUE.relegationSpots;
            return (
              <View
                key={row.clubId}
                style={[styles.tableRow, isUser && styles.userRow]}
              >
                <Text style={[styles.td, styles.colPos, promo && styles.promoText, releg && styles.relegText]}>
                  {i + 1}
                </Text>
                <View style={[styles.clubCell, styles.colClub]}>
                  <Crest crestId={row.crest} size={18} />
                  <Text style={[styles.td, styles.clubCellName, isUser && styles.userText]} numberOfLines={1}>
                    {row.name}
                  </Text>
                </View>
                <Text style={[styles.td, styles.colNum]}>{row.played}</Text>
                <Text style={[styles.td, styles.colNum]}>{row.goalsFor - row.goalsAgainst}</Text>
                <Text style={[styles.td, styles.colNum, styles.points]}>{row.points}</Text>
              </View>
            );
          })}
          <Text style={styles.legend}>
            Top {LEAGUE.promotionSpots}: promotion · bottom {LEAGUE.relegationSpots}: relegation
          </Text>
        </Card>

        <SectionTitle>Your results</SectionTitle>
        {playedUserMatches.length === 0 ? (
          <Text style={styles.emptyText}>No matches played yet.</Text>
        ) : (
          playedUserMatches.map((m) => {
            const userIsHome = m.homeId === USER_CLUB_ID;
            const userGoals = userIsHome ? m.homeGoals : m.awayGoals;
            const oppGoals = userIsHome ? m.awayGoals : m.homeGoals;
            const ResultIcon = userGoals > oppGoals ? IconCheck : userGoals < oppGoals ? IconCross : IconMinus;
            return (
              <Card key={m.id} style={styles.resultCard}>
                <ResultIcon size={16} />
                <Text style={styles.resultText}>
                  MD {m.round}: {clubName(m.homeId)} {m.homeGoals}:{m.awayGoals}{' '}
                  {clubName(m.awayId)}
                </Text>
              </Card>
            );
          })
        )}
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
  title: {
    fontSize: font.title,
    fontWeight: '900',
    color: colors.pitchDark,
  },
  subtitle: {
    color: colors.inkSoft,
    marginBottom: spacing.md,
  },
  messageCard: {
    backgroundColor: '#FFF8E1',
    marginBottom: spacing.md,
  },
  messageText: {
    fontSize: font.body,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: spacing.sm,
  },
  matchupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  matchupSide: {
    flex: 1,
    alignItems: 'center',
  },
  matchupName: {
    fontWeight: '800',
    color: colors.ink,
    textAlign: 'center',
    marginTop: 4,
  },
  vs: {
    fontSize: font.h1,
    fontWeight: '900',
    color: colors.inkSoft,
    marginHorizontal: spacing.sm,
  },
  tacticTitle: {
    fontWeight: '800',
    color: colors.ink,
    marginBottom: spacing.sm,
  },
  tacticRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  tacticChip: {
    flex: 1,
    borderRadius: radius.round,
    borderWidth: 2,
    borderColor: colors.pitch,
    paddingVertical: 8,
    alignItems: 'center',
  },
  tacticActive: {
    backgroundColor: colors.pitch,
  },
  tacticText: {
    fontWeight: '800',
    color: colors.pitch,
    fontSize: font.small,
  },
  tacticTextActive: {
    color: '#fff',
  },
  tacticHint: {
    fontSize: font.small,
    color: colors.inkSoft,
    marginBottom: spacing.sm,
  },
  countdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  countdown: {
    fontSize: font.h2,
    fontWeight: '800',
    color: colors.accentDark,
    textAlign: 'center',
  },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 2,
    borderBottomColor: colors.line,
    paddingBottom: 6,
    marginBottom: 4,
  },
  th: {
    fontWeight: '900',
    color: colors.inkSoft,
    fontSize: font.small,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 6,
    alignItems: 'center',
  },
  userRow: {
    backgroundColor: colors.grass,
    borderRadius: radius.sm,
  },
  td: {
    fontSize: font.small,
    color: colors.ink,
  },
  colPos: {
    width: 24,
    textAlign: 'center',
  },
  colClub: {
    flex: 1,
  },
  clubCell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  clubCellName: {
    flexShrink: 1,
  },
  colNum: {
    width: 36,
    textAlign: 'center',
  },
  points: {
    fontWeight: '900',
  },
  userText: {
    fontWeight: '900',
  },
  promoText: {
    color: colors.pitch,
    fontWeight: '900',
  },
  relegText: {
    color: colors.danger,
    fontWeight: '900',
  },
  legend: {
    fontSize: 10,
    color: colors.inkSoft,
    marginTop: spacing.sm,
  },
  resultCard: {
    padding: spacing.sm,
    marginBottom: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  resultText: {
    fontSize: font.small,
    color: colors.ink,
    flex: 1,
  },
  emptyText: {
    color: colors.inkSoft,
    fontStyle: 'italic',
  },
});
