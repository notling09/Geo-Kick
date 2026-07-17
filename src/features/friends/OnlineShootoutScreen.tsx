import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { t, tf } from '../../core/i18n';
import { useGameStore } from '../../state/gameStore';
import { useOnlineStore } from '../../state/onlineStore';
import { GKButton, Card } from '../../ui/components';
import { PenaltyGoal } from '../../ui/PenaltyGoal';
import { colors, font, radius, spacing } from '../../ui/theme';
import type { RootScreenProps } from '../../navigation/types';

/**
 * Online-Elfmeterschießen (V6, FIFA-Stil): abwechselnd schießt der eine
 * Spieler (Ecke wählen), der andere hält (Hechtecke wählen) – der Torwart
 * wird erst freigeschaltet, NACHDEM der Schütze gewählt hat. Der Host löst
 * auf und synchronisiert beide Handys.
 */
export function OnlineShootoutScreen({ navigation }: RootScreenProps<'OnlineShootout'>) {
  const { phase, myRole, opponent, shootout, sendShot, sendDive, leave } = useOnlineStore();
  const clubName = useGameStore((s) => s.club?.name ?? '');
  // Ergebnis-Box verzögert zeigen (V6.3): der letzte Elfmeter soll erst
  // ~2 s sichtbar bleiben, bevor Sieg/Niederlage darüberliegt
  const [showDone, setShowDone] = useState(false);

  // Verbindung weg / abgebrochen → zurück
  useEffect(() => {
    if (phase === 'idle' && navigation.isFocused()) navigation.goBack();
  }, [phase, navigation]);

  const decided = shootout?.winnerRole != null && shootout.stage === 'result';
  useEffect(() => {
    if (!decided) {
      setShowDone(false);
      return;
    }
    const timer = setTimeout(() => setShowDone(true), 2200);
    return () => clearTimeout(timer);
  }, [decided]);

  if (!shootout || !myRole) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <Text style={styles.waiting}>{t('osoPreparing')}</Text>
      </SafeAreaView>
    );
  }

  const iShoot = shootout.turnRole === myRole;
  const mySide = myRole === 'host' ? 'A' : 'B';
  const myKicks = shootout.kicks.filter((k) => k.side === mySide);
  const oppKicks = shootout.kicks.filter((k) => k.side !== mySide);
  const myGoals = myKicks.filter((k) => k.scored).length;
  const oppGoals = oppKicks.filter((k) => k.scored).length;
  const done = shootout.winnerRole !== null && shootout.stage === 'result' && showDone;
  const iWon = shootout.winnerRole === myRole;

  const dots = (kicks: typeof myKicks) => {
    const slots = Math.max(5, kicks.length);
    return Array.from({ length: slots }, (_, i) => {
      const k = kicks[i];
      return (
        <View
          key={i}
          style={[styles.dot, k ? (k.scored ? styles.dotGoal : styles.dotMiss) : styles.dotOpen]}
        />
      );
    });
  };

  const roundKey = `${shootout.kicks.length}-${shootout.turnRole}`;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <View style={styles.dotsBlock}>
          <View>
            <Text style={styles.teamName} numberOfLines={1}>{clubName}</Text>
            <View style={styles.dotRow}>{dots(myKicks)}</View>
          </View>
          <View>
            <Text style={styles.teamName} numberOfLines={1}>{opponent?.name ?? t('onlineOpponent')}</Text>
            <View style={styles.dotRow}>{dots(oppKicks)}</View>
          </View>
        </View>
        <Text style={styles.score}>{myGoals}:{oppGoals}</Text>
      </View>

      <View style={styles.goalArea}>
        {shootout.stage === 'result' && shootout.lastResult ? (
          <PenaltyGoal
            key={`res-${roundKey}`}
            mode={iShoot ? 'shoot' : 'save'}
            shooter={shootout.shooter}
            keeper={shootout.keeper}
            externalResult={shootout.lastResult}
          />
        ) : iShoot ? (
          shootout.stage === 'pick' ? (
            <PenaltyGoal
              key={`shoot-${roundKey}`}
              mode="shoot"
              shooter={shootout.shooter}
              keeper={shootout.keeper}
              onPick={sendShot}
            />
          ) : (
            <Card style={styles.waitCard}>
              <Text style={styles.waitText}>
                {t('osoPickedWaiting')}
              </Text>
            </Card>
          )
        ) : shootout.stage === 'pick' ? (
          <Card style={styles.waitCard}>
            <Text style={styles.waitText}>
              {tf('osoOppPicking', { shooter: shootout.shooter, club: opponent?.name ?? '' })}
            </Text>
          </Card>
        ) : (
          <PenaltyGoal
            key={`save-${roundKey}`}
            mode="save"
            shooter={shootout.shooter}
            keeper={shootout.keeper}
            onPick={sendDive}
          />
        )}
      </View>

      {done && (
        <View style={styles.doneOverlay}>
          <Card style={styles.doneCard}>
            <Text style={[styles.doneTitle, { color: iWon ? colors.pitch : colors.danger }]}>
              {iWon ? t('soWon') : t('soLost')}
            </Text>
            <Text style={styles.doneScore}>{tf('soScoreLine', { score: `${myGoals}:${oppGoals}` })}</Text>
            <GKButton
              title={t('back')}
              onPress={() => {
                leave();
                navigation.goBack();
              }}
            />
          </Card>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#0D72BA',
    padding: spacing.md,
  },
  waiting: {
    color: '#fff',
    fontWeight: '800',
    textAlign: 'center',
    marginTop: spacing.xl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  dotsBlock: {
    flex: 1,
    gap: 8,
  },
  teamName: {
    color: '#fff',
    fontWeight: '800',
    fontSize: font.small,
  },
  dotRow: {
    flexDirection: 'row',
    gap: 5,
    marginTop: 2,
  },
  dot: {
    width: 13,
    height: 13,
    borderRadius: 7,
  },
  dotGoal: {
    backgroundColor: '#7CE97C',
  },
  dotMiss: {
    backgroundColor: '#FF6B5E',
  },
  dotOpen: {
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  score: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 36,
    marginLeft: spacing.md,
  },
  goalArea: {
    flex: 1,
    justifyContent: 'center',
  },
  waitCard: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  waitText: {
    color: colors.ink,
    fontWeight: '800',
    fontSize: font.body,
    textAlign: 'center',
  },
  doneOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  doneCard: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    borderRadius: radius.lg,
  },
  doneTitle: {
    fontSize: font.title,
    fontWeight: '900',
  },
  doneScore: {
    fontSize: font.h2,
    fontWeight: '800',
    color: colors.ink,
  },
});
