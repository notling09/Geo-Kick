import React, { useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CREST_IDS, RARITY_COLOR } from '../../core/domain/constants';
import type { PoolPlayer } from '../../core/domain/types';
import { STARTER_WINGERS } from '../../core/engine/names';
import * as playerRepo from '../../core/db/repositories/playerRepo';
import { useGameStore } from '../../state/gameStore';
import { useLeagueStore } from '../../state/leagueStore';
import { GKButton, Card, SectionTitle } from '../../ui/components';
import { Crest } from '../../ui/Crest';
import { PlayerAvatar } from '../../ui/PlayerAvatar';
import { colors, font, radius, spacing } from '../../ui/theme';
import type { RootScreenProps } from '../../navigation/types';

/**
 * Onboarding (chapter 2.2): pick a club name and crest, then choose one of
 * three left wingers as the first strong player. The rest of the squad is
 * filled with very weak filler players; the club starts in Division 4.
 */
export function OnboardingScreen({ navigation }: RootScreenProps<'Onboarding'>) {
  const completeOnboarding = useGameStore((s) => s.completeOnboarding);
  const hydrateLeague = useLeagueStore((s) => s.hydrate);

  const [clubName, setClubName] = useState('');
  const [crest, setCrest] = useState(CREST_IDS[0]);
  const [starters, setStarters] = useState<PoolPlayer[]>([]);
  const [chosen, setChosen] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    playerRepo.getStarterChoices().then(setStarters);
  }, []);

  const flavorFor = (name: string) =>
    STARTER_WINGERS.find((s) => s.name === name)?.flavor ?? '';

  const submit = async () => {
    if (!clubName.trim()) {
      Alert.alert('Club name missing', 'Give your club a name first.');
      return;
    }
    if (chosen === null) {
      Alert.alert('No captain picked', 'Choose one of the three wingers.');
      return;
    }
    setSaving(true);
    await completeOnboarding(clubName.trim(), crest, chosen);
    await hydrateLeague();
    navigation.replace('Main');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Your Club</Text>
        <Text style={styles.subtitle}>Found your club and start in Division 4!</Text>

        <SectionTitle>Club name</SectionTitle>
        <TextInput
          style={styles.input}
          placeholder="e.g. Backyard Legends"
          placeholderTextColor={colors.inkSoft}
          value={clubName}
          onChangeText={setClubName}
          maxLength={24}
        />

        <SectionTitle>Pick a crest</SectionTitle>
        <View style={styles.crestRow}>
          {CREST_IDS.map((c) => (
            <Pressable
              key={c}
              onPress={() => setCrest(c)}
              style={[styles.crest, crest === c && styles.crestActive]}
            >
              <Crest crestId={c} size={44} />
            </Pressable>
          ))}
        </View>

        <SectionTitle>Choose your captain (left winger)</SectionTitle>
        {starters.map((p) => (
          <Pressable key={p.id} onPress={() => setChosen(p.id)}>
            <Card
              style={[
                styles.starterCard,
                { borderColor: RARITY_COLOR[p.rarity] },
                chosen === p.id && styles.starterActive,
              ]}
            >
              <View style={styles.starterRow}>
                <PlayerAvatar player={p} size={56} />
                <View style={styles.starterInfo}>
                  <Text style={styles.starterName}>{p.name}</Text>
                  <Text style={styles.starterFlavor}>{flavorFor(p.name)}</Text>
                  <Text style={styles.starterStats}>
                    Pace {p.tempo} · Technique {p.technik} · Finishing {p.abschluss}
                  </Text>
                </View>
                {chosen === p.id && (
                  <View style={styles.chosenBadge}>
                    <Text style={styles.chosenText}>C</Text>
                  </View>
                )}
              </View>
            </Card>
          </Pressable>
        ))}

        <GKButton
          title="Let's go!"
          onPress={submit}
          loading={saving}
          style={{ marginTop: spacing.lg }}
        />
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
  title: {
    fontSize: font.title,
    fontWeight: '900',
    color: colors.pitchDark,
  },
  subtitle: {
    fontSize: font.body,
    color: colors.inkSoft,
    marginBottom: spacing.lg,
  },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: font.body,
    color: colors.ink,
    marginBottom: spacing.lg,
  },
  crestRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  crest: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  crestActive: {
    borderColor: colors.accent,
    backgroundColor: '#FFF3E0',
  },
  starterCard: {
    borderWidth: 2,
    marginBottom: spacing.sm,
  },
  starterActive: {
    backgroundColor: colors.grass,
  },
  starterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  starterInfo: {
    flex: 1,
  },
  starterName: {
    fontSize: font.h2,
    fontWeight: '800',
    color: colors.ink,
  },
  starterFlavor: {
    fontSize: font.small,
    color: colors.inkSoft,
    marginVertical: 4,
  },
  starterStats: {
    fontSize: font.small,
    fontWeight: '700',
    color: colors.pitchDark,
  },
  chosenBadge: {
    width: 30,
    height: 30,
    borderRadius: radius.round,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chosenText: {
    color: '#fff',
    fontWeight: '900',
  },
});
