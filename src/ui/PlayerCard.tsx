import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { POSITION_SHORT, RARITY_COLOR, RARITY_LABEL } from '../core/domain/constants';
import type { OwnedPlayer } from '../core/domain/types';
import { effectiveOverall } from '../core/engine/playerGen';
import { PlayerAvatar } from './PlayerAvatar';
import { colors, font, radius, spacing } from './theme';

/** Player list card with the drawn cartoon avatar; frame color = rarity. */

interface Props {
  player: OwnedPlayer;
  onPress?: () => void;
  compact?: boolean;
  badge?: string;
}

export function PlayerCard({ player, onPress, compact, badge }: Props) {
  const { pool, level } = player;
  const overall = effectiveOverall(pool, level);
  const rarityColor = RARITY_COLOR[pool.rarity];

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.card,
        { borderColor: rarityColor, opacity: pressed ? 0.75 : 1 },
        compact && styles.compact,
      ]}
    >
      <View style={styles.avatar}>
        <PlayerAvatar player={pool} size={46} />
      </View>
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {pool.name}
        </Text>
        <Text style={styles.meta}>
          {POSITION_SHORT[pool.position]} · {RARITY_LABEL[pool.rarity]} · Lv. {level}
        </Text>
      </View>
      <View style={styles.right}>
        {badge ? <Text style={styles.badge}>{badge}</Text> : null}
        <Text style={[styles.overall, { color: rarityColor }]}>{overall}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 2,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  compact: {
    padding: spacing.xs,
    marginBottom: spacing.xs,
  },
  avatar: {
    marginRight: spacing.sm,
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: font.body,
    fontWeight: '800',
    color: colors.ink,
  },
  meta: {
    fontSize: font.small,
    color: colors.inkSoft,
    marginTop: 2,
  },
  right: {
    alignItems: 'flex-end',
  },
  overall: {
    fontSize: font.h1,
    fontWeight: '900',
  },
  badge: {
    fontSize: font.small,
    color: colors.accentDark,
    fontWeight: '800',
  },
});
