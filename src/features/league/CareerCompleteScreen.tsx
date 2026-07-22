import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { resetCareer } from '../../core/db/database';
import { t } from '../../core/i18n';
import { useClStore } from '../../state/clStore';
import { useEggStore } from '../../state/eggStore';
import { useGameStore } from '../../state/gameStore';
import { useLeagueStore } from '../../state/leagueStore';
import { useSessionStore } from '../../state/sessionStore';
import { GKButton } from '../../ui/components';
import { IconTrophy } from '../../ui/icons';
import { PitchBackground } from '../../ui/PitchBackground';
import { colors, font, spacing } from '../../ui/theme';
import type { RootScreenProps } from '../../navigation/types';

/**
 * Karriere-Ende (V7): Wer Liga UND Champions League in derselben Saison
 * gewinnt, hat das Spiel durchgespielt. Diese Box baut sich langsam auf
 * (Suspense) und bietet danach den Neustart einer kompletten Karriere –
 * der Trophäenschrank bleibt dabei erhalten.
 */
export function CareerCompleteScreen({ navigation }: RootScreenProps<'CareerComplete'>) {
  const trophyScale = useRef(new Animated.Value(0)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const bodyOpacity = useRef(new Animated.Value(0)).current;
  const buttonOpacity = useRef(new Animated.Value(0)).current;
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    Animated.sequence([
      Animated.spring(trophyScale, { toValue: 1, delay: 400, useNativeDriver: true, friction: 5 }),
      Animated.timing(titleOpacity, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(bodyOpacity, { toValue: 1, duration: 700, delay: 300, useNativeDriver: true }),
      Animated.timing(buttonOpacity, { toValue: 1, duration: 600, delay: 600, useNativeDriver: true }),
    ]).start();
  }, [trophyScale, titleOpacity, bodyOpacity, buttonOpacity]);

  const onNewCareer = async () => {
    setResetting(true);
    await resetCareer();
    // In-Memory-Stände zurücksetzen, dann Grundzustand neu laden
    useLeagueStore.setState({
      season: 1, round: 1, div1Slot: 0, careerComplete: false,
      matches: [], npcs: [], standings: [], seasonReview: null, seasonMessage: null,
      lastPlayedMatch: null, pendingCelebration: null, championCelebration: null,
      suspensions: [],
    });
    useClStore.setState({ state: null });
    useEggStore.setState({ eggs: [] });
    useSessionStore.setState({ activeSession: null, objectives: [] });
    useGameStore.setState({
      onboarded: false, club: null, players: [], lineup: [],
      packs: [], captainPlayerId: null, levelPoints: 0,
    });
    await useGameStore.getState().init();
    navigation.reset({ index: 0, routes: [{ name: 'Onboarding' }] });
  };

  return (
    <View style={styles.root}>
      <View style={StyleSheet.absoluteFill}>
        <PitchBackground width={400} height={900} variant="deep" />
      </View>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <Animated.View style={{ transform: [{ scale: trophyScale }] }}>
          <IconTrophy size={140} color={colors.gold} />
        </Animated.View>
        <Animated.Text style={[styles.title, { opacity: titleOpacity }]}>
          {t('ccTitle')}
        </Animated.Text>
        <Animated.Text style={[styles.body, { opacity: bodyOpacity }]}>
          {t('ccBody')}
        </Animated.Text>
        <Animated.Text style={[styles.hint, { opacity: bodyOpacity }]}>
          {t('ccHint')}
        </Animated.Text>
        <Animated.View style={[styles.buttonWrap, { opacity: buttonOpacity }]}>
          <GKButton title={t('ccNewCareer')} onPress={onNewCareer} loading={resetting} />
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#1B5E20' },
  safe: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  title: {
    color: colors.gold,
    fontSize: font.title,
    fontWeight: '900',
    textAlign: 'center',
    marginTop: spacing.lg,
  },
  body: {
    color: '#fff',
    fontSize: font.body,
    textAlign: 'center',
    marginTop: spacing.md,
    lineHeight: 22,
  },
  hint: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: font.small,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: spacing.md,
  },
  buttonWrap: {
    alignSelf: 'stretch',
    marginTop: spacing.xl,
  },
});
