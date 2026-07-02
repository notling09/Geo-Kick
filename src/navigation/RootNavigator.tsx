import React from 'react';
import { Text } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MapScreen } from '../features/map/MapScreen';
import { SquadScreen } from '../features/squad/SquadScreen';
import { PlayerDetailScreen } from '../features/squad/PlayerDetailScreen';
import { LeagueScreen } from '../features/league/LeagueScreen';
import { MatchLiveScreen } from '../features/league/MatchLiveScreen';
import { PacksScreen } from '../features/packs/PacksScreen';
import { ProfileScreen } from '../features/profile/ProfileScreen';
import { StartScreen } from '../features/start/StartScreen';
import { OnboardingScreen } from '../features/onboarding/OnboardingScreen';
import { colors } from '../ui/theme';
import type { MainTabParamList, RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tabs = createBottomTabNavigator<MainTabParamList>();

const TAB_ICONS: Record<keyof MainTabParamList, string> = {
  Karte: '🗺️',
  Kader: '👥',
  Liga: '🏆',
  Packs: '🎁',
  Profil: '🙋',
};

function MainTabs() {
  return (
    <Tabs.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.pitch,
        tabBarInactiveTintColor: colors.inkSoft,
        tabBarLabelStyle: { fontWeight: '700' },
        tabBarIcon: ({ focused }) => (
          <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.55 }}>
            {TAB_ICONS[route.name as keyof MainTabParamList]}
          </Text>
        ),
      })}
    >
      <Tabs.Screen name="Karte" component={MapScreen} />
      <Tabs.Screen name="Kader" component={SquadScreen} />
      <Tabs.Screen name="Liga" component={LeagueScreen} />
      <Tabs.Screen name="Packs" component={PacksScreen} />
      <Tabs.Screen name="Profil" component={ProfileScreen} />
    </Tabs.Navigator>
  );
}

export function RootNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName="Start">
      <Stack.Screen name="Start" component={StartScreen} />
      <Stack.Screen name="Onboarding" component={OnboardingScreen} />
      <Stack.Screen name="Main" component={MainTabs} />
      <Stack.Screen
        name="MatchLive"
        component={MatchLiveScreen}
        options={{ gestureEnabled: false }}
      />
      <Stack.Screen name="PlayerDetail" component={PlayerDetailScreen} />
    </Stack.Navigator>
  );
}
