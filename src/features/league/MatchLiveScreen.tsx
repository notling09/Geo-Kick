import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { POSITION_SHORT, TACTIC_LABEL } from '../../core/domain/constants';
import type { MatchEvent, Tactic } from '../../core/domain/types';
import { effectiveOverall } from '../../core/engine/playerGen';
import { useBattleStore } from '../../state/battleStore';
import { useGameStore } from '../../state/gameStore';
import { useLeagueStore } from '../../state/leagueStore';
import { resumeSecondHalf } from '../../state/matchFlow';
import { GKButton, Card } from '../../ui/components';
import { Crest } from '../../ui/Crest';
import {
  IconBall, IconCard, IconFlag, IconFlash, IconPause, IconWhistle, type IconProps,
} from '../../ui/icons';
import { colors, font, radius, spacing } from '../../ui/theme';
import { playSound } from '../../core/services/sound';
import type { RootScreenProps } from '../../navigation/types';

/**
 * Live view of the match simulation (chapter 3.4): the timer visibly runs
 * along and events/goals pop in at their minute - like a live ticker.
 *
 * V5: Zur Halbzeit pausiert das Spiel (Pfiff). In der Pause kann man
 * auswechseln und die Taktik ändern - erst dann wird die zweite Hälfte
 * simuliert (matchFlow.resumeSecondHalf). Dazu läuft ein Ballbesitz-Balken
 * (grün = eigenes Team, rot = Gegner) live mit.
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
  const [skipped, setSkipped] = useState(false);
  const [resuming, setResuming] = useState(false);
  const [subsOpen, setSubsOpen] = useState(false);
  const [selectedOutId, setSelectedOutId] = useState<number | null>(null);
  const listRef = useRef<FlatList<MatchEvent>>(null);

  const game = useGameStore();
  const [halftimeTactic, setHalftimeTactic] = useState<Tactic>(game.club?.tactic ?? 'ausgewogen');

  const events = played?.match.events ?? [];
  const halftimePending = played?.halftimePending === true;

  // Wartende Meister-Feier erst freigeben, wenn die Live-Ansicht zugeht
  // (Continue-Button oder Hardware-Back) – nie schon vor dem Abpfiff
  useEffect(() => () => useLeagueStore.getState().revealCelebration(), []);

  // Ticker: läuft bis zur Halbzeit (45, solange die 2. Hälfte aussteht)
  // bzw. bis zum Abpfiff (90)
  useEffect(() => {
    const t = setInterval(() => {
      setMinute((m) => {
        const cap = useLeagueStore.getState().lastPlayedMatch?.halftimePending ? 45 : 90;
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

  // V3-Sounds: eigenes Tor und Gegentor im Ticker + Abpfiff (nicht beim Skip-Sprung)
  const prevUserGoals = useRef(0);
  const prevOppGoals = useRef(0);
  useEffect(() => {
    if (!played) return;
    const side = played.userIsHome ? 'home' : 'away';
    const userGoals = visibleEvents.filter((e) => e.type === 'tor' && e.team === side).length;
    const oppGoals = visibleEvents.filter((e) => e.type === 'tor' && e.team !== side).length;
    if (userGoals > prevUserGoals.current && !skipped) playSound('goal');
    if (oppGoals > prevOppGoals.current && !skipped) playSound('goalConceded');
    prevUserGoals.current = userGoals;
    prevOppGoals.current = oppGoals;
  }, [visibleEvents, played, skipped]);

  // Pfiffe: Halbzeit (V5) und Abpfiff
  const halftimeWhistled = useRef(false);
  useEffect(() => {
    if (minute >= 45 && halftimePending && !halftimeWhistled.current) {
      halftimeWhistled.current = true;
      playSound('fulltime');
    }
  }, [minute, halftimePending]);

  const fulltimeSoundPlayed = useRef(false);
  useEffect(() => {
    if (minute >= 90 && !fulltimeSoundPlayed.current) {
      fulltimeSoundPlayed.current = true;
      playSound('fulltime');
    }
  }, [minute]);

  // Platz-Kampf endete unentschieden (V4): nach dem Abpfiff automatisch
  // weiter ins Elfmeterschießen (kein Remis bei Platz-Kämpfen). Gilt NUR
  // für Platz-Kampf-Matches, nie für Liga-Spiele oder Friendlies.
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
  const atHalftime = minute >= 45 && halftimePending;
  const finished = minute >= 90 && !halftimePending;
  const userSide: 'home' | 'away' = userIsHome ? 'home' : 'away';

  // Live-Ballbesitz (V5): aus den bisher sichtbaren Aktionen beider Teams;
  // nach dem Abpfiff der exakte Wert aus der Statistik
  const userTouches = visibleEvents.filter(
    (e) => e.team === userSide && (e.type === 'tor' || e.type === 'chance' || e.type === 'ecke'),
  ).length;
  const oppTouches = visibleEvents.filter(
    (e) => e.team && e.team !== userSide && (e.type === 'tor' || e.type === 'chance' || e.type === 'ecke'),
  ).length;
  const userPossession = finished && stats
    ? (userIsHome ? stats.home.possession : stats.away.possession)
    : Math.round(Math.min(70, Math.max(30, 50 + (userTouches - oppTouches) * 3)));

  // Ticker-Farben: eigenes Tor grün, Gegentor rot; Karten gelb/rot
  const eventColor = (e: MatchEvent): string => {
    if (e.type === 'tor') return e.team === userSide ? colors.pitch : colors.danger;
    if (e.type === 'gelb') return colors.gold;
    if (e.type === 'rot') return colors.danger;
    return colors.inkSoft;
  };

  /** Halbzeit beenden: 2. Hälfte mit gewählter Taktik + aktueller Elf. */
  const onResume = async () => {
    if (resuming) return;
    setResuming(true);
    try {
      setSubsOpen(false);
      playSound('fulltime');
      await resumeSecondHalf(halftimeTactic);
      setSkipped(false);
    } finally {
      setResuming(false);
    }
  };

  const onSkip = () => {
    setSkipped(true);
    setMinute(halftimePending ? 45 : 90);
  };

  // Auswechslungen (V5): aktuelle Elf + Bank; gesperrte Spieler (Liga)
  // dürfen nicht eingewechselt werden
  const lineupIds = game.lineup;
  const xi = lineupIds
    .map((id, slot) => ({ slot, player: game.players.find((p) => p.id === id) ?? null }))
    .filter((e): e is { slot: number; player: NonNullable<typeof e.player> } => e.player !== null);
  const bench = game.players.filter((p) => !lineupIds.includes(p.id));
  const leagueState = useLeagueStore.getState();
  const suspendedIds = new Set(
    isLeagueMatch
      ? leagueState.suspensions
          .filter((s) => s.season === leagueState.season && s.round === leagueState.round)
          .map((s) => s.playerId)
      : [],
  );

  const onSubIn = async (benchId: number) => {
    if (selectedOutId === null) return;
    const slot = lineupIds.indexOf(selectedOutId);
    if (slot < 0) return;
    await game.setLineupSlot(slot, benchId);
    setSelectedOutId(null);
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

      {/* Ballbesitz live (V5): grün = eigenes Team, rot = Gegner */}
      <View style={styles.possessionWrap}>
        <Text style={[styles.possessionValue, { color: '#7CE97C' }]}>{userPossession}%</Text>
        <View style={styles.possessionBar}>
          <View style={[styles.possessionUser, { flex: userPossession }]} />
          <View style={[styles.possessionOpp, { flex: 100 - userPossession }]} />
        </View>
        <Text style={[styles.possessionValue, { color: '#FF6B5E' }]}>{100 - userPossession}%</Text>
      </View>

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
          return (
            <Card style={[styles.eventCard, item.type === 'tor' && styles.goalCard]}>
              <Text style={styles.eventMinute}>{item.minute}'</Text>
              <EventIcon size={18} color={eventColor(item)} />
              <Text style={[styles.eventText, item.type === 'tor' && styles.goalText]}>
                {item.text}
              </Text>
            </Card>
          );
        }}
      />

      {/* Halbzeit-Pause (V5): Taktik ändern, wechseln, dann weiter */}
      {atHalftime ? (
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

      {/* Auswechslungen: Spieler der Elf antippen, dann Bank-Spieler */}
      <Modal visible={subsOpen} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalSheet, { paddingBottom: insets.bottom + spacing.md }]}>
            <Text style={styles.subsTitle}>
              {selectedOutId === null
                ? 'Tap the player to take OFF'
                : 'Now tap the bench player to bring ON'}
            </Text>
            <ScrollView style={styles.subsList}>
              <Text style={styles.subsSection}>On the pitch</Text>
              {xi.map(({ player }) => (
                <Pressable
                  key={player.id}
                  style={[styles.subsRow, selectedOutId === player.id && styles.subsRowSelected]}
                  onPress={() => setSelectedOutId(player.id)}
                >
                  <Text style={styles.subsName} numberOfLines={1}>
                    {player.pool.name}
                  </Text>
                  <Text style={styles.subsMeta}>
                    {POSITION_SHORT[player.pool.position]} · {effectiveOverall(player.pool, player.level)}
                  </Text>
                </Pressable>
              ))}
              <Text style={styles.subsSection}>Bench</Text>
              {bench.length === 0 && (
                <Text style={styles.subsMeta}>No bench players available.</Text>
              )}
              {bench.map((player) => {
                const suspended = suspendedIds.has(player.id);
                return (
                  <Pressable
                    key={player.id}
                    style={[styles.subsRow, suspended && styles.subsRowDisabled]}
                    disabled={suspended || selectedOutId === null}
                    onPress={() => onSubIn(player.id)}
                  >
                    <Text style={styles.subsName} numberOfLines={1}>
                      {player.pool.name}
                    </Text>
                    <Text style={styles.subsMeta}>
                      {suspended
                        ? 'suspended'
                        : `${POSITION_SHORT[player.pool.position]} · ${effectiveOverall(player.pool, player.level)}`}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <GKButton title="Done" variant="secondary" onPress={() => { setSubsOpen(false); setSelectedOutId(null); }} />
          </View>
        </View>
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
    paddingBottom: spacing.sm,
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.md,
    maxHeight: '85%',
  },
  subsTitle: {
    fontSize: font.h2,
    fontWeight: '900',
    color: colors.ink,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  subsList: {
    maxHeight: 380,
    marginBottom: spacing.sm,
  },
  subsSection: {
    fontWeight: '900',
    color: colors.pitchDark,
    fontSize: font.small,
    marginTop: spacing.sm,
    marginBottom: 4,
  },
  subsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.line,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    marginBottom: 4,
  },
  subsRowSelected: {
    borderColor: colors.accent,
    backgroundColor: '#FFF3E0',
  },
  subsRowDisabled: {
    opacity: 0.5,
  },
  subsName: {
    flex: 1,
    fontWeight: '700',
    color: colors.ink,
    marginRight: spacing.sm,
  },
  subsMeta: {
    fontSize: font.small,
    color: colors.inkSoft,
    fontWeight: '700',
  },
});
