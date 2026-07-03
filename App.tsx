import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RootNavigator } from './src/navigation/RootNavigator';
import { LoadingScreen } from './src/features/start/LoadingScreen';
import { useGameStore } from './src/state/gameStore';
import { useLeagueStore } from './src/state/leagueStore';
import { useSessionStore } from './src/state/sessionStore';

/**
 * App-Start-Flow (Kapitel 2.3):
 * 1. Loading-Screen, während SQLite initialisiert und Stores hydriert werden
 * 2. Start-Screen mit "Click to Start"
 * 3. Onboarding (Ersteinstieg) bzw. Haupt-Tabs
 */
export default function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      // Mindestanzeigedauer, damit der Loading-Screen sichtbar bleibt (Kapitel 2.3)
      const minSplash = new Promise((resolve) => setTimeout(resolve, 1800));
      await useGameStore.getState().init();
      if (useGameStore.getState().onboarded) {
        await Promise.all([
          useLeagueStore.getState().hydrate(),
          useSessionStore.getState().hydrate(),
        ]);
      }
      await minSplash;
      setReady(true);
    })();
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      {ready ? (
        <NavigationContainer>
          <RootNavigator />
        </NavigationContainer>
      ) : (
        <LoadingScreen />
      )}
    </SafeAreaProvider>
  );
}
