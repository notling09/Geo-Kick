import React from 'react';
import { PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import { FORMATIONS, POSITION_SHORT } from '../core/domain/constants';
import type { FormationId, OwnedPlayer, Position } from '../core/domain/types';
import { t } from '../core/i18n';
import { effectiveOverall } from '../core/engine/playerGen';
import { slotChemState, type ChemState } from '../core/engine/chemistry';
import { IconSwap } from './icons';
import { PitchBackground } from './PitchBackground';
import { PlayerAvatar } from './PlayerAvatar';
import { colors, font, radius } from './theme';

/**
 * Visual formation view (V7.6): die Startelf auf dem Feld, Torwart unten.
 * Jeder Slot leuchtet je Chemie: grün = passt (Haupt-/Nebenposition),
 * gelb = daneben (kein Verlust, keine Chemie), rot = passt nicht (−Stärke).
 */

/** Feste Slot-Koordinaten je Formation (Reihenfolge = FORMATIONS-Reihenfolge). */
const COORDS: Record<FormationId, Array<[number, number]>> = {
  '4-2-2-2': [
    [50, 90], [12, 70], [37, 73], [63, 73], [88, 70],
    [16, 47], [39, 47], [61, 47], [84, 47], [38, 22], [62, 22],
  ],
  '4-3-3': [
    [50, 90], [12, 70], [37, 73], [63, 73], [88, 70],
    [28, 48], [50, 48], [72, 48], [16, 24], [50, 20], [84, 24],
  ],
  '4-2-4': [
    [50, 90], [12, 70], [37, 73], [63, 73], [88, 70],
    [36, 50], [64, 50], [13, 26], [38, 22], [62, 22], [87, 26],
  ],
  '3-5-2': [
    [50, 90], [27, 73], [50, 75], [73, 73], [12, 50],
    [34, 49], [50, 49], [66, 49], [88, 50], [38, 22], [62, 22],
  ],
};

// „Gut" ist ein sehr helles Grün – hebt sich klar vom dunkleren Spielfeld ab
// und bleibt positiv/„grün" (V7.7).
const CHEM_COLOR: Record<ChemState, string> = {
  green: '#B9F6CA',
  yellow: '#E8B923',
  red: '#C62828',
};
/** Textfarbe auf dem Positions-Tag: dunkel auf hellem Grün/Gelb, weiß auf Rot. */
const CHEM_TAG_TEXT: Record<ChemState, string> = {
  green: '#12301A',
  yellow: '#3A2A00',
  red: '#ffffff',
};

export interface SlotLayout {
  slot: number;
  position: Position;
  xPct: number;
  yPct: number;
}

export function formationLayout(formation: FormationId): SlotLayout[] {
  const slots = FORMATIONS[formation];
  return COORDS[formation].map(([xPct, yPct], slot) => ({
    slot,
    position: slots[slot],
    xPct,
    yPct,
  }));
}

interface Props {
  formation: FormationId;
  lineup: Array<OwnedPlayer | null>;
  /** Tap auf den Spieler selbst → Details (wie auf der Bank) */
  onPlayerPress: (playerId: number) => void;
  /** Tap auf den Tausch-Button (bzw. leeren Slot) → Picker für diesen Slot */
  onSwapPress: (slot: number) => void;
  /** Zwei Slots tauschen (Drag&Drop: Spieler lang drücken und ziehen), V7.7 */
  onSwapSlots?: (a: number, b: number) => void;
  /** Captain bekommt das goldene C-Badge (V2) */
  captainId?: number | null;
  /** Gesperrte Spieler (rote Karte) bekommen das Rote-Karte-Badge */
  suspendedIds?: Set<number>;
  /**
   * An die verfügbare HÖHE anpassen statt an die Breite (V6.4): im
   * Halbzeit-Wechsel-Modal ist die Höhe begrenzt – mit der Breiten-Variante
   * wurde das Feld höher als der Platz und der Torwart verschwand
   * abgeschnitten hinter der Bank.
   */
  fitHeight?: boolean;
}

const CHIP_W = 72;
const CHIP_H = 64;

export function FormationPitch({
  formation, lineup, onPlayerPress, onSwapPress, onSwapSlots, captainId, suspendedIds, fitHeight,
}: Props) {
  const [size, setSize] = React.useState({ w: 0, h: 0 });
  const layout = formationLayout(formation);

  // Drag & Drop (V7.7): einen Spieler lang drücken und ziehen → auf den
  // nächstgelegenen Slot fallen lassen = Positionen tauschen.
  const [drag, setDrag] = React.useState<{ slot: number; dx: number; dy: number } | null>(null);
  const armedRef = React.useRef<number | null>(null);
  const sizeRef = React.useRef(size); sizeRef.current = size;
  const layoutRef = React.useRef(layout); layoutRef.current = layout;
  const onSwapRef = React.useRef(onSwapSlots); onSwapRef.current = onSwapSlots;
  const respondersRef = React.useRef<Record<number, ReturnType<typeof PanResponder.create>>>({});

  const getResponder = (slot: number) => {
    if (!respondersRef.current[slot]) {
      respondersRef.current[slot] = PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_e, g) =>
          armedRef.current === slot && (Math.abs(g.dx) > 4 || Math.abs(g.dy) > 4),
        onPanResponderMove: (_e, g) => setDrag({ slot, dx: g.dx, dy: g.dy }),
        onPanResponderRelease: (_e, g) => {
          const s = sizeRef.current;
          const from = layoutRef.current.find((x) => x.slot === slot);
          if (from && s.w > 0) {
            const cx = (from.xPct / 100) * s.w + g.dx;
            const cy = (from.yPct / 100) * s.h + g.dy;
            let best = -1;
            let bestD = Infinity;
            layoutRef.current.forEach(({ slot: sl, xPct, yPct }) => {
              const ddx = (xPct / 100) * s.w - cx;
              const ddy = (yPct / 100) * s.h - cy;
              const d = ddx * ddx + ddy * ddy;
              if (d < bestD) { bestD = d; best = sl; }
            });
            if (best >= 0 && best !== slot) onSwapRef.current?.(slot, best);
          }
          armedRef.current = null;
          setDrag(null);
        },
        onPanResponderTerminate: () => { armedRef.current = null; setDrag(null); },
      });
    }
    return respondersRef.current[slot];
  };

  return (
    <View
      style={fitHeight ? styles.wrapFit : styles.wrap}
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
          const chem: ChemState | null = player ? slotChemState(position, player.pool) : null;
          const dragging = drag?.slot === slot;
          const dragStyle = dragging
            ? { transform: [{ translateX: drag!.dx }, { translateY: drag!.dy }], zIndex: 20, elevation: 20 }
            : null;
          const panHandlers = player && onSwapSlots ? getResponder(slot).panHandlers : {};
          return (
            <View key={slot} style={[styles.chip, { left, top }, dragStyle]} {...panHandlers}>
              {player ? (
                <>
                  <Pressable
                    onPress={() => onPlayerPress(player.id)}
                    onLongPress={() => { if (onSwapSlots) armedRef.current = slot; }}
                    onPressOut={() => { armedRef.current = null; }}
                    delayLongPress={250}
                    style={styles.avatarWrap}
                  >
                    {chem && (
                      <View style={[styles.chemRing, { borderColor: CHEM_COLOR[chem] }]} />
                    )}
                    <PlayerAvatar player={player.pool} size={40} />
                    <View style={styles.ovBadge}>
                      <Text style={styles.ovText}>
                        {effectiveOverall(player.pool, player.level)}
                      </Text>
                    </View>
                    {captainId === player.id && (
                      <View style={styles.captainBadge}>
                        <Text style={styles.captainText}>C</Text>
                      </View>
                    )}
                    {suspendedIds?.has(player.id) && <View style={styles.suspendedBadge} />}
                    <View style={[styles.posTag, { backgroundColor: chem ? CHEM_COLOR[chem] : colors.inkSoft }]}>
                      <Text style={[styles.posTagText, chem && { color: CHEM_TAG_TEXT[chem] }]}>{POSITION_SHORT[position]}</Text>
                    </View>
                    <Pressable
                      onPress={() => onSwapPress(slot)}
                      hitSlop={6}
                      style={styles.swapBadge}
                    >
                      <IconSwap color="#fff" size={12} />
                    </Pressable>
                  </Pressable>
                  <Text style={styles.chipName} numberOfLines={1}>
                    {player.pool.name.split(' ').pop()}
                  </Text>
                </>
              ) : (
                <>
                  <Pressable onPress={() => onSwapPress(slot)} style={styles.emptySlot}>
                    <Text style={styles.emptyText}>{POSITION_SHORT[position]}</Text>
                  </Pressable>
                  <Text style={styles.chipName}>{t('sqTapFill')}</Text>
                </>
              )}
            </View>
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
  wrapFit: {
    height: '100%',
    maxWidth: '100%',
    aspectRatio: 100 / 150,
    alignSelf: 'center',
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
  chemRing: {
    position: 'absolute',
    left: -3,
    top: -3,
    width: 46,
    height: 46,
    borderRadius: radius.round,
    borderWidth: 2.5,
  },
  ovBadge: {
    position: 'absolute',
    right: -10,
    top: -4,
    // Fest dunkel: liegt auf dem grünen Feld, unabhängig vom Theme (V6.2)
    backgroundColor: '#1A2E1A',
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
  // kleiner Positions-Tag (Soll-Position des Slots), eingefärbt nach Chemie
  posTag: {
    position: 'absolute',
    left: -8,
    bottom: -4,
    borderRadius: radius.round,
    paddingHorizontal: 4,
    paddingVertical: 1,
    minWidth: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#fff',
  },
  posTagText: {
    color: '#fff',
    fontSize: 8,
    fontWeight: '900',
  },
  captainBadge: {
    position: 'absolute',
    left: -10,
    top: -6,
    backgroundColor: colors.gold,
    borderRadius: radius.round,
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  captainText: {
    color: colors.ink,
    fontSize: 11,
    fontWeight: '900',
  },
  // kleine rote Karte (Sperre fürs nächste Ligaspiel) – mittig links
  suspendedBadge: {
    position: 'absolute',
    left: -9,
    top: 13,
    width: 12,
    height: 16,
    borderRadius: 2,
    backgroundColor: colors.danger,
    borderWidth: 1,
    borderColor: '#fff',
  },
  swapBadge: {
    position: 'absolute',
    right: -10,
    bottom: -4,
    backgroundColor: colors.sky,
    borderRadius: radius.round,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  chipName: {
    marginTop: 4,
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
