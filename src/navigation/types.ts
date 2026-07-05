import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';

export type RootStackParamList = {
  Start: undefined;
  Onboarding: undefined;
  Main: undefined;
  MatchLive: undefined;
  PlayerDetail: { playerId: number };
  Friendlies: undefined;
};

export type MainTabParamList = {
  Map: undefined;
  Squad: undefined;
  League: undefined;
  Packs: undefined;
  Profile: undefined;
};

export type RootScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<
  RootStackParamList,
  T
>;

export type TabScreenProps<T extends keyof MainTabParamList> = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, T>,
  NativeStackScreenProps<RootStackParamList>
>;
