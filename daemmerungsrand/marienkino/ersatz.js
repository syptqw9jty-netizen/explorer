// Softwareansicht für Vorschauen ohne WebGL. Nutzt dieselben Meshes, Positionen und Sitzplätze.
globalThis.softwareKino=function(T,data,video) {
 const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d',{alpha:false}),images={},prepared=[],near=.07;
 for(const [k,url] of Object.entries(KINOTEXTUREN)){if(k.endsWith("_mr")||k.endsWith("_n"))continue;images[k]=new Image();images[k].src=url}
 const v3=new T.Vector3(),origin=new T.Vector3(),world=new T.Matrix4(),q=new T.Quaternion();
 const little=new T.SphereGeometry(.5,7,4),cylinder=new T.CylinderGeometry(.5,.5,1,8),geoCache=new Map();
 function geometry(o){
  let geo=o.g==='kugel'?little:o.g==='rund'?cylinder:data.geom[o.g];
  if(o.g==='box'&&Math.max(...o.s)>4){const sub=o.s.map(v=>Math.min(25,Math.ceil(v/2.3)));const k=sub.join('/');if(!geoCache.has(k))geoCache.set(k,new T.BoxGeometry(1,1,1,...sub));geo=geoCache.get(k)}
  return geo;
 }
 let past='',ready=false;
 for(const o of data.teile){
  if(o.m==='schutzglas')continue;
  const geo=geometry(o),v=geo.attributes.position,normal=geo.attributes.normal,uv=geo.attributes.uv,idx=geo.index,m=data.mats[o.m],faces=[];
  origin.set(...o.p);q.setFromEuler(new T.Euler(...o.r));world.compose(origin,q,new T.Vector3(...o.s));
  const pts=[];for(let i=0;i<v.count;i++){v3.fromBufferAttribute(v,i).applyMatrix4(world);pts.push([v3.x,v3.y,v3.z])}
  let rgb=parseInt(m.color.slice(1),16);if(m.tex)rgb=({putz:0xd6cbb1,oak:0x775440,wolle:0x794744,pflaster:0x958d7c})[m.tex]||0xd6cbb1;
  const graphic=o.g==='bild',len=idx?idx.count:v.count;
  for(let i=0;i<len;i+=3){let ids=[0,1,2].map(j=>idx?idx.getX(i+j):i+j);v3.fromBufferAttribute(normal,ids[0]).applyQuaternion(q);
   const shade=m.glow?1.14:.77+.19*Math.max(0,v3.y)+.14*Math.max(0,v3.z)-.09*Math.max(0,-v3.x);
   const clr=[rgb>>16,rgb>>8&255,rgb&255].map(c=>Math.min(255,Math.round(c*shade)));
   faces.push([ids,clr,uv?ids.map(j=>[uv.getX(j),1-uv.getY(j)]):null,shade]);
  }
  const sphere=new T.Sphere();geo.computeBoundingSphere();sphere.copy(geo.boundingSphere).applyMatrix4(world);
  prepared.push({pts,faces,sphere,graphic,tex:m.tex,name:o.n,tiny:Math.max(...o.s)<.34});
 }
 const textures={},sample=document.createElement('canvas'),sc=sample.getContext('2d',{willReadFrequently:true});
 function pixels(key,img){
  if(!img||!(img.videoWidth||img.naturalWidth))return null;
  if(key!=='film'&&textures[key])return textures[key];
  const w=key==='film'?240:256,h=Math.round(w*(img.videoHeight||img.naturalHeight)/(img.videoWidth||img.naturalWidth));
  sample.width=w;sample.height=h;sc.drawImage(img,0,0,w,h);return textures[key]={w,h,repeat:key==='deckung',rgba:sc.getImageData(0,0,w,h).data}
 }
 let depth,frame;
 function triangle(a,b,c,color,tex,shade){
  const W=frame.width,H=frame.height,buf=frame.data;
  let xmin=Math.max(0,Math.floor(Math.min(a[0],b[0],c[0]))),xmax=Math.min(W-1,Math.ceil(Math.max(a[0],b[0],c[0]))),ymin=Math.max(0,Math.floor(Math.min(a[1],b[1],c[1]))),ymax=Math.min(H-1,Math.ceil(Math.max(a[1],b[1],c[1])));
  if(xmin>xmax||ymin>ymax)return;
  const det=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);if(det>=-.07)return;
  const ax=(b[1]-c[1])/det,ay=(c[0]-b[0])/det,bx=(c[1]-a[1])/det,by=(a[0]-c[0])/det;
  for(let y=ymin;y<=ymax;y++){let l=ax*(xmin+.5-c[0])+ay*(y+.5-c[1]),m=bx*(xmin+.5-c[0])+by*(y+.5-c[1]);
   for(let x=xmin;x<=xmax;x++,l+=ax,m+=bx){const n=1-l-m;if(l<-.00001||m<-.00001||n<-.00001)continue;
    const k=y*W+x,iz=l*a[2]+m*b[2]+n*c[2];if(iz<=depth[k])continue;depth[k]=iz;let off=k*4;
    if(tex){let u=(l*a[3]+m*b[3]+n*c[3])/iz,v=(l*a[4]+m*b[4]+n*c[4])/iz;if(tex.repeat){u-=Math.floor(u);v-=Math.floor(v)}const j=(Math.max(0,Math.min(tex.h-1,Math.floor(v*tex.h)))*tex.w+Math.max(0,Math.min(tex.w-1,Math.floor(u*tex.w))))*4;buf[off]=tex.rgba[j]*shade;buf[off+1]=tex.rgba[j+1]*shade;buf[off+2]=tex.rgba[j+2]*shade}
    else {buf[off]=color[0];buf[off+1]=color[1];buf[off+2]=color[2]}
   }
  }
 }
 return {domElement:canvas,setPixelRatio(){},setSize(w,h){const scale=Math.min(1,580/w,540/h);canvas.width=Math.round(w*scale);canvas.height=Math.round(h*scale);past=''},capabilities:{getMaxAnisotropy:()=>1},render(scene,cam){
  const active=!video.paused,nowReady=Object.values(images).every(im=>im.complete),key=[...cam.position.toArray(),cam.rotation.x,cam.rotation.y].map(v=>v.toFixed(3)).join(',');
  if(!active&&past===key&&ready===nowReady)return;past=key;ready=nowReady;
  const W=canvas.width,H=canvas.height,cx=W/2,cy=H/2,f=cy/Math.tan(cam.fov*Math.PI/360),px=cam.position.x,py=cam.position.y,pz=cam.position.z,sa=Math.sin(cam.rotation.y),ca=Math.cos(cam.rotation.y),sp=Math.sin(cam.rotation.x),cp=Math.cos(cam.rotation.x);
  function view(x,y,z){x-=px;y-=py;z-=pz;const a=ca*x-sa*z,b=sa*x+ca*z;return [a,cp*y+sp*b,sp*y-cp*b]}
  if(!frame||frame.width!==W||frame.height!==H){frame=ctx.createImageData(W,H);depth=new Float32Array(W*H)}
  new Uint32Array(frame.data.buffer).fill(0xffcbc9bc);depth.fill(0);
  const filmPix=video.readyState>=2&&video.currentTime>0?pixels('film',video):null;
  for(const o of prepared){const c=o.sphere.center,rad=o.sphere.radius,[X,Y,Z]=view(c.x,c.y,c.z);
   if(Z+rad<near||Z-rad>75||Math.abs(X)>Math.max(Z,0)*cx/f+rad*2||Math.abs(Y)>Math.max(Z,0)*cy/f+rad*2||o.tiny&&Z>17)continue;
   const vv=o.pts.map(p=>view(...p));for(const [ids,col,uv,shade] of o.faces){
    let poly=ids.map((id,j)=>[...vv[id],...(uv?uv[j]:[0,0])]);if(poly.every(p=>p[2]<near))continue;
    if(poly.some(p=>p[2]<near)){let out=[];for(let j=0;j<3;j++){let a=poly[j],b=poly[(j+1)%3];if(a[2]>=near)out.push(a);if((a[2]>=near)!==(b[2]>=near)){let t=(near-a[2])/(b[2]-a[2]);out.push(a.map((v,k)=>v+(b[k]-v)*t))}}poly=out}
    const p=poly.map(a=>[cx+f*a[0]/a[2],cy-f*a[1]/a[2],1/a[2],a[3]/a[2],a[4]/a[2]]);
    const tex=o.name==='Leinwand'?filmPix:o.tex?pixels(o.tex,images[o.tex]):null;
    for(let j=1;j<p.length-1;j++)triangle(p[0],p[j],p[j+1],col,tex,o.graphic?1:shade)
   }
  }
  ctx.putImageData(frame,0,0)
 }};
};
