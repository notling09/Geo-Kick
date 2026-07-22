import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CHAMPIONS_LEAGUE, USER_CLUB_ID } from '../../core/domain/constants';
import { groupStandings, KO_STAGES, type ClMatch, type ClStage, type ClState } from '../../core/engine/cl';
import { t, tf, type TKey } from '../../core/i18n';
import { Card } from '../../ui/components';
import { Crest } from '../../ui/Crest';
import { colors, font, radius, spacing } from '../../ui/theme';

/**
 * Champions-League-Ansicht (V7.1): Gruppentabelle + K.o.-Baum. Wird sowohl im
 * eigenen Screen als auch als Tab in der Liga verwendet, damit der Bracket
 * jederzeit sichtbar ist.
 */

const STAGE_LABEL: Record<ClStage, TKey> = {
  group: 'clGroupStage',
  r16: 'clStageR16',
  qf: 'clStageQf',
  sf: 'clStageSf',
  final: 'clStageFinal',
};

function TeamLine({ state, id, goals, decided, isWinner }: {
  state: ClState; id: string; goals: number | null; decided: boolean; isWinner: boolean;
}) {
  const team = state.teams[id];
  const isUser = id === USER_CLUB_ID;
  return (
    <View style={styles.teamLine}>
      <Crest crestId={team?.crest ?? 'crest-0'} size={20} />
      <Text
        style={[styles.teamName, isUser && styles.userText, decided && isWinner && styles.winnerText]}
        numberOfLines={1}
      >
        {team?.name ?? '?'}
      </Text>
      {decided && <Text style={styles.teamGoals}>{goals}</Text>}
    </View>
  );
}

function TieCard({ state, m }: { state: ClState; m: ClMatch }) {
  const homeWin = m.played && m.homeGoals >= m.awayGoals;
  const awayWin = m.played && m.awayGoals > m.homeGoals;
  const involvesUser = m.homeId === USER_CLUB_ID || m.awayId === USER_CLUB_ID;
  return (
    <Card style={[styles.tie, involvesUser ? styles.tieUser : null]}>
      <TeamLine state={state} id={m.homeId} goals={m.homeGoals} decided={m.played} isWinner={homeWin} />
      <View style={styles.tieDivider} />
      <TeamLine state={state} id={m.awayId} goals={m.awayGoals} decided={m.played} isWinner={awayWin} />
    </Card>
  );
}

export function ClBracketView({ state }: { state: ClState }) {
  const table = groupStandings(state);
  const groupDone = state.ko.r16.length > 0;

  return (
    <View>
      <Text style={styles.section}>{t('clGroupStage')}</Text>
      <Card style={{ paddingVertical: spacing.sm }}>
        <View style={styles.tableHeader}>
          <Text style={[styles.th, styles.colPos]}>#</Text>
          <Text style={[styles.th, styles.colClub]}>{t('lgClub')}</Text>
          <Text style={[styles.th, styles.colNum]}>P</Text>
          <Text style={[styles.th, styles.colNum]}>GD</Text>
          <Text style={[styles.th, styles.colNum]}>Pts</Text>
        </View>
        {table.map((row, i) => {
          const isUser = row.clubId === USER_CLUB_ID;
          const advances = i < CHAMPIONS_LEAGUE.advancePerGroup;
          return (
            <View key={row.clubId} style={[styles.tableRow, isUser ? styles.userRow : null]}>
              <Text style={[styles.td, styles.colPos, advances ? styles.advanceText : null]}>{i + 1}</Text>
              <View style={[styles.clubCell, styles.colClub]}>
                <Crest crestId={row.crest} size={18} />
                <Text style={[styles.td, styles.clubCellName, isUser && styles.userText]} numberOfLines={1}>
                  {row.name}
                </Text>
              </View>
              <Text style={[styles.td, styles.colNum]}>{row.played}</Text>
              <Text style={[styles.td, styles.colNum]}>{row.goalsFor - row.goalsAgainst}</Text>
              <Text style={[styles.td, styles.colNum, styles.points]}>{row.points}</Text>
            </View>
          );
        })}
        <Text style={styles.legend}>{tf('clAdvance', { n: CHAMPIONS_LEAGUE.advancePerGroup })}</Text>
      </Card>

      {groupDone && (
        <>
          <Text style={styles.section}>{t('clBracket')}</Text>
          {KO_STAGES.map((stage) => {
            const round = state.ko[stage];
            if (round.length === 0) return null;
            return (
              <View key={stage}>
                <Text style={styles.stageLabel}>{t(STAGE_LABEL[stage])}</Text>
                {round.map((m, i) => (
                  <TieCard key={`${stage}-${i}`} state={state} m={m} />
                ))}
              </View>
            );
          })}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    fontSize: font.h2, fontWeight: '800', color: colors.ink,
    marginTop: spacing.md, marginBottom: spacing.sm,
  },
  tableHeader: {
    flexDirection: 'row', borderBottomWidth: 2, borderBottomColor: colors.line,
    paddingBottom: 6, marginBottom: 4,
  },
  th: { fontWeight: '900', color: colors.inkSoft, fontSize: font.small },
  tableRow: { flexDirection: 'row', paddingVertical: 6, alignItems: 'center' },
  userRow: { backgroundColor: colors.grass, borderRadius: radius.sm },
  td: { fontSize: font.small, color: colors.ink },
  colPos: { width: 24, textAlign: 'center' },
  colClub: { flex: 1 },
  clubCell: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  clubCellName: { flexShrink: 1 },
  colNum: { width: 36, textAlign: 'center' },
  points: { fontWeight: '900' },
  userText: { fontWeight: '900' },
  advanceText: { color: colors.pitch, fontWeight: '900' },
  legend: { fontSize: 10, color: colors.inkSoft, marginTop: spacing.sm },
  stageLabel: {
    fontWeight: '900', color: colors.accentDark, fontSize: font.small,
    marginTop: spacing.sm, marginBottom: 4,
  },
  tie: { padding: spacing.sm, marginBottom: spacing.xs },
  tieUser: { borderColor: colors.pitch, borderWidth: 2 },
  tieDivider: { height: 1, backgroundColor: colors.line, marginVertical: 4 },
  teamLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  teamName: { flex: 1, fontSize: font.small, color: colors.ink },
  winnerText: { fontWeight: '900' },
  teamGoals: { fontWeight: '900', color: colors.pitchDark, fontSize: font.body, width: 20, textAlign: 'center' },
});
