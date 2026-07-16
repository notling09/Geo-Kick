import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TACTIC_LABEL } from '../../core/domain/constants';
import type { Tactic } from '../../core/domain/types';
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
  const setTactic = useGameStore((s) => s.setTactic);
  const tactics: Tactic[] = ['offensiv', 'ausgewogen', 'defensiv'];

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

      {/* Taktikwahl vor dem Anpfiff (V6.1); wird mit dem Ready übertragen */}
      <View style={styles.tacticRow}>
        {tactics.map((t) => (
          <Pressable
            key={t}
            style={[styles.tacticBtn, club?.tactic === t && styles.tacticBtnActive]}
            disabled={myReady}
            onPress={() => void setTactic(t)}
          >
            <Text style={[styles.tacticText, club?.tactic === t && styles.tacticTextActive]}>
              {TACTIC_LABEL[t]}
            </Text>
          </Pressable>
        ))}
      </View>

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
  tacticRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  tacticBtn: {
    flex: 1,
    borderWidth: 2,
    borderColor: colors.line,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
    backgroundColor: colors.card,
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
