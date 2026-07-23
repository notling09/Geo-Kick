import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { POSITION_SHORT, RARITY_COLOR, RARITY_LABEL } from '../core/domain/constants';
import type { OwnedPlayer } from '../core/domain/types';
import { effectiveOverall } from '../core/engine/playerGen';
import { formStage } from '../core/services/form';
import { PlayerAvatar } from './PlayerAvatar';
import { colors, font, radius, spacing } from './theme';

/** Player list card with the drawn cartoon avatar; frame color = rarity. */

/** Farbe je Form-Stufe (0 = schlecht … 4 = top), V7.2. */
const FORM_COLORS = ['#C62828', '#EF6C00', '#9E9E9E', '#7CB342', '#2E7D32'];

/** Kleiner 5-Segment-Formbalken (kein Emoji, reine Views). */
export function FormBars({ stage }: { stage: 0 | 1 | 2 | 3 | 4 }) {
  return (
    <View style={styles.formBars}>
      {[0, 1, 2, 3, 4].map((i) => (
        <View
          key={i}
          style={[
            styles.formBar,
            { height: 4 + i * 2 },
            { backgroundColor: i <= stage ? FORM_COLORS[stage] : colors.line },
          ]}
        />
      ))}
    </View>
  );
}

interface Props {
  player: OwnedPlayer;
  onPress?: () => void;
  compact?: boolean;
  badge?: string;
  /** Form 0–100 (V7.2); zeigt einen Formbalken, falls gesetzt. */
  form?: number;
}

export function PlayerCard({ player, onPress, compact, badge, form }: Props) {
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
        <View style={styles.metaRow}>
          <Text style={styles.meta}>
            {POSITION_SHORT[pool.position]} · {RARITY_LABEL[pool.rarity]} · Lv. {level}
          </Text>
          {form !== undefined && <FormBars stage={formStage(form)} />}
        </View>
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
  metaRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    marginTop: 2,
  },
  meta: {
    fontSize: font.small,
    color: colors.inkSoft,
  },
  formBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 1.5,
    height: 12,
  },
  formBar: {
    width: 2.5,
    borderRadius: 1,
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
