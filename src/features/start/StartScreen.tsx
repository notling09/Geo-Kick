import React from 'react';
import { Image, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { GKButton } from '../../ui/components';
import { PitchBackground } from '../../ui/PitchBackground';
import { colors, font, spacing } from '../../ui/theme';
import { t } from '../../core/i18n';
import { useGameStore } from '../../state/gameStore';
import type { RootScreenProps } from '../../navigation/types';

/**
 * Start screen (chapter 2.3, step 2): the game logo centered over a drawn
 * football pitch background plus a "Click to Start" button - a purely
 * static entry page. After the tap: onboarding on first launch, otherwise
 * straight into the game.
 */
export function StartScreen({ navigation }: RootScreenProps<'Start'>) {
  const onboarded = useGameStore((s) => s.onboarded);
  const { width, height } = useWindowDimensions();

  return (
    <View style={styles.container}>
      <View style={StyleSheet.absoluteFill}>
        <PitchBackground width={width} height={height} variant="deep" />
      </View>
      <View style={styles.overlay}>
        <View style={styles.logoWrap}>
          <Image
            source={require('../../../assets/images/logo-wordmark.png')}
            style={{ width: width * 0.88, height: width * 0.88 * (368 / 1243) }}
            resizeMode="contain"
          />
          <Text style={styles.subtitle}>{t('stSlogan')}</Text>
        </View>
        <GKButton
          title={t('stTap')}
          variant="secondary"
          style={styles.button}
          onPress={() => navigation.replace(onboarded ? 'Main' : 'Onboarding')}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1B5E20',
  },
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-evenly',
    padding: spacing.xl,
  },
  logoWrap: {
    alignItems: 'center',
  },
  subtitle: {
    color: colors.grass,
    fontSize: font.h2,
    marginTop: spacing.sm,
    fontWeight: '600',
  },
  button: {
    alignSelf: 'stretch',
  },
});
