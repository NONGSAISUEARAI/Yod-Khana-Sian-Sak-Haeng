import {demoAreas,worldPoint} from '../geometry.js';
import {writeFileSync} from 'node:fs';
let dxf='0\nSECTION\n2\nHEADER\n9\n$INSUNITS\n70\n4\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n';
for(const [i,a]of demoAreas().entries())for(const [j,loop]of [a.outer,...a.holes].entries()){
 const layer=['FRONT','RETURN','ANGLED'][i]+(j?'__OPENING':'');dxf+=`0\nPOLYLINE\n8\n${layer}\n66\n1\n70\n9\n10\n0\n20\n0\n30\n0\n`;
 for(const p of loop){const [x,y,z]=worldPoint(a,p);dxf+=`0\nVERTEX\n8\n${layer}\n70\n32\n10\n${x}\n20\n${y}\n30\n${z}\n`}
 dxf+='0\nSEQEND\n';
}dxf+='0\nENDSEC\n0\nEOF\n';writeFileSync(new URL('../samples/facade-boundaries.dxf',import.meta.url),dxf);
