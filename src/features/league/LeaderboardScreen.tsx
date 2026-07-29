import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  fetchLeaderboard, getSupabase, type CloudSquadPlayer, type LeaderboardEntry,
} from '../../core/services/cloud';
import { overallOf } from '../../core/engine/playerGen';
import type { Position } from '../../core/domain/types';
import { t, tf } from '../../core/i18n';
import { useCloudStore } from '../../state/cloudStore';
import { useFriendsStore } from '../../state/friendsStore';
import { GKButton, Card } from '../../ui/components';
import { Crest } from '../../ui/Crest';
import { IconCheck, IconStar } from '../../ui/icons';
import { colors, font, radius, spacing } from '../../ui/theme';
import type { RootScreenProps } from '../../navigation/types';

/**
 * Weltweite Bestenliste (V7): die 10 stärksten Klubs aller Spieler, mit
 * Name, Team-Stärke und bestem Spieler. Platz 1/2/3 bekommen einen goldenen,
 * silbernen bzw. bronzenen Rahmen.
 */

const PODIUM = ['#E8B923', '#9BA6B2', '#B0743B']; // Gold, Silber, Bronze

/** Overall eines Cloud-Kaderspielers (Attribute sind schon effektiv). */
function squadOverall(p: CloudSquadPlayer): number {
  return overallOf(p, p.position as Position);
}

/** Wie viele Klubs geladen werden, um den eigenen Platz zu bestimmen (V7.4). */
const RANK_SCAN_LIMIT = 200;
const TOP_COUNT = 10;

export function LeaderboardScreen({ navigation }: RootScreenProps<'Leaderboard'>) {
  const cloudStatus = useCloudStore((s) => s.status);
  const [entries, setEntries] = useState<LeaderboardEntry[] | null>(null);
  const [myId, setMyId] = useState<string | null>(null);
  const friends = useFriendsStore((s) => s.friends);
  const outgoing = useFriendsStore((s) => s.outgoing);
  const [pending, setPending] = useState<Set<string>>(new Set());

  useEffect(() => {
    void useFriendsStore.getState().loadFriends();
  }, []);

  const onAddFriend = async (id: string) => {
    const res = await useFriendsStore.getState().addFriendById(id);
    if (res === 'ok') {
      setPending((p) => new Set(p).add(id));
      Alert.alert(t('lbFriendSentTitle'), t('lbFriendSent'));
    } else if (res === 'already_added') {
      setPending((p) => new Set(p).add(id));
    } else if (res === 'offline') {
      Alert.alert(t('lbFriendFailTitle'), t('prCloudOffline'));
    }
  };

  const load = useCallback(async () => {
    if (cloudStatus !== 'online') return;
    // Mehr als die Top 10 laden, damit auch ein Platz dahinter bestimmbar ist
    setEntries(await fetchLeaderboard(squadOverall, RANK_SCAN_LIMIT));
    const supabase = getSupabase();
    if (supabase) {
      const { data } = await supabase.auth.getSession();
      setMyId(data.session?.user.id ?? null);
    }
  }, [cloudStatus]);

  useEffect(() => {
    void load();
  }, [load]);

  // Eigener Platz in der gesamten geladenen Liste
  const myIndex = entries && myId ? entries.findIndex((e) => e.id === myId) : -1;
  const myEntry = myIndex >= 0 && entries ? entries[myIndex] : null;
  const top = entries ? entries.slice(0, TOP_COUNT) : [];

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>{t('lbTitle')}</Text>
        <Text style={styles.subtitle}>{t('lbSubtitle')}</Text>

        {cloudStatus !== 'online' ? (
          <Card>
            <Text style={styles.info}>{t('lbOffline')}</Text>
          </Card>
        ) : entries === null ? (
          <ActivityIndicator color={colors.pitch} style={{ marginTop: spacing.xl }} />
        ) : entries.length === 0 ? (
          <Card>
            <Text style={styles.info}>{t('lbEmpty')}</Text>
          </Card>
        ) : (
          (() => {
            /** Eine Zeile; der eigene Klub wird grün hervorgehoben (V7.4). */
            const renderRow = (e: LeaderboardEntry, index: number) => {
              const podium = index < 3 ? PODIUM[index] : null;
              const isMe = myId !== null && e.id === myId;
              return (
                <Card
                  key={`${e.id}-${index}`}
                  style={[
                    styles.row,
                    podium ? { borderColor: podium, borderWidth: 3 } : null,
                    isMe ? styles.myRow : null,
                  ]}
                >
                  <View style={[styles.rankBadge, podium ? { backgroundColor: podium } : null]}>
                    <Text style={[styles.rankText, podium ? { color: '#1A2E1A' } : null]}>
                      {index + 1}
                    </Text>
                  </View>
                  <Crest crestId={e.crest} size={40} />
                  <View style={styles.info2}>
                    <Text style={[styles.clubName, isMe && styles.myText]} numberOfLines={1}>
                      {e.clubName}
                      {isMe ? ` · ${t('lbYou')}` : ''}
                    </Text>
                    <Text style={styles.best} numberOfLines={1}>
                      {e.bestPlayer
                        ? tf('lbBest', { name: e.bestPlayer, ovr: e.bestOverall })
                        : tf('rvDivision', { n: e.division })}
                    </Text>
                  </View>
                  <View style={styles.strengthWrap}>
                    <IconStar size={14} color={podium ?? colors.pitch} />
                    <Text style={styles.strength}>{e.strength}</Text>
                  </View>
                  {/* Freundschaftsanfrage an fremde Klubs (V7.4) */}
                  {!isMe &&
                    (friends.some((f) => f.id === e.id) ||
                    outgoing.some((f) => f.id === e.id) ||
                    pending.has(e.id) ? (
                      <View style={styles.addBtn}>
                        <IconCheck size={16} color={colors.pitch} />
                      </View>
                    ) : (
                      <Pressable style={styles.addBtn} onPress={() => void onAddFriend(e.id)}>
                        <Text style={styles.addPlus}>+</Text>
                      </Pressable>
                    ))}
                </Card>
              );
            };
            return (
              <>
                {top.map((e, i) => renderRow(e, i))}
                {/* Eigener Klub außerhalb der Top 10: eigenen Platz extra zeigen */}
                {myEntry && myIndex >= TOP_COUNT && (
                  <>
                    <Text style={styles.myHint}>{t('lbYourPosition')}</Text>
                    {renderRow(myEntry, myIndex)}
                  </>
                )}
                {!myEntry && <Text style={styles.myHint}>{t('lbNotRanked')}</Text>}
              </>
            );
          })()
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
  },
  subtitle: {
    color: colors.inkSoft,
    marginBottom: spacing.md,
  },
  info: {
    color: colors.inkSoft,
    fontSize: font.body,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  myRow: {
    borderColor: colors.pitch,
    borderWidth: 3,
    backgroundColor: colors.grass,
  },
  myText: {
    color: colors.pitchDark,
    fontWeight: '900',
  },
  myHint: {
    color: colors.inkSoft,
    fontSize: font.small,
    fontWeight: '800',
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  rankBadge: {
    width: 28,
    height: 28,
    borderRadius: radius.round,
    backgroundColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: {
    fontWeight: '900',
    color: colors.ink,
    fontSize: font.small,
  },
  info2: {
    flex: 1,
  },
  clubName: {
    fontWeight: '800',
    color: colors.ink,
    fontSize: font.body,
  },
  best: {
    fontSize: font.small,
    color: colors.inkSoft,
    marginTop: 2,
  },
  strengthWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addBtn: {
    width: 30,
    height: 30,
    borderRadius: radius.round,
    borderWidth: 2,
    borderColor: colors.pitch,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPlus: {
    color: colors.pitch,
    fontSize: 20,
    fontWeight: '900',
    lineHeight: 22,
  },
  strength: {
    fontWeight: '900',
    color: colors.pitchDark,
    fontSize: font.h2,
  },
});
