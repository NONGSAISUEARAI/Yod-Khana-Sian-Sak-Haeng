export const defaultCurtain=()=>({enabled:false,origin:null,angle:null,spacingX:1200,spacingY:1200,gap:12,gapAtBoundary:true,panelThickness:4,panelType:'solid',panelColor:'#aeb8ae',showPanels:true,showGrid:true,showMullions:true,mullionWidth:50,mullionDepth:100,mullionOffset:-55,flipMullionSide:false,boundary:true,openings:true,customX:[],customY:[],overrides:{}});
export function curtainSettings(a){return {...defaultCurtain(),...a.curtain,overrides:{...a.curtain?.overrides}}}
export function curtainOrigin(a){const c=curtainSettings(a);return {origin:c.origin??a.pattern.origin,angle:c.angle??a.pattern.angle}}
export function validateCurtainSettings(c){
 if(c===undefined)return;
 if(!c||typeof c!=='object'||Array.isArray(c))throw Error('Curtain Wall settings ไม่ถูกต้อง');
 const s={...defaultCurtain(),...c};
 if(s.origin!==null&&(!Array.isArray(s.origin)||s.origin.length!==2||s.origin.some(n=>!Number.isFinite(n)||Math.abs(n)>1e9)))throw Error('Curtain Origin ต้องเป็น Local X,Y');
 if(s.angle!==null&&!Number.isFinite(s.angle))throw Error('Curtain axis angle ไม่ถูกต้อง');
 for(const key of ['enabled','showPanels','showGrid','showMullions','boundary','openings','gapAtBoundary','flipMullionSide'])if(typeof s[key]!=='boolean')throw Error('Curtain Wall toggle ไม่ถูกต้อง');
 for(const [key,min,max]of [['spacingX',50,1e6],['spacingY',50,1e6],['gap',0,1000],['panelThickness',.1,300],['mullionWidth',1,1000],['mullionDepth',1,2000],['mullionOffset',-5000,5000]])if(!Number.isFinite(s[key])||s[key]<min||s[key]>max)throw Error(`${key}: ต้องอยู่ระหว่าง ${min}–${max} mm`);
 if(s.gap>=Math.min(s.spacingX,s.spacingY))throw Error('Panel gap ต้องน้อยกว่าระยะกริด');
 if(!['solid','glass','open'].includes(s.panelType)||!/^#[\da-f]{6}$/i.test(s.panelColor))throw Error('Panel type หรือสีไม่ถูกต้อง');
 for(const key of ['customX','customY'])if(!Array.isArray(s[key])||s[key].length>60||s[key].some(n=>!Number.isFinite(n)||Math.abs(n)>1e8))throw Error('Custom grid ต้องเป็นระยะตัวเลขไม่เกิน 60 แนวต่อแกน');
 if(!s.overrides||typeof s.overrides!=='object'||Array.isArray(s.overrides)||Object.keys(s.overrides).length>100||Object.entries(s.overrides).some(([k,v])=>k.length>120||!['solid','glass','open'].includes(v)))throw Error('เปลี่ยน Panel ได้สูงสุด 100 ช่องต่อ Area');
}
