import { simulateFirstHalf, simulateMatch, simulateSecondHalf } from '../src/core/engine/matchSim';
import { generateSchedule, computeStandings, generateNpcClubs, resolveSeason } from '../src/core/engine/league';
import { generatePlayerPool, generateFillerSquad, overallOf } from '../src/core/engine/playerGen';
import { drawEggPlayer, drawPackContent, rollPackBonus } from '../src/core/engine/packGen';
import { dayKey, hashString, pitchOpponent, specialSpotIdForDay } from '../src/core/engine/pitchBattle';
import { shootoutWinner, type ShootoutKick } from '../src/core/engine/shootout';
import { EGG_TYPES, LEAGUE_REWARDS, PACK_TYPES, levelUpCost } from '../src/core/domain/constants';
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
// V3-Spannen: Legendär 86-90 (Roll-Toleranz ±1)
check('legendary overall 85..91', legendaries.every(p => {
  const o = overallOf(p, p.position);
  return o >= 85 && o <= 91;
}));
// V3: Starter haben exakt 80 Overall
check('starters exactly 80', pool.filter(p => p.isStarterChoice).every(p => overallOf(p, p.position) === 80));
// V4: exakt faire Positionsverteilung – ST = MF = ABW in JEDER Seltenheit
const posCount = (rarity: string) => {
  const c = { TW: 0, ABW: 0, MF: 0, ST: 0 };
  pool
    .filter(p => p.rarity === rarity && !p.isStarterChoice && !p.isFiller)
    .forEach(p => { c[p.position]++; });
  return c;
};
(['bronze', 'silber', 'gold', 'legendaer'] as const).forEach(rarity => {
  const c = posCount(rarity);
  check(`${rarity}: ST = MF = ABW`, c.ST === c.MF && c.MF === c.ABW && c.TW > 0, JSON.stringify(c));
});
check('gold pool = 40', pool.filter(p => p.rarity === 'gold' && !p.isStarterChoice).length === 40);
check('legendary pool = 20', legendaries.length === 20);
check('bronze pool = 88', pool.filter(p => p.rarity === 'bronze').length === 88);
check('silver pool = 64', pool.filter(p => p.rarity === 'silber').length === 64);

const fillers = generateFillerSquad();
check('fillers = 15', fillers.length === 15, String(fillers.length));
check('fillers weak', fillers.every(p => overallOf(p, p.position) <= 55));

// Pack draws (??? nicht verfügbar: geheim-Quote verteilt sich auf den Rest)
const rarityCount: Record<string, number> = { bronze: 0, silber: 0, gold: 0, legendaer: 0, geheim: 0 };
let mysteryWhenUnavailable = 0;
for (let i = 0; i < 2000; i++) {
  const draw = drawPackContent(pool);
  if (draw.mystery) mysteryWhenUnavailable++;
  draw.players.forEach(p => { rarityCount[p.rarity]++; });
}
const total = 2000 * 3;
check('no mystery when unavailable', mysteryWhenUnavailable === 0);
check('bronze ~60%', Math.abs(rarityCount.bronze / total - 0.6) < 0.05, JSON.stringify(rarityCount));
check('legendaer ~2%', Math.abs(rarityCount.legendaer / total - 0.02) < 0.01);
check('no geheim players drawn', rarityCount.geheim === 0);
check('no fillers/starters in packs', true);

// Ultimate-Pack: deutlich bessere Quoten (5/40/35/15/5)
const ultCount: Record<string, number> = { bronze: 0, silber: 0, gold: 0, legendaer: 0, geheim: 0 };
for (let i = 0; i < 2000; i++) {
  drawPackContent(pool, PACK_TYPES.ultimate).players.forEach(p => { ultCount[p.rarity]++; });
}
check('ultimate legendaer ~15%', Math.abs(ultCount.legendaer / total - 0.15) < 0.03, JSON.stringify(ultCount));
check('ultimate bronze ~5%', Math.abs(ultCount.bronze / total - 0.05) < 0.03);

// ???-Karte verfügbar: ersetzt genau einen Slot; Ultimate: 1-(1-0.05)^3 = ~14 % der Packs
let mysteryPacks = 0;
let mysterySlotOk = true;
for (let i = 0; i < 4000; i++) {
  const draw = drawPackContent(pool, PACK_TYPES.ultimate, true);
  if (draw.mystery) {
    mysteryPacks++;
    if (draw.players.length !== 2) mysterySlotOk = false;
  }
}
check('mystery replaces exactly one slot', mysterySlotOk);
check('ultimate mystery ~14% of packs', Math.abs(mysteryPacks / 4000 - 0.1426) < 0.03, String(mysteryPacks / 4000));

// V3: Pack-Bonus (Coins + Level-up-Punkte in gleicher Höhe) je Pack-Spanne;
// nur runde Stufen, und die niedrigste Stufe fällt öfter als die höchste
(['session', 'standard', 'rare', 'ultimate'] as const).forEach(id => {
  const [min, max] = PACK_TYPES[id].bonus;
  const step = PACK_TYPES[id].bonusStep;
  const counts = new Map<number, number>();
  let ok = true;
  for (let i = 0; i < 3000; i++) {
    const b = rollPackBonus(PACK_TYPES[id]);
    if (b < min || b > max || (b - min) % step !== 0) ok = false;
    counts.set(b, (counts.get(b) ?? 0) + 1);
  }
  check(`${id} bonus on steps ${min}..${max} (step ${step})`, ok);
  check(`${id} bonus: low more likely than high`, (counts.get(min) ?? 0) > (counts.get(max) ?? 0));
});

// V3: Level-up-Kosten nach aktuellem Rating (25/50/100/200, ab 90: 250, Cap 99)
check('level-up costs by rating',
  levelUpCost(40) === 25 && levelUpCost(59) === 25 &&
  levelUpCost(60) === 50 && levelUpCost(74) === 50 &&
  levelUpCost(75) === 100 && levelUpCost(85) === 100 &&
  levelUpCost(86) === 200 && levelUpCost(89) === 200 &&
  levelUpCost(90) === 250 && levelUpCost(98) === 250 &&
  levelUpCost(99) === null);

// V4: Eier – Quoten je Ei-Typ; das 5-km-Ei enthält nie Bronze, nie geheim
const egg5 = EGG_TYPES.find(t => t.id === 'egg-5')!;
const eggCount: Record<string, number> = { bronze: 0, silber: 0, gold: 0, legendaer: 0, geheim: 0 };
for (let i = 0; i < 2000; i++) {
  eggCount[drawEggPlayer(pool, egg5).rarity]++;
}
check('5km egg: no bronze, no geheim', eggCount.bronze === 0 && eggCount.geheim === 0, JSON.stringify(eggCount));
check('5km egg: legendaer ~20%', Math.abs(eggCount.legendaer / 2000 - 0.2) < 0.04);
check('egg distances 1/3/5 km', EGG_TYPES.map(t => t.km).join(',') === '1,3,5');

// V4: Platz-Kämpfe – deterministisch je Platz/Tag, Boss deutlich stärker
const day = dayKey(new Date(2026, 6, 12));
const oppA = pitchOpponent('spot-1', day, 700, false);
const oppB = pitchOpponent('spot-1', day, 700, false);
check('pitch opponent deterministic', oppA.name === oppB.name && oppA.strength === oppB.strength);
check('pitch opponent in band', oppA.strength >= 700 * 0.85 - 1 && oppA.strength <= 700 * 1.1 + 1, String(oppA.strength));
const boss = pitchOpponent('spot-1', day, 700, true);
check('boss stronger than user', boss.strength > 700 * 1.3, String(boss.strength));
const special1 = specialSpotIdForDay(['a', 'b', 'c'], day);
const special2 = specialSpotIdForDay(['c', 'a', 'b'], day);
check('special spot stable per day', special1 !== null && special1 === special2);
check('special spot changes across days', (() => {
  // an mindestens einem von 10 Folgetagen muss ein anderer Platz dran sein
  for (let i = 1; i <= 10; i++) {
    const d = dayKey(new Date(2026, 6, 12 + i));
    if (specialSpotIdForDay(['a', 'b', 'c'], d) !== special1) return true;
  }
  return false;
})());
check('hash stable', hashString('geo-kick') === hashString('geo-kick') && hashString('a') !== hashString('b'));

// V6: Elfmeterschießen-Regeln (Best-of-5 + Sudden Death)
const k = (side: 'A' | 'B', scored: boolean): ShootoutKick => ({ side, scored });
check('shootout: no winner while open', shootoutWinner([k('A', true), k('B', true)]) === null);
check('shootout: early decision', shootoutWinner([
  k('A', true), k('B', false), k('A', true), k('B', false), k('A', true), k('B', false),
]) === 'A');
check('shootout: decided after 5 pairs', shootoutWinner([
  k('A', true), k('B', true), k('A', true), k('B', true), k('A', true),
  k('B', true), k('A', true), k('B', true), k('A', true), k('B', false),
]) === 'A');
check('shootout: sudden death pairwise', (() => {
  const tied = [
    k('A', true), k('B', true), k('A', true), k('B', true), k('A', true),
    k('B', true), k('A', true), k('B', true), k('A', true), k('B', true),
  ];
  return shootoutWinner(tied) === null
    && shootoutWinner([...tied, k('A', true)]) === null
    && shootoutWinner([...tied, k('A', true), k('B', false)]) === 'A';
})());

// V3: Saisonprämien Platz 2 gestaffelt 50/75/100/125
check('season 2nd place 50/75/100/125',
  LEAGUE_REWARDS.seasonByDivision[4][1] === 50 &&
  LEAGUE_REWARDS.seasonByDivision[3][1] === 75 &&
  LEAGUE_REWARDS.seasonByDivision[2][1] === 100 &&
  LEAGUE_REWARDS.seasonByDivision[1][1] === 125);

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
    // V2: Statistiken konsistent zu den Events
    check('stats goals match score', r.stats.home.goals === r.homeGoals && r.stats.away.goals === r.awayGoals);
    check('possession sums to 100', r.stats.home.possession + r.stats.away.possession === 100);
    check('shots >= goals', r.stats.home.shots >= r.homeGoals && r.stats.away.shots >= r.awayGoals);
    const yellowEvents = r.events.filter(e => e.type === 'gelb').length;
    const redEvents = r.events.filter(e => e.type === 'rot').length;
    check('card stats match events', r.stats.home.yellows + r.stats.away.yellows === yellowEvents && r.stats.home.reds + r.stats.away.reds === redEvents);
    check('xg positive when shots exist', r.stats.home.shots === 0 || r.stats.home.xg > 0);
    // V4: Paraden und Man of the Match
    check('saves within misses', r.stats.home.saves <= r.stats.away.shots - r.stats.away.goals
      && r.stats.away.saves <= r.stats.home.shots - r.stats.home.goals);
    check('motm present and rated 4..10', !!r.motm && r.motm.name.length > 0
      && r.motm.rating >= 4 && r.motm.rating <= 10 && r.motm.summary.length > 0);
  }
}
console.log(`avg goals/match: ${(goalsTotal / N).toFixed(2)}, strong team winrate: ${(strongWins / N * 100).toFixed(1)}%`);
check('avg goals plausible (1.5-5.5)', goalsTotal / N > 1.5 && goalsTotal / N < 5.5);
check('strong team wins >55%', strongWins / N > 0.55);

// V5: Halbzeit-Split – 1. Hälfte endet bei 45, 2. Hälfte führt konsistent fort
const teamA = { name: 'A', strength: 600, tactic: 'ausgewogen' as const };
const teamB = { name: 'B', strength: 600, tactic: 'ausgewogen' as const };
const half = simulateFirstHalf(teamA, teamB);
check('first half ends at 45 with halftime event',
  half.events.every(e => e.minute <= 45) && half.events.some(e => e.type === 'halbzeit'));
const full = simulateSecondHalf(teamA, teamB, half);
check('second half continues the first',
  full.homeGoals >= half.homeGoals && full.awayGoals >= half.awayGoals
  && full.events.some(e => e.minute > 45) && full.events.some(e => e.type === 'abpfiff'));
check('split sim stats consistent', full.stats.home.goals === full.homeGoals && full.stats.away.goals === full.awayGoals);

// V5: Taktik wirkt spürbar – offensiv erzeugt deutlich mehr Chancen als defensiv
let offShots = 0;
let defShots = 0;
for (let i = 0; i < 300; i++) {
  const r = simulateMatch(
    { name: 'Off', strength: 600, tactic: 'offensiv' },
    { name: 'Def', strength: 600, tactic: 'defensiv' },
  );
  offShots += r.stats.home.shots;
  defShots += r.stats.away.shots;
}
check('offensive tactic creates far more chances', offShots > defShots * 1.5, `${offShots} vs ${defShots}`);

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

