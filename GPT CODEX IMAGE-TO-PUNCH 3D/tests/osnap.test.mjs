import test from 'node:test';
import assert from 'node:assert/strict';
import {objectSnap,parseOsmode,snapEnabled,SUPPRESS} from '../osnap.js';
const area={outer:[[0,0],[1000,0],[1000,800],[0,800]],holes:[[[100,100],[300,100],[300,300],[100,300]]]};
test('OSMODE bitcodes, suppression and strict unsupported-mode validation',()=>{
 assert.equal(parseOsmode('515'),515);assert.equal(parseOsmode('0'),0);
 for(const v of ['3.5','-1','abc','4','32','32768','4294967296'])assert.throws(()=>parseOsmode(v));
 assert.equal(snapEnabled(3|SUPPRESS),false);assert.equal(snapEnabled(0),false);assert.equal(snapEnabled(3),true);
});
test('endpoint, midpoint, nearest and holes obey selected modes and aperture',()=>{
 assert.deepEqual(objectSnap([5,4],area,10,1),{point:[0,0],type:'Endpoint'});
 assert.deepEqual(objectSnap([502,4],area,10,2),{point:[500,0],type:'Midpoint'});
 assert.deepEqual(objectSnap([502,4],area,10,1),{point:[502,4],type:null});
 assert.deepEqual(objectSnap([432,4],area,10,512),{point:[432,0],type:'Nearest'});
 assert.deepEqual(objectSnap([200,104],area,10,2),{point:[200,100],type:'Midpoint'});
 assert.equal(objectSnap([500,2],area,10,514).type,'Midpoint');
 assert.equal(objectSnap([5,4],area,10,16385).type,null);
});
test('perpendicular requires a reference and bounded foot; centroid is polygon geometric center',()=>{
 assert.deepEqual(objectSnap([402,4],area,10,128,[400,500]),{point:[400,0],type:'Perpendicular'});
 assert.equal(objectSnap([402,4],area,10,128).type,null);
 assert.deepEqual(objectSnap([502,402],area,10,1024),{point:[500,400],type:'Geometric Center'});
 const triangle={outer:[[0,0],[900,0],[0,600]],holes:[]};
 assert.deepEqual(objectSnap([302,201],triangle,10,1024).point,[300,200]);
});
