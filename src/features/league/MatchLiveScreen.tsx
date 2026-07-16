import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { POSITION_SHORT, TACTIC_LABEL } from '../../core/domain/constants';
import type { MatchEvent, Tactic } from '../../core/domain/types';
import { effectiveOverall } from '../../core/engine/playerGen';
import { useBattleStore } from '../../state/battleStore';
import { useGameStore } from '../../state/gameStore';
import { useLeagueStore } from '../../state/leagueStore';
import { abandonLiveMatch, resolveLivePenalty, resumeSecondHalf } from '../../state/matchFlow';
import { GKButton, Card } from '../../ui/components';
import { Crest } from '../../ui/Crest';
import { FormationPitch } from '../../ui/FormationPitch';
import { PenaltyGoal } from '../../ui/PenaltyGoal';
import {
  IconBall, IconCard, IconCheck, IconFlag, IconFlash, IconPause, IconSwap, IconWhistle,
  type IconProps,
} from '../../ui/icons';
import { colors, font, radius, spacing } from '../../ui/theme';
import { playSound } from '../../core/services/sound';
import type { RootScreenProps } from '../../navigation/types';

/**
 * Live view of the match simulation (chapter 3.4): the timer visibly runs
 * along and events/goals pop in at their minute - like a live ticker.
 *
 * V5: Die Simulation pausiert live an zwei Stellen:
 *  - Elfmeter: der Nutzer schießt bzw. hält selbst (Minispiel)
 *  - Halbzeit: Auswechslungen auf dem Formations-Feld + Taktikwechsel
 * Dazu läuft ein Momentum-Balken (grün = eigenes Team, rot = Gegner),
 * der sich alle 5 Spielminuten aktualisiert.
 */

const MS_PER_MINUTE = 350; // 90 minutes in ~32 seconds

const EVENT_ICON: Record<MatchEvent['type'], React.ComponentType<IconProps>> = {
  tor: IconBall,
  chance: IconFlash,
  ecke: IconFlag,
  foul: IconCard,
  gelb: IconCard,
  rot: IconCard,
  anpfiff: IconWhistle,
  halbzeit: IconPause,
  abpfiff: IconWhistle,
  wechsel: IconSwap,
  elfmeter: IconWhistle,
  parade: IconCheck,
};

const TACTICS: Tactic[] = ['offensiv', 'ausgewogen', 'defensiv'];

/** Eine Zeile der Endstatistik (Heimwert – Label – Auswärtswert). */
function StatRow({ label, home, away }: { label: string; home: string | number; away: string | number }) {
  return (
    <View style={styles.statRow}>
      <Text style={styles.statValue}>{home}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{away}</Text>
    </View>
  );
}

export function MatchLiveScreen({ navigation }: RootScreenProps<'MatchLive'>) {
  const played = useLeagueStore((s) => s.lastPlayedMatch);
  const insets = useSafeAreaInsets();
  const [minute, setMinute] = useState(0);
  const [resuming, setResuming] = useState(false);
  const [subsOpen, setSubsOpen] = useState(false);
  const [penaltyOpen, setPenaltyOpen] = useState(false);
  const [selection, setSelection] = useState<
    { type: 'slot'; slot: number } | { type: 'bench'; id: number } | null
  >(null);
  const skippedRef = useRef(false);
  const listRef = useRef<FlatList<MatchEvent>>(null);

  const game = useGameStore();
  const [halftimeTactic, setHalftimeTactic] = useState<Tactic>(game.club?.tactic ?? 'ausgewogen');

  const events = played?.match.events ?? [];
  const pause = played?.pause ?? null;

  // Wartende Meister-Feier erst freigeben, wenn die Live-Ansicht zugeht;
  // wird ein Spiel in einer Pause verlassen, Zustand + Aufstellung aufräumen
  useEffect(
    () => () => {
      if (useLeagueStore.getState().lastPlayedMatch?.pause) void abandonLiveMatch();
      useLeagueStore.getState().revealCelebration();
    },
    [],
  );

  // Ticker: läuft bis zur nächsten Pause (Elfmeter-Minute, Halbzeit 45)
  // bzw. bis zum Abpfiff (90)
  useEffect(() => {
    const t = setInterval(() => {
      setMinute((m) => {
        const p = useLeagueStore.getState().lastPlayedMatch?.pause;
        const cap = p ? (p.type === 'penalty' ? p.minute : 45) : 90;
        return m >= cap ? m : m + 1;
      });
    }, MS_PER_MINUTE);
    return () => clearInterval(t);
  }, []);

  const visibleEvents = useMemo(
    () => events.filter((e) => e.minute <= minute),
    [events, minute],
  );

  useEffect(() => {
    if (visibleEvents.length > 0) {
      listRef.current?.scrollToEnd({ animated: true });
    }
  }, [visibleEvents.length]);

  // Sounds: eigenes Tor und Gegentor im Ticker (nicht beim Skip-Sprung)
  const prevUserGoals = useRef(0);
  const prevOppGoals = useRef(0);
  useEffect(() => {
    if (!played) return;
    const side = played.userIsHome ? 'home' : 'away';
    const userGoals = visibleEvents.filter((e) => e.type === 'tor' && e.team === side).length;
    const oppGoals = visibleEvents.filter((e) => e.type === 'tor' && e.team !== side).length;
    if (userGoals > prevUserGoals.current && !skippedRef.current) playSound('goal');
    if (oppGoals > prevOppGoals.current && !skippedRef.current) playSound('goalConceded');
    prevUserGoals.current = userGoals;
    prevOppGoals.current = oppGoals;
  }, [visibleEvents, played]);

  // Pfiffe: Halbzeit und Abpfiff (kein Pfiff beim Resume, V5)
  const halftimeWhistled = useRef(false);
  useEffect(() => {
    if (minute >= 45 && pause?.type === 'halftime' && !halftimeWhistled.current) {
      halftimeWhistled.current = true;
      playSound('fulltime');
    }
  }, [minute, pause]);

  const fulltimeSoundPlayed = useRef(false);
  useEffect(() => {
    if (minute >= 90 && !fulltimeSoundPlayed.current) {
      fulltimeSoundPlayed.current = true;
      playSound('fulltime');
    }
  }, [minute]);

  // Platz-Kampf endete unentschieden: nach dem Abpfiff automatisch weiter
  // ins Elfmeterschießen (nur für Platz-Kampf-Matches)
  const isBattleMatch = played?.match.awayId.startsWith('battle-') ?? false;
  const isLeagueMatch = (played?.match.season ?? 0) > 0;
  const pendingShootoutRaw = useBattleStore((s) => s.pendingShootout);
  const pendingShootout = isBattleMatch ? pendingShootoutRaw : null;
  const shootoutStarted = useRef(false);
  useEffect(() => {
    if (minute >= 90 && pendingShootout && !shootoutStarted.current) {
      shootoutStarted.current = true;
      const t = setTimeout(() => navigation.replace('Shootout'), 2200);
      return () => clearTimeout(t);
    }
  }, [minute, pendingShootout, navigation]);

  if (!played) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={styles.noMatch}>No match available.</Text>
        <GKButton title="Back" variant="ghost" onPress={() => navigation.goBack()} />
      </SafeAreaView>
    );
  }

  const { match, homeName, awayName, homeCrest, awayCrest, userIsHome, stats, coinReward, motm } = played;
  const homeGoals = visibleEvents.filter((e) => e.type === 'tor' && e.team === 'home').length;
  const awayGoals = visibleEvents.filter((e) => e.type === 'tor' && e.team === 'away').length;
  const userSide: 'home' | 'away' = userIsHome ? 'home' : 'away';
  const atHalftime = pause?.type === 'halftime' && minute >= 45;
  const atPenalty = pause?.type === 'penalty' && minute >= pause.minute;
  const finished = match.played && minute >= 90;
  const ownPenalty = pause?.type === 'penalty' && pause.side === userSide;

  // Momentum (V5): Wer spielt gerade besser? Aus den Aktionen der letzten
  // ~15 Minuten, aktualisiert in 5-Minuten-Schritten.
  const bucketMinute = Math.floor(minute / 5) * 5;
  const windowEvents = events.filter(
    (e) => e.minute > bucketMinute - 15 && e.minute <= bucketMinute,
  );
  const momentumScore = (side: 'home' | 'away') =>
    windowEvents.reduce((sum, e) => {
      if (e.team !== side) return sum;
      if (e.type === 'tor') return sum + 4;
      if (e.type === 'elfmeter') return sum + 3;
      if (e.type === 'chance') return sum + 2;
      if (e.type === 'ecke') return sum + 1;
      return sum;
    }, 0);
  const userMomentumRaw = momentumScore(userSide);
  const oppMomentumRaw = momentumScore(userSide === 'home' ? 'away' : 'home');
  const userMomentum =
    userMomentumRaw + oppMomentumRaw === 0
      ? 50
      : Math.round(20 + (userMomentumRaw / (userMomentumRaw + oppMomentumRaw)) * 60);

  // Ticker-Farben: eigenes Tor grün, Gegentor rot; Karten gelb/rot;
  // Elfmeter hellblau (eigenes Team) bzw. orange (Gegner)
  const eventColor = (e: MatchEvent): string => {
    if (e.type === 'tor') return e.team === userSide ? colors.pitch : colors.danger;
    if (e.type === 'gelb') return colors.gold;
    if (e.type === 'rot') return colors.danger;
    if (e.type === 'elfmeter') return e.team === userSide ? colors.sky : colors.accent;
    if (e.type === 'wechsel') return colors.sky;
    if (e.type === 'parade') return e.team === userSide ? colors.pitch : colors.danger;
    return colors.inkSoft;
  };

  /** Halbzeit beenden: 2. Hälfte mit gewählter Taktik + aktueller Elf. */
  const onResume = async () => {
    if (resuming) return;
    setResuming(true);
    try {
      setSubsOpen(false);
      await resumeSecondHalf(halftimeTactic);
      skippedRef.current = false;
    } finally {
      setResuming(false);
    }
  };

  const onSkip = () => {
    skippedRef.current = true;
    const cap = pause ? (pause.type === 'penalty' ? pause.minute : 45) : 90;
    setMinute(cap);
  };

  // Auswechslungen (V5): frei tauschen – Elf gegen Bank ODER Elf gegen Elf
  // (Positionswechsel), Auswahl in beliebiger Reihenfolge
  const lineupIds = game.lineup;
  const lineupList = game.lineupPlayers();
  const bench = game.players
    .filter((p) => !lineupIds.includes(p.id))
    .sort((a, b) => effectiveOverall(b.pool, b.level) - effectiveOverall(a.pool, a.level));
  const leagueState = useLeagueStore.getState();
  const suspendedIds = new Set(
    isLeagueMatch
      ? leagueState.suspensions
          .filter((s) => s.season === leagueState.season && s.round === leagueState.round)
          .map((s) => s.playerId)
      : [],
  );

  const onSlotTap = async (slot: number) => {
    if (selection?.type === 'bench') {
      await game.setLineupSlot(slot, selection.id);
      setSelection(null);
      return;
    }
    if (selection?.type === 'slot' && selection.slot !== slot) {
      // Elf gegen Elf: Positionen der beiden Slots tauschen
      const a = lineupIds[selection.slot];
      const b = lineupIds[slot];
      if (a !== null && b !== null) {
        await game.setLineupSlot(selection.slot, b);
        await game.setLineupSlot(slot, a);
      } else if (a !== null) {
        await game.setLineupSlot(slot, a);
      } else if (b !== null) {
        await game.setLineupSlot(selection.slot, b);
      }
      setSelection(null);
      return;
    }
    setSelection({ type: 'slot', slot });
  };

  const onBenchTap = async (benchId: number) => {
    if (selection?.type === 'slot') {
      await game.setLineupSlot(selection.slot, benchId);
      setSelection(null);
      return;
    }
    setSelection({ type: 'bench', id: benchId });
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.scoreboard}>
        <View style={styles.scoreSide}>
          <Crest crestId={homeCrest} size={52} />
          <Text style={styles.clubName} numberOfLines={2}>{homeName}</Text>
        </View>
        <View style={styles.scoreCenter}>
          <Text style={styles.score}>
            {homeGoals}:{awayGoals}
          </Text>
          <View style={styles.minuteBadge}>
            <Text style={styles.minuteText}>
              {finished ? 'FT' : atHalftime ? 'HT' : `${minute}'`}
            </Text>
          </View>
        </View>
        <View style={styles.scoreSide}>
          <Crest crestId={awayCrest} size={52} />
          <Text style={styles.clubName} numberOfLines={2}>{awayName}</Text>
        </View>
      </View>

      {/* Momentum (V5): grün = eigenes Team spielt besser, rot = Gegner */}
      <View style={styles.possessionWrap}>
        <Text style={[styles.possessionValue, { color: '#7CE97C' }]}>{userMomentum}%</Text>
        <View style={styles.possessionBar}>
          <View style={[styles.possessionUser, { flex: userMomentum }]} />
          <View style={[styles.possessionOpp, { flex: 100 - userMomentum }]} />
        </View>
        <Text style={[styles.possessionValue, { color: '#FF6B5E' }]}>{100 - userMomentum}%</Text>
      </View>
      <Text style={styles.momentumLabel}>Momentum</Text>

      {finished && stats && (
        <Card style={styles.statsCard}>
          <Text style={styles.statsTitle}>Match stats</Text>
          <StatRow label="Goals" home={stats.home.goals} away={stats.away.goals} />
          <StatRow label="Expected goals (xG)" home={stats.home.xg.toFixed(1)} away={stats.away.xg.toFixed(1)} />
          <StatRow label="Shots" home={stats.home.shots} away={stats.away.shots} />
          <StatRow label="Possession" home={`${stats.home.possession}%`} away={`${stats.away.possession}%`} />
          <StatRow label="Corners" home={stats.home.corners} away={stats.away.corners} />
          <StatRow label="Fouls" home={stats.home.fouls} away={stats.away.fouls} />
          <StatRow label="Yellow cards" home={stats.home.yellows} away={stats.away.yellows} />
          <StatRow label="Red cards" home={stats.home.reds} away={stats.away.reds} />
          <StatRow label="Saves" home={stats.home.saves ?? 0} away={stats.away.saves ?? 0} />
          {motm && (
            <Text style={styles.motmLine}>
              Man of the match: {motm.name} ({motm.teamName}) · {motm.rating.toFixed(1)}/10 · {motm.summary}
            </Text>
          )}
          {coinReward && coinReward.breakdown.length > 0 && (
            <Text style={styles.coinLine}>
              {coinReward.total > 0
                ? `+${coinReward.total} coins (${coinReward.breakdown.join(' · ')})`
                : coinReward.breakdown.join(' · ')}
            </Text>
          )}
        </Card>
      )}

      <FlatList
        ref={listRef}
        data={visibleEvents}
        keyExtractor={(_, i) => String(i)}
        contentContainerStyle={styles.ticker}
        renderItem={({ item }) => {
          const EventIcon = EVENT_ICON[item.type];
          const highlight = item.type === 'tor' || item.type === 'parade';
          return (
            <Card style={[styles.eventCard, highlight && styles.goalCard]}>
              <Text style={styles.eventMinute}>{item.minute}'</Text>
              <EventIcon size={18} color={eventColor(item)} />
              <Text style={[styles.eventText, highlight && styles.goalText]}>
                {item.text}
              </Text>
            </Card>
          );
        }}
      />

      {/* Elfmeter (V5): die Simulation wartet auf den Nutzer */}
      {atPenalty && pause?.type === 'penalty' ? (
        <Card style={styles.halftimeCard}>
          <Text style={[styles.halftimeTitle, { color: ownPenalty ? colors.sky : colors.accentDark }]}>
            PENALTY {ownPenalty ? 'for your team!' : `for ${userIsHome ? awayName : homeName}!`}
          </Text>
          <GKButton
            title={ownPenalty ? 'Take the penalty!' : 'Save the penalty!'}
            variant="secondary"
            onPress={() => setPenaltyOpen(true)}
          />
        </Card>
      ) : atHalftime ? (
        <Card style={styles.halftimeCard}>
          <Text style={styles.halftimeTitle}>Half-time - {homeGoals}:{awayGoals}</Text>
          <Text style={styles.halftimeHint}>
            Change your tactic or make substitutions, then resume.
          </Text>
          <View style={styles.tacticRow}>
            {TACTICS.map((t) => (
              <Pressable
                key={t}
                style={[styles.tacticBtn, halftimeTactic === t && styles.tacticBtnActive]}
                onPress={() => setHalftimeTactic(t)}
              >
                <Text style={[styles.tacticText, halftimeTactic === t && styles.tacticTextActive]}>
                  {TACTIC_LABEL[t]}
                </Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.halftimeButtons}>
            <GKButton
              title="Substitutions"
              variant="secondary"
              style={styles.halftimeBtn}
              onPress={() => setSubsOpen(true)}
            />
            <GKButton
              title="Resume"
              style={styles.halftimeBtn}
              loading={resuming}
              onPress={onResume}
            />
          </View>
        </Card>
      ) : (
        <View style={styles.footer}>
          {finished ? (
            pendingShootout ? (
              <GKButton
                title="Penalty shootout!"
                variant="secondary"
                onPress={() => navigation.replace('Shootout')}
              />
            ) : (
              <GKButton
                title={`Continue (final score ${match.homeGoals}:${match.awayGoals})`}
                onPress={() => navigation.goBack()}
              />
            )
          ) : (
            <GKButton title="Skip" variant="ghost" onPress={onSkip} />
          )}
        </View>
      )}

      {/* Elfmeter-Minispiel */}
      <Modal visible={penaltyOpen} transparent animationType="fade">
        <View style={styles.penaltyBackdrop}>
          {pause?.type === 'penalty' && (
            <PenaltyGoal
              mode={ownPenalty ? 'shoot' : 'save'}
              shooter={pause.shooter}
              keeper={pause.keeper}
              onDone={async (scored) => {
                setPenaltyOpen(false);
                await resolveLivePenalty(scored);
              }}
            />
          )}
        </View>
      </Modal>

      {/* Auswechslungen auf dem Formations-Feld (V5) */}
      <Modal visible={subsOpen} animationType="slide">
        <SafeAreaView style={styles.subsSafe} edges={['top', 'bottom']}>
          <Text style={styles.subsTitle}>Half-time - arrange your team</Text>
          <Text style={styles.subsHint}>
            {selection === null
              ? 'Tap a player on the pitch or on the bench, then tap where he should go.'
              : selection.type === 'slot'
                ? 'Now tap a bench player to bring him ON - or another pitch player to swap positions.'
                : 'Now tap the pitch player he should replace.'}
          </Text>
          <View style={styles.subsPitch}>
            <FormationPitch
              formation={game.club?.formation ?? '4-4-2'}
              lineup={lineupList}
              onPlayerPress={(playerId) => {
                const slot = lineupIds.indexOf(playerId);
                if (slot >= 0) void onSlotTap(slot);
              }}
              onSwapPress={(slot) => void onSlotTap(slot)}
              captainId={game.captainPlayerId}
              suspendedIds={suspendedIds}
            />
          </View>
          <Text style={styles.subsSection}>Bench</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.benchRow}>
            {bench.map((player) => {
              const suspended = suspendedIds.has(player.id);
              const selected = selection?.type === 'bench' && selection.id === player.id;
              return (
                <Pressable
                  key={player.id}
                  style={[styles.benchChip, selected && styles.benchChipSelected, suspended && styles.benchChipDisabled]}
                  disabled={suspended}
                  onPress={() => void onBenchTap(player.id)}
                >
                  <Text style={styles.benchName} numberOfLines={1}>
                    {player.pool.name.split(' ').slice(-1)[0]}
                  </Text>
                  <Text style={styles.benchMeta}>
                    {suspended
                      ? 'suspended'
                      : `${POSITION_SHORT[player.pool.position]} · ${effectiveOverall(player.pool, player.level)}`}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <View style={{ paddingBottom: insets.bottom }}>
            <GKButton
              title="Done"
              onPress={() => {
                setSubsOpen(false);
                setSelection(null);
              }}
            />
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.pitchDark,
  },
  scoreboard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    paddingBottom: spacing.sm,
  },
  scoreSide: {
    flex: 1,
    alignItems: 'center',
  },
  clubName: {
    color: '#fff',
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 4,
    fontSize: font.small,
  },
  scoreCenter: {
    alignItems: 'center',
    marginHorizontal: spacing.md,
  },
  score: {
    color: '#fff',
    fontSize: 52,
    fontWeight: '900',
  },
  minuteBadge: {
    backgroundColor: colors.accent,
    borderRadius: radius.round,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    marginTop: 4,
  },
  minuteText: {
    fontWeight: '900',
    color: '#fff',
  },
  possessionWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  possessionBar: {
    flex: 1,
    height: 10,
    borderRadius: 5,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  possessionUser: {
    backgroundColor: '#7CE97C',
  },
  possessionOpp: {
    backgroundColor: '#FF6B5E',
  },
  possessionValue: {
    fontWeight: '900',
    fontSize: font.small,
    width: 38,
    textAlign: 'center',
  },
  momentumLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 10,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  ticker: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  eventCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    marginBottom: spacing.xs,
    gap: spacing.sm,
  },
  goalCard: {
    backgroundColor: '#FFF8E1',
    borderColor: colors.gold,
    borderWidth: 2,
  },
  eventMinute: {
    width: 30,
    fontWeight: '900',
    color: colors.pitchDark,
  },
  eventText: {
    flex: 1,
    fontSize: font.small,
    color: colors.ink,
  },
  goalText: {
    fontWeight: '800',
  },
  footer: {
    padding: spacing.md,
  },
  halftimeCard: {
    margin: spacing.md,
    marginTop: 0,
  },
  halftimeTitle: {
    fontSize: font.h2,
    fontWeight: '900',
    color: colors.ink,
    textAlign: 'center',
  },
  halftimeHint: {
    fontSize: font.small,
    color: colors.inkSoft,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  tacticRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  tacticBtn: {
    flex: 1,
    borderWidth: 2,
    borderColor: colors.line,
    borderRadius: radius.sm,
    paddingVertical: 8,
    alignItems: 'center',
  },
  tacticBtnActive: {
    borderColor: colors.pitch,
    backgroundColor: colors.grass,
  },
  tacticText: {
    fontWeight: '800',
    fontSize: font.small,
    color: colors.inkSoft,
  },
  tacticTextActive: {
    color: colors.pitchDark,
  },
  halftimeButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  halftimeBtn: {
    flex: 1,
  },
  penaltyBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,20,45,0.93)',
    justifyContent: 'center',
    padding: spacing.md,
  },
  statsCard: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    paddingVertical: spacing.sm,
  },
  statsTitle: {
    fontSize: font.h2,
    fontWeight: '900',
    color: colors.ink,
    textAlign: 'center',
    marginBottom: 6,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 3,
  },
  statValue: {
    width: 64,
    textAlign: 'center',
    fontWeight: '900',
    color: colors.pitchDark,
    fontSize: font.small,
  },
  statLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: font.small,
    color: colors.inkSoft,
  },
  coinLine: {
    marginTop: spacing.sm,
    textAlign: 'center',
    fontWeight: '800',
    fontSize: font.small,
    color: colors.accentDark,
  },
  motmLine: {
    marginTop: spacing.sm,
    textAlign: 'center',
    fontWeight: '800',
    fontSize: font.small,
    color: colors.sky,
  },
  noMatch: {
    color: '#fff',
    padding: spacing.lg,
    textAlign: 'center',
  },
  subsSafe: {
    flex: 1,
    backgroundColor: colors.pitchDark,
    padding: spacing.md,
  },
  subsTitle: {
    fontSize: font.h2,
    fontWeight: '900',
    color: '#fff',
    textAlign: 'center',
  },
  subsHint: {
    fontSize: font.small,
    color: 'rgba(255,255,255,0.75)',
    textAlign: 'center',
    marginVertical: spacing.sm,
  },
  subsPitch: {
    flex: 1,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  subsSection: {
    fontWeight: '900',
    color: '#fff',
    fontSize: font.small,
    marginTop: spacing.sm,
    marginBottom: 4,
  },
  benchRow: {
    maxHeight: 74,
    marginBottom: spacing.sm,
  },
  benchChip: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 2,
    borderColor: 'transparent',
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    marginRight: spacing.sm,
    minWidth: 86,
  },
  benchChipSelected: {
    borderColor: colors.accent,
    backgroundColor: 'rgba(255,143,0,0.25)',
  },
  benchChipDisabled: {
    opacity: 0.45,
  },
  benchName: {
    color: '#fff',
    fontWeight: '800',
    fontSize: font.small,
  },
  benchMeta: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    fontWeight: '700',
  },
});
