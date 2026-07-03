/** Zentrale Domain-Typen für Geo-Kick (siehe Konzeptdokument Kapitel 4). */

export type Position = 'TW' | 'ABW' | 'MF' | 'ST';

export type Rarity = 'bronze' | 'silber' | 'gold' | 'legendaer';

export type FormationId = '4-4-2' | '4-3-3' | '5-3-2';

export type Tactic = 'offensiv' | 'ausgewogen' | 'defensiv';

export interface Attributes {
  tempo: number;
  technik: number;
  abschluss: number;
  verteidigung: number;
  kondition: number;
}

/** Eine fiktive Spieler-Identität aus dem generierten Pool (Duplikate möglich). */
export interface PoolPlayer extends Attributes {
  id: number;
  name: string;
  position: Position;
  rarity: Rarity;
  /** 1 = einer der drei wählbaren Starter-Flügelspieler */
  isStarterChoice: boolean;
  /** 1 = schwacher Füllspieler des Start-Kaders (nicht in Packs ziehbar) */
  isFiller: boolean;
}

/** Ein Spieler im Besitz des Nutzers. */
export interface OwnedPlayer {
  id: number;
  poolId: number;
  level: number;
  acquiredAt: number;
  pool: PoolPlayer;
}

export interface Club {
  name: string;
  crest: string;
  division: number; // 4 (unten) .. 1 (oben)
  coins: number;
  formation: FormationId;
  tactic: Tactic;
}

export interface Spot {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius: number;
  source: 'osm' | 'user';
  cooldownUntil: number; // epoch ms, 0 = kein Cooldown
}

export interface Session {
  id: number;
  spotId: string;
  startTime: number;
  endTime: number | null;
  coins: number;
  packGranted: boolean;
}

export interface Pack {
  id: number;
  createdAt: number;
  openedAt: number | null;
  /** 'session' oder 'shop-<packTypeId>' (bestimmt die Ziehungs-Quoten) */
  source: string;
  /** poolIds der gezogenen Spieler, erst nach dem Öffnen gefüllt */
  content: number[];
}

export interface NpcClub {
  id: number;
  name: string;
  crest: string;
  strength: number;
  division: number;
  season: number;
}

export type MatchEventType = 'tor' | 'chance' | 'ecke' | 'foul' | 'anpfiff' | 'halbzeit' | 'abpfiff';

export interface MatchEvent {
  minute: number;
  type: MatchEventType;
  /** 'home' | 'away' – bei neutralen Events (Anpfiff etc.) undefined */
  team?: 'home' | 'away';
  text: string;
  /** Torschütze (bei type 'tor'), für die Topscorer-Tabelle */
  player?: string;
  /** Vorlagengeber (bei type 'tor'), für die Assist-Tabelle */
  assist?: string;
}

export interface Match {
  id: number;
  season: number;
  division: number;
  round: number;
  homeId: string; // 'user' oder NPC-Id als String
  awayId: string;
  homeGoals: number;
  awayGoals: number;
  played: boolean;
  events: MatchEvent[];
}

export interface StandingRow {
  clubId: string;
  name: string;
  crest: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
}

export interface LeagueState {
  season: number;
  round: number; // nächste zu spielende Runde (1-basiert)
  nextMatchAt: number; // epoch ms, ab wann das nächste Spiel verfügbar ist
}
