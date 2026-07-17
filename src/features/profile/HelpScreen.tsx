import React from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  BALANCING, DISCOVERY, LEAGUE_REWARDS, PACK_TYPES, PITCH_BATTLE, SELL_VALUE, SHOP_PACK_IDS,
} from '../../core/domain/constants';
import { t, tf } from '../../core/i18n';
import { GKButton, Card, SectionTitle } from '../../ui/components';
import { colors, font, spacing } from '../../ui/theme';
import type { RootScreenProps } from '../../navigation/types';

/**
 * Hilfeseite (V3, Nutzerwunsch): erklärt das komplette Spiel an einer
 * Stelle – die langen Infotexte aus dem Packs-Tab leben jetzt hier.
 */

const cooldownMin = BALANCING.spotCooldownMs / 60000;
const matchMin = BALANCING.matchIntervalMs / 60000;

export function HelpScreen({ navigation }: RootScreenProps<'Help'>) {
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>{t('helpTitle')}</Text>

        <SectionTitle>{t('helpSessions')}</SectionTitle>
        <Card>
          <Text style={styles.text}>
            {tf('helpS1', { min: BALANCING.minCoins, max: BALANCING.maxCoins })}
          </Text>
          <Text style={styles.text}>
            {tf('helpS2', { min: cooldownMin })}
          </Text>
        </Card>

        <SectionTitle>{t('helpDiscover')}</SectionTitle>
        <Card>
          <Text style={styles.text}>
            {tf('helpD1', {
              bonus: DISCOVERY.firstVisitBonusCoins,
              badges: DISCOVERY.passportBadges.join(' / '),
            })}
          </Text>
          <Text style={styles.text}>
            {tf('helpD2', { per: DISCOVERY.streakBonusPerDay, max: DISCOVERY.streakBonusMax })}
          </Text>
          <Text style={styles.text}>
            {tf('helpD3', { n: DISCOVERY.homeMinVisits, bonus: DISCOVERY.homeBonusCoins })}
          </Text>
        </Card>

        <SectionTitle>{t('helpBattles')}</SectionTitle>
        <Card>
          <Text style={styles.text}>
            {t('helpB1')}
          </Text>
          <Text style={styles.text}>
            {tf('helpB2', { n: PITCH_BATTLE.bossWinReward })}
          </Text>
        </Card>

        <SectionTitle>{t('helpEggs')}</SectionTitle>
        <Card>
          <Text style={styles.text}>
            {t('helpE1')}
          </Text>
        </Card>

        <SectionTitle>{t('helpPacks')}</SectionTitle>
        <Card>
          <Text style={styles.text}>
            {tf('helpP1', {
              n: BALANCING.playersPerPack,
              shop: SHOP_PACK_IDS.map(
                (id) => `${PACK_TYPES[id].label} (${PACK_TYPES[id].price} ${t('coins')})`,
              ).join(', '),
            })}
          </Text>
          <Text style={styles.text}>
            {tf('helpP2', {
              s1: PACK_TYPES.session.bonus[0], s2: PACK_TYPES.session.bonus[1],
              st1: PACK_TYPES.standard.bonus[0], st2: PACK_TYPES.standard.bonus[1],
              r1: PACK_TYPES.rare.bonus[0], r2: PACK_TYPES.rare.bonus[1],
              u1: PACK_TYPES.ultimate.bonus[0], u2: PACK_TYPES.ultimate.bonus[1],
            })}
          </Text>
          <Text style={styles.text}>
            {tf('helpP3', {
              b: SELL_VALUE.bronze, s: SELL_VALUE.silber,
              g: SELL_VALUE.gold, l: SELL_VALUE.legendaer,
            })}
          </Text>
        </Card>

        <SectionTitle>{t('helpMystery')}</SectionTitle>
        <Card>
          <Text style={styles.text}>
            {t('helpM1')}
          </Text>
        </Card>

        <SectionTitle>{t('helpPoints')}</SectionTitle>
        <Card>
          <Text style={styles.text}>
            {t('helpPo1')}
          </Text>
        </Card>

        <SectionTitle>{t('helpSquad')}</SectionTitle>
        <Card>
          <Text style={styles.text}>
            {tf('helpSq1', { n: BALANCING.maxSquadSize })}
          </Text>
          <Text style={styles.text}>
            {tf('helpSq2', { g: LEAGUE_REWARDS.captainGoal, a: LEAGUE_REWARDS.captainAssist })}
          </Text>
        </Card>

        <SectionTitle>{t('helpLeague')}</SectionTitle>
        <Card>
          <Text style={styles.text}>
            {tf('helpL1', { min: matchMin, w: LEAGUE_REWARDS.win, d: LEAGUE_REWARDS.draw })}
          </Text>
          <Text style={styles.text}>
            {t('helpL2')}
          </Text>
          <Text style={styles.text}>
            {t('helpL3')}
          </Text>
          <Text style={styles.text}>
            {t('helpL5')}
          </Text>
          <Text style={styles.text}>
            {tf('helpL4', {
              p1: LEAGUE_REWARDS.seasonByDivision[1][0],
              p2: LEAGUE_REWARDS.seasonByDivision[1][1],
            })}
          </Text>
        </Card>

        <SectionTitle>{t('helpFriends')}</SectionTitle>
        <Card>
          <Text style={styles.text}>
            {t('helpF1')}
          </Text>
          <Text style={styles.text}>
            {t('helpF2')}
          </Text>
        </Card>

        <GKButton
          title={t('back')}
          variant="ghost"
          style={styles.backBtn}
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
  title: {
    fontSize: font.title,
    fontWeight: '900',
    color: colors.pitchDark,
    marginBottom: spacing.sm,
  },
  text: {
    fontSize: font.small,
    color: colors.ink,
    lineHeight: 19,
    marginBottom: spacing.sm,
  },
  backBtn: {
    marginTop: spacing.md,
  },
});
