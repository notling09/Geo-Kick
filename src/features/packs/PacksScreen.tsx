import React, { useMemo } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  BALANCING, PACK_TYPES, RARITY_LABEL, SELL_VALUE, SHOP_PACK_IDS,
} from '../../core/domain/constants';
import { packTypeFromSource } from '../../core/engine/packGen';
import { useGameStore } from '../../state/gameStore';
import { GKButton, Card, CoinBadge, PointsBadge, SectionTitle } from '../../ui/components';
import { IconPack } from '../../ui/icons';
import { colors, font, spacing } from '../../ui/theme';
import type { TabScreenProps } from '../../navigation/types';

/**
 * Packs (Kapitel 3.2): Session-Packs und Shop mit drei Pack-Stufen
 * (steigende Quoten). Das Öffnen selbst passiert seit V3 im Vollbild-Screen
 * PackOpening (Pitch-Hintergrund, Seltenheits-Animationen, Entscheidungen
 * pro Karte).
 */

function oddsLine(typeId: keyof typeof PACK_TYPES): string {
  return PACK_TYPES[typeId].odds
    .map((o) => `${RARITY_LABEL[o.rarity]} ${o.weight}%`)
    .join(' · ');
}

export function PacksScreen({ navigation }: TabScreenProps<'Packs'>) {
  const { club, packs, players, buyPack, levelPoints } = useGameStore();

  const unopened = useMemo(() => packs.filter((p) => p.openedAt === null), [packs]);
  const openedCount = packs.length - unopened.length;

  const onBuy = async (typeId: (typeof SHOP_PACK_IDS)[number]) => {
    const ok = await buyPack(typeId);
    if (!ok) {
      Alert.alert(
        'Not enough coins',
        `The ${PACK_TYPES[typeId].label} costs ${PACK_TYPES[typeId].price} coins. Earn coins with real sessions or by selling players!`,
      );
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Packs</Text>
          <View style={styles.badgeRow}>
            <PointsBadge points={levelPoints} />
            <CoinBadge coins={club?.coins ?? 0} />
          </View>
        </View>

        <SectionTitle>Your packs ({unopened.length})</SectionTitle>
        {unopened.length === 0 ? (
          <Card>
            <Text style={styles.packHint}>
              No unopened packs. Check in at a pitch for a session pack or buy one below.
            </Text>
          </Card>
        ) : (
          unopened.map((pack) => (
            <Card key={pack.id} style={styles.packRow}>
              <IconPack size={34} color={colors.accentDark} />
              <View style={styles.packInfo}>
                <Text style={styles.packLabel}>{packTypeFromSource(pack.source).label}</Text>
                <Text style={styles.packMeta}>
                  {BALANCING.playersPerPack} players · {oddsLine(packTypeFromSource(pack.source).id)}
                  {'\n'}Bonus: {packTypeFromSource(pack.source).bonus[0]}-{packTypeFromSource(pack.source).bonus[1]} coins + points
                </Text>
              </View>
              <GKButton
                title="Open"
                onPress={() => navigation.navigate('PackOpening', { packId: pack.id })}
                style={styles.openBtn}
              />
            </Card>
          ))
        )}

        <SectionTitle>Shop</SectionTitle>
        {SHOP_PACK_IDS.map((typeId) => (
          <Card key={typeId} style={styles.packRow}>
            <IconPack size={34} color={typeId === 'ultimate' ? colors.gold : typeId === 'rare' ? colors.sky : colors.inkSoft} />
            <View style={styles.packInfo}>
              <Text style={styles.packLabel}>{PACK_TYPES[typeId].label}</Text>
              <Text style={styles.packMeta}>
                {oddsLine(typeId)}
                {'\n'}Bonus: {PACK_TYPES[typeId].bonus[0]}-{PACK_TYPES[typeId].bonus[1]} coins + points
              </Text>
            </View>
            <GKButton
              title={`${PACK_TYPES[typeId].price}`}
              variant="secondary"
              onPress={() => onBuy(typeId)}
              style={styles.openBtn}
            />
          </Card>
        ))}
        <Text style={styles.statsText}>
          Duplicates: take level-up points or sell for coins (Bronze {SELL_VALUE.bronze} ·
          Silver {SELL_VALUE.silber} · Gold {SELL_VALUE.gold} · Legendary {SELL_VALUE.legendaer}).{'\n'}
          Every pack also drops a bonus: the same amount of coins AND level-up points.{'\n'}
          Spend points on any player in his detail view - costs rise with his rating.{'\n'}
          The ??? card exists only once - a 99-rated player you get to name yourself.{'\n'}
          Packs opened so far: {openedCount} · squad size: {players.length}/{BALANCING.maxSquadSize}
        </Text>
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  title: {
    fontSize: font.title,
    fontWeight: '900',
    color: colors.pitchDark,
  },
  packRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
    padding: spacing.sm,
  },
  packInfo: {
    flex: 1,
  },
  packLabel: {
    fontSize: font.body,
    fontWeight: '800',
    color: colors.ink,
  },
  packMeta: {
    fontSize: 11,
    color: colors.inkSoft,
    marginTop: 2,
  },
  openBtn: {
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
  },
  packHint: {
    fontSize: font.small,
    color: colors.inkSoft,
  },
  statsText: {
    marginTop: spacing.md,
    color: colors.inkSoft,
    fontSize: font.small,
    textAlign: 'center',
    lineHeight: 18,
  },
});
