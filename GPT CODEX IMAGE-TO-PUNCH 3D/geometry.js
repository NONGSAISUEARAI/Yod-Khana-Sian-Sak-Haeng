import {validateCurtainSettings} from './curtain-settings.js';
// Geometry is stored in millimetres, with world Z up and local U/V on each area.
export const add=(a,b)=>a.map((v,i)=>v+b[i]);
export const sub=(a,b)=>a.map((v,i)=>v-b[i]);
export const mul=(a,s)=>a.map(v=>v*s);
export const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
export const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
export const length=a=>Math.hypot(...a);
export function unit(a){const n=length(a);if(n<1e-9)throw Error('Degenerate direction');return mul(a,1/n)}
export const worldPoint=(a,p)=>add(a.base,add(mul(a.u,p[0]),mul(a.v,p[1])));
export const localPoint=(a,p)=>[dot(sub(p,a.base),a.u),dot(sub(p,a.base),a.v)];
export const signedArea=p=>p.reduce((s,a,i)=>{const b=p[(i+1)%p.length];return s+a[0]*b[1]-b[0]*a[1]},0)/2;
const turn=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
export function onSegment(p,a,b){return Math.abs(turn(a,b,p))<1e-5&&p[0]>=Math.min(a[0],b[0])-1e-7&&p[0]<=Math.max(a[0],b[0])+1e-7&&p[1]>=Math.min(a[1],b[1])-1e-7&&p[1]<=Math.max(a[1],b[1])+1e-7}
export function inside(p,poly){let hit=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if(onSegment(p,a,b))return true;if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])hit=!hit}return hit}
export function intersects(a,b,c,d){const t=[turn(a,b,c),turn(a,b,d),turn(c,d,a),turn(c,d,b)];return(t[0]*t[1]<0&&t[2]*t[3]<0)||onSegment(a,c,d)||onSegment(b,c,d)||onSegment(c,a,b)||onSegment(d,a,b)}
function loopsIntersect(a,b){return a.some((p,i)=>b.some((q,j)=>intersects(p,a[(i+1)%a.length],q,b[(j+1)%b.length])))}
export function validateLoop(p){
  if(!Array.isArray(p)||p.length<3||p.length>5000||p.some(a=>!Array.isArray(a)||a.length!==2||a.some(n=>!Number.isFinite(n))))throw Error('ขอบเขตต้องมีจุด X,Y อย่างน้อย 3 จุด และไม่เกิน 5,000 จุด');
  for(let i=0;i<p.length;i++){if(length(sub(p[i],p[(i+1)%p.length]))<.001)throw Error('มีจุดขอบเขตซ้ำติดกัน');for(let j=i+1;j<p.length;j++){if(j===i+1||(i===0&&j===p.length-1))continue;if(intersects(p[i],p[(i+1)%p.length],p[j],p[(j+1)%p.length]))throw Error('เส้นขอบเขตตัดกันเอง')}}
  if(Math.abs(signedArea(p))<.01)throw Error('พื้นที่มีขนาดเล็กเกินไป');return p;
}
export function validateArea(a){
  validateCurtainSettings(a?.curtain);
  if(!a||typeof a.name!=='string'||a.name.length>120||!Array.isArray(a.holes)||a.holes.length>200)throw Error('ข้อมูล Area ไม่ถูกต้อง');
  for(const key of ['base','u','v'])if(!Array.isArray(a[key])||a[key].length!==3||a[key].some(v=>!Number.isFinite(v)||Math.abs(v)>1e9))throw Error('พิกัดหรือแกนไม่ถูกต้อง');
  if(Math.abs(length(a.u)-1)>1e-5||Math.abs(length(a.v)-1)>1e-5||Math.abs(dot(a.u,a.v))>1e-5)throw Error('แกน Area ต้องตั้งฉากและมีความยาวหนึ่งหน่วย');
  validateLoop(a.outer);a.holes.forEach(validateLoop);
  for(let i=0;i<a.holes.length;i++){const h=a.holes[i];if(!h.every(p=>inside(p,a.outer))||loopsIntersect(h,a.outer))throw Error('ช่องเปิดต้องอยู่ภายใน Area และไม่แตะขอบ');for(let j=0;j<i;j++)if(loopsIntersect(h,a.holes[j])||inside(h[0],a.holes[j])||inside(a.holes[j][0],h))throw Error('ช่องเปิดซ้อนกัน');}
  if(!a.pattern||!Array.isArray(a.pattern.origin)||a.pattern.origin.length!==2||a.pattern.origin.some(v=>!Number.isFinite(v))||!Number.isFinite(a.pattern.angle)||!Number.isFinite(a.pattern.spacing)||a.pattern.spacing<10)throw Error('Origin หรือระยะกริดไม่ถูกต้อง (ขั้นต่ำ 10 mm)');
  return a;
}
export const netArea=a=>(Math.abs(signedArea(a.outer))-a.holes.reduce((s,h)=>s+Math.abs(signedArea(h)),0))/1e6;
export function areaFromWorld(points,name='Area'){
  if(points.length>3&&length(sub(points[0],points.at(-1)))<.001)points=points.slice(0,-1);
  if(points.length<3||points.some(p=>p.length!==3||p.some(n=>!Number.isFinite(n))))throw Error('ขอบเขต 3D ไม่สมบูรณ์');
  const base=points[0],u=unit(sub(points[1],base));let n=[0,0,0];
  for(let i=0;i<points.length;i++)n=add(n,cross(sub(points[i],base),sub(points[(i+1)%points.length],base)));
  n=unit(n);const v=unit(cross(n,u));
  if(points.some(p=>Math.abs(dot(sub(p,base),n))>.05))throw Error('ขอบเขตไม่ได้อยู่บนระนาบเดียวกัน (คลาดเคลื่อนเกิน 0.05 mm)');
  const a={id:crypto.randomUUID(),name,base,u,v,outer:[],holes:[],visible:true,pattern:{origin:[0,0],angle:0,spacing:500}};
  a.outer=points.map(p=>localPoint(a,p));return validateArea(a);
}
export function rectangle({name='New area',width=6000,height=3600,x=0,y=0,z=0,angle=0}={}){
  if(![width,height,x,y,z,angle].every(Number.isFinite)||width<=0||height<=0)throw Error('กรอกขนาดและตำแหน่งให้ถูกต้อง');
  const r=angle*Math.PI/180,u=[Math.cos(r),Math.sin(r),0],base=[x,y,z];
  return areaFromWorld([base,add(base,mul(u,width)),add(add(base,mul(u,width)),[0,0,height]),add(base,[0,0,height])],name);
}
export function demoAreas(){const front=rectangle({name:'01 · FRONT',width:8000,height:4200});front.holes=[[[1100,1100],[2900,1100],[2900,2900],[1100,2900]],[[4700,1100],[6500,1100],[6500,2900],[4700,2900]]];const side=rectangle({name:'02 · RETURN',width:5000,height:4200,x:8000,angle:90});side.holes=[[[1500,0.1],[3000,0.1],[3000,2600],[1500,2600]]];const wing=rectangle({name:'03 · ANGLED WING',width:3500,height:4200,y:0,angle:125});return [front,side,wing]}
export function snapToBoundary(p,a,tolerance){let best=p,d=tolerance;for(const loop of [a.outer,...a.holes])for(let i=0;i<loop.length;i++){const v=loop[i],w=loop[(i+1)%loop.length],dv=length(sub(p,v));if(dv<d){best=v;d=dv}}if(best!==p)return [...best];for(const loop of [a.outer,...a.holes])for(let i=0;i<loop.length;i++){const v=loop[i],w=loop[(i+1)%loop.length],e=sub(w,v),t=Math.max(0,Math.min(1,dot(sub(p,v),e)/dot(e,e))),q=add(v,mul(e,t)),dq=length(sub(p,q));if(dq<d){best=q;d=dq}}return [...best]}
