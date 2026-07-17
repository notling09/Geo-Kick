import * as IntentLauncher from 'expo-intent-launcher';
import * as Location from 'expo-location';
import { Linking, Platform } from 'react-native';

/**
 * GPS-Helfer (V6.3): getCurrentPositionAsync kann bei schwachem Signal
 * beliebig lange hängen – der Nutzer sieht dann nur einen toten Button.
 * Hier bekommt jede Abfrage ein Zeitlimit plus Fallback auf die letzte
 * bekannte Position (max. 60 s alt).
 */
export async function getPositionWithTimeout(
  accuracy: Location.Accuracy,
  timeoutMs = 12000,
): Promise<Location.LocationObject | null> {
  try {
    const fresh = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
    ]);
    if (fresh) return fresh;
    const last = await Location.getLastKnownPositionAsync({ maxAge: 60000 });
    return last ?? null;
  } catch {
    return null;
  }
}

/**
 * Standort direkt aus der App heraus aktivieren (V6.3.1). Je nach Ursache
 * passiert etwas anderes – vorher passierte auf manchen Geräten (Samsung)
 * gar nichts, weil enableNetworkProviderAsync bei bereits aktivem Standort
 * sofort still zurückkehrt:
 *  1. Berechtigung fehlt → nachfragen; bei "nicht mehr fragen" die
 *     App-Einstellungen öffnen (dort sitzt der Berechtigungs-Schalter).
 *  2. Standortdienste aus → Play-Services-Dialog; klappt der nicht,
 *     direkt die System-Standorteinstellungen öffnen.
 */
export async function promptEnableLocation(): Promise<void> {
  // 1) Berechtigung zuerst – der häufigste Grund für "kein Standort"
  try {
    const perm = await Location.getForegroundPermissionsAsync();
    if (!perm.granted) {
      if (perm.canAskAgain) {
        const asked = await Location.requestForegroundPermissionsAsync();
        if (!asked.granted) return;
      } else {
        void Linking.openSettings();
        return;
      }
    }
  } catch {
    // Weiter zu den Standortdiensten
  }

  if (Platform.OS !== 'android') {
    void Linking.openSettings();
    return;
  }

  // 2) Standortdienste (GPS-Schalter)
  let enabled = await Location.hasServicesEnabledAsync().catch(() => false);
  if (enabled) return;
  try {
    await Location.enableNetworkProviderAsync();
  } catch {
    // Nutzer hat abgelehnt oder der Dialog ist nicht verfügbar
  }
  enabled = await Location.hasServicesEnabledAsync().catch(() => false);
  if (!enabled) {
    // Ohne Play-Services-Dialog: die System-Standorteinstellungen öffnen
    try {
      await IntentLauncher.startActivityAsync(
        IntentLauncher.ActivityAction.LOCATION_SOURCE_SETTINGS,
      );
    } catch {
      void Linking.openSettings();
    }
  }
}
