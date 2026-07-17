import React, { useCallback, useState } from 'react';
import {
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { t, tf } from '../../core/i18n';
import { useCloudStore } from '../../state/cloudStore';
import { useFriendsStore } from '../../state/friendsStore';
import { useOnlineStore } from '../../state/onlineStore';
import { GKButton, Card, SectionTitle } from '../../ui/components';
import { Crest } from '../../ui/Crest';
import { colors, font, radius, spacing } from '../../ui/theme';
import type { RootScreenProps } from '../../navigation/types';

/**
 * Friendlies: Freunde per 6-stelligem Code hinzufügen und gegen ihren
 * zuletzt synchronisierten Kader spielen (Live-Ticker wie in der Liga).
 * Kein Coin-/Pack-Reward – dafür eine Siegbilanz pro Freund.
 */
export function FriendliesScreen({ navigation }: RootScreenProps<'Friendlies'>) {
  const cloudStatus = useCloudStore((s) => s.status);
  const myCode = useCloudStore((s) => s.friendCode);
  const {
    friends, incoming, outgoing, onlineIds, records, loading,
    loadFriends, addFriend, acceptRequest, declineRequest, removeFriend, playFriendly,
  } = useFriendsStore();

  const [code, setCode] = useState('');
  const [adding, setAdding] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [invitingId, setInvitingId] = useState<string | null>(null);
  const inviteOnline = useOnlineStore((s) => s.invite);

  /** Online-Friendly (V6): Freund einladen und in die Lobby wechseln. */
  const onPlayOnline = async (friendId: string, friendName: string) => {
    setInvitingId(friendId);
    try {
      const ok = await inviteOnline(friendId, friendName);
      if (ok) {
        navigation.navigate('OnlineLobby');
      } else {
        Alert.alert(t('frPlayErrTitle'), t('frOnlineErr'));
      }
    } finally {
      setInvitingId(null);
    }
  };

  useFocusEffect(
    useCallback(() => {
      if (cloudStatus === 'online') void loadFriends();
    }, [cloudStatus, loadFriends]),
  );

  const onAdd = async () => {
    if (code.trim().length !== 6) {
      Alert.alert(t('frInvalidTitle'), t('frInvalid'));
      return;
    }
    setAdding(true);
    try {
      const result = await addFriend(code);
      if (result === 'ok') {
        setCode('');
      } else {
        const messages: Record<Exclude<typeof result, 'ok'>, string> = {
          not_found: t('frNotFound'),
          own_code: t('frOwnCode'),
          already_added: t('frAlready'),
          offline: t('frOfflineErr'),
        };
        Alert.alert(t('frAddErrTitle'), messages[result]);
      }
    } finally {
      setAdding(false);
    }
  };

  const onPlay = async (friendId: string) => {
    setPlayingId(friendId);
    try {
      const played = await playFriendly(friendId);
      if (played) {
        navigation.navigate('MatchLive');
      } else {
        Alert.alert(t('frPlayErrTitle'), t('frPlayErr'));
      }
    } finally {
      setPlayingId(null);
    }
  };

  const onRemove = (friendId: string, name: string) => {
    Alert.alert(tf('frRemoveTitle', { name }), t('frRemoveBody'), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('remove'), style: 'destructive', onPress: () => void removeFriend(friendId) },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={() => void loadFriends()} />
        }
      >
        <Text style={styles.title}>{t('frTitle')}</Text>

        {cloudStatus !== 'online' ? (
          <Card>
            <Text style={styles.offlineText}>
              {cloudStatus === 'connecting'
                ? t('frConnecting')
                : t('frOffline')}
            </Text>
          </Card>
        ) : (
          <>
            <Card style={styles.codeCard}>
              <Text style={styles.codeLabel}>{t('frYourCode')}</Text>
              <Text style={styles.codeValue}>{myCode ?? '…'}</Text>
              <Text style={styles.codeHint}>
                {t('frShare')}
              </Text>
            </Card>

            <SectionTitle>{t('frAddFriend')}</SectionTitle>
            <Card style={styles.addRow}>
              <TextInput
                style={styles.input}
                placeholder="ABC123"
                placeholderTextColor={colors.inkSoft}
                value={code}
                onChangeText={(v) => setCode(v.toUpperCase())}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={6}
              />
              <GKButton title={t('add')} onPress={onAdd} loading={adding} style={styles.addBtn} />
            </Card>

            {/* Eingehende Anfragen (V6.3): erst nach Annehmen ist man Freunde */}
            {incoming.length > 0 && (
              <>
                <SectionTitle>{tf('frRequests', { n: incoming.length })}</SectionTitle>
                {incoming.map((f) => (
                  <Card key={f.id} style={styles.friendCard}>
                    <View style={styles.friendHeader}>
                      <Crest crestId={f.crest} size={40} />
                      <View style={styles.friendInfo}>
                        <Text style={styles.friendName} numberOfLines={1}>
                          {f.club_name}
                        </Text>
                        <Text style={styles.friendMeta}>{t('frWantsFriend')}</Text>
                      </View>
                    </View>
                    <View style={styles.friendButtons}>
                      <GKButton
                        title={t('onAccept')}
                        onPress={() => void acceptRequest(f.id)}
                        style={{ flex: 1 }}
                      />
                      <GKButton
                        title={t('onDecline')}
                        variant="ghost"
                        onPress={() => void declineRequest(f.id)}
                        style={{ flex: 1 }}
                      />
                    </View>
                  </Card>
                ))}
              </>
            )}

            <SectionTitle>{tf('frYourFriends', { n: friends.length })}</SectionTitle>
            {friends.length === 0 ? (
              <Card>
                <Text style={styles.offlineText}>
                  {t('frNoFriends')}
                </Text>
              </Card>
            ) : (
              friends.map((f) => {
                const rec = records[f.id] ?? { w: 0, d: 0, l: 0 };
                const isOnline = onlineIds.includes(f.id);
                return (
                  <Card key={f.id} style={styles.friendCard}>
                    <View style={styles.friendHeader}>
                      <Crest crestId={f.crest} size={40} />
                      <View style={styles.friendInfo}>
                        <View style={styles.nameRow}>
                          <View
                            style={[styles.onlineDot, isOnline ? styles.dotOnline : styles.dotOff]}
                          />
                          <Text style={styles.friendName} numberOfLines={1}>
                            {f.club_name}
                          </Text>
                          <Text style={[styles.onlineText, isOnline && styles.onlineTextActive]}>
                            {isOnline ? t('frOnline') : t('frOffline2')}
                          </Text>
                        </View>
                        <Text style={styles.friendMeta}>
                          {tf('frMeta', { div: f.division, str: f.strength, form: f.formation })}
                        </Text>
                        <Text style={styles.friendRecord}>
                          {tf('frRecord', { w: rec.w, d: rec.d, l: rec.l })}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.friendButtons}>
                      <GKButton
                        title={t('frPlay')}
                        onPress={() => onPlay(f.id)}
                        loading={playingId === f.id}
                        style={{ flex: 1 }}
                      />
                      <GKButton
                        title={t('frPlayOnline')}
                        variant="secondary"
                        disabled={!isOnline}
                        onPress={() => onPlayOnline(f.id, f.club_name)}
                        loading={invitingId === f.id}
                        style={{ flex: 1 }}
                      />
                      <GKButton
                        title="X"
                        variant="ghost"
                        onPress={() => onRemove(f.id, f.club_name)}
                        style={styles.removeBtn}
                      />
                    </View>
                  </Card>
                );
              })
            )}

            {/* Gesendete Anfragen: warten auf die Gegenseite */}
            {outgoing.length > 0 && (
              <>
                <SectionTitle>{tf('frPendingTitle', { n: outgoing.length })}</SectionTitle>
                {outgoing.map((f) => (
                  <Card key={f.id} style={styles.friendCard}>
                    <View style={styles.friendHeader}>
                      <Crest crestId={f.crest} size={40} />
                      <View style={styles.friendInfo}>
                        <Text style={styles.friendName} numberOfLines={1}>
                          {f.club_name}
                        </Text>
                        <Text style={styles.friendMeta}>{t('frPendingHint')}</Text>
                      </View>
                      <GKButton
                        title="X"
                        variant="ghost"
                        onPress={() => onRemove(f.id, f.club_name)}
                        style={styles.removeBtn}
                      />
                    </View>
                  </Card>
                ))}
              </>
            )}
          </>
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
    marginBottom: spacing.md,
  },
  offlineText: {
    color: colors.inkSoft,
    fontSize: font.body,
  },
  codeCard: {
    alignItems: 'center',
    marginBottom: spacing.md,
    backgroundColor: colors.grass,
  },
  codeLabel: {
    fontSize: font.small,
    fontWeight: '700',
    color: colors.inkSoft,
  },
  codeValue: {
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: 6,
    color: colors.pitchDark,
    marginVertical: 4,
  },
  codeHint: {
    fontSize: font.small,
    color: colors.inkSoft,
  },
  addRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  input: {
    flex: 1,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.sm,
    padding: spacing.sm,
    fontSize: font.h2,
    fontWeight: '800',
    letterSpacing: 3,
    color: colors.ink,
  },
  addBtn: {
    paddingHorizontal: spacing.lg,
  },
  friendCard: {
    marginBottom: spacing.sm,
  },
  friendHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  friendInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  onlineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  dotOnline: {
    backgroundColor: '#4CAF50',
  },
  dotOff: {
    backgroundColor: colors.line,
  },
  onlineText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.inkSoft,
  },
  onlineTextActive: {
    color: '#4CAF50',
  },
  friendName: {
    fontSize: font.h2,
    fontWeight: '800',
    color: colors.ink,
  },
  friendMeta: {
    fontSize: font.small,
    color: colors.inkSoft,
    marginTop: 2,
  },
  friendRecord: {
    fontSize: font.small,
    fontWeight: '800',
    color: colors.pitchDark,
    marginTop: 2,
  },
  friendButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  removeBtn: {
    paddingHorizontal: spacing.md,
  },
  footnote: {
    fontSize: font.small,
    color: colors.inkSoft,
    textAlign: 'center',
    marginTop: spacing.md,
  },
});
