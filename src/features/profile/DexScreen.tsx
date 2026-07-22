import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { RARITY_COLOR } from '../../core/domain/constants';
import type { PoolPlayer } from '../../core/domain/types';
import { loadDexSeen } from '../../core/services/dex';
import { t, tf } from '../../core/i18n';
import { useGameStore } from '../../state/gameStore';
import { GKButton, Card } from '../../ui/components';
import { PlayerAvatar } from '../../ui/PlayerAvatar';
import { colors, font, radius, spacing } from '../../ui/theme';
import type { RootScreenProps } from '../../navigation/types';

/**
 * Sammelalbum / Dex (V7.2): zeigt alle Gold- und Legendär-Spieler des Pools
 * und markiert, welche man schon einmal besessen hat (über alle Karrieren).
 * Rein informativ, keine Belohnungen.
 */

function DexGrid({ players, seen, title, color }: {
  players: PoolPlayer[]; seen: Set<string>; title: string; color: string;
}) {
  const have = players.filter((p) => seen.has(p.name)).length;
  return (
    <>
      <View style={styles.sectionRow}>
        <Text style={styles.section}>{title}</Text>
        <Text style={[styles.sectionCount, { color }]}>
          {tf('dexProgress', { have, total: players.length })}
        </Text>
      </View>
      <View style={styles.grid}>
        {players.map((p) => {
          const owned = seen.has(p.name);
          return (
            <Card key={p.name} style={[styles.cell, { borderColor: owned ? color : colors.line }]}>
              <View style={owned ? undefined : styles.locked}>
                <PlayerAvatar player={p} size={44} />
              </View>
              <Text style={[styles.cellName, !owned && styles.cellNameLocked]} numberOfLines={1}>
                {owned ? p.name.split(' ').slice(-1)[0] : '???'}
              </Text>
            </Card>
          );
        })}
      </View>
    </>
  );
}

export function DexScreen({ navigation }: RootScreenProps<'Dex'>) {
  const pool = useGameStore((s) => s.pool);
  const [seen, setSeen] = useState<Set<string>>(new Set());

  useFocusEffect(
    useCallback(() => {
      void loadDexSeen().then(setSeen);
    }, []),
  );

  const { legendary, gold } = useMemo(() => {
    const byName = (a: PoolPlayer, b: PoolPlayer) => a.name.localeCompare(b.name);
    return {
      legendary: pool.filter((p) => p.rarity === 'legendaer').sort(byName),
      gold: pool.filter((p) => p.rarity === 'gold').sort(byName),
    };
  }, [pool]);

  const totalHave = [...legendary, ...gold].filter((p) => seen.has(p.name)).length;
  const total = legendary.length + gold.length;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>{t('dexTitle')}</Text>
        <Text style={styles.subtitle}>{t('dexSubtitle')}</Text>
        <Card style={styles.totalCard}>
          <Text style={styles.totalNumber}>{tf('dexProgress', { have: totalHave, total })}</Text>
        </Card>

        <DexGrid players={legendary} seen={seen} title={t('dexLegendary')} color={RARITY_COLOR.legendaer} />
        <DexGrid players={gold} seen={seen} title={t('dexGold')} color={RARITY_COLOR.gold} />

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
  title: { fontSize: font.title, fontWeight: '900', color: colors.pitchDark },
  subtitle: { color: colors.inkSoft, marginBottom: spacing.md },
  totalCard: { alignItems: 'center', paddingVertical: spacing.md, marginBottom: spacing.md },
  totalNumber: { fontSize: font.h1, fontWeight: '900', color: colors.gold },
  sectionRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline',
    marginTop: spacing.md, marginBottom: spacing.sm,
  },
  section: { fontSize: font.h2, fontWeight: '800', color: colors.ink },
  sectionCount: { fontWeight: '900', fontSize: font.small },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  cell: {
    width: '30%', flexGrow: 1, alignItems: 'center',
    paddingVertical: spacing.sm, borderWidth: 2,
  },
  locked: { opacity: 0.2 },
  cellName: {
    fontSize: 11, fontWeight: '800', color: colors.ink, marginTop: 4,
    maxWidth: '100%',
  },
  cellNameLocked: { color: colors.inkSoft },
});
