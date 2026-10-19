// Procedural textures, PBR materials and geometry helpers. Everything is generated at runtime: no external assets.
import { T } from './three.js';
import { rng } from './terrain.js';

export const M = {};            // shared materials, filled by initGfx()
export const shared = { windowIntensity: 0, time: { value: 0 } };

export function canvasTex(size, draw, repeat = [1, 1], srgb = true) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'); draw(g, size);
  const t = new T.CanvasTexture(c);
  t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); t.anisotropy = 4;
  if (srgb) t.colorSpace = T.SRGBColorSpace;
  t.userData = { canvas: c };
  return t;
}
// Build a tangent-space normal map from a texture's luminance (Sobel).
export function normalFrom(tex, strength = 2) {
  const c = tex.userData.canvas, s = c.width, g = c.getContext('2d'), src = g.getImageData(0, 0, s, s).data;
  const h = new Float32Array(s * s); for (let i = 0; i < s * s; i++) h[i] = (src[i * 4] * 0.3 + src[i * 4 + 1] * 0.59 + src[i * 4 + 2] * 0.11) / 255;
  const out = document.createElement('canvas'); out.width = out.height = s; const og = out.getContext('2d'), img = og.createImageData(s, s);
  const at = (x, y) => h[((y + s) % s) * s + ((x + s) % s)];
  for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
    const dx = (at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1)) - (at(x - 1, y - 1) + 2 * at(x - 1, y) + at(x - 1, y + 1));
    const dy = (at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1)) - (at(x - 1, y - 1) + 2 * at(x, y - 1) + at(x + 1, y - 1));
    let nx = -dx * strength, ny = -dy * strength, nz = 1; const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
    const i = (y * s + x) * 4; img.data[i] = (nx * 0.5 + 0.5) * 255; img.data[i + 1] = (ny * 0.5 + 0.5) * 255; img.data[i + 2] = (nz * 0.5 + 0.5) * 255; img.data[i + 3] = 255;
  }
  og.putImageData(img, 0, 0);
  const t = new T.CanvasTexture(out); t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.copy(tex.repeat); t.anisotropy = 4; return t;
}
const shade = (r, g, b, k) => `rgb(${Math.max(0, Math.min(255, r * k)) | 0},${Math.max(0, Math.min(255, g * k)) | 0},${Math.max(0, Math.min(255, b * k)) | 0})`;
function speckle(g, s, n, base, spread, size = 2, r = rng(5)) {
  for (let i = 0; i < n; i++) { const k = 1 + (r() - 0.5) * spread; g.fillStyle = shade(base[0], base[1], base[2], k); g.globalAlpha = 0.25 + r() * 0.35; g.fillRect(r() * s, r() * s, size * (0.5 + r()), size * (0.5 + r())); }
  g.globalAlpha = 1;
}
const drawers = {
  stone(g, s) { // coursed ashlar masonry
    const r = rng(11); g.fillStyle = '#4a4c47'; g.fillRect(0, 0, s, s);
    const rows = 8, rh = s / rows;
    for (let y = 0; y < rows; y++) {
      let x = -r() * 30; while (x < s) {
        const w = 28 + r() * 34, k = 0.82 + r() * 0.3; g.fillStyle = shade(150, 148, 138, k); g.fillRect(x + 1.5, y * rh + 1.5, w - 3, rh - 3);
        g.fillStyle = shade(255, 255, 255, 1); g.globalAlpha = 0.07; g.fillRect(x + 2, y * rh + 2, w - 4, 3); g.globalAlpha = 1; x += w;
      }
    }
    speckle(g, s, 900, [150, 148, 138], 0.5, 2, r);
  },
  plaster(g, s) { g.fillStyle = '#d8c9a4'; g.fillRect(0, 0, s, s); speckle(g, s, 1400, [216, 201, 164], 0.35, 3); },
  planks(g, s) {
    const r = rng(21); const n = 8, w = s / n;
    for (let i = 0; i < n; i++) { const k = 0.8 + r() * 0.35; g.fillStyle = shade(122, 86, 52, k); g.fillRect(i * w, 0, w, s); g.fillStyle = '#2a1c10'; g.fillRect(i * w, 0, 2, s);
      for (let j = 0; j < 14; j++) { g.strokeStyle = shade(90, 60, 34, 0.8 + r() * 0.5); g.globalAlpha = 0.4; g.beginPath(); const x = i * w + 3 + r() * (w - 6); g.moveTo(x, 0); g.lineTo(x + (r() - 0.5) * 4, s); g.stroke(); } g.globalAlpha = 1; }
  },
  roofRed(g, s) { drawTiles(g, s, [150, 74, 52]); },
  roofSlate(g, s) { drawTiles(g, s, [88, 96, 110]); },
  thatch(g, s) { g.fillStyle = '#9d7f45'; g.fillRect(0, 0, s, s); const r = rng(31); for (let i = 0; i < 2600; i++) { const k = 0.7 + r() * 0.6; g.strokeStyle = shade(190, 160, 90, k); g.globalAlpha = 0.5; const x = r() * s, y = r() * s; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 6, y + 10 + r() * 12); g.stroke(); } g.globalAlpha = 1; },
  dirt(g, s) { g.fillStyle = '#8a7650'; g.fillRect(0, 0, s, s); speckle(g, s, 2400, [138, 118, 80], 0.7, 3, rng(41)); speckle(g, s, 300, [90, 80, 60], 0.9, 5, rng(42)); },
  grass(g, s) {
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, s, s); const r = rng(51);
    for (let i = 0; i < 5200; i++) { const k = 0.7 + r() * 0.3; g.strokeStyle = `rgb(${k * 255 | 0},${k * 255 | 0},${k * 255 | 0})`; g.globalAlpha = 0.28; const x = r() * s, y = r() * s; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 3, y - 3 - r() * 5); g.stroke(); }
    g.globalAlpha = 1;
  },
  cobble(g, s) { const r = rng(61); g.fillStyle = '#5a5a54'; g.fillRect(0, 0, s, s); for (let i = 0; i < 90; i++) { const x = r() * s, y = r() * s, rad = 9 + r() * 8, k = 0.8 + r() * 0.35; g.fillStyle = shade(140, 138, 128, k); g.beginPath(); g.ellipse(x, y, rad, rad * 0.8, r() * 3, 0, 7); g.fill(); } },
  field(g, s) { g.fillStyle = '#6e5636'; g.fillRect(0, 0, s, s); for (let i = 0; i < 12; i++) { g.fillStyle = i % 2 ? '#7c6340' : '#5e472b'; g.fillRect(0, i * s / 12, s, s / 24); } speckle(g, s, 800, [110, 86, 54], 0.6); },
};
function drawTiles(g, s, base) {
  const r = rng(71); g.fillStyle = shade(base[0], base[1], base[2], 0.45); g.fillRect(0, 0, s, s);
  const rows = 12, rh = s / rows, cols = 10, cw = s / cols;
  for (let y = 0; y < rows; y++) for (let x = -1; x < cols; x++) {
    const k = 0.8 + r() * 0.35; g.fillStyle = shade(base[0], base[1], base[2], k);
    const px = x * cw + (y % 2 ? cw / 2 : 0); g.beginPath(); g.moveTo(px, y * rh); g.lineTo(px + cw, y * rh); g.lineTo(px + cw, y * rh + rh * 0.7); g.quadraticCurveTo(px + cw / 2, y * rh + rh * 1.3, px, y * rh + rh * 0.7); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(0,0,0,.35)'; g.stroke();
  }
}

export function initGfx(texSize = 256) {
  const tex = (name, repeat, size = texSize) => canvasTex(size, drawers[name], repeat);
  const std = (o) => new T.MeshStandardMaterial(o);
  const stoneT = tex('stone', [2, 2]); const roofT = tex('roofRed', [2, 2]), slateT = tex('roofSlate', [2, 2]), plankT = tex('planks', [1, 1], Math.min(texSize, 128));
  M.stone = std({ map: stoneT, normalMap: normalFrom(stoneT, 2.5), roughness: 0.95 });
  M.stoneDark = std({ map: stoneT, color: 0x9a9a9a, normalMap: M.stone.normalMap, roughness: 1 });
  M.plaster = std({ map: tex('plaster', [1, 1], Math.min(texSize, 128)), roughness: 0.92 });
  M.timber = std({ map: plankT, roughness: 0.85 });
  M.beam = std({ color: 0x4a3322, roughness: 0.9 });
  M.roofRed = std({ map: roofT, normalMap: normalFrom(roofT, 2), roughness: 0.8, side: T.DoubleSide });
  M.roofSlate = std({ map: slateT, normalMap: normalFrom(slateT, 2), roughness: 0.75, side: T.DoubleSide });
  M.thatch = std({ map: tex('thatch', [1.5, 1.5], Math.min(texSize, 128)), roughness: 1, side: T.DoubleSide });
  M.metal = std({ color: 0x8a8d92, roughness: 0.4, metalness: 0.8 });
  M.gold = std({ color: 0xe0b44a, roughness: 0.35, metalness: 0.85 });
  M.clothRed = std({ color: 0xa3282a, roughness: 0.9, side: T.DoubleSide });
  M.clothBlue = std({ color: 0x2a4f9a, roughness: 0.9, side: T.DoubleSide });
  M.clothWhite = std({ color: 0xe6e0d0, roughness: 0.95, side: T.DoubleSide });
  M.hay = std({ color: 0xc9a84a, roughness: 1 });
  M.dirt = std({ map: tex('dirt', [1, 1]), roughness: 1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  M.cobble = std({ map: tex('cobble', [1, 1], Math.min(texSize, 128)), roughness: 1 });
  M.field = std({ map: tex('field', [1, 1], Math.min(texSize, 128)), roughness: 1 });
  M.crop = std({ color: 0xc8b24a, roughness: 1 });
  M.leafy = std({ color: 0x4f7f3a, roughness: 1 });
  M.rock = std({ color: 0x7d7d76, roughness: 1, flatShading: true });
  M.window = std({ color: 0x2a2a22, emissive: 0xffb050, emissiveIntensity: 0, roughness: 0.4 });
  M.fire = new T.MeshBasicMaterial({ color: 0xff9a2a });
  M.log = std({ color: 0x6b4a2c, roughness: 1 });
  M.skin = std({ color: 0xe0b48c, roughness: 0.8 });
  M.white = std({ color: 0xffffff, roughness: 1 });
  M.grassDetail = tex('grass', [48, 48], 128);
  M.waterNormal = normalFrom(canvasTex(128, (g, s) => { const r = rng(81); g.fillStyle = '#808080'; g.fillRect(0, 0, s, s); for (let i = 0; i < 220; i++) { g.fillStyle = `rgba(${r() > 0.5 ? 255 : 0},${r() > 0.5 ? 255 : 0},255,.08)`; g.beginPath(); g.ellipse(r() * s, r() * s, 4 + r() * 14, 2 + r() * 5, r() * 3, 0, 7); g.fill(); } }, [14, 14], false), 3);
  M.waterNormal.repeat.set(14, 14);
  return M;
}
export function setWindowGlow(night) { M.window.emissiveIntensity = night * 1.6; }

// ---- geometry helpers ----
export function merge(parts) { // parts: [{g: BufferGeometry, m?: Matrix4, c?: hex color}]
  const pos = [], nor = [], uv = [], col = []; const tmp = new T.Color();
  for (const p of parts) {
    let g = p.g.index ? p.g.toNonIndexed() : p.g.clone(); if (p.m) g.applyMatrix4(p.m);
    const P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv; tmp.set(p.c === undefined ? 0xffffff : p.c);
    for (let i = 0; i < P.count; i++) { pos.push(P.getX(i), P.getY(i), P.getZ(i)); nor.push(N.getX(i), N.getY(i), N.getZ(i)); uv.push(U ? U.getX(i) : 0, U ? U.getY(i) : 0); col.push(tmp.r, tmp.g, tmp.b); }
  }
  const out = new T.BufferGeometry();
  out.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); out.setAttribute('normal', new T.Float32BufferAttribute(nor, 3));
  out.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); out.setAttribute('color', new T.Float32BufferAttribute(col, 3));
  return out;
}
export function xf(x = 0, y = 0, z = 0, sx = 1, sy = sx, sz = sx, ry = 0) {
  const m = new T.Matrix4(); m.compose(new T.Vector3(x, y, z), new T.Quaternion().setFromEuler(new T.Euler(0, ry, 0)), new T.Vector3(sx, sy, sz)); return m;
}
export function smokeTexture() { return canvasTex(64, (g, s) => { const gr = g.createRadialGradient(s / 2, s / 2, 2, s / 2, s / 2, s / 2); gr.addColorStop(0, 'rgba(255,255,255,.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, s, s); }); }

// Add gentle wind sway to an instanced/foliage material (vertex shader injection).
export function addWind(material, strength = 0.06) {
  material.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = shared.time;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
        float swPh = instanceMatrix[3].x * 0.37 + instanceMatrix[3].z * 0.29;
        #else
        float swPh = 0.0;
        #endif
        float sw = sin(uTime * 1.7 + swPh) * ${strength.toFixed(3)} * max(position.y, 0.0);
        transformed.x += sw; transformed.z += sw * 0.7;`);
  };
  material.customProgramCacheKey = () => 'wind' + strength;
  return material;
}
