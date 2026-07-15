import React, { useEffect, useRef, useState } from 'react';
import { Animated, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { USER_CLUB_ID } from '../../core/domain/constants';
import type { StandingRow } from '../../core/domain/types';
import { useGameStore } from '../../state/gameStore';
import { useLeagueStore, type SeasonPlayerStat } from '../../state/leagueStore';
import { GKButton, Card } from '../../ui/components';
import { Crest } from '../../ui/Crest';
import { formationLayout } from '../../ui/FormationPitch';
import { IconStar } from '../../ui/icons';
import { PitchBackground } from '../../ui/PitchBackground';
import { PlayerAvatar } from '../../ui/PlayerAvatar';
import { colors, font, radius, spacing } from '../../ui/theme';
import type { RootScreenProps } from '../../navigation/types';

/**
 * Saison-Rückblick-Show (V5, ersetzt die alte orange Meldung):
 *  1. Die Abschlusstabelle mit dem eigenen Platz (Zeilen sliden herein)
 *  2. Die Divisions-Leiter: Aufstieg/Abstieg/Bleiben + Saisonprämie
 *  3. Suspense: der Spieler der Saison, groß mit Toren/Assists/Notenschnitt
 *  4. Der Kader auf dem Platz mit allen Saisonnoten; der Spieler der
 *     Saison trägt einen Stern
 */

function avgOf(s: SeasonPlayerStat): string {
  return (s.ratingSum / Math.max(1, s.matches)).toFixed(1);
}

/** Tabellenzeile, die gestaffelt hereinslidet. */
function TableRow({ row, rank, isUser, delay }: {
  row: StandingRow; rank: number; isUser: boolean; delay: number;
}) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 350, delay, useNativeDriver: true }).start();
  }, [anim, delay]);
  return (
    <Animated.View
      style={[
        styles.tableRow,
        isUser && styles.tableRowUser,
        {
          opacity: anim,
          transform: [{ translateX: anim.interpolate({ inputRange: [0, 1], outputRange: [60, 0] }) }],
        },
      ]}
    >
      <Text style={[styles.tableRank, isUser && styles.tableTextUser]}>{rank}</Text>
      <Crest crestId={row.crest} size={22} />
      <Text style={[styles.tableName, isUser && styles.tableTextUser]} numberOfLines={1}>
        {row.name}
      </Text>
      <Text style={[styles.tablePts, isUser && styles.tableTextUser]}>{row.points} pts</Text>
    </Animated.View>
  );
}

export function SeasonReviewScreen({ navigation }: RootScreenProps<'SeasonReview'>) {
  const review = useLeagueStore((s) => s.seasonReview);
  const finishSeasonReview = useLeagueStore((s) => s.finishSeasonReview);
  const { club, players, lineup } = useGameStore();
  const [step, setStep] = useState(0);

  // Divisions-Leiter: Marker wandert von der alten zur neuen Division
  const ladderAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (step === 1) {
      ladderAnim.setValue(0);
      Animated.timing(ladderAnim, {
        toValue: 1,
        duration: 1400,
        delay: 500,
        useNativeDriver: true,
      }).start();
    }
  }, [step, ladderAnim]);

  // Suspense beim Spieler der Saison: Name, dann Zahlen
  const posName = useRef(new Animated.Value(0)).current;
  const posStats = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (step === 2) {
      posName.setValue(0);
      posStats.setValue(0);
      Animated.sequence([
        Animated.timing(posName, { toValue: 1, duration: 700, delay: 700, useNativeDriver: true }),
        Animated.timing(posStats, { toValue: 1, duration: 700, delay: 400, useNativeDriver: true }),
      ]).start();
    }
  }, [step, posName, posStats]);

  useEffect(() => {
    if (!review) navigation.goBack();
  }, [review, navigation]);
  if (!review) return null;

  const onFinish = async () => {
    await finishSeasonReview();
    navigation.goBack();
  };

  const bestPool = review.best
    ? players.find((p) => p.pool.name === review.best?.name)?.pool ?? null
    : null;

  // Schritt 3: aktuelle Elf auf dem Platz mit Saisonnoten
  const formation = club?.formation ?? '4-4-2';
  const layout = formationLayout(formation);
  const xiWithRatings = layout.map((slot) => {
    const player = players.find((p) => p.id === lineup[slot.slot]) ?? null;
    const stat = player ? review.squadStats[player.pool.name] : undefined;
    return { ...slot, player, stat };
  });
  const benchRated = players
    .filter((p) => !lineup.includes(p.id) && review.squadStats[p.pool.name]?.matches > 0)
    .sort((a, b) => {
      const sa = review.squadStats[a.pool.name];
      const sb = review.squadStats[b.pool.name];
      return sb.ratingSum / sb.matches - sa.ratingSum / sa.matches;
    });

  // Divisions-Leiter-Positionen (Division 1 oben)
  const ladderY = (division: number) => (division - 1) * 64;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {step === 0 && (
        <View style={styles.stepWrap}>
          <Text style={styles.title}>Season {review.season}</Text>
          <Text style={styles.subtitle}>Final table - Division {review.oldDivision}</Text>
          <ScrollView style={styles.tableWrap}>
            {review.standings.map((row, i) => (
              <TableRow
                key={row.clubId}
                row={row}
                rank={i + 1}
                isUser={row.clubId === USER_CLUB_ID}
                delay={i * 120}
              />
            ))}
          </ScrollView>
          <Text style={styles.rankLine}>You finished {review.finalRank}. of 8</Text>
          <GKButton title="Continue" onPress={() => setStep(1)} />
        </View>
      )}

      {step === 1 && (
        <View style={styles.stepWrap}>
          <Text style={styles.title}>
            {review.promoted ? 'PROMOTED!' : review.relegated ? 'Relegated' : 'Staying put'}
          </Text>
          <Text style={styles.subtitle}>
            {review.promoted
              ? `Your club climbs to Division ${review.newDivision}!`
              : review.relegated
                ? `Down to Division ${review.newDivision} - bounce back next season!`
                : `Another season in Division ${review.newDivision}.`}
          </Text>
          <View style={styles.ladderWrap}>
            {[1, 2, 3, 4].map((d) => (
              <View
                key={d}
                style={[styles.ladderStep, d === review.newDivision && styles.ladderStepActive]}
              >
                <Text
                  style={[
                    styles.ladderText,
                    d === review.newDivision && styles.ladderTextActive,
                  ]}
                >
                  Division {d}
                </Text>
              </View>
            ))}
            <Animated.View
              style={[
                styles.ladderMarker,
                {
                  transform: [
                    {
                      translateY: ladderAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [ladderY(review.oldDivision), ladderY(review.newDivision)],
                      }),
                    },
                  ],
                },
              ]}
            >
              <Crest crestId={club?.crest ?? 'crest-0'} size={40} />
            </Animated.View>
          </View>
          {review.prize > 0 && (
            <Text style={styles.prizeLine}>Season prize: +{review.prize} coins!</Text>
          )}
          <GKButton
            title={review.best ? 'The Player of the Season was...' : 'Continue'}
            onPress={() => setStep(review.best ? 2 : 3)}
          />
        </View>
      )}

      {step === 2 && review.best && (
        <View style={[styles.stepWrap, styles.posWrap]}>
          <Text style={styles.posHeading}>Player of the Season</Text>
          <Animated.View style={[styles.posCard, { opacity: posName }]}>
            {bestPool ? (
              <PlayerAvatar player={bestPool} size={130} />
            ) : (
              <IconStar size={110} color={colors.gold} />
            )}
            <Text style={styles.posName}>{review.best.name}</Text>
          </Animated.View>
          <Animated.View style={[styles.posStatsRow, { opacity: posStats }]}>
            <View style={styles.posStat}>
              <Text style={styles.posStatValue}>{review.best.goals}</Text>
              <Text style={styles.posStatLabel}>goals</Text>
            </View>
            <View style={styles.posStat}>
              <Text style={styles.posStatValue}>{review.best.assists}</Text>
              <Text style={styles.posStatLabel}>assists</Text>
            </View>
            <View style={styles.posStat}>
              <Text style={styles.posStatValue}>{review.best.avg.toFixed(1)}</Text>
              <Text style={styles.posStatLabel}>avg rating /10</Text>
            </View>
          </Animated.View>
          <GKButton title="Continue" onPress={() => setStep(3)} />
        </View>
      )}

      {step === 3 && (
        <View style={styles.stepWrap}>
          <Text style={styles.title}>Season ratings</Text>
          <Text style={styles.subtitle}>Your squad's average match ratings</Text>
          <View style={styles.pitchWrap}>
            <View style={StyleSheet.absoluteFill}>
              <PitchBackground width={360} height={430} />
            </View>
            {xiWithRatings.map(({ slot, xPct, yPct, player, stat }) => (
              <View
                key={slot}
                style={[styles.pitchSlot, { left: `${xPct}%`, top: `${yPct}%` }]}
              >
                {player && review.best?.name === player.pool.name && (
                  <View style={styles.posStar}>
                    <IconStar size={20} color={colors.gold} />
                  </View>
                )}
                {player ? (
                  <>
                    <PlayerAvatar player={player.pool} size={40} />
                    <Text style={styles.pitchName} numberOfLines={1}>
                      {player.pool.name.split(' ').slice(-1)[0]}
                    </Text>
                    <View style={styles.ratingBadge}>
                      <Text style={styles.ratingText}>{stat ? avgOf(stat) : '-'}</Text>
                    </View>
                  </>
                ) : (
                  <View style={styles.emptySlot} />
                )}
              </View>
            ))}
          </View>
          {benchRated.length > 0 && (
            <Card style={styles.benchCard}>
              {benchRated.slice(0, 5).map((p) => (
                <View key={p.id} style={styles.benchRow}>
                  <Text style={styles.benchName} numberOfLines={1}>{p.pool.name}</Text>
                  <Text style={styles.benchRating}>{avgOf(review.squadStats[p.pool.name])}</Text>
                </View>
              ))}
            </Card>
          )}
          <GKButton title="Finish" onPress={onFinish} />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.pitchDark,
  },
  stepWrap: {
    flex: 1,
    padding: spacing.md,
  },
  title: {
    color: '#fff',
    fontSize: font.title,
    fontWeight: '900',
    textAlign: 'center',
  },
  subtitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: font.body,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  tableWrap: {
    flex: 1,
    marginBottom: spacing.sm,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 10,
    marginBottom: 6,
  },
  tableRowUser: {
    backgroundColor: colors.gold,
  },
  tableRank: {
    width: 22,
    color: '#fff',
    fontWeight: '900',
  },
  tableName: {
    flex: 1,
    color: '#fff',
    fontWeight: '700',
  },
  tablePts: {
    color: '#fff',
    fontWeight: '900',
  },
  tableTextUser: {
    color: colors.ink,
  },
  rankLine: {
    color: '#fff',
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  ladderWrap: {
    alignSelf: 'center',
    width: 240,
    marginVertical: spacing.lg,
  },
  ladderStep: {
    height: 56,
    marginBottom: 8,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    paddingLeft: 64,
  },
  ladderStepActive: {
    backgroundColor: colors.pitch,
  },
  ladderText: {
    color: 'rgba(255,255,255,0.75)',
    fontWeight: '800',
    fontSize: font.h2,
  },
  ladderTextActive: {
    color: '#fff',
  },
  ladderMarker: {
    position: 'absolute',
    left: 8,
    top: 8,
  },
  prizeLine: {
    color: colors.gold,
    fontWeight: '900',
    fontSize: font.h2,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  posWrap: {
    justifyContent: 'center',
  },
  posHeading: {
    color: colors.gold,
    fontSize: font.h1,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  posCard: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  posName: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '900',
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  posStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    marginBottom: spacing.xl,
  },
  posStat: {
    alignItems: 'center',
  },
  posStatValue: {
    color: '#fff',
    fontSize: 40,
    fontWeight: '900',
  },
  posStatLabel: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: font.small,
    fontWeight: '700',
  },
  pitchWrap: {
    alignSelf: 'center',
    width: 360,
    height: 430,
    borderRadius: radius.md,
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  pitchSlot: {
    position: 'absolute',
    width: 64,
    marginLeft: -32,
    marginTop: -26,
    alignItems: 'center',
  },
  posStar: {
    position: 'absolute',
    top: -20,
    zIndex: 2,
  },
  pitchName: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
    textShadowColor: '#000',
    textShadowRadius: 3,
  },
  ratingBadge: {
    backgroundColor: colors.gold,
    borderRadius: radius.round,
    paddingHorizontal: 7,
    paddingVertical: 1,
    marginTop: 2,
  },
  ratingText: {
    fontWeight: '900',
    fontSize: 11,
    color: colors.ink,
  },
  emptySlot: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  benchCard: {
    marginBottom: spacing.sm,
    paddingVertical: spacing.sm,
  },
  benchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  benchName: {
    flex: 1,
    color: colors.ink,
    fontWeight: '700',
    marginRight: spacing.sm,
  },
  benchRating: {
    fontWeight: '900',
    color: colors.pitchDark,
  },
});
