import React, { useEffect, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Line, Rect } from 'react-native-svg';
import { shootoutWinner } from '../../core/engine/shootout';
import { t, tf } from '../../core/i18n';
import { promptBossReward } from './bossReward';
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
 *
 * Optik: Stadion-Tor als Bild in der Mitte; darüber der blaue Himmel mit
 * allen Infos (Trefferliste links, Ergebnis + Schütze rechts, Anweisung
 * direkt über dem Tor), darunter Rasen-Grün passend zum Bild.
 */

// Farben aus dem Stadion-Bild gesampelt (Himmel oben, Rasen unten)
const SKY = '#0D72BA';
const GRASS = '#35A54F';
const GOAL_IMAGE = require('../../../assets/images/penalty-goal.jpg');
const IMAGE_ASPECT = 1470 / 980;

type TargetId = 'TL' | 'TR' | 'C' | 'BL' | 'BR';

interface Target {
  id: TargetId;
  /** Position in % des Bild-Bereichs (auf das Tor im Bild abgestimmt) */
  x: number;
  y: number;
}

const TARGETS: Target[] = [
  { id: 'TL', x: 29, y: 40 },
  { id: 'TR', x: 71, y: 40 },
  { id: 'C', x: 50, y: 52 },
  { id: 'BL', x: 29, y: 64 },
  { id: 'BR', x: 71, y: 64 },
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

/** Best-of-5, danach Sudden Death (gemeinsame Regeln aus engine/shootout). */
function winnerOf(kicks: Kick[]): 'user' | 'opp' | null {
  const side = shootoutWinner(
    kicks.map((k) => ({ side: k.team === 'user' ? ('A' as const) : ('B' as const), scored: k.scored })),
  );
  return side === null ? null : side === 'A' ? 'user' : 'opp';
}

/** Torwart-Figur (einfach gezeichnet, Comic-Stil). */
function Keeper({ size = 58 }: { size?: number }) {
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
  const clubName = useGameStore((s) => s.club?.name ?? '');

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
      const decided = winnerOf(next);
      if (decided) {
        setWinner(decided);
        resolved.current = true;
        void useBattleStore
          .getState()
          .resolveShootout(decided === 'user')
          .then((text) => {
            // Boss besiegt (V7): Belohnung wählen (Coins+Punkte / 2 Packs),
            // sonst den festen Belohnungstext anzeigen
            if (useBattleStore.getState().pendingBossReward) promptBossReward(setRewardText);
            else setRewardText(text);
          });
        // Der entscheidende Elfmeter bleibt erst ~2 s sichtbar, bevor die
        // Ergebnis-Box darüberliegt (V6.3, Nutzerwunsch)
        timer.current = setTimeout(() => setPhase('done'), 2000);
      } else {
        setLastShot(null);
        setPhase('aim');
      }
    }, 1500);
  };

  /** Punkte-Reihe eines Teams: grün = Tor, rot = gehalten, offen = hell. */
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
  const keeperShown = phase === 'result' && lastShot ? targetPos(lastShot.keeper) : { x: 50, y: 56 };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* Blauer Himmel: alle Infos */}
      <View style={styles.skyArea}>
        <View style={styles.infoRow}>
          {/* Links: die Trefferlisten beider Teams */}
          <View style={styles.dotsBlock}>
            <View style={styles.dotsTeamRow}>
              <Text style={styles.dotsTeamName} numberOfLines={1}>{clubName}</Text>
              <View style={styles.dotRow}>{dots(userKicks)}</View>
            </View>
            <View style={styles.dotsTeamRow}>
              <Text style={styles.dotsTeamName} numberOfLines={1}>{setup.opponentName}</Text>
              <View style={styles.dotRow}>{dots(oppKicks)}</View>
            </View>
          </View>
          {/* Rechts: Ergebnis groß, daneben wer schießt + welcher Spieler */}
          <View style={styles.scoreBlock}>
            <View style={styles.scoreLine}>
              <Text style={styles.shootingTeam} numberOfLines={1}>
                {tf('soShootsSuffix', { team: shooting ? clubName : setup.opponentName })}
              </Text>
              <Text style={styles.score}>{userGoals}:{oppGoals}</Text>
            </View>
            <Text style={styles.shooterName} numberOfLines={1}>{shooterName}</Text>
          </View>
        </View>
        {/* Anweisung direkt über dem Tor */}
        <Text style={styles.promptText}>
          {phase === 'result' && lastShot
            ? lastShot.scored
              ? t('penGoal')
              : t('penSaved')
            : shooting
              ? t('soYouShoot')
              : t('soYouSave')}
        </Text>
      </View>

      {/* Stadion-Bild mit Torwart, Ball und Ziel-Ringen */}
      <View style={styles.imageWrap}>
        <Image source={GOAL_IMAGE} style={styles.image} resizeMode="cover" />

        <View
          style={[
            styles.keeper,
            { left: `${keeperShown.x}%`, top: `${keeperShown.y}%` },
          ]}
        >
          <Keeper />
        </View>

        {phase === 'result' && lastShot && (
          <View
            style={[
              styles.ball,
              { left: `${targetPos(lastShot.ball).x}%`, top: `${targetPos(lastShot.ball).y}%` },
            ]}
          />
        )}

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

      {/* Rasen-Grün unterhalb des Bildes */}
      <View style={styles.grassArea} />

      {/* Ende */}
      {phase === 'done' && (
        <View style={styles.doneOverlay}>
          <Card style={styles.doneCard}>
            <Text style={[styles.doneTitle, { color: winner === 'user' ? colors.pitch : colors.danger }]}>
              {winner === 'user' ? t('soWon') : t('soLost')}
            </Text>
            <Text style={styles.doneScore}>
              {tf('soScoreLine', { score: `${userGoals}:${oppGoals}` })}
            </Text>
            {rewardText && <Text style={styles.doneReward}>{rewardText}</Text>}
            <GKButton title={t('soBackMap')} onPress={() => navigation.goBack()} />
          </Card>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: SKY,
  },
  skyArea: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    justifyContent: 'flex-end',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  dotsBlock: {
    flex: 1,
    gap: 6,
  },
  dotsTeamRow: {
    gap: 3,
  },
  dotsTeamName: {
    color: '#fff',
    fontWeight: '800',
    fontSize: font.small,
  },
  dotRow: {
    flexDirection: 'row',
    gap: 5,
  },
  dot: {
    width: 13,
    height: 13,
    borderRadius: 7,
  },
  dotGoal: {
    backgroundColor: '#7CE97C',
  },
  dotMiss: {
    backgroundColor: '#FF6B5E',
  },
  dotOpen: {
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  scoreBlock: {
    alignItems: 'flex-end',
  },
  scoreLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  shootingTeam: {
    color: '#fff',
    fontWeight: '800',
    fontSize: font.body,
    maxWidth: 160,
  },
  score: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 34,
  },
  shooterName: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: font.small,
    fontWeight: '600',
  },
  promptText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: font.h2,
    textAlign: 'center',
    marginVertical: spacing.sm,
  },
  imageWrap: {
    width: '100%',
    aspectRatio: IMAGE_ASPECT,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  grassArea: {
    flex: 1,
    backgroundColor: GRASS,
  },
  keeper: {
    position: 'absolute',
    marginLeft: -29,
    marginTop: -29,
  },
  ball: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    marginLeft: -10,
    marginTop: -10,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#1A2E1A',
  },
  target: {
    position: 'absolute',
    width: 54,
    height: 54,
    marginLeft: -27,
    marginTop: -27,
    alignItems: 'center',
    justifyContent: 'center',
  },
  targetRing: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: colors.accent,
    backgroundColor: 'rgba(255,143,0,0.28)',
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
