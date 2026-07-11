import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { FriendliesScreen } from '../features/friends/FriendliesScreen';
import { MapScreen } from '../features/map/MapScreen';
import { SquadScreen } from '../features/squad/SquadScreen';
import { PlayerDetailScreen } from '../features/squad/PlayerDetailScreen';
import { LeagueScreen } from '../features/league/LeagueScreen';
import { MatchLiveScreen } from '../features/league/MatchLiveScreen';
import { PacksScreen } from '../features/packs/PacksScreen';
import { PackOpeningScreen } from '../features/packs/PackOpeningScreen';
import { ProfileScreen } from '../features/profile/ProfileScreen';
import { HelpScreen } from '../features/profile/HelpScreen';
import { StartScreen } from '../features/start/StartScreen';
import { OnboardingScreen } from '../features/onboarding/OnboardingScreen';
import { colors } from '../ui/theme';
import { IconMap, IconPack, IconProfile, IconSquad, IconTrophy, type IconProps } from '../ui/icons';
import type { MainTabParamList, RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tabs = createBottomTabNavigator<MainTabParamList>();

const TAB_ICONS: Record<keyof MainTabParamList, React.ComponentType<IconProps>> = {
  Map: IconMap,
  Squad: IconSquad,
  League: IconTrophy,
  Packs: IconPack,
  Profile: IconProfile,
};

function MainTabs() {
  return (
    <Tabs.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.pitch,
        tabBarInactiveTintColor: colors.inkSoft,
        tabBarLabelStyle: { fontWeight: '700' },
        tabBarIcon: ({ color, size }) => {
          const Icon = TAB_ICONS[route.name as keyof MainTabParamList];
          return <Icon color={color} size={size ?? 24} />;
        },
      })}
    >
      <Tabs.Screen name="Map" component={MapScreen} />
      <Tabs.Screen name="Squad" component={SquadScreen} />
      <Tabs.Screen name="League" component={LeagueScreen} />
      <Tabs.Screen name="Packs" component={PacksScreen} />
      <Tabs.Screen name="Profile" component={ProfileScreen} />
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
      <Stack.Screen name="Friendlies" component={FriendliesScreen} />
      <Stack.Screen
        name="PackOpening"
        component={PackOpeningScreen}
        options={{ gestureEnabled: false, animation: 'fade' }}
      />
      <Stack.Screen name="Help" component={HelpScreen} />
    </Stack.Navigator>
  );
}
