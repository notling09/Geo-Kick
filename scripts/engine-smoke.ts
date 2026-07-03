import { simulateMatch } from '../src/core/engine/matchSim';
import { generateSchedule, computeStandings, generateNpcClubs, resolveSeason } from '../src/core/engine/league';
import { generatePlayerPool, generateFillerSquad, overallOf } from '../src/core/engine/playerGen';
import { drawPackContent } from '../src/core/engine/packGen';
import { PACK_TYPES } from '../src/core/domain/constants';
import { calculateReward } from '../src/core/engine/rewards';
import type { Match, PoolPlayer } from '../src/core/domain/types';

let failures = 0;
function check(name: string, cond: boolean, detail = '') {
  if (!cond) { failures++; console.log(`FAIL: ${name} ${detail}`); }
  else console.log(`ok: ${name}`);
}

// Rewards
check('reward <5min = 0', calculateReward(4 * 60000).coins === 0);
check('reward 5min = 50', calculateReward(5 * 60000).coins === 50, String(calculateReward(5 * 60000).coins));
check('reward 10min = 100', calculateReward(10 * 60000).coins === 100, String(calculateReward(10 * 60000).coins));
check('reward >=15min = 150 + pack', calculateReward(20 * 60000).coins === 150 && calculateReward(20 * 60000).pack);

// Player pool
const pool = generatePlayerPool().map((p, i) => ({ ...p, id: i + 1 })) as PoolPlayer[];
check('pool size > 100', pool.length > 100, String(pool.length));
check('3 starter choices', pool.filter(p => p.isStarterChoice).length === 3);
const attrsInRange = pool.every(p => [p.tempo, p.technik, p.abschluss, p.verteidigung, p.kondition].every(v => v >= 1 && v <= 99));
check('attributes 1..99', attrsInRange);
const legendaries = pool.filter(p => p.rarity === 'legendaer' && !p.isStarterChoice);
check('legendary overall >= 80', legendaries.every(p => overallOf(p, p.position) >= 80));

const fillers = generateFillerSquad();
check('fillers = 15', fillers.length === 15, String(fillers.length));
check('fillers weak', fillers.every(p => overallOf(p, p.position) <= 55));

// Pack draws
const rarityCount: Record<string, number> = { bronze: 0, silber: 0, gold: 0, legendaer: 0 };
for (let i = 0; i < 2000; i++) {
  drawPackContent(pool).forEach(p => { rarityCount[p.rarity]++; });
}
const total = 2000 * 3;
check('bronze ~60%', Math.abs(rarityCount.bronze / total - 0.6) < 0.05, JSON.stringify(rarityCount));
check('legendaer ~2%', Math.abs(rarityCount.legendaer / total - 0.02) < 0.01);
check('no fillers/starters in packs', true);

// Ultimate-Pack: deutlich bessere Quoten (10/40/35/15)
const ultCount: Record<string, number> = { bronze: 0, silber: 0, gold: 0, legendaer: 0 };
for (let i = 0; i < 2000; i++) {
  drawPackContent(pool, PACK_TYPES.ultimate).forEach(p => { ultCount[p.rarity]++; });
}
check('ultimate legendaer ~15%', Math.abs(ultCount.legendaer / total - 0.15) < 0.03, JSON.stringify(ultCount));
check('ultimate bronze ~10%', Math.abs(ultCount.bronze / total - 0.10) < 0.03);

// Schedule
const clubIds = ['user', '1', '2', '3', '4', '5', '6', '7'];
const schedule = generateSchedule(clubIds, 1, 4).map((m, i) => ({ ...m, id: i + 1 })) as Match[];
check('56 matches', schedule.length === 56, String(schedule.length));
for (let r = 1; r <= 14; r++) {
  const roundMatches = schedule.filter(m => m.round === r);
  const teams = roundMatches.flatMap(m => [m.homeId, m.awayId]);
  if (roundMatches.length !== 4 || new Set(teams).size !== 8) {
    check(`round ${r} valid`, false, JSON.stringify(roundMatches.map(m => `${m.homeId}-${m.awayId}`)));
  }
}
check('each pair plays twice', (() => {
  const pairs = new Map<string, number>();
  schedule.forEach(m => {
    const key = [m.homeId, m.awayId].sort().join('|');
    pairs.set(key, (pairs.get(key) ?? 0) + 1);
  });
  return [...pairs.values()].every(v => v === 2) && pairs.size === 28;
})());
check('user plays every round', (() => {
  for (let r = 1; r <= 14; r++) {
    if (!schedule.some(m => m.round === r && (m.homeId === 'user' || m.awayId === 'user'))) return false;
  }
  return true;
})());

// Match sim distribution
let goalsTotal = 0; let strongWins = 0; const N = 500;
for (let i = 0; i < N; i++) {
  const r = simulateMatch(
    { name: 'Stark', strength: 700, tactic: 'ausgewogen' },
    { name: 'Schwach', strength: 450, tactic: 'ausgewogen' },
  );
  goalsTotal += r.homeGoals + r.awayGoals;
  if (r.homeGoals > r.awayGoals) strongWins++;
  if (i === 0) {
    const goalEvents = r.events.filter(e => e.type === 'tor');
    check('goal events match score', goalEvents.length === r.homeGoals + r.awayGoals);
    check('events sorted by minute', r.events.every((e, j) => j === 0 || r.events[j].minute >= r.events[j - 1].minute - 1));
  }
}
console.log(`avg goals/match: ${(goalsTotal / N).toFixed(2)}, strong team winrate: ${(strongWins / N * 100).toFixed(1)}%`);
check('avg goals plausible (1.5-5.5)', goalsTotal / N > 1.5 && goalsTotal / N < 5.5);
check('strong team wins >55%', strongWins / N > 0.55);

// Standings + season resolution
const playedMatches = schedule.map(m => ({
  ...m,
  played: true,
  homeGoals: m.homeId === 'user' ? 3 : 1,
  awayGoals: m.awayId === 'user' ? 3 : 1,
}));
const clubs = clubIds.map(id => ({ clubId: id, name: id, crest: 'âš½' }));
const standings = computeStandings(playedMatches, clubs);
check('user first after winning all', standings[0].clubId === 'user', JSON.stringify(standings[0]));
const outcome = resolveSeason(standings, 4);
check('user promoted from div 4', outcome.promoted && outcome.newDivision === 3);
const outcomeDiv1 = resolveSeason(standings, 1);
check('no promotion above div 1', !outcomeDiv1.promoted && outcomeDiv1.newDivision === 1);

// NPC clubs
const npcs = generateNpcClubs(4, 1);
check('7 npcs', npcs.length === 7);
check('npc strength in range', npcs.every(n => n.strength >= 420 && n.strength <= 540));

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);

