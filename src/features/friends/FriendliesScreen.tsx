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
import { useCloudStore } from '../../state/cloudStore';
import { useFriendsStore } from '../../state/friendsStore';
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
  const { friends, records, loading, loadFriends, addFriend, removeFriend, playFriendly } =
    useFriendsStore();

  const [code, setCode] = useState('');
  const [adding, setAdding] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (cloudStatus === 'online') void loadFriends();
    }, [cloudStatus, loadFriends]),
  );

  const onAdd = async () => {
    if (code.trim().length !== 6) {
      Alert.alert('Invalid code', 'Friend codes have exactly 6 characters.');
      return;
    }
    setAdding(true);
    try {
      const result = await addFriend(code);
      if (result === 'ok') {
        setCode('');
      } else {
        const messages: Record<Exclude<typeof result, 'ok'>, string> = {
          not_found: 'No club found with this code. Double-check it with your friend.',
          own_code: 'That is your own code - add a friend instead!',
          already_added: 'This club is already in your friends list.',
          offline: 'Could not reach the server. Try again later.',
        };
        Alert.alert('Could not add friend', messages[result]);
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
        Alert.alert('Not possible', 'Could not load your friend’s squad. Try again later.');
      }
    } finally {
      setPlayingId(null);
    }
  };

  const onRemove = (friendId: string, name: string) => {
    Alert.alert(`Remove ${name}?`, 'You can add the club again anytime with its code.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => void removeFriend(friendId) },
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
        <Text style={styles.title}>Friendlies</Text>

        {cloudStatus !== 'online' ? (
          <Card>
            <Text style={styles.offlineText}>
              {cloudStatus === 'connecting'
                ? 'Connecting to the cloud …'
                : 'Friendlies need an internet connection. Your club plays on - try again later.'}
            </Text>
          </Card>
        ) : (
          <>
            <Card style={styles.codeCard}>
              <Text style={styles.codeLabel}>Your friend code</Text>
              <Text style={styles.codeValue}>{myCode ?? '…'}</Text>
              <Text style={styles.codeHint}>
                Share it with friends so they can add your club.
              </Text>
            </Card>

            <SectionTitle>Add a friend</SectionTitle>
            <Card style={styles.addRow}>
              <TextInput
                style={styles.input}
                placeholder="ABC123"
                placeholderTextColor={colors.inkSoft}
                value={code}
                onChangeText={(t) => setCode(t.toUpperCase())}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={6}
              />
              <GKButton title="Add" onPress={onAdd} loading={adding} style={styles.addBtn} />
            </Card>

            <SectionTitle>Your friends ({friends.length})</SectionTitle>
            {friends.length === 0 ? (
              <Card>
                <Text style={styles.offlineText}>
                  No friends yet. Send them the app and swap codes!
                </Text>
              </Card>
            ) : (
              friends.map((f) => {
                const rec = records[f.id] ?? { w: 0, d: 0, l: 0 };
                return (
                  <Card key={f.id} style={styles.friendCard}>
                    <View style={styles.friendHeader}>
                      <Crest crestId={f.crest} size={40} />
                      <View style={styles.friendInfo}>
                        <Text style={styles.friendName} numberOfLines={1}>
                          {f.club_name}
                        </Text>
                        <Text style={styles.friendMeta}>
                          Division {f.division} · Strength {f.strength} · {f.formation}
                        </Text>
                        <Text style={styles.friendRecord}>
                          Your record: {rec.w}W {rec.d}D {rec.l}L
                        </Text>
                      </View>
                    </View>
                    <View style={styles.friendButtons}>
                      <GKButton
                        title="Play friendly"
                        onPress={() => onPlay(f.id)}
                        loading={playingId === f.id}
                        style={{ flex: 1 }}
                      />
                      <GKButton
                        title="Remove"
                        variant="ghost"
                        onPress={() => onRemove(f.id, f.club_name)}
                        style={styles.removeBtn}
                      />
                    </View>
                  </Card>
                );
              })
            )}
            <Text style={styles.footnote}>
              Friendlies are played against your friend’s latest synced XI. No coins or
              packs - just bragging rights.
            </Text>
          </>
        )}

        <GKButton
          title="Back"
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
