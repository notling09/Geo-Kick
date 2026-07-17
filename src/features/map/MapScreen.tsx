import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  Camera,
  GeoJSONSource,
  Layer,
  Map as LibreMap,
  Marker,
  UserLocation,
  type CameraRef,
} from '@maplibre/maplibre-react-native';
import * as Location from 'expo-location';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  BALANCING, FITNESS_BONUS_COINS, OBJECTIVE_BONUS_COINS, PITCH_BATTLE,
} from '../../core/domain/constants';
import { t, tf, type TKey } from '../../core/i18n';
import type { Spot } from '../../core/domain/types';
import { circlePolygon, distanceMeters } from '../../core/services/geo';
import { getPositionWithTimeout, promptEnableLocation } from '../../core/services/location';
import { getMotionStats } from '../../core/services/motion';
import { useBattleStore, type BattleResult } from '../../state/battleStore';
import { useEggStore } from '../../state/eggStore';
import { useSessionStore, type CheckInResult } from '../../state/sessionStore';
import { useGameStore } from '../../state/gameStore';
import { GKButton, Card, CoinBadge, IconCircleButton } from '../../ui/components';
import { IconCheck, IconLocate, IconRefresh, MapPin } from '../../ui/icons';
import { colors, font, radius, spacing } from '../../ui/theme';
import type { TabScreenProps } from '../../navigation/types';

/**
 * Map view (chapter 3.1): OpenStreetMap data rendered with MapLibre - no API
 * key needed (the Google Maps SDK refuses to render anything without a valid
 * key, which is why react-native-maps was replaced). Long-press the map to
 * suggest/add a pitch that is missing from the map data.
 *
 * Tiles: OpenFreeMap (openfreemap.org) - free vector tiles without key or
 * rate limits, explicitly meant for apps. tile.openstreetmap.org is not
 * intended for app traffic per the OSM tile usage policy and resets
 * connections ("stream was reset: CANCEL").
 */
const MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

const CHECKIN_ERROR_KEY: Record<Exclude<CheckInResult, { ok: true }>['reason'], TKey> = {
  permission: 'ciPermission',
  mocked: 'ciMocked',
  too_far: 'ciTooFar',
  cooldown: 'ciCooldown',
  active_session: 'ciActive',
  no_location: 'ciNoLocation',
};

function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${String(sec).padStart(2, '0')}`;
}

const BATTLE_ERROR_KEY: Record<Exclude<BattleResult, { ok: true }>['reason'], TKey> = {
  permission: 'ciPermission',
  mocked: 'battleErrMocked',
  too_far: 'battleErrFar',
  already_fought: 'battleErrDone',
  no_location: 'ciNoLocation',
  no_club: 'battleErrClub',
};

export function MapScreen({ navigation }: TabScreenProps<'Map'>) {
  const cameraRef = useRef<CameraRef>(null);
  const {
    spots, activeSession, objectives, osmLoading, osmError, homeSpotId,
    hydrate, refreshOsmSpots, addUserSpot, checkIn, checkOut, toggleObjective,
  } = useSessionStore();
  const coins = useGameStore((s) => s.club?.coins ?? 0);
  const battle = useBattleStore();
  const specialSpotId = useBattleStore((s) => s.specialSpotId);
  const [fighting, setFighting] = useState(false);

  const [myPos, setMyPos] = useState<{ latitude: number; longitude: number } | null>(null);
  const [selectedSpotId, setSelectedSpotId] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  // Ein Tap auf einen Marker löst auch onPress der Karte aus (Deselect) –
  // dieser Zeitstempel unterdrückt das direkt folgende Karten-Event.
  const markerPressGuard = useRef(0);
  const [now, setNow] = useState(Date.now());
  const [newSpotCoords, setNewSpotCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [newSpotName, setNewSpotName] = useState('');

  const selectedSpot = useMemo(
    () => spots.find((s) => s.id === selectedSpotId) ?? null,
    [spots, selectedSpotId],
  );
  const activeSpot = useMemo(
    () => spots.find((s) => s.id === activeSession?.spotId) ?? null,
    [spots, activeSession],
  );

  // One-second tick for the session timer and cooldown labels
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const locate = useCallback(async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return undefined;
    // Mit Zeitlimit (V6.3): der Button darf bei GPS-Problemen nie hängen
    const pos = await getPositionWithTimeout(Location.Accuracy.Balanced);
    if (!pos) return undefined;
    const coords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
    setMyPos(coords);
    // Ei-Tracking läuft, sobald die Berechtigung da ist (V4)
    void useEggStore.getState().ensureTracking();
    cameraRef.current?.easeTo({
      center: [coords.longitude, coords.latitude],
      zoom: 14,
      duration: 600,
    });
    return coords;
  }, []);

  /**
   * Kein Standort (V6.3): statt nur "OK" bietet der Dialog direkt an, den
   * Standort zu aktivieren (Android-Systemdialog bzw. App-Einstellungen) und
   * ortet danach erneut.
   */
  const alertNoLocation = (message: string) => {
    Alert.alert(t('mapNoLocationTitle'), message, [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('mapEnableGps'),
        onPress: () => {
          void (async () => {
            await promptEnableLocation();
            await locate();
          })();
        },
      },
    ]);
  };

  useEffect(() => {
    hydrate();
    battle.hydrate();
    (async () => {
      const coords = await locate();
      // Load pitches from OSM automatically on first open
      if (coords) await refreshOsmSpots(coords.latitude, coords.longitude);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrate, locate, refreshOsmSpots]);

  // Gold-Platz des Tages im aktuellen Umkreis bestimmen/aktualisieren (V5):
  // reist der Nutzer in eine andere Stadt, wird ein neuer Platz dort golden
  useEffect(() => {
    if (spots.length > 0) void battle.ensureSpecialSpot(spots, myPos);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spots, myPos]);

  const onLocate = async () => {
    setLocating(true);
    try {
      const coords = await locate();
      if (!coords) alertNoLocation(t('mapNoLocationGps'));
    } finally {
      setLocating(false);
    }
  };

  const onRefreshSpots = async () => {
    const coords = myPos ?? (await locate());
    if (!coords) {
      alertNoLocation(t('mapNoLocation'));
      return;
    }
    const count = await refreshOsmSpots(coords.latitude, coords.longitude, { force: true });
    if (count > 0) {
      Alert.alert(t('mapPitchesUpdated'), tf('mapLoadedN', { n: count }));
    } else if (useSessionStore.getState().osmError) {
      Alert.alert(t('mapUpdateFailedTitle'), t('mapUpdateFailed'));
    }
  };

  const onCheckIn = async (spot: Spot) => {
    const result = await checkIn(spot);
    if (!result.ok) {
      const extra = result.detail ? ` (${result.detail})` : '';
      const message = t(CHECKIN_ERROR_KEY[result.reason]) + extra;
      // GPS aus bzw. Berechtigung fehlt: direkt zum Aktivieren anbieten
      if (result.reason === 'no_location' || result.reason === 'permission') {
        alertNoLocation(message);
      } else {
        Alert.alert(t('ciErrTitle'), message);
      }
    }
  };

  const onCheckOut = async () => {
    const result = await checkOut();
    if (result.ok) {
      const lines: string[] = [];
      if (result.doubled) lines.push(t('coDoubled'));
      if (result.objectiveBonus > 0) lines.push(tf('coObjectives', { n: result.objectiveBonus }));
      if (result.firstVisitBonus > 0) lines.push(tf('coNewPitch', { n: result.firstVisitBonus }));
      if (result.homeBonus > 0) lines.push(tf('coHome', { n: result.homeBonus }));
      if (result.streakBonus > 0) {
        lines.push(tf('coStreak', { d: result.streak ?? 0, n: result.streakBonus }));
      }
      if (result.eggLabel) lines.push(tf('coEgg', { egg: result.eggLabel }));
      Alert.alert(
        t('coDoneTitle'),
        tf('coDoneBody', { min: result.durationMinutes ?? 0, coins: result.coins ?? 0 }) +
          (lines.length > 0 ? `\n\n${lines.join('\n')}` : ''),
      );
    } else if (result.reason === 'too_short') {
      Alert.alert(
        t('coTooShortTitle'),
        tf('coTooShort', { min: result.durationMinutes ?? 0, need: BALANCING.minSessionMs / 60000 }),
      );
    } else if (result.reason === 'left_pitch') {
      Alert.alert(t('coNoRewardTitle'), t('coLeftPitch'));
    } else if (result.reason === 'mocked') {
      Alert.alert(t('coNoRewardTitle'), t('coMockedOut'));
    } else if (result.reason === 'no_movement') {
      Alert.alert(t('coNoRewardTitle'), t('coNoMovement'));
    }
  };

  /** V4: Gegner-Team des Platzes herausfordern (nur vor Ort, 1x pro Tag). */
  const onFight = async (spot: Spot) => {
    if (fighting) return;
    setFighting(true);
    try {
      const isBoss = spot.id === specialSpotId;
      const result = await battle.fight(spot, isBoss);
      if (result.ok) {
        navigation.navigate('MatchLive');
      } else {
        const extra = result.detail ? ` (${result.detail})` : '';
        Alert.alert(t('battleErrTitle'), t(BATTLE_ERROR_KEY[result.reason]) + extra);
      }
    } finally {
      setFighting(false);
    }
  };

  const onLongPress = (lngLat: [number, number]) => {
    if (activeSession) return;
    setNewSpotCoords({ latitude: lngLat[1], longitude: lngLat[0] });
    setNewSpotName('');
  };

  const confirmNewSpot = async () => {
    if (!newSpotCoords) return;
    await addUserSpot(newSpotName, newSpotCoords.latitude, newSpotCoords.longitude);
    setNewSpotCoords(null);
  };

  /**
   * Platz-Kampf-Bereich (V4/V5): Gegner-Team + Kampf-Button. Auch während
   * einer laufenden Session am eigenen Platz nutzbar.
   */
  const renderBattleBox = (spot: Spot) => {
    const isBoss = spot.id === specialSpotId;
    const opponent = battle.opponentFor(spot, isBoss);
    const rewardLabel = isBoss
      ? tf('battleWinBoss', { n: PITCH_BATTLE.bossWinReward })
      : t('battleWinPack');
    return (
      <View style={styles.battleBox}>
        <Text style={[styles.battleText, isBoss && styles.battleBossText]}>
          {isBoss ? t('battleBoss') : t('battleTeam')}
          {opponent.name} · {tf('battleStrength', { n: opponent.strength })}
        </Text>
        {battle.canFight(spot.id) ? (
          <GKButton
            title={tf('battleChallenge', { reward: rewardLabel })}
            variant="secondary"
            loading={fighting}
            onPress={() => onFight(spot)}
          />
        ) : (
          <Text style={styles.spotMeta}>{t('battleDone')}</Text>
        )}
      </View>
    );
  };

  const sessionMs = activeSession ? now - activeSession.startTime : 0;
  const rewardReached = sessionMs >= BALANCING.minSessionMs;
  const fullReached = sessionMs >= BALANCING.fullSessionMs;

  const spotDistance =
    selectedSpot && myPos
      ? Math.round(
          distanceMeters(myPos.latitude, myPos.longitude, selectedSpot.latitude, selectedSpot.longitude),
        )
      : null;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('mapTitle')}</Text>
        <CoinBadge coins={coins} />
      </View>

      <View style={styles.mapWrap}>
        <LibreMap
          style={StyleSheet.absoluteFill}
          mapStyle={MAP_STYLE_URL}
          attribution={false}
          logo={false}
          onLongPress={(e) => onLongPress(e.nativeEvent.lngLat)}
          onPress={() => {
            if (Date.now() - markerPressGuard.current > 400) setSelectedSpotId(null);
          }}
        >
          <Camera
            ref={cameraRef}
            initialViewState={{ center: [13.405, 52.52], zoom: 12 }}
            maxZoom={19}
          />
          <UserLocation accuracy />
          {selectedSpot && (
            <GeoJSONSource
              id="selected-radius"
              data={circlePolygon(selectedSpot.latitude, selectedSpot.longitude, selectedSpot.radius)}
            >
              <Layer
                id="selected-radius-fill"
                type="fill"
                paint={{ 'fill-color': colors.pitch, 'fill-opacity': 0.15 }}
              />
              <Layer
                id="selected-radius-line"
                type="line"
                paint={{ 'line-color': colors.pitch, 'line-width': 2 }}
              />
            </GeoJSONSource>
          )}
          {spots.map((spot) => {
            const onCooldown = spot.cooldownUntil > now;
            // V4: Gold = besonderer Platz des Tages, Blau = Heimplatz
            const pinColor = onCooldown
              ? '#9BA6B2'
              : spot.id === specialSpotId
                ? colors.gold
                : spot.id === homeSpotId
                  ? colors.sky
                  : spot.source === 'user'
                    ? colors.accent
                    : colors.pitch;
            return (
              <Marker
                key={spot.id}
                id={spot.id}
                lngLat={[spot.longitude, spot.latitude]}
                anchor="bottom"
                onPress={() => {
                  markerPressGuard.current = Date.now();
                  setSelectedSpotId(spot.id);
                }}
              >
                <View style={styles.pinWrap}>
                  <MapPin size={selectedSpotId === spot.id ? 36 : 28} color={pinColor} />
                </View>
              </Marker>
            );
          })}
        </LibreMap>
        {/* ODbL attribution (chapter 9.2) */}
        <Text style={styles.attribution}>© OpenStreetMap contributors · OpenFreeMap</Text>
        <View style={styles.mapButtons}>
          <IconCircleButton onPress={onLocate}>
            {locating ? (
              <ActivityIndicator size="small" color={colors.pitch} />
            ) : (
              <IconLocate size={24} color={colors.ink} />
            )}
          </IconCircleButton>
          <IconCircleButton onPress={onRefreshSpots}>
            {osmLoading ? (
              <ActivityIndicator size="small" color={colors.pitch} />
            ) : (
              <IconRefresh size={24} color={colors.ink} />
            )}
          </IconCircleButton>
        </View>
      </View>

      {/*
        V5: Die Info-Boxen liegen ÜBER der Karte (absolute) statt darunter im
        Layout – so wird die Karten-Oberfläche beim Auswählen eines Platzes
        nicht mehr verkleinert (das verursachte den kurzen schwarzen Blitz).
      */}
      <View style={styles.bottomOverlay} pointerEvents="box-none">
      {/* Nur blockierend anzeigen, wenn wirklich keine Plätze (auch keine gecachten) da sind */}
      {osmError && spots.length === 0 && !activeSession && !selectedSpot ? (
        <Card style={styles.bottomCard}>
          <Text style={styles.errorText}>{osmError}</Text>
        </Card>
      ) : null}

      {activeSession && (
        <Card style={styles.bottomCard}>
          <Text style={styles.spotName}>{tf('mapSessionRunning', { name: activeSpot?.name ?? t('mapPitchLabel') })}</Text>
          <Text style={styles.sessionTimer}>{formatDuration(sessionMs)}</Text>
          <Text style={styles.sessionHint}>
            {fullReached
              ? t('mapRewardFull')
              : rewardReached
                ? tf('mapRewardSecured', { min: BALANCING.fullSessionMs / 60000 })
                : tf('mapRewardStay', { min: BALANCING.minSessionMs / 60000 })}
          </Text>
          {objectives.length > 0 && (
            <View style={styles.objectivesBox}>
              <Text style={styles.objectivesTitle}>
                {tf('objTitle', { s: OBJECTIVE_BONUS_COINS, f: FITNESS_BONUS_COINS })}
              </Text>
              {objectives.map((o, i) => {
                if (o.kind === 'skill') {
                  return (
                    <Pressable
                      key={o.text}
                      style={styles.objectiveRow}
                      onPress={() => toggleObjective(i)}
                    >
                      <View style={[styles.objectiveBox, o.done && styles.objectiveBoxDone]}>
                        {o.done && <IconCheck size={13} color="#fff" />}
                      </View>
                      <Text style={[styles.objectiveText, o.done && styles.objectiveTextDone]}>
                        {o.text}
                      </Text>
                    </Pressable>
                  );
                }
                // Fitness-Aufgabe: Live-Fortschritt vom Bewegungssensor
                const stats = getMotionStats();
                const achieved =
                  o.kind === 'activeMs' ? stats.movedMs >= o.target : stats.sprints >= o.target;
                const progress =
                  o.kind === 'activeMs'
                    ? `${Math.min(Math.floor(stats.movedMs / 60000), Math.ceil(o.target / 60000))}:${String(
                        Math.floor((Math.min(stats.movedMs, o.target) % 60000) / 1000),
                      ).padStart(2, '0')} / ${o.target / 60000}:00 min`
                    : `${Math.min(stats.sprints, o.target)}/${o.target} ${t('objSprints')}`;
                return (
                  <View key={o.text} style={styles.objectiveRow}>
                    <View style={[styles.objectiveBox, achieved && styles.objectiveBoxDone]}>
                      {achieved && <IconCheck size={13} color="#fff" />}
                    </View>
                    <Text style={[styles.objectiveText, achieved && styles.objectiveTextDone]}>
                      {o.text}
                    </Text>
                    <Text style={styles.objectiveProgress}>{progress}</Text>
                  </View>
                );
              })}
            </View>
          )}
          <GKButton title={t('mapCheckOut')} variant="secondary" onPress={onCheckOut} />
          {/* V5: Platz-Kampf auch während der laufenden Session möglich */}
          {activeSpot && renderBattleBox(activeSpot)}
        </Card>
      )}

      {!activeSession && selectedSpot && (
        <Card style={styles.bottomCard}>
          <Text style={styles.spotName}>
            {selectedSpot.name}
            {selectedSpot.id === homeSpotId ? `  ·  ${t('mapHome')}` : ''}
          </Text>
          {selectedSpot.id === specialSpotId && (
            <Text style={styles.specialText}>
              {t('mapSpecial')}
            </Text>
          )}
          <Text style={styles.spotMeta}>
            {selectedSpot.source === 'user' ? `${t('mapAddedByYou')} · ` : `${t('mapFromOsm')} · `}
            {spotDistance !== null ? `${tf('mapAway', { m: spotDistance })} · ` : ''}
            {tf('mapRadius', { m: Math.round(selectedSpot.radius) })}
          </Text>
          {selectedSpot.cooldownUntil > now ? (
            <Text style={styles.cooldownText}>
              {tf('mapCooldown', { min: Math.ceil((selectedSpot.cooldownUntil - now) / 60000) })}
            </Text>
          ) : (
            <GKButton title={t('mapCheckIn')} onPress={() => onCheckIn(selectedSpot)} />
          )}
          {renderBattleBox(selectedSpot)}
        </Card>
      )}

      {!activeSession && !selectedSpot && (osmLoading || !osmError || spots.length > 0) && (
        <Card style={styles.bottomCard}>
          <Text style={styles.spotMeta}>
            {osmLoading
              ? t('mapSearching')
              : t('mapTapHint')}
          </Text>
        </Card>
      )}
      </View>

      <Modal visible={newSpotCoords !== null} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <Card style={styles.modalCard}>
            <Text style={styles.spotName}>{t('mapNewSpotTitle')}</Text>
            <TextInput
              style={styles.input}
              placeholder={t('mapNewSpotPlaceholder')}
              placeholderTextColor={colors.inkSoft}
              value={newSpotName}
              onChangeText={setNewSpotName}
              maxLength={40}
            />
            <View style={styles.modalButtons}>
              <GKButton
                title={t('cancel')}
                variant="ghost"
                style={{ flex: 1 }}
                onPress={() => setNewSpotCoords(null)}
              />
              <GKButton title={t('add')} style={{ flex: 1 }} onPress={confirmNewSpot} />
            </View>
          </Card>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  headerTitle: {
    fontSize: font.h1,
    fontWeight: '900',
    color: colors.pitchDark,
  },
  mapWrap: {
    flex: 1,
    overflow: 'hidden',
  },
  attribution: {
    position: 'absolute',
    bottom: 4,
    left: 6,
    fontSize: 10,
    color: colors.ink,
    backgroundColor: 'rgba(255,255,255,0.7)',
    paddingHorizontal: 4,
    borderRadius: 4,
  },
  pinWrap: {
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  mapButtons: {
    // Links, damit der MapLibre-Kompass oben rechts sichtbar bleibt (V5)
    position: 'absolute',
    left: spacing.sm,
    top: spacing.sm,
    gap: spacing.sm,
  },
  bottomOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  bottomCard: {
    margin: spacing.sm,
  },
  spotName: {
    fontSize: font.h2,
    fontWeight: '800',
    color: colors.ink,
    marginBottom: 4,
  },
  spotMeta: {
    fontSize: font.small,
    color: colors.inkSoft,
    marginBottom: spacing.sm,
  },
  cooldownText: {
    fontSize: font.body,
    fontWeight: '700',
    color: colors.accentDark,
  },
  specialText: {
    fontSize: font.small,
    fontWeight: '800',
    color: colors.accentDark,
    marginBottom: 4,
  },
  battleBox: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  battleText: {
    fontSize: font.small,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: spacing.sm,
  },
  battleBossText: {
    color: colors.accentDark,
    fontWeight: '900',
  },
  sessionTimer: {
    fontSize: 40,
    fontWeight: '900',
    color: colors.pitchDark,
    textAlign: 'center',
  },
  sessionHint: {
    fontSize: font.small,
    color: colors.inkSoft,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  objectivesBox: {
    backgroundColor: colors.grass,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  objectivesTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.pitchDark,
    marginBottom: 6,
  },
  objectiveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  objectiveBox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: colors.pitch,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  objectiveBoxDone: {
    backgroundColor: colors.pitch,
  },
  objectiveText: {
    flex: 1,
    fontSize: font.small,
    color: colors.ink,
  },
  objectiveTextDone: {
    textDecorationLine: 'line-through',
    color: colors.inkSoft,
  },
  objectiveProgress: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.pitchDark,
    marginLeft: spacing.sm,
  },
  errorText: {
    color: colors.danger,
    fontSize: font.small,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalCard: {},
  input: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginVertical: spacing.sm,
    color: colors.ink,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
});
