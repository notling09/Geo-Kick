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
import { CREST_TEMPLATES, RARITY_COLOR } from '../../core/domain/constants';
import type { PoolPlayer } from '../../core/domain/types';
import { STARTER_WINGERS } from '../../core/engine/names';
import * as playerRepo from '../../core/db/repositories/playerRepo';
import { useGameStore } from '../../state/gameStore';
import { useLeagueStore } from '../../state/leagueStore';
import { GKButton, Card, SectionTitle } from '../../ui/components';
import { colors, font, radius, spacing } from '../../ui/theme';
import type { RootScreenProps } from '../../navigation/types';

/**
 * Onboarding (Kapitel 2.2): Klubname + Wappen wählen, dann einen von drei
 * linken Flügelspielern als ersten starken Spieler aussuchen.
 * Der Rest des Kaders wird mit sehr schwachen Füllspielern belegt,
 * der Klub startet in Division 4.
 */
export function OnboardingScreen({ navigation }: RootScreenProps<'Onboarding'>) {
  const completeOnboarding = useGameStore((s) => s.completeOnboarding);
  const hydrateLeague = useLeagueStore((s) => s.hydrate);

  const [clubName, setClubName] = useState('');
  const [crest, setCrest] = useState(CREST_TEMPLATES[0]);
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
      Alert.alert('Klubname fehlt', 'Gib deinem Klub zuerst einen Namen.');
      return;
    }
    if (chosen === null) {
      Alert.alert('Starter fehlt', 'Wähle einen der drei Flügelspieler aus.');
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
        <Text style={styles.title}>Dein Klub</Text>
        <Text style={styles.subtitle}>
          Gründe deinen Klub und starte in Division 4!
        </Text>

        <SectionTitle>Klubname</SectionTitle>
        <TextInput
          style={styles.input}
          placeholder="z. B. Bolzplatz Legenden"
          placeholderTextColor={colors.inkSoft}
          value={clubName}
          onChangeText={setClubName}
          maxLength={24}
        />

        <SectionTitle>Wappen wählen</SectionTitle>
        <View style={styles.crestRow}>
          {CREST_TEMPLATES.map((c) => (
            <Pressable
              key={c}
              onPress={() => setCrest(c)}
              style={[styles.crest, crest === c && styles.crestActive]}
            >
              <Text style={styles.crestEmoji}>{c}</Text>
            </Pressable>
          ))}
        </View>

        <SectionTitle>Wähle deinen Starter (Linksaußen)</SectionTitle>
        {starters.map((p) => (
          <Pressable key={p.id} onPress={() => setChosen(p.id)}>
            <Card
              style={[
                styles.starterCard,
                { borderColor: RARITY_COLOR[p.rarity] },
                chosen === p.id && styles.starterActive,
              ]}
            >
              <Text style={styles.starterName}>
                {chosen === p.id ? '✅ ' : ''}🎯 {p.name}
              </Text>
              <Text style={styles.starterFlavor}>{flavorFor(p.name)}</Text>
              <Text style={styles.starterStats}>
                Tempo {p.tempo} · Technik {p.technik} · Abschluss {p.abschluss}
              </Text>
            </Card>
          </Pressable>
        ))}

        <GKButton
          title="Los geht's!"
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
  crestEmoji: {
    fontSize: 28,
  },
  starterCard: {
    borderWidth: 2,
    marginBottom: spacing.sm,
  },
  starterActive: {
    backgroundColor: colors.grass,
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
});
