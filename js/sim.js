// Real-time combat simulation. Pure logic: units are plain objects, the renderer mirrors them.
import { UNITS, ENEMY_UNITS, CAMP } from './data.js';

let uid = 1;
export function makeCombatant(team, type, x, z, scale = 1) {
  const def = team === 'p' ? UNITS[type] : ENEMY_UNITS[type];
  const hp = Math.round(def.hp * scale);
  return { id: uid++, team, type, def, x, z, homeX: x, homeZ: z, hp, maxHp: hp, order: { kind: 'idle' }, target: null,
    cd: Math.random() * def.cd, dead: false, deadT: 0, facing: team === 'p' ? 0 : Math.PI, state: 'idle', alert: false };
}

export function spawnCamp(cleared) {
  const u = [];
  const bandits = Math.min(14, 5 + 2 * cleared), slingers = Math.min(6, 2 + cleared), s = 1 + 0.08 * cleared;
  u.push(makeCombatant('e', 'chief', CAMP.x, CAMP.z, 1 + 0.12 * cleared));
  for (let i = 0; i < bandits; i++) { const a = i / bandits * Math.PI * 2, r = 5 + (i % 3) * 2; u.push(makeCombatant('e', 'bandit', CAMP.x + Math.cos(a) * r, CAMP.z + Math.sin(a) * r, s)); }
  for (let i = 0; i < slingers; i++) { const a = i / slingers * Math.PI * 2 + 0.4; u.push(makeCombatant('e', 'slinger', CAMP.x + Math.cos(a) * 3.5, CAMP.z + Math.sin(a) * 3.5, s)); }
  u.push(makeCombatant('e', 'tower', CAMP.x - 9, CAMP.z + 9)); u.push(makeCombatant('e', 'tower', CAMP.x + 9, CAMP.z + 9));
  return u;
}

const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
function nearest(u, list, maxD) {
  let best = null, bd = maxD * maxD;
  for (const o of list) {
    if (o.team === u.team || o.dead) continue;
    const dx = o.x - u.x, dz = o.z - u.z, d = dx * dx + dz * dz;
    if (d < bd) { bd = d; best = o; }
  }
  return best;
}
function moveToward(u, tx, tz, dt, mult = 1) {
  const dx = tx - u.x, dz = tz - u.z, d = Math.hypot(dx, dz); if (d < 1e-4) return 0;
  const step = Math.min(d, u.def.speed * mult * dt);
  u.x += dx / d * step; u.z += dz / d * step; u.facing = Math.atan2(dx, dz); return d - step;
}
export function damageOf(att, tgt) {
  const base = att.def.atk * (0.88 + Math.random() * 0.24);
  return Math.max(1, Math.round(base * 100 / (100 + tgt.def.armor * 12)));
}
function applyHit(a, t, ev) {
  const dmg = damageOf(a, t); t.hp -= dmg;
  ev.push({ kind: 'hit', from: a, to: t, dmg, ranged: a.def.range > 3, tower: a.def.kind === 'tower' });
  if (t.team === 'e') { t.alert = true; }
  if (t.hp <= 0 && !t.dead) { t.hp = 0; t.dead = true; t.deadT = 0; t.target = null; ev.push({ kind: 'death', unit: t }); }
}

function stepOne(u, all, dt, ev) {
  u.cd -= dt;
  if (u.target && u.target.dead) u.target = null;
  const def = u.def, o = u.order, isTower = def.kind === 'tower'; let moving = false, attacking = false;
  if (o.kind === 'attack') {
    if (o.target && !o.target.dead) u.target = o.target; else { u.order = { kind: 'idle' }; u.target = null; }
  } else if (!u.target) {
    let aggro = 0;
    if (u.team === 'p') aggro = o.kind === 'move' ? 0 : o.kind === 'hold' ? def.range + 1.5 : 15;
    else aggro = isTower ? def.range : (u.alert ? 34 : 12);
    if (aggro > 0) {
      u.target = nearest(u, all, aggro);
      if (u.target && u.team === 'e') { u.alert = true; for (const e of all) if (e.team === 'e' && !e.dead && dist(e, u) < 22) e.alert = true; }
    }
  }
  const t = u.target;
  if (t) {
    const d = dist(u, t), reach = def.range + (t.def.kind === 'tower' ? 1.8 : 0.35);
    if (u.team === 'e' && !isTower && Math.hypot(u.x - u.homeX, u.z - u.homeZ) > 40) { u.target = null; u.alert = false; }
    else if (d <= reach) {
      u.facing = Math.atan2(t.x - u.x, t.z - u.z); attacking = true;
      if (u.cd <= 0) { u.cd = def.cd * (0.9 + Math.random() * 0.2); applyHit(u, t, ev); }
    } else if (def.speed > 0 && !(u.team === 'p' && o.kind === 'hold')) { moveToward(u, t.x, t.z, dt); moving = true; }
    else if (u.team === 'p' && o.kind === 'hold') { /* hold position */ }
  } else if (def.speed > 0) {
    if (o.kind === 'move' || o.kind === 'amove') {
      if (moveToward(u, o.x, o.z, dt) < 0.5) u.order = { kind: 'idle' }; else moving = true;
    } else if (o.kind === 'patrol') {
      const tx = o.toB ? o.bx : o.ax, tz = o.toB ? o.bz : o.az;
      if (moveToward(u, tx, tz, dt, 0.6) < 0.5) o.toB = !o.toB; moving = true;
    } else if (u.team === 'e') {
      const d = Math.hypot(u.x - u.homeX, u.z - u.homeZ);
      if (d > 1.2) { moveToward(u, u.homeX, u.homeZ, dt, 0.8); moving = true; } else u.alert = false;
    }
  }
  u.state = moving ? 'walk' : attacking ? 'attack' : 'idle';
}

export function step(units, dt, ev) {
  const alive = units.filter(u => !u.dead);
  for (const u of units) { if (u.dead) { u.deadT += dt; continue; } stepOne(u, alive, dt, ev); }
  for (let i = 0; i < alive.length; i++) {
    const a = alive[i]; if (a.def.speed === 0 || a.dead) continue;
    for (let j = i + 1; j < alive.length; j++) {
      const b = alive[j]; if (b.def.speed === 0 || b.dead) continue;
      const dx = b.x - a.x, dz = b.z - a.z, d2 = dx * dx + dz * dz;
      if (d2 < 0.64 && d2 > 1e-6) { const d = Math.sqrt(d2), p = (0.8 - d) * 0.5, nx = dx / d, nz = dz / d; a.x -= nx * p; a.z -= nz * p; b.x += nx * p; b.z += nz * p; }
    }
  }
}

export function outcome(units) {
  const pAlive = units.some(u => u.team === 'p' && !u.dead);
  const eAlive = units.some(u => u.team === 'e' && !u.dead && u.def.kind !== 'tower');
  if (!eAlive) return 'win';
  if (!pAlive) return 'lose';
  return null;
}
