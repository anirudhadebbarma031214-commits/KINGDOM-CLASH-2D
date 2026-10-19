// Game state, economy, construction, training, quests, save/load. Pure logic (no rendering) so it can be tested in Node.
import { RES, BUILDINGS, UNITS, PLOT_DEFS, QUESTS, MAX_BUILDING_LEVEL, CASTLE_MAX, castleUpgradeCost, castleUnlocks, storageCap, armyCap, upgradeCost, prodMult, armySize } from './data.js';

export const SAVE_KEY = 'kingdom-clash-rotr-v2';

export function newState() {
  return {
    v: 2, savedAt: Date.now(), tod: 0.32, playTime: 0,
    res: { wood: 350, food: 260, stone: 150, gold: 100 },
    level: 1, xp: 0,
    plots: PLOT_DEFS.map(() => null),
    army: { footman: 6, archer: 3, knight: 0 },
    queue: [],
    stats: { built: 0, trained: 0, won: 0, lost: 0, gathered: 0, upgrades: 0 },
    quests: {},
    camp: { cleared: 0 },
    settings: { gfx: 'auto', music: true, sfx: true, vol: 0.7 },
  };
}

export const canAfford = (s, cost) => RES.every(r => (s.res[r] || 0) >= (cost[r] || 0));
export const pay = (s, cost) => { for (const r of RES) s.res[r] -= (cost[r] || 0); };
export const gain = (s, g) => { const cap = storageCap(s.level); for (const r of RES) if (g[r]) { s.res[r] = Math.min(cap, s.res[r] + g[r]); } };
export const costText = (cost) => RES.filter(r => cost[r]).map(r => cost[r] + ' ' + r).join(', ');
export const missing = (s, cost) => RES.filter(r => (s.res[r] || 0) < (cost[r] || 0));

export function buildingCount(s, type, builtOnly = true) {
  return s.plots.filter(p => p && p.type === type && (!builtOnly || p.state === 'built' || p.state === 'upgrading')).length;
}
export const plotUnlocked = (s, i) => s.level >= PLOT_DEFS[i][2];

export function startBuild(s, i, type) {
  const def = BUILDINGS[type];
  if (!def) return fail('Unknown building');
  if (i < 0 || i >= s.plots.length) return fail('No plot selected');
  if (!plotUnlocked(s, i)) return fail('This plot unlocks at castle level ' + PLOT_DEFS[i][2]);
  if (s.plots[i]) return fail('This plot is already occupied');
  if (s.level < def.unlock) return fail(def.name + ' requires castle level ' + def.unlock);
  if (!canAfford(s, def.cost)) return fail('Not enough ' + missing(s, def.cost).join(', '));
  pay(s, def.cost);
  s.plots[i] = { type, level: 1, state: 'building', total: def.time, left: def.time, hp: 100 };
  return { ok: true, msg: def.name + ' construction started' };
}

export function startUpgrade(s, i) {
  const p = s.plots[i];
  if (!p) return fail('Nothing to upgrade');
  if (p.state !== 'built') return fail('Busy right now');
  if (p.level >= MAX_BUILDING_LEVEL) return fail('Already at maximum level');
  if (p.level >= s.level) return fail('Upgrade the castle first (building level cannot exceed castle level)');
  const cost = upgradeCost(p.type, p.level);
  if (!canAfford(s, cost)) return fail('Not enough ' + missing(s, cost).join(', '));
  pay(s, cost);
  const t = BUILDINGS[p.type].time * (1 + p.level * 0.5);
  p.state = 'upgrading'; p.total = t; p.left = t;
  return { ok: true, msg: BUILDINGS[p.type].name + ' upgrade started' };
}

export const repairCost = (p) => ({ wood: Math.ceil((100 - p.hp) * 0.8) });
export function repair(s, i) {
  const p = s.plots[i];
  if (!p) return fail('Nothing to repair');
  if (p.hp >= 100) return fail('Already in perfect condition');
  const c = repairCost(p);
  if (!canAfford(s, c)) return fail('Not enough timber');
  pay(s, c); p.hp = 100;
  return { ok: true, msg: BUILDINGS[p.type].name + ' repaired' };
}

export function upgradeCastle(s) {
  if (s.level >= CASTLE_MAX) return fail('The castle is at its highest level');
  const c = castleUpgradeCost(s.level);
  if (!canAfford(s, c)) return fail('Not enough ' + missing(s, c).join(', '));
  pay(s, c); s.level++; s.xp += 100 * s.level; s.stats.upgrades++;
  return { ok: true, msg: 'Castle upgraded to level ' + s.level + '. ' + (castleUnlocks[s.level] || ''), castle: true };
}

export function trainTime(s, type) {
  const n = Math.max(1, buildingCount(s, UNITS[type].needs));
  return UNITS[type].time / (1 + 0.35 * (n - 1));
}
export function queuedCount(s) { return s.queue.length; }
export function trainUnit(s, type) {
  const u = UNITS[type];
  if (!u) return fail('Unknown unit');
  if (buildingCount(s, u.needs) < 1) return fail('Build ' + BUILDINGS[u.needs].name + ' first');
  if (s.queue.length >= 8) return fail('Training queue is full');
  if (armySize(s) + s.queue.length >= armyCap(s.level)) return fail('Army cap reached (' + armyCap(s.level) + '). Upgrade the castle.');
  if (!canAfford(s, u.cost)) return fail('Not enough ' + missing(s, u.cost).join(', '));
  pay(s, u.cost);
  const t = trainTime(s, type);
  s.queue.push({ type, total: t, left: t });
  return { ok: true, msg: u.name + ' queued' };
}
export function cancelTrain(s, idx) {
  const q = s.queue[idx]; if (!q) return fail('Nothing to cancel');
  const u = UNITS[q.type]; const refund = {}; for (const r of RES) if (u.cost[r]) refund[r] = Math.floor(u.cost[r] * 0.75);
  gain(s, refund); s.queue.splice(idx, 1);
  return { ok: true, msg: 'Training cancelled (75% refunded)' };
}

export function productionRates(s) {
  const out = { wood: 0, food: 0, stone: 0, gold: 0 };
  for (const p of s.plots) {
    if (!p || p.state === 'building') continue;
    const prod = BUILDINGS[p.type].prod; if (!prod) continue;
    const f = prodMult(p.level) * (0.5 + 0.5 * p.hp / 100);
    for (const r of RES) if (prod[r]) out[r] += prod[r] * f;
  }
  return out;
}

// Advance simulated time. Returns a list of events for the UI/world to react to.
export function tick(s, dt) {
  const ev = [];
  s.playTime += dt;
  const rates = productionRates(s);
  const g = {}; for (const r of RES) { g[r] = rates[r] * dt; s.stats.gathered += g[r]; }
  gain(s, g);
  for (let i = 0; i < s.plots.length; i++) {
    const p = s.plots[i]; if (!p || (p.state !== 'building' && p.state !== 'upgrading')) continue;
    p.left -= dt;
    if (p.left <= 0) {
      const wasUp = p.state === 'upgrading';
      p.state = 'built'; p.left = 0;
      if (wasUp) p.level++; else s.stats.built++;
      s.xp += 25 * p.level;
      ev.push({ type: wasUp ? 'upgraded' : 'built', plot: i, name: BUILDINGS[p.type].name });
    }
  }
  if (s.queue.length) {
    const q = s.queue[0]; q.left -= dt;
    if (q.left <= 0) {
      s.queue.shift(); s.army[q.type]++; s.stats.trained++; s.xp += 8;
      ev.push({ type: 'trained', unit: q.type });
    }
  }
  return ev;
}

// Quests
export function checkQuests(s) {
  const done = [];
  for (const q of QUESTS) {
    if (!s.quests[q.id] && q.test(s)) { s.quests[q.id] = 1; gain(s, q.reward); s.xp += 50; done.push(q); }
  }
  return done;
}
export const questList = (s) => QUESTS.map(q => ({ ...q, done: !!s.quests[q.id] }));

// Battle consequences
export function applyBattle(s, r) {
  // r: {win, survivors:{footman,archer,knight}, towersDestroyed}
  const before = armySize(s);
  s.army.footman = r.survivors.footman; s.army.archer = r.survivors.archer; s.army.knight = r.survivors.knight;
  const lost = before - armySize(s);
  const res = { lost, rewards: null, damaged: [] };
  if (r.win) {
    const n = s.camp.cleared; s.stats.won++; s.camp.cleared++;
    res.rewards = { gold: 120 + 40 * n, wood: 80 + 20 * n, stone: 40 + 15 * n, food: 60 };
    gain(s, res.rewards); s.xp += 200 + 40 * n;
  } else {
    s.stats.lost++;
    s.res.food = Math.max(0, s.res.food - 60); s.res.gold = Math.max(0, s.res.gold - 40);
    const built = s.plots.map((p, i) => p ? i : -1).filter(i => i >= 0);
    for (let k = 0; k < Math.min(2, built.length); k++) {
      const i = built.splice(Math.floor(Math.random() * built.length), 1)[0];
      s.plots[i].hp = Math.max(25, s.plots[i].hp - 35); res.damaged.push(i);
    }
  }
  return res;
}

export const levelFromXp = (xp) => 1 + Math.floor(Math.sqrt(xp / 100));
export const xpProgress = (xp) => { const l = levelFromXp(xp); const a = (l - 1) ** 2 * 100, b = l ** 2 * 100; return { level: l, frac: (xp - a) / (b - a), cur: xp - a, need: b - a }; };

function fail(msg) { return { ok: false, msg }; }

// Persistence
export function saveState(s, storage = globalThis.localStorage) {
  try { s.savedAt = Date.now(); storage.setItem(SAVE_KEY, JSON.stringify(s)); return true; } catch (e) { return false; }
}
export function hasSave(storage = globalThis.localStorage) { try { return !!storage.getItem(SAVE_KEY); } catch (e) { return false; } }
export function loadState(storage = globalThis.localStorage) {
  try {
    const raw = storage.getItem(SAVE_KEY); if (!raw) return null;
    const d = JSON.parse(raw); const base = newState();
    if (!d || d.v !== 2) return null;
    const s = { ...base, ...d, res: { ...base.res, ...d.res }, army: { ...base.army, ...d.army }, stats: { ...base.stats, ...d.stats },
      settings: { ...base.settings, ...d.settings }, camp: { ...base.camp, ...d.camp }, quests: d.quests || {} };
    s.plots = PLOT_DEFS.map((_, i) => (d.plots && d.plots[i]) ? d.plots[i] : null);
    s.queue = Array.isArray(d.queue) ? d.queue.filter(q => UNITS[q.type]) : [];
    for (const r of RES) if (!isFinite(s.res[r])) s.res[r] = base.res[r];
    return s;
  } catch (e) { return null; }
}
export function offlineProgress(s, seconds) {
  const t = Math.max(0, Math.min(600, seconds)); let left = t; const ev = [];
  const before = { ...s.res };
  while (left > 0) { const dt = Math.min(2, left); ev.push(...tick(s, dt * 0.5)); left -= dt; }
  const g = {}; for (const r of RES) g[r] = Math.floor(s.res[r] - before[r]);
  return { seconds: t, gained: g, events: ev };
}
