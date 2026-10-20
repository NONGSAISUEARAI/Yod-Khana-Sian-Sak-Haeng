import {MOUSE,Vector3} from 'three';

// The pinned OrbitControls version swaps pan/rotate for modifier keys.
// Normalize that behavior here to keep the workspace mouse bindings explicit.
export function configureNavigation(controls,isPlaneView){
  controls.mouseButtons.LEFT=-1;
  controls.mouseButtons.MIDDLE=MOUSE.PAN;
  controls.mouseButtons.RIGHT=MOUSE.PAN;
  const mouseDown=controls._onMouseDown;
  controls._onMouseDown=event=>{
    controls.mouseButtons.LEFT=-1;
    controls.mouseButtons.MIDDLE=event.shiftKey&&!isPlaneView()?MOUSE.ROTATE:MOUSE.PAN;
    mouseDown({button:event.button,clientX:event.clientX,clientY:event.clientY,shiftKey:false,ctrlKey:false,metaKey:false});
  };
}

export function installSurfaceZoom(controls,getSurfacePoint){
  const element=controls.domElement;
  controls.zoomToCursor=true;
  function zoom(event){
    const camera=controls.object;
    if(!controls.enabled||!controls.enableZoom||!camera.isPerspectiveCamera||event.deltaY===0)return;
    const hit=getSurfacePoint(event);if(!hit)return;
    const point=new Vector3(...hit),toward=point.clone().sub(camera.position),distance=toward.length();if(distance<1e-7)return;
    event.preventDefault();event.stopImmediatePropagation();
    const pixels=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?element.clientHeight:1);
    const factor=Math.exp(Math.max(-.4,Math.min(.4,pixels*.0016*controls.zoomSpeed)));
    const minimum=.5,next=Math.min(controls.maxDistance,Math.max(minimum,distance*factor)),direction=camera.getWorldDirection(new Vector3());
    camera.position.addScaledVector(toward,1-next/distance);
    // Rebase orbit depth at the surface while keeping the view direction fixed.
    const depth=Math.max(minimum,point.clone().sub(camera.position).dot(direction));
    controls.target.copy(camera.position).addScaledVector(direction,depth);
    controls.minDistance=.1;
    camera.near=Math.max(.01,Math.min(1,depth/1000));camera.far=Math.max(camera.far,depth*4);camera.updateProjectionMatrix();controls.update();
    controls.dispatchEvent({type:'change'});
  }
  element.addEventListener('wheel',zoom,{capture:true,passive:false});
  return ()=>element.removeEventListener('wheel',zoom,true);
}
