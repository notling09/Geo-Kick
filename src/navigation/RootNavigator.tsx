import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { FriendliesScreen } from '../features/friends/FriendliesScreen';
import { MapScreen } from '../features/map/MapScreen';
import { SquadScreen } from '../features/squad/SquadScreen';
import { PlayerDetailScreen } from '../features/squad/PlayerDetailScreen';
import { LeagueScreen } from '../features/league/LeagueScreen';
import { LeaderboardScreen } from '../features/league/LeaderboardScreen';
import { ChampionsLeagueScreen } from '../features/league/ChampionsLeagueScreen';
import { MatchLiveScreen } from '../features/league/MatchLiveScreen';
import { PacksScreen } from '../features/packs/PacksScreen';
import { PackOpeningScreen } from '../features/packs/PackOpeningScreen';
import { ProfileScreen } from '../features/profile/ProfileScreen';
import { HelpScreen } from '../features/profile/HelpScreen';
import { PassportScreen } from '../features/profile/PassportScreen';
import { TrophiesScreen } from '../features/profile/TrophiesScreen';
import { PenaltyShootoutScreen } from '../features/map/PenaltyShootoutScreen';
import { SeasonReviewScreen } from '../features/league/SeasonReviewScreen';
import { OnlineLobbyScreen } from '../features/friends/OnlineLobbyScreen';
import { OnlineShootoutScreen } from '../features/friends/OnlineShootoutScreen';
import { StartScreen } from '../features/start/StartScreen';
import { OnboardingScreen } from '../features/onboarding/OnboardingScreen';
import { t, type TKey } from '../core/i18n';
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

const TAB_LABELS: Record<keyof MainTabParamList, TKey> = {
  Map: 'mapTitle',
  Squad: 'sqTitle',
  League: 'lgTitle',
  Packs: 'pkTitle',
  Profile: 'prTitle',
};

function MainTabs() {
  return (
    <Tabs.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.pitch,
        tabBarInactiveTintColor: colors.inkSoft,
        tabBarLabel: t(TAB_LABELS[route.name as keyof MainTabParamList]),
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
      <Stack.Screen name="Passport" component={PassportScreen} />
      <Stack.Screen name="Trophies" component={TrophiesScreen} />
      <Stack.Screen
        name="Shootout"
        component={PenaltyShootoutScreen}
        options={{ gestureEnabled: false, animation: 'fade' }}
      />
      <Stack.Screen
        name="SeasonReview"
        component={SeasonReviewScreen}
        options={{ gestureEnabled: false, animation: 'fade' }}
      />
      <Stack.Screen name="Leaderboard" component={LeaderboardScreen} />
      <Stack.Screen name="ChampionsLeague" component={ChampionsLeagueScreen} />
      <Stack.Screen name="OnlineLobby" component={OnlineLobbyScreen} />
      <Stack.Screen
        name="OnlineShootout"
        component={OnlineShootoutScreen}
        options={{ gestureEnabled: false, animation: 'fade' }}
      />
    </Stack.Navigator>
  );
}
