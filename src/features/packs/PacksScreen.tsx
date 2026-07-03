import React, { useMemo, useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BALANCING, RARITY_COLOR, RARITY_LABEL, POSITION_LABEL } from '../../core/domain/constants';
import type { PoolPlayer } from '../../core/domain/types';
import { useGameStore } from '../../state/gameStore';
import { GKButton, Card, CoinBadge, SectionTitle } from '../../ui/components';
import { IconPack, IconStar } from '../../ui/icons';
import { PlayerAvatar } from '../../ui/PlayerAvatar';
import { colors, font, radius, spacing } from '../../ui/theme';

/**
 * Pack opening (chapter 3.2): open packs earned from sessions, present the
 * pulls with rarity colors. Coins can be exchanged for extra packs in the
 * shop (game loop step 5) - no real money.
 */
export function PacksScreen() {
  const { club, packs, players, openPack, buyPack } = useGameStore();
  const [opening, setOpening] = useState(false);
  const [revealed, setRevealed] = useState<PoolPlayer[] | null>(null);

  const unopened = useMemo(() => packs.filter((p) => p.openedAt === null), [packs]);
  const openedCount = packs.length - unopened.length;

  const onOpen = async () => {
    const pack = unopened[0];
    if (!pack) return;
    setOpening(true);
    try {
      const drawn = await openPack(pack.id);
      setRevealed(drawn);
    } finally {
      setOpening(false);
    }
  };

  const onBuy = async () => {
    const ok = await buyPack();
    if (!ok) {
      Alert.alert(
        'Not enough coins',
        `A pack costs ${BALANCING.packShopPrice} coins. Earn coins with real sessions at a pitch!`,
      );
    }
  };

  const ownedCountFor = (poolId: number) =>
    players.filter((p) => p.poolId === poolId).length;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Packs</Text>
          <CoinBadge coins={club?.coins ?? 0} />
        </View>

        <Card style={styles.packCard}>
          <IconPack size={64} color={colors.accentDark} />
          <Text style={styles.packCount}>
            {unopened.length} unopened pack{unopened.length === 1 ? '' : 's'}
          </Text>
          <Text style={styles.packHint}>
            Every pack contains {BALANCING.playersPerPack} players.
            Rarity odds: Bronze 60% · Silver 28% · Gold 10% · Legendary 2%
          </Text>
          <GKButton
            title="Open pack!"
            onPress={onOpen}
            disabled={unopened.length === 0}
            loading={opening}
          />
        </Card>

        <SectionTitle>Shop</SectionTitle>
        <Card>
          <Text style={styles.shopText}>Standard pack - {BALANCING.packShopPrice} coins</Text>
          <Text style={styles.packHint}>
            Coins are earned exclusively through real sessions at pitches. No real money.
          </Text>
          <GKButton title="Buy pack" variant="secondary" onPress={onBuy} />
        </Card>

        <Text style={styles.statsText}>
          Packs opened so far: {openedCount} · squad size: {players.length} players
        </Text>
      </ScrollView>

      <Modal visible={revealed !== null} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <Text style={styles.revealTitle}>Your new players!</Text>
            {(revealed ?? []).map((p, i) => (
              <View
                key={`${p.id}-${i}`}
                style={[styles.revealCard, { borderColor: RARITY_COLOR[p.rarity] }]}
              >
                <PlayerAvatar player={p} size={46} />
                <View style={{ flex: 1, marginLeft: spacing.sm }}>
                  <Text style={styles.revealName}>{p.name}</Text>
                  <Text style={styles.revealMeta}>
                    {POSITION_LABEL[p.position]} · {RARITY_LABEL[p.rarity]}
                    {ownedCountFor(p.id) > 1 ? ' · duplicate (training!)' : ''}
                  </Text>
                </View>
                {p.rarity === 'legendaer' && <IconStar size={26} />}
              </View>
            ))}
            <GKButton title="Nice!" onPress={() => setRevealed(null)} />
          </View>
        </View>
      </Modal>
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
  title: {
    fontSize: font.title,
    fontWeight: '900',
    color: colors.pitchDark,
  },
  packCard: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  packCount: {
    fontSize: font.h2,
    fontWeight: '800',
    color: colors.ink,
    marginVertical: spacing.sm,
  },
  packHint: {
    fontSize: font.small,
    color: colors.inkSoft,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  shopText: {
    fontSize: font.h2,
    fontWeight: '800',
    color: colors.ink,
    marginBottom: 4,
  },
  statsText: {
    marginTop: spacing.md,
    color: colors.inkSoft,
    fontSize: font.small,
    textAlign: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  revealTitle: {
    fontSize: font.h1,
    fontWeight: '900',
    color: colors.ink,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  revealCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 2,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  revealName: {
    fontWeight: '800',
    color: colors.ink,
  },
  revealMeta: {
    fontSize: font.small,
    color: colors.inkSoft,
  },
});
