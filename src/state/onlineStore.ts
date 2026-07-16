import { Alert } from 'react-native';
import { create } from 'zustand';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { MatchEvent, Position, Tactic } from '../core/domain/types';
import {
  simulateFirstHalf, simulateSecondHalf, type HalfTimeState, type MatchMotm, type SimTeam,
} from '../core/engine/matchSim';
import { shootoutWinner, type ShootoutKick } from '../core/engine/shootout';
import { teamStrength } from '../core/engine/strength';
import { getSupabase } from '../core/services/cloud';
import type { MatchStats } from '../core/domain/types';
import * as metaRepo from '../core/db/repositories/metaRepo';
import { navigate } from '../navigation/navigationRef';
import { useFriendsStore } from './friendsStore';
import { useGameStore } from './gameStore';
import { useLeagueStore } from './leagueStore';
import { registerPauseHandlers } from './matchFlow';
import type { TargetId, PenaltyOutcome } from '../ui/PenaltyGoal';

/**
 * Online-Friendlies (V6): zwei Freunde spielen LIVE dasselbe Spiel.
 *
 * Technik: Supabase Realtime (Broadcast + Presence, keine neuen Tabellen).
 *  - Jeder Client lauscht auf seinem persönlichen Kanal gk-user-<id> auf
 *    Einladungen (beide Spieler müssen online sein).
 *  - Ein Match läuft über den Kanal gk-match-<id>: Lobby mit beidseitigem
 *    Ready, dann simuliert der HOST (der Einladende) das Spiel und sendet
 *    es als Segmente – beide sehen exakt denselben Ticker.
 *  - Halbzeit: beide stellen um und drücken Ready; der Host simuliert die
 *    2. Hälfte erst, wenn beide bereit sind.
 *  - Remis: FIFA-Elfmeterschießen Spieler gegen Spieler – der Schütze wählt
 *    zuerst, erst danach darf der Torwart seine Ecke wählen.
 *  - Kein Coin-/Pack-Reward, nur die lokale Siegbilanz pro Freund.
 */

export interface OnlineClub {
  userId: string;
  name: string;
  crest: string;
  strength: number;
  tactic: Tactic;
  roster: Array<{ name: string; position: Position }>;
}

type Role = 'host' | 'guest';
type Phase = 'idle' | 'lobby' | 'playing' | 'shootout' | 'done';

export interface OnlineShootoutView {
  /** side 'A' = Host (schießt zuerst) */
  kicks: ShootoutKick[];
  turnRole: Role;
  shooter: string;
  keeper: string;
  stage: 'pick' | 'await-dive' | 'result';
  lastResult: PenaltyOutcome | null;
  winnerRole: Role | null;
}

interface OnlineState {
  phase: Phase;
  myRole: Role | null;
  opponent: OnlineClub | null;
  myReady: boolean;
  oppReady: boolean;
  /** Halbzeit: eigenes Ready gesendet, warten auf den Gegner */
  waitingHalf: boolean;
  shootout: OnlineShootoutView | null;

  init: () => Promise<void>;
  invite: (friendUserId: string, friendName: string) => Promise<boolean>;
  setReady: () => void;
  sendShot: (target: TargetId) => void;
  sendDive: (target: TargetId) => void;
  leave: () => void;
}

/* ------------------------- Modul-Zustand (Verbindung) ------------------------- */

let myUserId: string | null = null;
let personalChannel: RealtimeChannel | null = null;
let matchChannel: RealtimeChannel | null = null;
let matchId: string | null = null;
let lineupSnapshot: Array<number | null> | null = null;

/** Host-Simulation */
let halfState: HalfTimeState | null = null;
let hostClubStart: OnlineClub | null = null;
let guestClubStart: OnlineClub | null = null;
let hostClubHalf: OnlineClub | null = null;
let guestClubHalf: OnlineClub | null = null;
/** Host-Shootout */
let soKicks: ShootoutKick[] = [];
let soShot: TargetId | null = null;
let soTurnRole: Role = 'host';
let recordsDone = false;

function toSimTeam(club: OnlineClub): SimTeam {
  return {
    name: club.name,
    strength: club.strength,
    tactic: club.tactic,
    roster: club.roster,
  };
}

function myClub(tactic?: Tactic): OnlineClub {
  const g = useGameStore.getState();
  const lineup = g.lineupPlayers();
  return {
    userId: myUserId ?? '',
    name: g.club?.name ?? 'My Club',
    crest: g.club?.crest ?? 'crest-0',
    strength: teamStrength(lineup, g.club?.formation ?? '4-4-2'),
    tactic: tactic ?? g.club?.tactic ?? 'ausgewogen',
    roster: lineup
      .filter((p): p is NonNullable<typeof p> => p !== null)
      .map((p) => ({ name: p.pool.name, position: p.pool.position })),
  };
}

/** Schützen-/Torwart-Namen fürs Shootout aus dem Kader. */
function shooterOf(club: OnlineClub, index: number): string {
  const takers = club.roster.filter((p) => p.position !== 'TW');
  const pool = takers.length > 0 ? takers : club.roster;
  return pool.length > 0 ? pool[index % pool.length].name : club.name;
}

function keeperOf(club: OnlineClub): string {
  return club.roster.find((p) => p.position === 'TW')?.name ?? club.name;
}

async function updateRecord(outcome: 'w' | 'd' | 'l', friendId: string): Promise<void> {
  if (recordsDone) return;
  recordsDone = true;
  const records = { ...useFriendsStore.getState().records };
  const rec = records[friendId] ?? { w: 0, d: 0, l: 0 };
  rec[outcome]++;
  records[friendId] = rec;
  await metaRepo.setMeta('friendlyRecords', JSON.stringify(records));
  useFriendsStore.setState({ records });
}

export const useOnlineStore = create<OnlineState>((set, get) => {
  /** Broadcast mit Absender-Id; eigene Nachrichten werden beim Empfang ignoriert. */
  const send = (event: string, payload: Record<string, unknown> = {}) => {
    void matchChannel?.send({
      type: 'broadcast',
      event,
      payload: { ...payload, senderId: myUserId },
    });
  };

  const cleanup = async () => {
    const supabase = getSupabase();
    if (matchChannel && supabase) await supabase.removeChannel(matchChannel);
    matchChannel = null;
    matchId = null;
    halfState = null;
    hostClubStart = guestClubStart = hostClubHalf = guestClubHalf = null;
    soKicks = [];
    soShot = null;
    recordsDone = false;
    // Aufstellung von vor dem Online-Spiel wiederherstellen (wie offline)
    if (lineupSnapshot) {
      const snap = lineupSnapshot;
      lineupSnapshot = null;
      const g = useGameStore.getState();
      if (snap.some((id, slot) => g.lineup[slot] !== id)) await g.restoreLineup(snap);
    }
    set({
      phase: 'idle',
      myRole: null,
      opponent: null,
      myReady: false,
      oppReady: false,
      waitingHalf: false,
      shootout: null,
    });
  };

  const opponentLeft = () => {
    const phase = get().phase;
    if (phase === 'idle' || phase === 'done') return;
    Alert.alert('Opponent left', 'The connection to your opponent was lost - match cancelled.');
    void cleanup();
    navigate('Friendlies');
  };

  /** Spielstand für den Live-Ticker veröffentlichen (eigene Perspektive). */
  const publishMatch = (
    events: MatchEvent[],
    homeGoals: number,
    awayGoals: number,
    opts: {
      played: boolean;
      pause?: { type: 'halftime' } | undefined;
      stats?: MatchStats;
      motm?: MatchMotm;
    },
  ) => {
    const meHost = get().myRole === 'host';
    const opp = get().opponent;
    const g = useGameStore.getState();
    const myName = g.club?.name ?? 'My Club';
    const myCrest = g.club?.crest ?? 'crest-0';
    useLeagueStore.setState({
      lastPlayedMatch: {
        match: {
          id: 0,
          season: 0,
          division: 0,
          round: 0,
          homeId: meHost ? 'user' : 'online',
          awayId: meHost ? 'online' : 'user',
          homeGoals,
          awayGoals,
          played: opts.played,
          events,
        },
        homeName: meHost ? myName : opp?.name ?? 'Opponent',
        awayName: meHost ? opp?.name ?? 'Opponent' : myName,
        homeCrest: meHost ? myCrest : opp?.crest ?? 'crest-7',
        awayCrest: meHost ? opp?.crest ?? 'crest-7' : myCrest,
        userIsHome: meHost,
        stats: opts.stats,
        motm: opts.motm,
        pause: opts.pause,
      },
    });
  };

  /** Halbzeit-Ready (beide Seiten): aktuelle Elf + Taktik übertragen. */
  const sendHalfReady = async (tactic: Tactic) => {
    const club = myClub(tactic);
    set({ waitingHalf: true });
    if (get().myRole === 'host') {
      hostClubHalf = club;
      hostTryContinue();
    }
    send('ready', { stage: 'half', club });
  };

  /** Host: 2. Hälfte simulieren, sobald beide bereit sind. */
  const hostTryContinue = () => {
    if (get().myRole !== 'host' || !halfState || !hostClubHalf || !guestClubHalf) return;
    const half = halfState;
    halfState = null;
    // Wechsel-Events beider Seiten aus dem Kader-Diff (Minute 45)
    const pushSubs = (before: OnlineClub | null, after: OnlineClub, side: 'home' | 'away') => {
      if (!before) return;
      const beforeNames = before.roster.map((r) => r.name);
      const afterNames = after.roster.map((r) => r.name);
      const outs = beforeNames.filter((n) => !afterNames.includes(n));
      const ins = afterNames.filter((n) => !beforeNames.includes(n));
      for (let i = 0; i < Math.max(outs.length, ins.length); i++) {
        half.events.push({
          minute: 45,
          type: 'wechsel',
          team: side,
          text: ins[i] && outs[i]
            ? `Substitution (${after.name}): ${ins[i]} ON for ${outs[i]}.`
            : ins[i]
              ? `Substitution (${after.name}): ${ins[i]} comes ON.`
              : `Substitution (${after.name}): ${outs[i]} goes OFF.`,
        });
      }
    };
    pushSubs(hostClubStart, hostClubHalf, 'home');
    pushSubs(guestClubStart, guestClubHalf, 'away');
    const result = simulateSecondHalf(toSimTeam(hostClubHalf), toSimTeam(guestClubHalf), half);
    const draw = result.homeGoals === result.awayGoals;
    const payload = {
      stage: 'full',
      events: result.events,
      homeGoals: result.homeGoals,
      awayGoals: result.awayGoals,
      stats: result.stats,
      motm: result.motm,
      draw,
    };
    handleSegment(payload);
    send('segment', payload);
    if (draw) {
      // Kurz warten, damit beide den Abpfiff im Ticker sehen, dann Runde 1
      setTimeout(() => hostNextTurn(), 3000);
    }
  };

  /** Beide Seiten: ein Spiel-Segment übernehmen. */
  const handleSegment = (payload: any) => {
    if (payload.stage === 'half1') {
      publishMatch(payload.events, payload.homeGoals, payload.awayGoals, {
        played: false,
        pause: { type: 'halftime' },
      });
      set({ phase: 'playing', waitingHalf: false });
      // Resume im Ticker → Ready an den Host statt lokaler Simulation
      registerPauseHandlers({ halftime: sendHalfReady });
      return;
    }
    // Volles Spiel
    publishMatch(payload.events, payload.homeGoals, payload.awayGoals, {
      played: true,
      stats: payload.stats,
      motm: payload.motm,
    });
    set({ waitingHalf: false });
    const opp = get().opponent;
    if (payload.draw) {
      set({ phase: 'shootout' });
    } else {
      const meHost = get().myRole === 'host';
      const myGoals = meHost ? payload.homeGoals : payload.awayGoals;
      const oppGoals = meHost ? payload.awayGoals : payload.homeGoals;
      if (opp) void updateRecord(myGoals > oppGoals ? 'w' : 'l', opp.userId);
      set({ phase: 'done' });
    }
  };

  /** Host: nächste Shootout-Runde ansagen. */
  const hostNextTurn = () => {
    if (get().myRole !== 'host') return;
    const host = hostClubHalf ?? hostClubStart;
    const guest = guestClubHalf ?? guestClubStart;
    if (!host || !guest) return;
    soTurnRole = soKicks.length % 2 === 0 ? 'host' : 'guest';
    const shooterClub = soTurnRole === 'host' ? host : guest;
    const keeperClub = soTurnRole === 'host' ? guest : host;
    const index = soKicks.filter((k) => (soTurnRole === 'host' ? k.side === 'A' : k.side === 'B')).length;
    const payload = {
      kicks: soKicks,
      turnRole: soTurnRole,
      shooter: shooterOf(shooterClub, index),
      keeper: keeperOf(keeperClub),
    };
    handleSoTurn(payload);
    send('so-turn', payload);
  };

  const handleSoTurn = (payload: any) => {
    soShot = null;
    set({
      shootout: {
        kicks: payload.kicks,
        turnRole: payload.turnRole,
        shooter: payload.shooter,
        keeper: payload.keeper,
        stage: 'pick',
        lastResult: null,
        winnerRole: null,
      },
    });
  };

  const handleSoResult = (payload: any) => {
    const view = get().shootout;
    if (!view) return;
    set({
      shootout: {
        ...view,
        kicks: payload.kicks,
        stage: 'result',
        lastResult: { ball: payload.ball, dive: payload.dive, scored: payload.scored },
        winnerRole: payload.winnerRole ?? null,
      },
    });
    if (payload.winnerRole) {
      const opp = get().opponent;
      if (opp) {
        void updateRecord(payload.winnerRole === get().myRole ? 'w' : 'l', opp.userId);
      }
      set({ phase: 'done' });
    } else if (get().myRole === 'host') {
      setTimeout(() => hostNextTurn(), 2200);
    }
  };

  /** Host: Schuss + Hechtsprung auflösen. */
  const hostResolveKick = (dive: TargetId) => {
    if (get().myRole !== 'host' || soShot === null) return;
    const scored = soShot !== dive;
    soKicks = [...soKicks, { side: soTurnRole === 'host' ? 'A' : 'B', scored }];
    const winnerSide = shootoutWinner(soKicks);
    const winnerRole: Role | null = winnerSide === null ? null : winnerSide === 'A' ? 'host' : 'guest';
    const payload = { ball: soShot, dive, scored, kicks: soKicks, winnerRole };
    soShot = null;
    handleSoResult(payload);
    send('so-result', payload);
  };

  /** Match-Kanal beitreten und alle Handler verdrahten. */
  const joinMatch = async (id: string, role: Role): Promise<boolean> => {
    const supabase = getSupabase();
    if (!supabase || !myUserId) return false;
    // Alten Kanal (falls noch offen) sauber schließen
    if (matchChannel) await supabase.removeChannel(matchChannel);
    matchId = id;
    lineupSnapshot = [...useGameStore.getState().lineup];
    recordsDone = false;
    soKicks = [];
    const channel = supabase.channel(`gk-match-${id}`, {
      config: { broadcast: { self: false }, presence: { key: myUserId } },
    });
    matchChannel = channel;

    channel
      .on('broadcast', { event: 'hello' }, ({ payload }) => {
        if (payload.senderId === myUserId) return;
        const club = payload.club as OnlineClub;
        set({ opponent: club });
        if (get().myRole === 'host') {
          guestClubStart = club;
          // Dem Gast antworten, damit er unseren Klub sieht
          send('hello', { club: myClub() });
        }
      })
      .on('broadcast', { event: 'decline' }, ({ payload }) => {
        if (payload.senderId === myUserId) return;
        Alert.alert('Declined', 'Your friend declined the challenge.');
        void cleanup();
        navigate('Friendlies');
      })
      .on('broadcast', { event: 'ready' }, ({ payload }) => {
        if (payload.senderId === myUserId) return;
        if (payload.stage === 'lobby') {
          set({ oppReady: true });
          hostTryStart();
        } else {
          const club = payload.club as OnlineClub;
          if (get().myRole === 'host') {
            guestClubHalf = club;
            hostTryContinue();
          }
        }
      })
      .on('broadcast', { event: 'segment' }, ({ payload }) => {
        if (payload.senderId === myUserId) return;
        handleSegment(payload);
      })
      .on('broadcast', { event: 'so-turn' }, ({ payload }) => {
        if (payload.senderId === myUserId) return;
        handleSoTurn(payload);
      })
      .on('broadcast', { event: 'so-shot' }, ({ payload }) => {
        if (payload.senderId === myUserId) return;
        // Nur der Host löst auf; die Ecke bleibt bis zum Ergebnis geheim
        if (get().myRole === 'host') {
          soShot = payload.target as TargetId;
          handleSoAwait();
          send('so-await', {});
        }
      })
      .on('broadcast', { event: 'so-await' }, ({ payload }) => {
        if (payload.senderId === myUserId) return;
        handleSoAwait();
      })
      .on('broadcast', { event: 'so-dive' }, ({ payload }) => {
        if (payload.senderId === myUserId) return;
        if (get().myRole === 'host') hostResolveKick(payload.target as TargetId);
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        const left = leftPresences as Array<Record<string, unknown>>;
        if (left.length > 0) opponentLeft();
      });

    return new Promise((resolve) => {
      channel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ role });
          if (role === 'guest') send('hello', { club: myClub() });
          resolve(true);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          resolve(false);
        }
      });
    });
  };

  const handleSoAwait = () => {
    const view = get().shootout;
    if (view) set({ shootout: { ...view, stage: 'await-dive' } });
  };

  /** Host: Spiel starten, sobald beide in der Lobby bereit sind. */
  const hostTryStart = () => {
    const s = get();
    if (s.myRole !== 'host' || !s.myReady || !s.oppReady || s.phase !== 'lobby') return;
    const host = myClub();
    hostClubStart = host;
    hostClubHalf = null;
    guestClubHalf = null;
    const guest = guestClubStart ?? s.opponent;
    if (!guest) return;
    guestClubStart = guest;
    halfState = simulateFirstHalf(toSimTeam(host), toSimTeam(guest));
    const payload = {
      stage: 'half1',
      events: halfState.events,
      homeGoals: halfState.homeGoals,
      awayGoals: halfState.awayGoals,
    };
    handleSegment(payload);
    send('segment', payload);
  };

  return {
    phase: 'idle',
    myRole: null,
    opponent: null,
    myReady: false,
    oppReady: false,
    waitingHalf: false,
    shootout: null,

    /** Persönlichen Einladungs-Kanal abonnieren (nach dem Cloud-Login). */
    init: async () => {
      const supabase = getSupabase();
      if (!supabase || personalChannel) return;
      const { data } = await supabase.auth.getSession();
      myUserId = data.session?.user.id ?? null;
      if (!myUserId) return;
      personalChannel = supabase.channel(`gk-user-${myUserId}`, {
        config: { broadcast: { self: false } },
      });
      personalChannel.on('broadcast', { event: 'invite' }, ({ payload }) => {
        const from = payload.from as OnlineClub;
        const id = payload.matchId as string;
        if (get().phase !== 'idle') return; // beschäftigt: Einladung ignorieren
        Alert.alert(
          'Online challenge!',
          `${from.name} challenges you to a live friendly. Accept?`,
          [
            {
              text: 'Decline',
              style: 'cancel',
              onPress: () => {
                // Kurz beitreten, absagen, wieder gehen
                void (async () => {
                  const ok = await joinMatch(id, 'guest');
                  if (ok) {
                    send('decline', {});
                    setTimeout(() => void cleanup(), 500);
                  }
                })();
              },
            },
            {
              text: 'Accept',
              onPress: () => {
                void (async () => {
                  set({ phase: 'lobby', myRole: 'guest', opponent: from, myReady: false, oppReady: false });
                  const ok = await joinMatch(id, 'guest');
                  if (ok) navigate('OnlineLobby');
                  else {
                    Alert.alert('Connection failed', 'Could not join the match. Try again.');
                    void cleanup();
                  }
                })();
              },
            },
          ],
        );
      });
      personalChannel.subscribe();
    },

    /** Freund zu einem Live-Spiel einladen (er muss die App offen haben). */
    invite: async (friendUserId, friendName) => {
      const supabase = getSupabase();
      if (!supabase || !myUserId) return false;
      const id = `${myUserId.slice(0, 8)}-${Date.now()}`;
      set({
        phase: 'lobby',
        myRole: 'host',
        opponent: null,
        myReady: false,
        oppReady: false,
        shootout: null,
      });
      const ok = await joinMatch(id, 'host');
      if (!ok) {
        void cleanup();
        return false;
      }
      // Einladung über den persönlichen Kanal des Freundes zustellen
      const inviteChannel = supabase.channel(`gk-user-${friendUserId}`);
      await new Promise<void>((resolve) => {
        inviteChannel.subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            await inviteChannel.send({
              type: 'broadcast',
              event: 'invite',
              payload: { matchId: id, from: myClub(), senderId: myUserId },
            });
            resolve();
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            resolve();
          }
        });
      });
      setTimeout(() => void supabase.removeChannel(inviteChannel), 1500);
      void friendName;
      return true;
    },

    setReady: () => {
      if (get().myReady) return;
      set({ myReady: true });
      send('ready', { stage: 'lobby' });
      hostTryStart();
    },

    sendShot: (target) => {
      if (get().myRole === 'host') {
        // Host schießt selbst: direkt merken und den Torwart freischalten
        soShot = target;
        handleSoAwait();
        send('so-await', {});
      } else {
        send('so-shot', { target });
      }
    },

    sendDive: (target) => {
      if (get().myRole === 'host') {
        hostResolveKick(target);
      } else {
        send('so-dive', { target });
      }
    },

    leave: () => {
      void cleanup();
    },
  };
});
