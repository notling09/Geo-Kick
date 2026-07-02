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
import type { FormationId, OwnedPlayer } from '../../core/domain/types';
import { effectiveOverall } from '../../core/engine/playerGen';
import { teamStrength } from '../../core/engine/strength';
import { useGameStore } from '../../state/gameStore';
import { GKButton, Card, SectionTitle } from '../../ui/components';
import { PlayerCard } from '../../ui/PlayerCard';
import { colors, font, radius, spacing } from '../../ui/theme';
import type { TabScreenProps } from '../../navigation/types';

/**
 * Kadermanagement (Kapitel 3.3): Aufstellung nach Formation, Positionen,
 * Bank und Zugriff auf Spieler-Details (Training über Duplikate).
 */
export function SquadScreen({ navigation }: TabScreenProps<'Kader'>) {
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
          <Text style={styles.title}>Kader</Text>
          <View style={styles.strengthBadge}>
            <Text style={styles.strengthText}>💪 {strength}</Text>
          </View>
        </View>

        <SectionTitle>Formation</SectionTitle>
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
        </View>

        <View style={styles.headerRow}>
          <SectionTitle>Aufstellung</SectionTitle>
          <GKButton title="Auto" variant="ghost" style={styles.autoBtn} onPress={autoLineup} />
        </View>
        {slots.map((pos, slot) => {
          const player = lineupList[slot];
          return (
            <Pressable key={slot} onPress={() => setPickSlot(slot)}>
              <Card style={styles.slotCard}>
                <View style={styles.slotBadge}>
                  <Text style={styles.slotBadgeText}>{pos}</Text>
                </View>
                {player ? (
                  <View style={styles.slotPlayer}>
                    <Text style={styles.slotPlayerName} numberOfLines={1}>
                      {player.pool.name}
                    </Text>
                    <Text style={styles.slotPlayerMeta}>
                      {POSITION_LABEL[player.pool.position]} · Lv. {player.level}
                      {player.pool.position !== pos ? '  ⚠️ fremde Position' : ''}
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.slotEmpty}>Slot frei – tippen zum Besetzen</Text>
                )}
                {player && (
                  <Text style={styles.slotOverall}>
                    {effectiveOverall(player.pool, player.level)}
                  </Text>
                )}
              </Card>
            </Pressable>
          );
        })}

        <SectionTitle>Bank ({bench.length})</SectionTitle>
        {bench.map((p) => (
          <PlayerCard
            key={p.id}
            player={p}
            onPress={() => navigation.navigate('PlayerDetail', { playerId: p.id })}
          />
        ))}
        {bench.length === 0 && (
          <Text style={styles.emptyText}>Keine Ersatzspieler – öffne Packs für Nachschub!</Text>
        )}
      </ScrollView>

      <Modal visible={pickSlot !== null} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>
              Slot {pickSlot !== null ? pickSlot + 1 : ''} (
              {pickSlot !== null ? POSITION_LABEL[slots[pickSlot]] : ''}) besetzen
            </Text>
            <FlatList
              data={pickCandidates}
              keyExtractor={(p) => String(p.id)}
              renderItem={({ item }) => (
                <PlayerCard
                  player={item}
                  compact
                  badge={lineup.includes(item.id) ? 'aufgestellt' : undefined}
                  onPress={async () => {
                    if (pickSlot !== null) await setLineupSlot(pickSlot, item.id);
                    setPickSlot(null);
                  }}
                />
              )}
            />
            <GKButton title="Schließen" variant="ghost" onPress={() => setPickSlot(null)} />
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
  },
  title: {
    fontSize: font.title,
    fontWeight: '900',
    color: colors.pitchDark,
    marginBottom: spacing.sm,
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
    gap: spacing.sm,
    marginBottom: spacing.md,
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
  slotCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    marginBottom: spacing.xs,
  },
  slotBadge: {
    width: 44,
    borderRadius: radius.sm,
    backgroundColor: colors.grass,
    alignItems: 'center',
    paddingVertical: 6,
    marginRight: spacing.sm,
  },
  slotBadgeText: {
    fontWeight: '900',
    color: colors.pitchDark,
    fontSize: font.small,
  },
  slotPlayer: {
    flex: 1,
  },
  slotPlayerName: {
    fontWeight: '800',
    color: colors.ink,
  },
  slotPlayerMeta: {
    fontSize: font.small,
    color: colors.inkSoft,
  },
  slotEmpty: {
    flex: 1,
    color: colors.inkSoft,
    fontStyle: 'italic',
    fontSize: font.small,
  },
  slotOverall: {
    fontSize: font.h1,
    fontWeight: '900',
    color: colors.pitch,
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
