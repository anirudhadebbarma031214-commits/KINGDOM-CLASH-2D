// Procedural terrain: pure functions shared by rendering, placement and unit movement.
import { CAMP } from './data.js';

export const WORLD = 240;           // terrain size
export const HALF = WORLD / 2;
export const WATER_Y = 0;
export const PLAY_LIMIT = 92;       // camera/pan limit

function hash2(x, y) { let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; }
export function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function fbm(x, y, o = 4) { let s = 0, a = 0.5, f = 1; for (let i = 0; i < o; i++) { s += a * vnoise(x * f, y * f); f *= 2; a *= 0.5; } return s; }
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

export const riverX = (z) => -68 + 10 * Math.sin(z * 0.05) + 4 * Math.sin(z * 0.13);
export const POND = { x: 46, z: 58, r: 10 };

export function riverWeight(x, z) { return sstep(11, 5.5, Math.abs(x - riverX(z))); }
export function pondWeight(x, z) { return sstep(POND.r, POND.r * 0.55, Math.hypot(x - POND.x, z - POND.z)); }

export function heightAt(x, z) {
  const dr = Math.abs(x - riverX(z));
  const amp = lerp(0.25, 1, sstep(14, 42, dr));
  const hills = (fbm(x * 0.021 + 7, z * 0.021 - 3) - 0.38) * 15 * amp + (fbm(x * 0.07, z * 0.07) - 0.5) * 1.6;
  let h = 1.0 + hills;
  // castle plateau
  const dc = Math.hypot(x, z);
  h = lerp(1.0 + (fbm(x * 0.12, z * 0.12) - 0.5) * 0.35, h, sstep(30, 54, dc));
  // bandit camp plateau
  const dk = Math.hypot(x - CAMP.x, z - CAMP.z);
  h = lerp(2.2 + (fbm(x * 0.15, z * 0.15) - 0.5) * 0.3, h, sstep(18, 32, dk));
  // water bodies
  h = lerp(h, -1.4, riverWeight(x, z));
  h = lerp(h, -1.2, pondWeight(x, z));
  // mountain ring at the edge of the world
  const edge = sstep(92, 118, Math.max(Math.abs(x), Math.abs(z)));
  h += edge * (14 + fbm(x * 0.05, z * 0.05) * 22);
  return h;
}
export function slopeAt(x, z) { const e = 1.2; const dx = heightAt(x + e, z) - heightAt(x - e, z), dz = heightAt(x, z + e) - heightAt(x, z - e); return Math.hypot(dx, dz) / (2 * e); }
export function isWater(x, z) { return heightAt(x, z) < WATER_Y + 0.05; }

// Road polylines (control points, x/z). Roads are rendered as ribbons following the terrain.
export const ROADS = [
  [[0, 11], [0, 22], [10, 29], [30, 23], [50, 2], [64, -28], [72, -44]],        // gate -> bandit camp
  [[-11, 0], [-30, 0], [-52, 7], [-78, 12]],                                       // west road to the bridge
  [[0, 22], [-6, 40], [-2, 56], [20, 66], [38, 62]],                                // south road toward the pond
];
export const BRIDGE = (() => { const z = 9.5; const cx = riverX(z); return { z, x0: cx - 12, x1: cx + 12, y: 1.5 }; })();

export function distToRoad(x, z) {
  let best = 1e9;
  for (const r of ROADS) for (let i = 0; i < r.length - 1; i++) {
    const [ax, az] = r[i], [bx, bz] = r[i + 1]; const dx = bx - ax, dz = bz - az; const l2 = dx * dx + dz * dz;
    let t = ((x - ax) * dx + (z - az) * dz) / l2; t = Math.max(0, Math.min(1, t));
    best = Math.min(best, Math.hypot(x - (ax + dx * t), z - (az + dz * t)));
  }
  return best;
}

// Seeded RNG
export function rng(seed) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }
