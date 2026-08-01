import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { POSITION_SHORT, TACTIC_LABEL } from '../../core/domain/constants';
import type { MatchEvent, Tactic } from '../../core/domain/types';
import { t, tf } from '../../core/i18n';
import { promptBossReward } from '../map/bossReward';
import { effectiveOverall } from '../../core/engine/playerGen';
import { useBattleStore } from '../../state/battleStore';
import { useClStore } from '../../state/clStore';
import { useGameStore } from '../../state/gameStore';
import { useLeagueStore } from '../../state/leagueStore';
import { useOnlineStore } from '../../state/onlineStore';
import {
  abandonLiveMatch, markAggravatedInjuries, resolveLivePenalty, resumeSecondHalf,
} from '../../state/matchFlow';
import { GKButton, Card } from '../../ui/components';
import { Crest } from '../../ui/Crest';
import { FormationPitch } from '../../ui/FormationPitch';
import { PenaltyGoal } from '../../ui/PenaltyGoal';
import {
  IconBall, IconCard, IconCheck, IconCross, IconFlag, IconFlash, IconPause, IconSwap, IconWhistle,
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
  verletzung: IconCross,
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
  // (Online-Spiele: auch die Verbindung trennen → Gegner wird informiert)
  useEffect(
    () => () => {
      const last = useLeagueStore.getState().lastPlayedMatch;
      if (last?.pause) {
        void abandonLiveMatch();
        const online = last.match.homeId === 'online' || last.match.awayId === 'online';
        if (online) useOnlineStore.getState().leave();
      }
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
  const isOnlineMatch =
    played?.match.homeId === 'online' || played?.match.awayId === 'online';
  const isClMatch = played?.match.homeId === 'cl' || played?.match.awayId === 'cl';
  const isLeagueMatch = (played?.match.season ?? 0) > 0 && !isClMatch;
  const pendingShootoutRaw = useBattleStore((s) => s.pendingShootout);
  const pendingShootout = isBattleMatch ? pendingShootoutRaw : null;
  // Turnier-K.o. remis: Elfmeterschießen (V7.3)
  const clShootout = useClStore((s) => s.pendingShootout);
  const clShootoutPending = isClMatch ? clShootout : null;
  const shootoutStarted = useRef(false);
  useEffect(() => {
    if (minute >= 90 && pendingShootout && !shootoutStarted.current) {
      shootoutStarted.current = true;
      const t = setTimeout(() => navigation.replace('Shootout', { mode: 'battle' }), 2200);
      return () => clearTimeout(t);
    }
  }, [minute, pendingShootout, navigation]);
  useEffect(() => {
    if (minute >= 90 && clShootoutPending && !shootoutStarted.current) {
      shootoutStarted.current = true;
      const t = setTimeout(() => navigation.replace('Shootout', { mode: 'cl' }), 2200);
      return () => clearTimeout(t);
    }
  }, [minute, clShootoutPending, navigation]);

  // Boss in 90 Minuten besiegt (V7): nach dem Abpfiff die Belohnung wählen
  const pendingBossReward = useBattleStore((s) => s.pendingBossReward);
  const bossRewardShown = useRef(false);
  useEffect(() => {
    if (minute >= 90 && !pendingShootout && pendingBossReward && !bossRewardShown.current) {
      bossRewardShown.current = true;
      const t = setTimeout(() => promptBossReward(), 1500);
      return () => clearTimeout(t);
    }
  }, [minute, pendingShootout, pendingBossReward]);

  // Online-Remis (V6): weiter ins Spieler-gegen-Spieler-Elfmeterschießen
  const onlinePhase = useOnlineStore((s) => s.phase);
  const waitingHalf = useOnlineStore((s) => s.waitingHalf);
  useEffect(() => {
    if (minute >= 90 && isOnlineMatch && onlinePhase === 'shootout' && !shootoutStarted.current) {
      shootoutStarted.current = true;
      const t = setTimeout(() => navigation.replace('OnlineShootout'), 2200);
      return () => clearTimeout(t);
    }
  }, [minute, isOnlineMatch, onlinePhase, navigation]);

  // Online-Spiel abgebrochen (Gegner weg / Absage): Ticker sauber verlassen
  useEffect(() => {
    if (isOnlineMatch && onlinePhase === 'idle' && navigation.isFocused()) {
      navigation.goBack();
    }
  }, [isOnlineMatch, onlinePhase, navigation]);

  // Rote Karte (V7.9): ein eigener Spieler, der in der 1. Halbzeit vom Platz
  // gestellt wurde, wird zur Halbzeit AUS DER ELF genommen (leerer Slot). Man
  // spielt in Unterzahl weiter und darf den Platz nicht nachbesetzen – der
  // Wechsel-Block unten verhindert das Auffüllen.
  const redRemovedRef = useRef(false);
  useEffect(() => {
    if (!played) return;
    const atHt = played.pause?.type === 'halftime' && minute >= 45;
    if (!atHt || redRemovedRef.current) return;
    redRemovedRef.current = true;
    const side: 'home' | 'away' = played.userIsHome ? 'home' : 'away';
    const names = new Set(
      (played.match.events ?? [])
        .filter((e) => e.type === 'rot' && e.team === side && e.player)
        .map((e) => e.player as string),
    );
    if (names.size === 0) return;
    void (async () => {
      const g = useGameStore.getState();
      for (let slot = 0; slot < g.lineup.length; slot++) {
        const id = g.lineup[slot];
        if (id === null) continue;
        const p = g.players.find((pp) => pp.id === id);
        if (p && names.has(p.pool.name)) await g.setLineupSlot(slot, null);
      }
    })();
  }, [played, minute]);

  if (!played) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={styles.noMatch}>{t('matchNoMatch')}</Text>
        <GKButton title={t('back')} variant="ghost" onPress={() => navigation.goBack()} />
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

  // In der 1. Halbzeit verletzte eigene Spieler, die noch in der Elf stehen
  // (V7.5). Werden sie nicht ausgewechselt und man macht trotzdem weiter,
  // dauert die Verletzung 1–3 Spiele länger.
  const injuredStillInLineup = (): string[] => {
    const injuredNames = new Set(
      events
        .filter((e) => e.type === 'verletzung' && e.team === userSide && e.player)
        .map((e) => e.player as string),
    );
    if (injuredNames.size === 0) return [];
    return game
      .lineupPlayers()
      .filter((p): p is NonNullable<typeof p> => p !== null && injuredNames.has(p.pool.name))
      .map((p) => p.pool.name);
  };

  const doResume = async (aggravate: string[]) => {
    if (resuming) return;
    setResuming(true);
    try {
      setSubsOpen(false);
      if (aggravate.length > 0) markAggravatedInjuries(aggravate);
      await resumeSecondHalf(halftimeTactic);
      skippedRef.current = false;
    } finally {
      setResuming(false);
    }
  };

  /** Halbzeit beenden: 2. Hälfte mit gewählter Taktik + aktueller Elf. */
  const onResume = async () => {
    if (resuming) return;
    // Nur bei Wettbewerbsspielen zählen Verletzungen dauerhaft (Liga/Turnier).
    const stillInjured = (isLeagueMatch || isClMatch) ? injuredStillInLineup() : [];
    if (stillInjured.length > 0) {
      Alert.alert(
        t('injHalftimeTitle'),
        tf('injHalftimeBody', { names: [...new Set(stillInjured)].join(', ') }),
        [
          { text: t('injHalftimeSub'), style: 'cancel' },
          {
            text: t('injHalftimeGoOn'),
            style: 'destructive',
            onPress: () => { void doResume([...new Set(stillInjured)]); },
          },
        ],
      );
      return;
    }
    await doResume([]);
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
  // Liga- bzw. Turnier-Sperren des laufenden Spiels (rote Karte, V7.4)
  const suspendedIds = new Set(
    isLeagueMatch || isClMatch ? [...leagueState.suspendedForNextMatch()] : [],
  );

  // Rote Karten des eigenen Teams in DIESEM Spiel (V7.9): der Platzverweis gilt
  // sofort – der Spieler darf nicht mehr aufs Feld, und die frei gewordene
  // Position darf nicht nachbesetzt werden (Unterzahl).
  const ownRedNames = new Set(
    events.filter((e) => e.type === 'rot' && e.team === userSide && e.player).map((e) => e.player as string),
  );
  const sentOffIds = new Set(
    game.players.filter((p) => ownRedNames.has(p.pool.name)).map((p) => p.id),
  );
  const maxFieldPlayers = 11 - ownRedNames.size;
  const filledSlots = lineupIds.filter((id) => id !== null).length;

  /** Blockt das Auffüllen eines leeren Slots, wenn man in Unterzahl ist. */
  const blockedManDown = (targetSlot: number): boolean => {
    if (lineupIds[targetSlot] !== null) return false; // Slot besetzt -> normaler Tausch
    if (filledSlots < maxFieldPlayers) return false; // noch Platz (z. B. Verletzung)
    Alert.alert(t('mlManDownTitle'), t('mlManDownBody'));
    return true;
  };

  const onSlotTap = async (slot: number) => {
    if (selection?.type === 'bench') {
      if (blockedManDown(slot)) { setSelection(null); return; }
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
      if (blockedManDown(selection.slot)) { setSelection(null); return; }
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

      {/* Momentum (V5): grün = eigenes Team, rot = Gegner – die Seiten folgen
          der Anzeige oben (Heim links, Auswärts rechts, V6-Fix) */}
      {(() => {
        const homeMomentum = userIsHome ? userMomentum : 100 - userMomentum;
        const leftColor = userIsHome ? '#7CE97C' : '#FF6B5E';
        const rightColor = userIsHome ? '#FF6B5E' : '#7CE97C';
        return (
          <View style={styles.possessionWrap}>
            <Text style={[styles.possessionValue, { color: leftColor }]}>{homeMomentum}%</Text>
            <View style={styles.possessionBar}>
              <View style={{ flex: homeMomentum, backgroundColor: leftColor }} />
              <View style={{ flex: 100 - homeMomentum, backgroundColor: rightColor }} />
            </View>
            <Text style={[styles.possessionValue, { color: rightColor }]}>{100 - homeMomentum}%</Text>
          </View>
        );
      })()}
      <Text style={styles.momentumLabel}>{t('matchMomentum')}</Text>

      {finished && stats && (
        <Card style={styles.statsCard}>
          <Text style={styles.statsTitle}>{t('matchStats')}</Text>
          <StatRow label={t('statGoals')} home={stats.home.goals} away={stats.away.goals} />
          <StatRow label={t('statXg')} home={stats.home.xg.toFixed(1)} away={stats.away.xg.toFixed(1)} />
          <StatRow label={t('statShots')} home={stats.home.shots} away={stats.away.shots} />
          <StatRow label={t('statPossession')} home={`${stats.home.possession}%`} away={`${stats.away.possession}%`} />
          <StatRow label={t('statCorners')} home={stats.home.corners} away={stats.away.corners} />
          <StatRow label={t('statFouls')} home={stats.home.fouls} away={stats.away.fouls} />
          <StatRow label={t('statYellow')} home={stats.home.yellows} away={stats.away.yellows} />
          <StatRow label={t('statRed')} home={stats.home.reds} away={stats.away.reds} />
          <StatRow label={t('statSaves')} home={stats.home.saves ?? 0} away={stats.away.saves ?? 0} />
          {motm && (
            <Text style={styles.motmLine}>
              {tf('matchMotmLine', {
                name: motm.name,
                club: motm.teamName,
                rating: motm.rating.toFixed(1),
                summary: motm.summary,
              })}
            </Text>
          )}
          {coinReward && coinReward.breakdown.length > 0 && (
            <Text style={styles.coinLine}>
              {coinReward.total > 0
                ? `+${coinReward.total} ${t('coins')} (${coinReward.breakdown.join(' · ')})`
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
            {ownPenalty ? t('penFor') : tf('penAgainst', { club: userIsHome ? awayName : homeName })}
          </Text>
          <GKButton
            title={ownPenalty ? t('penTake') : t('penSave')}
            variant="secondary"
            onPress={() => setPenaltyOpen(true)}
          />
        </Card>
      ) : atHalftime ? (
        <Card style={styles.halftimeCard}>
          <Text style={styles.halftimeTitle}>{tf('htTitle', { score: `${homeGoals}:${awayGoals}` })}</Text>
          <Text style={styles.halftimeHint}>
            {t('htHint')}
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
              title={t('htSubs')}
              variant="secondary"
              style={styles.halftimeBtn}
              onPress={() => setSubsOpen(true)}
            />
            <GKButton
              title={isOnlineMatch && waitingHalf ? t('htWaiting') : t('htResume')}
              style={styles.halftimeBtn}
              loading={resuming}
              disabled={isOnlineMatch && waitingHalf}
              onPress={onResume}
            />
          </View>
        </Card>
      ) : (
        <View style={styles.footer}>
          {finished ? (
            pendingShootout ? (
              <GKButton
                title={t('matchShootout')}
                variant="secondary"
                onPress={() => navigation.replace('Shootout', { mode: 'battle' })}
              />
            ) : clShootoutPending ? (
              <GKButton
                title={t('matchShootout')}
                variant="secondary"
                onPress={() => navigation.replace('Shootout', { mode: 'cl' })}
              />
            ) : isOnlineMatch && onlinePhase === 'shootout' ? (
              // Online-Remis: KEIN Continue (das würde das Spiel abbrechen),
              // stattdessen direkt zum Elfmeterschießen
              <GKButton
                title={t('matchShootout')}
                variant="secondary"
                onPress={() => navigation.replace('OnlineShootout')}
              />
            ) : (
              <GKButton
                title={tf('matchContinue', { score: `${match.homeGoals}:${match.awayGoals}` })}
                onPress={() => {
                  navigation.goBack();
                  if (isOnlineMatch) useOnlineStore.getState().leave();
                }}
              />
            )
          ) : (
            <GKButton title={t('skip')} variant="ghost" onPress={onSkip} />
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
          <Text style={styles.subsTitle}>{t('subsTitle')}</Text>
          <Text style={styles.subsHint}>
            {selection === null
              ? t('subsHintNone')
              : selection.type === 'slot'
                ? t('subsHintSlot')
                : t('subsHintBench')}
          </Text>
          <View style={styles.subsPitch}>
            <FormationPitch
              fitHeight
              formation={game.club?.formation ?? '4-2-2-2'}
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
          <Text style={styles.subsSection}>{t('subsBench')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.benchRow}>
            {bench.map((player) => {
              const sentOff = sentOffIds.has(player.id);
              const suspended = suspendedIds.has(player.id) || sentOff;
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
                    {sentOff
                      ? t('subsSentOff')
                      : suspended
                      ? t('subsSuspended')
                      : `${POSITION_SHORT[player.pool.position]} · ${effectiveOverall(player.pool, player.level)}`}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <View style={{ paddingBottom: insets.bottom }}>
            <GKButton
              title={t('done')}
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
    backgroundColor: '#1B5E20',
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
    // Kein heller Fix-Hintergrund mehr: im Dark Mode war heller Text auf
    // heller Box unlesbar - der Gold-Rahmen hebt Tore in beiden Themes hervor
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
    backgroundColor: '#1B5E20',
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
