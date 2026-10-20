import test from 'node:test';
import assert from 'node:assert/strict';
import {rectangle,demoAreas,signedArea,inside,validateArea,worldPoint} from '../geometry.js';
import {curtainOrigin} from '../curtain-settings.js';
import {buildCurtainLayout,clipLine} from '../curtain.js';
import {buildFacadeDxf,parseDxf} from '../dxf.js';
const area=p=>Math.abs(signedArea(p[0]))-p.slice(1).reduce((s,r)=>s+Math.abs(signedArea(r)),0);
test('grid partitions a rectangle into panels and adjusts to origin',()=>{const a=rectangle({width:4000,height:3000});a.curtain={enabled:true,spacingX:1000,spacingY:1000,gap:0};let r=buildCurtainLayout(a);assert.equal(r.panels.length,12);assert.equal(r.panelArea,12);a.pattern.origin=[500,0];r=buildCurtainLayout(a);assert.equal(r.panels.length,15);assert.equal(r.panelArea,12)});
test('holes and concave boundaries are cut from panel geometry',()=>{const a=rectangle({width:4000,height:3000});a.outer=[[0,0],[4000,0],[4000,2000],[2000,2000],[2000,3000],[0,3000]];a.holes=[[[500,500],[1500,500],[1500,1500],[500,1500]]];a.curtain={enabled:true,spacingX:1000,spacingY:1000,gap:0};validateArea(a);const r=buildCurtainLayout(a);assert.ok(Math.abs(r.panelArea-9)<1e-8);assert.ok(r.panels.every(p=>p.rings[0].every(q=>inside(q,a.outer))))});
test('grid centerlines and mullion footprints avoid openings',()=>{const a=demoAreas()[0];a.curtain={enabled:true,spacingX:2000,spacingY:2000,gap:0};const r=buildCurtainLayout(a);assert.ok(r.mullions.length>0);for(const m of r.mullions)for(const poly of m.rings){assert.ok(area(poly)>0);for(const ring of poly)for(const p of ring)assert.ok(inside(p,a.outer))}const pieces=clipLine([2000,0],[2000,4200],a.outer,a.holes);assert.equal(pieces.length,2);assert.deepEqual(pieces[0],[[2000,0],[2000,1100]]);assert.deepEqual(pieces[1],[[2000,2900],[2000,4200]])});
test('rotated curtain grid preserves net area with zero gap',()=>{const a=demoAreas()[0];a.curtain={enabled:true,spacingX:2000,spacingY:1700,gap:0};a.pattern.angle=37;const r=buildCurtainLayout(a);assert.ok(Math.abs(r.panelArea-27.12)<1e-6)});
test('custom lines, per-panel types, invalid values and limits',()=>{const a=rectangle({width:4000,height:3000});a.curtain={enabled:true,spacingX:2000,spacingY:3000,customX:[750],customY:[],gap:0};let r=buildCurtainLayout(a);assert.equal(r.panels.length,3);a.curtain.overrides={[r.panels[0].key]:'open'};r=buildCurtainLayout(a);assert.equal(r.panels[0].type,'open');assert.ok(r.panelArea<12);a.curtain.gap=2000;assert.throws(()=>validateArea(a));a.curtain.gap=0;a.curtain.spacingX=1;assert.throws(()=>buildCurtainLayout(a))});
test('Curtain settings survive JSON and DXF round trip',()=>{const a=rectangle();a.curtain={enabled:true,spacingX:1500,spacingY:900,gap:10,mullionWidth:60,mullionDepth:150,mullionOffset:-80,customX:[500],customY:[700],overrides:{}};const p=buildCurtainLayout(a).panels[0];a.curtain.overrides[p.key]='glass';const restored=parseDxf(buildFacadeDxf([a])).areas[0];assert.deepEqual(restored.curtain,a.curtain);assert.equal(buildCurtainLayout(restored).panels[0].type,'glass')});
test('boundary gap toggles perimeter offset without changing internal joints or mullions',()=>{
 const a=rectangle({width:4000,height:3000});a.curtain={enabled:true,spacingX:2000,spacingY:3000,gap:20,gapAtBoundary:true};const inset=buildCurtainLayout(a);a.curtain.gapAtBoundary=false;const flush=buildCurtainLayout(a);
 const xs=r=>r.panels.flatMap(p=>p.rings[0].map(p=>p[0]));assert.equal(Math.min(...xs(inset)),10);assert.equal(Math.max(...xs(inset)),3990);assert.equal(Math.min(...xs(flush)),0);assert.equal(Math.max(...xs(flush)),4000);assert.ok(Math.abs(flush.panelArea-11.94)<1e-8);
 assert.equal(Math.min(...flush.panels[1].rings[0].map(p=>p[0]))-Math.max(...flush.panels[0].rings[0].map(p=>p[0])),20);assert.deepEqual(inset.mullions,flush.mullions);
 a.curtain.gapAtBoundary=false;assert.equal(parseDxf(buildFacadeDxf([a])).areas[0].curtain.gapAtBoundary,false);
});
test('actual sloped boundary is offset, independent of bounding box and grid direction',()=>{
 const a=rectangle();a.outer=[[0,0],[4000,0],[0,3000]];a.pattern.angle=23;a.curtain={enabled:true,spacingX:10000,spacingY:10000,gap:20,gapAtBoundary:true};const inset=buildCurtainLayout(a);
 for(const panel of inset.panels)for(const p of panel.rings[0]){assert.ok(p[0]>=9.998);assert.ok(p[1]>=9.998);assert.ok((12000-3*p[0]-4*p[1])/5>=9.998)}
 a.curtain.gapAtBoundary=false;const flush=buildCurtainLayout(a);assert.ok(flush.panels.some(p=>p.rings[0].some(p=>Math.abs((12000-3*p[0]-4*p[1])/5)<.001)));
});
test('Curtain Origin and axes are independent of Pattern Origin once set',()=>{
 const a=rectangle();a.curtain={enabled:true,origin:[500,700],angle:15};const before=buildCurtainLayout(a);a.pattern.origin=[1300,900];a.pattern.angle=43;const after=buildCurtainLayout(a);assert.deepEqual(after.panels,before.panels);assert.deepEqual(after.mullions,before.mullions);assert.deepEqual(curtainOrigin(a),{origin:[500,700],angle:15});
 a.curtain.origin=[NaN,10];assert.throws(()=>validateArea(a),/Curtain Origin/);
});
test('independent Curtain Origin survives a changed DXF boundary coordinate frame',()=>{
 const a=rectangle({angle:125,x:200,y:500,z:600});a.outer=[[500,200],[500,2500],[4000,2500],[4000,200]];a.curtain={enabled:true,origin:[1800,1100],angle:23};const b=parseDxf(buildFacadeDxf([a])).areas[0];const p=worldPoint(a,curtainOrigin(a).origin),q=worldPoint(b,curtainOrigin(b).origin);p.forEach((n,i)=>assert.ok(Math.abs(n-q[i])<1e-6));
 const panels=buildCurtainLayout(a).panels,restored=buildCurtainLayout(b).panels;assert.equal(panels.length,restored.length);assert.ok(Math.abs(panels.reduce((s,p)=>s+p.area,0)-restored.reduce((s,p)=>s+p.area,0))<1e-6);
});
