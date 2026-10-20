import './vendor/clipper.js';
const C=globalThis.ClipperLib;
export function insetBoundary(outer,distance){
 const scale=1000,path=outer.map(([x,y])=>({X:Math.round(x*scale),Y:Math.round(y*scale)}));
 if(!C.Clipper.Orientation(path))path.reverse();
 const offset=new C.ClipperOffset(10,.05*scale),tree=new C.PolyTree();offset.AddPath(path,C.JoinType.jtMiter,C.EndType.etClosedPolygon);offset.Execute(tree,-distance*scale);
 const ring=points=>{const result=points.map(p=>[p.X/scale,p.Y/scale]);return [...result,[...result[0]]]};
 return C.JS.PolyTreeToExPolygons(tree).map(p=>[ring(p.outer),...p.holes.map(ring)]);
}
export function stableIntersection(subject,clip){
 const scale=100000;
 function paths(multi){return multi.flatMap(poly=>poly.map((ring,i)=>{const path=ring.map(([x,y])=>({X:Math.round(x*scale),Y:Math.round(y*scale)}));if(C.Clipper.Orientation(path)!==(i===0))path.reverse();return path}))}
 const engine=new C.Clipper(),tree=new C.PolyTree();engine.StrictlySimple=true;engine.AddPaths(paths(subject),C.PolyType.ptSubject,true);engine.AddPaths(paths(clip),C.PolyType.ptClip,true);engine.Execute(C.ClipType.ctIntersection,tree,C.PolyFillType.pftNonZero,C.PolyFillType.pftNonZero);
 const ring=points=>{const r=points.map(p=>[p.X/scale,p.Y/scale]);return [...r,[...r[0]]]};
 return C.JS.PolyTreeToExPolygons(tree).map(p=>[ring(p.outer),...p.holes.map(ring)]);
}
