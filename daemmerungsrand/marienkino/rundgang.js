(() => {
const el=id=>document.getElementById(id), video=el('film'), help=el('wissen');
el('info').onclick=()=>help.hidden=!help.hidden;el('zu').onclick=()=>help.hidden=true;
const T=THREE,data=baueResidenz(T),scene=new T.Scene(),cam=new T.PerspectiveCamera(64,1,.045,130);
let renderer;
try{renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'})}catch(e){renderer=softwareKino(T,data,video)}
el('welt').appendChild(renderer.domElement);renderer.setPixelRatio(Math.min(devicePixelRatio,1.65));renderer.outputColorSpace=T.SRGBColorSpace;
scene.background=new T.Color('#afbec6');scene.fog=new T.Fog('#afbec6',58,115);
const hemi=new T.HemisphereLight(0xfff4da,0xad9583,1.72),sun=new T.DirectionalLight(0xffe4b7,1.85);sun.position.set(-12,23,18);scene.add(hemi,sun);
for(const [x,y,z,power,far] of [[0,2.85,-3.8,17,9],[-4.8,2.9,-3.8,13,7],[4.8,2.9,-3.8,13,7]]){
 const leuchte=new T.PointLight(0xffdfac,power,far,2);leuchte.position.set(x,y,z);scene.add(leuchte);
}
if(renderer.shadowMap){
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
 sun.castShadow=true;Object.assign(sun.shadow.camera,{left:-23,right:23,top:23,bottom:-23,far:75});
 sun.shadow.mapSize.set(1024,1024);sun.shadow.normalBias=.024;sun.shadow.bias=-.00018;
 renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;
}
const texLoader=new T.TextureLoader(),mats={};
for(const [key,m] of Object.entries(data.mats)){
 const tex=m.tex?texLoader.load(KINOTEXTUREN[m.tex]):null;
 if(tex){if(m.tex==='deckung')tex.wrapS=tex.wrapT=T.RepeatWrapping;tex.colorSpace=T.SRGBColorSpace;tex.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy())}
 mats[key]=m.glow?new T.MeshBasicMaterial({color:m.color}):new T.MeshStandardMaterial({color:m.color,map:tex,transparent:!!m.alpha,opacity:m.alpha||1,depthWrite:!m.alpha,normalMap:KINOTEXTUREN[m.tex+'_n']?texLoader.load(KINOTEXTUREN[m.tex+'_n']):null,normalScale:new T.Vector2(.55,.55),roughnessMap:KINOTEXTUREN[m.tex+'_mr']?texLoader.load(KINOTEXTUREN[m.tex+'_mr']):null,roughness:KINOTEXTUREN[m.tex+'_mr']?1:key==='gold'?.38:.84,metalness:key==='gold'?.36:0});
}
const groups=new Map(),dummy=new T.Object3D();let screen;
for(const o of data.teile){
 if(o.n==='Leinwand'){screen=new T.Mesh(data.geom[o.g],mats.schirm);screen.position.set(...o.p);screen.scale.set(...o.s);scene.add(screen);continue}
 const key=o.g+'_'+o.m;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(o);
}
for(const list of groups.values()){
 const sample=list[0], mesh=new T.InstancedMesh(data.geom[sample.g],mats[sample.m],list.length);
 mesh.receiveShadow=!data.mats[sample.m].alpha;mesh.castShadow=mesh.receiveShadow&&sample.g!=='bild'&&list.some(o=>o.p[2]>-9);
 list.forEach((o,i)=>{dummy.position.set(...o.p);dummy.scale.set(...o.s);dummy.rotation.set(...o.r);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix)});scene.add(mesh);
}
const filmMaterial=new T.MeshBasicMaterial({map:new T.VideoTexture(video)});filmMaterial.map.colorSpace=T.SRGBColorSpace;
let x=0,z=13,yaw=0,pitch=.11,seated=null,from=null,auto=false,last=performance.now(),nearest=null,msgTime=3;
let ax=0,az=0,drag=null,padID=null;const keys=new Set();
function note(t){el('status').textContent=t;msgTime=3.5}
function floorZ(z){return z>-12.095?0:-.06*Math.min(28,Math.max(0,Math.round((-12.6-z)/1.01)))}
function valid(x,z){
 if(z>18.6||z< -41.27)return false;
 if(z>=.48)return Math.abs(x)<7.42;
 if(z> -1.82)return Math.abs(x)<1.49;
 if(z> -8.52){return Math.abs(x)<7.62&&!data.hindernisse.some(a=>x>a[0]&&x<a[1]&&z>a[2]&&z<a[3])}
 if(z> -9.55)return Math.abs(x)<1.02;
 if(Math.abs(x)>11.43)return false;
 const r=Math.round((-12.6-z)/1.01);
 if(r<0||r>=29)return true;
 const bound=r<25?10.6:7.39,delta=z-(-12.6-r*1.01);
 return Math.abs(x)<.68||Math.abs(x)>bound||delta<-.40||delta>.42;
}
function stopFilm(){video.pause();screen.material=mats.schirm;el('filmBtn').textContent='Film starten'}
function sit(){
 if(seated){x=from.x;z=from.z;yaw=from.yaw;pitch=from.pitch;seated=null;stopFilm();note('Du stehst wieder im Gang.');return}
 if(!nearest)return;
 from={x,z,yaw,pitch};seated=nearest;x=seated.x;z=seated.z-.055;yaw=0;pitch=.055;auto=false;note('Du sitzt im Parkett.');
}
el('sitz').onclick=sit;
el('filmBtn').onclick=async()=>{if(!video.paused){video.pause();el('filmBtn').textContent='Weitersehen';return}try{await video.play();screen.material=filmMaterial;el('filmBtn').textContent='Pause'}catch(e){note('Film konnte nicht starten. Bitte erneut antippen.')}};
video.onended=()=>{el('filmBtn').textContent='Noch einmal ansehen'};
el('weg').onclick=()=>{auto=!auto;if(auto)note('Du gehst durch das Foyer zum Parkett.')};
window.addEventListener('keydown',e=>{if(!help.hidden||document.querySelector("#druck").open)return;let k=e.key.toLowerCase();if(['arrowup','arrowdown','arrowleft','arrowright',' '].includes(k))e.preventDefault();keys.add(k);if(k==='e'&&!e.repeat)sit();if(k==='escape')auto=false});
window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));window.addEventListener('blur',()=>{keys.clear();az=ax=0;auto=false});
const canvas=renderer.domElement;
canvas.onpointerdown=e=>{drag={id:e.pointerId,x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId)};
canvas.onpointermove=e=>{if(drag&&drag.id===e.pointerId){yaw-=(e.clientX-drag.x)*.004;pitch=Math.max(-1.12,Math.min(1.12,pitch-(e.clientY-drag.y)*.004));drag.x=e.clientX;drag.y=e.clientY}};
canvas.onlostpointercapture=()=>drag=null;
const pad=el('pad');
function stick(e){const r=pad.getBoundingClientRect();let dx=e.clientX-r.left-r.width/2,dy=e.clientY-r.top-r.height/2,k=Math.max(1,Math.hypot(dx,dy)/35);ax=dx/k/35;az=-dy/k/35;pad.firstElementChild.style.transform='translate('+ax*26+'px,'+(-az*26)+'px)'}
pad.onpointerdown=e=>{padID=e.pointerId;pad.setPointerCapture(padID);stick(e)};pad.onpointermove=e=>{if(padID===e.pointerId)stick(e)};pad.onlostpointercapture=()=>{padID=null;ax=az=0;pad.firstElementChild.style.transform=''};
function resize(){cam.aspect=innerWidth/innerHeight;cam.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)}addEventListener('resize',resize);resize();
let eye=1.63;
function loop(now){
 const dt=Math.min(.16,(now-last)/1000);last=now;
 let f=az+Number(keys.has('w')||keys.has('arrowup'))-Number(keys.has('s')||keys.has('arrowdown')),side=ax+Number(keys.has('d'))-Number(keys.has('a'));
 if(!help.hidden||document.querySelector('#druck').open){f=side=0;auto=false}
 if(f||side)auto=false;
 if(!seated){yaw+=((keys.has('arrowleft')?1:0)-(keys.has('arrowright')?1:0))*dt*1.65;
 if(auto){let dest=z>0?{x:0,z:0}:z> -9.8?{x:0,z:-9.9}:{x:0,z:-17.65};
 // Wenn die Führung seitlich beginnt, erst im freien Querbereich zur Mitte gehen.
 if(Math.abs(x)>.55&&z>1)dest={x:0,z:Math.max(1.2,z)};
 if(Math.abs(x)>.55&&z<-.1&&z>-8.2)dest={x:0,z:z};
 const dx=dest.x-x,dz=dest.z-z,dist=Math.hypot(dx,dz);
 if(z<=-17.56||dist<.005&&dest.z===-17.65){auto=false;note('Hier ist ein Platz am Mittelgang frei.')}
 else {const step=Math.min(dt*3.5,dist);if(dist>.001){const nx=x+dx/dist*step,nz=z+dz/dist*step;if(valid(nx,nz)){x=nx;z=nz}else{auto=false;note('Gehe erst in den Mittelgang.')}}yaw*=Math.exp(-dt*3);pitch+=(-pitch)*Math.min(1,dt*3)}
 }else{const v=dt*3.05/Math.max(1,Math.hypot(f,side)),dx=(side*Math.cos(yaw)-f*Math.sin(yaw))*v,dz=(-side*Math.sin(yaw)-f*Math.cos(yaw))*v;if(valid(x+dx,z))x+=dx;if(valid(x,z+dz))z+=dz}
 }
 el('lesen').hidden=seated||z<-.1||z>15;
 nearest=null;if(!seated&&z<-11.5)for(const q of data.sitze){if(q.besetzt)continue;const dist=Math.hypot(x-q.x,z-q.z);if(dist<1.57&&(!nearest||dist<nearest.dist))nearest={...q,dist}}
 const target=floorZ(z)+(seated?1.19:1.64);eye+=(target-eye)*(1-Math.exp(-dt*12));
 cam.position.set(x,eye,z);cam.rotation.order='YXZ';cam.rotation.set(pitch,yaw,0,'YXZ');
 const indoor=Math.max(0,Math.min(1,-z/9));hemi.intensity=1.72-.78*indoor;sun.intensity=1.85-1.2*indoor;
 el('ort').textContent=z>0?'Marienplatz · August 1935':z>-9?'Foyer · Kasse':seated?'Parkett · Reihe '+(29-seated.row):'Parkett · Mittelgang';
 el('sitz').hidden=!seated&&!nearest;el('sitz').textContent=seated?'Aufstehen':'Hinsetzen';el('weg').hidden=!!seated||z< -12&&!auto;el('weg').textContent=auto?'Anhalten':'Zum Saal gehen';el('filmBtn').hidden=!seated;if(msgTime>0&&(msgTime-=dt)<=0)el('status').textContent='';
 renderer.render(scene,cam);requestAnimationFrame(loop)
}
requestAnimationFrame(loop);
})();
