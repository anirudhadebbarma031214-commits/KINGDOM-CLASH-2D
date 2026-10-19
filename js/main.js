import { loadThree, T } from './three.js';
import { initGfx, M, merge, xf } from './gfx.js';
import { heightAt, WORLD, WATER_Y, PLAY_LIMIT, ROADS, rng, riverWeight } from './terrain.js';
import { BUILDINGS, BUILD_ORDER, UNITS, PLOT_DEFS, plotPos, CAMP, RALLY, castleUpgradeCost, armyCap, upgradeCost, armySize, QUESTS } from './data.js';
import * as S from './state.js';
import { makeCombatant, spawnCamp, step, outcome } from './sim.js';

const $ = (id) => document.getElementById(id);
let s, scene, camera, renderer, ray, plotPads = [], plotGroups = [], castleG, sel = -1;
let mode = 'home', units = [], meshes = new Map(), selected = new Set(), enemyUnits = [], bt = null;
const cam = { x: 0, z: 8, yaw: 0.6, pitch: 0.9, dist: 46 };
const msg = (t) => { const e = $('msg'); e.textContent = t; e.classList.add('on'); clearTimeout(msg.t); msg.t = setTimeout(() => e.classList.remove('on'), 2200); };
const frame = () => new Promise(r => setTimeout(r, 0));

function hud() {
  for (const r of ['wood', 'food', 'stone', 'gold']) $('r_' + r).textContent = r + ' ' + Math.floor(s.res[r]);
  $('lvl').textContent = 'Castle ' + s.level; $('army').textContent = 'Army ' + armySize(s) + '/' + armyCap(s.level) + (s.queue.length ? ' (+' + s.queue.length + ' training)' : '');
}
function panel(html) { const p = $('panel'); if (!html) { p.style.display = 'none'; return; } p.innerHTML = html; p.style.display = 'block'; }
const cost = (c) => S.costText(c);

function mkMesh(geo, mat, x, y, z) { const m = new T.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; return m; }
function buildingModel(type, level) {
  const g = new T.Group(), sc = 1 + 0.08 * (level - 1);
  const roof = level >= 3 ? M.roofSlate : M.roofRed;
  const house = (w, h, d, x = 0, z = 0, mat = M.plaster) => {
    g.add(mkMesh(new T.BoxGeometry(w, h, d), mat, x, h / 2, z));
    const sh = new T.Shape(); sh.moveTo(-w / 2 - 0.3, 0); sh.lineTo(w / 2 + 0.3, 0); sh.lineTo(0, h * 0.7); sh.closePath();
    const rg = new T.ExtrudeGeometry(sh, { depth: d + 0.6, bevelEnabled: false }); rg.translate(0, 0, -d / 2 - 0.3);
    g.add(mkMesh(rg, roof, x, h, z));
    g.add(mkMesh(new T.BoxGeometry(0.9, 1.5, 0.12), M.timber, x, 0.75, z + d / 2 + 0.05));
    g.add(mkMesh(new T.BoxGeometry(0.7, 0.7, 0.1), M.window, x + w / 2 - 0.9, h * 0.6, z + d / 2 + 0.05));
  };
  if (type === 'lumber') { house(3, 2.2, 2.4, -0.6, 0, M.timber); for (let i = 0; i < 4; i++) { const l = mkMesh(new T.CylinderGeometry(0.25, 0.25, 2.2, 8), M.log, 1.8, 0.3 + (i % 2) * 0.45, -1 + i * 0.45); l.rotation.x = Math.PI / 2; g.add(l); } }
  else if (type === 'farm') { house(2.6, 2, 2.2, -1.2, -1.3, M.timber); g.add(mkMesh(new T.BoxGeometry(5, 0.12, 2.2), M.field, 0, 0.06, 1.6)); for (let i = 0; i < 10; i++) g.add(mkMesh(new T.BoxGeometry(0.14, 0.5, 1.9), M.crop, -2.2 + i * 0.5, 0.35, 1.6)); }
  else if (type === 'quarry') { for (let i = 0; i < 6; i++) { const b = mkMesh(new T.BoxGeometry(1.1, 0.8, 0.9), M.stone, -1.8 + (i % 3) * 1.3, 0.4 + (i > 2 ? 0.8 : 0), -0.8 + (i % 2) * 1.2); b.rotation.y = i; g.add(b); } g.add(mkMesh(new T.BoxGeometry(0.2, 3, 0.2), M.beam, 2, 1.5, 1)); g.add(mkMesh(new T.BoxGeometry(2.4, 0.2, 0.2), M.beam, 1, 3, 1)); }
  else if (type === 'mine') { const m = mkMesh(new T.DodecahedronGeometry(2.6, 0), M.rock, 0, 1.2, -0.5); m.scale.y = 0.8; g.add(m); g.add(mkMesh(new T.BoxGeometry(1.6, 1.7, 0.3), M.beam, 0, 0.85, 1.7)); g.add(mkMesh(new T.BoxGeometry(1, 1.4, 0.35), new T.MeshStandardMaterial({ color: 0x050505 }), 0, 0.7, 1.75)); }
  else { house(type === 'stable' ? 4.6 : 4, 2.6, 3, 0, 0, type === 'archery' ? M.timber : M.stone); g.add(mkMesh(new T.CylinderGeometry(0.06, 0.06, 4, 6), M.beam, 2.4, 2, 1.6)); g.add(mkMesh(new T.PlaneGeometry(1.1, 0.7), M.clothRed, 2.95, 3.5, 1.6)); }
  for (let i = 1; i < level; i++) { g.add(mkMesh(new T.CylinderGeometry(0.05, 0.05, 3 + i, 6), M.beam, -2.4, (3 + i) / 2, 2)); g.add(mkMesh(new T.PlaneGeometry(0.8, 0.5), i === 1 ? M.clothBlue : M.gold, -2, 2.8 + i, 2)); }
  g.scale.setScalar(sc); return g;
}
function castleModel(level) {
  const g = new T.Group(), w = 8 + level * 0.8, kh = 6 + level * 1.4;
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    g.add(mkMesh(new T.CylinderGeometry(1.7, 1.9, kh + 2, 14), M.stone, dx * w, (kh + 2) / 2, dz * w));
    for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; g.add(mkMesh(new T.BoxGeometry(0.6, 0.7, 0.6), M.stone, dx * w + Math.cos(a) * 1.55, kh + 2.35, dz * w + Math.sin(a) * 1.55)); }
    g.add(mkMesh(new T.ConeGeometry(2, 3, 14), M.roofRed, dx * w, kh + 3.5, dz * w));
  }
  for (const [x, z, rw, rd] of [[0, -w, 2 * w, 1.2], [0, w, 2 * w, 1.2], [-w, 0, 1.2, 2 * w], [w, 0, 1.2, 2 * w]]) {
    g.add(mkMesh(new T.BoxGeometry(rw, 4.5, rd), M.stone, x, 2.25, z));
    const n = Math.floor(Math.max(rw, rd) / 1.4); for (let i = 0; i < n; i += 2) g.add(mkMesh(new T.BoxGeometry(rw > rd ? 0.7 : rw, 0.8, rw > rd ? rd : 0.7), M.stone, x + (rw > rd ? -rw / 2 + 0.7 * (i + 1) : 0), 4.9, z + (rw > rd ? 0 : -rd / 2 + 0.7 * (i + 1))));
  }
  g.add(mkMesh(new T.BoxGeometry(2.6, 3.4, 0.5), M.timber, 0, 1.7, w + 0.4)); g.add(mkMesh(new T.BoxGeometry(6, kh, 6), M.stone, 0, kh / 2, 0));
  const sh = new T.Shape(); sh.moveTo(-3.6, 0); sh.lineTo(3.6, 0); sh.lineTo(0, 3 + level * 0.4); sh.closePath(); const rg = new T.ExtrudeGeometry(sh, { depth: 6.8, bevelEnabled: false }); rg.translate(0, 0, -3.4); g.add(mkMesh(rg, level >= 4 ? M.roofSlate : M.roofRed, 0, kh, 0));
  g.add(mkMesh(new T.CylinderGeometry(0.08, 0.08, 5, 6), M.beam, 0, kh + 4, 0)); g.add(mkMesh(new T.PlaneGeometry(2.2, 1.3), M.clothRed, 1.2, kh + 5.5, 0));
  for (let i = 0; i < 6; i++) g.add(mkMesh(new T.BoxGeometry(0.7, 1.1, 0.1), M.window, -2 + (i % 3) * 2, kh * 0.55 + Math.floor(i / 3) * 1.7, 3.05));
  if (level >= 5) g.add(mkMesh(new T.ConeGeometry(0.8, 3, 8), M.gold, 0, kh + 8, 0));
  return g;
}
function refreshWorld() {
  s.plots.forEach((p, i) => {
    const key = p ? p.type + p.level + p.state : 'x';
    if (plotGroups[i] && plotGroups[i].key === key) { if (p && p.state !== 'built') { const f = 1 - p.left / p.total; plotGroups[i].g.scale.y = p.state === 'building' ? 0.15 + 0.85 * f : 1; } return; }
    if (plotGroups[i]) scene.remove(plotGroups[i].g);
    plotGroups[i] = null;
    if (p) { const g = buildingModel(p.type, p.level + (p.state === 'upgrading' ? 0 : 0)); const pos = plotPos(i); g.position.set(pos.x, heightAt(pos.x, pos.z), pos.z); g.lookAt(0, g.position.y, 0); g.userData.plot = i; scene.add(g); plotGroups[i] = { g, key }; if (p.state === 'building') g.scale.y = 0.15 + 0.85 * (1 - p.left / p.total); }
    plotPads[i].visible = !p && S.plotUnlocked(s, i);
  });
  if (!castleG || castleG.lvl !== s.level) { if (castleG) scene.remove(castleG); castleG = castleModel(s.level); castleG.lvl = s.level; castleG.position.y = heightAt(0, 0); castleG.userData.castle = 1; scene.add(castleG); }
}

async function initWorld(setP) {
  const canvas = document.createElement('canvas'); document.body.prepend(canvas);
  renderer = new T.WebGLRenderer({ canvas, antialias: true }); renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap; renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05; renderer.outputColorSpace = T.SRGBColorSpace;
  scene = new T.Scene(); scene.background = new T.Color(0x9cc4dc); scene.fog = new T.Fog(0xb4cfd8, 70, 230);
  camera = new T.PerspectiveCamera(45, 1, 0.5, 600);
  scene.add(new T.HemisphereLight(0xdfeeff, 0x4a5a35, 1.4));
  const sun = new T.DirectionalLight(0xfff0d0, 2.6); sun.position.set(-40, 60, 30); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -60, right: 60, top: 60, bottom: -60, near: 1, far: 200 }); scene.add(sun); scene.add(sun.target); scene.userData.sun = sun;
  setP('Sculpting terrain'); await frame();
  initGfx(256);
  const N = 150, geo = new T.PlaneGeometry(WORLD, WORLD, N, N); geo.rotateX(-Math.PI / 2);
  const P = geo.attributes.position, col = new Float32Array(P.count * 3), c = new T.Color();
  for (let i = 0; i < P.count; i++) {
    const x = P.getX(i), z = P.getZ(i), h = heightAt(x, z); P.setY(i, h);
    const sl = Math.abs(heightAt(x + 1.2, z) - h) + Math.abs(heightAt(x, z + 1.2) - h);
    if (h < 0.35) c.setRGB(0.62, 0.56, 0.38); else if (h > 20) c.setRGB(0.92, 0.94, 0.96); else if (sl > 1.5 || h > 11) c.setRGB(0.45, 0.45, 0.42);
    else { const k = 0.85 + (Math.sin(x * 0.3) * Math.cos(z * 0.27)) * 0.12; c.setRGB(0.3 * k, 0.5 * k, 0.2 * k); }
    col.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new T.BufferAttribute(col, 3)); geo.computeVertexNormals();
  const ground = new T.Mesh(geo, new T.MeshStandardMaterial({ vertexColors: true, roughness: 1, map: M.grassDetail })); ground.receiveShadow = true; scene.add(ground);
  const water = new T.Mesh(new T.PlaneGeometry(WORLD, WORLD), new T.MeshStandardMaterial({ color: 0x2f7f9a, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.82, normalMap: M.waterNormal })); water.rotation.x = -Math.PI / 2; water.position.y = WATER_Y; scene.add(water); scene.userData.water = water;
  setP('Planting forests'); await frame();
  const r = rng(7), trunk = new T.CylinderGeometry(0.15, 0.25, 1.8, 6), cone = new T.ConeGeometry(1.5, 3, 7);
  const treeGeo = merge([{ g: trunk, m: xf(0, 0.9, 0), c: 0x5a3d24 }, { g: cone, m: xf(0, 3, 0), c: 0x2f5d34 }, { g: cone, m: xf(0, 4.4, 0, 0.7), c: 0x3a6d3a }]);
  const pts = []; for (let i = 0; i < 4000 && pts.length < 900; i++) { const x = (r() - 0.5) * 200, z = (r() - 0.5) * 200, h = heightAt(x, z); if (h < 0.8 || Math.hypot(x, z) < 38 || Math.hypot(x - CAMP.x, z - CAMP.z) < 24 || h > 14) continue; pts.push([x, h, z]); }
  const trees = new T.InstancedMesh(treeGeo, new T.MeshStandardMaterial({ vertexColors: true, roughness: 1 }), pts.length); trees.castShadow = true; const m4 = new T.Matrix4();
  pts.forEach((p, i) => { const k = 0.7 + r() * 0.8; m4.compose(new T.Vector3(p[0], p[1], p[2]), new T.Quaternion().setFromEuler(new T.Euler(0, r() * 6, 0)), new T.Vector3(k, k * (0.9 + r() * 0.4), k)); trees.setMatrixAt(i, m4); }); scene.add(trees);
  const rocks = new T.InstancedMesh(new T.DodecahedronGeometry(1, 0), M.rock, 160); for (let i = 0; i < 160; i++) { const x = (r() - 0.5) * 190, z = (r() - 0.5) * 190, k = 0.4 + r() * 1.2; m4.compose(new T.Vector3(x, heightAt(x, z) + 0.2, z), new T.Quaternion(), new T.Vector3(k, k * 0.7, k)); rocks.setMatrixAt(i, m4); } scene.add(rocks);
  for (const road of ROADS) { const cv = new T.CatmullRomCurve3(road.map(p => new T.Vector3(p[0], 0, p[1]))), v = [], idx = [], n = 80; for (let i = 0; i <= n; i++) { const p = cv.getPoint(i / n), t = cv.getTangent(i / n), nx = -t.z, nz = t.x; for (const sd of [-1.6, 1.6]) { const x = p.x + nx * sd, z = p.z + nz * sd; v.push(x, heightAt(x, z) + 0.12, z); } if (i < n) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2); }
    const rg = new T.BufferGeometry(); rg.setAttribute('position', new T.Float32BufferAttribute(v, 3)); const uv = []; for (let i = 0; i <= n; i++) uv.push(0, i * 0.4, 1, i * 0.4); rg.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); rg.setIndex(idx); rg.computeVertexNormals(); const rm = new T.Mesh(rg, M.dirt); rm.receiveShadow = true; scene.add(rm); }
  setP('Raising the castle'); await frame();
  PLOT_DEFS.forEach((_, i) => { const p = plotPos(i), pad = new T.Mesh(new T.BoxGeometry(6, 0.3, 6), new T.MeshStandardMaterial({ color: 0xb8a572, roughness: 1 })); pad.position.set(p.x, heightAt(p.x, p.z) + 0.1, p.z); pad.userData.plotPad = i; pad.receiveShadow = true; scene.add(pad); plotPads[i] = pad; });
  const camp = new T.Group(); camp.position.set(CAMP.x, heightAt(CAMP.x, CAMP.z), CAMP.z); for (const [x, z] of [[-9, 9], [9, 9]]) { camp.add(mkMesh(new T.CylinderGeometry(1, 1.2, 6, 8), M.timber, x, 3, z)); camp.add(mkMesh(new T.ConeGeometry(1.6, 1.8, 8), M.roofRed, x, 6.9, z)); }
  for (let i = 0; i < 18; i++) { const a = i / 18 * Math.PI * 2; camp.add(mkMesh(new T.CylinderGeometry(0.2, 0.25, 3, 5), M.log, Math.cos(a) * 13, 1.5, Math.sin(a) * 13)); }
  camp.add(mkMesh(new T.ConeGeometry(2.2, 2.6, 6), M.clothRed, -4, 1.3, -3)); camp.add(mkMesh(new T.SphereGeometry(0.5, 8, 6), M.fire, 0, 0.5, 0)); scene.add(camp);
  ray = new T.Raycaster();
}

const geoms = {};
function unitMesh(u) {
  const col = u.team === 'p' ? { footman: 0x3a5aa8, archer: 0x2f7f4a, knight: 0xb0b4bc }[u.type] : { bandit: 0x7a2f26, slinger: 0x8a5a2a, chief: 0x3a1010, tower: 0x6b4a2c }[u.type];
  const g = new T.Group(), mat = new T.MeshStandardMaterial({ color: col, roughness: 0.8 });
  if (u.type === 'tower') { g.add(mkMesh(new T.CylinderGeometry(1, 1.2, 6, 8), M.timber, 0, 3, 0)); g.add(mkMesh(new T.ConeGeometry(1.6, 1.8, 8), M.roofRed, 0, 6.9, 0)); }
  else {
    const k = u.type === 'chief' ? 1.3 : 1; g.add(mkMesh(new T.BoxGeometry(0.55 * k, 0.8 * k, 0.32 * k), mat, 0, 1.1 * k, 0)); g.add(mkMesh(new T.SphereGeometry(0.17 * k, 8, 6), M.skin, 0, 1.68 * k, 0));
    const lg = mkMesh(new T.BoxGeometry(0.4 * k, 0.7 * k, 0.2 * k), M.beam, 0, 0.35 * k, 0); g.add(lg); g.userData.legs = lg;
    const wp = mkMesh(u.def.range > 3 ? new T.BoxGeometry(0.05, 0.9, 0.05) : new T.BoxGeometry(0.06, 0.9, 0.06), M.metal, 0.38 * k, 1.1 * k, 0.2); g.add(wp); g.userData.arm = wp;
    if (u.type === 'knight') { const hs = mkMesh(new T.BoxGeometry(0.9, 0.35, 0.6), M.beam, 0, 0.8, 0.6); g.add(hs); }
  }
  const bar = mkMesh(new T.PlaneGeometry(1.2, 0.12), new T.MeshBasicMaterial({ color: u.team === 'p' ? 0x44dd66 : 0xdd4444, depthTest: false }), 0, u.type === 'tower' ? 8 : 2.3, 0); bar.renderOrder = 9; bar.castShadow = false; g.add(bar); g.userData.bar = bar;
  g.userData.unit = u; scene.add(g); meshes.set(u.id, g); return g;
}
function syncUnits(t) {
  for (const u of units.concat(enemyUnits)) {
    let g = meshes.get(u.id) || unitMesh(u); const y = heightAt(u.x, u.z);
    g.position.set(u.x, y, u.z); g.rotation.y = u.facing;
    if (u.dead) { g.rotation.x = Math.min(1.5, u.deadT * 4); g.userData.bar.visible = false; if (u.deadT > 6) { scene.remove(g); meshes.delete(u.id); u.gone = true; } }
    else { const b = g.userData.bar; b.scale.x = Math.max(0.01, u.hp / u.maxHp); b.quaternion.copy(camera.quaternion); if (g.userData.legs) g.userData.legs.rotation.x = u.state === 'walk' ? Math.sin(t * 10 + u.id) * 0.5 : 0; if (g.userData.arm) g.userData.arm.rotation.x = u.state === 'attack' ? Math.sin(t * 14) * 0.9 : 0; }
    if (selected.has(u) && !u.dead) g.scale.setScalar(1.12 + Math.sin(t * 6) * 0.04); else g.scale.setScalar(1);
  }
  const rm = (u) => u.gone; units = units.filter(u => !rm(u)); enemyUnits = enemyUnits.filter(u => !rm(u));
}
function spawnHome() { for (const u of units) { const g = meshes.get(u.id); if (g) scene.remove(g); meshes.delete(u.id); } units = []; let i = 0; for (const [type, n] of Object.entries(s.army)) for (let k = 0; k < n; k++, i++) { const u = makeCombatant('p', type, -6 + (i % 8) * 1.6, 15 + Math.floor(i / 8) * 1.6); units.push(u); } }

function startBattle() {
  if (mode !== 'home') return; if (armySize(s) < 1) return msg('You have no troops');
  const sample = () => { let w = 0; for (let k = 0; k < 5; k++) { const us = spawnCamp(s.camp.cleared); let i = 0; for (const [t, n] of Object.entries(s.army)) for (let j = 0; j < n; j++, i++) { const u = makeCombatant('p', t, RALLY.x, RALLY.z + i); u.order = { kind: 'amove', x: CAMP.x, z: CAMP.z }; us.push(u); } let tt = 0; const ev = []; let o = null; while (tt < 240 && !(o = outcome(us))) { step(us, 0.2, ev); tt += 0.2; } if (o === 'win') w++; } return w; };
  const w = sample(); const f = w >= 4 ? 'Likely victory' : w >= 2 ? 'Risky' : 'Likely defeat';
  if (!confirm('Forecast: ' + f + '. Deploy your whole army against the bandit camp?')) return;
  for (const u of units) { const g = meshes.get(u.id); if (g) scene.remove(g); meshes.delete(u.id); }
  units = []; let i = 0; for (const [type, n] of Object.entries(s.army)) for (let k = 0; k < n; k++, i++) units.push(makeCombatant('p', type, RALLY.x - (i % 6) * 1.5, RALLY.z + Math.floor(i / 6) * 1.5));
  enemyUnits = spawnCamp(s.camp.cleared); mode = 'battle'; selected = new Set(units); bt = { t: 0 }; cam.x = RALLY.x + 15; cam.z = RALLY.z - 20; cam.dist = 40; panel(); setBar();
  msg('Tap/click ground to move, tap an enemy to attack. Archers stay behind!');
}
function endBattle(res) {
  const surv = { footman: 0, archer: 0, knight: 0 }; for (const u of units) if (!u.dead) surv[u.type]++;
  const r = S.applyBattle(s, { win: res === 'win', survivors: surv });
  for (const u of enemyUnits.concat(units)) { const g = meshes.get(u.id); if (g) scene.remove(g); meshes.delete(u.id); }
  enemyUnits = []; mode = 'home'; selected = new Set(); cam.x = 0; cam.z = 8; cam.dist = 46; spawnHome(); setBar();
  const q = S.checkQuests(s); S.saveState(s); hud(); refreshWorld();
  panel('<b>' + (res === 'win' ? 'VICTORY' : 'DEFEAT') + '</b><p>' + (res === 'win' ? 'Rewards: ' + cost(r.rewards) + '. ' : 'Your troops fell back; you lost food, gold and some buildings were damaged. ') + 'Troops lost: ' + r.lost + (q.length ? '<br>Quest complete: ' + q.map(x => x.title).join(', ') : '') + '</p><button onclick="document.getElementById(\'panel\').style.display=\'none\'">OK</button>');
}
function retreat() { if (mode === 'battle') endBattle('lose'); }
function setBar() { const b = mode === 'battle'; for (const id of ['bBuild', 'bTrain', 'bCastle', 'bQuest', 'bBattle']) $(id).style.display = b ? 'none' : ''; $('bSel').style.display = b ? '' : 'none'; $('bRet').style.display = b ? '' : 'none'; }

function openBuild() {
  const free = s.plots.map((p, i) => (!p && S.plotUnlocked(s, i)) ? i : -1).filter(i => i >= 0); const target = (sel >= 0 && !s.plots[sel] && S.plotUnlocked(s, sel)) ? sel : free[0];
  if (target === undefined) return panel('<b>No free plots.</b> Upgrade the castle to unlock more.');
  sel = target; highlight();
  panel('<b>Build on plot ' + (target + 1) + '</b> (tap another glowing pad to change)' + BUILD_ORDER.map(k => { const d = BUILDINGS[k], locked = s.level < d.unlock; return '<button data-b="' + k + '" ' + (locked ? 'disabled' : '') + '><b>' + d.name + '</b>' + (locked ? ' (castle ' + d.unlock + ')' : '') + '<br><small>' + d.desc + ' · ' + cost(d.cost) + '</small></button>'; }).join(''));
  $('panel').querySelectorAll('[data-b]').forEach(b => b.onclick = () => { const r = S.startBuild(s, sel, b.dataset.b); msg(r.msg); if (r.ok) { panel(); S.saveState(s); hud(); refreshWorld(); } });
}
function openTrain() {
  panel('<b>Train troops</b>' + Object.entries(UNITS).map(([k, u]) => '<button data-u="' + k + '"><b>' + u.name + '</b> (' + s.army[k] + ')<br><small>' + u.desc + ' · ' + cost(u.cost) + ' · needs ' + BUILDINGS[u.needs].name + '</small></button>').join('') + '<p>Queue: ' + (s.queue.map(q => UNITS[q.type].name + ' ' + Math.ceil(q.left) + 's').join(', ') || 'empty') + '</p>');
  $('panel').querySelectorAll('[data-u]').forEach(b => b.onclick = () => { const r = S.trainUnit(s, b.dataset.u); msg(r.msg); hud(); S.saveState(s); openTrain(); });
}
function openPlot(i) {
  const p = s.plots[i]; sel = i; highlight(); if (!p) return openBuild();
  const d = BUILDINGS[p.type], up = p.level < 3 && p.level < s.level ? upgradeCost(p.type, p.level) : null;
  panel('<b>' + d.name + ' · level ' + p.level + '</b><p>' + d.desc + '<br>Condition ' + Math.round(p.hp) + '%' + (p.state !== 'built' ? '<br>' + p.state + ' ' + Math.ceil(p.left) + 's left' : '') + '</p>' + (up ? '<button id="pu">Upgrade · ' + cost(up) + '</button>' : '<small>Upgrade the castle to raise the max level.</small>') + (p.hp < 100 ? '<button id="pr">Repair · ' + cost(S.repairCost(p)) + '</button>' : ''));
  if ($('pu')) $('pu').onclick = () => { const r = S.startUpgrade(s, i); msg(r.msg); hud(); refreshWorld(); openPlot(i); };
  if ($('pr')) $('pr').onclick = () => { const r = S.repair(s, i); msg(r.msg); hud(); openPlot(i); };
}
function openCastle() {
  if (s.level >= 5) return panel('<b>Your castle is at its highest level.</b>');
  const c = castleUpgradeCost(s.level); panel('<b>Castle level ' + s.level + '</b><p>Upgrade to ' + (s.level + 1) + ' costs ' + cost(c) + '</p><button id="cu">Upgrade castle</button>');
  $('cu').onclick = () => { const r = S.upgradeCastle(s); msg(r.msg); hud(); refreshWorld(); S.saveState(s); panel(); };
}
function openQuests() { panel('<b>Quests</b>' + S.questList(s).map(q => '<p>' + (q.done ? '✔ ' : '• ') + '<b>' + q.title + '</b><br><small>' + q.desc + ' Reward: ' + cost(q.reward) + '</small></p>').join('')); }
function highlight() { plotPads.forEach((p, i) => p.material.color.setHex(i === sel ? 0xf1c879 : 0xb8a572)); }

function pick(e) {
  const r = renderer.domElement.getBoundingClientRect(), v = new T.Vector2((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(v, camera);
  if (mode === 'battle') {
    const um = [...meshes.values()]; const hits = ray.intersectObjects(um, true);
    for (const h of hits) { let o = h.object; while (o && !o.userData.unit) o = o.parent; if (o) { const u = o.userData.unit; if (u.dead) continue; if (u.team === 'e') { selected.forEach(a => a.order = { kind: 'attack', target: u }); return; } selected = new Set([u]); return; } }
    const gh = ray.intersectObjects(scene.children.filter(o => o.isMesh && o.geometry && o.geometry.attributes && o.geometry.attributes.color && !o.isInstancedMesh), false)[0];
    if (gh) { const n = selected.size; let i = 0; selected.forEach(u => { u.order = { kind: 'amove', x: gh.point.x + (i % 4) * 1.4, z: gh.point.z + Math.floor(i / 4) * 1.4 }; i++; }); }
    return;
  }
  const cands = [...plotPads.filter(p => p.visible), ...plotGroups.filter(Boolean).map(g => g.g)]; const hits = ray.intersectObjects(cands, true);
  for (const h of hits) { let o = h.object; while (o && o.userData.plot === undefined && o.userData.plotPad === undefined) o = o.parent; if (o) { openPlot(o.userData.plot !== undefined ? o.userData.plot : o.userData.plotPad); return; } }
  panel(); sel = -1; highlight();
}

function setupInput() {
  const el = renderer.domElement, ptr = new Map(); let moved = 0, pinch = 0;
  el.addEventListener('pointerdown', e => { el.setPointerCapture(e.pointerId); ptr.set(e.pointerId, { x: e.clientX, y: e.clientY, b: e.button }); moved = 0; pinch = 0; });
  el.addEventListener('pointermove', e => {
    const p = ptr.get(e.pointerId); if (!p) return; const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY; moved += Math.abs(dx) + Math.abs(dy);
    if (ptr.size === 2) { const [a, b] = [...ptr.values()], d = Math.hypot(a.x - b.x, a.y - b.y); if (pinch) cam.dist = Math.max(14, Math.min(90, cam.dist * pinch / d)); pinch = d; return; }
    if (p.b === 2 || e.shiftKey) { cam.yaw -= dx * 0.006; cam.pitch = Math.max(0.35, Math.min(1.35, cam.pitch + dy * 0.004)); }
    else { const k = cam.dist * 0.0022; cam.x -= (dx * Math.cos(cam.yaw) + dy * Math.sin(cam.yaw)) * k; cam.z -= (-dx * Math.sin(cam.yaw) + dy * Math.cos(cam.yaw)) * k; }
  });
  el.addEventListener('pointerup', e => { const p = ptr.get(e.pointerId); ptr.delete(e.pointerId); if (p && moved < 8 && ptr.size === 0) pick(e); });
  el.addEventListener('contextmenu', e => e.preventDefault());
  el.addEventListener('wheel', e => { cam.dist = Math.max(14, Math.min(90, cam.dist + e.deltaY * 0.05)); e.preventDefault(); }, { passive: false });
  const keys = {}; addEventListener('keydown', e => { keys[e.key.toLowerCase()] = 1; }); addEventListener('keyup', e => { keys[e.key.toLowerCase()] = 0; }); setupInput.keys = keys;
}
function updateCam(dt) {
  const k = setupInput.keys || {}, sp = cam.dist * 0.9 * dt;
  const fx = -Math.sin(cam.yaw), fz = -Math.cos(cam.yaw);
  if (k.w || k.arrowup) { cam.x += fx * sp; cam.z += fz * sp; } if (k.s || k.arrowdown) { cam.x -= fx * sp; cam.z -= fz * sp; }
  if (k.a || k.arrowleft) { cam.x += fz * sp; cam.z -= fx * sp; } if (k.d || k.arrowright) { cam.x -= fz * sp; cam.z += fx * sp; }
  if (k.q) cam.yaw += dt; if (k.e) cam.yaw -= dt;
  cam.x = Math.max(-PLAY_LIMIT, Math.min(PLAY_LIMIT, cam.x)); cam.z = Math.max(-PLAY_LIMIT, Math.min(PLAY_LIMIT, cam.z));
  const ty = heightAt(cam.x, cam.z); const cp = new T.Vector3(cam.x + Math.sin(cam.yaw) * Math.cos(cam.pitch) * cam.dist, 0, cam.z + Math.cos(cam.yaw) * Math.cos(cam.pitch) * cam.dist);
  cp.y = Math.max(ty + Math.sin(cam.pitch) * cam.dist, heightAt(cp.x, cp.z) + 2.5, WATER_Y + 2); camera.position.lerp(cp, 0.2); camera.lookAt(cam.x, ty, cam.z);
}

let last = performance.now(), acc = 0, tsec = 0, started = false;
function loop(now) {
  requestAnimationFrame(loop); const dt = Math.min(0.1, (now - last) / 1000); last = now; tsec += dt;
  if (!started) { cam.yaw += dt * 0.12; }
  if (started) {
    const ev = S.tick(s, dt); s.tod = (s.tod + dt / 420) % 1;
    for (const e of ev) { msg(e.type === 'trained' ? UNITS[e.unit].name + ' trained' : e.name + (e.type === 'built' ? ' completed' : ' upgraded')); if (e.type === 'trained' && mode === 'home') units.push(makeCombatant('p', e.unit, 0, 14)); if (e.type !== 'trained') refreshWorld(); }
    if (mode === 'battle') { const evs = []; step(units.concat(enemyUnits), dt, evs); const o = outcome(units.concat(enemyUnits)); if (o) endBattle(o); }
    else for (const u of units) if (u.state !== 'walk' && u.order.kind === 'idle' && Math.random() < dt * 0.1) u.order = { kind: 'move', x: u.x + (Math.random() - 0.5) * 6, z: Math.max(12, Math.min(20, u.z + (Math.random() - 0.5) * 6)) };
    if (mode === 'home') step(units, dt, []);
    acc += dt; if (acc > 1) { acc = 0; hud(); if (S.checkQuests(s).length) msg('Quest complete!'); S.saveState(s); }
    refreshWorld();
  }
  const a = (s ? s.tod : 0.4) * Math.PI * 2, el = Math.sin((a - Math.PI / 2)), day = Math.max(0, Math.min(1, el * 2 + 0.3));
  const sun = scene.userData.sun; sun.position.set(cam.x + Math.cos(a) * 60, 30 + Math.abs(el) * 40, cam.z + 30); sun.target.position.set(cam.x, 0, cam.z); sun.intensity = 0.2 + 2.4 * day;
  scene.background.setRGB(0.05 + 0.55 * day, 0.07 + 0.75 * day, 0.15 + 0.85 * day); scene.fog.color.copy(scene.background); M.window.emissiveIntensity = (1 - day) * 1.6;
  if (scene.userData.water) scene.userData.water.material.normalMap.offset.set(tsec * 0.01, tsec * 0.008);
  updateCam(dt); syncUnits(tsec); renderer.render(scene, camera);
}
function resize() { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }

async function boot() {
  const setP = (t) => { $('ovt').textContent = t + '…'; };
  if (!(function () { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; } })()) { $('ovt').textContent = 'WebGL is not available in this browser. Please use a current browser with hardware acceleration enabled.'; return; }
  try { setP('Loading engine'); await frame(); await loadThree(); await initWorld(setP); }
  catch (e) { console.error(e); $('ovt').textContent = 'Could not start the 3D engine: ' + (e.message || e) + '. Check your connection and reload.'; return; }
  setupInput(); resize(); addEventListener('resize', resize); s = S.newState(); hud(); refreshWorld(); requestAnimationFrame(loop);
  $('ovt').textContent = 'Rise of the Realm'; $('menu').style.display = 'block'; $('cont').disabled = !S.hasSave();
  const go = (st) => { s = st; spawnHome(); highlight(); setBar(); hud(); refreshWorld(); $('ov').style.display = 'none'; started = true; cam.yaw = 0.6; };
  $('cont').onclick = () => { const st = S.loadState(); if (!st) return msg('No save found'); const off = S.offlineProgress(st, (Date.now() - st.savedAt) / 1000); go(st); if (off.seconds > 20) msg('While you were away: ' + cost(off.gained)); };
  $('newg').onclick = () => { if (S.hasSave() && !confirm('Erase your saved kingdom and start fresh?')) return; go(S.newState()); };
  $('bBuild').onclick = openBuild; $('bTrain').onclick = openTrain; $('bCastle').onclick = openCastle; $('bQuest').onclick = openQuests; $('bBattle').onclick = startBattle; $('bRet').onclick = retreat;
  $('bSel').onclick = () => { selected = new Set(units.filter(u => !u.dead)); msg('All troops selected'); };
  window.KC = { get s() { return s; }, S, startBattle, units: () => units, enemies: () => enemyUnits };
}
boot();
