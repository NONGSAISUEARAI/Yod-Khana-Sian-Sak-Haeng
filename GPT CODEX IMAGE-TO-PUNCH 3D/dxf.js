import {areaFromWorld,worldPoint,localPoint,cross,unit,mul,add,sub,dot,inside,validateArea} from './geometry.js';
// Deliberately strict boundary importer: never infer missing/unsupported CAD geometry.
export function parseDxf(text,unitOverride='auto'){
  if(text.startsWith('AutoCAD Binary DXF'))throw Error('รองรับ ASCII DXF เท่านั้น');
  const lines=text.replace(/^\uFEFF/,'').replace(/\r/g,'').split('\n');while(lines.at(-1)==='')lines.pop();
  if(lines.length%2)throw Error('DXF มี group code ไม่ครบคู่');
  const pairs=[];for(let i=0;i<lines.length;i+=2){const c=Number(lines[i].trim());if(!Number.isInteger(c))throw Error('DXF group code ไม่ถูกต้อง');pairs.push([c,lines[i+1].trim()])}
  const ins=pairs.findIndex(p=>p[0]===9&&p[1]==='$INSUNITS'),code=ins>=0?Number(pairs[ins+1]?.[1]):0;
  const scales={1:25.4,2:304.8,4:1,5:10,6:1000};
  const scale=unitOverride==='auto'?scales[code]:Number(unitOverride);
  if(!Number.isFinite(scale)||scale<=0)throw Error('ไม่พบหน่วยที่รองรับใน DXF กรุณาเลือกหน่วยก่อน Import');
  let active=false,records=[],r=null;for(let i=0;i<pairs.length;i++){const [c,v]=pairs[i];if(c===0&&v==='SECTION'){active=pairs[i+1]?.[1]==='ENTITIES';continue}if(c===0&&v==='ENDSEC'){active=false;r=null;continue}if(!active)continue;if(c===0){r={type:v,p:[]};records.push(r)}else if(r)r.p.push([c,v])}
  const get=(r,c,d=0)=>Number(r.p.find(p=>p[0]===c)?.[1]??d),layer=r=>r.p.find(p=>p[0]===8)?.[1]||'0';
  const ocs=(r,p)=>{const n=unit([get(r,210),get(r,220),get(r,230,1)]),ax=unit(cross(Math.abs(n[0])<1/64&&Math.abs(n[1])<1/64?[0,1,0]:[0,0,1],n)),ay=cross(n,ax);return add(add(mul(ax,p[0]),mul(ay,p[1])),mul(n,p[2]))};
  const outlines=[],warnings=[];
  for(let i=0;i<records.length;i++){r=records[i];let pts=[];
    try{
      if(r.type==='LWPOLYLINE'){
        if(!(get(r,70)&1))throw Error('ขอบเขตยังไม่ปิด');if(r.p.some(([c,v])=>c===42&&Number(v)!==0))throw Error('ยังไม่รองรับส่วนโค้ง bulge');
        let p;for(const [c,v]of r.p){if(c===10){p=[Number(v),NaN,get(r,38)];pts.push(p)}if(c===20&&p)p[1]=Number(v)}pts=pts.map(p=>ocs(r,p));
      }else if(r.type==='POLYLINE'){
        const verts=[];while(records[i+1]?.type==='VERTEX')verts.push(records[++i]);if(records[i+1]?.type==='SEQEND')i++;
        if(get(r,70)&(16|64))throw Error('ยังไม่รองรับ polygon/polyface mesh');if(!(get(r,70)&1))throw Error('ขอบเขตยังไม่ปิด');if(verts.some(v=>get(v,42)!==0))throw Error('ยังไม่รองรับส่วนโค้ง bulge');
        pts=verts.map(v=>get(r,70)&8?[get(v,10),get(v,20),get(v,30)]:ocs(r,[get(v,10),get(v,20),get(r,30)]));
      }else if(r.type==='3DFACE'){
        pts=[0,1,2,3].map(k=>[get(r,10+k,NaN),get(r,20+k,NaN),get(r,30+k)]);if(pts[3].some(n=>!Number.isFinite(n))||pts[3].every((n,k)=>n===pts[2][k]))pts.pop();
      }else {if(!['SEQEND','VERTEX'].includes(r.type))warnings.push(`${r.type}: ไม่ใช่ขอบเขตที่รองรับ`);continue}
      let metadata=null,reading=false,serialized='';for(const [c,v]of r.p){if(c===1001)reading=v==='FACADE_STUDIO';else if(reading&&c===1000)serialized+=v}
      if(serialized){try{if(serialized.length>14000)throw Error();metadata=JSON.parse(serialized)}catch{warnings.push(`${layer(r)}: ข้อมูล Origin ประกอบเสียหาย ใช้ค่าเริ่มต้น`)}}
      outlines.push({area:areaFromWorld(pts.map(p=>mul(p,scale)),layer(r)),opening:/__OPENING$/i.test(layer(r)),layer:layer(r),metadata});
    }catch(e){warnings.push(`${layer(r)} / ${r.type}: ${e.message}`)}
  }
  const areas=outlines.filter(o=>!o.opening).map(o=>o.area);
  for(const o of outlines.filter(o=>o.opening)){
    const points=o.area.outer.map(p=>worldPoint(o.area,p));const matches=areas.filter(a=>a.name===o.layer.replace(/__OPENING$/i,'')&&points.every(p=>Math.abs(dot(sub(p,a.base),cross(a.u,a.v)))<.05)&&points.every(p=>inside(localPoint(a,p),a.outer)));
    if(matches.length!==1){warnings.push(`${o.layer}: จับคู่ช่องเปิดกับ Area ไม่ได้อย่างชัดเจน`);continue}
    const a=matches[0],hole=points.map(p=>localPoint(a,p));a.holes.push(hole);try{validateArea(a)}catch(e){a.holes.pop();warnings.push(`${o.layer}: ${e.message}`)}
  }
  if(areas.length===0)throw Error('ไม่พบขอบเขตปิดที่ใช้งานได้\n'+warnings.slice(0,6).join('\n'));
  if(areas.length>200)throw Error('รองรับสูงสุด 200 Areas ต่อครั้ง กรุณาส่งออกเฉพาะขอบเขตฟาสาด');
  const ids=new Set();
  for(const o of outlines.filter(o=>!o.opening&&o.metadata)){
    const a=o.area,m=o.metadata;
    try{if(m.version!==1||typeof m.id!=='string'||m.id.length>100||!m.id||typeof m.name!=='string'||!Array.isArray(m.pattern?.origin))throw Error();
      const next={...a,name:m.name,pattern:{origin:m.pattern.origin.map(n=>n*scale),angle:m.pattern.angle,spacing:m.pattern.spacing*scale}};
      if(m.curtain){next.curtain=structuredClone(m.curtain);for(const key of ['spacingX','spacingY','gap','panelThickness','mullionWidth','mullionDepth','mullionOffset'])if(Number.isFinite(next.curtain[key]))next.curtain[key]*=scale;for(const key of ['customX','customY'])if(Array.isArray(next.curtain[key]))next.curtain[key]=next.curtain[key].map(n=>n*scale)}
      if(Array.isArray(next.curtain?.origin))next.curtain.origin=next.curtain.origin.map(n=>n*scale);
      validateArea(next);
      a.name=next.name;a.pattern=next.pattern;if(next.curtain)a.curtain=next.curtain;if(!ids.has(m.id)){a.id=m.id;ids.add(m.id)}else warnings.push(`${o.layer}: Area ID ซ้ำ สร้างรหัสใหม่`);
    }catch{warnings.push(`${o.layer}: ข้อมูล Origin ไม่ถูกต้อง ใช้ค่าเริ่มต้น`)}
  }
  return {areas,warnings:[...new Set(warnings)],scale};
}

// ASCII DXF R2000: explicit tables, layers and registered XDATA application.
export function buildFacadeDxf(areas){
  if(!Array.isArray(areas)||!areas.length)throw Error('ไม่มี Area สำหรับส่งออก');
  if(areas.length>200)throw Error('รองรับสูงสุด 200 Areas');areas.forEach(validateArea);
  let handle=1;
  const pairs=[],put=(c,v)=>{if(typeof v==='number'){if(!Number.isFinite(v))throw Error('พิกัด DXF ไม่ถูกต้อง');v=Number(v.toFixed(9)).toString()}pairs.push(String(c),String(v));if(c===0&&['TABLE','LTYPE','LAYER','APPID','POLYLINE','VERTEX','SEQEND'].includes(v))pairs.push('5',(handle++).toString(16).toUpperCase())};
  put(0,'SECTION');put(2,'HEADER');put(9,'$ACADVER');put(1,'AC1015');put(9,'$HANDSEED');put(5,'FACADE_NEXT_HANDLE');put(9,'$INSUNITS');put(70,4);put(9,'$MEASUREMENT');put(70,1);put(0,'ENDSEC');
  const layers=areas.flatMap((a,i)=>{const name='AREA_'+String(i+1).padStart(3,'0');return a.holes.length?[name,name+'__OPENING']:[name]});
  put(0,'SECTION');put(2,'TABLES');put(0,'TABLE');put(2,'LTYPE');put(70,1);put(0,'LTYPE');put(2,'CONTINUOUS');put(70,0);put(3,'Solid line');put(72,65);put(73,0);put(40,0);put(0,'ENDTAB');
  put(0,'TABLE');put(2,'LAYER');put(70,layers.length+1);
  for(const layer of ['0',...layers]){put(0,'LAYER');put(2,layer);put(70,0);put(62,layer.endsWith('__OPENING')?1:7);put(6,'CONTINUOUS')}
  put(0,'ENDTAB');put(0,'TABLE');put(2,'APPID');put(70,1);put(0,'APPID');put(2,'FACADE_STUDIO');put(70,0);put(0,'ENDTAB');put(0,'ENDSEC');
  put(0,'SECTION');put(2,'ENTITIES');
  areas.forEach((a,i)=>{
    const name='AREA_'+String(i+1).padStart(3,'0'),points=a.outer.map(p=>worldPoint(a,p)),frame=areaFromWorld(points);
    const radians=a.pattern.angle*Math.PI/180,direction=add(mul(a.u,Math.cos(radians)),mul(a.v,Math.sin(radians)));
    const curtain=a.curtain?structuredClone(a.curtain):null;
    if(curtain?.origin)curtain.origin=localPoint(frame,worldPoint(a,curtain.origin));
    if(curtain?.angle!=null){const r=curtain.angle*Math.PI/180,d=add(mul(a.u,Math.cos(r)),mul(a.v,Math.sin(r)));curtain.angle=Math.atan2(dot(d,frame.v),dot(d,frame.u))*180/Math.PI}
    const metadata={version:1,id:a.id,name:a.name,pattern:{origin:localPoint(frame,worldPoint(a,a.pattern.origin)),angle:Math.atan2(dot(direction,frame.v),dot(direction,frame.u))*180/Math.PI,spacing:a.pattern.spacing},...(curtain?{curtain}:{})};
    for(const [index,loop]of [a.outer,...a.holes].entries()){
      const layer=name+(index?'__OPENING':'');
      put(0,'POLYLINE');put(8,layer);put(100,'AcDbEntity');put(100,'AcDb3dPolyline');put(66,1);put(10,0);put(20,0);put(30,0);put(70,9);
      if(index===0){put(1001,'FACADE_STUDIO');const json=JSON.stringify(metadata).replace(/[\u007f-\uffff]/g,c=>'\\u'+c.charCodeAt(0).toString(16).padStart(4,'0'));if(json.length>12000)throw Error('ข้อมูล Panel overrides มากเกิน DXF กรุณาใช้ Save project หรือ Reset panel overrides');for(let offset=0;offset<json.length;offset+=240)put(1000,json.slice(offset,offset+240))}
      for(const p of loop){const world=worldPoint(a,p);put(0,'VERTEX');put(8,layer);put(100,'AcDbEntity');put(100,'AcDbVertex');put(100,'AcDb3dPolylineVertex');put(10,world[0]);put(20,world[1]);put(30,world[2]);put(70,32)}
      put(0,'SEQEND');put(8,layer);put(100,'AcDbEntity');
    }
  });
  put(0,'ENDSEC');put(0,'EOF');return pairs.join('\n').replace('FACADE_NEXT_HANDLE',(handle+256).toString(16).toUpperCase())+'\n';
}
