import React, { useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Rect } from 'react-native-svg';
import { t, tf } from '../core/i18n';
import { colors, font, spacing } from './theme';

/**
 * Elfmeter-Minispiel (V5): das Stadion-Tor mit 5 Ziel-Ringen und Torwart.
 * mode 'shoot' = der Nutzer wählt die Schussecke (Torwart rät),
 * mode 'save' = der Nutzer wählt die Hechtecke seines Torwarts (Schütze
 * wählt zufällig). Gleiche Ecke = gehalten, sonst Tor (80 % Quote).
 * Wird im Live-Ticker (Elfmeter im Spiel) benutzt.
 */

const GOAL_IMAGE = require('../../assets/images/penalty-goal.jpg');
const IMAGE_ASPECT = 1470 / 980;

type TargetId = 'TL' | 'TR' | 'C' | 'BL' | 'BR';

const TARGETS: Array<{ id: TargetId; x: number; y: number }> = [
  { id: 'TL', x: 29, y: 40 },
  { id: 'TR', x: 71, y: 40 },
  { id: 'C', x: 50, y: 52 },
  { id: 'BL', x: 29, y: 64 },
  { id: 'BR', x: 71, y: 64 },
];

function Keeper({ size = 52 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40">
      <Circle cx={20} cy={8} r={5.5} fill="#F0C27B" stroke="#1A2E1A" strokeWidth={1.4} />
      <Rect x={13} y={14} width={14} height={15} rx={4} fill="#E53935" stroke="#1A2E1A" strokeWidth={1.4} />
      <Line x1={13} y1={17} x2={3} y2={11} stroke="#E53935" strokeWidth={4.5} strokeLinecap="round" />
      <Line x1={27} y1={17} x2={37} y2={11} stroke="#E53935" strokeWidth={4.5} strokeLinecap="round" />
      <Line x1={16} y1={29} x2={14} y2={38} stroke="#1A2E1A" strokeWidth={4} strokeLinecap="round" />
      <Line x1={24} y1={29} x2={26} y2={38} stroke="#1A2E1A" strokeWidth={4} strokeLinecap="round" />
    </Svg>
  );
}

export interface PenaltyOutcome {
  ball: TargetId;
  dive: TargetId;
  scored: boolean;
}

interface Props {
  mode: 'shoot' | 'save';
  shooter: string;
  keeper: string;
  /** Lokaler Modus: Gegenseite wählt zufällig, Ergebnis nach 1,5 s gemeldet */
  onDone?: (scored: boolean) => void;
  /**
   * Online-Modus (V6): die eigene Wahl wird nur gemeldet – das Ergebnis
   * (inkl. der Wahl des echten Gegners) kommt später über externalResult.
   */
  onPick?: (target: TargetId) => void;
  externalResult?: PenaltyOutcome | null;
  /** Auswahl (noch) gesperrt, z. B. Torwart wartet auf den Schützen */
  locked?: boolean;
}

export type { TargetId };

export function PenaltyGoal({ mode, shooter, keeper, onDone, onPick, externalResult, locked }: Props) {
  const [localResult, setLocalResult] = useState<PenaltyOutcome | null>(null);
  const [picked, setPicked] = useState(false);
  const fired = useRef(false);

  const result = externalResult ?? localResult;

  const handlePick = (target: TargetId) => {
    if (result || picked || locked) return;
    if (onPick) {
      // Online: nur melden, Auflösung kommt von außen
      setPicked(true);
      onPick(target);
      return;
    }
    const random = TARGETS[Math.floor(Math.random() * TARGETS.length)].id;
    const ball = mode === 'shoot' ? target : random;
    const dive = mode === 'shoot' ? random : target;
    const scored = ball !== dive;
    setLocalResult({ ball, dive, scored });
    setTimeout(() => {
      if (fired.current) return;
      fired.current = true;
      onDone?.(scored);
    }, 1500);
  };

  const pos = (id: TargetId) => TARGETS.find((t) => t.id === id)!;
  const keeperShown = result ? pos(result.dive) : { x: 50, y: 56 };

  return (
    <View>
      <Text style={styles.prompt}>
        {result
          ? result.scored
            ? t('penGoal')
            : t('penSaved')
          : picked
            ? t('penWaiting')
            : locked
              ? tf('penPicking', { shooter })
              : mode === 'shoot'
                ? tf('penShootPrompt', { shooter })
                : tf('penDivePrompt', { shooter, keeper })}
      </Text>
      <View style={styles.imageWrap}>
        <Image source={GOAL_IMAGE} style={styles.image} resizeMode="cover" />
        <View style={[styles.keeper, { left: `${keeperShown.x}%`, top: `${keeperShown.y}%` }]}>
          <Keeper />
        </View>
        {result && (
          <View style={[styles.ball, { left: `${pos(result.ball).x}%`, top: `${pos(result.ball).y}%` }]} />
        )}
        {!result && !picked && !locked &&
          TARGETS.map((t) => (
            <Pressable
              key={t.id}
              style={[styles.target, { left: `${t.x}%`, top: `${t.y}%` }]}
              onPress={() => handlePick(t.id)}
            >
              <View style={styles.targetRing} />
            </Pressable>
          ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  prompt: {
    color: '#fff',
    fontWeight: '900',
    fontSize: font.h2,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  imageWrap: {
    width: '100%',
    aspectRatio: IMAGE_ASPECT,
    borderRadius: 12,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  keeper: {
    position: 'absolute',
    marginLeft: -26,
    marginTop: -26,
  },
  ball: {
    position: 'absolute',
    width: 18,
    height: 18,
    borderRadius: 9,
    marginLeft: -9,
    marginTop: -9,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#1A2E1A',
  },
  target: {
    position: 'absolute',
    width: 50,
    height: 50,
    marginLeft: -25,
    marginTop: -25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  targetRing: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 3,
    borderColor: colors.accent,
    backgroundColor: 'rgba(255,143,0,0.28)',
  },
});
