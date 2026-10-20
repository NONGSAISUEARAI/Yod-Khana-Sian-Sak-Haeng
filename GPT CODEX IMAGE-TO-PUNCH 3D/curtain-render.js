import * as THREE from 'three';
import {worldPoint} from './geometry.js';
function shape(rings){const s=new THREE.Shape(rings[0].map(p=>new THREE.Vector2(...p)));s.holes=rings.slice(1).map(h=>new THREE.Path(h.map(p=>new THREE.Vector2(...p))));return s}
function extrude(rings,depth,offset){const g=new THREE.ExtrudeGeometry(shape(rings),{depth,bevelEnabled:false,steps:1,curveSegments:1});g.translate(0,0,offset-depth/2);return g}
export function renderCurtain(a,layout,{surfaces,frames,outlines,matrix,selectedPanelKey}){
 const c=layout.settings,baseColor=new THREE.Color(c.panelColor);
 const materials={};
 function panelMaterial(type,selected){const key=type+selected;if(materials[key])return materials[key];return materials[key]=new THREE.MeshStandardMaterial({color:selected?0xe9c687:type==='glass'?0x80bac4:baseColor,metalness:type==='solid'?.25:.05,roughness:type==='glass'?.13:.6,transparent:type!=='solid',opacity:type==='open'?.035:type==='glass'?.45:1,depthWrite:type==='solid',side:THREE.DoubleSide,visible:c.showPanels})}
 for(const p of layout.panels){
  const selected=p.key===selectedPanelKey;
  const geometry=extrude(p.rings,c.panelThickness,0),mesh=new THREE.Mesh(geometry,panelMaterial(p.type,selected));mesh.applyMatrix4(matrix);mesh.userData={areaId:a.id,panelKey:p.key};surfaces.add(mesh);
  if(c.showPanels){const edge=new THREE.LineSegments(new THREE.EdgesGeometry(geometry,30),new THREE.LineBasicMaterial({color:selected?0xffd398:p.type==='open'?0x4e6358:0x74877a,transparent:p.type==='open',opacity:p.type==='open'?.35:1}));edge.applyMatrix4(matrix);outlines.add(edge)}
 }
 if(c.showMullions){const mat=new THREE.MeshStandardMaterial({color:0x344840,metalness:.55,roughness:.4}),offset=c.mullionOffset*(c.flipMullionSide?-1:1);for(const m of layout.mullions)for(const rings of m.rings){const mesh=new THREE.Mesh(extrude(rings,c.mullionDepth,offset),mat);mesh.applyMatrix4(matrix);frames.add(mesh)}}
 if(c.showGrid){const points=[];for(const segment of layout.grid)for(const p of segment){const wp=worldPoint(a,p),n=new THREE.Vector3(0,0,c.panelThickness/2+1).transformDirection(matrix);points.push(new THREE.Vector3(...wp).addScaledVector(n,c.panelThickness/2+1))}if(points.length)frames.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:0xc5ab6e,transparent:true,opacity:.65})))}
}
