import {add,sub,mul,dot,length} from './geometry.js';

export const SNAP_MODES=[{bit:1,name:'Endpoint'},{bit:2,name:'Midpoint'},{bit:128,name:'Perpendicular'},{bit:512,name:'Nearest'},{bit:1024,name:'Geometric Center'}];
export const SUPPRESS=16384,DEFAULT_OSMODE=515;
const supported=SUPPRESS|SNAP_MODES.reduce((sum,m)=>sum|m.bit,0);
export function parseOsmode(value){
 if(!/^\d+$/.test(String(value).trim()))throw Error('OSMODE ต้องเป็นจำนวนเต็มตั้งแต่ 0');
 const n=Number(value);
 if(!Number.isSafeInteger(n)||n>32767||(n&~supported))throw Error('รองรับ OSMODE: 1 Endpoint, 2 Midpoint, 128 Perpendicular, 512 Nearest, 1024 Geometric Center และ 16384 พัก Snap');
 return n;
}
export const snapEnabled=mode=>!(mode&SUPPRESS)&&SNAP_MODES.some(m=>mode&m.bit);
export function objectSnap(p,area,tolerance,mode=DEFAULT_OSMODE,reference=null){
 if(!snapEnabled(mode))return {point:[...p],type:null};
 let best=null,nearest=null;
 const consider=(point,type,fallback=false)=>{
  const distance=length(sub(p,point));if(distance>tolerance)return;
  const candidate={point:[...point],type,distance};
  if(fallback){if(!nearest||distance<nearest.distance)nearest=candidate}
  else if(!best||distance<best.distance)best=candidate;
 };
 for(const loop of [area.outer,...area.holes]){
  let twiceArea=0,cx=0,cy=0;
  for(let i=0;i<loop.length;i++){
   const v=loop[i],w=loop[(i+1)%loop.length],edge=sub(w,v),denom=dot(edge,edge);
   if(mode&1)consider(v,'Endpoint');
   if(mode&2)consider(mul(add(v,w),.5),'Midpoint');
   if(denom>1e-12){
    if(mode&512){const t=Math.max(0,Math.min(1,dot(sub(p,v),edge)/denom));consider(add(v,mul(edge,t)),'Nearest',true)}
    if((mode&128)&&reference){const t=dot(sub(reference,v),edge)/denom;if(t>=0&&t<=1)consider(add(v,mul(edge,t)),'Perpendicular')}
   }
   const c=v[0]*w[1]-w[0]*v[1];twiceArea+=c;cx+=(v[0]+w[0])*c;cy+=(v[1]+w[1])*c;
  }
  if((mode&1024)&&Math.abs(twiceArea)>1e-9)consider([cx/(3*twiceArea),cy/(3*twiceArea)],'Geometric Center');
 }
 const result=best||nearest;
 return result?{point:result.point,type:result.type}:{point:[...p],type:null};
}
