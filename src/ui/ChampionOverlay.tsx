import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Ellipse, Path, Rect } from 'react-native-svg';
import type { PoolPlayer } from '../core/domain/types';
import { t, tf } from '../core/i18n';
import { playSound } from '../core/services/sound';
import { PlayerAvatar } from './PlayerAvatar';
import { colors, font, spacing } from './theme';

/**
 * Meister-Feier (V2): Nach Platz 1 am Saisonende hält der Captain den Pokal,
 * Konfetti regnet ~5 Sekunden. Tippen (oder warten) schließt die Feier.
 */

const CONFETTI_COLORS = ['#E8B923', '#FF8F00', '#66BB6A', '#42A5F5', '#EC407A', '#FFFFFF'];
const CONFETTI_COUNT = 36;

function Trophy({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      {/* Henkel */}
      <Path d="M 14 12 C 4 12 4 26 16 28" stroke="#E8B923" strokeWidth={4} fill="none" />
      <Path d="M 50 12 C 60 12 60 26 48 28" stroke="#E8B923" strokeWidth={4} fill="none" />
      {/* Kelch */}
      <Path d="M 16 8 H 48 V 22 C 48 32 42 38 32 38 C 22 38 16 32 16 22 Z" fill="#F2C94C" stroke="#B8860B" strokeWidth={2} />
      {/* Stiel + Sockel */}
      <Rect x={28} y={38} width={8} height={8} fill="#E8B923" />
      <Rect x={20} y={46} width={24} height={6} rx={2} fill="#B8860B" />
      <Rect x={16} y={52} width={32} height={8} rx={2} fill="#8B6508" />
      {/* Glanz */}
      <Ellipse cx={25} cy={16} rx={3} ry={6} fill="rgba(255,255,255,0.45)" />
    </Svg>
  );
}

function ConfettiPiece({ index, height }: { index: number; height: number }) {
  const fall = useRef(new Animated.Value(0)).current;
  const spec = useMemo(
    () => ({
      left: Math.random() * 100,
      delay: Math.random() * 1500,
      duration: 2600 + Math.random() * 2000,
      size: 8 + Math.random() * 8,
      color: CONFETTI_COLORS[index % CONFETTI_COLORS.length],
      rotations: 2 + Math.random() * 4,
      drift: (Math.random() - 0.5) * 120,
    }),
    [index],
  );

  useEffect(() => {
    Animated.loop(
      Animated.timing(fall, {
        toValue: 1,
        duration: spec.duration,
        delay: spec.delay,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    ).start();
  }, [fall, spec]);

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: -20,
        left: `${spec.left}%`,
        width: spec.size,
        height: spec.size * 0.5,
        borderRadius: 2,
        backgroundColor: spec.color,
        transform: [
          { translateY: fall.interpolate({ inputRange: [0, 1], outputRange: [0, height + 40] }) },
          { translateX: fall.interpolate({ inputRange: [0, 1], outputRange: [0, spec.drift] }) },
          { rotate: fall.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${spec.rotations * 360}deg`] }) },
        ],
      }}
    />
  );
}

interface Props {
  visible: boolean;
  clubName: string;
  division: number;
  captain: PoolPlayer | null;
  onDismiss: () => void;
}

export function ChampionOverlay({ visible, clubName, division, captain, onDismiss }: Props) {
  const { height } = useWindowDimensions();

  // Nach 7 Sekunden automatisch schließen (Länge des Champion-Sounds, V3)
  useEffect(() => {
    if (!visible) return;
    playSound('champion');
    const t = setTimeout(onDismiss, 7000);
    return () => clearTimeout(t);
  }, [visible, onDismiss]);

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="fade">
      <Pressable style={styles.backdrop} onPress={onDismiss}>
        {Array.from({ length: CONFETTI_COUNT }, (_, i) => (
          <ConfettiPiece key={i} index={i} height={height} />
        ))}
        <View style={styles.content}>
          <Text style={styles.title}>{t('champTitle')}</Text>
          <Text style={styles.subtitle}>
            {tf('champBody', { club: clubName, div: division })}
          </Text>
          {/* Captain steht hinter dem Pokal */}
          <View style={styles.stage}>
            {captain && (
              <View style={styles.captainWrap}>
                <PlayerAvatar player={captain} size={130} />
              </View>
            )}
            <View style={styles.trophyWrap}>
              <Trophy size={110} />
            </View>
          </View>
          {captain && <Text style={styles.captainName}>{t('sqCaptainBtn')} {captain.name}</Text>}
          <Text style={styles.hint}>{t('champHint')}</Text>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(16, 46, 18, 0.96)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    alignItems: 'center',
    padding: spacing.xl,
  },
  title: {
    color: colors.gold,
    fontSize: 42,
    fontWeight: '900',
    letterSpacing: 4,
  },
  subtitle: {
    color: '#fff',
    fontSize: font.h2,
    fontWeight: '700',
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  stage: {
    marginTop: spacing.xl,
    alignItems: 'center',
    height: 190,
  },
  captainWrap: {
    position: 'absolute',
    top: 0,
  },
  trophyWrap: {
    position: 'absolute',
    bottom: 0,
  },
  captainName: {
    color: colors.gold,
    fontSize: font.h2,
    fontWeight: '800',
    marginTop: spacing.md,
  },
  hint: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: font.small,
    marginTop: spacing.lg,
  },
});
