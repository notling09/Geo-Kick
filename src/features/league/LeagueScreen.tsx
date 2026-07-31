import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';
import { LEAGUE, TACTIC_LABEL, USER_CLUB_ID } from '../../core/domain/constants';
import { t, tf, type TKey } from '../../core/i18n';
import type { Match, Tactic } from '../../core/domain/types';
import {
  KO_STAGES, nextUserClMatch, userHasClMatch, userTournamentSlots,
  type ClMatch, type ClStage, type UserClSlot,
} from '../../core/engine/cl';
import { ClBracketView } from './ClBracketView';
import { useGameStore } from '../../state/gameStore';
import { useLeagueStore } from '../../state/leagueStore';
import { useClStore } from '../../state/clStore';
import { GKButton, Card, SectionTitle } from '../../ui/components';
import { ChampionOverlay } from '../../ui/ChampionOverlay';
import { Crest } from '../../ui/Crest';
import { IconCheck, IconClock, IconCross, IconMinus, IconTrophy } from '../../ui/icons';
import { colors, font, radius, spacing } from '../../ui/theme';
import type { TabScreenProps } from '../../navigation/types';

/**
 * League (chapter 3.4): table, fixtures, tactic choice before each match
 * and the live simulation. One match every 30 minutes, 14 rounds, promotion and
 * relegation at the end of the season.
 */

const TACTICS: Tactic[] = ['offensiv', 'ausgewogen', 'defensiv'];

/** Runden-Labels für den Turnier-Teil des Saison-Kalenders (V7.3). */
const CL_STAGE_LABEL: Record<ClStage, TKey> = {
  group: 'clGroupStage',
  r16: 'clStageR16',
  qf: 'clStageQf',
  sf: 'clStageSf',
  final: 'clStageFinal',
};

function formatCountdown(ms: number): string {
  const h = Math.floor(ms / 3600000);
  const m = Math.ceil((ms % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}min` : `${m}min`;
}

export function LeagueScreen({ navigation }: TabScreenProps<'League'>) {
  const isFocused = useIsFocused();
  const club = useGameStore((s) => s.club);
  const players = useGameStore((s) => s.players);
  const {
    season, round, standings, matches, seasonMessage, championCelebration,
    hydrate, matchReady, msUntilNextMatch, playUserMatchday, acknowledgeSeasonMessage,
    acknowledgeCelebration, clubName, clubCrest,
  } = useLeagueStore();
  const seasonReview = useLeagueStore((s) => s.seasonReview);
  const pendingCelebration = useLeagueStore((s) => s.pendingCelebration);
  const div1Slot = useLeagueStore((s) => s.div1Slot);
  const rivalClubId = useLeagueStore((s) => s.rivalClubId);
  const nextMatchAt = useLeagueStore((s) => s.nextMatchAt);
  const clState = useClStore((s) => s.state);
  const lineup = useGameStore((s) => s.lineup);
  const suspensions = useLeagueStore((s) => s.suspensions);
  const injuries = useLeagueStore((s) => s.injuries);

  // Turnier (V7/V7.2): jeder 3. Slot ist ein Turnierspiel. CL in Division 1,
  // Nationaler Pokal in Division 2–4 (state.kind unterscheidet die Texte).
  const isCup = clState?.kind === 'cup';
  const isClNext = div1Slot % 3 === 2 && !!clState;

  // Für das NÄCHSTE Spiel gesperrte eigene Spieler (rote Karte). Je nachdem, ob
  // als nächstes ein Liga- oder Turnierspiel ansteht, gilt die passende Sperre
  // (Liga-Sperre nur in der Liga, Turnier-Sperre nur im Turnier, V7.4).
  const suspendedInLineup = useMemo(() => {
    const names = suspensions
      .filter((s) => {
        if (!lineup.includes(s.playerId) || s.season !== season) return false;
        return isClNext ? s.kind === 'tournament' : s.kind !== 'tournament' && s.round === round;
      })
      .map((s) => s.playerName);
    // Verletzte gelten immer (Liga UND Turnier), V7.4
    injuries
      .filter((i) => i.matchesLeft > 0 && lineup.includes(i.playerId))
      .forEach((i) => names.push(i.playerName));
    return names;
  }, [suspensions, injuries, season, round, lineup, isClNext]);
  const clFixture = clState && isClNext ? nextUserClMatch(clState) : null;
  const clUserOut = isClNext && clState ? !userHasClMatch(clState) : false;

  // Saison-Rückblick-Show (V5): startet automatisch, sobald der Liga-Tab
  // nach dem letzten Spieltag wieder sichtbar ist (nach der Meister-Feier)
  const reviewShown = useRef(false);
  useEffect(() => {
    if (!seasonReview) {
      reviewShown.current = false;
      return;
    }
    if (isFocused && !championCelebration && !pendingCelebration && !reviewShown.current) {
      reviewShown.current = true;
      navigation.navigate('SeasonReview');
    }
  }, [isFocused, seasonReview, championCelebration, pendingCelebration, navigation]);

  const celebrationCaptain =
    championCelebration?.captainPlayerId != null
      ? players.find((p) => p.id === championCelebration.captainPlayerId)?.pool ?? null
      : null;

  // Immer neutral starten (V7.4-Fix): die Taktik ist eine Wahl PRO Spiel, kein
  // persistenter Klub-Wert. Früher wurde club.tactic gelesen, der von Halbzeit-
  // Wechseln „verschmutzt" war – dadurch stand der Selektor schon auf
  // offensiv/defensiv, ohne dass der Nutzer etwas gedrückt hatte.
  const [tactic, setTactic] = useState<Tactic>('ausgewogen');
  const [starting, setStarting] = useState(false);
  const [, forceTick] = useState(0);
  const [fixtureSlot, setFixtureSlot] = useState<number | null>(null);
  // Tabelle-Tab (V7.1): in Division 1 zwischen Ligatabelle und CL-Bracket
  const [tableTab, setTableTab] = useState<'league' | 'cl'>('league');

  useEffect(() => {
    if (isFocused) hydrate();
  }, [isFocused, hydrate]);

  // Refresh the countdown label periodically
  useEffect(() => {
    const t = setInterval(() => forceTick((n) => n + 1), 30000);
    return () => clearInterval(t);
  }, []);

  const seasonOver = round > LEAGUE.roundsPerSeason;
  const ready = matchReady();

  const nextUserMatch = useMemo(
    () =>
      matches.find(
        (m) => m.round === round && !m.played && (m.homeId === USER_CLUB_ID || m.awayId === USER_CLUB_ID),
      ) ?? null,
    [matches, round],
  );

  // Topscorer/Assists der Saison aus den strukturierten Tor-Events aggregieren
  const { topScorers, topAssists } = useMemo(() => {
    const goals = new Map<string, { player: string; clubId: string; count: number }>();
    const assists = new Map<string, { player: string; clubId: string; count: number }>();
    const bump = (
      map: Map<string, { player: string; clubId: string; count: number }>,
      player: string,
      clubId: string,
    ) => {
      const key = `${player}|${clubId}`;
      const entry = map.get(key) ?? { player, clubId, count: 0 };
      entry.count++;
      map.set(key, entry);
    };
    matches
      .filter((m) => m.played)
      .forEach((m) => {
        m.events
          .filter((e) => e.type === 'tor' && e.team)
          .forEach((e) => {
            const clubId = e.team === 'home' ? m.homeId : m.awayId;
            if (e.player) bump(goals, e.player, clubId);
            if (e.assist) bump(assists, e.assist, clubId);
          });
      });
    const top = (map: typeof goals) =>
      [...map.values()].sort((a, b) => b.count - a.count || a.player.localeCompare(b.player)).slice(0, 5);
    return { topScorers: top(goals), topAssists: top(assists) };
  }, [matches]);

  // Spielplan (V7.3): der persönliche Ablauf der Saison. Mit Turnier sind es
  // 21 Slots (14 Liga + 7 Turnier) in Reihenfolge, je Slot ob Liga oder Turnier
  // – inklusive Turnier-Ergebnissen und den noch offenen K.o.-Plätzen. Ohne
  // Turnier (Alt-Spielstand) sind es die 14 Ligaspiele.
  const userFixtureFor = (r: number): Match | null =>
    matches.find(
      (m) => m.round === r && (m.homeId === USER_CLUB_ID || m.awayId === USER_CLUB_ID),
    ) ?? null;
  const seasonPlan = useMemo(() => {
    const plan: Array<
      | { slot: number; type: 'league'; round: number; fixture: Match | null }
      | { slot: number; type: 'tournament'; ts: UserClSlot }
    > = [];
    if (clState) {
      const tSlots = userTournamentSlots(clState);
      let leagueRound = 0;
      let tournIdx = 0;
      for (let slot = 0; slot < 21; slot++) {
        if (slot % 3 === 2) {
          plan.push({ slot, type: 'tournament', ts: tSlots[tournIdx++] });
        } else {
          leagueRound++;
          plan.push({ slot, type: 'league', round: leagueRound, fixture: userFixtureFor(leagueRound) });
        }
      }
    } else {
      for (let r = 1; r <= LEAGUE.roundsPerSeason; r++) {
        plan.push({ slot: r - 1, type: 'league', round: r, fixture: userFixtureFor(r) });
      }
    }
    return plan;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clState, matches]);
  // Aktueller Slot (Turnier: div1Slot; sonst der laufende Spieltag)
  const currentPlanSlot = clState ? div1Slot : Math.min(round, LEAGUE.roundsPerSeason) - 1;
  // Im Spielplan-Blätterer gewählter Slot (Default = aktueller Slot)
  const maxSlot = seasonPlan.length - 1;
  const selectedFixtureSlot = Math.min(fixtureSlot ?? currentPlanSlot, maxSlot);

  // Eigene Ergebnisse (V7.4): Liga UND Turnier zusammen, gekennzeichnet. In
  // Slot-Reihenfolge, neueste zuerst. Ausgeschiedene/kommende Runden erzeugen
  // kein Ergebnis (ts.status !== 'played'), das ergibt Sinn.
  const userResults = useMemo(() => {
    const out: Array<{
      key: string; kind: 'league' | 'cl' | 'cup'; labelText: string;
      homeName: string; awayName: string; homeGoals: number; awayGoals: number; userIsHome: boolean;
    }> = [];
    for (const e of seasonPlan) {
      if (e.type === 'league') {
        const f = e.fixture;
        if (f && f.played) {
          out.push({
            key: `l${f.id}`, kind: 'league', labelText: tf('lgPlanMatchday', { n: e.round }),
            homeName: clubName(f.homeId), awayName: clubName(f.awayId),
            homeGoals: f.homeGoals, awayGoals: f.awayGoals, userIsHome: f.homeId === USER_CLUB_ID,
          });
        }
      } else if (clState && e.ts.status === 'played' && e.ts.match) {
        const m = e.ts.match;
        out.push({
          key: `t${e.slot}`, kind: isCup ? 'cup' : 'cl',
          labelText: m.isThird ? t('clStageThird') : t(CL_STAGE_LABEL[e.ts.stage]),
          homeName: clState.teams[m.homeId]?.name ?? '?', awayName: clState.teams[m.awayId]?.name ?? '?',
          homeGoals: m.homeGoals, awayGoals: m.awayGoals, userIsHome: m.homeId === USER_CLUB_ID,
        });
      }
    }
    return out.reverse();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seasonPlan, clState, isCup]);

  const onKickoff = async () => {
    // Gesperrte Spieler (rote Karte) müssen erst raus – aber nur, wenn das
    // eigene Team überhaupt spielt. Ist der Nutzer im Turnier ausgeschieden
    // (clUserOut), wird nur die nächste Runde angeschaut; dann darf eine alte
    // Turnier-Sperre den Button nicht blockieren (V7.4-Fix).
    if (!clUserOut && suspendedInLineup.length > 0) {
      Alert.alert(t('lgSuspendedTitle'), tf('lgSuspendedBody', { names: suspendedInLineup.join(', ') }));
      return;
    }
    setStarting(true);
    try {
      if (isClNext) {
        if (clUserOut) {
          // Nutzer raus: die nächste Runde simulieren und als schnelle
          // Wiedergabe zeigen (V7.3); danach der aktualisierte Turnierbaum
          await useClStore.getState().simulateNextRound();
          setTableTab('cl');
          if (useClStore.getState().lastPlayback) {
            navigation.navigate('TournamentPlayback');
          } else {
            navigation.navigate('ChampionsLeague');
          }
        } else {
          const played = await useClStore.getState().playUserClMatch(tactic);
          if (played) navigation.navigate('MatchLive');
        }
      } else {
        const played = await playUserMatchday(tactic);
        if (played) navigation.navigate('MatchLive');
      }
    } finally {
      setStarting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {championCelebration && isFocused && (
        <ChampionOverlay
          visible
          clubName={championCelebration.clubName}
          division={championCelebration.division}
          captain={celebrationCaptain}
          onDismiss={acknowledgeCelebration}
        />
      )}
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{t('lgTitle')}</Text>
          <Pressable style={styles.lbButton} onPress={() => navigation.navigate('Leaderboard')}>
            <IconTrophy size={18} color={colors.gold} />
            <Text style={styles.lbButtonText}>{t('lbTitle')}</Text>
          </Pressable>
        </View>
        <Text style={styles.subtitle}>
          {tf('lgSubtitle', {
            div: club?.division ?? 4,
            season,
            round: Math.min(round, LEAGUE.roundsPerSeason),
            total: LEAGUE.roundsPerSeason,
          })}
        </Text>

        {seasonMessage ? (
          <Card style={styles.messageCard}>
            <Text style={styles.messageText}>{seasonMessage}</Text>
            <GKButton title={t('gotIt')} variant="secondary" onPress={acknowledgeSeasonMessage} />
          </Card>
        ) : null}

        {isClNext ? (
          (() => {
            const clOppId = clFixture
              ? clFixture.homeId === USER_CLUB_ID
                ? clFixture.awayId
                : clFixture.homeId
              : null;
            const clOpp = clOppId && clState ? clState.teams[clOppId] : null;
            const clReady = msUntilNextMatch() <= 0;
            return (
              <>
                <SectionTitle>{isCup ? t('cupNextMatch') : t('clNextMatch')}</SectionTitle>
                <Card style={styles.clCard}>
                  {clUserOut || !clOpp ? (
                    <>
                      <Text style={styles.clOut}>{isCup ? t('cupOut') : t('clOut')}</Text>
                      <GKButton
                        title={isCup ? t('cupWatchRound') : t('clWatchRound')}
                        variant="secondary"
                        onPress={onKickoff}
                        loading={starting}
                      />
                    </>
                  ) : (
                    <>
                      <View style={styles.matchupRow}>
                        <View style={styles.matchupSide}>
                          <Crest crestId={club?.crest ?? 'crest-0'} size={52} />
                          <Text style={styles.matchupName} numberOfLines={2}>{club?.name}</Text>
                        </View>
                        <Text style={styles.vs}>vs</Text>
                        <View style={styles.matchupSide}>
                          <Crest crestId={clOpp.crest} size={52} />
                          <Text style={styles.matchupName} numberOfLines={2}>{clOpp.name}</Text>
                        </View>
                      </View>
                      {clReady ? (
                        <>
                          <Text style={styles.tacticTitle}>{t('lgChooseTactic')}</Text>
                          <View style={styles.tacticRow}>
                            {TACTICS.map((tc) => (
                              <Pressable
                                key={tc}
                                onPress={() => setTactic(tc)}
                                style={[styles.tacticChip, tactic === tc && styles.tacticActive]}
                              >
                                <Text style={[styles.tacticText, tactic === tc && styles.tacticTextActive]}>
                                  {TACTIC_LABEL[tc]}
                                </Text>
                              </Pressable>
                            ))}
                          </View>
                          <GKButton title={isCup ? t('cupKickoff') : t('clKickoff')} onPress={onKickoff} loading={starting} />
                        </>
                      ) : (
                        <View style={styles.countdownRow}>
                          <IconClock size={20} color={colors.accentDark} />
                          <Text style={styles.countdown}>
                            {tf('lgCountdown', { time: formatCountdown(msUntilNextMatch()) })}
                          </Text>
                        </View>
                      )}
                    </>
                  )}
                </Card>
              </>
            );
          })()
        ) : (
          <>
            <SectionTitle>{t('lgNextMatch')}</SectionTitle>
            {nextUserMatch && !seasonOver ? (
              <Card>
                <View style={styles.matchupRow}>
                  <View style={styles.matchupSide}>
                    <Crest crestId={clubCrest(nextUserMatch.homeId)} size={52} />
                    <Text style={styles.matchupName} numberOfLines={2}>
                      {clubName(nextUserMatch.homeId)}
                    </Text>
                  </View>
                  <Text style={styles.vs}>vs</Text>
                  <View style={styles.matchupSide}>
                    <Crest crestId={clubCrest(nextUserMatch.awayId)} size={52} />
                    <Text style={styles.matchupName} numberOfLines={2}>
                      {clubName(nextUserMatch.awayId)}
                    </Text>
                  </View>
                </View>

                {rivalClubId != null &&
                  (String(nextUserMatch.homeId) === String(rivalClubId) ||
                    String(nextUserMatch.awayId) === String(rivalClubId)) && (
                    <View style={styles.rivalBanner}>
                      <Text style={styles.rivalBannerText}>{t('lgRivalMatch')}</Text>
                    </View>
                  )}

                {ready ? (
                  <>
                    <Text style={styles.tacticTitle}>{t('lgChooseTactic')}</Text>
                    <View style={styles.tacticRow}>
                      {TACTICS.map((tc) => (
                        <Pressable
                          key={tc}
                          onPress={() => setTactic(tc)}
                          style={[styles.tacticChip, tactic === tc && styles.tacticActive]}
                        >
                          <Text style={[styles.tacticText, tactic === tc && styles.tacticTextActive]}>
                            {TACTIC_LABEL[tc]}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                    <Text style={styles.tacticHint}>
                      {tf('lgFormationHint', { f: club?.formation ?? '4-2-2-2' })}
                    </Text>
                    <GKButton title={t('lgKickoff')} onPress={onKickoff} loading={starting} />
                  </>
                ) : (
                  <View style={styles.countdownRow}>
                    <IconClock size={20} color={colors.accentDark} />
                    <Text style={styles.countdown}>
                      {tf('lgCountdown', { time: formatCountdown(msUntilNextMatch()) })}
                    </Text>
                  </View>
                )}
              </Card>
            ) : (
              <Card>
                <Text style={styles.countdown}>{t('lgSeasonDone')}</Text>
              </Card>
            )}
          </>
        )}

        <Card style={styles.friendliesCard}>
          <View style={styles.friendliesRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.friendliesTitle}>{t('lgFriendlies')}</Text>
              <Text style={styles.friendliesHint}>
                {t('lgFriendliesHint')}
              </Text>
            </View>
            <GKButton
              title={t('open')}
              variant="secondary"
              style={styles.friendliesBtn}
              onPress={() => navigation.navigate('Friendlies')}
            />
          </View>
        </Card>

        {/* Division 1: Umschalter Ligatabelle / Champions League (V7.1) */}
        {clState ? (
          <View style={styles.tableTabs}>
            <Pressable
              style={[styles.tableTab, tableTab === 'league' && styles.tableTabActive]}
              onPress={() => setTableTab('league')}
            >
              <Text style={[styles.tableTabText, tableTab === 'league' && styles.tableTabTextActive]}>
                {t('lgTable')}
              </Text>
            </Pressable>
            <Pressable
              style={[styles.tableTab, tableTab === 'cl' && styles.tableTabActive]}
              onPress={() => setTableTab('cl')}
            >
              <Text style={[styles.tableTabText, tableTab === 'cl' && styles.tableTabTextActive]}>
                {isCup ? t('cupName') : t('clName')}
              </Text>
            </Pressable>
          </View>
        ) : (
          <SectionTitle>{t('lgTable')}</SectionTitle>
        )}

        {clState && tableTab === 'cl' ? (
          <ClBracketView state={clState} />
        ) : (
        <Card style={{ paddingVertical: spacing.sm }}>
          <View style={styles.tableHeader}>
            <Text style={[styles.th, styles.colPos]}>#</Text>
            <Text style={[styles.th, styles.colClub]}>{t('lgClub')}</Text>
            <Text style={[styles.th, styles.colNum]}>P</Text>
            <Text style={[styles.th, styles.colNum]}>GD</Text>
            <Text style={[styles.th, styles.colNum]}>Pts</Text>
          </View>
          {standings.map((row, i) => {
            const isUser = row.clubId === USER_CLUB_ID;
            const isRival = !isUser && rivalClubId != null && String(row.clubId) === String(rivalClubId);
            const promo = i < LEAGUE.promotionSpots;
            const releg = i >= standings.length - LEAGUE.relegationSpots;
            return (
              <View
                key={row.clubId}
                style={[styles.tableRow, isUser && styles.userRow, isRival && styles.rivalRow]}
              >
                <Text style={[styles.td, styles.colPos, promo && styles.promoText, releg && styles.relegText]}>
                  {i + 1}
                </Text>
                <View style={[styles.clubCell, styles.colClub]}>
                  <Crest crestId={row.crest} size={18} />
                  <Text
                    style={[styles.td, styles.clubCellName, isUser && styles.userText, isRival && styles.rivalText]}
                    numberOfLines={1}
                  >
                    {row.name}
                  </Text>
                  {isRival && <Text style={styles.rivalTag}>{t('lgRivalTag')}</Text>}
                </View>
                <Text style={[styles.td, styles.colNum]}>{row.played}</Text>
                <Text style={[styles.td, styles.colNum]}>{row.goalsFor - row.goalsAgainst}</Text>
                <Text style={[styles.td, styles.colNum, styles.points]}>{row.points}</Text>
              </View>
            );
          })}
          <Text style={styles.legend}>
            {tf('lgLegend', { p: LEAGUE.promotionSpots, r: LEAGUE.relegationSpots })}
          </Text>
        </Card>
        )}

        {/* Liga-Torschützen nur auf dem Liga-Tab; im Turnier-Tab stehen die
            Turnier-Torschützen bereits im Bracket (V7.3) */}
        {tableTab === 'league' && (topScorers.length > 0 || topAssists.length > 0) && (
          <>
            <SectionTitle>{t('lgTopScorers')}</SectionTitle>
            <Card style={{ marginBottom: spacing.sm }}>
              {topScorers.map((s, i) => (
                <View key={`${s.player}|${s.clubId}`} style={styles.scorerRow}>
                  <Text style={[styles.td, styles.colPos]}>{i + 1}</Text>
                  <Text
                    style={[styles.td, styles.colClub, s.clubId === USER_CLUB_ID && styles.userText]}
                    numberOfLines={1}
                  >
                    {s.player} · {clubName(s.clubId)}
                  </Text>
                  <Text style={[styles.td, styles.colNum, styles.points]}>{s.count}</Text>
                </View>
              ))}
              {topAssists.length > 0 && <Text style={styles.assistHeader}>{t('lgTopAssists')}</Text>}
              {topAssists.map((s, i) => (
                <View key={`${s.player}|${s.clubId}`} style={styles.scorerRow}>
                  <Text style={[styles.td, styles.colPos]}>{i + 1}</Text>
                  <Text
                    style={[styles.td, styles.colClub, s.clubId === USER_CLUB_ID && styles.userText]}
                    numberOfLines={1}
                  >
                    {s.player} · {clubName(s.clubId)}
                  </Text>
                  <Text style={[styles.td, styles.colNum, styles.points]}>{s.count}</Text>
                </View>
              ))}
            </Card>
          </>
        )}

        {/* Spielplan (V7.3): Blätterer über alle Slots der Saison. Mit Turnier
            sind es 21 (Liga grün, CL/Pokal orange markiert), sonst 14. Pro Slot
            werden alle Paarungen des Spieltags bzw. der Turnierrunde gezeigt. */}
        <SectionTitle>{t('lgFixtures')}</SectionTitle>
        <Card>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.roundPicker}>
            {seasonPlan.map((e) => {
              const active = e.slot === selectedFixtureSlot;
              const isTourn = e.type === 'tournament';
              return (
                <Pressable
                  key={e.slot}
                  onPress={() => setFixtureSlot(e.slot)}
                  style={[
                    styles.roundChip,
                    isTourn && styles.roundChipCup,
                    active && (isTourn ? styles.roundChipCupActive : styles.roundChipActive),
                  ]}
                >
                  <Text
                    style={[
                      styles.roundChipText,
                      active && styles.roundChipTextActive,
                      isTourn && !active && styles.roundChipCupText,
                    ]}
                  >
                    {e.slot + 1}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {(() => {
            const e = seasonPlan[selectedFixtureSlot];
            if (!e) return null;
            // Kopfzeile: Liga-Spieltag oder Turnierrunde
            const header =
              e.type === 'league' ? (
                <View style={styles.fixtureHeaderRow}>
                  <Text style={[styles.planTag, styles.planTagLeague]}>{t('lgPlanLeague')}</Text>
                  <Text style={styles.fixtureHeaderText}>{tf('lgPlanMatchday', { n: e.round })}</Text>
                </View>
              ) : (
                <View style={styles.fixtureHeaderRow}>
                  <Text style={[styles.planTag, styles.planTagCl]}>{isCup ? 'CUP' : 'CL'}</Text>
                  <Text style={styles.fixtureHeaderText}>{t(CL_STAGE_LABEL[e.ts.stage])}</Text>
                </View>
              );

            // Paarungen des gewählten Slots
            let rows: Array<{
              key: string; homeName: string; awayName: string;
              homeGoals: number; awayGoals: number; played: boolean; involvesUser: boolean;
            }> = [];
            if (e.type === 'league') {
              rows = matches
                .filter((m) => m.round === e.round)
                .map((m) => ({
                  key: String(m.id),
                  homeName: clubName(m.homeId),
                  awayName: clubName(m.awayId),
                  homeGoals: m.homeGoals,
                  awayGoals: m.awayGoals,
                  played: m.played,
                  involvesUser: m.homeId === USER_CLUB_ID || m.awayId === USER_CLUB_ID,
                }));
            } else if (clState) {
              const k = (e.slot - 2) / 3; // Turnier-Index 0..6
              let stageMatches: ClMatch[] =
                k < 3
                  ? [clState.groupMatches[k], clState.groupMatches[k + 3]].filter(
                      (m): m is ClMatch => !!m,
                    )
                  : clState.ko[KO_STAGES[k - 3]] ?? [];
              // Beim Finale das Spiel um Platz 3 mit anzeigen (V7.4)
              if (k === 6 && clState.thirdPlace) {
                stageMatches = [...stageMatches, clState.thirdPlace];
              }
              rows = stageMatches.map((m, i) => ({
                key: `t${i}`,
                homeName: clState.teams[m.homeId]?.name ?? '?',
                awayName: clState.teams[m.awayId]?.name ?? '?',
                homeGoals: m.homeGoals,
                awayGoals: m.awayGoals,
                played: m.played,
                involvesUser: m.homeId === USER_CLUB_ID || m.awayId === USER_CLUB_ID,
              }));
            }

            return (
              <>
                {header}
                {rows.length === 0 ? (
                  <Text style={styles.fixtureEmpty}>{t('lgPlanUnknown')}</Text>
                ) : (
                  rows.map((r) => (
                    <View key={r.key} style={[styles.fixtureRow, r.involvesUser && styles.fixtureUserRow]}>
                      <Text
                        style={[styles.fixtureName, styles.fixtureHome, r.involvesUser && styles.userText]}
                        numberOfLines={1}
                      >
                        {r.homeName}
                      </Text>
                      <Text style={styles.fixtureScore}>
                        {r.played ? `${r.homeGoals}:${r.awayGoals}` : '–:–'}
                      </Text>
                      <Text
                        style={[styles.fixtureName, r.involvesUser && styles.userText]}
                        numberOfLines={1}
                      >
                        {r.awayName}
                      </Text>
                    </View>
                  ))
                )}
              </>
            );
          })()}
        </Card>

        <SectionTitle>{t('lgYourResults')}</SectionTitle>
        {userResults.length === 0 ? (
          <Text style={styles.emptyText}>{t('lgNoMatches')}</Text>
        ) : (
          userResults.map((r) => {
            const userGoals = r.userIsHome ? r.homeGoals : r.awayGoals;
            const oppGoals = r.userIsHome ? r.awayGoals : r.homeGoals;
            const ResultIcon = userGoals > oppGoals ? IconCheck : userGoals < oppGoals ? IconCross : IconMinus;
            return (
              <Card key={r.key} style={styles.resultCard}>
                <ResultIcon size={16} />
                <Text
                  style={[styles.planTag, r.kind === 'league' ? styles.planTagLeague : styles.planTagCl]}
                >
                  {r.kind === 'league' ? t('lgPlanLeague') : r.kind === 'cup' ? 'CUP' : 'CL'}
                </Text>
                <Text style={styles.resultText} numberOfLines={1}>
                  {r.labelText} · {r.homeName} {r.homeGoals}:{r.awayGoals} {r.awayName}
                </Text>
              </Card>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: font.title,
    fontWeight: '900',
    color: colors.pitchDark,
  },
  lbButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.gold,
    borderRadius: radius.round,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  lbButtonText: {
    fontWeight: '800',
    fontSize: font.small,
    color: colors.ink,
  },
  subtitle: {
    color: colors.inkSoft,
    marginBottom: spacing.md,
  },
  clCard: {
    borderColor: colors.sky,
    borderWidth: 2,
  },
  clOut: {
    color: colors.inkSoft,
    fontSize: font.small,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  tableTabs: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  tableTab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: radius.round,
    borderWidth: 2,
    borderColor: colors.line,
    alignItems: 'center',
  },
  tableTabActive: {
    borderColor: colors.pitch,
    backgroundColor: colors.pitch,
  },
  tableTabText: {
    fontWeight: '800',
    fontSize: font.small,
    color: colors.inkSoft,
  },
  tableTabTextActive: {
    color: '#fff',
  },
  messageCard: {
    backgroundColor: '#FFF8E1',
    marginBottom: spacing.md,
  },
  messageText: {
    fontSize: font.body,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: spacing.sm,
  },
  matchupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  matchupSide: {
    flex: 1,
    alignItems: 'center',
  },
  matchupName: {
    fontWeight: '800',
    color: colors.ink,
    textAlign: 'center',
    marginTop: 4,
  },
  vs: {
    fontSize: font.h1,
    fontWeight: '900',
    color: colors.inkSoft,
    marginHorizontal: spacing.sm,
  },
  tacticTitle: {
    fontWeight: '800',
    color: colors.ink,
    marginBottom: spacing.sm,
  },
  tacticRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  tacticChip: {
    flex: 1,
    borderRadius: radius.round,
    borderWidth: 2,
    borderColor: colors.pitch,
    paddingVertical: 8,
    alignItems: 'center',
  },
  tacticActive: {
    backgroundColor: colors.pitch,
  },
  tacticText: {
    fontWeight: '800',
    color: colors.pitch,
    fontSize: font.small,
  },
  tacticTextActive: {
    color: '#fff',
  },
  tacticHint: {
    fontSize: font.small,
    color: colors.inkSoft,
    marginBottom: spacing.sm,
  },
  countdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  countdown: {
    fontSize: font.h2,
    fontWeight: '800',
    color: colors.accentDark,
    textAlign: 'center',
  },
  friendliesCard: {
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  friendliesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  friendliesTitle: {
    fontSize: font.h2,
    fontWeight: '800',
    color: colors.ink,
  },
  friendliesHint: {
    fontSize: font.small,
    color: colors.inkSoft,
    marginTop: 2,
  },
  friendliesBtn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
  },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 2,
    borderBottomColor: colors.line,
    paddingBottom: 6,
    marginBottom: 4,
  },
  th: {
    fontWeight: '900',
    color: colors.inkSoft,
    fontSize: font.small,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 6,
    alignItems: 'center',
  },
  userRow: {
    backgroundColor: colors.grass,
    borderRadius: radius.sm,
  },
  td: {
    fontSize: font.small,
    color: colors.ink,
  },
  colPos: {
    width: 24,
    textAlign: 'center',
  },
  colClub: {
    flex: 1,
  },
  clubCell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  clubCellName: {
    flexShrink: 1,
  },
  colNum: {
    width: 36,
    textAlign: 'center',
  },
  points: {
    fontWeight: '900',
  },
  userText: {
    fontWeight: '900',
  },
  rivalRow: {
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radius.sm,
  },
  rivalText: {
    color: colors.accent,
    fontWeight: '900',
  },
  rivalTag: {
    fontSize: 9,
    fontWeight: '900',
    color: '#fff',
    backgroundColor: colors.accent,
    borderRadius: radius.sm,
    paddingHorizontal: 4,
    paddingVertical: 1,
    overflow: 'hidden',
  },
  rivalBanner: {
    backgroundColor: colors.accent,
    borderRadius: radius.sm,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginTop: spacing.sm,
    alignItems: 'center',
  },
  rivalBannerText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: font.small,
  },
  promoText: {
    color: colors.pitch,
    fontWeight: '900',
  },
  relegText: {
    color: colors.danger,
    fontWeight: '900',
  },
  legend: {
    fontSize: 10,
    color: colors.inkSoft,
    marginTop: spacing.sm,
  },
  scorerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
  },
  assistHeader: {
    fontWeight: '900',
    color: colors.inkSoft,
    fontSize: font.small,
    marginTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: spacing.sm,
  },
  planRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  planRowCurrent: {
    backgroundColor: colors.grass,
    borderRadius: radius.sm,
  },
  planTag: {
    width: 62,
    textAlign: 'center',
    fontSize: 10,
    fontWeight: '900',
    color: '#fff',
    borderRadius: radius.sm,
    paddingVertical: 3,
    overflow: 'hidden',
  },
  planTagLeague: {
    backgroundColor: colors.pitch,
  },
  planTagCl: {
    backgroundColor: colors.accent,
  },
  planMid: {
    flex: 1,
  },
  planStage: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.inkSoft,
  },
  planMatch: {
    fontSize: font.small,
    fontWeight: '700',
    color: colors.ink,
  },
  planResult: {
    width: 46,
    textAlign: 'center',
    fontWeight: '900',
    color: colors.pitchDark,
    fontSize: font.small,
  },
  roundPicker: {
    marginBottom: spacing.sm,
  },
  roundChip: {
    width: 34,
    height: 34,
    borderRadius: radius.round,
    borderWidth: 2,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  roundChipActive: {
    backgroundColor: colors.pitch,
    borderColor: colors.pitch,
  },
  roundChipText: {
    fontWeight: '800',
    color: colors.inkSoft,
    fontSize: font.small,
  },
  roundChipTextActive: {
    color: '#fff',
  },
  roundChipCup: {
    borderColor: colors.accent,
  },
  roundChipCupActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  roundChipCupText: {
    color: colors.accentDark,
  },
  fixtureHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: 4,
  },
  fixtureHeaderText: {
    fontWeight: '900',
    color: colors.ink,
    fontSize: font.small,
  },
  fixtureEmpty: {
    color: colors.inkSoft,
    fontSize: font.small,
    paddingVertical: spacing.sm,
    textAlign: 'center',
  },
  fixtureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  fixtureUserRow: {
    backgroundColor: colors.grass,
    borderRadius: radius.sm,
  },
  fixtureName: {
    flex: 1,
    fontSize: font.small,
    color: colors.ink,
  },
  fixtureHome: {
    textAlign: 'right',
  },
  fixtureScore: {
    width: 44,
    textAlign: 'center',
    fontWeight: '900',
    color: colors.pitchDark,
    fontSize: font.small,
  },
  resultCard: {
    padding: spacing.sm,
    marginBottom: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  resultText: {
    fontSize: font.small,
    color: colors.ink,
    flex: 1,
  },
  emptyText: {
    color: colors.inkSoft,
    fontStyle: 'italic',
  },
});
