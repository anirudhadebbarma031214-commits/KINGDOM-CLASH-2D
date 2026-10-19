import { makeCombatant, spawnCamp, step, outcome } from '../js/sim.js';
import { CAMP, RALLY } from '../js/data.js';
function run(army, cleared, focus=false){
  const units=spawnCamp(cleared);
  let i=0;
  for(const [type,n] of Object.entries(army)) for(let k=0;k<n;k++){ const u=makeCombatant('p',type,RALLY.x-(i%6)*1.2,RALLY.z+Math.floor(i/6)*1.2); u.order={kind:'amove',x:CAMP.x,z:CAMP.z}; units.push(u); i++; }
  const ev=[]; let t=0;
  while(t<300){ step(units,0.1,ev); t+=0.1; const o=outcome(units); if(o) return {o,t:t|0,left:units.filter(u=>u.team==='p'&&!u.dead).length}; }
  return {o:'timeout',t,left:0};
}
function stats(army,cleared,n=30){let w=0,l=0,left=0;for(let i=0;i<n;i++){const r=run(army,cleared);if(r.o==='win'){w++;left+=r.left}else l++;}return `win ${w}/${n} avgSurvivors ${(left/Math.max(1,w)).toFixed(1)}`}
const cases=[
 [{footman:6,archer:3,knight:0},0],
 [{footman:8,archer:4,knight:0},0],
 [{footman:10,archer:5,knight:0},0],
 [{footman:12,archer:6,knight:0},0],
 [{footman:12,archer:6,knight:0},1],
 [{footman:14,archer:8,knight:2},2],
 [{footman:16,archer:10,knight:6},4],
];
for(const [a,c] of cases) console.log(JSON.stringify(a),'cleared',c,stats(a,c));
console.log('--- scaling');
for(const [a,c] of [[{footman:10,archer:6,knight:0},3],[{footman:10,archer:6,knight:0},5],[{footman:12,archer:8,knight:4},5],[{footman:14,archer:10,knight:8},8],[{footman:20,archer:12,knight:10},8],[{footman:9,archer:4,knight:0},0]]) console.log(JSON.stringify(a),'cleared',c,stats(a,c));
