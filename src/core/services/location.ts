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
 * Standort direkt aus der App heraus aktivieren: auf Android öffnet
 * enableNetworkProviderAsync den System-Dialog ("Standort aktivieren?");
 * schlägt das fehl (oder iOS), bleiben nur die App-Einstellungen.
 */
export async function promptEnableLocation(): Promise<void> {
  if (Platform.OS === 'android') {
    try {
      await Location.enableNetworkProviderAsync();
      return;
    } catch {
      // Nutzer hat abgelehnt oder Dialog nicht verfügbar → Einstellungen
    }
  }
  void Linking.openSettings();
}
