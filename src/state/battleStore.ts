import * as Location from 'expo-location';
import { create } from 'zustand';
import { PITCH_BATTLE, USER_CLUB_ID } from '../core/domain/constants';
import type { Spot } from '../core/domain/types';
import { generateNpcRoster } from '../core/engine/league';
import { simulateMatch } from '../core/engine/matchSim';
import {
  dayKey, pitchOpponent, specialSpotIdForDay, type PitchOpponent,
} from '../core/engine/pitchBattle';
import { teamStrength } from '../core/engine/strength';
import { distanceMeters } from '../core/services/geo';
import * as metaRepo from '../core/db/repositories/metaRepo';
import { useGameStore } from './gameStore';
import { useLeagueStore, type PlayedUserMatch } from './leagueStore';

/**
 * Platz-Kämpfe (V4): An jedem Platz wartet ein Gegner-Team – herausfordern
 * kann man es nur vor Ort (GPS-Check), einmal pro Platz und Tag. Belohnung
 * (Coins + Level-up-Punkte in gleicher Höhe) gibt es nur für einen Sieg.
 * Der besondere Platz des Tages hat stattdessen ein starkes Boss-Team mit
 * großer Belohnung. Kein Einfluss auf die Liga (wie ein Freundschaftsspiel).
 */

export type BattleResult =
  | { ok: true; played: PlayedUserMatch; won: boolean }
  | {
      ok: false;
      reason: 'permission' | 'mocked' | 'too_far' | 'already_fought' | 'no_location' | 'no_club';
      detail?: string;
    };

/** Remis nach 90 Min → Elfmeterschießen (V4): alles, was der Screen braucht. */
export interface ShootoutSetup {
  isBoss: boolean;
  opponentName: string;
  /** Eigene Schützen (Start-Elf, beste Abschluss-Werte zuerst) */
  userShooters: string[];
  /** Gegnerische Schützen (derselbe Kader wie im Ticker) */
  oppShooters: string[];
}

interface BattleState {
  day: string;
  foughtSpotIds: string[];
  /** Steht ein Elfmeterschießen aus (Kampf endete 90 Min unentschieden)? */
  pendingShootout: ShootoutSetup | null;

  hydrate: () => Promise<void>;
  /** Der besondere Boss-/Gold-Platz des heutigen Tages. */
  specialSpotId: (spots: Spot[]) => string | null;
  opponentFor: (spot: Spot, isBoss: boolean) => PitchOpponent;
  canFight: (spotId: string) => boolean;
  fight: (spot: Spot, isBoss: boolean) => Promise<BattleResult>;
  /**
   * Elfmeterschießen beenden: Sieg vergibt die Kampf-Belohnung (Session-Pack
   * bzw. Boss-Coins+Punkte) und liefert den Anzeigetext; Niederlage null.
   */
  resolveShootout: (won: boolean) => Promise<string | null>;
  /** Abbruch (Screen verlassen): kein Reward, Zustand aufräumen. */
  abandonShootout: () => void;
}

async function persist(day: string, foughtSpotIds: string[]): Promise<void> {
  await metaRepo.setMeta('pitchBattles', JSON.stringify({ day, fought: foughtSpotIds }));
}

/** Tageswechsel prüfen: neue Kämpfe für alle Plätze freischalten. */
function rolledOver(state: { day: string; foughtSpotIds: string[] }): {
  day: string;
  foughtSpotIds: string[];
} {
  const today = dayKey();
  return state.day === today ? state : { day: today, foughtSpotIds: [] };
}

export const useBattleStore = create<BattleState>((set, get) => ({
  day: dayKey(),
  foughtSpotIds: [],
  pendingShootout: null,

  hydrate: async () => {
    const raw = await metaRepo.getMeta('pitchBattles');
    let state = { day: dayKey(), foughtSpotIds: [] as string[] };
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as { day: string; fought: string[] };
        state = rolledOver({ day: parsed.day, foughtSpotIds: parsed.fought ?? [] });
      } catch {
        // kaputter Eintrag: frisch starten
      }
    }
    set(state);
  },

  specialSpotId: (spots) =>
    specialSpotIdForDay(
      spots.map((s) => s.id),
      dayKey(),
    ),

  opponentFor: (spot, isBoss) => {
    const game = useGameStore.getState();
    const strength = teamStrength(game.lineupPlayers(), game.club?.formation ?? '4-4-2');
    return pitchOpponent(spot.id, dayKey(), strength, isBoss);
  },

  canFight: (spotId) => {
    const state = rolledOver(get());
    return !state.foughtSpotIds.includes(spotId);
  },

  fight: async (spot, isBoss) => {
    // Tageswechsel berücksichtigen, dann Tageslimit prüfen
    const state = rolledOver(get());
    if (state.foughtSpotIds.includes(spot.id)) {
      return { ok: false, reason: 'already_fought' };
    }
    const game = useGameStore.getState();
    const club = game.club;
    if (!club) return { ok: false, reason: 'no_club' };

    // Vor-Ort-Prüfung: gleiche Regeln wie beim Check-in
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return { ok: false, reason: 'permission' };
    let pos: Location.LocationObject;
    try {
      pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    } catch {
      return { ok: false, reason: 'no_location' };
    }
    if (pos.mocked) return { ok: false, reason: 'mocked' };
    const dist = distanceMeters(
      pos.coords.latitude, pos.coords.longitude, spot.latitude, spot.longitude,
    );
    if (dist > spot.radius) {
      return { ok: false, reason: 'too_far', detail: `${Math.round(dist)} m` };
    }

    const opponent = get().opponentFor(spot, isBoss);
    const lineup = game.lineupPlayers();
    const userRoster = lineup
      .filter((p): p is NonNullable<typeof p> => p !== null)
      .map((p) => ({ name: p.pool.name, position: p.pool.position }));
    const oppRoster = generateNpcRoster();

    const result = simulateMatch(
      {
        name: club.name,
        strength: teamStrength(lineup, club.formation),
        tactic: club.tactic,
        roster: userRoster,
      },
      {
        name: opponent.name,
        strength: opponent.strength,
        tactic: 'ausgewogen',
        roster: oppRoster,
      },
    );

    // Versuch verbraucht – unabhängig vom Ausgang (1 Kampf pro Platz und Tag)
    const foughtSpotIds = [...state.foughtSpotIds, spot.id];
    await persist(state.day, foughtSpotIds);
    set({ day: state.day, foughtSpotIds });

    // Belohnung: Sieg = Session-Pack (Boss: Coins+Punkte), Niederlage = nichts.
    // Remis gibt es nicht: nach 90 Minuten geht es ins Elfmeterschießen.
    const won = result.homeGoals > result.awayGoals;
    const draw = result.homeGoals === result.awayGoals;
    let coinReward: PlayedUserMatch['coinReward'];
    if (won && isBoss) {
      const reward = PITCH_BATTLE.bossWinReward;
      await game.addCoins(reward);
      await game.addLevelPoints(reward);
      coinReward = {
        total: reward,
        breakdown: [`Boss beaten +${reward} coins`, `+${reward} level-up points`],
      };
    } else if (won) {
      await game.grantPack('session');
      coinReward = { total: 0, breakdown: ['Pitch battle won: +1 session pack'] };
    }

    if (draw) {
      // Schützen fürs Elfmeterschießen: eigene Elf nach Abschluss sortiert,
      // Gegner mit denselben Namen wie im Ticker
      const userShooters = lineup
        .filter((p): p is NonNullable<typeof p> => p !== null)
        .sort((a, b) => b.pool.abschluss - a.pool.abschluss)
        .map((p) => p.pool.name);
      set({
        pendingShootout: {
          isBoss,
          opponentName: opponent.name,
          userShooters: userShooters.length > 0 ? userShooters : ['Your player'],
          oppShooters: oppRoster.map((r) => r.name),
        },
      });
    } else {
      set({ pendingShootout: null });
    }

    const played: PlayedUserMatch = {
      match: {
        id: 0,
        season: 0,
        division: 0,
        round: 0,
        homeId: USER_CLUB_ID,
        awayId: `battle-${spot.id}`,
        homeGoals: result.homeGoals,
        awayGoals: result.awayGoals,
        played: true,
        events: result.events,
      },
      homeName: club.name,
      awayName: opponent.name,
      homeCrest: club.crest,
      awayCrest: 'crest-7',
      userIsHome: true,
      stats: result.stats,
      coinReward,
      motm: result.motm,
    };
    // Live-Ticker-Replay über den bestehenden MatchLive-Screen
    useLeagueStore.setState({ lastPlayedMatch: played });
    return { ok: true, played, won };
  },

  resolveShootout: async (won) => {
    const pending = get().pendingShootout;
    set({ pendingShootout: null });
    if (!pending || !won) return null;
    const game = useGameStore.getState();
    if (pending.isBoss) {
      const reward = PITCH_BATTLE.bossWinReward;
      await game.addCoins(reward);
      await game.addLevelPoints(reward);
      return `Boss beaten: +${reward} coins and +${reward} level-up points!`;
    }
    await game.grantPack('session');
    return 'You won a session pack!';
  },

  abandonShootout: () => set({ pendingShootout: null }),
}));
