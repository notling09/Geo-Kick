import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { MatchEvent } from '../../core/domain/types';
import { useLeagueStore } from '../../state/leagueStore';
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
 * along and events/goals pop in at their minute - like a live ticker. The
 * result is already computed and stored; this screen only plays it back.
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
  const [minute, setMinute] = useState(0);

  // Wartende Meister-Feier erst freigeben, wenn die Live-Ansicht zugeht
  // (Continue-Button oder Hardware-Back) – nie schon vor dem Abpfiff
  useEffect(() => () => useLeagueStore.getState().revealCelebration(), []);
  const [skipped, setSkipped] = useState(false);
  const listRef = useRef<FlatList<MatchEvent>>(null);

  const events = played?.match.events ?? [];

  useEffect(() => {
    if (skipped) {
      setMinute(90);
      return;
    }
    const t = setInterval(() => {
      setMinute((m) => {
        if (m >= 90) {
          clearInterval(t);
          return 90;
        }
        return m + 1;
      });
    }, MS_PER_MINUTE);
    return () => clearInterval(t);
  }, [skipped]);

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

  const fulltimeSoundPlayed = useRef(false);
  useEffect(() => {
    if (minute >= 90 && !fulltimeSoundPlayed.current) {
      fulltimeSoundPlayed.current = true;
      playSound('fulltime');
    }
  }, [minute]);

  if (!played) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={styles.noMatch}>No match available.</Text>
        <GKButton title="Back" variant="ghost" onPress={() => navigation.goBack()} />
      </SafeAreaView>
    );
  }

  const { match, homeName, awayName, homeCrest, awayCrest, userIsHome, stats, coinReward } = played;
  const homeGoals = visibleEvents.filter((e) => e.type === 'tor' && e.team === 'home').length;
  const awayGoals = visibleEvents.filter((e) => e.type === 'tor' && e.team === 'away').length;
  const finished = minute >= 90;
  const userSide: 'home' | 'away' = userIsHome ? 'home' : 'away';

  // Ticker-Farben: eigenes Tor grün, Gegentor rot; Karten gelb/rot
  const eventColor = (e: MatchEvent): string => {
    if (e.type === 'tor') return e.team === userSide ? colors.pitch : colors.danger;
    if (e.type === 'gelb') return colors.gold;
    if (e.type === 'rot') return colors.danger;
    return colors.inkSoft;
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
            <Text style={styles.minuteText}>{finished ? 'FT' : `${minute}'`}</Text>
          </View>
        </View>
        <View style={styles.scoreSide}>
          <Crest crestId={awayCrest} size={52} />
          <Text style={styles.clubName} numberOfLines={2}>{awayName}</Text>
        </View>
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

      <View style={styles.footer}>
        {finished ? (
          <GKButton
            title={`Continue (final score ${match.homeGoals}:${match.awayGoals})`}
            onPress={() => navigation.goBack()}
          />
        ) : (
          <GKButton title="Skip" variant="ghost" onPress={() => setSkipped(true)} />
        )}
      </View>
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
  noMatch: {
    color: '#fff',
    padding: spacing.lg,
    textAlign: 'center',
  },
});
