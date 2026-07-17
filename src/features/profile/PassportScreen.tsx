import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { DISCOVERY } from '../../core/domain/constants';
import { t, tf } from '../../core/i18n';
import { dayKey } from '../../core/engine/pitchBattle';
import { getVisitedSpots, type VisitedSpot } from '../../core/db/repositories/sessionRepo';
import { getMeta, getMetaNumber } from '../../core/db/repositories/metaRepo';
import { GKButton, Card, SectionTitle } from '../../ui/components';
import { IconPin, IconStar } from '../../ui/icons';
import { colors, font, radius, spacing } from '../../ui/theme';
import type { RootScreenProps } from '../../navigation/types';

/**
 * Platz-Pass (V4): gesammelte Plätze, Abzeichen, tägliche Serie und der
 * Heimplatz an einer Stelle – der "Reisepass" des Spielers.
 */

function formatLastVisit(ts: number): string {
  const days = Math.floor((Date.now() - ts) / 86400000);
  if (days === 0) return t('ppToday');
  if (days === 1) return t('ppYesterday');
  return tf('ppDaysAgo', { n: days });
}

export function PassportScreen({ navigation }: RootScreenProps<'Passport'>) {
  const [visited, setVisited] = useState<VisitedSpot[]>([]);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [homeSpotId, setHomeSpotId] = useState('');

  useFocusEffect(
    useCallback(() => {
      (async () => {
        setVisited(await getVisitedSpots());
        // Serie zählt nur, wenn heute oder gestern eingecheckt wurde
        const streakDay = await getMeta('streakDay');
        const today = dayKey();
        const yesterday = dayKey(new Date(Date.now() - 86400000));
        const count = await getMetaNumber('streakCount', 0);
        setStreak(streakDay === today || streakDay === yesterday ? count : 0);
        setBestStreak(await getMetaNumber('bestStreak', 0));
        setHomeSpotId((await getMeta('homeSpotId')) ?? '');
      })();
    }, []),
  );

  const distinct = visited.length;
  const home = visited.find((v) => v.spotId === homeSpotId) ?? null;
  const homeLevel = home
    ? 1 + Math.floor((home.visits - DISCOVERY.homeMinVisits) / DISCOVERY.homeVisitsPerLevel)
    : 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>{t('ppTitle')}</Text>

        <Card style={styles.countCard}>
          <Text style={styles.countNumber}>{distinct}</Text>
          <Text style={styles.countLabel}>
            {distinct === 1 ? t('ppDiscovered') : t('ppDiscoveredPl')}
          </Text>
          <Text style={styles.countHint}>
            {tf('ppFirstBonus', { n: DISCOVERY.firstVisitBonusCoins })}
          </Text>
        </Card>

        <SectionTitle>{t('ppBadges')}</SectionTitle>
        <View style={styles.badgeRow}>
          {DISCOVERY.passportBadges.map((threshold) => {
            const unlocked = distinct >= threshold;
            return (
              <View key={threshold} style={[styles.badge, unlocked && styles.badgeUnlocked]}>
                <IconStar size={22} color={unlocked ? colors.gold : colors.line} />
                <Text style={[styles.badgeText, unlocked && styles.badgeTextUnlocked]}>
                  {threshold}
                </Text>
                <Text style={styles.badgeSub}>{t('ppPitches')}</Text>
              </View>
            );
          })}
        </View>

        <SectionTitle>{t('ppStreak')}</SectionTitle>
        <Card>
          <Text style={styles.streakLine}>
            {t('ppCurrentStreak')}<Text style={styles.streakValue}>{tf(streak === 1 ? 'ppDay' : 'ppDayPl', { n: streak })}</Text>
          </Text>
          <Text style={styles.streakLine}>
            {t('ppBestStreak')}<Text style={styles.streakValue}>{tf(bestStreak === 1 ? 'ppDay' : 'ppDayPl', { n: bestStreak })}</Text>
          </Text>
          <Text style={styles.hint}>
            {tf('ppStreakHint', { per: DISCOVERY.streakBonusPerDay, max: DISCOVERY.streakBonusMax })}
          </Text>
        </Card>

        <SectionTitle>{t('ppHome')}</SectionTitle>
        <Card>
          {home ? (
            <>
              <Text style={styles.homeName}>{home.name}</Text>
              <Text style={styles.hint}>
                {tf('ppHomeInfo', {
                  lvl: homeLevel,
                  visits: home.visits,
                  min: home.totalMinutes,
                  bonus: DISCOVERY.homeBonusCoins,
                })}
              </Text>
            </>
          ) : (
            <Text style={styles.hint}>
              {tf('ppHomeNone', { n: DISCOVERY.homeMinVisits })}
            </Text>
          )}
        </Card>

        <SectionTitle>{tf('ppVisited', { n: distinct })}</SectionTitle>
        {visited.length === 0 ? (
          <Card>
            <Text style={styles.hint}>{t('ppNoVisits')}</Text>
          </Card>
        ) : (
          visited.map((v) => (
            <Card key={v.spotId} style={styles.visitedCard}>
              <IconPin size={20} color={v.spotId === homeSpotId ? colors.sky : colors.pitch} />
              <View style={styles.visitedInfo}>
                <Text style={styles.visitedName} numberOfLines={1}>
                  {v.name}
                  {v.spotId === homeSpotId ? `  ·  ${t('mapHome')}` : ''}
                </Text>
                <Text style={styles.hint}>
                  {tf(v.visits === 1 ? 'ppVisitLine' : 'ppVisitLinePl', {
                    visits: v.visits,
                    min: v.totalMinutes,
                    last: formatLastVisit(v.lastVisit),
                  })}
                </Text>
              </View>
            </Card>
          ))
        )}

        <GKButton
          title={t('back')}
          variant="ghost"
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
        />
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
    marginBottom: spacing.sm,
  },
  countCard: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  countNumber: {
    fontSize: 52,
    fontWeight: '900',
    color: colors.pitch,
  },
  countLabel: {
    fontSize: font.body,
    fontWeight: '800',
    color: colors.ink,
  },
  countHint: {
    fontSize: font.small,
    color: colors.inkSoft,
    marginTop: 4,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  badge: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.line,
    paddingVertical: spacing.sm,
  },
  badgeUnlocked: {
    // Kein heller Fix-Hintergrund (Dark Mode): der Gold-Rahmen reicht
    borderColor: colors.gold,
  },
  badgeText: {
    fontSize: font.h2,
    fontWeight: '900',
    color: colors.inkSoft,
  },
  badgeTextUnlocked: {
    color: colors.ink,
  },
  badgeSub: {
    fontSize: 10,
    color: colors.inkSoft,
  },
  streakLine: {
    fontSize: font.body,
    color: colors.ink,
    marginBottom: 2,
  },
  streakValue: {
    fontWeight: '900',
    color: colors.pitchDark,
  },
  homeName: {
    fontSize: font.h2,
    fontWeight: '900',
    color: colors.sky,
    marginBottom: 2,
  },
  hint: {
    fontSize: font.small,
    color: colors.inkSoft,
    lineHeight: 18,
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
  },
  backBtn: {
    marginTop: spacing.md,
  },
});
