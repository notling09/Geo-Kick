import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Line, Rect } from 'react-native-svg';
import { playSound } from '../../core/services/sound';
import { useBattleStore } from '../../state/battleStore';
import { useGameStore } from '../../state/gameStore';
import { GKButton, Card } from '../../ui/components';
import { colors, font, radius, spacing } from '../../ui/theme';
import type { RootScreenProps } from '../../navigation/types';

/**
 * Elfmeterschießen (V4): Endet ein Platz-Kampf nach 90 Minuten unentschieden,
 * gibt es kein Remis – es geht hierher. Abwechselnd (Best-of-5, danach Sudden
 * Death):
 *  - Eigener Schütze: eine der 5 Ecken antippen. Der Torwart rät zufällig
 *    eine Ecke – rät er die richtige, ist der Ball gehalten (1 von 5 = 20 %).
 *  - Gegnerischer Schütze: die Hechtrichtung des eigenen Torwarts antippen.
 *    Trifft man die Ecke des Schützen, ist der Ball gehalten.
 */

type TargetId = 'TL' | 'TR' | 'C' | 'BL' | 'BR';

interface Target {
  id: TargetId;
  /** Position in % des Tor-Bereichs */
  x: number;
  y: number;
}

const TARGETS: Target[] = [
  { id: 'TL', x: 16, y: 30 },
  { id: 'TR', x: 84, y: 30 },
  { id: 'C', x: 50, y: 52 },
  { id: 'BL', x: 16, y: 74 },
  { id: 'BR', x: 84, y: 74 },
];

interface Kick {
  team: 'user' | 'opp';
  scored: boolean;
}

interface ShotResult {
  ball: TargetId;
  keeper: TargetId;
  scored: boolean;
  team: 'user' | 'opp';
}

/** Best-of-5, danach Sudden Death (Entscheidung nur nach kompletten Paaren). */
function shootoutWinner(kicks: Kick[]): 'user' | 'opp' | null {
  const user = kicks.filter((k) => k.team === 'user');
  const opp = kicks.filter((k) => k.team === 'opp');
  const ug = user.filter((k) => k.scored).length;
  const og = opp.filter((k) => k.scored).length;
  if (user.length <= 5 && opp.length <= 5) {
    const remU = 5 - user.length;
    const remO = 5 - opp.length;
    if (ug > og + remO) return 'user';
    if (og > ug + remU) return 'opp';
    if (remU === 0 && remO === 0 && ug !== og) return ug > og ? 'user' : 'opp';
    return null;
  }
  if (user.length === opp.length && ug !== og) return ug > og ? 'user' : 'opp';
  return null;
}

/** Torwart-Figur (einfach gezeichnet, Comic-Stil). */
function Keeper({ size = 64 }: { size?: number }) {
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

export function PenaltyShootoutScreen({ navigation }: RootScreenProps<'Shootout'>) {
  const setup = useBattleStore((s) => s.pendingShootout);
  const clubName = useGameStore((s) => s.club?.name ?? 'Your club');

  const [kicks, setKicks] = useState<Kick[]>([]);
  const [phase, setPhase] = useState<'aim' | 'result' | 'done'>('aim');
  const [lastShot, setLastShot] = useState<ShotResult | null>(null);
  const [winner, setWinner] = useState<'user' | 'opp' | null>(null);
  const [rewardText, setRewardText] = useState<string | null>(null);
  const resolved = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Ohne anstehendes Elfmeterschießen hat der Screen nichts zu zeigen
  useEffect(() => {
    if (!setup) navigation.goBack();
  }, [setup, navigation]);

  // Verlassen ohne Ende (Hardware-Back): kein Reward, aufräumen
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      if (!resolved.current) useBattleStore.getState().abandonShootout();
    },
    [],
  );

  if (!setup) return null;

  const userKicks = kicks.filter((k) => k.team === 'user');
  const oppKicks = kicks.filter((k) => k.team === 'opp');
  const userGoals = userKicks.filter((k) => k.scored).length;
  const oppGoals = oppKicks.filter((k) => k.scored).length;
  const shooting = kicks.length % 2 === 0; // Nutzer beginnt
  const shooterName = shooting
    ? setup.userShooters[userKicks.length % setup.userShooters.length]
    : setup.oppShooters[oppKicks.length % setup.oppShooters.length];

  const onPick = (target: TargetId) => {
    if (phase !== 'aim') return;
    const others = TARGETS.map((t) => t.id);
    const random = others[Math.floor(Math.random() * others.length)];
    // Schießen: Ball = Wahl, Torwart rät. Halten: Torwart = Wahl, Schütze zufällig.
    const ball = shooting ? target : random;
    const keeper = shooting ? random : target;
    const scored = ball !== keeper;
    const team: 'user' | 'opp' = shooting ? 'user' : 'opp';
    if (scored) playSound(team === 'user' ? 'goal' : 'goalConceded');
    setLastShot({ ball, keeper, scored, team });
    setPhase('result');

    timer.current = setTimeout(() => {
      const next = [...kicks, { team, scored }];
      setKicks(next);
      const decided = shootoutWinner(next);
      if (decided) {
        setWinner(decided);
        setPhase('done');
        resolved.current = true;
        void useBattleStore
          .getState()
          .resolveShootout(decided === 'user')
          .then(setRewardText);
      } else {
        setLastShot(null);
        setPhase('aim');
      }
    }, 1500);
  };

  /** Punkte-Reihe eines Teams: grün = Tor, rot = gehalten, grau = offen. */
  const dots = (teamKicks: Kick[]) => {
    const slots = Math.max(5, teamKicks.length);
    return Array.from({ length: slots }, (_, i) => {
      const k = teamKicks[i];
      return (
        <View
          key={i}
          style={[
            styles.dot,
            k ? (k.scored ? styles.dotGoal : styles.dotMiss) : styles.dotOpen,
          ]}
        />
      );
    });
  };

  const targetPos = (id: TargetId) => TARGETS.find((t) => t.id === id)!;
  const keeperShown = phase === 'result' && lastShot ? targetPos(lastShot.keeper) : { x: 50, y: 60 };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* Kopf: Wer schießt gerade? */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTeam}>
            {shooting ? clubName : setup.opponentName} shoot{shooting ? '' : 's'}
          </Text>
          <Text style={styles.headerShooter}>{shooterName}</Text>
        </View>
        <Text style={styles.headerScore}>
          {userGoals}:{oppGoals}
        </Text>
      </View>

      {/* Das Tor mit Netz und Torwart */}
      <View style={styles.goalArea}>
        <Svg width="100%" height="100%" viewBox="0 0 100 80" preserveAspectRatio="none">
          {/* Netz */}
          {Array.from({ length: 9 }, (_, i) => (
            <Line key={`v${i}`} x1={8 + i * 10.5} y1={10} x2={8 + i * 10.5} y2={78} stroke="rgba(255,255,255,0.35)" strokeWidth={0.5} />
          ))}
          {Array.from({ length: 7 }, (_, i) => (
            <Line key={`h${i}`} x1={6} y1={16 + i * 10} x2={94} y2={16 + i * 10} stroke="rgba(255,255,255,0.35)" strokeWidth={0.5} />
          ))}
          {/* Pfosten + Latte */}
          <Rect x={4} y={8} width={3} height={72} fill="#fff" />
          <Rect x={93} y={8} width={3} height={72} fill="#fff" />
          <Rect x={4} y={8} width={92} height={3.5} fill="#fff" />
        </Svg>

        {/* Torwart (springt beim Ergebnis in die geratene Ecke) */}
        <View
          style={[
            styles.keeper,
            { left: `${keeperShown.x}%`, top: `${keeperShown.y}%` },
          ]}
        >
          <Keeper />
        </View>

        {/* Ball beim Ergebnis */}
        {phase === 'result' && lastShot && (
          <View
            style={[
              styles.ball,
              { left: `${targetPos(lastShot.ball).x}%`, top: `${targetPos(lastShot.ball).y}%` },
            ]}
          />
        )}

        {/* Die 5 Ziel-Ringe */}
        {phase === 'aim' &&
          TARGETS.map((t) => (
            <Pressable
              key={t.id}
              style={[styles.target, { left: `${t.x}%`, top: `${t.y}%` }]}
              onPress={() => onPick(t.id)}
            >
              <View style={styles.targetRing} />
            </Pressable>
          ))}
      </View>

      {/* Status + Punkte */}
      <View style={styles.panel}>
        {phase === 'result' && lastShot ? (
          <Text style={[styles.resultText, { color: lastShot.scored ? (lastShot.team === 'user' ? colors.pitchLight : colors.danger) : colors.gold }]}>
            {lastShot.scored ? 'GOAL!' : 'SAVED!'}
          </Text>
        ) : (
          <Text style={styles.promptText}>
            {shooting
              ? 'You shoot - tap a corner!'
              : 'Your keeper saves - tap where to dive!'}
          </Text>
        )}
        <View style={styles.scoreRow}>
          <Text style={styles.scoreName} numberOfLines={1}>{clubName}</Text>
          <View style={styles.dotRow}>{dots(userKicks)}</View>
        </View>
        <View style={styles.scoreRow}>
          <Text style={styles.scoreName} numberOfLines={1}>{setup.opponentName}</Text>
          <View style={styles.dotRow}>{dots(oppKicks)}</View>
        </View>
      </View>

      {/* Ende */}
      {phase === 'done' && (
        <View style={styles.doneOverlay}>
          <Card style={styles.doneCard}>
            <Text style={[styles.doneTitle, { color: winner === 'user' ? colors.pitch : colors.danger }]}>
              {winner === 'user' ? 'Shootout won!' : 'Shootout lost'}
            </Text>
            <Text style={styles.doneScore}>
              {userGoals}:{oppGoals} on penalties
            </Text>
            {rewardText && <Text style={styles.doneReward}>{rewardText}</Text>}
            <GKButton title="Back to the map" onPress={() => navigation.goBack()} />
          </Card>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.pitchDark,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  headerTeam: {
    color: '#fff',
    fontWeight: '900',
    fontSize: font.h2,
  },
  headerShooter: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: font.small,
    fontWeight: '600',
  },
  headerScore: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 34,
  },
  goalArea: {
    flex: 1,
    margin: spacing.md,
    backgroundColor: colors.pitch,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  keeper: {
    position: 'absolute',
    marginLeft: -32,
    marginTop: -32,
  },
  ball: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderRadius: 11,
    marginLeft: -11,
    marginTop: -11,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#1A2E1A',
  },
  target: {
    position: 'absolute',
    width: 56,
    height: 56,
    marginLeft: -28,
    marginTop: -28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  targetRing: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 3,
    borderColor: colors.accent,
    backgroundColor: 'rgba(255,143,0,0.25)',
  },
  panel: {
    padding: spacing.md,
    paddingTop: 0,
  },
  promptText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: font.body,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  resultText: {
    fontWeight: '900',
    fontSize: font.h1,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  scoreName: {
    color: '#fff',
    fontWeight: '700',
    fontSize: font.small,
    flex: 1,
    marginRight: spacing.sm,
  },
  dotRow: {
    flexDirection: 'row',
    gap: 6,
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  dotGoal: {
    backgroundColor: colors.pitchLight,
  },
  dotMiss: {
    backgroundColor: colors.danger,
  },
  dotOpen: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  doneOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  doneCard: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
  },
  doneTitle: {
    fontSize: font.title,
    fontWeight: '900',
  },
  doneScore: {
    fontSize: font.h2,
    fontWeight: '800',
    color: colors.ink,
  },
  doneReward: {
    fontSize: font.body,
    fontWeight: '700',
    color: colors.accentDark,
    textAlign: 'center',
  },
});
