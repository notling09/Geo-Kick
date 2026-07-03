import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Modal,
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
import { BALANCING } from '../../core/domain/constants';
import type { Spot } from '../../core/domain/types';
import { circlePolygon, distanceMeters } from '../../core/services/geo';
import { useSessionStore, type CheckInResult } from '../../state/sessionStore';
import { useGameStore } from '../../state/gameStore';
import { GKButton, Card, CoinBadge, IconCircleButton } from '../../ui/components';
import { IconLocate, IconRefresh, MapPin } from '../../ui/icons';
import { colors, font, radius, spacing } from '../../ui/theme';

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

const CHECKIN_ERROR_TEXT: Record<Exclude<CheckInResult, { ok: true }>['reason'], string> = {
  permission: 'Location permission missing. Please allow it in the settings.',
  mocked: 'Simulated GPS position detected - check-in blocked.',
  too_far: 'You are too far away from this pitch.',
  cooldown: 'This pitch is still on cooldown.',
  active_session: 'You are already checked in at a pitch.',
  no_location: 'Could not determine your location.',
};

function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${String(sec).padStart(2, '0')}`;
}

export function MapScreen() {
  const cameraRef = useRef<CameraRef>(null);
  const { spots, activeSession, osmLoading, osmError, hydrate, refreshOsmSpots, addUserSpot, checkIn, checkOut } =
    useSessionStore();
  const coins = useGameStore((s) => s.club?.coins ?? 0);

  const [myPos, setMyPos] = useState<{ latitude: number; longitude: number } | null>(null);
  const [selectedSpotId, setSelectedSpotId] = useState<string | null>(null);
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
    if (status !== 'granted') return;
    try {
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const coords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
      setMyPos(coords);
      cameraRef.current?.easeTo({
        center: [coords.longitude, coords.latitude],
        zoom: 14,
        duration: 600,
      });
      return coords;
    } catch {
      return undefined;
    }
  }, []);

  useEffect(() => {
    hydrate();
    (async () => {
      const coords = await locate();
      // Load pitches from OSM automatically on first open
      if (coords) await refreshOsmSpots(coords.latitude, coords.longitude);
    })();
  }, [hydrate, locate, refreshOsmSpots]);

  const onRefreshSpots = async () => {
    const coords = myPos ?? (await locate());
    if (!coords) {
      Alert.alert('No location', 'Could not determine your location.');
      return;
    }
    const count = await refreshOsmSpots(coords.latitude, coords.longitude, { force: true });
    if (count > 0) {
      Alert.alert('Pitches updated', `Loaded ${count} pitches from OpenStreetMap.`);
    } else if (useSessionStore.getState().osmError) {
      Alert.alert(
        'Update failed',
        'The OpenStreetMap servers did not respond. Cached pitches stay available - try again in a few minutes.',
      );
    }
  };

  const onCheckIn = async (spot: Spot) => {
    const result = await checkIn(spot);
    if (!result.ok) {
      const extra = result.detail ? ` (${result.detail})` : '';
      Alert.alert('Check-in not possible', CHECKIN_ERROR_TEXT[result.reason] + extra);
    }
  };

  const onCheckOut = async () => {
    const result = await checkOut();
    if (result.ok) {
      Alert.alert(
        'Session complete!',
        `${result.durationMinutes} minutes at the pitch.\nYou earned ${result.coins} coins and 1 pack!`,
      );
    } else if (result.reason === 'too_short') {
      Alert.alert(
        'Too short',
        `Only ${result.durationMinutes ?? 0} minutes - you need at least ${BALANCING.minSessionMs / 60000} minutes for a reward. Nothing this time.`,
      );
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
        <Text style={styles.headerTitle}>Map</Text>
        <CoinBadge coins={coins} />
      </View>

      <View style={styles.mapWrap}>
        <LibreMap
          style={StyleSheet.absoluteFill}
          mapStyle={MAP_STYLE_URL}
          attribution={false}
          logo={false}
          onLongPress={(e) => onLongPress(e.nativeEvent.lngLat)}
          onPress={() => setSelectedSpotId(null)}
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
            const pinColor = onCooldown
              ? '#9BA6B2'
              : spot.source === 'user'
                ? colors.accent
                : colors.pitch;
            return (
              <Marker
                key={spot.id}
                id={spot.id}
                lngLat={[spot.longitude, spot.latitude]}
                anchor="bottom"
                onPress={() => setSelectedSpotId(spot.id)}
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
          <IconCircleButton onPress={locate}>
            <IconLocate size={24} color={colors.ink} />
          </IconCircleButton>
          <IconCircleButton onPress={onRefreshSpots}>
            <IconRefresh size={24} color={osmLoading ? colors.inkSoft : colors.ink} />
          </IconCircleButton>
        </View>
      </View>

      {/* Nur blockierend anzeigen, wenn wirklich keine Plätze (auch keine gecachten) da sind */}
      {osmError && spots.length === 0 && !activeSession && !selectedSpot ? (
        <Card style={styles.bottomCard}>
          <Text style={styles.errorText}>{osmError}</Text>
        </Card>
      ) : null}

      {activeSession && (
        <Card style={styles.bottomCard}>
          <Text style={styles.spotName}>Session running: {activeSpot?.name ?? 'Pitch'}</Text>
          <Text style={styles.sessionTimer}>{formatDuration(sessionMs)}</Text>
          <Text style={styles.sessionHint}>
            {fullReached
              ? 'Full reward reached!'
              : rewardReached
                ? `Reward secured - full reward at ${BALANCING.fullSessionMs / 60000} min.`
                : `Stay at least ${BALANCING.minSessionMs / 60000} min. to earn a reward.`}
          </Text>
          <GKButton title="Check out" variant="secondary" onPress={onCheckOut} />
        </Card>
      )}

      {!activeSession && selectedSpot && (
        <Card style={styles.bottomCard}>
          <Text style={styles.spotName}>{selectedSpot.name}</Text>
          <Text style={styles.spotMeta}>
            {selectedSpot.source === 'user' ? 'Added by you · ' : 'From OpenStreetMap · '}
            {spotDistance !== null ? `${spotDistance} m away · ` : ''}
            check-in radius {Math.round(selectedSpot.radius)} m
          </Text>
          {selectedSpot.cooldownUntil > now ? (
            <Text style={styles.cooldownText}>
              Cooldown: available again in{' '}
              {Math.ceil((selectedSpot.cooldownUntil - now) / 60000)} min.
            </Text>
          ) : (
            <GKButton title="Check in" onPress={() => onCheckIn(selectedSpot)} />
          )}
        </Card>
      )}

      {!activeSession && !selectedSpot && (!osmError || spots.length > 0) && (
        <Card style={styles.bottomCard}>
          <Text style={styles.spotMeta}>
            Tap a pitch to check in. Long-press the map to add a missing pitch.
          </Text>
        </Card>
      )}

      <Modal visible={newSpotCoords !== null} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <Card style={styles.modalCard}>
            <Text style={styles.spotName}>Add a new pitch</Text>
            <TextInput
              style={styles.input}
              placeholder="Name of the pitch"
              placeholderTextColor={colors.inkSoft}
              value={newSpotName}
              onChangeText={setNewSpotName}
              maxLength={40}
            />
            <View style={styles.modalButtons}>
              <GKButton
                title="Cancel"
                variant="ghost"
                style={{ flex: 1 }}
                onPress={() => setNewSpotCoords(null)}
              />
              <GKButton title="Add" style={{ flex: 1 }} onPress={confirmNewSpot} />
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
    position: 'absolute',
    right: spacing.sm,
    top: spacing.sm,
    gap: spacing.sm,
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
