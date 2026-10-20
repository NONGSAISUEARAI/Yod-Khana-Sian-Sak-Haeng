import {objectSnap} from './osnap.js';
import {setupObjectSnap} from './osnap-ui.js';
import * as THREE from 'three';
import {OrbitControls} from './vendor/OrbitControls.js';
import {add,sub,mul,dot,cross,length,worldPoint,localPoint,netArea,validateArea,rectangle,demoAreas} from './geometry.js';
import {parseDxf,buildFacadeDxf} from './dxf.js';
import {createCommandLine} from './commands.js';
import {configureNavigation,installSurfaceZoom} from './navigation.js';
import {setupPropertiesPanel} from './properties-ui.js';
import {mountCurtainProperties,updateCurtainProperties,bindCurtainProperties} from './curtain-ui.js';
import {buildCurtainLayout} from './curtain.js';
import {renderCurtain} from './curtain-render.js';
import {curtainSettings,curtainOrigin} from './curtain-settings.js';
import {selectAreaIds,editAreaGroup} from './area-selection.js';

const $=s=>document.querySelector(s),v3=a=>new THREE.Vector3(...a),clone=a=>structuredClone(a);
mountCurtainProperties();setupPropertiesPanel();
const storageKey='facade-studio-areas-v1';
let areas=[],selectedId=null,history=[],pickMode=null,planeView=false,pendingImport=null,toastTimer,projectName='Untitled facade';
let commandLine=null;
const osnap=setupObjectSnap(()=>commandLine?.refresh());
let selectedIds=new Set();
const selectionBar=document.createElement('div');selectionBar.className='area-selection-tools';selectionBar.innerHTML='<span id="selected-area-count">0 selected</span><button id="select-all-areas">All</button><button id="clear-area-selection">Clear</button>';$('#area-list').before(selectionBar);
const selectionNote=document.createElement('div');selectionNote.id='multi-area-note';selectionNote.hidden=true;$('#inspector').prepend(selectionNote);
let standardView=null;
const worldViews={top:{normal:[0,0,1],up:[0,1,0]},left:{normal:[-1,0,0],up:[0,0,1]},right:{normal:[1,0,0],up:[0,0,1]},front:{normal:[0,-1,0],up:[0,0,1]},back:{normal:[0,1,0],up:[0,0,1]}};
let selectedPanelKey=null;
const curtainCache=new Map();
function getCurtainLayout(a){const key=JSON.stringify([a.outer,a.holes,a.pattern,a.curtain]);const cached=curtainCache.get(a.id);if(cached?.key===key)return cached.layout;const layout=buildCurtainLayout(a);curtainCache.set(a.id,{key,layout});return layout}
function validateCurtainAreas(list){let panels=0,members=0;for(const a of list){const layout=getCurtainLayout(a);if(layout){panels+=layout.panels.length;members+=layout.mullions.length}if(panels>5000||members>10000)throw Error('Curtain Wall รวมเกิน 5,000 panels / 10,000 members กรุณาเพิ่ม spacing')}}
function validateCurtainScene(candidate){validateCurtainAreas(areas.map(a=>a.id===candidate.id?candidate:a))}
function interactionPoint(hit){const a=areas.find(a=>a.id===hit.object.userData.areaId);return a&&hit.object.userData.panelKey?worldPoint(a,localPoint(a,hit.point.toArray())):hit.point.toArray()}
const view=$('#viewport'),scene=new THREE.Scene();scene.background=new THREE.Color('#171e1b');
let renderer;
try{renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.domElement.setAttribute('aria-label','Interactive 3D facade areas');renderer.domElement.tabIndex=0;view.prepend(renderer.domElement)}catch(e){$('#webgl-error').hidden=false;$('#webgl-error').textContent='3D requires WebGL. Enable hardware acceleration and reopen this page.';throw e}
const perspectiveCamera=new THREE.PerspectiveCamera(40,1,1,1e8),orthographicCamera=new THREE.OrthographicCamera(-5000,5000,5000,-5000,.1,1e8);
let camera=perspectiveCamera;camera.up.set(0,0,1);
const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.12;configureNavigation(controls,()=>planeView||!!standardView);
const surfaces=new THREE.Group(),outlines=new THREE.Group(),originHelpers=new THREE.Group();scene.add(surfaces,outlines,originHelpers);
const curtainMembers=new THREE.Group();scene.add(curtainMembers);scene.add(new THREE.HemisphereLight(0xe5f0e8,0x51665b,2.2));const curtainSun=new THREE.DirectionalLight(0xfff1d9,2.2);curtainSun.position.set(5000,-10000,12000);scene.add(curtainSun);
const ground=new THREE.GridHelper(60000,60,0x495b4f,0x29382f);ground.rotation.x=Math.PI/2;ground.position.z=-20;scene.add(ground);
const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();let pointerDown=null;
installSurfaceZoom(controls,event=>{const rect=renderer.domElement.getBoundingClientRect();pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);const hit=raycaster.intersectObjects([...surfaces.children,...curtainMembers.children]).find(h=>h.object.isMesh&&h.object.material.visible!==false);return hit?.point.toArray()});
const commandMarker=new THREE.Mesh(new THREE.SphereGeometry(1,12,8),new THREE.MeshBasicMaterial({color:0xf3cb8a,depthTest:false}));commandMarker.visible=false;commandMarker.renderOrder=10;scene.add(commandMarker);
const selected=()=>areas.find(a=>a.id===selectedId);
const fmt=n=>Number(n.toFixed(2)).toLocaleString('en-US',{maximumFractionDigits:2});
function notify(message,error=false){$('#status').textContent=message;if(error){clearTimeout(toastTimer);$('#toast').textContent=message;$('#toast').hidden=false;toastTimer=setTimeout(()=>$('#toast').hidden=true,6500)}}
function snapshot(){return {format:'facade-studio',version:1,units:'mm',name:projectName,areas:clone(areas),selectedId,selectedIds:[...selectedIds]}}
function saveLocal(){try{localStorage.setItem(storageKey,JSON.stringify(snapshot()))}catch{notify('Local auto-save unavailable — use Save project',true)}}
function checkpoint(){history.push(snapshot());if(history.length>40)history.shift();$('#undo').disabled=false}
function validProject(p){if(p?.format!=='facade-studio'||p.version!==1||p.units!=='mm'||!Array.isArray(p.areas)||p.areas.length>200)throw Error('ไฟล์นี้ไม่ใช่ Facade Studio project รุ่นที่รองรับ');const ids=new Set();for(const a of p.areas){validateArea(a);if(typeof a.id!=='string'||ids.has(a.id))throw Error('Area ID ไม่ถูกต้อง');ids.add(a.id)}validateCurtainAreas(p.areas);return p}
function loadProject(p){validProject(p);commandLine?.cancel(false);areas=clone(p.areas);selectedId=p.selectedId===null?null:areas.some(a=>a.id===p.selectedId)?p.selectedId:areas[0]?.id;selectedIds=new Set(Array.isArray(p.selectedIds)?p.selectedIds.filter(id=>areas.some(a=>a.id===id)):[selectedId].filter(Boolean));projectName=typeof p.name==='string'?p.name:'Untitled facade';cancelPick();planeView=false;sync();fitAll()}
function commitArea(mutator,message){const current=selected();if(!current)return false;try{const next=clone(current);mutator(next);validateArea(next);validateCurtainScene(next);checkpoint();areas=areas.map(a=>a.id===next.id?next:a);sync();notify(message);return true}catch(e){notify(e.message,true);updateInspector();return false}}
function commitCurtainGroup(mutator,message){if(!selectedIds.size)return false;try{const next=editAreaGroup(areas,selectedIds,mutator,validateCurtainAreas);checkpoint();areas=next;sync();notify(`${message} · ${selectedIds.size} area(s)`);return true}catch(e){notify(e.message,true);updateInspector();return false}}
function clearGroup(group){while(group.children.length){const child=group.children[0];child.traverse(o=>{o.geometry?.dispose();if(Array.isArray(o.material))o.material.forEach(m=>m.dispose());else o.material?.dispose()});group.remove(child)}}
function frameMatrix(a){const m=new THREE.Matrix4().makeBasis(v3(a.u),v3(a.v),v3(cross(a.u,a.v)));m.setPosition(v3(a.base));return m}
function material(a,active){return new THREE.ShaderMaterial({side:THREE.DoubleSide,uniforms:{color:{value:new THREE.Color(active?'#aac6ae':'#80938a')},origin:{value:new THREE.Vector2(...a.pattern.origin)},angle:{value:a.pattern.angle*Math.PI/180},spacing:{value:a.pattern.spacing},gridOn:{value:$('#grid-toggle').checked?1:0},selected:{value:active?1:0}},vertexShader:`varying vec2 areaUV; varying vec3 normalWorld; void main(){areaUV=position.xy;normalWorld=normalize(mat3(modelMatrix)*normal);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,fragmentShader:`uniform vec3 color;uniform vec2 origin;uniform float angle;uniform float spacing;uniform float gridOn;uniform float selected;varying vec2 areaUV;varying vec3 normalWorld;void main(){vec2 d=areaUV-origin;vec2 q=vec2(cos(angle)*d.x+sin(angle)*d.y,-sin(angle)*d.x+cos(angle)*d.y)/spacing;vec2 aa=max(fwidth(q),vec2(0.00001));vec2 edge=abs(fract(q+0.5)-0.5)/aa;float grid=1.0-min(min(edge.x,edge.y),1.0);float fade=1.0-smoothstep(0.2,0.6,max(aa.x,aa.y));float shade=.73+.27*abs(dot(normalize(normalWorld),normalize(vec3(-.3,-.7,1.0))));vec3 c=color*shade;c=mix(c,c*.65,grid*gridOn*fade*.65);gl_FragColor=vec4(c,1.0);}`})}
function rebuildScene(){clearGroup(surfaces);clearGroup(outlines);clearGroup(originHelpers);clearGroup(curtainMembers);$('#scene-labels').replaceChildren();
  ground.visible=!planeView&&$('#grid-toggle').checked;
  for(const a of areas){if(a.visible===false||(planeView&&a.id!==selectedId))continue;const curtain=getCurtainLayout(a);
    if(curtain)renderCurtain(a,curtain,{surfaces,frames:curtainMembers,outlines,matrix:frameMatrix(a),selectedPanelKey:a.id===selectedId?selectedPanelKey:null});
    else{const shape=new THREE.Shape(a.outer.map(p=>new THREE.Vector2(...p)));shape.holes=a.holes.map(h=>new THREE.Path(h.map(p=>new THREE.Vector2(...p))));const mesh=new THREE.Mesh(new THREE.ShapeGeometry(shape),material(a,selectedIds.has(a.id)));mesh.applyMatrix4(frameMatrix(a));mesh.userData.areaId=a.id;surfaces.add(mesh)}
    for(const loop of [a.outer,...a.holes]){const points=[...loop,loop[0]].map(p=>v3(worldPoint(a,p)));const edge=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:selectedIds.has(a.id)?0xd2ebd0:0x536b5b}));outlines.add(edge)}
    const label=document.createElement('div');label.className='scene-label';label.textContent=a.name;label.dataset.id=a.id;$('#scene-labels').append(label);
  }
  const a=selected();if(a&&a.visible!==false){const p=v3(worldPoint(a,a.pattern.origin)),r=a.pattern.angle*Math.PI/180,x=add(mul(a.u,Math.cos(r)),mul(a.v,Math.sin(r))),y=add(mul(a.u,-Math.sin(r)),mul(a.v,Math.cos(r))),bounds=new THREE.Box3().setFromPoints(a.outer.map(p=>v3(worldPoint(a,p)))),size=Math.max(100,bounds.getSize(new THREE.Vector3()).length()*.12);
    for(const [direction,color]of[[x,0xf0a17e],[y,0xa9ddaa]]){const arrow=new THREE.ArrowHelper(v3(direction),p,size,color,size*.12,size*.055);arrow.traverse(o=>{if(o.material){o.material.depthTest=false;o.material.depthWrite=false}o.renderOrder=4});originHelpers.add(arrow)}const marker=new THREE.Mesh(new THREE.SphereGeometry(size*.025,12,8),new THREE.MeshBasicMaterial({color:0xf4dec1,depthTest:false}));marker.position.copy(p);marker.renderOrder=5;originHelpers.add(marker);
    if(a.curtain?.enabled){const f=curtainOrigin(a),point=v3(worldPoint(a,f.origin)),r=f.angle*Math.PI/180;
      for(const direction of [add(mul(a.u,Math.cos(r)),mul(a.v,Math.sin(r))),add(mul(a.u,-Math.sin(r)),mul(a.v,Math.cos(r)))]){const arrow=new THREE.ArrowHelper(v3(direction),point,size*.75,0x6ad8ea,size*.09,size*.04);arrow.traverse(o=>{if(o.material){o.material.depthTest=false;o.material.depthWrite=false}o.renderOrder=6});originHelpers.add(arrow)}
      const cube=new THREE.Mesh(new THREE.BoxGeometry(size*.045,size*.045,size*.045),new THREE.MeshBasicMaterial({color:0x6ad8ea,depthTest:false}));cube.position.copy(point);cube.renderOrder=7;originHelpers.add(cube);
    }
  }
}
function renderList(){const list=$('#area-list');list.replaceChildren();$('#area-count').textContent=areas.length;for(const a of areas){const row=document.createElement('div');row.className='area-row'+(selectedIds.has(a.id)?' selected':'');const select=document.createElement('button');select.className='area-select';select.setAttribute('aria-pressed',String(selectedIds.has(a.id)));select.title='Click to select · Ctrl+click to add/remove';const icon=document.createElement('span');icon.className='area-icon';icon.textContent='▱';const name=document.createElement('b');name.textContent=a.name;const small=document.createElement('small');small.textContent=`${fmt(netArea(a))} m² · ${a.holes.length} openings`;select.append(icon,name,small);select.onclick=e=>selectArea(a.id,null,e.ctrlKey||e.metaKey);const visibility=document.createElement('button');visibility.className='visibility';visibility.textContent=a.visible===false?'○':'◉';visibility.title=a.visible===false?'Show area':'Hide area';visibility.setAttribute('aria-label',visibility.title+' '+a.name);visibility.onclick=()=>{checkpoint();a.visible=a.visible===false;sync()};row.append(select,visibility);list.append(row)}}
function updateBaseInspector(){const a=selected();$('#inspector').hidden=!a;$('#no-selection').hidden=!!a;if(!a)return;$('#area-name').value=a.name;$('#area-visible').checked=a.visible!==false;['x','y','z'].forEach((key,i)=>$('#world-'+key).value=Number(a.base[i].toFixed(3)));$('#world-rotation').value=0;$('#origin-x').value=Number(a.pattern.origin[0].toFixed(3));$('#origin-y').value=Number(a.pattern.origin[1].toFixed(3));$('#origin-angle').value=Number(a.pattern.angle.toFixed(3));$('#grid-spacing').value=a.pattern.spacing;$('#net-area').textContent=fmt(netArea(a))+' m²';$('#opening-count').textContent=String(a.holes.length).padStart(2,'0');$('#origin-world').textContent='World: '+worldPoint(a,a.pattern.origin).map(fmt).join(' / ')+' mm';$('#opening-list').replaceChildren();a.holes.forEach((h,i)=>{const row=document.createElement('div');row.className='opening-item';const label=document.createElement('span');label.textContent=`Opening ${i+1} · ${h.length} vertices`;const remove=document.createElement('button');remove.textContent='×';remove.setAttribute('aria-label',`Remove opening ${i+1}`);remove.onclick=()=>commitArea(a=>a.holes.splice(i,1),'Opening removed');row.append(label,remove);$('#opening-list').append(row)})}
function updateInspector(){updateBaseInspector();const a=selected(),group=areas.filter(a=>selectedIds.has(a.id));selectionNote.hidden=group.length<2;selectionNote.textContent=`${group.length} Areas selected — Curtain Wall changes apply to all. Other properties show active area: ${a?.name||''}`;$('#selected-area-count').textContent=`${group.length} selected`;if(a){const layout=getCurtainLayout(a);if(selectedPanelKey&&!layout?.panels.some(p=>p.key===selectedPanelKey))selectedPanelKey=null;updateCurtainProperties(a,layout,selectedPanelKey,{areas:group,layouts:group.map(getCurtainLayout)})}}
function sync(){selectedIds=new Set([...selectedIds].filter(id=>areas.some(a=>a.id===id)));if(selectedId&&areas.some(a=>a.id===selectedId))selectedIds.add(selectedId);else selectedId=[...selectedIds].at(-1)||null;renderList();updateInspector();rebuildScene();$('#project-label').textContent=projectName;$('#total-area').textContent=`${areas.length} areas · ${fmt(areas.reduce((s,a)=>s+netArea(a),0))} m²`;$('#undo').disabled=!history.length;$('#fit-selected').disabled=!selected();$('#view-area').disabled=!selected();updateViewButtons();saveLocal()}
function selectArea(id,panelKey=null,toggle=false){cancelPick();const selection=selectAreaIds(selectedIds,selectedId,id,toggle);selectedIds=selection.ids;selectedId=selection.primary;selectedPanelKey=selectedIds.size===1?panelKey:null;if(selectedId)commandLine?.selectionChanged(selectedId);else commandLine?.cancel(false);sync();if(planeView)focusArea();notify(selectedIds.size>1?`${selectedIds.size} Areas selected`:selected()?'Selected '+selected().name:'No area selected')}
function updateViewButtons(){$('#view-area').classList.toggle('active',planeView);$('#view-3d').classList.toggle('active',!planeView&&!standardView);$('#view-preset').value=standardView||'';$('#view-label').textContent=standardView?standardView.toUpperCase()+' · ORTHO':planeView?'AREA PLANE':'PERSPECTIVE';$('#navigation-help').textContent=pickMode?(pickMode==='curtain-origin'?'Click surface to set Curtain Origin · Esc to cancel':pickMode==='origin'?'Click surface to set origin · Esc to cancel':'Click near a boundary edge · Esc to cancel'):(planeView||standardView?'Middle-drag to pan · Scroll to zoom':'Shift + Middle-drag to orbit · Middle-drag to pan · Scroll to zoom');controls.enableRotate=!planeView&&!standardView;controls.mouseButtons.LEFT=-1}
function setCamera(target,normal,radius,up=[0,0,1]){
  const aspect=Math.max(.1,view.clientWidth/view.clientHeight),ortho=camera.isOrthographicCamera,distance=ortho?radius*3:radius/Math.sin(THREE.MathUtils.degToRad(camera.fov/2))/Math.min(1,aspect)*1.15;
  camera.up.copy(v3(up));camera.position.copy(target).addScaledVector(v3(normal).normalize(),distance);camera.zoom=1;
  if(ortho){const half=radius*1.15/Math.min(1,aspect);camera.top=half;camera.bottom=-half;camera.left=-half*aspect;camera.right=half*aspect}else camera.aspect=aspect;
  controls.object=camera;controls._quat.setFromUnitVectors(camera.up,new THREE.Vector3(0,1,0));controls._quatInverse.copy(controls._quat).invert();controls._sphericalDelta.set(0,0,0);controls._panOffset.set(0,0,0);
  controls.target.copy(target);camera.near=Math.max(.1,distance/10000);camera.far=Math.max(100000,distance*30);camera.updateProjectionMatrix();controls.minDistance=1;controls.maxDistance=distance*20;controls.update();
}
function modelBounds(onlySelected=false){const list=onlySelected&&selected()?[selected()]:areas.filter(a=>a.visible!==false),points=list.flatMap(a=>a.outer.map(p=>v3(worldPoint(a,p))));return new THREE.Box3().setFromPoints(points.length?points:[new THREE.Vector3(0,0,0),new THREE.Vector3(8000,4000,4000)])}
function setStandardView(name,onlySelected=false){if(!worldViews[name])return;cancelPick();planeView=false;standardView=name;camera=orthographicCamera;rebuildScene();const box=modelBounds(onlySelected),preset=worldViews[name];setCamera(box.getCenter(new THREE.Vector3()),preset.normal,Math.max(100,box.getSize(new THREE.Vector3()).length()/2),preset.up);updateViewButtons();notify(name.toUpperCase()+' view · World axes')}
function fitAll(reset=true){if(!reset&&standardView){setStandardView(standardView);return}if(!reset&&planeView){focusArea();return}planeView=false;standardView=null;camera=perspectiveCamera;rebuildScene();const box=modelBounds();setCamera(box.getCenter(new THREE.Vector3()),[1,-1.8,1.1],Math.max(100,box.getSize(new THREE.Vector3()).length()/2));updateViewButtons()}
function focusArea(){const a=selected();if(!a)return;if(standardView){setStandardView(standardView,true);return}if(planeView)camera=orthographicCamera;const box=modelBounds(true);setCamera(box.getCenter(new THREE.Vector3()),cross(a.u,a.v),Math.max(100,box.getSize(new THREE.Vector3()).length()/2),a.v);updateViewButtons()}
function pixelWorldSize(distance,height){return camera.isOrthographicCamera?(camera.top-camera.bottom)/camera.zoom/height:distance*2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))/height}
function cancelPick(){pickMode=null;commandMarker.visible=false;osnap.feedback(null);$('#pick-origin').classList.remove('picking');$('#align-edge').classList.remove('picking');$('#cw-pick-origin').classList.remove('picking');renderer.domElement.style.cursor='';updateViewButtons()}
function startPick(mode){commandLine?.cancel(false);if(mode==='curtain-origin'?!areas.some(a=>selectedIds.has(a.id)&&a.visible!==false):!selected()||selected().visible===false){notify('เลือก Area ที่แสดงอยู่ก่อน',true);return}if(pickMode===mode){cancelPick();return}pickMode=mode;$('#pick-origin').classList.toggle('picking',mode==='origin');$('#cw-pick-origin').classList.toggle('picking',mode==='curtain-origin');$('#align-edge').classList.toggle('picking',mode==='edge');renderer.domElement.style.cursor='crosshair';updateViewButtons();notify(mode==='curtain-origin'?'Pick shared Curtain Origin on any selected area · Snap enabled with F3':mode==='origin'?'Click a point on selected area — snaps to nearby vertices and edges':'Click an edge on the selected area to set local pattern X')}
renderer.domElement.addEventListener('pointerdown',e=>pointerDown={x:e.clientX,y:e.clientY,button:e.shiftKey?-1:e.button});
renderer.domElement.addEventListener('pointerup',e=>{if(!pointerDown||pointerDown.button!==0||Math.hypot(e.clientX-pointerDown.x,e.clientY-pointerDown.y)>5)return;pointerDown=null;const rect=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);const hits=raycaster.intersectObjects(surfaces.children);if(commandLine?.active){const distance=hits[0]?.distance||camera.position.distanceTo(controls.target);commandLine.handleRay({origin:raycaster.ray.origin.toArray(),direction:raycaster.ray.direction.toArray()},hits.map(h=>({areaId:h.object.userData.areaId,point:interactionPoint(h)})),pixelWorldSize(distance,rect.height)*14,true);return}const hit=pickMode?hits.find(h=>pickMode==='curtain-origin'?selectedIds.has(h.object.userData.areaId):h.object.userData.areaId===selectedId):hits[0];if(!hit)return;if(!pickMode){selectArea(hit.object.userData.areaId,hit.object.userData.panelKey,e.ctrlKey||e.metaKey);return}const a=pickMode==='curtain-origin'?areas.find(a=>a.id===hit.object.userData.areaId):selected(),p=localPoint(a,hit.point.toArray()),tolerance=pixelWorldSize(hit.distance,rect.height)*14;
  if(pickMode==='origin'||pickMode==='curtain-origin'){const pos=objectSnap(p,a,tolerance,osnap.get()).point.map(n=>Math.round(n*1000)/1000),curtain=pickMode==='curtain-origin';const sharedPoint=worldPoint(a,pos);const ok=curtain?commitCurtainGroup(target=>{target.curtain={...curtainSettings(target),origin:localPoint(target,sharedPoint).map(n=>Math.round(n*1000)/1000),angle:curtainOrigin(target).angle}},'Curtain origin updated'):commitArea(target=>{target.pattern.origin=pos},'Pattern origin updated');if(ok)cancelPick()}
  else{let best=null,dist=Infinity;for(const loop of [a.outer,...a.holes])for(let i=0;i<loop.length;i++){const v=loop[i],w=loop[(i+1)%loop.length],d=sub(w,v),t=Math.max(0,Math.min(1,dot(sub(p,v),d)/dot(d,d))),q=add(v,mul(d,t)),gap=length(sub(p,q));if(gap<dist){dist=gap;best=d}}if(dist>tolerance*2){notify('คลิกใกล้ขอบ Area เพื่อเลือกแนวแกน',true);return}commitArea(a=>a.pattern.angle=Math.atan2(best[1],best[0])*180/Math.PI,'Pattern X aligned to edge');cancelPick()}
});
renderer.domElement.addEventListener('pointercancel',()=>pointerDown=null);
renderer.domElement.addEventListener('pointermove',e=>{
  if((!commandLine?.active&&!['origin','curtain-origin'].includes(pickMode))||e.buttons)return;
  const rect=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);
  const hits=raycaster.intersectObjects(surfaces.children),distance=hits[0]?.distance||camera.position.distanceTo(controls.target);
  if(pickMode==='origin'||pickMode==='curtain-origin'){
    const hit=hits.find(h=>pickMode==='curtain-origin'?selectedIds.has(h.object.userData.areaId):h.object.userData.areaId===selectedId);
    commandMarker.visible=false;osnap.feedback(null);if(!hit)return;
    const a=areas.find(a=>a.id===hit.object.userData.areaId),tolerance=pixelWorldSize(hit.distance,rect.height)*14,result=objectSnap(localPoint(a,hit.point.toArray()),a,tolerance,osnap.get());
    if(result.type){commandMarker.visible=true;commandMarker.position.copy(v3(worldPoint(a,result.point)));commandMarker.scale.setScalar(Math.max(1,tolerance*.3));commandMarker.material.color.set(0x9fe6b6);osnap.feedback(result.type)}
    return;
  }
  commandLine.handleRay({origin:raycaster.ray.origin.toArray(),direction:raycaster.ray.direction.toArray()},hits.map(h=>({areaId:h.object.userData.areaId,point:interactionPoint(h)})),pixelWorldSize(distance,rect.height)*14);
});
function resize(){const w=view.clientWidth,h=view.clientHeight;renderer.setSize(w,h);if(camera.isOrthographicCamera){const half=(camera.top-camera.bottom)/2;camera.left=-half*w/h;camera.right=half*w/h}else camera.aspect=w/h;camera.updateProjectionMatrix()}
new ResizeObserver(resize).observe(view);
function animate(){requestAnimationFrame(animate);controls.update();renderer.render(scene,camera);for(const label of $('#scene-labels').children){const a=areas.find(a=>a.id===label.dataset.id);if(!a)continue;const box=new THREE.Box3().setFromPoints(a.outer.map(p=>v3(worldPoint(a,p)))),p=box.getCenter(new THREE.Vector3()).project(camera);label.hidden=p.z>1||p.z< -1||Math.abs(p.x)>1||Math.abs(p.y)>1;label.style.left=(p.x+1)/2*view.clientWidth+'px';label.style.top=(-p.y+1)/2*view.clientHeight+'px'}}
function download(name,text,type='application/json'){const url=URL.createObjectURL(new Blob([text],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
function confirmAction(title,message,action){$('#confirm-title').textContent=title;$('#confirm-message').textContent=message;$('#confirm-action').onclick=()=>{$('#confirm-dialog').close();action()};$('#confirm-dialog').showModal()}
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>b.closest('dialog').close());
$('#add-area').onclick=()=>$('#new-dialog').showModal();
$('#new-form').onsubmit=e=>{e.preventDefault();try{if(areas.length>=200)throw Error('รองรับสูงสุด 200 Areas');const f=Object.fromEntries(new FormData(e.target));for(const k of ['width','height','x','y','z','angle'])f[k]=Number(f[k]);const a=rectangle(f);checkpoint();areas.push(a);selectedId=a.id;$('#new-dialog').close();sync();fitAll();notify('Area created')}catch(e){notify(e.message,true)}};
$('#area-name').onchange=e=>commitArea(a=>a.name=e.target.value.trim()||'Area','Area renamed');
$('#area-visible').onchange=e=>commitArea(a=>a.visible=e.target.checked,'Visibility updated');
['x','y','z'].forEach((key,i)=>$('#world-'+key).onchange=e=>commitArea(a=>a.base[i]=e.target.value===''?NaN:Number(e.target.value),'Area position updated'));
$('#rotate-area').onclick=()=>commitArea(a=>{const r=Number($('#world-rotation').value)*Math.PI/180,c=Math.cos(r),s=Math.sin(r),rotate=v=>[c*v[0]-s*v[1],s*v[0]+c*v[1],v[2]];a.u=rotate(a.u);a.v=rotate(a.v)},'Area rotated around its base');
for(const [id,update]of[['origin-x',(a,n)=>a.pattern.origin[0]=n],['origin-y',(a,n)=>a.pattern.origin[1]=n],['origin-angle',(a,n)=>a.pattern.angle=n],['grid-spacing',(a,n)=>a.pattern.spacing=n]])$('#'+id).onchange=e=>commitArea(a=>update(a,e.target.value===''?NaN:Number(e.target.value)),'Reference coordinates updated');
$('#pick-origin').onclick=()=>startPick('origin');$('#align-edge').onclick=()=>startPick('edge');$('#reset-origin').onclick=()=>commitArea(a=>{a.pattern.origin=[0,0];a.pattern.angle=0},'Pattern origin reset');
$('#grid-toggle').onchange=rebuildScene;
$('#view-3d').onclick=()=>fitAll();$('#view-area').onclick=()=>{standardView=null;planeView=true;rebuildScene();focusArea()};$('#view-preset').onchange=e=>{if(e.target.value)setStandardView(e.target.value)};$('#fit-all').onclick=()=>fitAll(false);$('#fit-selected').onclick=focusArea;
$('#edit-boundary').onclick=()=>{if(!selected())return;$('#boundary-points').value=selected().outer.map(p=>p.map(n=>Number(n.toFixed(4))).join(', ')).join('\n');$('#boundary-dialog').showModal()};
$('#boundary-form').onsubmit=e=>{e.preventDefault();const points=$('#boundary-points').value.trim().split(/\n/).map(l=>l.trim().split(/[\s,]+/).map(Number));const before=history.length;commitArea(a=>a.outer=points,'Boundary updated');if(history.length!==before||history.length===40&&JSON.stringify(selected().outer)===JSON.stringify(points))$('#boundary-dialog').close()};
$('#add-opening').onclick=()=>selected()&&$('#opening-dialog').showModal();
$('#opening-form').onsubmit=e=>{e.preventDefault();const f=Object.fromEntries(new FormData(e.target));const {x,y,width:w,height:h}=Object.fromEntries(Object.entries(f).map(([k,v])=>[k,Number(v)]));const count=selected().holes.length;commitArea(a=>a.holes.push([[x,y],[x+w,y],[x+w,y+h],[x,y+h]]),'Opening added');if(selected().holes.length>count)$('#opening-dialog').close()};
$('#delete-area').onclick=()=>{const a=selected();if(!a)return;confirmAction('Delete area?',`ลบ ${a.name} พร้อมช่องเปิดและค่าที่ตั้งไว้ (Undo ได้)`,()=>{checkpoint();areas=areas.filter(x=>x.id!==a.id);selectedId=areas[0]?.id;sync();notify('Area deleted')})};
$('#duplicate-area').onclick=()=>{const a=selected();if(!a||areas.length>=200)return;checkpoint();const copy=clone(a);copy.id=crypto.randomUUID();copy.name=a.name+' copy';copy.base=add(copy.base,mul(copy.u,500));areas.push(copy);selectedId=copy.id;selectedIds=new Set([copy.id]);sync();notify('Area duplicated with 500 mm offset')};
$('#undo').onclick=()=>{const p=history.pop();if(!p)return;loadProject(p);notify('Undone')};
document.addEventListener('keydown',e=>{if(e.key==='Escape')cancelPick();if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'&&!['INPUT','TEXTAREA'].includes(document.activeElement.tagName)&&!document.querySelector('dialog[open]')){e.preventDefault();$('#undo').click()}});
$('#save-project').onclick=()=>{download('facade-studio.json',JSON.stringify(snapshot(),null,2));notify('Project saved — all area geometry and origins included')};
$('#export-dxf').onclick=()=>{try{download('facade-studio-'+new Date().toISOString().slice(0,10)+'.dxf',buildFacadeDxf(areas),'application/dxf');notify(`Exported ${areas.length} areas and openings · DXF in mm (includes hidden areas)`)}catch(e){notify(e.message,true)}};
$('#open-project').onclick=()=>$('#project-file').click();
$('#project-file').onchange=async e=>{const file=e.target.files[0];e.target.value='';if(!file)return;try{if(file.size>20e6)throw Error('ขนาดไฟล์เกิน 20 MB');const p=validProject(JSON.parse(await file.text()));confirmAction('Open project?', 'แทนที่งานปัจจุบันด้วยโปรเจกต์ที่เลือก (Undo ได้)',()=>{checkpoint();loadProject(p);notify('Opened '+file.name)})}catch(e){notify(e.message,true)}};
$('#load-demo').onclick=()=>confirmAction('Load sample facade?','เปิดตัวอย่างฟาสาด 3 ด้านแทนงานปัจจุบัน (Undo ได้)',()=>{checkpoint();areas=demoAreas();selectedId=areas[0].id;selectedIds=new Set([selectedId]);projectName='Sample · Corner facade';cancelPick();sync();fitAll();notify('Sample facade loaded')});
let selectedDxfFile=null,importBusy=false,dragDepth=0;
function chooseDxf(file){
  if(!file)return;
  if(importBusy){notify('กำลังอ่าน DXF กรุณารอสักครู่',true);return}
  if(!/\.dxf$/i.test(file.name)){notify('กรุณาเลือกไฟล์ .dxf',true);return}
  if(file.size>20e6){notify('ขนาด DXF เกิน 20 MB',true);return}
  const openDialog=document.querySelector('dialog[open]');
  if(openDialog&&openDialog.id!=='import-dialog'){notify('ปิดหน้าต่างปัจจุบันก่อนนำเข้า DXF',true);return}
  selectedDxfFile=file;$('#selected-dxf-name').textContent=file.name;
  if(!$('#import-dialog').open)$('#import-dialog').showModal();
}
$('#import-dxf').onclick=()=>$('#dxf-file').click();
$('#change-dxf').onclick=()=>$('#dxf-file').click();
$('#dxf-file').onchange=e=>{const file=e.target.files[0];e.target.value='';chooseDxf(file)};
$('#import-form').onsubmit=async e=>{
  e.preventDefault();if(!selectedDxfFile||importBusy)return;
  const file=selectedDxfFile,button=$('#process-dxf');importBusy=true;button.disabled=true;button.textContent='Reading DXF…';
  try{const result=parseDxf(await file.text(),$('#dxf-units').value);if(areas.length+result.areas.length>200)throw Error('รวมแล้วเกิน 200 Areas');validateCurtainAreas([...areas,...result.areas]);
    pendingImport=result;$('#import-dialog').close();$('#import-summary').textContent=`${file.name} · ${result.areas.length} areas · Scale ×${result.scale} to mm`;$('#import-warnings').textContent=result.warnings.length?'รายการที่ไม่ได้ใช้ / ต้องตรวจสอบ:\n'+result.warnings.join('\n'):'All boundaries imported successfully.';$('#report-dialog').showModal();
  }catch(e){notify(e.message,true)}finally{importBusy=false;button.disabled=false;button.textContent='Read DXF boundaries'}
};
const isFileDrag=e=>Array.from(e.dataTransfer?.types||[]).includes('Files');
function clearDropHint(){dragDepth=0;$('#dxf-drop-overlay').hidden=true}
window.addEventListener('dragenter',e=>{if(!isFileDrag(e))return;e.preventDefault();dragDepth++;$('#dxf-drop-overlay').hidden=false});
window.addEventListener('dragover',e=>{if(!isFileDrag(e))return;e.preventDefault();e.dataTransfer.dropEffect='copy'});
window.addEventListener('dragleave',e=>{if(!isFileDrag(e))return;e.preventDefault();if(--dragDepth<=0)clearDropHint()});
window.addEventListener('drop',e=>{if(!isFileDrag(e))return;e.preventDefault();clearDropHint();const files=Array.from(e.dataTransfer.files);if(files.length!==1){notify('ลากไฟล์ DXF ครั้งละ 1 ไฟล์',true);return}chooseDxf(files[0])});
window.addEventListener('dragend',clearDropHint);window.addEventListener('blur',clearDropHint);
$('#confirm-import').onclick=()=>{if(!pendingImport)return;checkpoint();const ids=new Set(areas.map(a=>a.id));for(const a of pendingImport.areas){if(ids.has(a.id))a.id=crypto.randomUUID();ids.add(a.id);areas.push(a)}selectedId=pendingImport.areas[0].id;selectedIds=new Set(pendingImport.areas.map(a=>a.id));const count=pendingImport.areas.length;pendingImport=null;$('#report-dialog').close();cancelPick();sync();fitAll();notify(`Imported ${count} areas`)};
commandLine=createCommandLine({
  areas:()=>areas,selected,select:selectArea,cancelPick,
  commit:(id,mutator,message)=>{if(selectedId!==id){notify('Area selection changed — restart command',true);return false}return commitArea(mutator,message)},
  snap:osnap.enabled,setSnap:osnap.setEnabled,osmode:osnap.get,setOsmode:osnap.set,
  action:id=>{if(id==='curtain-wall'){if(!selected()){notify('เลือก Area ก่อนใช้ CURTAIN',true);return}commitCurtainGroup(a=>a.curtain={...a.curtain,enabled:true},'Curtain Wall enabled');if($('.right-panel').hidden)$('#toggle-properties').click();const header=$('#curtain-section .property-section-toggle');if(header.getAttribute('aria-expanded')==='false')header.click();$('#curtain-section').scrollIntoView({block:'start'});return}const button=$('#'+id);if(button&&!button.disabled)button.click()},message:text=>notify(text,true),
  changed:active=>{updateViewButtons();controls.mouseButtons.LEFT=-1;renderer.domElement.style.cursor=active?'crosshair':pickMode?'crosshair':''},
  marker:(p,snapped=false,tolerance=30)=>{osnap.feedback(typeof snapped==='string'?snapped:null);commandMarker.visible=!!p;if(p){commandMarker.position.copy(v3(p));commandMarker.scale.setScalar(Math.max(1,tolerance*.3));commandMarker.material.color.set(snapped?0x9fe6b6:0xf3cb8a)}}
});
document.addEventListener('click',e=>{if(e.target.closest('dialog'))commandLine.cancel(false)});
bindCurtainProperties({selected,panelKey:()=>selectedIds.size===1?selectedPanelKey:null,commit:commitCurtainGroup,commitPanel:commitArea,selectionToken:()=>[...selectedIds].sort().join('|'),pickOrigin:()=>startPick('curtain-origin')});
function selectAllAreas(){cancelPick();commandLine?.cancel(false);selectedIds=new Set(areas.map(a=>a.id));selectedId=selectedId&&selectedIds.has(selectedId)?selectedId:areas[0]?.id;selectedPanelKey=null;sync();notify(`${selectedIds.size} Areas selected`)}
$('#select-all-areas').onclick=selectAllAreas;
$('#clear-area-selection').onclick=()=>{cancelPick();commandLine?.cancel(false);selectedIds.clear();selectedId=null;selectedPanelKey=null;sync();notify('Selection cleared')};
document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='a'&&!e.target.matches('input,textarea,select,[contenteditable=true]')&&!document.querySelector('dialog[open]')){e.preventDefault();selectAllAreas()}});
$('#snap-toggle').addEventListener('change',()=>commandLine.refresh());
resize();
try{const saved=localStorage.getItem(storageKey);if(saved)loadProject(JSON.parse(saved));else{areas=demoAreas();selectedId=areas[0].id;selectedIds=new Set([selectedId]);projectName='Sample · Corner facade';sync();fitAll()}}catch(e){areas=[];selectedId=null;sync();fitAll();notify('Could not restore previous session: '+e.message,true)}
animate();












