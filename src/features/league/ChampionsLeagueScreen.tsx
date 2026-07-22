import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { t } from '../../core/i18n';
import { useClStore } from '../../state/clStore';
import { GKButton } from '../../ui/components';
import { ClBracketView } from './ClBracketView';
import { colors, font, spacing } from '../../ui/theme';
import type { RootScreenProps } from '../../navigation/types';

/**
 * Champions-League-Screen (V7): zeigt Gruppentabelle + K.o.-Baum über die
 * ClBracketView. Wird u. a. nach dem "Runde ansehen" geöffnet.
 */
export function ChampionsLeagueScreen({ navigation }: RootScreenProps<'ChampionsLeague'>) {
  const state = useClStore((s) => s.state);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>{t('clName')}</Text>
        {state ? (
          <ClBracketView state={state} />
        ) : (
          <Text style={styles.info}>{t('clName')}</Text>
        )}
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
  title: { fontSize: font.title, fontWeight: '900', color: colors.pitchDark, marginBottom: spacing.sm },
  info: { color: colors.inkSoft, fontSize: font.body },
});
