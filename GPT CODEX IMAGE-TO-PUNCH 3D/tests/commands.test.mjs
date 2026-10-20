import test from 'node:test';
import assert from 'node:assert/strict';
import {readPoint} from '../commands.js';
import {rectangle} from '../geometry.js';
test('absolute and relative world coordinates',()=>{
 assert.deepEqual(readPoint('100,200'),[100,200,0]);
 assert.deepEqual(readPoint('@100,-50,20',{reference:[10,20,30]}),[110,-30,50]);
 assert.throws(()=>readPoint('@1,2'),/อ้างอิง/);
});
test('Local coordinate input follows the selected area plane',()=>{
 const area=rectangle({angle:90,x:1000,y:2000,z:300});
 const p=readPoint('1500,500',{area,local:true});
 assert.ok(Math.abs(p[0]-1000)<1e-8);assert.equal(p[1],3500);assert.equal(p[2],800);
 const q=readPoint('@200,400',{area,local:true,reference:p});
 assert.ok(Math.abs(q[0]-1000)<1e-8);assert.equal(q[1],3700);assert.equal(q[2],1200);
});
test('reject incomplete, nonfinite or executable coordinate input',()=>{
 for(const s of ['1,','1,,2','NaN,2','Infinity,2','1,2,3,4','alert(1),2','1e999,2'])assert.throws(()=>readPoint(s));
});
