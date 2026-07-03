import React, { useMemo } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BALANCING, POSITION_LABEL, RARITY_COLOR, RARITY_LABEL } from '../../core/domain/constants';
import { effectiveAttributes, effectiveOverall } from '../../core/engine/playerGen';
import { useGameStore } from '../../state/gameStore';
import { GKButton, Card, SectionTitle } from '../../ui/components';
import { PlayerAvatar } from '../../ui/PlayerAvatar';
import { colors, font, radius, spacing } from '../../ui/theme';
import type { RootScreenProps } from '../../navigation/types';

/**
 * Player detail: attributes, level and training via duplicates
 * (same player identity drawn from packs, chapter 3.3).
 */

const ATTR_LABELS: Array<[keyof ReturnType<typeof effectiveAttributes>, string]> = [
  ['tempo', 'Pace'],
  ['technik', 'Technique'],
  ['abschluss', 'Finishing'],
  ['verteidigung', 'Defending'],
  ['kondition', 'Stamina'],
];

export function PlayerDetailScreen({ route, navigation }: RootScreenProps<'PlayerDetail'>) {
  const { playerId } = route.params;
  const { players, trainPlayer } = useGameStore();

  const player = players.find((p) => p.id === playerId);
  const duplicates = useMemo(
    () => players.filter((p) => p.poolId === player?.poolId && p.id !== playerId),
    [players, player, playerId],
  );

  if (!player) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={styles.emptyText}>Player not found.</Text>
        <GKButton title="Back" variant="ghost" onPress={() => navigation.goBack()} />
      </SafeAreaView>
    );
  }

  const attrs = effectiveAttributes(player.pool, player.level);
  const overall = effectiveOverall(player.pool, player.level);
  const rarityColor = RARITY_COLOR[player.pool.rarity];
  const maxed = player.level >= BALANCING.maxPlayerLevel;

  const onTrain = async () => {
    const dup = duplicates[0];
    if (!dup) return;
    const ok = await trainPlayer(player.id, dup.id);
    if (ok) {
      Alert.alert('Training complete', `${player.pool.name} is now level ${player.level + 1}.`);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={[styles.hero, { backgroundColor: rarityColor }]}>
          <PlayerAvatar player={player.pool} size={96} />
          <Text style={styles.heroName}>{player.pool.name}</Text>
          <Text style={styles.heroMeta}>
            {POSITION_LABEL[player.pool.position]} · {RARITY_LABEL[player.pool.rarity]} · Level{' '}
            {player.level}
          </Text>
          <Text style={styles.heroOverall}>{overall}</Text>
        </View>

        <SectionTitle>Attributes</SectionTitle>
        <Card>
          {ATTR_LABELS.map(([key, label]) => (
            <View key={key} style={styles.attrRow}>
              <Text style={styles.attrLabel}>{label}</Text>
              <View style={styles.attrBarWrap}>
                <View
                  style={[
                    styles.attrBar,
                    { width: `${attrs[key]}%`, backgroundColor: rarityColor },
                  ]}
                />
              </View>
              <Text style={styles.attrValue}>{attrs[key]}</Text>
            </View>
          ))}
        </Card>

        <SectionTitle>Training</SectionTitle>
        <Card>
          <Text style={styles.trainText}>
            {maxed
              ? 'Maximum level reached!'
              : duplicates.length > 0
                ? `${duplicates.length} duplicate${duplicates.length > 1 ? 's' : ''} available. Consume one duplicate for +1 level (all attributes +1).`
                : 'No duplicates in your squad. Pull the same player from a pack to train him.'}
          </Text>
          <GKButton
            title="Use duplicate (+1 level)"
            onPress={onTrain}
            disabled={duplicates.length === 0 || maxed}
          />
        </Card>

        <GKButton
          title="Back"
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
  hero: {
    borderRadius: radius.lg,
    alignItems: 'center',
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  heroName: {
    fontSize: font.h1,
    fontWeight: '900',
    color: '#fff',
    marginTop: spacing.sm,
  },
  heroMeta: {
    color: 'rgba(255,255,255,0.9)',
    marginTop: 4,
    fontWeight: '600',
  },
  heroOverall: {
    fontSize: 46,
    fontWeight: '900',
    color: '#fff',
    marginTop: spacing.sm,
  },
  attrRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  attrLabel: {
    width: 100,
    fontSize: font.small,
    fontWeight: '700',
    color: colors.inkSoft,
  },
  attrBarWrap: {
    flex: 1,
    height: 10,
    backgroundColor: colors.grass,
    borderRadius: radius.round,
    overflow: 'hidden',
    marginRight: spacing.sm,
  },
  attrBar: {
    height: '100%',
    borderRadius: radius.round,
  },
  attrValue: {
    width: 32,
    textAlign: 'right',
    fontWeight: '900',
    color: colors.ink,
  },
  trainText: {
    color: colors.inkSoft,
    fontSize: font.small,
    marginBottom: spacing.sm,
  },
  emptyText: {
    padding: spacing.lg,
    color: colors.inkSoft,
  },
});
