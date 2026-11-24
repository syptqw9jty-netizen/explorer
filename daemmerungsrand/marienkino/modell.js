// Ein lokales Koordinatensystem, Y oben. Die Platzfassade liegt auf Z=0.
globalThis.baueResidenz = function(T) {
 const mats={}, geom={}, teile=[], sitze=[], publikum=[], hindernisse=[];
 const material=(key,color,tex=null,glow=false)=>mats[key]={color,tex,glow};
 Object.entries({sand:'#ddcfac',sockel:'#a1957b',schiefer:'#524d48',zink:'#665e52',holz:'#ffffff',putz:'#ffffff',stoff:'#ffffff',pflaster:'#ffffff',glas:'#475652',rahmen:'#46372b',gold:'#c6a265',licht:'#ffe8b9',rot:'#743c35',creme:'#f0dfbe',wand:'#9f8873',dunkel:'#332c2a',boden:'#826751',schirm:'#d8cebb',mantel:'#353a3c',blau:'#404c57',gruen:'#515b4d',ocker:'#947356',haut:'#d3a383',haut2:'#bd8d70',haar:'#594335',hemd:'#ddcbb2',schuh:'#39322d',stein:'#aea392',blatt:'#686f50'}).forEach(([k,v])=>material(k,v,({holz:'oak',putz:'putz',stoff:'wolle',pflaster:'pflaster'})[k],k==='licht'));
 for(const k of ['name','programm','theater','kasse','parkett','filmwerbung','operette','blatt'])material(k,'#ffffff',k);
 material('dachhaut','#ffffff','deckung'); material('terrazzo','#ffffff','terrazzo');material('fensterglas','#ffffff','scheibe');
 material('schutzglas','#c8ded8'); mats.schutzglas.alpha=.095;
 for(let i=0;i<4;i++)material('raum'+i,'#d6d6ce','raum'+i);
 geom.box=new T.BoxGeometry(1,1,1);geom.bild=new T.PlaneGeometry(1,1);
 geom.kugel=new T.SphereGeometry(.5,12,8);geom.rund=new T.CylinderGeometry(.5,.5,1,16);geom.kegel=new T.CylinderGeometry(.35,.5,1,16);geom.kuppel=new T.SphereGeometry(.5,16,8,0,2*Math.PI,0,Math.PI/2);
 function teil(n,g,m,x,y,z,w,h,d,rx=0,ry=0,rz=0){teile.push({n,g,m,p:[x,y,z],s:[w,h,d],r:[rx,ry,rz]})}
 const box=(n,m,x,y,z,w,h,d,rx=0,ry=0,rz=0)=>teil(n,'box',m,x,y,z,w,h,d,rx,ry,rz);
 const ei=(n,m,x,y,z,w,h,d)=>teil(n,'kugel',m,x,y,z,w,h,d);
 function bild(k,x,y,z,w,h){teil(k,'bild',k,x,y,z,w,h,1)}
 function dach(x,z,w,d,y,h){
  const ridge=Math.min(w,d)*.24,pts=[[x-w/2,y,z+d/2],[x+w/2,y,z+d/2],[x+w/2,y,z-d/2],[x-w/2,y,z-d/2],[x-w/2+ridge,y+h,z+d/2-ridge],[x+w/2-ridge,y+h,z+d/2-ridge],[x+w/2-ridge,y+h,z-d/2+ridge],[x-w/2+ridge,y+h,z-d/2+ridge]];
  const g=new T.BufferGeometry(),idx=[0,1,5,0,5,4,1,2,6,1,6,5,2,3,7,2,7,6,3,0,4,3,4,7,4,5,6,4,6,7],ar=idx.flatMap(i=>pts[i]);g.setAttribute('position',new T.Float32BufferAttribute(ar,3));const uv=[];for(let n=0;n<idx.length;n+=3){
   const a=new T.Vector3(...pts[idx[n]]),b=new T.Vector3(...pts[idx[n+1]]),c=new T.Vector3(...pts[idx[n+2]]);
   const norm=b.clone().sub(a).cross(c.clone().sub(a)).normalize();
   for(let j=0;j<3;j++){const [xx,yy,zz]=pts[idx[n+j]];uv.push((Math.abs(norm.x)>.4?zz:xx)/2.4,(Math.abs(norm.y)>.98?zz:yy)/1.9)}
  }g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.computeVertexNormals();let key='dach'+teile.length;geom[key]=g;teil('Walmdach',key,'dachhaut',0,0,0,1,1,1)
 }
 function fenster(x,y,z,w,h,side=false){
  const plane=(m,lx,ly,depth,ww,hh,dd)=>side?box('Fenster',m,x+depth,y+ly,z-lx,dd,hh,ww):box('Fenster',m,x+lx,y+ly,z+depth,ww,hh,dd);
  plane('rahmen',0,0,.02,w+.14,h+.14,.13);const innen='raum'+(Math.abs(Math.round(11*x+7*y+3*z))%4);
  teil('Zimmer hinter der Scheibe','bild',innen,side?x+.099:x,y,side?z:z+.099,w,h,1,0,side?Math.PI/2:0);
  for(const i of [-.5,.5])plane('holz',i*w,0,.14,.08,h+.12,.17);
  plane('holz',0,h*.5,.14,w+.12,.09,.17);
  plane('schutzglas',0,0,.196,w,h,.01);
  for(let i of [-.5,0,.5])plane('creme',i*w,0,.21,.043,h+.05,.05);
  for(let i of [-.5,.16,.5])plane('creme',0,i*h,.215,w+.05,.043,.05);
  plane('sockel',0,-h/2-.085,.15,w+.25,.12,.32)
 }
 // Westseite des Platzes, zurückgesetztes Portal; nördliche Flanke zur Marienstraße.
 for(let x=-7;x<7;x+=2)for(let z=1;z<=19;z+=2)box('Platzpflaster','pflaster',x,-.06,z,2,.12,2);
 box('Schwelle','stein',0,.015,.26,16,.08,1);
 for(let x of [-5.12,5.12])box('Eingangsfront','putz',x,1.65,0,5.75,3.3,.42);
 box('Obergeschosse','putz',0,6.52,-4.4,16,6.55,8.8);dach(0,-4.4,16.5,9.3,9.77,3.2);
 for(let x of [-6.2,-4.3,0,4.3,6.2])for(let y of [4.8,7.62])fenster(x,y,.03,1.04,1.54);
 for(let x of [-6,-4.55,-3.1,-1.65,-.2,1.25,2.7,4.15,5.6]){box('Dachband','putz',x,10.38,-.17,1.48,1.32,.64);fenster(x,10.44,.16,.81,.84)}
 box('Gaubengesims','sockel',-.2,11.08,-.15,13.5,.17,.93);
 for(let x of [-6.55,6.55]){box('Flacher Erker','putz',x,6.64,.22,2,5.83,.46);for(let y of [4.8,7.62])fenster(x,y,.46,1.34,1.49)}
 box('Gurtgesims','sockel',0,3.39,.2,16.3,.22,.8);// Einzelbuchstaben ohne Trägertafel. Proportion nach Heidrichs Modellfoto.
 const schrift=KINOSCHRIFT, faktor=4.7/schrift.breite;
 let formen=[];
 for(const [offset,commands] of schrift.zeichen){
  const pfad=new T.ShapePath();
  for(const [cmd,pts] of commands){
   const xy=pts.flatMap(([x,y])=>[(x+offset)*faktor,y*faktor]);
   if(cmd==='curveTo')pfad.bezierCurveTo(...xy);
   else if(cmd==='lineTo'||cmd==='moveTo')pfad[cmd](...xy);
   else if(cmd==='closePath')pfad.currentPath.closePath();
  }
  formen.push(...pfad.toShapes(false));
 }
 geom.schrift=new T.ExtrudeGeometry(formen,{depth:.027,bevelEnabled:false,curveSegments:3});
 teil('Fassadenschrift – Residenz-Theater','schrift','rahmen',-2.35,6.01,.086,1,1,1);
 for(const x of [-4.95,4.95]){
  box('Schaukastenrückwand','holz',x,1.64,.26,4.10,2.35,.17);
  box('Bespanntes Brett','gruen',x,1.64,.36,3.85,2.08,.05);
  for(const dx of [-1.99,1.99]){
   box('Falzprofil','rahmen',x+dx,1.64,.43,.11,2.32,.26);
   box('Messingleiste','gold',x+dx,1.64,.573,.036,2.27,.02);
  }
  for(const h of [.53,2.75]){
   box('Kastenriegel','rahmen',x,h,.43,4.08,.12,.26);
   box('Deckleiste','gold',x,h,.572,4.06,.025,.021);
  }
  box('Tropfkante','zink',x,2.84,.47,4.22,.05,.4,-.045);
  for(const y of [.9,2.35])box('Scharnier','gold',x-2.015,y,.55,.09,.18,.06);
  box('Schloss','gold',x+1.965,1.52,.575,.09,.14,.024);
  box('Schlüsselloch','dunkel',x+1.965,1.515,.594,.019,.045,.012);
  box('Frontscheibe','schutzglas',x,1.63,.545,3.84,2.05,.012);
 }
 function blatt(k,x,w,h){
  box('Passepartout','creme',x,1.63,.406,w+.09,h+.10,.032);
  bild(k,x,1.63,.427,w,h);
  for(const dx of [-1,1])for(const dy of [-1,1])ei('Heftstift','gold',x+dx*(w/2-.024),1.63+dy*(h/2-.024),.439,.03,.03,.017)
 }
 blatt('blatt',-5.70,1.28,1.78);blatt('filmwerbung',-4.0,.79,1.785);
 blatt('operette',4.95,1.36,1.845);
 for(let x of [-7.78,7.78]){
  teil('Fallrohr','rund','zink',x,4.76,.24,.096,8.6,.096);
  for(let y of [1.25,3.16,5.55,7.73])teil('Rohrschelle','rund','rahmen',x,y,.24,.13,.057,.13);
 }
 for(const sign of [-1,1]){
  const x=1.83*sign;
  box('Portalwange','holz',2.05*sign,1.65,-.55,.16,3.3,1.3);
  for(const z of [-1.60,-.60])box('Türfries','holz',x,1.43,z,.13,2.8,.105);
  for(const [y,h] of [[.15,.24],[.93,.14],[2.71,.15]])box('Türquerholz','holz',x,y,-1.10,.13,h,1);
  box('Türfüllung','holz',x,.54,-1.10,.082,.65,.91);
  box('Türverglasung','schutzglas',x,1.80,-1.10,.026,1.61,.90);
  box('Glasteilung','holz',x,2.22,-1.10,.064,.044,.91);
  box('Schlossblech','gold',x-sign*.076,1.12,-.63,.022,.26,.065);
  box('Messingdrücker','gold',x-sign*.12,1.16,-.71,.061,.045,.19);
  for(const y of [.38,1.36,2.48])teil('Türband','rund','gold',x,y,-1.66,.044,.13,.044);
 }
 for(let z=-1;z>=-29;z-=2)for(const x of [9.15,11.45])box('Marienstraße','pflaster',x,-.045,z,2.3,.09,2);
 for(let side of [-1,1])box('Foyeraußenwand','putz',side*8,1.8,-4.4,.3,3.6,8.8);
 for(let z=-2;z>-8;z-=2.3)for(let y of [4.8,7.62])fenster(8.02,y,z,1.22,1.5,true);
 box('Seitenbau oben','putz',7,5.7,-17.75,2,11.4,18.5);dach(7,-17.8,2.6,19,11.4,1.2);
 for(let z=-10;z>-26;z-=2.1)for(let y of [3.95,7.1,9.94])fenster(8.02,y,z,1.1,1.45,true);
 // Angeschnittene Platzkante und Gasse. Nachbarfronten bleiben Kulissen.
 for(let x=-23;x<=23;x+=2)for(let z=1;z<=21;z+=2){
  if(x>=-7&&x<=7&&z<=19)continue;
  box('Platzrand','pflaster',x,-.06,z,2,.12,2);
 }
 for(let side of [-1,1]){
  const bx=side*(side<0?14.3:19.2),w=side<0?12.45:13.2;
  box('Nachbarhaus angenähert','putz',bx,4.45,-3.45,w,8.9,7);
  dach(bx,-3.45,w+.3,7.4,8.9,2.5);
  for(let j=-2;j<=2;j++){for(let yy of [4.2,6.92])fenster(bx+j*2.1,yy,.08,1.21,1.62);
   if(j!==0)fenster(bx+j*2.1,1.6,.08,1.65,1.91);
  }
  box('Nachbarportal','holz',bx,1.37,.11,1.28,2.74,.21);
  box('Traufgesims','sockel',bx,8.85,.11,w,.22,.42);
 }
 for(let sz of [-13,-23]){box('Rand der Marienstraße','wand',16.1,4,sz,6.6,8,9.9);dach(16.1,sz,6.9,10.1,8,2);
  for(let i=-1;i<=1;i++)for(let yy of [2,5.5]){box('Gassenfenster','glas',12.76,yy,sz+i*2.35,.15,1.5,1.1);}
 }
 // Foyer mit Kassenschalter, Milchglaskugeln, Laufgang zum Saal.
 for(let xx=-7.5;xx<=7.5;xx++)for(let j=0;j<10;j++)box('Terrazzoboden','terrazzo',xx,-.04,-.47-j*.94,1,.10,.94);box('Foyerdecke','creme',0,3.28,-4.5,16,.13,9);
 box('Kassenkörper','holz',-4.25,.58,-3.8,3.4,1.16,1.52);
 box('Zahlteller','gold',-4.25,1.19,-3.8,3.52,.075,1.62);
 for(let x of [-5.92,-2.58])box('Kassenpfosten','holz',x,1.96,-3.04,.075,1.55,.075);
 box('Kassengesims','holz',-4.25,2.74,-3.04,3.5,.1,.15);bild('kasse',-4.25,2.5,-3.0,1.35,.58);
 for(let j=0;j<4;j++){
  const x=-5.49+j*.82;
  box('Kassettenfüllung','rahmen',x,.61,-3.018,.74,.82,.035);
  box('Furnierfüllung','holz',x,.61,-2.99,.65,.70,.037);
 }
 for(let x of [-5.34,-3.17])box('Kassenglas','schutzglas',x,1.97,-3.03,.95,1.43,.018);
 box('Zahlmulde','rahmen',-4.25,1.239,-3.18,.57,.034,.29);
 box('Muldenboden','gold',-4.25,1.26,-3.18,.49,.015,.216);
 for(let i=0;i<5;i++)box('Kartenblock','creme',-4.93+i*.006,1.237+i*.008,-3.28,.19,.012,.095);
 for(let x of [-5.74,-2.76])ei('Schraubkopf','gold',x,2.74,-2.951,.038,.038,.02);
 for(let x of [-5,0,5]){teil('Abhängung','rund','gold',x,3.02,-4,.045,.45,.045);ei('Foyerleuchte','licht',x,2.71,-4,.44,.43,.44)}
 for(let side of [-1,1]){box('Saalzugang','wand',side*4.62,1.8,-9,6.8,3.6,.35);box('Rahmen','holz',side*1.35,1.55,-8.8,.15,3.1,.25)}
 box('Türsturz','holz',0,3.04,-8.8,2.8,.23,.28);bild('parkett',0,3.04,-8.60,1.4,.37);
 // Rückwärtige Sitzreihen etwas erhöht; beim Betreten leicht abfallendes Parkett.
 const first=-12.6, pitch=1.01, rowY=r=>-.06*r;
 box('Saaldecke','wand',0,7.55,-26.8,24,.25,36);
 for(let side of [-1,1]){
  box('Saalwand','wand',side*11.9,2.9,-26.8,.35,9.1,36);
  box('Holzpaneel','holz',side*11.69,.1,-26.8,.11,3.45,35.8);
  for(let z=-12;z>-44;z-=2.25)box('Paneelsteg','gold',side*11.60,.17,z,.09,3.4,.035);
  for(let z=-13;z>-42;z-=5.6)ei('Wandleuchte','licht',side*11.50,3.25,z,.28,.42,.33);
  box('Saalrückwand','wand',side*6.55,3.48,-9.12,10.85,7.7,.3);
 }
 box('Zugang Parkett','boden',0,-.10,-10.7,23.6,.18,3.4);
 for(let r=0;r<29;r++){
  const z=first-pitch*r,y=rowY(r),count=r<25?15:10;
  box('Bodenstufe','boden',0,y-.14,z,23.6,.28,1.012);
  box('Gang','rot',0,y+.007,z,1.48,.014,1.012);
  for(let side of [-1,1])for(let j=0;j<count;j++){
   const x=side*(1.16+j*.647), id=sitze.length;
   sitze.push({id,x,y,z,row:r});
   box('Klappfuß','dunkel',x,y+.27,z,.13,.52,.25);
   ei('Sitzkissen','stoff',x,y+.48,z,.58,.17,.54);
   box('Lehnenholz','holz',x,y+.76,z+.22,.57,.6,.085,-.085);
   ei('Polsterlehne','stoff',x,y+.78,z+.15,.53,.58,.1);
   box('Armlehne','holz',x+side*.30,y+.655,z,.055,.065,.45);
  }
 }
 box('Vorderes Parkett','boden',0,-1.86,-42.8,23.6,.32,4.25);
 box('Bühnenrückwand','dunkel',0,2.8,-44.7,24,9.2,.4);
 box('Bühnenpodest','holz',0,-.79,-43.2,16,1.75,2.8);
 box('Leinwandrahmen','dunkel',0,3.14,-43.6,8.35,6.18,.16);
 teil('Leinwand','bild','schirm',0,3.15,-43.48,7.84,5.88,1);
 for(let side of [-1,1]){
  for(let j=0;j<13;j++)teil('Vorhangfalte','rund','rot',side*(4.25+j*.103),3.29,-43.35+.09*Math.cos(j),.17,6.65,.21);
  for(let j=0;j<10;j++){box('Lichtpfeiler','licht',side*6.47,.25+j*.67,-42.15,.57,.642,.49);box('Messingfuge','gold',side*6.47,.58+j*.67,-42.14,.59,.024,.51)}
  for(let j=0;j<6;j++)for(let k=0;k<5;k++)box('Akustikfeld',(j+k)%2?'wand':'sockel',side*(7.12+j*.82),1.3+k*1.07,-43.1,.81,1.06,.13);
 }
 for(let j=0;j<55;j++)box('Bühnenschürze','creme',(j-27)*.278,-.54,-41.75,.28,.97,.12+.075*Math.cos(j));
 // Fiktive Kinogäste, in Sitzpose konstruiert, sowie Kassenpersonal und Besucher im Foyer.
 function person(x,y,z,i,sitting=true){
  const coat=['mantel','blau','gruen','ocker','rot'][i%5],skin=i%3?'haut':'haut2',hip=sitting?.56:.90;
  const head=hip+.68;
  ei('Jacke',coat,x,y+hip+.24,z,.41,.58,.29);
  box('Hemdkragen','hemd',x,y+hip+.46,z-.105,.16,.095,.068);
  ei('Kopf',skin,x,y+head,z,.219,.286,.216);ei('Frisur','haar',x,y+head+.083,z+.021,.23,.15,.22);
  ei('Nase',skin,x,y+head-.012,z-.105,.064,.075,.055);
  for(let a of [-1,1]){
   ei('Ohr',skin,x+a*.106,y+head,z,.048,.066,.05);
   ei('Auge','haar',x+a*.046,y+head+.027,z-.101,.024,.012,.012);
   const lx=x+a*.114;
   if(sitting){box('Oberschenkel',coat,lx,y+.54,z-.16,.15,.16,.4);box('Unterschenkel','dunkel',lx,y+.30,z-.33,.115,.45,.13)}
   else box('Hose',coat,lx,y+.48,z,.16,.87,.18);
   ei('Schuh','schuh',lx,y+.085,z-(sitting?.39:.063),.15,.12,.29);
   ei('Ärmel',coat,x+a*.205,y+hip+.22,z-.025,.14,.37,.16);
   ei('Hand',skin,x+a*.195,y+hip+.055,z-.105,.093,.125,.104);
  }
  if(i%7===2){teil('Filzkrempe','rund','rahmen',x,y+head+.125,z,.32,.024,.29);ei('Filzhut','rahmen',x,y+head+.17,z,.245,.14,.225)}
 }
 for(let r=1;r<29;r++)for(let j=0;j<4;j++){
  let row=sitze.filter(q=>q.row===r);let q=row[(r*17+j*7)%row.length];
  if(q.besetzt||Math.abs(q.x)<1.25)continue;q.besetzt=true;publikum.push(q.id);person(q.x,q.y,q.z,r*4+j);
 }
 person(-4.25,0,-4.7,3,false);person(4.1,0,-5.9,7,false);person(4.85,0,-5.75,11,false);
 hindernisse.push([-6.1,-2.4,-5.4,-2.8],[3.65,5.21,-6.24,-5.45]);
 return {mats,geom,teile,sitze,publikum,hindernisse};
};
