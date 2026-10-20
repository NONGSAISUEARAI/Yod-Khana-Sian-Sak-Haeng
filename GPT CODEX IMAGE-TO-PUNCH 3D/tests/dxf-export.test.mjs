import test from 'node:test';
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {demoAreas,rectangle,worldPoint,netArea,cross,dot,add,mul} from '../geometry.js';
import {buildFacadeDxf,parseDxf} from '../dxf.js';
const close=(a,b)=>a.forEach((n,i)=>assert.ok(Math.abs(n-b[i])<1e-6,`${a} != ${b}`));
test('export/import all planes, openings and origin metadata',()=>{
 const original=demoAreas();original[1].name='ฟาสาด ด้านข้าง';original[1].pattern={origin:[600,900],angle:32,spacing:300};original[1].visible=false;
 const text=buildFacadeDxf(original),result=parseDxf(text);
 assert.deepEqual(result.warnings,[]);assert.equal(result.scale,1);assert.equal(result.areas.length,3);
 result.areas.forEach((a,i)=>{const b=original[i];assert.equal(a.id,b.id);assert.equal(a.name,b.name);assert.equal(a.holes.length,b.holes.length);assert.ok(Math.abs(netArea(a)-netArea(b))<1e-7);a.outer.forEach((p,j)=>close(worldPoint(a,p),worldPoint(b,b.outer[j])));close(worldPoint(a,a.pattern.origin),worldPoint(b,b.pattern.origin));assert.ok(Math.abs(a.pattern.angle-b.pattern.angle)<1e-7)});
 assert.ok(text.includes('1001\nFACADE_STUDIO\n'));assert.ok(!/[^\x00-\x7F]/.test(text));
 writeFileSync(new URL('../qa-export.dxf',import.meta.url),text);
});
test('origin world position survives boundary frame changes',()=>{
 const a=rectangle({angle:125,x:200,y:400,z:600});a.outer=[[500,200],[500,2500],[4000,2500],[4000,200]];a.pattern={origin:[1800,1000],angle:17,spacing:450};
 const b=parseDxf(buildFacadeDxf([a])).areas[0];close(worldPoint(a,a.pattern.origin),worldPoint(b,b.pattern.origin));
 const direction=x=>add(mul(x.u,Math.cos(x.pattern.angle*Math.PI/180)),mul(x.v,Math.sin(x.pattern.angle*Math.PI/180)));close(direction(a),direction(b));
});
test('reject empty export; malformed XDATA keeps geometry with warning',()=>{
 assert.throws(()=>buildFacadeDxf([]));let text=buildFacadeDxf(demoAreas());text=text.replace('"version":1','"version":999');const result=parseDxf(text);assert.equal(result.areas.length,3);assert.ok(result.warnings.some(w=>w.includes('Origin')));
});
