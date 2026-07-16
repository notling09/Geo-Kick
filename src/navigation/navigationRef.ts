import { createNavigationContainerRef, StackActions } from '@react-navigation/native';
import type { RootStackParamList } from './types';

/**
 * Navigations-Referenz außerhalb von Screens (V6): der Online-Store
 * navigiert damit z. B. beim Spielstart in den Live-Ticker oder nach
 * einem Verbindungsabbruch zurück zu den Friendlies.
 */
export const navigationRef = createNavigationContainerRef<RootStackParamList>();

export function navigate<T extends keyof RootStackParamList>(
  name: T,
  params?: RootStackParamList[T],
): void {
  if (navigationRef.isReady()) {
    // @ts-expect-error React Navigation braucht hier ein Tupel, das sich
    // generisch nicht sauber ausdrücken lässt
    navigationRef.navigate(name, params);
  }
}

export function replaceTop<T extends keyof RootStackParamList>(name: T): void {
  if (navigationRef.isReady()) {
    navigationRef.dispatch(StackActions.replace(name));
  }
}
