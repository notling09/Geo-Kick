import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { FORMATIONS, FORMATION_IDS, LEAGUE_REWARDS, POSITION_LABEL } from '../../core/domain/constants';
import { t, tf } from '../../core/i18n';
import type { FormationId } from '../../core/domain/types';
import { effectiveOverall } from '../../core/engine/playerGen';
import { teamStrength } from '../../core/engine/strength';
import { useGameStore } from '../../state/gameStore';
import { useLeagueStore } from '../../state/leagueStore';
import { GKButton, PointsBadge } from '../../ui/components';
import { FormationPitch } from '../../ui/FormationPitch';
import { PlayerCard } from '../../ui/PlayerCard';
import { colors, font, radius, spacing } from '../../ui/theme';
import type { TabScreenProps } from '../../navigation/types';

/**
 * Squad management (chapter 3.3): the starting eleven laid out visually on
 * a drawn pitch per formation, bench below, player details via tap.
 */
export function SquadScreen({ navigation }: TabScreenProps<'Squad'>) {
  const {
    club, players, lineup, captainPlayerId, levelPoints,
    setFormation, setLineupSlot, autoLineup, lineupPlayers, setCaptain,
  } = useGameStore();
  const leagueSeason = useLeagueStore((s) => s.season);
  const leagueRound = useLeagueStore((s) => s.round);
  const suspensions = useLeagueStore((s) => s.suspensions);
  const [pickSlot, setPickSlot] = useState<number | null>(null);
  const [pickingCaptain, setPickingCaptain] = useState(false);
  const insets = useSafeAreaInsets();

  // Für das NÄCHSTE Ligaspiel gesperrte Spieler (rote Karte)
  const suspendedIds = useMemo(
    () =>
      new Set(
        suspensions
          .filter((s) => s.season === leagueSeason && s.round === leagueRound)
          .map((s) => s.playerId),
      ),
    [suspensions, leagueSeason, leagueRound],
  );

  const formation: FormationId = club?.formation ?? '4-4-2';
  const slots = FORMATIONS[formation];
  const lineupList = lineupPlayers();
  const strength = teamStrength(lineupList, formation);

  const bench = useMemo(
    () =>
      players
        .filter((p) => !lineup.includes(p.id))
        .sort((a, b) => effectiveOverall(b.pool, b.level) - effectiveOverall(a.pool, a.level)),
    [players, lineup],
  );

  const pickCandidates = useMemo(() => {
    if (pickSlot === null) return [];
    const pos = slots[pickSlot];
    return [...players].sort((a, b) => {
      const aOn = a.pool.position === pos ? 1 : 0;
      const bOn = b.pool.position === pos ? 1 : 0;
      return bOn - aOn || effectiveOverall(b.pool, b.level) - effectiveOverall(a.pool, a.level);
    });
  }, [pickSlot, players, slots]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>{t('sqTitle')}</Text>
          <View style={styles.headerBadges}>
            <View style={styles.strengthBadge}>
              <Text style={styles.strengthText}>{tf('sqStrength', { n: strength })}</Text>
            </View>
            <PointsBadge points={levelPoints} />
          </View>
        </View>

        <View style={styles.formationRow}>
          {FORMATION_IDS.map((f) => (
            <Pressable
              key={f}
              onPress={() => setFormation(f)}
              style={[styles.formationChip, formation === f && styles.formationActive]}
            >
              <Text
                style={[styles.formationText, formation === f && styles.formationTextActive]}
              >
                {f}
              </Text>
            </Pressable>
          ))}
          <View style={{ flex: 1 }} />
          <GKButton title={t('sqBestXI')} variant="ghost" style={styles.autoBtn} onPress={autoLineup} />
        </View>

        <View>
          <FormationPitch
            formation={formation}
            lineup={lineupList}
            onPlayerPress={(playerId) => navigation.navigate('PlayerDetail', { playerId })}
            onSwapPress={(slot) => setPickSlot(slot)}
            captainId={captainPlayerId}
            suspendedIds={suspendedIds}
          />
          {/* Captain wechseln (V2): Button oben links über dem Feld */}
          <Pressable style={styles.captainBtn} onPress={() => setPickingCaptain(true)}>
            <Text style={styles.captainBtnText}>C</Text>
          </Pressable>
        </View>
        {suspendedIds.size > 0 && (
          <Text style={styles.suspendedHint}>
            {tf('sqSuspendedHint', {
              names: players
                .filter((p) => suspendedIds.has(p.id))
                .map((p) => p.pool.name)
                .join(', '),
            })}
          </Text>
        )}
        <Text style={styles.benchTitle}>{tf('sqBench', { n: bench.length })}</Text>
        {bench.map((p) => (
          <PlayerCard
            key={p.id}
            player={p}
            onPress={() => navigation.navigate('PlayerDetail', { playerId: p.id })}
          />
        ))}
        {bench.length === 0 && (
          <Text style={styles.emptyText}>{t('sqEmptyBench')}</Text>
        )}
      </ScrollView>

      <Modal visible={pickingCaptain} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalSheet, { paddingBottom: insets.bottom + spacing.md }]}>
            <Text style={styles.modalTitle}>{t('sqCaptainTitle')}</Text>
            <Text style={styles.captainHint}>
              {tf('sqCaptainHint', { g: LEAGUE_REWARDS.captainGoal, a: LEAGUE_REWARDS.captainAssist })}
            </Text>
            <FlatList
              data={lineupList.filter((p): p is NonNullable<typeof p> => p !== null)}
              keyExtractor={(p) => String(p.id)}
              renderItem={({ item }) => (
                <PlayerCard
                  player={item}
                  compact
                  badge={item.id === captainPlayerId ? 'captain' : undefined}
                  onPress={async () => {
                    await setCaptain(item.id);
                    setPickingCaptain(false);
                  }}
                />
              )}
            />
            <GKButton title={t('close')} variant="ghost" onPress={() => setPickingCaptain(false)} />
          </View>
        </View>
      </Modal>

      <Modal visible={pickSlot !== null} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalSheet, { paddingBottom: insets.bottom + spacing.md }]}>
            <Text style={styles.modalTitle}>
              {tf('sqFillSlot', { pos: pickSlot !== null ? POSITION_LABEL[slots[pickSlot]] : '' })}
            </Text>
            <FlatList
              data={pickCandidates}
              keyExtractor={(p) => String(p.id)}
              renderItem={({ item }) => (
                <PlayerCard
                  player={item}
                  compact
                  badge={lineup.includes(item.id) ? t('sqInXI') : undefined}
                  onPress={async () => {
                    if (pickSlot !== null) await setLineupSlot(pickSlot, item.id);
                    setPickSlot(null);
                  }}
                />
              )}
            />
            <GKButton title={t('close')} variant="ghost" onPress={() => setPickSlot(null)} />
          </View>
        </View>
      </Modal>
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: font.title,
    fontWeight: '900',
    color: colors.pitchDark,
  },
  headerBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  strengthBadge: {
    backgroundColor: colors.pitch,
    borderRadius: radius.round,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  strengthText: {
    color: '#fff',
    fontWeight: '900',
  },
  formationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  formationChip: {
    borderRadius: radius.round,
    borderWidth: 2,
    borderColor: colors.pitch,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
  },
  formationActive: {
    backgroundColor: colors.pitch,
  },
  formationText: {
    fontWeight: '800',
    color: colors.pitch,
  },
  formationTextActive: {
    color: '#fff',
  },
  autoBtn: {
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
  },
  captainBtn: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    width: 36,
    height: 36,
    borderRadius: radius.round,
    backgroundColor: colors.gold,
    borderWidth: 2,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
  },
  captainBtnText: {
    fontWeight: '900',
    fontSize: font.h2,
    color: colors.ink,
  },
  captainHint: {
    fontSize: font.small,
    color: colors.inkSoft,
    marginBottom: spacing.sm,
  },
  suspendedHint: {
    fontSize: font.small,
    color: colors.danger,
    fontWeight: '700',
    marginTop: spacing.sm,
  },
  benchTitle: {
    marginTop: spacing.md,
    fontSize: font.h2,
    fontWeight: '800',
    color: colors.ink,
    marginBottom: spacing.sm,
  },
  emptyText: {
    color: colors.inkSoft,
    fontStyle: 'italic',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.md,
    maxHeight: '75%',
  },
  modalTitle: {
    fontSize: font.h2,
    fontWeight: '800',
    color: colors.ink,
    marginBottom: spacing.sm,
  },
});
