import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fetchLeaderboard, type CloudSquadPlayer, type LeaderboardEntry } from '../../core/services/cloud';
import { overallOf } from '../../core/engine/playerGen';
import type { Position } from '../../core/domain/types';
import { t, tf } from '../../core/i18n';
import { useCloudStore } from '../../state/cloudStore';
import { GKButton, Card } from '../../ui/components';
import { Crest } from '../../ui/Crest';
import { IconStar } from '../../ui/icons';
import { colors, font, radius, spacing } from '../../ui/theme';
import type { RootScreenProps } from '../../navigation/types';

/**
 * Weltweite Bestenliste (V7): die 10 stärksten Klubs aller Spieler, mit
 * Name, Team-Stärke und bestem Spieler. Platz 1/2/3 bekommen einen goldenen,
 * silbernen bzw. bronzenen Rahmen.
 */

const PODIUM = ['#E8B923', '#9BA6B2', '#B0743B']; // Gold, Silber, Bronze

/** Overall eines Cloud-Kaderspielers (Attribute sind schon effektiv). */
function squadOverall(p: CloudSquadPlayer): number {
  return overallOf(p, p.position as Position);
}

export function LeaderboardScreen({ navigation }: RootScreenProps<'Leaderboard'>) {
  const cloudStatus = useCloudStore((s) => s.status);
  const [entries, setEntries] = useState<LeaderboardEntry[] | null>(null);

  const load = useCallback(async () => {
    if (cloudStatus !== 'online') return;
    setEntries(await fetchLeaderboard(squadOverall, 10));
  }, [cloudStatus]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>{t('lbTitle')}</Text>
        <Text style={styles.subtitle}>{t('lbSubtitle')}</Text>

        {cloudStatus !== 'online' ? (
          <Card>
            <Text style={styles.info}>{t('lbOffline')}</Text>
          </Card>
        ) : entries === null ? (
          <ActivityIndicator color={colors.pitch} style={{ marginTop: spacing.xl }} />
        ) : entries.length === 0 ? (
          <Card>
            <Text style={styles.info}>{t('lbEmpty')}</Text>
          </Card>
        ) : (
          entries.map((e, i) => {
            const podium = i < 3 ? PODIUM[i] : null;
            return (
              <Card
                key={e.id}
                style={[
                  styles.row,
                  podium ? { borderColor: podium, borderWidth: 3 } : null,
                ]}
              >
                <View style={[styles.rankBadge, podium ? { backgroundColor: podium } : null]}>
                  <Text style={[styles.rankText, podium ? { color: '#1A2E1A' } : null]}>
                    {i + 1}
                  </Text>
                </View>
                <Crest crestId={e.crest} size={40} />
                <View style={styles.info2}>
                  <Text style={styles.clubName} numberOfLines={1}>
                    {e.clubName}
                  </Text>
                  <Text style={styles.best} numberOfLines={1}>
                    {e.bestPlayer
                      ? tf('lbBest', { name: e.bestPlayer, ovr: e.bestOverall })
                      : tf('rvDivision', { n: e.division })}
                  </Text>
                </View>
                <View style={styles.strengthWrap}>
                  <IconStar size={14} color={podium ?? colors.pitch} />
                  <Text style={styles.strength}>{e.strength}</Text>
                </View>
              </Card>
            );
          })
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
  info: {
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
  rankBadge: {
    width: 28,
    height: 28,
    borderRadius: radius.round,
    backgroundColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: {
    fontWeight: '900',
    color: colors.ink,
    fontSize: font.small,
  },
  info2: {
    flex: 1,
  },
  clubName: {
    fontWeight: '800',
    color: colors.ink,
    fontSize: font.body,
  },
  best: {
    fontSize: font.small,
    color: colors.inkSoft,
    marginTop: 2,
  },
  strengthWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  strength: {
    fontWeight: '900',
    color: colors.pitchDark,
    fontSize: font.h2,
  },
});
