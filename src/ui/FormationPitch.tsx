import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { FORMATIONS, POSITION_SHORT } from '../core/domain/constants';
import type { FormationId, OwnedPlayer, Position } from '../core/domain/types';
import { effectiveOverall } from '../core/engine/playerGen';
import { PitchBackground } from './PitchBackground';
import { PlayerAvatar } from './PlayerAvatar';
import { colors, font, radius } from './theme';

/**
 * Visual formation view: the starting eleven laid out on a drawn pitch,
 * goalkeeper at the bottom, attack at the top. Tapping a slot opens the
 * player picker.
 */

const LINE_Y: Record<Position, number> = {
  TW: 88,
  ABW: 70,
  MF: 47,
  ST: 24,
};

export interface SlotLayout {
  slot: number;
  position: Position;
  xPct: number;
  yPct: number;
}

export function formationLayout(formation: FormationId): SlotLayout[] {
  const slots = FORMATIONS[formation];
  const byLine = new Map<Position, number[]>();
  slots.forEach((pos, slot) => {
    const list = byLine.get(pos) ?? [];
    list.push(slot);
    byLine.set(pos, list);
  });
  const layout: SlotLayout[] = [];
  byLine.forEach((slotIdxs, pos) => {
    slotIdxs.forEach((slot, i) => {
      layout.push({
        slot,
        position: pos,
        xPct: ((i + 1) / (slotIdxs.length + 1)) * 100,
        yPct: LINE_Y[pos],
      });
    });
  });
  return layout;
}

interface Props {
  formation: FormationId;
  lineup: Array<OwnedPlayer | null>;
  onSlotPress: (slot: number) => void;
}

const CHIP_W = 72;
const CHIP_H = 64;

export function FormationPitch({ formation, lineup, onSlotPress }: Props) {
  const [size, setSize] = React.useState({ w: 0, h: 0 });
  const layout = formationLayout(formation);

  return (
    <View
      style={styles.wrap}
      onLayout={(e) =>
        setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })
      }
    >
      {size.w > 0 && <PitchBackground width={size.w} height={size.h} />}
      {size.w > 0 &&
        layout.map(({ slot, position, xPct, yPct }) => {
          const player = lineup[slot];
          const left = (xPct / 100) * size.w - CHIP_W / 2;
          const top = (yPct / 100) * size.h - CHIP_H / 2;
          return (
            <Pressable
              key={slot}
              onPress={() => onSlotPress(slot)}
              style={[styles.chip, { left, top }]}
            >
              {player ? (
                <>
                  <View style={styles.avatarWrap}>
                    <PlayerAvatar player={player.pool} size={40} />
                    <View style={styles.ovBadge}>
                      <Text style={styles.ovText}>
                        {effectiveOverall(player.pool, player.level)}
                      </Text>
                    </View>
                    {player.pool.position !== position && (
                      <View style={styles.warnBadge}>
                        <Text style={styles.warnText}>!</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.chipName} numberOfLines={1}>
                    {player.pool.name.split(' ').pop()}
                  </Text>
                </>
              ) : (
                <>
                  <View style={styles.emptySlot}>
                    <Text style={styles.emptyText}>{POSITION_SHORT[position]}</Text>
                  </View>
                  <Text style={styles.chipName}>tap to fill</Text>
                </>
              )}
            </Pressable>
          );
        })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    aspectRatio: 100 / 150,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  chip: {
    position: 'absolute',
    width: CHIP_W,
    height: CHIP_H,
    alignItems: 'center',
  },
  avatarWrap: {
    width: 40,
    height: 40,
  },
  ovBadge: {
    position: 'absolute',
    right: -10,
    top: -4,
    backgroundColor: colors.ink,
    borderRadius: radius.round,
    paddingHorizontal: 5,
    paddingVertical: 1,
    minWidth: 22,
    alignItems: 'center',
  },
  ovText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '900',
  },
  warnBadge: {
    position: 'absolute',
    left: -8,
    top: -4,
    backgroundColor: colors.accent,
    borderRadius: radius.round,
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  warnText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '900',
  },
  chipName: {
    marginTop: 2,
    fontSize: 10,
    fontWeight: '800',
    color: '#fff',
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radius.round,
    maxWidth: CHIP_W,
  },
  emptySlot: {
    width: 40,
    height: 40,
    borderRadius: radius.round,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '900',
  },
});
