import React, { useCallback } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { PACK_TYPES } from '../../core/domain/constants';
import { t, tf, type TKey } from '../../core/i18n';
import {
  PASS_MAX_LEVEL, POINTS_PER_LEVEL, type MissionType, type PassReward,
} from '../../core/services/pass';
import { usePassStore } from '../../state/passStore';
import { GKButton, Card } from '../../ui/components';
import { colors, font, radius, spacing } from '../../ui/theme';
import type { RootScreenProps } from '../../navigation/types';

/**
 * Saisonpass (V7.7): Tages-Missionen + Level-Belohnungen. Wöchentlicher Reset.
 * Belohnungen holt man per Antippen ab (wie FIFA Ultimate Team).
 */

const MISSION_KEY: Record<MissionType, TKey> = {
  win: 'passMWin', goal: 'passMGoal', cleanSheet: 'passMClean', checkin: 'passMCheckin',
  pitchWin: 'passMPitch', boss: 'passMBoss', openPack: 'passMPack', marketBuy: 'passMMarket',
  captainGoal: 'passMCaptain', clWin: 'passMCl', rivalWin: 'passMRival', egg: 'passMEgg',
  onlineWin: 'passMOnline', chemFull: 'passMChem',
};

function rewardText(r: PassReward | null): string {
  if (!r) return '';
  switch (r.kind) {
    case 'coins': return tf('passRCoins', { n: r.amount });
    case 'points': return tf('passRPoints', { n: r.amount });
    case 'tokens': return tf('passRTokens', { n: r.amount });
    case 'pack': return tf('passRPack', { n: r.count, pack: PACK_TYPES[r.pack].label });
    case 'player': return t('passRPlayer');
  }
}

const MILESTONES = new Set([5, 10, 15, 20]);

export function SeasonPassScreen({ navigation }: RootScreenProps<'SeasonPass'>) {
  const { snapshot, refresh, claim } = usePassStore();

  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));

  const onClaim = async (level: number) => {
    const reward = await claim(level);
    if (reward) {
      // Kurze Bestätigung reicht – der Balken/Track aktualisiert sich selbst.
    }
  };

  const level = snapshot?.level ?? 1;
  const pil = snapshot?.pointsInLevel ?? 0;
  const pct = Math.min(100, (pil / POINTS_PER_LEVEL) * 100);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>{t('passTitle')}</Text>
        <Text style={styles.subtitle}>
          {tf('passResetIn', { n: snapshot?.daysLeft ?? 7 })}
        </Text>

        <Card style={styles.levelCard}>
          <View style={styles.levelRow}>
            <Text style={styles.levelBig}>{tf('passLevel', { n: level })}</Text>
            <Text style={styles.levelMax}>/ {PASS_MAX_LEVEL}</Text>
          </View>
          <View style={styles.barWrap}>
            <View style={[styles.barFill, { width: `${pct}%` }]} />
          </View>
          <Text style={styles.pointsText}>
            {tf('passPoints', { a: pil, b: POINTS_PER_LEVEL })}
          </Text>
        </Card>

        <Text style={styles.section}>{t('passMissions')}</Text>
        {(snapshot?.missions ?? []).map((m) => (
          <Card key={m.id} style={[styles.missionCard, m.done && styles.missionDone]}>
            <View style={styles.missionInfo}>
              <Text style={[styles.missionText, m.done && styles.missionTextDone]}>
                {tf(MISSION_KEY[m.type], { n: m.goal })}
              </Text>
              <Text style={styles.missionMeta}>
                {m.done ? t('passDone') : tf('passProgress', { a: m.progress, b: m.goal })}
              </Text>
            </View>
            <Text style={[styles.missionPts, m.done && styles.missionPtsDone]}>+{m.points}</Text>
          </Card>
        ))}

        <Text style={styles.section}>{t('passRewards')}</Text>
        {(snapshot?.rewards ?? []).map((r) => {
          const canClaim = r.reached && !r.claimed;
          const milestone = MILESTONES.has(r.level);
          return (
            <Card
              key={r.level}
              style={[styles.rewardCard, milestone && styles.rewardMilestone, r.claimed && styles.rewardClaimed]}
            >
              <View style={[styles.levelBadge, milestone && styles.levelBadgeMilestone]}>
                <Text style={styles.levelBadgeText}>{r.level}</Text>
              </View>
              <Text style={styles.rewardText} numberOfLines={2}>{rewardText(r.reward)}</Text>
              {r.claimed ? (
                <Text style={styles.claimedText}>{t('passClaimed')}</Text>
              ) : canClaim ? (
                <GKButton title={t('passClaim')} onPress={() => onClaim(r.level)} style={styles.claimBtn} />
              ) : (
                <Text style={styles.lockedText}>{tf('passLevelShort', { n: r.level })}</Text>
              )}
            </Card>
          );
        })}

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

const PURPLE = '#7d3fb0';

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.md, paddingBottom: spacing.xl },
  title: { fontSize: font.title, fontWeight: '900', color: colors.pitchDark },
  subtitle: { color: colors.inkSoft, marginBottom: spacing.md },
  levelCard: { padding: spacing.md, marginBottom: spacing.md },
  levelRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.xs },
  levelBig: { fontSize: font.h1, fontWeight: '900', color: PURPLE },
  levelMax: { fontSize: font.body, fontWeight: '800', color: colors.inkSoft },
  barWrap: {
    height: 12, borderRadius: 6, backgroundColor: colors.line, overflow: 'hidden', marginVertical: spacing.sm,
  },
  barFill: { height: '100%', borderRadius: 6, backgroundColor: PURPLE },
  pointsText: { color: colors.inkSoft, fontWeight: '700', fontSize: font.small },
  section: { fontSize: font.h2, fontWeight: '900', color: colors.ink, marginTop: spacing.md, marginBottom: spacing.sm },
  missionCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    padding: spacing.sm, marginBottom: spacing.xs,
  },
  missionDone: { opacity: 0.6 },
  missionInfo: { flex: 1 },
  missionText: { fontWeight: '800', color: colors.ink, fontSize: font.body },
  missionTextDone: { textDecorationLine: 'line-through' },
  missionMeta: { color: colors.inkSoft, fontSize: font.small, marginTop: 2 },
  missionPts: { fontWeight: '900', color: PURPLE, fontSize: font.body },
  missionPtsDone: { color: colors.pitch },
  rewardCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    padding: spacing.sm, marginBottom: spacing.xs,
  },
  rewardMilestone: { borderWidth: 2, borderColor: colors.gold },
  rewardClaimed: { opacity: 0.55 },
  levelBadge: {
    width: 34, height: 34, borderRadius: radius.round, backgroundColor: colors.inkSoft,
    alignItems: 'center', justifyContent: 'center', flex: 0,
  },
  levelBadgeMilestone: { backgroundColor: PURPLE },
  levelBadgeText: { color: '#fff', fontWeight: '900' },
  rewardText: { flex: 1, fontWeight: '700', color: colors.ink, fontSize: font.small },
  claimBtn: { paddingVertical: 8, paddingHorizontal: spacing.md },
  claimedText: { color: colors.pitch, fontWeight: '800', fontSize: font.small },
  lockedText: { color: colors.inkSoft, fontWeight: '700', fontSize: font.small },
});
