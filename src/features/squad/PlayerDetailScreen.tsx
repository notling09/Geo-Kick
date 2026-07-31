import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  MAX_PLAYER_OVERALL, POSITION_LABEL, RARITY_COLOR, RARITY_LABEL, SELL_VALUE, levelUpCost,
} from '../../core/domain/constants';
import { t, tf, type TKey } from '../../core/i18n';
import { effectiveAttributes, effectiveOverall } from '../../core/engine/playerGen';
import { eligiblePositions } from '../../core/engine/chemistry';
import { formOf, formStage, loadForm } from '../../core/services/form';
import { useGameStore } from '../../state/gameStore';
import { GKButton, Card, SectionTitle } from '../../ui/components';
import { PlayerAvatar } from '../../ui/PlayerAvatar';
import { FormBars } from '../../ui/PlayerCard';
import { colors, font, radius, spacing } from '../../ui/theme';
import type { RootScreenProps } from '../../navigation/types';

const FORM_STAGE_LABELS: TKey[] = ['formPoor', 'formWeak', 'formAverage', 'formGood', 'formTop'];

/**
 * Player detail: attributes, level-ups (spend level-up points earned from
 * duplicates and pack bonuses, V3) and selling for coins.
 */

const ATTR_LABELS: Array<[keyof ReturnType<typeof effectiveAttributes>, TKey]> = [
  ['tempo', 'pdPace'],
  ['technik', 'pdTechnique'],
  ['abschluss', 'pdFinishing'],
  ['verteidigung', 'pdDefending'],
  ['kondition', 'pdStamina'],
];

export function PlayerDetailScreen({ route, navigation }: RootScreenProps<'PlayerDetail'>) {
  const { playerId } = route.params;
  const { players, lineup, captainPlayerId, sellPlayer, levelPoints, levelUpPlayer } = useGameStore();

  const player = players.find((p) => p.id === playerId);
  const inLineup = lineup.includes(playerId);
  const isCaptain = playerId === captainPlayerId;

  // Spielerform laden (V7.2)
  const [formValue, setFormValue] = useState<number | null>(null);
  useEffect(() => {
    let active = true;
    loadForm().then((f) => {
      if (active && player) setFormValue(formOf(f, player.pool.name));
    });
    return () => {
      active = false;
    };
  }, [player?.pool.name]);

  if (!player) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={styles.emptyText}>{t('pdNotFound')}</Text>
        <GKButton title={t('back')} variant="ghost" onPress={() => navigation.goBack()} />
      </SafeAreaView>
    );
  }

  const attrs = effectiveAttributes(player.pool, player.level);
  const overall = effectiveOverall(player.pool, player.level);
  const rarityColor = RARITY_COLOR[player.pool.rarity];
  const sellValue = SELL_VALUE[player.pool.rarity];

  // V7: beim Verkauf zwischen Coins und Level-up-Punkten (gleiche Höhe) wählen
  const onSell = () => {
    Alert.alert(
      tf('pdSellConfirmTitle', { name: player.pool.name }),
      tf('pdSellChoose', { n: sellValue }),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: tf('pdSellForCoins', { n: sellValue }),
          onPress: async () => {
            const ok = await sellPlayer(player.id, 'coins');
            if (ok) navigation.goBack();
          },
        },
        {
          text: tf('pdSellForPoints', { n: sellValue }),
          onPress: async () => {
            const ok = await sellPlayer(player.id, 'points');
            if (ok) navigation.goBack();
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={[styles.hero, { backgroundColor: rarityColor }]}>
          <PlayerAvatar player={player.pool} size={96} />
          <Text style={styles.heroName}>{player.pool.name}</Text>
          <Text style={styles.heroMeta}>
            {POSITION_LABEL[player.pool.position]} · {RARITY_LABEL[player.pool.rarity]} ·{' '}
            {tf('pdLevel', { n: player.level })}
          </Text>
          <Text style={styles.heroOverall}>{overall}</Text>
        </View>

        <SectionTitle>{t('pdPositions')}</SectionTitle>
        <Card>
          <Text style={styles.posLine}>
            {t('pdMainPos')}: <Text style={styles.posValue}>{POSITION_LABEL[player.pool.position]}</Text>
          </Text>
          <Text style={styles.posLine}>
            {t('pdSecPos')}: <Text style={styles.posValue}>
              {(() => {
                const sec = eligiblePositions(player.pool).filter((p) => p !== player.pool.position);
                return sec.length ? sec.map((p) => POSITION_LABEL[p]).join(', ') : t('pdNoSecPos');
              })()}
            </Text>
          </Text>
        </Card>

        <SectionTitle>{t('pdAttributes')}</SectionTitle>
        <Card>
          {ATTR_LABELS.map(([key, label]) => (
            <View key={key} style={styles.attrRow}>
              <Text style={styles.attrLabel}>{t(label)}</Text>
              <View style={styles.attrBarWrap}>
                <View
                  style={[
                    styles.attrBar,
                    { width: `${attrs[key]}%`, backgroundColor: rarityColor },
                  ]}
                />
              </View>
              <Text style={styles.attrValue}>{attrs[key]}</Text>
            </View>
          ))}
        </Card>

        <SectionTitle>{t('pdForm')}</SectionTitle>
        <Card>
          <View style={styles.formRow}>
            <FormBars stage={formValue !== null ? formStage(formValue) : 2} />
            <Text style={styles.formLabel}>
              {formValue !== null ? t(FORM_STAGE_LABELS[formStage(formValue)]) : '...'}
            </Text>
          </View>
          <Text style={styles.trainText}>{t('pdFormHint')}</Text>
        </Card>

        <SectionTitle>{t('pdLevelUp')}</SectionTitle>
        <Card>
          {(() => {
            const cost = overall >= MAX_PLAYER_OVERALL ? null : levelUpCost(overall);
            return (
              <>
                <Text style={styles.trainText}>
                  {cost === null
                    ? tf('pdMaxReached', { name: player.pool.name, max: MAX_PLAYER_OVERALL })
                    : tf('pdLevelCost', { cost, ovr: overall, points: levelPoints })}
                </Text>
                <GKButton
                  title={cost === null ? t('pdMaxBtn') : tf('pdLevelBtn', { n: cost })}
                  onPress={async () => {
                    const result = await levelUpPlayer(player.id);
                    if (result === 'points') {
                      Alert.alert(t('pdNoPointsTitle'), t('pdNoPoints'));
                    }
                  }}
                  disabled={cost === null || levelPoints < cost}
                />
              </>
            );
          })()}
        </Card>

        <SectionTitle>{t('pdSell')}</SectionTitle>
        <Card>
          {player.pool.rarity === 'geheim' ? (
            <Text style={styles.trainText}>
              {t('pdMysteryNoSell')}
            </Text>
          ) : (
            <>
              <Text style={styles.trainText}>
                {isCaptain
                  ? t('pdCaptainNoSell')
                  : inLineup
                    ? t('pdLineupNoSell')
                    : tf('pdSellInfo', { n: sellValue, rarity: RARITY_LABEL[player.pool.rarity] })}
              </Text>
              <GKButton
                title={tf('pdSellBtnChoice', { n: sellValue })}
                variant="danger"
                onPress={onSell}
                disabled={inLineup || isCaptain}
              />
            </>
          )}
        </Card>

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
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  hero: {
    borderRadius: radius.lg,
    alignItems: 'center',
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  heroName: {
    fontSize: font.h1,
    fontWeight: '900',
    color: '#fff',
    marginTop: spacing.sm,
  },
  heroMeta: {
    color: 'rgba(255,255,255,0.9)',
    marginTop: 4,
    fontWeight: '600',
  },
  heroOverall: {
    fontSize: 46,
    fontWeight: '900',
    color: '#fff',
    marginTop: spacing.sm,
  },
  attrRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  posLine: {
    fontSize: font.body,
    color: colors.inkSoft,
    fontWeight: '700',
    marginBottom: 4,
  },
  posValue: {
    color: colors.ink,
    fontWeight: '800',
  },
  attrLabel: {
    width: 100,
    fontSize: font.small,
    fontWeight: '700',
    color: colors.inkSoft,
  },
  attrBarWrap: {
    flex: 1,
    height: 10,
    backgroundColor: colors.grass,
    borderRadius: radius.round,
    overflow: 'hidden',
    marginRight: spacing.sm,
  },
  attrBar: {
    height: '100%',
    borderRadius: radius.round,
  },
  attrValue: {
    width: 32,
    textAlign: 'right',
    fontWeight: '900',
    color: colors.ink,
  },
  trainText: {
    color: colors.inkSoft,
    fontSize: font.small,
    marginBottom: spacing.sm,
  },
  formRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  formLabel: {
    fontSize: font.body,
    fontWeight: '900',
    color: colors.ink,
  },
  emptyText: {
    padding: spacing.lg,
    color: colors.inkSoft,
  },
});
