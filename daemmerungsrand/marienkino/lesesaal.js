// Lesefassungen referenzieren dieselben Druckvorlagen wie die Meshes.
const drucke = [
 {titel:'Eröffnung am Marienplatz',typ:'Paderborn · Rekonstruktion',datei:'Eroeffnung_Spielrekonstruktion',hinweis:'Das Eröffnungsdatum und der Film sind belegt. Satz, Papierfarbe und Anordnung wurden für die Szene entworfen.',quelle:'https://capitol-paderborn.de/info/'},
 {titel:'Anzeige der Schauburg',typ:'Mannheim · 24. Mai 1935',datei:'Mannheim_1935',hinweis:'Originalanzeige für denselben Film. Die Spielzeiten und der Kinoname gehören zur Mannheimer Schauburg. Ausschnitt aus dem Hakenkreuzbanner, einer NS-Tageszeitung, Früh-Ausgabe Nr. 235, S. 12. MARCHIVUM Druckschriften digital, CC BY-NC-SA 4.0. Der Beschnitt steht unter derselben Lizenz.',quelle:'https://nbn-resolving.org/urn:nbn:de:bsz:mh40-269032',lizenz:'https://creativecommons.org/licenses/by-nc-sa/4.0/'},
 {titel:'Besetzungszettel der Volksoper',typ:'Wien · 26. März 1935',datei:'Wien_1935',hinweis:'Originalzettel zur Bühnenfassung der Operette. Sammlung der Wienbibliothek im Rathaus, Public Domain Mark 1.0. Der Aushang in der Spielszene ist eine kuratorische Ergänzung.',quelle:'https://digital.wienbibliothek.at/wbrtheater/content/titleinfo/5746359'}
];
const dialog=document.querySelector('#druck'),liste=document.querySelector('#druckwahl'),bild=document.querySelector('#druckbild'),gross=document.querySelector('#gross');
function anzeigen(i){const d=drucke[i];liste.value=i;document.querySelector('#drucktitel').textContent=d.titel;document.querySelector('#druckort').textContent=d.typ;document.querySelector('#herkunft').textContent=d.hinweis;document.querySelector('#archiv').href=d.quelle;const lizenz=document.querySelector('#lizenz');lizenz.hidden=!d.lizenz;if(d.lizenz)lizenz.href=d.lizenz;bild.src='Belege/'+d.datei+'.jpg';bild.alt=d.titel;bild.classList.remove('gross');gross.textContent='Vergrößern';document.querySelector('#druckrolle').scrollTo(0,0)}
drucke.forEach((d,i)=>liste.add(new Option(d.titel,i)));liste.onchange=()=>anzeigen(Number(liste.value));
document.querySelector('#lesen').onclick=()=>{anzeigen(0);dialog.showModal()};
document.querySelector('#schliessen').onclick=()=>dialog.close();
gross.onclick=()=>{const an=bild.classList.toggle('gross');gross.textContent=an?'Einpassen':'Vergrößern'};
