import React, { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import {
  BUY_VALUE, POSITION_SHORT, RARITY_COLOR, RARITY_LABEL,
} from '../../core/domain/constants';
import type { PoolPlayer } from '../../core/domain/types';
import { effectiveOverall } from '../../core/engine/playerGen';
import { t, tf } from '../../core/i18n';
import { useGameStore, type MarketBuyResult } from '../../state/gameStore';
import { GKButton, Card, CoinBadge } from '../../ui/components';
import { PlayerAvatar } from '../../ui/PlayerAvatar';
import { colors, font, radius, spacing } from '../../ui/theme';
import type { RootScreenProps } from '../../navigation/types';

/**
 * Transfermarkt (V7.4): die KI-Börse im Packs-Bereich. Jeden Tag stehen 6
 * zufällige Spieler zum Kauf – mit den Quoten von zwei Standard-Packs, also
 * alles von Bronze bis Legendär möglich. Ein Countdown zeigt, wann die Auswahl
 * wechselt (lokale Mitternacht). Gekaufte Spieler landen direkt im Kader.
 */

/** Verbleibende Zeit bis zur nächsten lokalen Mitternacht als "22h 45m". */
function timeToMidnight(): string {
  const now = new Date();
  const next = new Date(now);
  next.setHours(24, 0, 0, 0);
  const mins = Math.max(0, Math.round((next.getTime() - now.getTime()) / 60000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m`;
}

function MarketCard({ player, bought, onBuy }: {
  player: PoolPlayer; bought: boolean; onBuy: () => void;
}) {
  const rarityColor = RARITY_COLOR[player.rarity];
  const overall = effectiveOverall(player, 1);
  return (
    <Card style={[styles.cell, { borderColor: rarityColor }]}>
      <View style={styles.overallTag}>
        <Text style={[styles.overallText, { color: rarityColor }]}>{overall}</Text>
      </View>
      <PlayerAvatar player={player} size={52} />
      <Text style={styles.name} numberOfLines={1}>{player.name}</Text>
      <Text style={styles.meta} numberOfLines={1}>
        {POSITION_SHORT[player.position]} · {RARITY_LABEL[player.rarity]}
      </Text>
      {bought ? (
        <View style={styles.boughtTag}>
          <Text style={styles.boughtText}>{t('tmBought')}</Text>
        </View>
      ) : (
        <GKButton
          title={`${BUY_VALUE[player.rarity]}`}
          onPress={onBuy}
          style={styles.buyBtn}
        />
      )}
    </Card>
  );
}

export function TransferMarketScreen({ navigation }: RootScreenProps<'TransferMarket'>) {
  const { club, market, marketBought, refreshMarket, buyMarketPlayer } = useGameStore();
  const [countdown, setCountdown] = useState(timeToMidnight());

  // Beim Öffnen (und Tageswechsel) den Markt neu laden
  useFocusEffect(
    useCallback(() => {
      void refreshMarket();
    }, [refreshMarket]),
  );

  // Countdown jede Minute aktualisieren; bei Tageswechsel Markt neu laden
  useEffect(() => {
    const id = setInterval(() => {
      setCountdown(timeToMidnight());
      void refreshMarket();
    }, 30000);
    return () => clearInterval(id);
  }, [refreshMarket]);

  const onBuy = async (index: number, player: PoolPlayer) => {
    const result: MarketBuyResult = await buyMarketPlayer(index);
    if (result === 'ok') {
      Alert.alert(t('tmBoughtTitle'), tf('tmBoughtMsg', { name: player.name }));
    } else if (result === 'no_coins') {
      Alert.alert(t('tmNoCoinsTitle'), tf('tmNoCoinsMsg', { price: BUY_VALUE[player.rarity] }));
    } else if (result === 'full') {
      Alert.alert(t('tmFullTitle'), t('tmFullMsg'));
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>{t('tmTitle')}</Text>
          <CoinBadge coins={club?.coins ?? 0} />
        </View>
        <Text style={styles.subtitle}>{t('tmSubtitle')}</Text>

        <Card style={styles.timerCard}>
          <Text style={styles.timerLabel}>{t('tmRefreshIn')}</Text>
          <Text style={styles.timerValue}>{countdown}</Text>
        </Card>

        <View style={styles.grid}>
          {market.map((player, index) => (
            <MarketCard
              key={`${index}-${player.id}`}
              player={player}
              bought={marketBought.includes(index)}
              onBuy={() => onBuy(index, player)}
            />
          ))}
        </View>

        <Text style={styles.hint}>{t('tmHint')}</Text>

        <GKButton
          title={t('back')}
          variant="ghost"
          style={{ marginTop: spacing.md }}
          onPress={() => navigation.goBack()}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.md, paddingBottom: spacing.xl },
  headerRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  title: { fontSize: font.title, fontWeight: '900', color: colors.pitchDark },
  subtitle: { color: colors.inkSoft, marginTop: 2, marginBottom: spacing.md },
  timerCard: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: spacing.sm, marginBottom: spacing.md,
  },
  timerLabel: { color: colors.inkSoft, fontWeight: '700' },
  timerValue: { color: colors.gold, fontWeight: '900', fontSize: font.h2 },
  grid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'space-between',
  },
  cell: {
    width: '31%', flexGrow: 1, alignItems: 'center',
    paddingVertical: spacing.sm, paddingHorizontal: spacing.xs, borderWidth: 2,
  },
  overallTag: { alignSelf: 'flex-end', marginBottom: -6, marginTop: -2 },
  overallText: { fontWeight: '900', fontSize: font.body },
  name: {
    fontSize: 11, fontWeight: '800', color: colors.ink, marginTop: 4,
    maxWidth: '100%', textAlign: 'center',
  },
  meta: { fontSize: 10, color: colors.inkSoft, marginTop: 1, marginBottom: spacing.sm },
  buyBtn: {
    paddingVertical: 8, paddingHorizontal: spacing.md, minWidth: 64,
  },
  boughtTag: {
    paddingVertical: 8, paddingHorizontal: spacing.sm,
    borderRadius: radius.sm, backgroundColor: colors.grass,
  },
  boughtText: { color: colors.pitchDark, fontWeight: '800', fontSize: font.small },
  hint: {
    marginTop: spacing.md, color: colors.inkSoft, fontSize: font.small,
    textAlign: 'center', lineHeight: 18,
  },
});
