import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { colors, font, radius, spacing } from './theme';
import { IconCoin } from './icons';

/** Kleine wiederverwendbare UI-Bausteine im Comic-Look. */

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function GKButton({ title, onPress, variant = 'primary', disabled, loading, style }: ButtonProps) {
  const bg =
    variant === 'primary' ? colors.pitch
    : variant === 'secondary' ? colors.accent
    : variant === 'danger' ? colors.danger
    : 'transparent';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, opacity: disabled ? 0.45 : pressed ? 0.8 : 1 },
        variant === 'ghost' && { borderWidth: 2, borderColor: colors.pitch },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'ghost' ? colors.pitch : '#fff'} />
      ) : (
        <Text style={[styles.buttonText, variant === 'ghost' && { color: colors.pitch }]}>{title}</Text>
      )}
    </Pressable>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

export function CoinBadge({ coins }: { coins: number }) {
  return (
    <View style={styles.coinBadge}>
      <IconCoin size={16} />
      <Text style={styles.coinText}>{coins}</Text>
    </View>
  );
}

/** Level-up-Punkte (V3): gleiche Optik wie der Coin-Badge, aber in Blau. */
export function PointsBadge({ points }: { points: number }) {
  return (
    <View style={[styles.coinBadge, styles.pointsBadge]}>
      <IconCoin size={16} color="#0D47A1" fill="#90CAF9" />
      <Text style={[styles.coinText, styles.pointsText]}>{points}</Text>
    </View>
  );
}

/** Round icon-only button (map controls etc.). */
export function IconCircleButton({
  onPress,
  children,
}: {
  onPress: () => void;
  children: React.ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.iconCircle, { opacity: pressed ? 0.7 : 1 }]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: radius.md,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: font.body,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.line,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  sectionTitle: {
    fontSize: font.h2,
    fontWeight: '800',
    color: colors.ink,
    marginBottom: spacing.sm,
  },
  coinBadge: {
    backgroundColor: colors.gold,
    borderRadius: radius.round,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  coinText: {
    fontWeight: '800',
    color: colors.ink,
  },
  pointsBadge: {
    backgroundColor: colors.sky,
  },
  pointsText: {
    color: '#fff',
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: radius.round,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
