import { heightAt, isWater, slopeAt, BRIDGE, ROADS, riverX, distToRoad } from '../js/terrain.js';
import { PLOT_DEFS, plotPos, CAMP, RALLY } from '../js/data.js';
let bad=0;
PLOT_DEFS.forEach((_,i)=>{const p=plotPos(i);const h=heightAt(p.x,p.z),s=slopeAt(p.x,p.z);const dr=distToRoad(p.x,p.z);if(h<0.5||s>0.25||dr<4.2){bad++;console.log('plot',i,'h',h.toFixed(2),'slope',s.toFixed(2),'roadDist',dr.toFixed(1))}});
console.log('castle h',heightAt(0,0).toFixed(2),'gate',heightAt(0,12).toFixed(2),'camp',heightAt(CAMP.x,CAMP.z).toFixed(2),'rally',heightAt(RALLY.x,RALLY.z).toFixed(2),'rallyWater',isWater(RALLY.x,RALLY.z));
console.log('bridge ends',heightAt(BRIDGE.x0,BRIDGE.z).toFixed(2),heightAt(BRIDGE.x1,BRIDGE.z).toFixed(2),'river mid',heightAt(riverX(BRIDGE.z),BRIDGE.z).toFixed(2));
let mn=1e9,mx=-1e9;for(let x=-120;x<=120;x+=4)for(let z=-120;z<=120;z+=4){const h=heightAt(x,z);mn=Math.min(mn,h);mx=Math.max(mx,h)}console.log('range',mn.toFixed(1),mx.toFixed(1));
for(const r of ROADS){let wet=0,steep=0;for(let i=0;i<r.length-1;i++)for(let t=0;t<1;t+=.05){const x=r[i][0]+(r[i+1][0]-r[i][0])*t,z=r[i][1]+(r[i+1][1]-r[i][1])*t;if(isWater(x,z))wet++;if(slopeAt(x,z)>.45)steep++}console.log('road wet pts',wet,'steep pts',steep)}
console.log('bad plots',bad);
