import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { MatchEvent } from '../../core/domain/types';
import { useLeagueStore } from '../../state/leagueStore';
import { GKButton, Card } from '../../ui/components';
import { colors, font, radius, spacing } from '../../ui/theme';
import type { RootScreenProps } from '../../navigation/types';

/**
 * Live-Ansicht der Match-Simulation (Kapitel 3.4): Der Timer läuft sichtbar
 * mit, Ereignisse und Tore werden zum jeweiligen Zeitpunkt eingeblendet –
 * wie ein Live-Ticker. Das Ergebnis ist bereits berechnet und gespeichert;
 * hier wird es nur abgespielt (Abbrechen ändert nichts am Resultat).
 */

const MS_PER_MINUTE = 350; // 90 Minuten in ~32 Sekunden

const EVENT_ICON: Record<MatchEvent['type'], string> = {
  tor: '⚽',
  chance: '💥',
  ecke: '🚩',
  foul: '🟨',
  anpfiff: '🟢',
  halbzeit: '⏸️',
  abpfiff: '🏁',
};

export function MatchLiveScreen({ navigation }: RootScreenProps<'MatchLive'>) {
  const played = useLeagueStore((s) => s.lastPlayedMatch);
  const [minute, setMinute] = useState(0);
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

  if (!played) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={styles.noMatch}>Kein Spiel verfügbar.</Text>
        <GKButton title="Zurück" variant="ghost" onPress={() => navigation.goBack()} />
      </SafeAreaView>
    );
  }

  const { match, homeName, awayName, homeCrest, awayCrest } = played;
  const homeGoals = visibleEvents.filter((e) => e.type === 'tor' && e.team === 'home').length;
  const awayGoals = visibleEvents.filter((e) => e.type === 'tor' && e.team === 'away').length;
  const finished = minute >= 90;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.scoreboard}>
        <View style={styles.scoreSide}>
          <Text style={styles.crest}>{homeCrest}</Text>
          <Text style={styles.clubName} numberOfLines={2}>{homeName}</Text>
        </View>
        <View style={styles.scoreCenter}>
          <Text style={styles.score}>
            {homeGoals}:{awayGoals}
          </Text>
          <View style={styles.minuteBadge}>
            <Text style={styles.minuteText}>{finished ? 'Ende' : `${minute}'`}</Text>
          </View>
        </View>
        <View style={styles.scoreSide}>
          <Text style={styles.crest}>{awayCrest}</Text>
          <Text style={styles.clubName} numberOfLines={2}>{awayName}</Text>
        </View>
      </View>

      <FlatList
        ref={listRef}
        data={visibleEvents}
        keyExtractor={(_, i) => String(i)}
        contentContainerStyle={styles.ticker}
        renderItem={({ item }) => (
          <Card style={[styles.eventCard, item.type === 'tor' && styles.goalCard]}>
            <Text style={styles.eventMinute}>{item.minute}'</Text>
            <Text style={[styles.eventText, item.type === 'tor' && styles.goalText]}>
              {EVENT_ICON[item.type]} {item.text}
            </Text>
          </Card>
        )}
      />

      <View style={styles.footer}>
        {finished ? (
          <GKButton
            title={`Weiter (Endstand ${match.homeGoals}:${match.awayGoals})`}
            onPress={() => navigation.goBack()}
          />
        ) : (
          <GKButton title="Überspringen ⏩" variant="ghost" onPress={() => setSkipped(true)} />
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
  crest: {
    fontSize: 42,
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
  },
  goalCard: {
    backgroundColor: '#FFF8E1',
    borderColor: colors.gold,
    borderWidth: 2,
  },
  eventMinute: {
    width: 36,
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
  noMatch: {
    color: '#fff',
    padding: spacing.lg,
    textAlign: 'center',
  },
});
