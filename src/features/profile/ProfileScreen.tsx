import React, { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import {
  getSessionStats, getVisitedSpots,
  type SessionStats, type VisitedSpot,
} from '../../core/db/repositories/sessionRepo';
import {
  computeAchievements, type Achievement, type AchievementIcon,
} from '../../core/services/achievements';
import { getMeta, setMeta } from '../../core/db/repositories/metaRepo';
import { getLanguage, t, tf, type Language } from '../../core/i18n';
import { loadTrophies, totalTrophies } from '../../core/services/trophies';
import { useCloudStore } from '../../state/cloudStore';
import { useGameStore } from '../../state/gameStore';
import { useLeagueStore } from '../../state/leagueStore';
import { GKButton, Card, SectionTitle } from '../../ui/components';
import type { TabScreenProps } from '../../navigation/types';
import { Crest } from '../../ui/Crest';
import {
  IconBall, IconCheck, IconClock, IconCoin, IconFlash, IconMap, IconPack, IconPin,
  IconStar, IconTrophy, type IconProps,
} from '../../ui/icons';
import { colors, font, radius, spacing } from '../../ui/theme';

/**
 * Profile & progress (chapter 3.5): club name, crest, division,
 * achievements, visited pitches and real-world activity statistics.
 */

const ACHIEVEMENT_ICON: Record<AchievementIcon, React.ComponentType<IconProps>> = {
  ball: IconBall,
  map: IconMap,
  clock: IconClock,
  pack: IconPack,
  star: IconStar,
  trophy: IconTrophy,
  check: IconCheck,
  flash: IconFlash,
  coin: IconCoin,
};

export function ProfileScreen({ navigation }: TabScreenProps<'Profile'>) {
  const club = useGameStore((s) => s.club);
  const players = useGameStore((s) => s.players);
  const packs = useGameStore((s) => s.packs);
  const season = useLeagueStore((s) => s.season);
  const [stats, setStats] = useState<SessionStats | null>(null);
  const [visited, setVisited] = useState<VisitedSpot[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [themeMode, setThemeMode] = useState<'light' | 'dark'>('light');
  const [language, setLanguageState] = useState<Language>(getLanguage());
  const [trophyCount, setTrophyCount] = useState(0);

  /** Theme wechseln (V6.1): wird beim nächsten App-Start angewendet. */
  const onThemeChange = async (mode: 'light' | 'dark') => {
    if (mode === themeMode) return;
    setThemeMode(mode);
    await setMeta('themeMode', mode);
    Alert.alert(
      t('prThemeSavedTitle'),
      tf('prThemeSaved', { mode: mode === 'dark' ? t('prDark') : t('prLight') }),
    );
  };

  /** Sprache wechseln (V6.2): wie das Theme erst beim nächsten Start aktiv. */
  const onLanguageChange = async (lang: Language) => {
    if (lang === language) return;
    setLanguageState(lang);
    await setMeta('language', lang);
    Alert.alert(t('prLangSavedTitle'), t('prLangSaved'));
  };

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const s = await getSessionStats();
        setStats(s);
        setVisited(await getVisitedSpots());
        setThemeMode((await getMeta('themeMode')) === 'dark' ? 'dark' : 'light');
        const savedLang = await getMeta('language');
        if (savedLang === 'en' || savedLang === 'de' || savedLang === 'pt') {
          setLanguageState(savedLang);
        }
        setTrophyCount(totalTrophies(await loadTrophies()));
        setAchievements(
          await computeAchievements({
            stats: s,
            players,
            packs,
            division: club?.division ?? 4,
          }),
        );
      })();
    }, [players, packs, club?.division]),
  );

  const legendaries = players.filter((p) => p.pool.rarity === 'legendaer').length;
  const unlockedCount = achievements.filter((a) => a.unlocked).length;
  const cloudStatus = useCloudStore((s) => s.status);
  const friendCode = useCloudStore((s) => s.friendCode);

  const cloudLine =
    cloudStatus === 'online'
      ? tf('prCloudCode', { code: friendCode ?? '…' })
      : cloudStatus === 'connecting'
        ? t('prCloudConnecting')
        : cloudStatus === 'error'
          ? t('prCloudError')
          : t('prCloudOffline');

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.clubHero}>
          <Crest crestId={club?.crest} size={80} />
          <Text style={styles.clubName}>{club?.name ?? t('prClub')}</Text>
          <Text style={styles.clubMeta}>
            {tf('prDivision', { n: club?.division ?? 4 })} · {tf('prSeason', { n: season })}
          </Text>
        </View>

        <SectionTitle>{t('prRealActivity')}</SectionTitle>
        <View style={styles.statsGrid}>
          <Card style={styles.statCard}>
            <Text style={styles.statValue}>{stats?.totalSessions ?? 0}</Text>
            <Text style={styles.statLabel}>{t('prStatSessions')}</Text>
          </Card>
          <Card style={styles.statCard}>
            <Text style={styles.statValue}>{stats?.distinctSpots ?? 0}</Text>
            <Text style={styles.statLabel}>{t('prStatPitches')}</Text>
          </Card>
          <Card style={styles.statCard}>
            <Text style={styles.statValue}>{stats?.totalMinutes ?? 0}</Text>
            <Text style={styles.statLabel}>{t('prStatMinutes')}</Text>
          </Card>
          <Card style={styles.statCard}>
            <Text style={styles.statValue}>{stats?.totalCoins ?? 0}</Text>
            <Text style={styles.statLabel}>{t('prStatCoins')}</Text>
          </Card>
        </View>

        <SectionTitle>
          {tf('prAchievements', { a: unlockedCount, b: achievements.length })}
        </SectionTitle>
        <View style={styles.achievementGrid}>
          {achievements.map((a) => {
            const AIcon = ACHIEVEMENT_ICON[a.icon];
            return (
              <Card
                key={a.id}
                style={[styles.achievementCard, !a.unlocked && styles.achievementLocked]}
              >
                <AIcon size={26} color={a.unlocked ? colors.pitch : colors.inkSoft} />
                <Text style={styles.achievementTitle} numberOfLines={1}>
                  {a.title}
                </Text>
                <Text style={styles.achievementDesc} numberOfLines={2}>
                  {a.description}
                </Text>
              </Card>
            );
          })}
        </View>

        <SectionTitle>{t('prPassport')}</SectionTitle>
        <Card style={styles.visitedCard}>
          <IconPin size={22} color={colors.pitch} />
          <View style={styles.visitedInfo}>
            <Text style={styles.visitedName}>
              {tf(visited.length === 1 ? 'prPassportCount' : 'prPassportCountPl', { n: visited.length })}
            </Text>
            <Text style={styles.visitedMeta}>
              {t('prPassportSub')}
            </Text>
          </View>
        </Card>
        <GKButton
          title={t('prOpenPassport')}
          variant="secondary"
          onPress={() => navigation.navigate('Passport')}
        />

        <SectionTitle>{t('prTrophies')}</SectionTitle>
        <Card style={styles.visitedCard}>
          <IconTrophy size={22} color={colors.gold} />
          <View style={styles.visitedInfo}>
            <Text style={styles.visitedName}>{trophyCount}</Text>
            <Text style={styles.visitedMeta}>{t('prTrophiesHint')}</Text>
          </View>
        </Card>
        <GKButton
          title={t('prOpenTrophies')}
          variant="secondary"
          onPress={() => navigation.navigate('Trophies')}
        />

        <SectionTitle>{t('prFriendlies')}</SectionTitle>
        <Card>
          <Text style={styles.infoRow}>{cloudLine}</Text>
          {cloudStatus === 'online' && (
            <Text style={styles.aboutText}>
              {t('prShareCode')}
            </Text>
          )}
        </Card>

        <SectionTitle>{t('prClub')}</SectionTitle>
        <Card>
          <Text style={styles.infoRow}>{tf('prSquadSize', { n: players.length })}</Text>
          <Text style={styles.infoRow}>{tf('prLegendaries', { n: legendaries })}</Text>
          <Text style={styles.infoRow}>{tf('prCoins', { n: club?.coins ?? 0 })}</Text>
        </Card>

        <SectionTitle>{t('prAbout')}</SectionTitle>
        <Card>
          <Text style={styles.aboutText}>
            {t('prAbout1')}
          </Text>
          <Text style={styles.aboutText}>
            {t('prAbout2')}
          </Text>
        </Card>

        <SectionTitle>{t('prSettings')}</SectionTitle>
        <Card>
          <Text style={styles.infoRow}>{t('prTheme')}</Text>
          <View style={styles.themeRow}>
            {(['light', 'dark'] as const).map((mode) => (
              <Pressable
                key={mode}
                style={[styles.themeBtn, themeMode === mode && styles.themeBtnActive]}
                onPress={() => void onThemeChange(mode)}
              >
                <Text style={[styles.themeText, themeMode === mode && styles.themeTextActive]}>
                  {mode === 'light' ? t('prLight') : t('prDark')}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.aboutText}>
            {t('prThemeHint')}
          </Text>
          <Text style={styles.infoRow}>{t('prLanguage')}</Text>
          <View style={styles.themeRow}>
            {([
              ['en', 'English'],
              ['de', 'Deutsch'],
              ['pt', 'Português'],
            ] as Array<[Language, string]>).map(([lang, label]) => (
              <Pressable
                key={lang}
                style={[styles.themeBtn, language === lang && styles.themeBtnActive]}
                onPress={() => void onLanguageChange(lang)}
              >
                <Text style={[styles.themeText, language === lang && styles.themeTextActive]}>
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.aboutText}>
            {t('prLangSaved')}
          </Text>
        </Card>

        <SectionTitle>{t('prHelp')}</SectionTitle>
        <Card>
          <Text style={styles.aboutText}>
            {t('prHelpHint')}
          </Text>
          <GKButton title={t('prOpenGuide')} onPress={() => navigation.navigate('Help')} />
        </Card>
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
  clubHero: {
    alignItems: 'center',
    backgroundColor: colors.pitch,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  clubName: {
    fontSize: font.h1,
    fontWeight: '900',
    color: '#fff',
    marginTop: spacing.sm,
  },
  clubMeta: {
    color: colors.grass,
    fontWeight: '700',
    marginTop: 4,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  statCard: {
    flexBasis: '47%',
    flexGrow: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 30,
    fontWeight: '900',
    color: colors.pitchDark,
  },
  statLabel: {
    fontSize: font.small,
    color: colors.inkSoft,
    marginTop: 2,
  },
  achievementGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  achievementCard: {
    flexBasis: '30%',
    flexGrow: 1,
    alignItems: 'center',
    padding: spacing.sm,
  },
  achievementLocked: {
    opacity: 0.45,
  },
  achievementTitle: {
    fontWeight: '800',
    color: colors.ink,
    fontSize: font.small,
    marginTop: 6,
    textAlign: 'center',
  },
  achievementDesc: {
    fontSize: 10,
    color: colors.inkSoft,
    textAlign: 'center',
    marginTop: 2,
  },
  visitedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    marginBottom: spacing.xs,
  },
  visitedInfo: {
    flex: 1,
  },
  visitedName: {
    fontWeight: '800',
    color: colors.ink,
    fontSize: font.body,
  },
  themeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginVertical: spacing.sm,
  },
  themeBtn: {
    flex: 1,
    borderWidth: 2,
    borderColor: colors.line,
    borderRadius: radius.sm,
    paddingVertical: 8,
    alignItems: 'center',
  },
  themeBtnActive: {
    borderColor: colors.pitch,
    backgroundColor: colors.grass,
  },
  themeText: {
    fontWeight: '800',
    fontSize: font.small,
    color: colors.inkSoft,
  },
  themeTextActive: {
    color: colors.pitchDark,
  },
  visitedMeta: {
    fontSize: font.small,
    color: colors.inkSoft,
    marginTop: 2,
  },
  infoRow: {
    fontSize: font.body,
    color: colors.ink,
    marginBottom: 6,
  },
  aboutText: {
    fontSize: font.small,
    color: colors.inkSoft,
    marginBottom: spacing.sm,
  },
});
