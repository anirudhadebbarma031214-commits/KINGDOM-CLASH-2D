// Loads Three.js (pinned r164). Prefers a local vendored copy (written at deploy time by the Pages workflow),
// then falls back to pinned CDN builds. Every other module reads the live binding `T` after loadThree() resolves.
export let T = null;

const V = '0.164.1';
const SOURCES = [
  new URL('../vendor/three.module.min.js', import.meta.url).href,
  'https://cdn.jsdelivr.net/npm/three@' + V + '/build/three.module.min.js',
  'https://unpkg.com/three@' + V + '/build/three.module.min.js',
];

export async function loadThree() {
  if (globalThis.__KC_THREE__) { T = globalThis.__KC_THREE__; return T; } // test hook
  let last;
  for (const src of SOURCES) {
    try { T = await import(src); return T; } catch (e) { last = e; console.warn('Three.js source failed:', src, e && e.message); }
  }
  throw last || new Error('Three.js could not be loaded');
}
