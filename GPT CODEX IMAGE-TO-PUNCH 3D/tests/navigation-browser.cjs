const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
const {spawn}=require('node:child_process');
(async()=>{
 const server=spawn(process.execPath,[path.join(__dirname,'../server.mjs')],{env:{...process.env,PORT:'4174'},stdio:['ignore','pipe','pipe'],windowsHide:true});let browser;
 try{
 await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);server.once('exit',c=>reject(Error('Server exit '+c)))});
 browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1500,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:4174');await page.waitForSelector('#command-input');
 await page.evaluate(async()=>{const THREE=await import('/vendor/three.module.js');const {OrbitControls}=await import('/vendor/OrbitControls.js');const {configureNavigation}=await import('/navigation.js');const canvas=document.createElement('canvas');canvas.style.cssText='position:fixed;left:100px;top:100px;width:500px;height:400px;z-index:2000;background:#223322';document.body.append(canvas);const camera=new THREE.PerspectiveCamera(40,1.25,1,100000);camera.up.set(0,0,1);camera.position.set(6000,-8000,4000);const controls=new OrbitControls(camera,canvas);configureNavigation(controls,()=>false);controls.update();window.navTest={camera,controls,canvas}});
 const state=()=>page.evaluate(()=>{const {camera,controls}=window.navTest;return {p:camera.position.toArray(),t:controls.target.toArray(),d:camera.position.clone().sub(controls.target).normalize().toArray()}});
 const delta=(a,b)=>Math.hypot(...a.map((n,i)=>n-b[i]));
 async function drag(button,shift=false){if(shift)await page.keyboard.down('Shift');await page.mouse.move(260,260);await page.mouse.down({button});await page.mouse.move(330,300,{steps:8});await page.mouse.up({button});if(shift)await page.keyboard.up('Shift')}
 let a=await state();await drag('left');let b=await state();assert.ok(delta(a.p,b.p)<1e-7,'plain left must select, not navigate');
 a=b;await drag('left',true);b=await state();assert.ok(delta(a.p,b.p)<1e-7,'Shift+left must not orbit');
 a=b;await drag('middle');b=await state();assert.ok(delta(a.t,b.t)>1,'middle must pan');assert.ok(delta(a.d,b.d)<1e-7,'pan must preserve viewing direction');
 a=b;await drag('middle',true);b=await state();assert.ok(delta(a.d,b.d)>.01,'Shift+middle must orbit');assert.ok(delta(a.t,b.t)<1e-7,'orbit keeps target');
 await page.evaluate(async()=>{const THREE=await import('/vendor/three.module.js');const {installSurfaceZoom}=await import('/navigation.js');const n=window.navTest;n.camera.position.set(0,-1000,0);n.controls.target.set(0,-900,0);n.controls.update();n.initialDirection=n.camera.getWorldDirection(new THREE.Vector3()).toArray();n.removeZoom=installSurfaceZoom(n.controls,event=>{n.camera.updateMatrixWorld();const rect=n.canvas.getBoundingClientRect(),pointer=new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1),ray=new THREE.Raycaster();ray.setFromCamera(pointer,n.camera);const hit=ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,-1,0),0),new THREE.Vector3());if(hit){n.lastZoomPoint=hit.clone();return hit.toArray()}})});
 await page.mouse.move(330,300);await page.mouse.wheel(0,-100);await page.waitForTimeout(30);
 const anchor=await page.evaluate(()=>window.navTest.lastZoomPoint.clone().project(window.navTest.camera).toArray());
 for(let i=0;i<24;i++)await page.mouse.wheel(0,-100);await page.waitForTimeout(40);
 const zoomed=await page.evaluate(()=>{const n=window.navTest;return {y:n.camera.position.y,p:n.lastZoomPoint.clone().project(n.camera).toArray(),d:n.camera.getWorldDirection(n.controls.target.clone()).toArray(),initial:n.initialDirection}});
 assert.ok(zoomed.y>-100&&zoomed.y<0,'zoom must pass old orbit pivot and approach the surface');assert.ok(delta(anchor.slice(0,2),zoomed.p.slice(0,2))<1e-6,'surface anchor stays under cursor');assert.ok(delta(zoomed.d,zoomed.initial)<1e-6,'zoom preserves viewing direction');
 await page.evaluate(()=>{window.navTest.removeZoom();window.navTest.controls.dispose();window.navTest.canvas.remove()});
 const input=page.locator('#command-input');await input.fill('ORIGIN');await input.press('Enter');const before=await page.locator('#origin-x').inputValue();const box=await page.locator('#viewport canvas').boundingBox();await page.keyboard.down('Shift');await page.mouse.click(box.x+box.width*.5,box.y+box.height*.5,{button:'middle'});await page.keyboard.up('Shift');assert.equal(await page.locator('#origin-x').inputValue(),before);assert.match(await page.locator('#command-prompt').textContent(),/pattern origin/);await input.press('Escape');
 assert.deepEqual(errors,[]);console.log('PASS: orbit/pan bindings, surface zoom past old pivot, cursor anchor, view direction and no origin placement during navigation.');
 }finally{await browser?.close();server.kill()}
})().catch(e=>{console.error(e);process.exitCode=1});
