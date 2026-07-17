import React, { useMemo } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  BALANCING, PACK_TYPES, RARITY_LABEL, SHOP_PACK_IDS,
} from '../../core/domain/constants';
import { t, tf } from '../../core/i18n';
import { packTypeFromSource } from '../../core/engine/packGen';
import { MAX_EGGS, useEggStore } from '../../state/eggStore';
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
  const eggs = useEggStore((s) => s.eggs);
  const eggTypeAt = useEggStore((s) => s.eggTypeAt);

  const unopened = useMemo(() => packs.filter((p) => p.openedAt === null), [packs]);
  const openedCount = packs.length - unopened.length;

  const onBuy = async (typeId: (typeof SHOP_PACK_IDS)[number]) => {
    const ok = await buyPack(typeId);
    if (!ok) {
      Alert.alert(
        t('pkNoCoinsTitle'),
        tf('pkNoCoins', { pack: PACK_TYPES[typeId].label, price: PACK_TYPES[typeId].price ?? 0 }),
      );
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>{t('pkTitle')}</Text>
          <View style={styles.badgeRow}>
            <CoinBadge coins={club?.coins ?? 0} />
            <PointsBadge points={levelPoints} />
          </View>
        </View>

        <SectionTitle>{tf('pkYours', { n: unopened.length })}</SectionTitle>
        {unopened.length === 0 ? (
          <Card>
            <Text style={styles.packHint}>
              {t('pkNone')}
            </Text>
          </Card>
        ) : (
          unopened.map((pack) => (
            <Card key={pack.id} style={styles.packRow}>
              <IconPack size={34} color={colors.accentDark} />
              <View style={styles.packInfo}>
                <Text style={styles.packLabel}>{packTypeFromSource(pack.source).label}</Text>
                <Text style={styles.packMeta}>
                  {tf('pkPlayers', { n: BALANCING.playersPerPack })} · {oddsLine(packTypeFromSource(pack.source).id)}
                  {'\n'}{tf('pkBonus', { min: packTypeFromSource(pack.source).bonus[0], max: packTypeFromSource(pack.source).bonus[1] })}
                </Text>
              </View>
              <GKButton
                title={t('open')}
                onPress={() => navigation.navigate('PackOpening', { packId: pack.id })}
                style={styles.openBtn}
              />
            </Card>
          ))
        )}

        <SectionTitle>{tf('pkEggs', { n: eggs.length, max: MAX_EGGS })}</SectionTitle>
        {eggs.length === 0 ? (
          <Card>
            <Text style={styles.packHint}>
              {t('pkNoEggs')}
            </Text>
          </Card>
        ) : (
          eggs.map((egg, index) => {
            const type = eggTypeAt(index);
            if (!type) return null;
            const ready = egg.progressMeters >= egg.targetMeters;
            const pct = Math.min(100, (egg.progressMeters / egg.targetMeters) * 100);
            return (
              <Card key={`${type.id}-${index}`} style={styles.eggCard}>
                <Text style={styles.packLabel}>{type.label}</Text>
                <Text style={styles.packMeta}>
                  {ready
                    ? t('pkEggReady')
                    : tf('pkEggWalk', { done: (egg.progressMeters / 1000).toFixed(2), total: type.km })}
                </Text>
                <View style={styles.eggBarWrap}>
                  <View style={[styles.eggBar, { width: `${pct}%` }]} />
                </View>
                {ready && (
                  <GKButton
                    title={t('pkHatch')}
                    onPress={() => navigation.navigate('PackOpening', { egg: true, eggIndex: index })}
                  />
                )}
              </Card>
            );
          })
        )}
        {eggs.length >= MAX_EGGS && (
          <Text style={styles.packHint}>
            {t('pkEggsFull')}
          </Text>
        )}

        <SectionTitle>{t('pkShop')}</SectionTitle>
        {SHOP_PACK_IDS.map((typeId) => (
          <Card key={typeId} style={styles.packRow}>
            <IconPack size={34} color={typeId === 'ultimate' ? colors.gold : typeId === 'rare' ? colors.sky : colors.inkSoft} />
            <View style={styles.packInfo}>
              <Text style={styles.packLabel}>{PACK_TYPES[typeId].label}</Text>
              <Text style={styles.packMeta}>
                {oddsLine(typeId)}
                {'\n'}{tf('pkBonus', { min: PACK_TYPES[typeId].bonus[0], max: PACK_TYPES[typeId].bonus[1] })}
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
          {tf('pkStats', { opened: openedCount, size: players.length, max: BALANCING.maxSquadSize })}
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
  eggCard: {
    marginBottom: spacing.sm,
  },
  eggBarWrap: {
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.grass,
    overflow: 'hidden',
    marginVertical: spacing.sm,
  },
  eggBar: {
    height: '100%',
    borderRadius: 5,
    backgroundColor: colors.pitch,
  },
  statsText: {
    marginTop: spacing.md,
    color: colors.inkSoft,
    fontSize: font.small,
    textAlign: 'center',
    lineHeight: 18,
  },
});
