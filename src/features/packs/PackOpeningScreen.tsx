import React, { useEffect, useRef, useState } from 'react';
import {
  Alert, Animated, Dimensions, Easing, FlatList, KeyboardAvoidingView, Modal, Platform,
  Pressable, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  POSITION_LABEL, POSITION_SHORT, RARITY_COLOR, RARITY_LABEL, SELL_VALUE,
} from '../../core/domain/constants';
import type { Position, PoolPlayer } from '../../core/domain/types';
import { packTypeFromSource } from '../../core/engine/packGen';
import { effectiveOverall, overallOf } from '../../core/engine/playerGen';
import { playSound } from '../../core/services/sound';
import { useEggStore } from '../../state/eggStore';
import { useGameStore, type PackEntry } from '../../state/gameStore';
import { GKButton } from '../../ui/components';
import { IconCoin, IconPack, IconStar } from '../../ui/icons';
import { PitchBackground } from '../../ui/PitchBackground';
import { PlayerAvatar } from '../../ui/PlayerAvatar';
import { colors, font, radius, spacing } from '../../ui/theme';
import type { RootScreenProps } from '../../navigation/types';

/**
 * Pack-Öffnung als Vollbild-Erlebnis (V3): Pitch-Hintergrund wie der
 * Start-Screen, großes Pack-Icon, Tap reißt das Pack auf. Die drei Züge
 * erscheinen nacheinander von schwächstem zu bestem Spieler, jeweils mit
 * Seltenheits-Animation (Bronze direkt, Silber Blitz, Gold goldener Glow,
 * Legendär violetter Glow, ??? mit eigener Sequenz + Namenseingabe).
 * Duplikate (Training/Verkauf) und Kader-voll-Entscheidungen laufen direkt
 * an der jeweiligen Karte.
 */

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

type Phase = 'pack' | 'anim' | 'name' | 'card' | 'bonus';

type Entry = PackEntry & { note?: string };

const REVEAL_MS: Record<string, number> = {
  bronze: 0,
  silber: 700,
  gold: 1600,
  legendaer: 2400,
  geheim: 2600,
};

const POSITIONS: Position[] = ['TW', 'ABW', 'MF', 'ST'];

export function PackOpeningScreen({ navigation, route }: RootScreenProps<'PackOpening'>) {
  const { packId, egg: eggMode, eggIndex } = route.params;
  const {
    packs, players, lineup, captainPlayerId, openPack, sellDrawnPlayer, takeDuplicatePoints,
    keepDrawnPlayer, claimMysteryPlayer,
  } = useGameStore();
  const packType = packTypeFromSource(
    packs.find((p) => p.id === packId)?.source ?? 'session',
  );
  const insets = useSafeAreaInsets();

  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [bonus, setBonus] = useState(0);
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>('pack');
  const [busy, setBusy] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [mysteryName, setMysteryName] = useState('');
  const [mysteryPos, setMysteryPos] = useState<Position>('ST');

  // Animationswerte
  const packScale = useRef(new Animated.Value(1)).current;
  const packOpacity = useRef(new Animated.Value(1)).current;
  const packRotate = useRef(new Animated.Value(0)).current;
  const flashOpacity = useRef(new Animated.Value(0)).current;
  const glowScale = useRef(new Animated.Value(0.2)).current;
  const glowOpacity = useRef(new Animated.Value(0)).current;
  const mysteryScale = useRef(new Animated.Value(0.6)).current;
  const cardX = useRef(new Animated.Value(0)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  // Ruhiges Pulsieren des ungeöffneten Packs (stoppt, sobald geöffnet wird)
  useEffect(() => {
    if (phase !== 'pack' || busy || entries) return;
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(packScale, { toValue: 1.06, duration: 900, useNativeDriver: true }),
        Animated.timing(packScale, { toValue: 1, duration: 900, useNativeDriver: true }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [phase, busy, entries, packScale]);

  const current = entries?.[index];

  /** Karte einblenden (nach der Seltenheits-Animation). */
  const showCard = () => {
    cardX.setValue(0);
    Animated.timing(cardOpacity, {
      toValue: 1, duration: 350, useNativeDriver: true,
    }).start();
    setPhase('card');
  };

  /** Seltenheits-Animation für den Eintrag abspielen, danach Karte (oder Namenseingabe). */
  const runReveal = (entry: Entry) => {
    setPhase('anim');
    cardOpacity.setValue(0);
    flashOpacity.setValue(0);
    glowOpacity.setValue(0);
    glowScale.setValue(0.2);
    const rarity = entry.pool.rarity;

    if (rarity === 'bronze') {
      // Bronze: keine Show, direkt aufdecken
      showCard();
      return;
    }
    if (rarity === 'silber') {
      playSound('revealSilver');
      Animated.sequence([
        Animated.timing(flashOpacity, { toValue: 0.9, duration: 80, useNativeDriver: true }),
        Animated.timing(flashOpacity, { toValue: 0, duration: 120, useNativeDriver: true }),
        Animated.timing(flashOpacity, { toValue: 0.7, duration: 80, useNativeDriver: true }),
        Animated.timing(flashOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    } else if (rarity === 'gold' || rarity === 'legendaer') {
      playSound(rarity === 'gold' ? 'revealGold' : 'revealLegendary');
      // Farbiger Glow baut sich um den Spieler herum auf (Gold länger → Legendär noch länger)
      Animated.parallel([
        Animated.timing(glowOpacity, {
          toValue: 0.75, duration: REVEAL_MS[rarity] * 0.6, useNativeDriver: true,
        }),
        Animated.timing(glowScale, {
          toValue: 1.15,
          duration: REVEAL_MS[rarity],
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    } else if (rarity === 'geheim') {
      playSound('revealMystery');
      mysteryScale.setValue(0.6);
      Animated.loop(
        Animated.sequence([
          Animated.timing(mysteryScale, { toValue: 1.25, duration: 420, useNativeDriver: true }),
          Animated.timing(mysteryScale, { toValue: 0.85, duration: 420, useNativeDriver: true }),
        ]),
        { iterations: 3 },
      ).start();
    }

    timer.current = setTimeout(() => {
      if (rarity === 'geheim' && entry.outcome === 'mystery') {
        setPhase('name');
      } else {
        showCard();
      }
    }, REVEAL_MS[rarity]);
  };

  /**
   * Pack aufreißen: das Pack wackelt erst immer stärker, platzt dann auf
   * (Zoom + Ausblenden) – zusammen ~2 s, passend zur Länge des Sounds.
   * Danach der erste Reveal (schwächster Spieler zuerst).
   */
  const onOpenPack = async () => {
    if (busy || entries) return;
    setBusy(true);
    playSound('packOpen');
    const shake = (angle: number, ms: number) =>
      Animated.timing(packRotate, { toValue: angle, duration: ms, useNativeDriver: true });
    Animated.sequence([
      // Wackeln, immer stärker …
      shake(0.4, 120), shake(-0.4, 120),
      shake(0.7, 110), shake(-0.7, 110),
      shake(1, 100), shake(-1, 100),
      shake(0.6, 80), shake(0, 60),
      // … dann Aufplatzen
      Animated.parallel([
        Animated.timing(packScale, { toValue: 2.4, duration: 550, useNativeDriver: true }),
        Animated.timing(packOpacity, { toValue: 0, duration: 550, useNativeDriver: true }),
      ]),
    ]).start();
    try {
      const result = await openPack(packId ?? -1);
      setBonus(result.bonus);
      // Reihenfolge: schlechtester zuerst, die ???-Karte (99) immer zuletzt
      const sorted = [...result.entries].sort((a, b) => {
        const ovr = (e: PackEntry) =>
          e.outcome === 'mystery' ? Infinity : overallOf(e.pool, e.pool.position);
        return ovr(a) - ovr(b);
      });
      setEntries(sorted);
      setIndex(0);
      timer.current = setTimeout(() => runReveal(sorted[0]), 1800);
    } finally {
      setBusy(false);
    }
  };

  // Ei-Ausbrüten (V4): keine Icon-Phase – direkt zur Spieler-Animation
  const eggHatched = useRef(false);
  useEffect(() => {
    if (!eggMode || eggHatched.current) return;
    eggHatched.current = true;
    (async () => {
      const entry = await useEggStore.getState().hatchEgg(eggIndex ?? 0);
      if (!entry) {
        navigation.goBack();
        return;
      }
      setEntries([entry]);
      setIndex(0);
      timer.current = setTimeout(() => runReveal(entry), 350);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eggMode]);

  /** Karte nach links rauswischen, dann nächster Zug oder der Pack-Bonus. */
  const onNext = () => {
    if (!entries || !current || phase !== 'card') return;
    if (needsDecision(current)) return;
    Animated.parallel([
      Animated.timing(cardX, { toValue: -SCREEN_W, duration: 260, useNativeDriver: true }),
      Animated.timing(cardOpacity, { toValue: 0, duration: 260, useNativeDriver: true }),
    ]).start(() => {
      if (index >= entries.length - 1) {
        // Ei-Ausbrüten hat keinen Pack-Bonus: direkt zurück
        if (eggMode) {
          navigation.goBack();
          return;
        }
        // Nach dem letzten Spieler: Bonus-Coins + Level-up-Punkte zeigen
        cardX.setValue(0);
        Animated.timing(cardOpacity, { toValue: 1, duration: 350, useNativeDriver: true }).start();
        setPhase('bonus');
        return;
      }
      const next = index + 1;
      setIndex(next);
      runReveal(entries[next]);
    });
  };

  const needsDecision = (e: Entry): boolean =>
    (e.outcome === 'duplicate' || e.outcome === 'pending') && !e.note;

  const patchCurrent = (patch: Partial<Entry>) => {
    setEntries((prev) =>
      prev?.map((e, i) => (i === index ? { ...e, ...patch } : e)) ?? null,
    );
  };

  const onSell = async (e: Entry) => {
    if (busy) return;
    setBusy(true);
    try {
      await sellDrawnPlayer(e.pool);
      patchCurrent({ coins: SELL_VALUE[e.pool.rarity], note: `sold for ${SELL_VALUE[e.pool.rarity]} coins` });
    } finally {
      setBusy(false);
    }
  };

  /** Duplikat in frei ausgebbare Level-up-Punkte umwandeln (V3). */
  const onTakePoints = async (e: Entry) => {
    if (busy) return;
    setBusy(true);
    try {
      const points = await takeDuplicatePoints(e.pool);
      patchCurrent({ note: `+${points} level-up points` });
    } finally {
      setBusy(false);
    }
  };

  const onKeep = async (e: Entry, sellOwnedId: number) => {
    const victim = players.find((p) => p.id === sellOwnedId);
    const ok = await keepDrawnPlayer(e.pool, sellOwnedId);
    setPickerOpen(false);
    if (!ok) {
      Alert.alert('Not possible', 'This player cannot be sold (still in your XI?).');
      return;
    }
    patchCurrent({ outcome: 'added', note: `joined the club (sold ${victim?.pool.name ?? 'a player'})` });
  };

  /** Die ???-Karte benennen und als 99er aufnehmen. */
  const onClaimMystery = async () => {
    if (busy || !mysteryName.trim()) return;
    setBusy(true);
    try {
      const created = await claimMysteryPlayer(mysteryName, mysteryPos);
      if (!created) return;
      patchCurrent({ pool: created, outcome: 'added', note: 'joined the club' });
      showCard();
    } finally {
      setBusy(false);
    }
  };

  // Verkaufbare eigene Spieler (nicht aufgestellt, kein Captain, keine ???-Karte)
  const sellCandidates = players
    .filter((p) =>
      !lineup.includes(p.id) && p.id !== captainPlayerId && p.pool.rarity !== 'geheim')
    .sort((a, b) => effectiveOverall(a.pool, a.level) - effectiveOverall(b.pool, b.level));

  const statusLine = (e: Entry): string => {
    if (e.note) return e.note;
    if (e.outcome === 'added') return 'joined the club';
    if (e.outcome === 'duplicate') return 'duplicate - train or sell?';
    return 'squad is full - sell or swap?';
  };

  const isLast = entries !== null && index >= entries.length - 1;
  const isMysteryCard = current?.pool.rarity === 'geheim';
  const glowColor = current?.pool.rarity === 'gold' ? colors.gold : '#8E44AD';

  return (
    <View style={styles.root}>
      <View style={StyleSheet.absoluteFill}>
        <PitchBackground width={SCREEN_W} height={SCREEN_H} variant="deep" />
      </View>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        {phase === 'pack' && !eggMode && (
          <Pressable style={styles.center} onPress={onOpenPack}>
            <Animated.View
              style={{
                transform: [
                  { scale: packScale },
                  {
                    rotate: packRotate.interpolate({
                      inputRange: [-1, 1],
                      outputRange: ['-10deg', '10deg'],
                    }),
                  },
                ],
                opacity: packOpacity,
              }}
            >
              <IconPack size={160} color={colors.accent} />
            </Animated.View>
            <Animated.Text style={[styles.tapHint, { opacity: packOpacity }]}>
              {packType.label}
            </Animated.Text>
            <Animated.Text style={[styles.tapHintSmall, { opacity: packOpacity }]}>
              Tap the pack to open it
            </Animated.Text>
          </Pressable>
        )}

        {phase === 'anim' && (
          <View style={styles.center}>
            {current?.pool.rarity === 'geheim' && (
              <Animated.Text style={[styles.mysteryText, { transform: [{ scale: mysteryScale }] }]}>
                ???
              </Animated.Text>
            )}
            {(current?.pool.rarity === 'gold' || current?.pool.rarity === 'legendaer') && (
              <Animated.View
                style={[
                  styles.glow,
                  { backgroundColor: glowColor, opacity: glowOpacity, transform: [{ scale: glowScale }] },
                ]}
              />
            )}
          </View>
        )}

        {phase === 'name' && (
          <KeyboardAvoidingView
            style={styles.center}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <View style={styles.nameCard}>
              <Text style={styles.nameTitle}>You found the one-of-a-kind card!</Text>
              <Text style={styles.nameSub}>
                A 99-rated player joins your club. Give him a name and pick his position.
              </Text>
              <TextInput
                style={styles.nameInput}
                placeholder="Player name"
                placeholderTextColor="#9BA6B2"
                value={mysteryName}
                onChangeText={setMysteryName}
                maxLength={24}
                autoFocus
              />
              <View style={styles.posRow}>
                {POSITIONS.map((pos) => (
                  <Pressable
                    key={pos}
                    style={[styles.posBtn, mysteryPos === pos && styles.posBtnActive]}
                    onPress={() => setMysteryPos(pos)}
                  >
                    <Text style={[styles.posBtnText, mysteryPos === pos && styles.posBtnTextActive]}>
                      {POSITION_SHORT[pos]}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <GKButton
                title="Create player"
                disabled={!mysteryName.trim() || busy}
                onPress={onClaimMystery}
              />
            </View>
          </KeyboardAvoidingView>
        )}

        {phase === 'card' && current && (
          <View style={styles.center}>
            <Text style={styles.counter}>
              Player {index + 1} of {entries?.length ?? 0}
            </Text>
            {(current.pool.rarity === 'gold' || current.pool.rarity === 'legendaer') && (
              <Animated.View
                style={[
                  styles.glow,
                  styles.glowBehind,
                  { backgroundColor: glowColor, opacity: 0.35 },
                ]}
              />
            )}
            <Pressable onPress={onNext} disabled={needsDecision(current)}>
              <Animated.View
                style={[
                  styles.card,
                  { borderColor: RARITY_COLOR[current.pool.rarity] },
                  isMysteryCard && styles.cardMystery,
                  { opacity: cardOpacity, transform: [{ translateX: cardX }] },
                ]}
              >
                <PlayerAvatar player={current.pool} size={110} />
                <Text style={[styles.cardName, isMysteryCard && styles.cardTextLight]}>
                  {current.pool.name}
                </Text>
                <Text style={[styles.cardMeta, isMysteryCard && styles.cardTextLight]}>
                  {POSITION_LABEL[current.pool.position]} · {RARITY_LABEL[current.pool.rarity]}
                </Text>
                <Text style={[styles.cardOverall, { color: isMysteryCard ? '#fff' : RARITY_COLOR[current.pool.rarity] }]}>
                  {overallOf(current.pool, current.pool.position)}
                </Text>
                {current.pool.rarity === 'legendaer' && <IconStar size={26} />}
                <Text style={[styles.cardStatus, isMysteryCard && styles.cardTextLight]}>
                  {statusLine(current)}
                </Text>
              </Animated.View>
            </Pressable>

            {needsDecision(current) ? (
              <View style={styles.decisionRow}>
                {current.outcome === 'duplicate' ? (
                  <>
                    <GKButton
                      title={`Take +${SELL_VALUE[current.pool.rarity]} points`}
                      style={styles.decisionBtn}
                      onPress={() => onTakePoints(current)}
                    />
                    <GKButton
                      title={`Sell +${SELL_VALUE[current.pool.rarity]}`}
                      variant="danger"
                      style={styles.decisionBtn}
                      onPress={() => onSell(current)}
                    />
                  </>
                ) : (
                  <>
                    <GKButton
                      title="Keep (swap)"
                      style={styles.decisionBtn}
                      onPress={() => setPickerOpen(true)}
                    />
                    <GKButton
                      title={`Sell +${SELL_VALUE[current.pool.rarity]}`}
                      variant="danger"
                      style={styles.decisionBtn}
                      onPress={() => onSell(current)}
                    />
                  </>
                )}
              </View>
            ) : (
              <GKButton
                title={isLast ? 'Continue' : 'Next player'}
                onPress={onNext}
                style={styles.nextBtn}
              />
            )}
            {!needsDecision(current) && (
              <Text style={styles.swipeHint}>Tap the card to continue</Text>
            )}
          </View>
        )}

        {phase === 'bonus' && (
          <View style={styles.center}>
            <Animated.View
              style={[styles.card, styles.bonusCard, { opacity: cardOpacity, transform: [{ translateX: cardX }] }]}
            >
              <Text style={styles.bonusTitle}>Pack bonus!</Text>
              <View style={styles.bonusRow}>
                <IconCoin size={26} />
                <Text style={styles.bonusValue}>+{bonus} coins</Text>
              </View>
              <View style={styles.bonusRow}>
                <IconCoin size={26} color="#0D47A1" fill="#90CAF9" />
                <Text style={styles.bonusValue}>+{bonus} level-up points</Text>
              </View>
              <Text style={styles.bonusHint}>
                Spend level-up points on any player in his detail view.
              </Text>
            </Animated.View>
            <GKButton title="Back to packs" onPress={() => navigation.goBack()} style={styles.nextBtn} />
          </View>
        )}

        {/* Blitz-Overlay (Silber) */}
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, styles.flash, { opacity: flashOpacity }]}
        />
      </SafeAreaView>

      {/* Kader voll: eigenen Spieler zum Verkauf wählen */}
      <Modal visible={pickerOpen} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalSheet, { paddingBottom: insets.bottom + spacing.md }]}>
            <Text style={styles.pickerTitle}>
              Sell a player to keep {current?.pool.name}
            </Text>
            <FlatList
              data={sellCandidates}
              keyExtractor={(p) => String(p.id)}
              style={styles.pickerList}
              renderItem={({ item }) => (
                <View style={[styles.pickerRow, { borderColor: RARITY_COLOR[item.pool.rarity] }]}>
                  <PlayerAvatar player={item.pool} size={40} />
                  <View style={styles.pickerInfo}>
                    <Text style={styles.pickerName}>{item.pool.name}</Text>
                    <Text style={styles.pickerMeta}>
                      {POSITION_LABEL[item.pool.position]} · {RARITY_LABEL[item.pool.rarity]} ·{' '}
                      {effectiveOverall(item.pool, item.level)}
                    </Text>
                  </View>
                  <GKButton
                    title={`Sell +${SELL_VALUE[item.pool.rarity]}`}
                    variant="danger"
                    style={styles.decisionBtn}
                    onPress={() => current && onKeep(current, item.id)}
                  />
                </View>
              )}
              ListEmptyComponent={
                <Text style={styles.pickerMeta}>No sellable players - everyone is in your XI.</Text>
              }
            />
            <GKButton
              title="Back"
              variant="secondary"
              style={styles.pickerBack}
              onPress={() => setPickerOpen(false)}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.pitchDark,
  },
  safe: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  tapHint: {
    marginTop: spacing.lg,
    color: '#fff',
    fontSize: font.h1,
    fontWeight: '900',
  },
  tapHintSmall: {
    marginTop: spacing.xs,
    color: 'rgba(255,255,255,0.75)',
    fontSize: font.body,
    fontWeight: '600',
  },
  flash: {
    backgroundColor: '#fff',
  },
  glow: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 160,
  },
  glowBehind: {
    alignSelf: 'center',
  },
  mysteryText: {
    color: '#fff',
    fontSize: 110,
    fontWeight: '900',
    textShadowColor: '#000',
    textShadowRadius: 18,
  },
  counter: {
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '800',
    marginBottom: spacing.md,
  },
  card: {
    width: Math.min(300, SCREEN_W - spacing.lg * 2),
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 3,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  cardMystery: {
    backgroundColor: '#0B0B0B',
    borderColor: '#000',
  },
  cardName: {
    marginTop: spacing.sm,
    fontSize: font.h1,
    fontWeight: '900',
    color: colors.ink,
    textAlign: 'center',
  },
  cardMeta: {
    marginTop: 2,
    fontSize: font.body,
    color: colors.inkSoft,
    fontWeight: '600',
  },
  cardOverall: {
    fontSize: 44,
    fontWeight: '900',
    marginTop: spacing.xs,
  },
  cardStatus: {
    marginTop: spacing.sm,
    fontSize: font.small,
    color: colors.inkSoft,
    textAlign: 'center',
  },
  cardTextLight: {
    color: '#fff',
  },
  decisionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  decisionBtn: {
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
  },
  nextBtn: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.xl,
  },
  swipeHint: {
    marginTop: spacing.sm,
    color: 'rgba(255,255,255,0.6)',
    fontSize: font.small,
  },
  bonusCard: {
    borderColor: colors.accent,
    gap: spacing.sm,
  },
  bonusTitle: {
    fontSize: font.h1,
    fontWeight: '900',
    color: colors.ink,
  },
  bonusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  bonusValue: {
    fontSize: font.h2,
    fontWeight: '900',
    color: colors.ink,
  },
  bonusHint: {
    fontSize: font.small,
    color: colors.inkSoft,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  nameCard: {
    width: Math.min(320, SCREEN_W - spacing.lg * 2),
    backgroundColor: '#0B0B0B',
    borderRadius: radius.lg,
    borderWidth: 3,
    borderColor: '#000',
    padding: spacing.lg,
    alignItems: 'stretch',
  },
  nameTitle: {
    color: '#fff',
    fontSize: font.h2,
    fontWeight: '900',
    textAlign: 'center',
  },
  nameSub: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: font.small,
    textAlign: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  nameInput: {
    backgroundColor: '#1C1C1C',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: '#333',
    color: '#fff',
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: font.body,
    fontWeight: '700',
  },
  posRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginVertical: spacing.md,
    justifyContent: 'center',
  },
  posBtn: {
    borderWidth: 2,
    borderColor: '#444',
    borderRadius: radius.sm,
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
  },
  posBtnActive: {
    borderColor: colors.accent,
    backgroundColor: 'rgba(255,143,0,0.18)',
  },
  posBtnText: {
    color: '#aaa',
    fontWeight: '800',
  },
  posBtnTextActive: {
    color: colors.accent,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.md,
    maxHeight: '85%',
  },
  pickerTitle: {
    fontSize: font.h2,
    fontWeight: '900',
    color: colors.ink,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  pickerList: {
    maxHeight: 300,
  },
  pickerBack: {
    marginTop: spacing.sm,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 2,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  pickerInfo: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  pickerName: {
    fontWeight: '800',
    color: colors.ink,
  },
  pickerMeta: {
    fontSize: font.small,
    color: colors.inkSoft,
    marginTop: 2,
  },
});
