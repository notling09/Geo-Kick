import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { t, type TKey } from '../../core/i18n';
import type { ClMatch, ClStage } from '../../core/engine/cl';
import { useClStore } from '../../state/clStore';
import { playSound } from '../../core/services/sound';
import { GKButton } from '../../ui/components';
import { Crest } from '../../ui/Crest';
import { colors, font, radius, spacing } from '../../ui/theme';
import type { RootScreenProps } from '../../navigation/types';

/**
 * Schnell-Wiedergabe einer Turnierrunde (V7.3): Ist der Nutzer ausgeschieden,
 * laufen alle Spiele der nächsten Runde gleichzeitig als sehr schneller Ticker
 * durch (die Minuten rasen), Tore poppen zu ihrer Minute auf. Am Ende steht das
 * Endergebnis; danach geht es zum Turnierbaum.
 */

const STAGE_LABEL: Record<ClStage, TKey> = {
  group: 'clGroupStage',
  r16: 'clStageR16',
  qf: 'clStageQf',
  sf: 'clStageSf',
  final: 'clStageFinal',
};

const FULL_TIME = 90;
const STEP_MINUTES = 2; // pro Tick
const STEP_MS = 110; // ~5 s bis zum Abpfiff

export function TournamentPlaybackScreen({ navigation }: RootScreenProps<'TournamentPlayback'>) {
  const playback = useClStore((s) => s.lastPlayback);
  const state = useClStore((s) => s.state);
  const [minute, setMinute] = useState(0);
  const goalCount = useRef(0);

  useEffect(() => {
    if (!playback) {
      navigation.goBack();
      return;
    }
    const id = setInterval(() => {
      setMinute((m) => (m >= FULL_TIME ? FULL_TIME : m + STEP_MINUTES));
    }, STEP_MS);
    return () => clearInterval(id);
  }, [playback, navigation]);

  const done = minute >= FULL_TIME;

  // Toranzahl je Team bis zur aktuellen Minute (am Ende der echte Endstand,
  // damit ein K.o.-Entscheidungstor ohne eigenes Event trotzdem stimmt)
  const goalsUpTo = (m: ClMatch, side: 'home' | 'away'): number => {
    if (done) return side === 'home' ? m.homeGoals : m.awayGoals;
    return (m.events ?? []).filter(
      (e) => e.type === 'tor' && e.team === side && e.minute <= minute,
    ).length;
  };

  // Sound, wenn während des Laufs ein neues Tor auftaucht
  useEffect(() => {
    if (!playback || done) return;
    const total = playback.matches.reduce(
      (sum, m) =>
        sum +
        (m.events ?? []).filter((e) => e.type === 'tor' && e.minute <= minute).length,
      0,
    );
    if (total > goalCount.current) playSound('goal');
    goalCount.current = total;
  }, [minute, playback, done]);

  if (!playback || !state) return null;

  const teamName = (id: string) => state.teams[id]?.name ?? '?';
  const teamCrest = (id: string) => state.teams[id]?.crest ?? 'crest-0';

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Text style={styles.stage}>{t(STAGE_LABEL[playback.stage])}</Text>
        <View style={styles.clock}>
          <Text style={styles.clockText}>{done ? 'FT' : `${minute}'`}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {playback.matches.map((m, i) => {
          const hg = goalsUpTo(m, 'home');
          const ag = goalsUpTo(m, 'away');
          const homeWin = done && m.homeGoals >= m.awayGoals;
          const awayWin = done && m.awayGoals > m.homeGoals;
          return (
            <View key={i} style={styles.matchRow}>
              <View style={styles.side}>
                <Crest crestId={teamCrest(m.homeId)} size={20} />
                <Text style={[styles.name, homeWin && styles.winner]} numberOfLines={1}>
                  {teamName(m.homeId)}
                </Text>
              </View>
              <Text style={styles.score}>{hg}:{ag}</Text>
              <View style={styles.side}>
                <Text style={[styles.name, styles.nameRight, awayWin && styles.winner]} numberOfLines={1}>
                  {teamName(m.awayId)}
                </Text>
                <Crest crestId={teamCrest(m.awayId)} size={20} />
              </View>
            </View>
          );
        })}
      </ScrollView>

      <View style={styles.footer}>
        {done ? (
          <GKButton title={t('playbackToBracket')} onPress={() => navigation.goBack()} />
        ) : (
          <GKButton title={t('skip')} variant="ghost" onPress={() => setMinute(FULL_TIME)} />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  stage: {
    fontSize: font.h2,
    fontWeight: '900',
    color: colors.ink,
  },
  clock: {
    backgroundColor: colors.accent,
    borderRadius: radius.round,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    minWidth: 54,
    alignItems: 'center',
  },
  clockText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: font.body,
  },
  list: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.lg,
  },
  matchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
  },
  side: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  name: {
    flexShrink: 1,
    fontSize: font.small,
    fontWeight: '700',
    color: colors.ink,
  },
  nameRight: {
    textAlign: 'right',
    flex: 1,
  },
  winner: {
    fontWeight: '900',
    color: colors.pitchDark,
  },
  score: {
    width: 54,
    textAlign: 'center',
    fontSize: font.h2,
    fontWeight: '900',
    color: colors.ink,
  },
  footer: {
    padding: spacing.md,
  },
});
