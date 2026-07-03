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
import { SafeAreaView } from 'react-native-safe-area-context';
import { FORMATIONS, FORMATION_IDS, POSITION_LABEL } from '../../core/domain/constants';
import type { FormationId } from '../../core/domain/types';
import { effectiveOverall } from '../../core/engine/playerGen';
import { teamStrength } from '../../core/engine/strength';
import { useGameStore } from '../../state/gameStore';
import { GKButton } from '../../ui/components';
import { FormationPitch } from '../../ui/FormationPitch';
import { PlayerCard } from '../../ui/PlayerCard';
import { colors, font, radius, spacing } from '../../ui/theme';
import type { TabScreenProps } from '../../navigation/types';

/**
 * Squad management (chapter 3.3): the starting eleven laid out visually on
 * a drawn pitch per formation, bench below, player details via tap.
 */
export function SquadScreen({ navigation }: TabScreenProps<'Squad'>) {
  const { club, players, lineup, setFormation, setLineupSlot, autoLineup, lineupPlayers } =
    useGameStore();
  const [pickSlot, setPickSlot] = useState<number | null>(null);

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
          <Text style={styles.title}>Squad</Text>
          <View style={styles.strengthBadge}>
            <Text style={styles.strengthText}>Strength {strength}</Text>
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
          <GKButton title="Auto pick" variant="ghost" style={styles.autoBtn} onPress={autoLineup} />
        </View>

        <FormationPitch
          formation={formation}
          lineup={lineupList}
          onSlotPress={(slot) => setPickSlot(slot)}
        />
        <Text style={styles.pitchHint}>
          Tap a player on the pitch to change that slot. The badge shows the player's
          overall rating; an orange mark means he is playing out of position.
        </Text>

        <Text style={styles.benchTitle}>Bench ({bench.length})</Text>
        {bench.map((p) => (
          <PlayerCard
            key={p.id}
            player={p}
            onPress={() => navigation.navigate('PlayerDetail', { playerId: p.id })}
          />
        ))}
        {bench.length === 0 && (
          <Text style={styles.emptyText}>No substitutes - open packs to sign new players!</Text>
        )}
      </ScrollView>

      <Modal visible={pickSlot !== null} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>
              Fill slot: {pickSlot !== null ? POSITION_LABEL[slots[pickSlot]] : ''}
            </Text>
            <FlatList
              data={pickCandidates}
              keyExtractor={(p) => String(p.id)}
              renderItem={({ item }) => (
                <PlayerCard
                  player={item}
                  compact
                  badge={lineup.includes(item.id) ? 'in XI' : undefined}
                  onPress={async () => {
                    if (pickSlot !== null) await setLineupSlot(pickSlot, item.id);
                    setPickSlot(null);
                  }}
                />
              )}
            />
            <GKButton title="Close" variant="ghost" onPress={() => setPickSlot(null)} />
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
  pitchHint: {
    fontSize: font.small,
    color: colors.inkSoft,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  benchTitle: {
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
