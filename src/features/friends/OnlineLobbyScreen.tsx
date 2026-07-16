import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGameStore } from '../../state/gameStore';
import { useOnlineStore } from '../../state/onlineStore';
import { GKButton, Card } from '../../ui/components';
import { Crest } from '../../ui/Crest';
import { colors, font, spacing } from '../../ui/theme';
import type { RootScreenProps } from '../../navigation/types';

/**
 * Online-Lobby (V6): beide Spieler sehen sich, beide drücken Ready –
 * dann pfeift der Host das Live-Spiel an und beide landen im Ticker.
 */
export function OnlineLobbyScreen({ navigation }: RootScreenProps<'OnlineLobby'>) {
  const { phase, opponent, myReady, oppReady, leave } = useOnlineStore();
  const setReady = useOnlineStore((s) => s.setReady);
  const club = useGameStore((s) => s.club);

  // Beide bereit → der Host hat angepfiffen → in den Live-Ticker
  useEffect(() => {
    if (phase === 'playing') navigation.replace('MatchLive');
  }, [phase, navigation]);

  // Lobby wurde beendet (Absage/Abbruch) → zurück
  useEffect(() => {
    if (phase === 'idle' && navigation.isFocused()) navigation.goBack();
  }, [phase, navigation]);

  const onLeave = () => {
    leave();
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <Text style={styles.title}>Online friendly</Text>
      <Text style={styles.subtitle}>
        {opponent ? 'Both press Ready to kick off - live on both phones!' : 'Waiting for your friend to join …'}
      </Text>

      <Card style={styles.clubCard}>
        <Crest crestId={club?.crest ?? 'crest-0'} size={44} />
        <View style={styles.clubInfo}>
          <Text style={styles.clubName} numberOfLines={1}>{club?.name ?? 'My Club'}</Text>
          <Text style={styles.readyText}>{myReady ? 'READY' : 'not ready yet'}</Text>
        </View>
      </Card>

      <Text style={styles.vs}>VS</Text>

      <Card style={styles.clubCard}>
        {opponent ? (
          <>
            <Crest crestId={opponent.crest} size={44} />
            <View style={styles.clubInfo}>
              <Text style={styles.clubName} numberOfLines={1}>{opponent.name}</Text>
              <Text style={styles.clubMeta}>Strength {opponent.strength}</Text>
              <Text style={styles.readyText}>{oppReady ? 'READY' : 'not ready yet'}</Text>
            </View>
          </>
        ) : (
          <Text style={styles.waiting}>Waiting … your friend needs the app open.</Text>
        )}
      </Card>

      <View style={styles.buttons}>
        <GKButton
          title={myReady ? 'Waiting for opponent …' : 'Ready!'}
          disabled={myReady || !opponent}
          onPress={setReady}
        />
        <GKButton title="Leave" variant="ghost" onPress={onLeave} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.md,
  },
  title: {
    fontSize: font.title,
    fontWeight: '900',
    color: colors.pitchDark,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: font.small,
    color: colors.inkSoft,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  clubCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  clubInfo: {
    flex: 1,
  },
  clubName: {
    fontSize: font.h2,
    fontWeight: '800',
    color: colors.ink,
  },
  clubMeta: {
    fontSize: font.small,
    color: colors.inkSoft,
  },
  readyText: {
    fontSize: font.small,
    fontWeight: '900',
    color: colors.pitch,
    marginTop: 2,
  },
  vs: {
    textAlign: 'center',
    fontSize: font.h1,
    fontWeight: '900',
    color: colors.accentDark,
    marginVertical: spacing.sm,
  },
  waiting: {
    flex: 1,
    color: colors.inkSoft,
    fontSize: font.body,
  },
  buttons: {
    marginTop: spacing.xl,
    gap: spacing.sm,
  },
});
