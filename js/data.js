// Static game data: buildings, units, quests, plots. Pure data, no rendering.
export const RES = ['wood', 'food', 'stone', 'gold'];
export const RES_NAMES = { wood: 'Timber', food: 'Food', stone: 'Stone', gold: 'Gold' };

export const BUILDINGS = {
  lumber:   { name: 'Lumber Camp', icon: 'wood',  desc: 'Woodcutters fell trees and haul timber to the depot.',  cost: { wood: 80, food: 10 },            time: 10, prod: { wood: 0.9 },  unlock: 1 },
  farm:     { name: 'Farmstead',   icon: 'food',  desc: 'Fields and a barn. Farmers keep your people fed.',      cost: { wood: 60 },                      time: 9,  prod: { food: 0.9 },  unlock: 1 },
  quarry:   { name: 'Stone Quarry',icon: 'stone', desc: 'Masons cut stone blocks for walls and towers.',          cost: { wood: 80, food: 20 },            time: 12, prod: { stone: 0.5 }, unlock: 1 },
  mine:     { name: 'Gold Mine',   icon: 'gold',  desc: 'Deep shafts yield gold for knights and trade.',          cost: { wood: 120, stone: 60 },          time: 16, prod: { gold: 0.25 }, unlock: 2 },
  barracks: { name: 'Barracks',    icon: 'sword', desc: 'Trains footmen. Each barracks speeds up training.',     cost: { wood: 100, stone: 50 },          time: 14, trains: ['footman'], unlock: 1 },
  archery:  { name: 'Archery Range', icon: 'bow', desc: 'Trains archers who rain arrows from range.',             cost: { wood: 120, stone: 40 },          time: 14, trains: ['archer'],  unlock: 2 },
  stable:   { name: 'Stables',     icon: 'horse', desc: 'Trains armoured knights, the fastest and hardest hitters.', cost: { wood: 160, stone: 100, gold: 60 }, time: 20, trains: ['knight'], unlock: 3 },
};
export const BUILD_ORDER = ['lumber', 'farm', 'quarry', 'mine', 'barracks', 'archery', 'stable'];
export const MAX_BUILDING_LEVEL = 3;

export const UNITS = {
  footman: { name: 'Footman', icon: 'sword', hp: 100, atk: 12, armor: 3, range: 1.7, speed: 3.4, cd: 1.0, cost: { food: 40, wood: 15 },           time: 6,  needs: 'barracks', desc: 'Sturdy front-line infantry with sword and shield.' },
  archer:  { name: 'Archer',  icon: 'bow',   hp: 60,  atk: 11, armor: 1, range: 12,  speed: 3.6, cd: 1.5, cost: { food: 30, wood: 35 },           time: 7,  needs: 'archery',  desc: 'Fragile, but strikes from far behind the line.' },
  knight:  { name: 'Knight',  icon: 'horse', hp: 190, atk: 22, armor: 6, range: 2.0, speed: 5.4, cd: 1.2, cost: { food: 80, wood: 20, gold: 50 }, time: 12, needs: 'stable',   desc: 'Heavy cavalry. Fast, armoured and deadly.' },
};
export const ENEMY_UNITS = {
  bandit:  { name: 'Bandit',        hp: 75,  atk: 10, armor: 1, range: 1.7, speed: 3.3, cd: 1.1, kind: 'melee' },
  slinger: { name: 'Bandit Archer', hp: 45,  atk: 8,  armor: 0, range: 11,  speed: 3.5, cd: 1.6, kind: 'ranged' },
  chief:   { name: 'Bandit Chief',  hp: 380, atk: 22, armor: 5, range: 2.0, speed: 3.6, cd: 1.1, kind: 'melee' },
  tower:   { name: 'Watchtower',    hp: 320, atk: 12, armor: 4, range: 15,  speed: 0,   cd: 1.8, kind: 'tower' },
};

export const CASTLE_MAX = 5;
export const castleUpgradeCost = (lvl) => ({ wood: 150 * lvl * lvl, stone: 90 * lvl * lvl, gold: lvl >= 2 ? 40 * (lvl - 1) * lvl : 0 });
export const castleUnlocks = {
  2: 'Gold Mine and Archery Range unlocked. Buildings can reach level 2.',
  3: 'Stables and Knights unlocked. Four new building plots. Buildings can reach level 3.',
  4: 'Four more plots further out. Larger army cap.',
  5: 'The Grand Keep: the realm is at its height.',
};
export const storageCap = (lvl) => 500 + 600 * lvl;
export const armyCap = (lvl) => 10 + 8 * lvl;
export const upgradeCost = (type, lvl) => {
  const m = Math.pow(1.7, lvl); const out = {};
  for (const [k, v] of Object.entries(BUILDINGS[type].cost)) out[k] = Math.ceil(v * m / 5) * 5;
  return out;
};
export const prodMult = (lvl) => 1 + 0.6 * (lvl - 1);

// Plot layout: [angleDeg, radius, unlockCastleLevel]
export const PLOT_DEFS = [
  [200, 18, 1], [160, 19, 1], [110, 19, 1], [70, 19, 1], [25, 18, 1], [-25, 18, 1], [-70, 19, 1], [-115, 18, 1],
  [135, 27, 3], [120, 30, 3], [45, 27, 3], [-45, 27, 3], [-90, 28, 3], [-135, 27, 3],
  [205, 34, 4], [0, 33, 4],
];
export const plotPos = (i) => { const [a, r] = PLOT_DEFS[i]; const t = a * Math.PI / 180; return { x: Math.cos(t) * r, z: Math.sin(t) * r }; };

export const CAMP = { x: 72, z: -52 };
export const RALLY = { x: 44, z: -14 };

export const QUESTS = [
  { id: 'q_farm',    title: 'Feed the People',   desc: 'Build a Farmstead.',                     test: s => count(s, 'farm') >= 1,                    reward: { wood: 60 } },
  { id: 'q_lumber',  title: 'Timber!',           desc: 'Build a Lumber Camp.',                   test: s => count(s, 'lumber') >= 1,                  reward: { food: 60 } },
  { id: 'q_train',   title: 'Raise the Banners', desc: 'Train 5 soldiers.',                      test: s => s.stats.trained >= 5,                     reward: { gold: 40 } },
  { id: 'q_quarry',  title: 'Stone Foundations', desc: 'Build a Stone Quarry.',                  test: s => count(s, 'quarry') >= 1,                  reward: { wood: 80 } },
  { id: 'q_lvl2',    title: 'A Grander Keep',    desc: 'Upgrade the castle to level 2.',         test: s => s.level >= 2,                             reward: { gold: 80, stone: 60 } },
  { id: 'q_camp',    title: 'Clear the Road',    desc: 'Defeat the bandit camp.',                test: s => s.stats.won >= 1,                         reward: { gold: 150, wood: 100 } },
  { id: 'q_army',    title: 'A Real Army',       desc: 'Command an army of 20 soldiers.',        test: s => armySize(s) >= 20,                        reward: { gold: 100 } },
  { id: 'q_lvl3',    title: 'Knights of the Realm', desc: 'Reach castle level 3.',               test: s => s.level >= 3,                             reward: { gold: 200, stone: 150 } },
  { id: 'q_prod',    title: 'A Thriving Realm',  desc: 'Own 8 buildings.',                       test: s => s.plots.filter(Boolean).length >= 8,      reward: { gold: 200, food: 200 } },
  { id: 'q_camp3',   title: 'Scourge of Bandits',desc: 'Defeat the bandit camp 3 times.',        test: s => s.stats.won >= 3,                         reward: { gold: 400 } },
  { id: 'q_lvl5',    title: 'The Grand Keep',    desc: 'Reach castle level 5.',                  test: s => s.level >= 5,                             reward: { gold: 1000 } },
];
function count(s, type) { return s.plots.filter(p => p && p.type === type && p.state !== 'building').length; }
export function armySize(s) { return s.army.footman + s.army.archer + s.army.knight; }
