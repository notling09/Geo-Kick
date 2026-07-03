import React, { useMemo, useState } from 'react';
import { Alert, FlatList, Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  BALANCING, PACK_TYPES, RARITY_COLOR, RARITY_LABEL, POSITION_LABEL, SELL_VALUE,
  SHOP_PACK_IDS,
} from '../../core/domain/constants';
import type { PoolPlayer } from '../../core/domain/types';
import { packTypeFromSource } from '../../core/engine/packGen';
import { effectiveOverall } from '../../core/engine/playerGen';
import { useGameStore, type PackEntry } from '../../state/gameStore';
import { GKButton, Card, CoinBadge, SectionTitle } from '../../ui/components';
import { IconPack, IconStar } from '../../ui/icons';
import { PlayerAvatar } from '../../ui/PlayerAvatar';
import { colors, font, radius, spacing } from '../../ui/theme';

/**
 * Packs (Kapitel 3.2): Session-Packs öffnen, Shop mit drei Pack-Stufen
 * (steigende Quoten), Duplikate werden automatisch zu Coins. Bei vollem
 * Kader (30) entscheidet der Nutzer pro gezogenem Spieler: verkaufen oder
 * behalten und dafür einen eigenen Spieler verkaufen.
 */

type RevealEntry = PackEntry & { note?: string };

function oddsLine(typeId: keyof typeof PACK_TYPES): string {
  return PACK_TYPES[typeId].odds
    .map((o) => `${RARITY_LABEL[o.rarity]} ${o.weight}%`)
    .join(' · ');
}

export function PacksScreen() {
  const {
    club, packs, players, lineup, openPack, buyPack, sellDrawnPlayer, trainWithDuplicate,
    keepDrawnPlayer,
  } = useGameStore();
  const insets = useSafeAreaInsets();
  const [opening, setOpening] = useState(false);
  const [revealed, setRevealed] = useState<RevealEntry[] | null>(null);
  const [pickerFor, setPickerFor] = useState<{ pool: PoolPlayer; index: number } | null>(null);

  const unopened = useMemo(() => packs.filter((p) => p.openedAt === null), [packs]);
  const openedCount = packs.length - unopened.length;
  // Offene Entscheidungen: Kader-voll-Fälle und noch nicht gewählte Duplikate
  const pendingCount =
    revealed?.filter(
      (e) => (e.outcome === 'pending' || e.outcome === 'duplicate') && !e.note,
    ).length ?? 0;

  // Verkaufbare eigene Spieler (nicht aufgestellt), günstigste zuerst
  const sellCandidates = useMemo(
    () =>
      players
        .filter((p) => !lineup.includes(p.id))
        .sort((a, b) => effectiveOverall(a.pool, a.level) - effectiveOverall(b.pool, b.level)),
    [players, lineup],
  );

  const onOpen = async (packId: number) => {
    setOpening(true);
    try {
      const entries = await openPack(packId);
      setRevealed(entries);
    } finally {
      setOpening(false);
    }
  };

  const onBuy = async (typeId: (typeof SHOP_PACK_IDS)[number]) => {
    const ok = await buyPack(typeId);
    if (!ok) {
      Alert.alert(
        'Not enough coins',
        `The ${PACK_TYPES[typeId].label} costs ${PACK_TYPES[typeId].price} coins. Earn coins with real sessions or by selling players!`,
      );
    }
  };

  const patchEntry = (index: number, patch: Partial<RevealEntry>) => {
    setRevealed((prev) => prev?.map((e, i) => (i === index ? { ...e, ...patch } : e)) ?? null);
  };

  /** Verkauf: sowohl für Duplikate als auch für Kader-voll-Fälle. */
  const resolveSell = async (entry: RevealEntry, index: number) => {
    await sellDrawnPlayer(entry.pool);
    patchEntry(index, { coins: SELL_VALUE[entry.pool.rarity], note: 'sold' });
  };

  /** Duplikat als Training einsetzen: +1 Level für den vorhandenen Spieler. */
  const resolveTrain = async (entry: RevealEntry, index: number) => {
    const newLevel = await trainWithDuplicate(entry.pool);
    if (newLevel === null) {
      Alert.alert(
        'Max level reached',
        `${entry.pool.name} is already at the maximum level - sell the duplicate instead.`,
      );
      return;
    }
    patchEntry(index, { note: `trained (level ${newLevel})` });
  };

  const resolveKeep = async (drawn: PoolPlayer, index: number, sellOwnedId: number) => {
    const victim = players.find((p) => p.id === sellOwnedId);
    const ok = await keepDrawnPlayer(drawn, sellOwnedId);
    setPickerFor(null);
    if (!ok) {
      Alert.alert('Not possible', 'This player cannot be sold (still in your XI?).');
      return;
    }
    patchEntry(index, { outcome: 'added', note: `sold ${victim?.pool.name ?? 'a player'}` });
  };

  const entryStatus = (e: RevealEntry): string => {
    if (e.outcome === 'added') return e.note ? `joined the club (${e.note})` : 'joined the club';
    if (e.outcome === 'duplicate') {
      if (e.note === 'sold') return `sold for ${e.coins} coins`;
      if (e.note) return `duplicate · ${e.note}`;
      return 'duplicate - train or sell?';
    }
    if (e.note === 'sold') return `sold for ${e.coins} coins`;
    return 'squad is full (30)';
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Packs</Text>
          <CoinBadge coins={club?.coins ?? 0} />
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
                </Text>
              </View>
              <GKButton
                title="Open"
                onPress={() => onOpen(pack.id)}
                loading={opening}
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
              <Text style={styles.packMeta}>{oddsLine(typeId)}</Text>
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
          Duplicates: train the player (+1 level) or sell for Bronze {SELL_VALUE.bronze} ·
          Silver {SELL_VALUE.silber} · Gold {SELL_VALUE.gold} · Legendary {SELL_VALUE.legendaer} coins.{'\n'}
          Packs opened so far: {openedCount} · squad size: {players.length}/{BALANCING.maxSquadSize}
        </Text>
      </ScrollView>

      <Modal visible={revealed !== null} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalSheet, { paddingBottom: insets.bottom + spacing.md }]}>
            {pickerFor ? (
              <>
                <Text style={styles.revealTitle}>Sell a player to keep {pickerFor.pool.name}</Text>
                <FlatList
                  data={sellCandidates}
                  keyExtractor={(p) => String(p.id)}
                  style={styles.pickerList}
                  renderItem={({ item }) => (
                    <View style={[styles.revealCard, { borderColor: RARITY_COLOR[item.pool.rarity] }]}>
                      <PlayerAvatar player={item.pool} size={40} />
                      <View style={styles.revealInfo}>
                        <Text style={styles.revealName}>{item.pool.name}</Text>
                        <Text style={styles.revealMeta}>
                          {POSITION_LABEL[item.pool.position]} · {RARITY_LABEL[item.pool.rarity]} ·{' '}
                          {effectiveOverall(item.pool, item.level)}
                        </Text>
                      </View>
                      <GKButton
                        title={`Sell +${SELL_VALUE[item.pool.rarity]}`}
                        variant="danger"
                        style={styles.smallBtn}
                        onPress={() => resolveKeep(pickerFor.pool, pickerFor.index, item.id)}
                      />
                    </View>
                  )}
                  ListEmptyComponent={
                    <Text style={styles.packHint}>
                      No sellable players - everyone is in your XI.
                    </Text>
                  }
                />
                <GKButton title="Back" variant="ghost" onPress={() => setPickerFor(null)} />
              </>
            ) : (
              <>
                <Text style={styles.revealTitle}>Your pull!</Text>
                {(revealed ?? []).map((e, i) => (
                  <View
                    key={`${e.pool.id}-${i}`}
                    style={[styles.revealCard, { borderColor: RARITY_COLOR[e.pool.rarity] }]}
                  >
                    <PlayerAvatar player={e.pool} size={44} />
                    <View style={styles.revealInfo}>
                      <Text style={styles.revealName}>{e.pool.name}</Text>
                      <Text style={styles.revealMeta}>
                        {POSITION_LABEL[e.pool.position]} · {RARITY_LABEL[e.pool.rarity]} ·{' '}
                        {entryStatus(e)}
                      </Text>
                      {e.outcome === 'pending' && !e.note && (
                        <View style={styles.pendingRow}>
                          <GKButton
                            title={`Sell +${SELL_VALUE[e.pool.rarity]}`}
                            variant="danger"
                            style={styles.smallBtn}
                            onPress={() => resolveSell(e, i)}
                          />
                          <GKButton
                            title="Keep"
                            style={styles.smallBtn}
                            onPress={() => setPickerFor({ pool: e.pool, index: i })}
                          />
                        </View>
                      )}
                      {e.outcome === 'duplicate' && !e.note && (
                        <View style={styles.pendingRow}>
                          <GKButton
                            title="Train +1 lvl"
                            style={styles.smallBtn}
                            onPress={() => resolveTrain(e, i)}
                          />
                          <GKButton
                            title={`Sell +${SELL_VALUE[e.pool.rarity]}`}
                            variant="danger"
                            style={styles.smallBtn}
                            onPress={() => resolveSell(e, i)}
                          />
                        </View>
                      )}
                    </View>
                    {e.pool.rarity === 'legendaer' && <IconStar size={24} />}
                  </View>
                ))}
                <GKButton
                  title={pendingCount > 0 ? `Decide for ${pendingCount} player${pendingCount > 1 ? 's' : ''} first` : 'Nice!'}
                  disabled={pendingCount > 0}
                  onPress={() => setRevealed(null)}
                />
              </>
            )}
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
    maxHeight: '85%',
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
  revealInfo: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  revealName: {
    fontWeight: '800',
    color: colors.ink,
  },
  revealMeta: {
    fontSize: font.small,
    color: colors.inkSoft,
    marginTop: 2,
  },
  pendingRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  smallBtn: {
    paddingVertical: 8,
    paddingHorizontal: spacing.sm,
  },
  pickerList: {
    maxHeight: 380,
  },
});
