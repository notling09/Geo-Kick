import React, { useMemo, useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BALANCING, RARITY_COLOR, RARITY_LABEL, POSITION_LABEL } from '../../core/domain/constants';
import type { PoolPlayer } from '../../core/domain/types';
import { useGameStore } from '../../state/gameStore';
import { GKButton, Card, CoinBadge, SectionTitle } from '../../ui/components';
import { avatarFor } from '../../ui/PlayerCard';
import { colors, font, radius, spacing } from '../../ui/theme';

/**
 * Pack-Öffnung (Kapitel 3.2): Packs aus Sessions öffnen, Ergebnis mit
 * Seltenheits-Farben präsentieren. Coins können im Shop gegen weitere
 * Packs getauscht werden (Game Loop Schritt 5) – kein Echtgeld.
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
        'Nicht genug Coins',
        `Ein Pack kostet ${BALANCING.packShopPrice} Coins. Sammle Coins durch echte Sessions am Platz!`,
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
          <Text style={styles.packEmoji}>🎁</Text>
          <Text style={styles.packCount}>
            {unopened.length} ungeöffnete{unopened.length === 1 ? 's' : ''} Pack
            {unopened.length === 1 ? '' : 's'}
          </Text>
          <Text style={styles.packHint}>
            Jedes Pack enthält {BALANCING.playersPerPack} Spieler.
            Seltenheiten: Bronze 60 % · Silber 28 % · Gold 10 % · Legendär 2 %
          </Text>
          <GKButton
            title="Pack öffnen! 🎉"
            onPress={onOpen}
            disabled={unopened.length === 0}
            loading={opening}
          />
        </Card>

        <SectionTitle>Shop</SectionTitle>
        <Card>
          <Text style={styles.shopText}>
            Standard-Pack – {BALANCING.packShopPrice} 🪙
          </Text>
          <Text style={styles.packHint}>
            Coins verdienst du ausschließlich durch echte Sessions an Plätzen. Kein Echtgeld.
          </Text>
          <GKButton title="Pack kaufen" variant="secondary" onPress={onBuy} />
        </Card>

        <Text style={styles.statsText}>
          Bisher geöffnet: {openedCount} Packs · Kadergröße: {players.length} Spieler
        </Text>
      </ScrollView>

      <Modal visible={revealed !== null} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <Text style={styles.revealTitle}>Deine neuen Spieler! ✨</Text>
            {(revealed ?? []).map((p, i) => (
              <View
                key={`${p.id}-${i}`}
                style={[styles.revealCard, { borderColor: RARITY_COLOR[p.rarity] }]}
              >
                <View style={[styles.revealAvatar, { backgroundColor: RARITY_COLOR[p.rarity] }]}>
                  <Text style={{ fontSize: 26 }}>{avatarFor(p)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.revealName}>{p.name}</Text>
                  <Text style={styles.revealMeta}>
                    {POSITION_LABEL[p.position]} · {RARITY_LABEL[p.rarity]}
                    {ownedCountFor(p.id) > 1 ? ' · Duplikat (Training möglich!)' : ''}
                  </Text>
                </View>
                <Text style={[styles.revealRarity, { color: RARITY_COLOR[p.rarity] }]}>
                  {p.rarity === 'legendaer' ? '🌟' : '⚽'}
                </Text>
              </View>
            ))}
            <GKButton title="Super!" onPress={() => setRevealed(null)} />
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
  packEmoji: {
    fontSize: 64,
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
  revealAvatar: {
    width: 46,
    height: 46,
    borderRadius: radius.round,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  revealName: {
    fontWeight: '800',
    color: colors.ink,
  },
  revealMeta: {
    fontSize: font.small,
    color: colors.inkSoft,
  },
  revealRarity: {
    fontSize: font.h1,
  },
});
