import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { loadTrophies, totalTrophies, type TrophyCabinet } from '../../core/services/trophies';
import { t, tf } from '../../core/i18n';
import { GKButton, Card } from '../../ui/components';
import { IconStar, IconTrophy } from '../../ui/icons';
import { colors, font, radius, spacing } from '../../ui/theme';
import type { RootScreenProps } from '../../navigation/types';

/**
 * Trophäenschrank (V7): alle in der Karriere (und darüber hinaus) gesammelten
 * Titel – Liga-Meisterschaften je Division, Champions-League-Titel und
 * vollendete Karrieren. Bleibt über "Neue Karriere starten" hinweg erhalten.
 */

interface TrophyRow {
  key: string;
  label: string;
  count: number;
  color: string;
  gold?: boolean;
}

function buildRows(c: TrophyCabinet): TrophyRow[] {
  const rows: TrophyRow[] = [];
  if (c.doubles > 0) {
    rows.push({ key: 'double', label: t('trDouble'), count: c.doubles, color: '#8E44AD', gold: true });
  }
  if (c.clTitles > 0) {
    rows.push({ key: 'cl', label: t('trClTitle'), count: c.clTitles, color: '#0D72BA', gold: true });
  }
  // Divisionen von oben (1) nach unten (4)
  for (const div of [1, 2, 3, 4]) {
    const n = c.leagueTitles[div] ?? 0;
    if (n > 0) {
      rows.push({
        key: `league-${div}`,
        label: tf('trLeagueTitle', { n: div }),
        count: n,
        color: div === 1 ? '#E8B923' : colors.pitch,
      });
    }
  }
  // Vize-Meister (Platz 2) je Division
  for (const div of [1, 2, 3, 4]) {
    const n = c.runnerUps[div] ?? 0;
    if (n > 0) {
      rows.push({
        key: `runner-${div}`,
        label: tf('trRunnerUp', { n: div }),
        count: n,
        color: '#9BA6B2',
      });
    }
  }
  return rows;
}

export function TrophiesScreen({ navigation }: RootScreenProps<'Trophies'>) {
  const [cabinet, setCabinet] = useState<TrophyCabinet | null>(null);

  useFocusEffect(
    useCallback(() => {
      void loadTrophies().then(setCabinet);
    }, []),
  );

  const rows = cabinet ? buildRows(cabinet) : [];
  const total = cabinet ? totalTrophies(cabinet) : 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>{t('trTitle')}</Text>
        <Text style={styles.subtitle}>{t('trSubtitle')}</Text>

        <Card style={styles.totalCard}>
          <IconTrophy size={40} color={colors.gold} />
          <Text style={styles.totalNumber}>{total}</Text>
        </Card>

        {rows.length === 0 ? (
          <Card>
            <Text style={styles.empty}>{t('trEmpty')}</Text>
          </Card>
        ) : (
          rows.map((r) => (
            <Card
              key={r.key}
              style={[styles.row, r.gold ? { borderColor: r.color, borderWidth: 2 } : null]}
            >
              <IconTrophy size={28} color={r.color} />
              <Text style={styles.rowLabel} numberOfLines={2}>
                {r.label}
              </Text>
              <View style={styles.countWrap}>
                {r.count > 1 && <IconStar size={13} color={r.color} />}
                <Text style={[styles.count, { color: r.color }]}>{tf('trTimes', { n: r.count })}</Text>
              </View>
            </Card>
          ))
        )}

        <GKButton
          title={t('back')}
          variant="ghost"
          style={{ marginTop: spacing.md }}
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
  },
  subtitle: {
    color: colors.inkSoft,
    marginBottom: spacing.md,
  },
  totalCard: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  totalNumber: {
    fontSize: 52,
    fontWeight: '900',
    color: colors.gold,
  },
  empty: {
    color: colors.inkSoft,
    fontSize: font.body,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  rowLabel: {
    flex: 1,
    fontWeight: '800',
    color: colors.ink,
    fontSize: font.body,
  },
  countWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  count: {
    fontWeight: '900',
    fontSize: font.h2,
  },
});
