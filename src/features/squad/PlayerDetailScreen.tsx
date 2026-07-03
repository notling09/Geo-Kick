import React from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { POSITION_LABEL, RARITY_COLOR, RARITY_LABEL, SELL_VALUE } from '../../core/domain/constants';
import { effectiveAttributes, effectiveOverall } from '../../core/engine/playerGen';
import { useGameStore } from '../../state/gameStore';
import { GKButton, Card, SectionTitle } from '../../ui/components';
import { PlayerAvatar } from '../../ui/PlayerAvatar';
import { colors, font, radius, spacing } from '../../ui/theme';
import type { RootScreenProps } from '../../navigation/types';

/**
 * Player detail: attributes plus selling for coins. Training happens at
 * pack opening: a drawn duplicate can be used for +1 level or sold.
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
  const { players, lineup, sellPlayer } = useGameStore();

  const player = players.find((p) => p.id === playerId);
  const inLineup = lineup.includes(playerId);

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
  const sellValue = SELL_VALUE[player.pool.rarity];

  const onSell = () => {
    Alert.alert(
      `Sell ${player.pool.name}?`,
      `You will receive ${sellValue} coins. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: `Sell for ${sellValue}`,
          style: 'destructive',
          onPress: async () => {
            const ok = await sellPlayer(player.id);
            if (ok) navigation.goBack();
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
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

        <SectionTitle>Sell</SectionTitle>
        <Card>
          <Text style={styles.trainText}>
            {inLineup
              ? 'This player is in your starting XI. Remove him from the lineup first to sell him.'
              : `Selling gives you ${sellValue} coins (${RARITY_LABEL[player.pool.rarity]}).`}
          </Text>
          <GKButton
            title={`Sell for ${sellValue} coins`}
            variant="danger"
            onPress={onSell}
            disabled={inLineup}
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
