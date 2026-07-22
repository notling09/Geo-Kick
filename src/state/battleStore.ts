import * as Location from 'expo-location';
import { create } from 'zustand';
import { PITCH_BATTLE, USER_CLUB_ID } from '../core/domain/constants';
import type { Spot } from '../core/domain/types';
import { t, tf } from '../core/i18n';
import { generateNpcRoster } from '../core/engine/league';
import type { SimTeam } from '../core/engine/matchSim';
import {
  dayKey, pitchOpponent, specialSpotIdForDay, type PitchOpponent,
} from '../core/engine/pitchBattle';
import { teamStrength } from '../core/engine/strength';
import { distanceMeters } from '../core/services/geo';
import { getPositionWithTimeout } from '../core/services/location';
import * as metaRepo from '../core/db/repositories/metaRepo';
import { useGameStore } from './gameStore';
import { useLeagueStore, type PlayedUserMatch } from './leagueStore';
import { runUserMatch } from './matchFlow';

/**
 * Platz-Kämpfe (V4): An jedem Platz wartet ein Gegner-Team – herausfordern
 * kann man es nur vor Ort (GPS-Check), einmal pro Platz und Tag. Belohnung
 * (Coins + Level-up-Punkte in gleicher Höhe) gibt es nur für einen Sieg.
 * Der besondere Platz des Tages hat stattdessen ein starkes Boss-Team mit
 * großer Belohnung. Kein Einfluss auf die Liga (wie ein Freundschaftsspiel).
 */

export type BattleResult =
  | { ok: true }
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
  /** Der Gold-/Boss-Platz des Tages (immer im Umkreis des Nutzers, V5) */
  specialSpotId: string | null;
  /** Steht ein Elfmeterschießen aus (Kampf endete 90 Min unentschieden)? */
  pendingShootout: ShootoutSetup | null;
  /**
   * Boss besiegt (V7): die Belohnung ist noch offen – der Nutzer wählt im
   * Screen zwischen Coins+Punkten und 2 Session-Packs (claimBossReward).
   */
  pendingBossReward: boolean;

  hydrate: () => Promise<void>;
  /**
   * Gold-Platz bestimmen/aktualisieren (V5): unter den Plätzen im Umkreis
   * von ~20 km um die aktuelle Position. Reist der Nutzer weiter weg (z. B.
   * Bern → Genf), wird ein neuer Gold-Platz in der neuen Umgebung gewählt.
   * Der gewählte Platz wird gespeichert, damit auch der Session-Check-out
   * (doppelte Coins) denselben Platz benutzt.
   */
  ensureSpecialSpot: (
    spots: Spot[],
    myPos: { latitude: number; longitude: number } | null,
  ) => Promise<void>;
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
  /** Boss-Belohnung wählen (V7): Coins+Punkte oder 2 Session-Packs. */
  claimBossReward: (choice: 'coins' | 'packs') => Promise<string>;
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

/** Umkreis, in dem der Gold-Platz des Tages liegen muss (V5) */
const SPECIAL_RANGE_M = 20000;

export const useBattleStore = create<BattleState>((set, get) => ({
  day: dayKey(),
  foughtSpotIds: [],
  specialSpotId: null,
  pendingShootout: null,
  pendingBossReward: false,

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
    // Gespeicherten Gold-Platz laden (gilt nur für heute)
    let specialSpotId: string | null = null;
    try {
      const stored = JSON.parse((await metaRepo.getMeta('specialSpot')) || 'null') as
        | { day: string; spotId: string }
        | null;
      if (stored && stored.day === dayKey()) specialSpotId = stored.spotId;
    } catch {
      specialSpotId = null;
    }
    // Race-Fix (V6.3): ensureSpecialSpot kann parallel schon einen neuen
    // Gold-Platz für heute gewählt haben – den nie mit einem älteren
    // (gestrigen) Meta-Stand auf null überschreiben, sonst fehlt der Pin
    // den ganzen Tag
    set((prev) => ({ ...state, specialSpotId: specialSpotId ?? prev.specialSpotId }));
  },

  ensureSpecialSpot: async (spots, myPos) => {
    if (spots.length === 0) return;
    const today = dayKey();
    const inRange = (s: Spot) =>
      !myPos ||
      distanceMeters(myPos.latitude, myPos.longitude, s.latitude, s.longitude) <= SPECIAL_RANGE_M;
    const candidates = spots.filter(inRange);
    const current = get().specialSpotId;
    const currentSpot = spots.find((s) => s.id === current);
    // Aktueller Gold-Platz bleibt gültig, solange er heute gewählt wurde und
    // (noch) in der Nähe liegt
    if (get().day === today && currentSpot && inRange(currentSpot)) return;
    // Kein Platz im Umkreis (z. B. gecachte Plätze aus einer anderen Stadt):
    // dann den nächstgelegenen nehmen, damit der Gold-Pin nie außer
    // Reichweite liegt (V6.3). Ohne Position bleiben alle Plätze im Topf –
    // auch selbst hinzugefügte Plätze (source 'user') können golden werden.
    let pickFrom = candidates;
    if (pickFrom.length === 0 && myPos) {
      const nearest = [...spots].sort(
        (a, b) =>
          distanceMeters(myPos.latitude, myPos.longitude, a.latitude, a.longitude) -
          distanceMeters(myPos.latitude, myPos.longitude, b.latitude, b.longitude),
      )[0];
      pickFrom = nearest ? [nearest] : spots;
    }
    if (pickFrom.length === 0) pickFrom = spots;
    // Zuletzt gewählten Gold-Platz laden und ausschließen → garantierte
    // Tages-Rotation (V7). An einem neuen Tag ist das der gestrige Platz.
    let lastId: string | null = null;
    try {
      const stored = JSON.parse((await metaRepo.getMeta('specialSpot')) || 'null') as
        | { day: string; spotId: string }
        | null;
      lastId = stored?.spotId ?? null;
    } catch {
      lastId = null;
    }
    const specialSpotId = specialSpotIdForDay(pickFrom.map((s) => s.id), today, lastId);
    if (!specialSpotId) return;
    await metaRepo.setMeta('specialSpot', JSON.stringify({ day: today, spotId: specialSpotId }));
    set({ specialSpotId });
  },

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
    // Mit Zeitlimit (V6.3): sonst hängt der Kampf-Button bei GPS-Problemen
    const pos = await getPositionWithTimeout(Location.Accuracy.High);
    if (!pos) return { ok: false, reason: 'no_location' };
    if (pos.mocked) return { ok: false, reason: 'mocked' };
    const dist = distanceMeters(
      pos.coords.latitude, pos.coords.longitude, spot.latitude, spot.longitude,
    );
    if (dist > spot.radius) {
      return { ok: false, reason: 'too_far', detail: `${Math.round(dist)} m` };
    }

    const opponent = get().opponentFor(spot, isBoss);
    const oppRoster = generateNpcRoster();
    const oppTeam: SimTeam = {
      name: opponent.name,
      strength: opponent.strength,
      tactic: 'ausgewogen',
      roster: oppRoster,
    };

    // Versuch verbraucht – unabhängig vom Ausgang (1 Kampf pro Platz und Tag)
    const foughtSpotIds = [...state.foughtSpotIds, spot.id];
    await persist(state.day, foughtSpotIds);
    set({ day: state.day, foughtSpotIds, pendingShootout: null });

    const baseMatch = {
      id: 0,
      season: 0,
      division: 0,
      round: 0,
      homeId: USER_CLUB_ID,
      awayId: `battle-${spot.id}`,
    };
    const buildUserTeam = async (t: Parameters<typeof game.setTactic>[0]): Promise<SimTeam> => {
      const g = useGameStore.getState();
      await g.setTactic(t);
      const lineupNow = g.lineupPlayers();
      return {
        name: club.name,
        strength: teamStrength(lineupNow, g.club?.formation ?? club.formation),
        tactic: t,
        roster: lineupNow
          .filter((p): p is NonNullable<typeof p> => p !== null)
          .map((p) => ({ name: p.pool.name, position: p.pool.position })),
        captainName: g.players.find((p) => p.id === g.captainPlayerId)?.pool.name,
      };
    };

    // Live-Spiel (V5): pausiert bei Elfmetern und zur Halbzeit
    await runUserMatch({
      userIsHome: true,
      opponent: oppTeam,
      initialTactic: club.tactic,
      buildUserTeam,
      publish: (st, pause) =>
        useLeagueStore.setState({
          lastPlayedMatch: {
            match: {
              ...baseMatch,
              homeGoals: st.homeGoals,
              awayGoals: st.awayGoals,
              played: false,
              events: st.events,
            },
            homeName: club.name,
            awayName: opponent.name,
            homeCrest: club.crest,
            awayCrest: 'crest-7',
            userIsHome: true,
            pause,
          },
        }),
      finalize: async (result) => {
        const g2 = useGameStore.getState();
        // Belohnung: Sieg = Session-Pack (Boss: Coins+Punkte), Niederlage =
        // nichts. Remis gibt es nicht: es folgt das Elfmeterschießen.
        const won = result.homeGoals > result.awayGoals;
        const draw = result.homeGoals === result.awayGoals;
        let coinReward: PlayedUserMatch['coinReward'];
        if (won && isBoss) {
          // V7: Belohnung erst nach dem Abpfiff wählen (Coins+Punkte / 2 Packs)
          set({ pendingBossReward: true });
          coinReward = { total: 0, breakdown: [t('bossRewardChoose')] };
        } else if (won) {
          await g2.grantPack('session');
          coinReward = { total: 0, breakdown: [t('rewardBattlePack')] };
        }

        if (draw) {
          // Schützen fürs Elfmeterschießen: aktuelle Elf nach Abschluss
          // sortiert, Gegner mit denselben Namen wie im Ticker
          const userShooters = g2
            .lineupPlayers()
            .filter((p): p is NonNullable<typeof p> => p !== null)
            .sort((a, b) => b.pool.abschluss - a.pool.abschluss)
            .map((p) => p.pool.name);
          set({
            pendingShootout: {
              isBoss,
              opponentName: opponent.name,
              userShooters: userShooters.length > 0 ? userShooters : ['Your player'],
              oppShooters: (oppTeam.roster ?? oppRoster).map((r) => r.name),
            },
          });
        }

        useLeagueStore.setState({
          lastPlayedMatch: {
            match: {
              ...baseMatch,
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
          },
        });
      },
    });

    return { ok: true };
  },

  resolveShootout: async (won) => {
    const pending = get().pendingShootout;
    set({ pendingShootout: null });
    if (!pending || !won) return null;
    const game = useGameStore.getState();
    if (pending.isBoss) {
      // V7: Boss-Belohnung wählt der Screen (pendingBossReward), kein Fixtext
      set({ pendingBossReward: true });
      return null;
    }
    await game.grantPack('session');
    return t('soRewardPack');
  },

  abandonShootout: () => set({ pendingShootout: null }),

  claimBossReward: async (choice) => {
    if (!get().pendingBossReward) return '';
    set({ pendingBossReward: false });
    const game = useGameStore.getState();
    if (choice === 'packs') {
      await game.grantPack('session');
      await game.grantPack('session');
      return t('bossRewardGotPacks');
    }
    const reward = PITCH_BATTLE.bossWinReward;
    await game.addCoins(reward);
    await game.addLevelPoints(reward);
    return tf('bossRewardGotCoins', { n: reward });
  },
}));
