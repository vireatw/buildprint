/*! 築跡 Buildprint © 綠建築建設股份有限公司. All rights reserved. */
// 工地動畫 3D renderer. index.html keeps the whole simulation (who is where, doing what); this file only draws it.
// The camera is an orthographic one set up to match index.html's SP() projection exactly, so taps, drags, labels
// and the 編輯 tools (all worked out in 2D there) line up with what is drawn here.
// World: three X = site x, three Z = site y, three Y = height (the `world` group squashes Y so 1 unit of height = 0.5·S px, as in SP).
import * as T from './three.module.min.js';

const PHI=Math.PI/6, CAMDIR=new T.Vector3(Math.cos(PHI)/Math.SQRT2,Math.sin(PHI),Math.cos(PHI)/Math.SQRT2), YS=0.5/(Math.cos(PHI)/Math.SQRT2);
const mats=new Map();
function M(col,o){ const k=col+(o?JSON.stringify(o):''); let m=mats.get(k); if(!m){ m=new T.MeshLambertMaterial(Object.assign({color:col,flatShading:true},o||{})); m.userData.cached=true; mats.set(k,m); } return m; }
const G={ box:new T.BoxGeometry(1,1,1), cyl:new T.CylinderGeometry(0.5,0.5,1,14), cyl6:new T.CylinderGeometry(0.5,0.5,1,7), sph:new T.SphereGeometry(0.5,12,9), ico:new T.IcosahedronGeometry(0.5,0), ico1:new T.IcosahedronGeometry(0.5,1),
  cone:new T.ConeGeometry(0.5,1,7), cone4:new T.ConeGeometry(0.5,1,4), dome:new T.SphereGeometry(0.5,12,6,0,Math.PI*2,0,Math.PI/2) };
const SHARED=new Set(Object.values(G));
const hatMats=new Map();
function hatMat(col){ let m=hatMats.get(col); if(!m){ m=new T.MeshPhongMaterial({color:col,shininess:70,specular:new T.Color('#4A4A4A')}); m.userData.cached=true; hatMats.set(col,m); } return m; }
function freeTree(o){ o.traverse(m=>{ if(m.geometry&&!SHARED.has(m.geometry)) m.geometry.dispose(); const ms=m.material?(Array.isArray(m.material)?m.material:[m.material]):[]; ms.forEach(x=>{ if(!x.userData||!x.userData.cached){ if(x.map) x.map.dispose(); x.dispose(); } }); }); }
function mesh(g,m,sh){ const o=new T.Mesh(g,m); if(sh!==false){ o.castShadow=true; o.receiveShadow=true; } return o; }
// a box given by its size and centre
function B(w,h,d,col,x,y,z,o){ const b=mesh(G.box,typeof col==='string'?M(col,o):col); b.scale.set(w,h,d); b.position.set(x||0,y||0,z||0); return b; }
function C(r,h,col,x,y,z,geo,o){ const b=mesh(geo||G.cyl,typeof col==='string'?M(col,o):col); b.scale.set(r*2,h,r*2); b.position.set(x||0,y||0,z||0); return b; }
function S(r,col,x,y,z,geo,o){ const b=mesh(geo||G.sph,typeof col==='string'?M(col,o):col); b.scale.setScalar(r*2); b.position.set(x||0,y||0,z||0); return b; }
function grp(...ch){ const g=new T.Group(); ch.forEach(c=>c&&g.add(c)); return g; }
// stretch a unit box/cylinder (long axis Y) from point a to point b
const _v=new T.Vector3(), _q=new T.Quaternion(), UP=new T.Vector3(0,1,0);
function link(m,ax,ay,az,bx,by,bz,th){ _v.set(bx-ax,by-ay,bz-az); const L=_v.length()||1e-4; m.position.set((ax+bx)/2,(ay+by)/2,(az+bz)/2); m.quaternion.setFromUnitVectors(UP,_v.multiplyScalar(1/L)); m.scale.set(th,L,th); return m; }
function wheel(r,w,x,y,z){ const g=grp(); const t=mesh(G.cyl,M('#1E2226')); t.scale.set(r*2,w,r*2); t.rotation.x=Math.PI/2; g.add(t); const h=mesh(G.cyl,M('#D5DADF')); h.scale.set(r*1.0,w*1.08,r*1.0); h.rotation.x=Math.PI/2; g.add(h); const n=mesh(G.cyl6,M('#7A848D')); n.scale.set(r*0.4,w*1.16,r*0.4); n.rotation.x=Math.PI/2; g.add(n); g.position.set(x,y,z); g.userData.wheel=true; return g; }
function textTex(txt,o){ o=o||{}; const cv=document.createElement('canvas'), fs=o.fs||96, c=cv.getContext('2d'); c.font=`800 ${fs}px "Noto Sans TC",sans-serif`; const w=Math.ceil(c.measureText(txt).width+fs*0.3); cv.width=w; cv.height=Math.ceil(fs*1.3);
  const c2=cv.getContext('2d'); if(o.bg){ c2.fillStyle=o.bg; c2.fillRect(0,0,cv.width,cv.height); } c2.font=`800 ${fs}px "Noto Sans TC",sans-serif`; c2.fillStyle=o.col||'#1B232A'; c2.textBaseline='middle'; c2.textAlign='center'; c2.fillText(txt,cv.width/2,cv.height/2+fs*0.04);
  const t=new T.CanvasTexture(cv); t.colorSpace=T.SRGBColorSpace; t.anisotropy=4; t.userData={asp:cv.width/cv.height}; return t; }
// the office flag: the company name in green on white, with a green border
function flagTex(txt){ const fs=88, cv=document.createElement('canvas'), c=cv.getContext('2d'); c.font=`800 ${fs}px "Noto Sans TC",sans-serif`; const tw=txt?c.measureText(txt).width:fs*1.6; cv.width=Math.ceil(tw+fs*0.9); cv.height=Math.ceil(fs*1.55);
  const c2=cv.getContext('2d'); c2.fillStyle='#FFFFFF'; c2.fillRect(0,0,cv.width,cv.height); c2.strokeStyle='#2E8B57'; c2.lineWidth=fs*0.12; c2.strokeRect(fs*0.06,fs*0.06,cv.width-fs*0.12,cv.height-fs*0.12);
  if(txt){ c2.font=`800 ${fs}px "Noto Sans TC",sans-serif`; c2.fillStyle='#2E8B57'; c2.textAlign='center'; c2.textBaseline='middle'; c2.fillText(txt,cv.width/2,cv.height/2+fs*0.04); }
  const t=new T.CanvasTexture(cv); t.colorSpace=T.SRGBColorSpace; t.anisotropy=4; t.userData={asp:cv.width/cv.height}; return t; }
function lerpAng(a,b,k){ let d=b-a; d=Math.atan2(Math.sin(d),Math.cos(d)); return a+d*k; }

/* ---------------- people ---------------- */
const TOOL_ANG={ tie:t=>1.15+Math.sin(t*9)*0.12, weld:t=>0.8+Math.sin(t*1.3)*0.06, trowel:t=>0.1+Math.sin(t*3.2)*0.7, float:t=>1.0+Math.sin(t*3.5)*0.1, brick:t=>1.2-(Math.sin(t*2.2)+1)/2, tile:t=>1.15+Math.abs(Math.sin(t*5))*0.18,
  paint:t=>-0.55+Math.sin(t*3)*0.45, waterproof:t=>0.9+Math.sin(t*2.6)*0.12, drill:t=>0.25+Math.sin(t*40)*0.02, saw:t=>0.85+Math.sin(t*8)*0.18, grind:t=>1.0+Math.sin(t*2)*0.05, shovel:t=>{ const k=(t*0.9)%1; return k<0.5?1.2:1.2-(k-0.5)*2*1.5; },
  survey:t=>0.25, wire:t=>0.3+Math.sin(t*3.5)*0.5, wrench:t=>0.55+Math.sin(t*5)*0.4, breaker:t=>1.15, glass:t=>0.5, spray:t=>0.3+Math.sin(t*2)*0.25, hammer:t=>0.4+Math.abs(Math.sin(t*6)), handle:t=>1.0+Math.sin(t*2.4)*0.22, flag:t=>-1.05+Math.sin(t*3.2)*0.55, inspect:t=>0.9 };
TOOL_ANG.plant=TOOL_ANG.shovel;
const TWO_HANDS={breaker:1,shovel:1,plant:1,paint:1,waterproof:1,float:1,glass:1,handle:1};
const LOW={tie:1,tile:1,float:0.6};
// what is in the hand (origin = the hand, +X forward, −Y down the arm) and what stands on the ground in front of the feet
function toolFor(act){ const hand=grp(), ground=grp(); let fx=null;
  const stick=(len,col,th)=>B(th||0.035,len,th||0.035,col,0,-len/2,0);
  switch(act){
  case 'hammer': hand.add(B(0.03,0.26,0.03,'#B07A43',0.1,-0.02,0)); hand.children[0].rotation.z=-1.1; hand.add(B(0.12,0.07,0.07,'#6B7680',0.21,0.05,0)); break;
  case 'tie': [[0,0.5],[0.12,-0.5],[-0.1,0.9]].forEach(([dx,r])=>{ const b=B(0.62,0.035,0.035,'#A0583A',0.42+dx,0.03,0); b.rotation.y=r; ground.add(b); }); hand.add(B(0.02,0.1,0.02,'#5B6670',0.02,-0.06,0)); break;
  case 'weld': { const tq=B(0.03,0.2,0.03,'#3B4650',0.06,-0.08,0); tq.rotation.z=0.8; hand.add(tq); fx=S(0.07,'#FFFFFF',0.16,-0.16,0,G.ico,{emissive:'#BFE4FF',emissiveIntensity:3}); fx.castShadow=false; hand.add(fx); break; }
  case 'trowel': hand.add(B(0.02,0.2,0.1,'#C9CED2',0.04,0,0)); break;
  case 'float': { const p=B(0.03,0.9,0.03,'#A0703C',0.3,-0.3,0); p.rotation.z=0.75; hand.add(p); const sh=C(0.42,0.012,'#8C8F8C',0.72,0.012,0,G.cyl,{transparent:true,opacity:0.5}); sh.castShadow=false; ground.add(sh); fx=B(0.3,0.03,0.16,'#C9CED2',0.72,0.03,0); ground.add(fx); break; }
  case 'brick': hand.add(B(0.16,0.07,0.08,'#B5553A',0.04,-0.03,0)); for(let r=0;r<3;r++) for(let i=0;i<3;i++) ground.add(B(0.16,0.07,0.08,'#B5553A',0.36+(r%2)*0.05,0.035+r*0.075,(i-1)*0.17+(r%2)*0.04)); break;
  case 'tile': hand.add(B(0.16,0.015,0.16,'#F6F2E8',0.06,-0.05,0)); for(let i=0;i<4;i++) ground.add(B(0.17,0.015,0.17,i%2?'#EFEAE0':'#E2DBCC',0.36+Math.floor(i/2)*0.18,0.012,(i%2-0.5)*0.18)); break;
  case 'paint': { const p=B(0.025,0.5,0.025,'#8E99A3',0.08,0.2,0); p.rotation.z=-0.3; hand.add(p); const r=C(0.035,0.2,'#F4F1E8',0.16,0.45,0); r.rotation.x=Math.PI/2; hand.add(r); ground.add(C(0.08,0.14,'#DADFE3',-0.3,0.07,0.15)); break; }
  case 'waterproof': { const p=B(0.025,0.8,0.025,'#8E99A3',0.25,-0.28,0); p.rotation.z=0.75; hand.add(p); const sh=C(0.44,0.012,'#2B3238',0.7,0.012,0,G.cyl,{transparent:true,opacity:0.55}); sh.castShadow=false; ground.add(sh); fx=C(0.04,0.24,'#22282E',0.66,0.05,0); fx.rotation.x=Math.PI/2; ground.add(fx); break; }
  case 'drill': hand.add(B(0.18,0.07,0.06,'#1E9AA8',0.08,0.02,0),B(0.05,0.1,0.05,'#22282E',0.02,-0.05,0),B(0.1,0.015,0.015,'#6B7680',0.22,0.02,0)); break;
  case 'saw': ground.add(B(0.7,0.04,0.18,'#C99555',0.5,0.42,0),B(0.04,0.42,0.04,'#8A6B45',0.24,0.21,0),B(0.04,0.42,0.04,'#8A6B45',0.76,0.21,0)); hand.add(B(0.28,0.07,0.012,'#C9CED2',0.16,-0.03,0),B(0.06,0.1,0.03,'#A0703C',0,-0.02,0)); break;
  case 'grind': hand.add(B(0.16,0.05,0.05,'#2B3238',0.07,-0.02,0)); { const d=C(0.07,0.015,'#8E99A3',0.17,-0.05,0); d.rotation.x=Math.PI/2; hand.add(d); fx=grp(); for(let i=0;i<5;i++){ const s=S(0.018,'#FFC83C',0,0,0,G.ico,{emissive:'#FFB020',emissiveIntensity:2}); s.castShadow=false; fx.add(s); } fx.position.set(0.17,-0.05,0); hand.add(fx); } break;
  case 'shovel': case 'plant': { const p=B(0.03,0.55,0.03,'#A0703C',0.16,-0.14,0); p.rotation.z=0.9; hand.add(p); const bl=B(0.14,0.02,0.12,'#8E99A3',0.42,-0.36,0); bl.rotation.z=-0.6; hand.add(bl); const md=S(0.2,'#A98B5E',0.55,0,0,G.ico1); md.scale.y=0.16; ground.add(md);
    if(act==='plant'){ ground.add(B(0.02,0.18,0.02,'#3F8F4A',0.82,0.09,0)); [[-0.05],[0.05]].forEach(([d])=>{ const l=S(0.05,'#57B15F',0.82+d,0.18,0,G.ico); l.scale.y=0.03; ground.add(l); }); } break; }
  case 'survey': { const tx=0.5; [[0.16,0],[-0.1,0.14],[-0.1,-0.14]].forEach(([dx,dz])=>ground.add(link(mesh(G.box,M('#D7A51E')),tx,0.62,0,tx+dx,0,dz,0.025))); ground.add(B(0.16,0.12,0.12,'#F2C200',tx,0.68,0),C(0.03,0.06,'#22282E',tx+0.1,0.68,0)); ground.children[4].rotation.z=Math.PI/2; break; }
  case 'wire': { const r=C(0.11,0.1,'#E0782A',0.42,0.11,0); r.rotation.x=Math.PI/2; ground.add(r); fx=r; const k=C(0.05,0.12,'#22282E',0.42,0.11,0); k.rotation.x=Math.PI/2; ground.add(k); hand.add(B(0.015,0.3,0.015,'#22282E',0.06,-0.12,0)); hand.children[0].rotation.z=0.9; break; }
  case 'wrench': { const w=B(0.035,0.2,0.02,'#C9CED2',0.06,0.06,0); w.rotation.z=-0.9; hand.add(w); hand.add(B(0.07,0.06,0.025,'#C9CED2',0.15,0.12,0)); break; }
  case 'breaker': hand.add(B(0.1,0.22,0.1,'#E4A21B',0.02,-0.1,0),B(0.24,0.03,0.03,'#22282E',0.02,0.0,0),B(0.03,0.3,0.03,'#5B6670',0.02,-0.34,0)); fx=grp(); for(let i=0;i<3;i++){ const d=S(0.07,'#B8B4AA',0,0,0,G.ico,{transparent:true,opacity:0.5}); d.castShadow=false; fx.add(d); } fx.position.set(0.36,0.03,0); ground.add(fx); break;
  case 'glass': { const p=B(0.02,0.7,0.5,'#A6D8F0',0.14,0.02,0,{transparent:true,opacity:0.55}); p.castShadow=false; hand.add(p); break; }
  case 'spray': hand.add(B(0.14,0.05,0.04,'#3B4650',0.07,0,0),B(0.05,0.07,0.05,'#C9CED2',0.03,0.06,0)); fx=grp(); for(let i=0;i<7;i++){ const d=S(0.04,'#F2F5F6',0,0,0,G.ico,{transparent:true,opacity:0.5}); d.castShadow=false; fx.add(d); } fx.position.set(0.16,0,0); hand.add(fx); break;
  case 'handle': hand.add(B(0.2,0.16,0.26,'#C99555',0.04,-0.04,0.14)); break;
  case 'flag': hand.add(B(0.03,0.2,0.03,'#FF5A1F',0.02,-0.12,0)); break;
  case 'inspect': hand.add(B(0.02,0.2,0.15,'#FFF7E0',0.05,-0.02,0)); break;
  case 'broom': { const p=B(0.025,0.75,0.025,'#A0703C',0.2,-0.24,0); p.rotation.z=0.7; hand.add(p); hand.add(B(0.1,0.06,0.22,'#D8B25A',0.48,-0.52,0)); break; }
  case 'bento': hand.add(B(0.2,0.08,0.15,'#F4F1E8',0.08,-0.02,-0.1),B(0.21,0.025,0.16,'#C0392B',0.08,0.025,-0.1)); break;
  case 'hose': fx=grp(); for(let i=0;i<7;i++){ const d=S(0.03,'#5AAFF0',0,0,0,G.ico,{transparent:true,opacity:0.8}); d.castShadow=false; fx.add(d); } hand.add(fx); hand.add(B(0.1,0.03,0.03,'#2D7D46',0.04,0,0)); break;
  }
  return {hand,ground,fx}; }
function buildPerson(w){
  const eng=w.kind==='eng', vest=eng?'#FFFFFF':'#FF7A1A', skin=w.skin||'#E9B88C', sleeve=eng?'#FFFFFF':(w.shirt||'#5B7FA6'), pants=w.pants||'#33465C';
  const g=grp(), body=grp(); g.add(body);
  const legL=grp(B(0.1,0.24,0.11,pants,0,-0.12,0),B(0.15,0.07,0.12,'#4A3A2C',0.025,-0.265,0)), legR=legL.clone(); legL.position.set(0,0.3,-0.075); legR.position.set(0,0.3,0.075); g.add(legL,legR);
  const torso=C(0.17,0.34,vest,0,0.47,0); torso.scale.set(0.3,0.34,0.36); body.add(torso);
  if(eng){ body.add(B(0.02,0.3,0.07,'#F5C400',0.14,0.47,-0.11),B(0.02,0.3,0.07,'#F5C400',0.14,0.47,0.11),B(0.012,0.08,0.06,'#2F6DB5',0.158,0.46,0)); }
  else { [0.44,0.53].forEach(y=>{ const r=C(0.172,0.035,'#FFFFFF',0,y,0); r.scale.set(0.31,0.035,0.37); r.castShadow=false; body.add(r); }); const belt=C(0.172,0.04,'#5E4126',0,0.33,0); belt.scale.set(0.31,0.04,0.37); body.add(belt); body.add(B(0.08,0.1,0.05,'#7A5632',-0.02,0.3,0.19)); }
  const mkArm=()=>{ const a=grp(B(0.085,0.24,0.085,sleeve,0,-0.12,0), S(0.05,(!eng&&w.glove)?'#F6F2E6':skin,0,-0.26,0)); return a; };
  const armR=mkArm(), armL=mkArm(); armR.position.set(0,0.6,0.2); armL.position.set(0,0.6,-0.2); body.add(armR,armL);
  const handR=grp(); handR.position.set(0,-0.27,0); armR.add(handR);
  const head=grp(); head.position.set(0,0.82,0); body.add(head);
  head.add(S(0.185,skin)); const hair=S(0.175,'#2E2A28',-0.045,0.02,0); head.add(hair);
  [-1,1].forEach(k=>{ const e=S(0.026,'#2A2A2A',0.172,-0.015,k*0.07); e.castShadow=false; head.add(e); });
  const hm=hatMat(w.hat||'#F2C200'), hat=grp(); hat.position.y=0.05; head.add(hat);
  const shell=mesh(G.dome,hm); shell.scale.set(0.43,0.36,0.39); hat.add(shell);
  const ridge=mesh(G.dome,hm); ridge.scale.set(0.45,0.39,0.1); hat.add(ridge);
  [-1,1].forEach(k=>{ const rb=mesh(G.dome,hm); rb.scale.set(0.4,0.34,0.05); rb.position.z=k*0.085; rb.rotation.x=k*0.32; hat.add(rb); });
  const peak=mesh(G.cyl,hm); peak.scale.set(0.34,0.022,0.36); peak.position.set(0.1,0.012,0); peak.rotation.z=-0.12; hat.add(peak);
  const brim=mesh(G.cyl,hm); brim.scale.set(0.47,0.02,0.43); brim.position.y=0.008; hat.add(brim);
  const band=mesh(G.cyl,M('#2B3238')); band.scale.set(0.39,0.035,0.36); band.position.y=-0.012; hat.add(band);
  if(w.towel&&!eng){ const tw=C(0.13,0.05,'#F4F6F8',0,0.66,0); body.add(tw); }
  const visor=B(0.03,0.13,0.26,'#22282E',0.18,-0.01,0); visor.visible=false; head.add(visor);
  // things carried over the head / on the shoulder
  const plank=B(0.95,0.05,0.3,'#C99555',0,1.08,0); plank.visible=false; g.add(plank);
  const pipe=C(0.05,1.5,'#EEF2F5',0,1.0,0.16); pipe.rotation.z=Math.PI/2; pipe.visible=false; g.add(pipe);
  const bag=S(0.1,'#F4F6F8',0,-0.3,0,G.ico1); bag.visible=false; armL.add(bag);
  const groundSlot=grp(); g.add(groundSlot);
  const seat=grp(C(0.15,0.27,'#3B7FC4',-0.03,0.135,0,G.cyl),C(0.16,0.03,'#2E6AA8',-0.03,0.27,0,G.cyl)); seat.visible=false; g.add(seat);   // an upturned bucket to sit on at 午休
  g.scale.setScalar(1.18*(w.sz||1));
  g.userData={body,legL,legR,armR,armL,handR,head,visor,plank,pipe,bag,groundSlot,seat,tool:null,toolKey:'',heading:(w.flip?2.4:0.7)+w.ph,eng};
  return g; }
function poseOf(w,inYard){ const walking=w.state==='walk'; if(w.state==='rest') return 'rest';
  if(walking) return w.carry?'carry':w.pipe?'pipe':'walk';
  if(w.carry) return 'carry'; if(w.pipe) return 'pipe';
  if(w.clean) return w.cmode==='pick'?'pick':'broom';
  if(w.wash) return 'hose'; if(w.role==='signal') return 'flag'; if(w.role==='pour') return 'pour'; if(w.kind==='eng') return 'inspect';
  if(w.role==='carry'||(inYard&&!w.actOwn)) return 'handle';
  return w.act||'hammer'; }
function animPerson(g,w,t,dt,st,inYard,view){ const u=g.userData, T0=t+w.ph, pose=poseOf(w,inYard), walking=w.state==='walk';
  // heading: the way he walks; standing, toward what he works on
  let hd=u.heading; if(walking&&w.tx!=null){ const dx=w.tx-w.x, dy=w.ty-w.y; if(dx*dx+dy*dy>1e-4) hd=Math.atan2(dy,dx); }
  else { const aim=w.role==='pour'&&st.pumpV&&st.pumpV.cur?st.pumpV.cur:(w.wash&&w.aim)?w.aim:null; hd=aim?Math.atan2(aim.y-w.y,aim.x-w.x):Math.PI/4+(w.ph-3)*0.2-(view?view.rot||0:0); }   // at work he turns three-quarters toward the viewer, so faces and tools are seen
  u.heading=lerpAng(u.heading,hd,Math.min(1,dt*7)); g.rotation.y=-u.heading;
  const key=walking?'':pose; if(key!==u.toolKey){ u.toolKey=key; if(u.tool){ u.handR.remove(u.tool.hand); u.groundSlot.remove(u.tool.ground); }
    const tk={rest:'bento',broom:'broom',pick:'',hose:'hose',flag:'flag',inspect:'inspect',handle:'handle',pour:'',carry:'',pipe:'',walk:'','':''}[key]; const act=tk!==undefined?tk:key; u.tool=act?toolFor(act):null; if(u.tool){ u.handR.add(u.tool.hand); u.groundSlot.add(u.tool.ground); } u.act=act; }
  u.seat.visible=pose==='rest'; u.plank.visible=!!w.carry; u.pipe.visible=!!w.pipe; u.bag.visible=!!w.clean&&pose==='pick'; u.visor.visible=pose==='weld';
  let aR=1.45, aL=1.45, lean=0, drop=0, bob=0, sw=0;
  if(walking){ sw=Math.sin(T0*9); bob=Math.abs(Math.sin(T0*9))*0.035; aR=1.45+sw*0.5; aL=1.45-sw*0.5; if(w.carry||w.pipe){ aR=aL=-1.3; } }
  else if(pose==='carry'||pose==='pipe'){ aR=aL=-1.3; }
  else if(pose==='pick'){ const k=(Math.sin(T0*2.6)+1)/2; lean=k*0.7; drop=k*0.06; aR=1.2; }
  else if(pose==='broom'){ aR=aL=1.0+Math.sin(T0*4)*0.28; }
  else if(pose==='hose'){ aR=0.2; aL=0.5; }
  else if(pose==='rest'){ const bite=((T0*0.6)%3)<0.7; aR=0.75; aL=bite?-0.6:0.75; drop=0.04; }
  else if(pose==='pour'){ aR=aL=0.3; }
  else if(pose==='flag'){ aR=TOOL_ANG.flag(T0); aL=-1.25-Math.sin(T0*3.2)*0.35; }
  else { const f=TOOL_ANG[pose]||TOOL_ANG.hammer; aR=f(T0); aL=TWO_HANDS[pose]?aR+0.15:1.45; const lw=LOW[pose]; if(lw){ lean=0.45*lw; drop=0.1*lw; } if(pose==='breaker') bob=Math.abs(Math.sin(T0*40))*0.012; if(pose==='hammer') bob=Math.abs(Math.sin(T0*6))*0.02; bob+=Math.sin(T0*2.2)*0.004; }
  u.armR.rotation.z=Math.PI/2-aR; u.armL.rotation.z=Math.PI/2-aL; const sit=pose==='rest'; u.legL.rotation.z=sit?1.0:sw*0.55; u.legR.rotation.z=sit?1.0:-sw*0.55; u.legL.position.y=u.legR.position.y=0.3;
  u.body.rotation.z=-lean; u.body.position.y=bob-drop; u.body.position.x=lean*0.12;
  // tool effects
  const fx=u.tool&&u.tool.fx; if(fx){ const a=u.act;
    if(a==='weld'){ const fl=Math.sin(T0*37)+Math.sin(T0*23.7); fx.visible=fl>-0.4; fx.scale.setScalar(0.06+0.03*fl); }
    else if(a==='grind'){ fx.children.forEach((s,i)=>{ const k=((T0*3)+i/5)%1; s.position.set(-k*0.35,-k*0.12-(i%2)*k*0.08,(i%3-1)*k*0.06); s.visible=k<0.9; }); }
    else if(a==='breaker'){ fx.children.forEach((s,i)=>{ const k=((T0*1.4)+i/3)%1; s.position.set((i-1)*0.12*k,k*0.22,(i%2-0.5)*0.2*k); s.scale.setScalar(0.08+k*0.14); s.material.opacity=0.5*(1-k); }); }
    else if(a==='spray'){ fx.children.forEach((s,i)=>{ const k=((T0*1.6)+i/7)%1; s.position.set(k*0.6,(i%3-1)*k*0.14,((i*7)%5-2)*k*0.07); s.scale.setScalar(0.05+k*0.12); }); }
    else if(a==='hose'){ fx.children.forEach((s,i)=>{ const k=((t*1.8)+i/7)%1; s.position.set(0.1+k*0.85,Math.sin(k*Math.PI)*0.25-k*0.25,0); }); }
    else if(a==='float'||a==='waterproof'){ fx.position.x=0.7+Math.sin(T0*(a==='float'?3.5:2.6))*0.14; }
    else if(a==='wire'){ fx.rotation.z=T0*3; } }
}

/* ---------------- machines ---------------- */
const YEL='#F0B429', YEL2='#D49A1A', DARK='#3A4046', GLASS=M('#9FD0EA',{flatShading:false});
function cab(len,h,wid,col,x,y){ const g=grp(B(len,h,wid,col,x,y+h/2,0)); g.add(B(0.02,h*0.42,wid*0.84,GLASS,x+len/2+0.005,y+h*0.68,0)); [-1,1].forEach(k=>{ g.add(B(len*0.6,h*0.42,0.02,GLASS,x+len*0.1,y+h*0.68,k*(wid/2+0.005))); g.add(B(0.03,0.08,0.12,'#FFE9A8',x+len/2+0.005,y+h*0.2,k*wid*0.33,{emissive:'#FFE9A8',emissiveIntensity:0.25})); }); g.add(B(0.02,h*0.2,wid*0.45,'#2B3238',x+len/2+0.006,y+h*0.22,0)); return g; }
function tail(x,wid){ const g=grp(B(0.03,0.14,wid,'#2B3238',x,0.2,0)); [-1,1].forEach(k=>g.add(B(0.035,0.1,0.12,'#E5433A',x-0.005,0.2,k*wid*0.4))); for(let i=-1;i<=1;i++) g.add(B(0.035,0.1,0.1,'#F2C200',x-0.004,0.2,i*wid*0.2)); return g; }
function beacon(x,y,z){ const b=S(0.05,'#FFB020',x,y,z,G.sph,{emissive:'#FF9A00',emissiveIntensity:1}); b.material=b.material.clone(); b.castShadow=false; b.userData.beacon=true; return b; }
function operator(x,y,z){ const g=grp(S(0.1,'#E9B88C',0,0,0), mesh(G.dome,M('#F2C200',{flatShading:false}))); g.children[1].scale.set(0.24,0.2,0.24); g.children[1].position.y=0.02; g.add(B(0.2,0.2,0.22,'#FF7A1A',0,-0.2,0)); g.position.set(x,y,z); return g; }
function tracks(len,wid,h){ const g=grp(); [-1,1].forEach(k=>{ g.add(B(len,h,0.26,'#22272C',0,h/2,k*(wid/2-0.13))); const n=Math.max(3,Math.round(len/0.28)); for(let i=0;i<=n;i++){ const r=(i===0||i===n)?h*0.42:h*0.3; const wl=C(r,0.04,'#8E99A3',-len/2+0.12+(len-0.24)*i/n,h/2,k*(wid/2+0.005)); wl.rotation.x=Math.PI/2; g.add(wl); } }); return g; }
function buildVehicle(v){ const g=grp(), u={}; g.userData=u; u.wheels=[]; u.beacons=[];
  const addW=(xs,r,hw)=>xs.forEach(x=>[-1,1].forEach(k=>{ const w=wheel(r,0.16,x,r,k*hw); g.add(w); u.wheels.push(w); }));
  if(v.type==='truck'){ g.add(B(2.0,0.2,0.8,'#444B52',0,0.34,0)); g.add(cab(0.56,0.62,0.76,'#2F6DB5',0.68,0.34)); g.add(B(1.36,0.22,0.86,'#ECE8DC',-0.32,0.55,0)); g.add(B(1.36,0.05,0.88,'#2F6DB5',-0.32,0.45,0)); [-1,1].forEach(k=>g.add(B(1.36,0.12,0.03,'#D9D5C8',-0.32,0.72,k*0.42))); g.add(B(0.03,0.12,0.86,'#D9D5C8',-0.99,0.72,0)); g.add(tail(-1.0,0.8)); addW([0.62,-0.6],0.2,0.42);
    u.load=grp(); for(let i=0;i<3;i++) u.load.add(B(1.2,0.085,0.7,i%2?'#C99555':'#B98245',-0.32,0.71+i*0.09,0)); g.add(u.load);
    if(v.crane){ g.add(B(0.26,0.5,0.26,'#E4A21B',0.28,0.9,0)); u.kn=mesh(G.box,M('#E4A21B')); g.add(u.kn); u.rope=mesh(G.box,M('#22282E')); u.bundle=grp(B(0.9,0.07,0.5,'#C99555',0,0,0),B(0.9,0.07,0.5,'#B98245',0,0.075,0),B(0.9,0.07,0.5,'#C99555',0,0.15,0),B(0.05,0.26,0.54,'#22282E',-0.25,0.08,0),B(0.05,0.26,0.54,'#22282E',0.25,0.08,0)); g.add(u.rope,u.bundle); } }
  else if(v.type==='mixer'||v.type==='pump'){ g.add(B(2.0,0.2,0.8,'#444B52',0,0.36,0)); g.add(cab(0.56,0.62,0.76,v.type==='mixer'?'#F2B33D':'#F4F4F0',0.67,0.36)); g.add(tail(-1.0,0.8)); addW([0.64,-0.3,-0.72],0.2,0.42);
    if(v.type==='mixer'){ g.add(B(0.16,0.4,0.6,'#C9CED2',0.28,0.66,0)); const dr=grp(); const d1=mesh(new T.CylinderGeometry(0.2,0.42,0.75,14),M('#F4F1EA',{flatShading:false})); d1.position.y=0.3; const d2=mesh(new T.CylinderGeometry(0.42,0.3,0.5,14),M('#F4F1EA',{flatShading:false})); d2.position.y=-0.32; dr.add(d1,d2);
        for(let i=0;i<2;i++){ const s=B(0.86,1.1,0.05,'#D9473A',0,0,0); s.rotation.y=i*Math.PI/2; s.scale.set(0.84,0.9,0.05); s.rotation.z=0.35; dr.add(s); }
        dr.rotation.z=Math.PI/2+0.28; dr.position.set(-0.4,0.92,0); g.add(dr); u.drum=dr; g.add(B(0.2,0.2,0.3,'#5C646B',-0.98,1.28,0)); u.chute=B(0.5,0.05,0.14,'#7E868D',-1.15,0.75,0); u.chute.rotation.z=0.6; g.add(u.chute); }
    else { g.add(B(1.5,0.3,0.76,'#F4F4F0',-0.22,0.6,0),B(1.5,0.07,0.78,'#D9473A',-0.22,0.62,0),B(0.4,0.3,0.5,'#5C646B',-1.12,0.5,0)); u.turret=B(0.4,0.36,0.4,'#D9473A',-0.45,0.92,0); g.add(u.turret);
      u.out=grp(); [[-0.6,1],[-0.6,-1],[0.55,1],[0.55,-1]].forEach(([a,k])=>{ u.out.add(link(mesh(G.box,M('#D9A11A')),a,0.4,k*0.38,a,0.08,k*1.05,0.07)); u.out.add(B(0.2,0.05,0.2,'#6B4E2E',a,0.03,k*1.05)); }); g.add(u.out);
      u.boom=[0,1,2,3].map(i=>{ const m=mesh(G.cyl,M(i===3?'#2B3238':'#E8543F',{flatShading:false})); g.add(m); return m; }); u.joints=[0,1,2].map(()=>{ const j=S(0.11,'#3B4650'); g.add(j); return j; }); u.blob=C(0.3,0.03,'#8C8E8A',0,0,0); u.blob.castShadow=false; } }
  else if(v.type==='mcrane'){ g.add(B(2.3,0.22,0.8,'#444B52',0.15,0.36,0),B(2.3,0.05,0.82,'#F2C200',0.15,0.3,0)); g.add(cab(0.52,0.5,0.76,'#E4A21B',1.02,0.47)); g.add(tail(-1.0,0.8)); addW([0.9,-0.1,-0.62],0.2,0.42);
    [[-0.78,1],[-0.78,-1],[0.5,1],[0.5,-1]].forEach(([a,k])=>{ g.add(B(0.1,0.08,0.62,'#2B3238',a,0.28,k*0.7),B(0.06,0.26,0.06,'#C9CED2',a,0.14,k*1.0),B(0.24,0.04,0.24,'#6B4E2E',a,0.02,k*1.0)); });
    const tr=grp(); tr.position.set(0,0.47,0); g.add(tr); u.turret=tr; tr.add(B(0.9,0.45,0.8,'#E4A21B',0,0.22,0),B(0.3,0.42,0.8,'#3B4650',-0.6,0.21,0)); const oc=cab(0.34,0.42,0.3,'#F5BE3A',0.2,0.45); oc.position.z=0.24; tr.add(oc); tr.add(operator(0.2,0.75,0.24)); const bc=beacon(0.2,0.9,0.24); tr.add(bc); u.beacons.push(bc);
    const bm=grp(); bm.position.set(0,0.5,0); tr.add(bm); u.boomG=bm; bm.add(B(2.1,0.2,0.2,'#E4A21B',1.05,0,0),B(1.4,0.15,0.15,YEL,2.6,0,0),B(1.0,0.1,0.1,'#F5C84A',3.7,0,0),S(0.1,'#3B4650',4.2,0,0)); u.ram=mesh(G.cyl,M('#D5DADF',{flatShading:false})); tr.add(u.ram);
    u.cable=mesh(G.box,M('#22282E')); u.hook=grp(B(0.14,0.16,0.1,'#F2C200',0,0,0),B(0.14,0.04,0.11,'#2B3238',0,0,0),B(0.03,0.1,0.03,'#5B6670',0,-0.12,0)); g.add(u.cable,u.hook); }
  else if(v.type==='digger'){ g.add(tracks(1.5,1.15,0.3)); const hs=grp(); hs.position.y=0.3; g.add(hs); u.house=hs; hs.add(B(1.0,0.42,0.96,YEL,-0.1,0.21,0),B(1.02,0.06,0.98,'#2B3238',-0.1,0.07,0),B(0.28,0.34,0.88,YEL2,-0.62,0.17,0)); for(let i=-1;i<=1;i++) hs.add(B(0.02,0.24,0.14,'#2B3238',-0.765,0.2,i*0.28));
    const cb=cab(0.44,0.5,0.44,'#F5BE3A',0.12,0.42); cb.position.z=0.24; hs.add(cb); hs.add(B(0.5,0.05,0.5,'#2B3238',0.12,0.945,0.24)); hs.add(operator(0.1,0.72,0.24)); const bc=beacon(0,1.0,0.24); hs.add(bc); u.beacons.push(bc); hs.add(B(0.07,0.3,0.07,'#3B4650',-0.36,0.57,-0.3));
    u.boom=mesh(G.box,M(YEL)); u.stick=mesh(G.box,M(YEL)); u.ram1=mesh(G.cyl,M('#D5DADF',{flatShading:false})); u.ram2=mesh(G.cyl,M('#D5DADF',{flatShading:false})); u.bucket=grp(B(0.34,0.26,0.4,'#4A5058',0,-0.1,0)); for(let i=-1;i<=1;i++){ const tt=mesh(G.cone4,M('#C9CED2')); tt.scale.set(0.07,0.1,0.07); tt.position.set(0.08,-0.27,i*0.13); tt.rotation.z=Math.PI; u.bucket.add(tt); } u.dirt=B(0.28,0.08,0.34,'#9A7445',0,0.05,0); u.bucket.add(u.dirt); u.j=[0,1,2].map(()=>S(0.09,'#3B4650'));
    hs.add(u.boom,u.stick,u.ram1,u.ram2,u.bucket,...u.j); u.smoke=[0,1,2].map(()=>{ const s=S(0.06,'#6E7378',0,0,0,G.ico,{transparent:true,opacity:0.4}); s.material=s.material.clone(); s.castShadow=false; hs.add(s); return s; }); }
  else if(v.type==='skid'){ addW([0.38,-0.38],0.19,0.5); u.wheels.forEach(w=>{ w.children[1].material=M(YEL); }); g.add(B(1.0,0.3,0.8,YEL,-0.05,0.31,0),B(1.0,0.06,0.82,'#2B3238',-0.05,0.22,0),B(0.16,0.42,0.78,YEL2,-0.5,0.37,0));
    const cg=grp(); [[-1,-1],[-1,1],[1,-1],[1,1]].forEach(([a,k])=>cg.add(B(0.04,0.5,0.04,'#2E3740',-0.12+a*0.29,0.71,k*0.31))); cg.add(B(0.66,0.06,0.7,YEL,-0.12,0.99,0)); g.add(cg); g.add(operator(-0.12,0.72,0)); const bc=beacon(-0.3,1.06,0); g.add(bc); u.beacons.push(bc);
    u.arms=[-1,1].map(k=>{ const a=mesh(G.box,M(YEL)); g.add(a); a.userData.k=k; return a; }); u.bucket=grp(B(0.34,0.26,1.05,'#59616A',0,0.13,0)); u.dirt=B(0.26,0.12,0.85,'#8B6A3E',0,0.3,0); u.bucket.add(u.dirt); g.add(u.bucket); }
  else { const sk=v.sk||'box';
    if(sk==='fork'){ g.add(B(0.7,0.38,0.6,'#E4A21B',-0.1,0.29,0),B(0.25,0.2,0.6,'#3B4650',-0.32,0.58,0)); [[-0.17,-0.23],[-0.17,0.23],[0.2,-0.23],[0.2,0.23]].forEach(([x,z])=>g.add(B(0.05,0.5,0.05,'#2B3238',x,0.73,z))); g.add(B(0.5,0.04,0.56,'#2B3238',0.02,1.0,0)); g.add(operator(-0.08,0.78,0)); [-1,1].forEach(k=>g.add(B(0.07,1.25,0.07,'#2B3238',0.3,0.63,k*0.24))); addW([0.14,-0.28],0.15,0.32);
      u.fork=grp(B(0.5,0.04,0.08,'#6B7680',0.6,0,-0.18),B(0.5,0.04,0.08,'#6B7680',0.6,0,0.18),B(0.04,0.3,0.5,'#6B7680',0.36,0.14,0),B(0.42,0.3,0.48,'#C99555',0.61,0.19,0)); g.add(u.fork); const bc=beacon(-0.17,1.05,0); g.add(bc); u.beacons.push(bc); }
    else if(sk==='lift'){ g.add(B(1.1,0.25,0.64,'#E0782A',0,0.2,0)); addW([0.36,-0.36],0.12,0.34); u.plat=grp(B(1.1,0.07,0.64,'#E0782A',0,0,0)); [[-1,-1],[-1,1],[1,-1],[1,1]].forEach(([a,k])=>u.plat.add(B(0.03,0.36,0.03,'#2B3238',a*0.53,0.2,k*0.3))); [-1,1].forEach(k=>{ u.plat.add(B(1.1,0.03,0.03,'#2B3238',0,0.38,k*0.3),B(1.1,0.02,0.02,'#2B3238',0,0.2,k*0.3)); u.plat.add(B(0.03,0.03,0.6,'#2B3238',k*0.53,0.38,0)); }); u.plat.add(B(0.16,0.3,0.24,'#3B4650',0.38,0.18,0)); g.add(u.plat);
      u.sc=[]; for(let i=0;i<8;i++){ const m=mesh(G.box,M('#5B6670')); g.add(m); u.sc.push(m); } }
    else if(sk==='roller'){ const r=grp(); g.add(r); u.mover=r; r.add(B(0.65,0.42,0.6,'#E4A21B',0.07,0.41,0)); const cb=cab(0.4,0.34,0.5,'#F5BE3A',0.1,0.62); r.add(cb); r.add(operator(0.1,0.82,0)); const dr=C(0.21,0.68,'#6B7680',0.57,0.21,0); dr.rotation.x=Math.PI/2; r.add(dr); const ww=C(0.18,0.6,'#22272C',-0.35,0.18,0); ww.rotation.x=Math.PI/2; r.add(ww); const bc=beacon(0.1,0.99,0); r.add(bc); u.beacons.push(bc); }
    else if(sk==='rig'){ g.add(tracks(1.3,0.9,0.28)); g.add(B(0.85,0.55,0.72,'#E4A21B',-0.22,0.55,0)); const cb=cab(0.4,0.4,0.6,'#F5BE3A',-0.15,0.83); g.add(cb); g.add(operator(-0.15,1.06,0)); g.add(B(0.16,3.0,0.16,'#C98A12',0.46,1.78,0),B(0.32,0.04,0.04,'#2B3238',0.6,3.26,0)); u.auger=grp(C(0.03,2.6,'#6B7680',0,0,0)); for(let i=0;i<8;i++){ const f=C(0.13,0.02,'#8E99A3',0,-1.2+i*0.17,0); f.rotation.z=0.35; u.auger.add(f); } u.auger.position.set(0.72,1.5,0); g.add(u.auger); u.head=B(0.2,0.22,0.24,'#3B4650',0.72,2.4,0); g.add(u.head); const bc=beacon(-0.15,1.26,0); g.add(bc); u.beacons.push(bc); }
    else if(sk==='gen'){ u.shake=grp(B(0.9,0.5,0.56,'#3F8FB5',0,0.35,0),B(0.9,0.05,0.58,'#F2C200',0,0.13,0),B(0.28,0.22,0.02,'#E9EEF2',0.24,0.41,0.285),B(0.08,0.22,0.08,'#2B3238',0.24,0.71,-0.06)); for(let i=0;i<4;i++) u.shake.add(B(0.36,0.02,0.02,'#1D4F6B',-0.18,0.25+i*0.07,0.285)); g.add(u.shake); addW([0.32,-0.32],0.1,0.26);
      u.smoke=[0,1,2].map(()=>{ const s=S(0.06,'#6E7378',0,0,0,G.ico,{transparent:true,opacity:0.4}); s.material=s.material.clone(); s.castShadow=false; g.add(s); return s; }); }
    else if(sk==='dozer'){ const r=grp(); g.add(r); u.mover=r; r.add(tracks(1.0,0.8,0.26)); r.add(B(0.75,0.42,0.6,'#E4A21B',-0.08,0.47,0)); const cb=cab(0.36,0.34,0.48,'#F5BE3A',-0.22,0.68); r.add(cb); r.add(operator(-0.22,0.88,0)); r.add(B(0.1,0.5,1.0,'#8E99A3',0.57,0.27,0)); [-1,1].forEach(k=>r.add(link(mesh(G.box,M('#3B4650')),0.3,0.5,k*0.34,0.52,0.3,k*0.34,0.05))); const bc=beacon(-0.22,1.05,0); r.add(bc); u.beacons.push(bc); }
    else if(sk==='tower'){ g.add(B(0.6,0.2,0.6,'#8E8E88',0,0.1,0),B(0.2,4.2,0.2,'#E4A21B',0,2.3,0)); for(let i=0;i<10;i++){ const x=B(0.02,0.46,0.02,'#C98A12',0,0.5+i*0.4,0.1); x.rotation.x=0; x.rotation.z=(i%2?1:-1)*0.5; g.add(x); }
      const jb=grp(); jb.position.y=4.5; g.add(jb); u.jib=jb; jb.add(B(4.0,0.1,0.14,'#E4A21B',1.0,0,0),B(0.1,0.6,0.1,'#E4A21B',0,0.3,0),B(0.4,0.3,0.4,'#8E8E88',-1.0,-0.15,0),link(mesh(G.box,M('#2B3238')),0,0.6,0,3.0,0,0,0.02),link(mesh(G.box,M('#2B3238')),0,0.6,0,-1.0,0,0,0.02)); u.cable=mesh(G.box,M('#22282E')); u.hook=B(0.3,0.25,0.3,'#C99555'); jb.add(u.cable,u.hook); }
    else { g.add(B(0.9,0.45,0.7,'#E4A21B',0,0.22,0),B(0.4,0.35,0.4,'#3B4650',0,0.62,0)); } }
  return g; }
function animVehicle(g,v,t,st,view){ if(view.lunch&&v.type!=='truck') t=view.tv; const u=g.userData, T0=t+(v.ph||0), dig=v.type==='digger';
  let x=v.x, y=v.y; const dir=v.u?Math.atan2(v.u.y,v.u.x):(v.dir||0);
  if(dig&&v.dig&&!view.edit&&!view.lunch){ const k=Math.sin(t*0.35+(v.ph||0))*0.7; x+=Math.cos(dir)*k; y+=Math.sin(dir)*k; }
  g.visible=!v.hidden; if(v.hidden) return; g.position.set(x,(v.z||0),y);
  u.hd=u.hd==null?dir:lerpAng(u.hd,dir,0.25); g.rotation.y=-u.hd;
  const moving=v.phase==='arrive'||v.phase==='leave'; if(moving) u.wheels.forEach(w=>{ w.rotation.z=-t*8; });
  u.beacons.forEach(b=>{ const on=Math.sin(T0*7)>0; b.material.emissiveIntensity=on?(1.2+view.N*3):0.1; });
  if(v.type==='truck'){ const cg=v.cargo==null?(v.loaded?3:0):v.cargo; u.load.visible=cg>0; u.load.children.forEach((b,i)=>{ b.visible=i<cg; });
    if(u.kn){ // 吊卡: the knuckle crane picks a bundle up off the stack beside the truck, swings it over and sets it on the bed
      const D=st.drop, L=v.lift, sm=x=>x*x*(3-2*x); let tx=-0.55, ty=1.25, tz=0, on=false, bx=0, by=0, bz=0;
      if(L&&D){ const k=Math.max(0,Math.min(1,(t-L.t0)/3.3)), dx=D.x+D.w/2-v.x, dy=D.y+D.d/2-v.y, c=Math.cos(u.hd), s2=Math.sin(u.hd), sx=dx*c+dy*s2, sz=-dx*s2+dy*c, ex=-0.32, ey=0.74+cg*0.09;
        const sw=k<0.35?0:k<0.75?sm((k-0.35)/0.4):1, y0=0.06+(L.h||0.1); bx=sx+(ex-sx)*sw; bz=sz*(1-sw); by=k<0.12?y0:k<0.35?y0+sm((k-0.12)/0.23)*(1.5-y0):k<0.75?1.5:1.5-sm((k-0.75)/0.25)*(1.5-ey);
        on=k>0.1&&k<0.98; tx=bx; tz=bz; ty=Math.max(1.9,by+0.7); if(k<0.12){ tx=sx; tz=sz; } }
      link(u.kn,0.28,1.1,0,tx,ty,tz,0.09); u.rope.visible=!!(L&&D); u.bundle.visible=on; if(L&&D){ link(u.rope,tx,ty,tz,tx,(on?by+0.26:0.2+(L.h||0)),tz,0.02); u.bundle.position.set(bx,by,bz); } } }
  else if(v.type==='mixer'){ u.drum.rotation.x=0; u.drum.children.forEach((c,i)=>{ if(i>=2) c.rotation.y=(i-2)*Math.PI/2+t*((v.feeding&&(!v.cycle||v.feedNow))?-3:1.2); }); u.chute.visible=!!(v.feeding&&(!v.cycle||v.feedNow)); }
  else if(v.type==='pump'){ u.out.visible=!v.parked; const cu=v.cur, c=Math.cos(u.hd), s=Math.sin(u.hd);
    // boom from the turret up and over to above the hose end, then the hose hanging down (all in the truck's own frame)
    const bx=-0.45, by=1.1; let ex=1.6, ez=0, ey=1.3; if(cu&&!v.parked){ const dx=cu.x-v.x, dy=cu.y-v.y; ex=dx*c+dy*s; ez=-dx*s+dy*c; ey=1.9; }
    const L=Math.hypot(ex-bx,ez), hgt=v.parked?0.25:Math.min(5.5,1.6+L*0.45), P=[[bx,by,0],[bx+(ex-bx)*0.3,by+hgt,ez*0.3],[bx+(ex-bx)*0.72,by+hgt*0.85,ez*0.72],[ex,ey,ez],[ex,0.55,ez]];
    for(let i=0;i<4;i++){ link(u.boom[i],...P[i],...P[i+1],i===3?0.09:0.16-i*0.02); u.boom[i].visible=!(v.parked&&i===3); } u.joints.forEach((j,i)=>j.position.set(...P[i+1])); }
  else if(v.type==='mcrane'){ const sl=0.5+0.6*Math.sin(t*0.25+(v.ph||0)), el=0.95; u.turret.rotation.y=-(sl-u.hd); u.boomG.rotation.z=el;
    link(u.ram,0.35,0.3,0,Math.cos(el)*1.2,0.5+Math.sin(el)*1.2,0,0.07);
    const tipx=v.x+Math.cos(sl)*4.2*Math.cos(el), tipy=v.y+Math.sin(sl)*4.2*Math.cos(el), tipz=0.97+4.2*Math.sin(el), hz=1.25+0.45*Math.sin(t*0.8+(v.ph||0));
    const dx=tipx-v.x, dy=tipy-v.y, c=Math.cos(u.hd), s=Math.sin(u.hd), lx=dx*c+dy*s, lz=-dx*s+dy*c; link(u.cable,lx,tipz,lz,lx,hz+0.1,lz,0.02); u.hook.position.set(lx,hz,lz); }
  else if(dig){ const sw=view.lunch?-0.6:v.dig?Math.sin(T0*1.1):Math.sin(T0*0.33)*0.15, z=-0.18;
    const P0=[0.35,0.48,z], E=[1.25+0.1*sw,1.45+0.25*sw,z], Bk=[1.95+0.25*sw,0.25+0.45*sw,z];
    link(u.boom,...P0,...E,0.16); link(u.stick,...E,...Bk,0.12); link(u.ram1,0.62,0.44,z,(P0[0]+E[0])/2,(P0[1]+E[1])/2,z+0.0,0.06); link(u.ram2,(P0[0]+E[0]*2)/3,(P0[1]+E[1]*2)/3+0.14,z,(E[0]+Bk[0])/2,(E[1]+Bk[1])/2+0.12,z,0.05);
    u.bucket.position.set(...Bk); u.bucket.rotation.z=-0.5+sw*0.6; u.dirt.visible=!!v.dig&&sw>0.2; [P0,E,Bk].forEach((p,i)=>u.j[i].position.set(...p));
    u.smoke.forEach((sm,i)=>{ const k=((t*0.9)+i/3)%1; sm.visible=!!v.dig; sm.position.set(-0.36+k*0.1,0.78+k*0.7,-0.3); sm.scale.setScalar(0.1+k*0.2); sm.material.opacity=0.4*(1-k); }); }
  else if(v.type==='skid'){ const bz=v.bz==null?0.15:v.bz; u.arms.forEach(a=>{ const k=a.userData.k; link(a,-0.42,0.95,k*0.46,0.62,bz+0.2,k*0.46,0.09); }); u.bucket.position.set(0.78,bz,0); u.dirt.visible=!!v.loaded; u.wheels.forEach(w=>{ w.rotation.z=-(v.x+v.y)*4; }); }
  else { const sk=v.sk;
    if(sk==='fork'){ u.fork.position.y=0.1+0.38*(Math.sin(T0*0.8)+1)/2; }
    else if(sk==='lift'){ const H=0.55+0.5*(Math.sin(T0*0.35)+1)/2; u.plat.position.y=0.35+H; let i=0; [-1,1].forEach(k=>{ link(u.sc[i++],-0.48,0.33,k*0.3,0.48,0.33+H/2,k*0.3,0.04); link(u.sc[i++],0.48,0.33,k*0.3,-0.48,0.33+H/2,k*0.3,0.04); link(u.sc[i++],-0.48,0.33+H/2,k*0.3,0.48,0.33+H,k*0.3,0.04); link(u.sc[i++],0.48,0.33+H/2,k*0.3,-0.48,0.33+H,k*0.3,0.04); }); }
    else if(sk==='roller'){ u.mover.position.x=Math.sin(T0*0.45)*0.5; }
    else if(sk==='dozer'){ u.mover.position.x=Math.sin(T0*0.4)*0.35; }
    else if(sk==='rig'){ const dz=0.25*(Math.sin(T0*0.6)+1)/2; u.auger.rotation.y=T0*3; u.auger.position.y=1.5-dz; u.head.position.y=2.4-dz; }
    else if(sk==='gen'){ u.shake.position.x=Math.sin(T0*30)*0.006; u.smoke.forEach((sm,i)=>{ const k=((T0*0.7)+i/3)%1; sm.position.set(0.24+k*0.1,0.85+k*0.5,-0.06); sm.scale.setScalar(0.1+k*0.18); sm.material.opacity=0.4*(1-k); }); }
    else if(sk==='tower'){ u.jib.rotation.y=-T0*0.12; const r=1.6+Math.sin(T0*0.3)*0.8, hz=-2.9+Math.sin(T0*0.4)*0.7; link(u.cable,r,0,0,r,hz+0.12,0,0.02); u.hook.position.set(r,hz,0); } }
}

/* ---------------- the site dog ---------------- */
function buildDog(){ const fur='#D9A657', dk='#B5803A'; const g=grp(), b=grp(); g.add(b); b.add(B(0.42,0.18,0.18,fur,0,0.26,0),B(0.3,0.06,0.14,'#F1DDB0',0.02,0.17,0)); const hd=grp(B(0.19,0.18,0.18,fur,0,0,0),B(0.12,0.09,0.11,'#F1DDB0',0.13,-0.03,0),S(0.025,'#2A2A2A',0.19,-0.01,0)); [-1,1].forEach(k=>{ const e=mesh(G.cone4,M(dk)); e.scale.set(0.07,0.11,0.05); e.position.set(-0.03,0.13,k*0.065); hd.add(e); const ey=S(0.018,'#2A2A2A',0.095,0.03,k*0.06); hd.add(ey); }); hd.add(B(0.05,0.03,0.2,'#C0392B',-0.09,-0.07,0)); hd.position.set(0.27,0.38,0); b.add(hd);
  const legs=[[0.15,-0.06],[0.15,0.06],[-0.15,-0.06],[-0.15,0.06]].map(([x,z])=>{ const l=grp(B(0.05,0.18,0.05,dk,0,-0.09,0)); l.position.set(x,0.18,z); b.add(l); return l; }); const tail=grp(B(0.04,0.2,0.04,fur,0,0.1,0)); tail.position.set(-0.21,0.3,0); b.add(tail);
  g.userData={b,hd,legs,tail,hd0:0}; g.scale.setScalar(1.15); return g; }
function animDog(g,d,t,dt){ const u=g.userData, T0=t+d.ph, walk=d.state==='walk', sit=d.state==='sit', sleep=d.state==='sleep';
  g.position.set(d.x,0,d.y); if(walk){ const hd=Math.atan2(d.ty-d.y,d.tx-d.x); u.hd0=lerpAng(u.hd0,hd,Math.min(1,dt*8)); } g.rotation.y=-u.hd0;
  const sw=walk?Math.sin(T0*10)*0.6:0; u.legs.forEach((l,i)=>{ l.rotation.z=(i%3===0?sw:-sw); l.visible=!sleep; });
  u.b.rotation.z=sit?0.45:0; u.b.position.y=sleep?-0.15+Math.sin(T0*1.4)*0.006:sit?-0.02:(walk?Math.abs(Math.sin(T0*10))*0.02:0); u.b.rotation.x=0;   // asleep: lying flat on his belly, breathing
  u.tail.rotation.x=Math.sin(T0*(walk?9:sit?13:5))*0.6; u.tail.rotation.z=0.5; u.hd.rotation.z=sleep?0.55:d.state==='sniff'?-0.7+Math.sin(T0*8)*0.05:sit?-0.35:0; u.hd.position.y=sleep?0.31:0.38; }

/* ---------------- the renderer ---------------- */
export function create(){
  const canvas=document.createElement('canvas'); canvas.id='sim3d';
  const R=new T.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'}); R.shadowMap.enabled=true; R.shadowMap.type=T.PCFSoftShadowMap; R.outputColorSpace=T.SRGBColorSpace;
  const scene=new T.Scene(), cam=new T.OrthographicCamera(-1,1,1,-1,1,600);
  const hemi=new T.HemisphereLight('#EAF6FF','#C9B48A',1.5), sun=new T.DirectionalLight('#FFF1D6',2.4); scene.add(hemi,sun,sun.target);
  sun.castShadow=true; sun.shadow.mapSize.set(2048,2048); sun.shadow.bias=-0.0006; sun.shadow.normalBias=0.03; const sc=sun.shadow.camera; sc.left=-22; sc.right=22; sc.top=22; sc.bottom=-22; sc.near=1; sc.far=140;
  const world=grp(); world.scale.y=YS; scene.add(world);
  const back=grp(); back.scale.y=YS; scene.add(back);
  let stat=null, dyn=null, built={st:null,props:null,fills:null,GW:0,GH:0}, people=new Map(), machines=new Map(), dogM=null, fences=[], lamps=[], soilM=[], formM=[], flagM=null, selRing=null, water=null, ripples=[], boats=[], clouds=[], dust=[], sprayM=[], gatePts=[], winMats=[], nightL=[], flood=[], pileM=[], lastT=0;
  // --- the ground round the site: always at the back of the view ---
  function buildBackdrop(GW,GH){ back.clear(); ripples=[]; boats=[]; clouds=[];
    // open ground running off every edge of the view (no sea, no island, no hills)
    water=mesh(new T.PlaneGeometry(600,600),M('#A6CF8B',{flatShading:false}),false); water.rotation.x=-Math.PI/2; water.position.set(GW/2,-0.004,GH/2); water.receiveShadow=true; back.add(water);
    back.userData.at=null; }
  function shapeOf(pts){ const s=new T.Shape(); pts.forEach((p,i)=>i?s.lineTo(p.x,-p.y):s.moveTo(p.x,-p.y)); s.closePath(); return s; }
  function flat(pts,col,y,o){ const m=mesh(new T.ShapeGeometry(shapeOf(pts)),M(col,Object.assign({flatShading:false},o||{})),false); m.rotation.x=-Math.PI/2; m.position.y=y; m.receiveShadow=true; return m; }
  // --- everything that stands still: island, ground, zones, fence, gate, office, materials, cones ---
  function buildStatic(st,v){ if(stat){ world.remove(stat); freeTree(stat); } stat=grp(); world.add(stat); fences=[]; lamps=[]; soilM=[]; formM=[]; pileM=[]; flagM=null; winMats=[]; gatePts=[]; nightL=[];
    // 夜間照明: the site is lit at night whenever anyone is working, the light falling from each corner (no light towers stand on the site)
    flood=[]; { const BND=st.BND; let cx=0, cy=0; BND.forEach(p=>{ cx+=p.x/BND.length; cy+=p.y/BND.length; }); const xs=BND.map(p=>p.x), ys=BND.map(p=>p.y), bx=[Math.min(...xs),Math.max(...xs)], by=[Math.min(...ys),Math.max(...ys)];
      const used=new Set(), R=Math.max(v.GW,v.GH)*1.15;
      [[0,0],[1,0],[1,1],[0,1]].forEach(([i,j])=>{ const tx=bx[i], ty=by[j]; let best=null; BND.forEach((p,k)=>{ if(used.has(k)) return; const d=Math.hypot(p.x-tx,p.y-ty); if(!best||d<best.d) best={d,k,p}; }); if(!best) return; used.add(best.k);
        const dx=cx-best.p.x, dy=cy-best.p.y, dl=Math.hypot(dx,dy)||1, x=best.p.x+dx/dl*1.35, y=best.p.y+dy/dl*1.35;
        const L=new T.PointLight('#FFF1D2',0,R,0); L.position.set(x,3.6,y); stat.add(L); flood.push({L}); }); }
    const lamp=(x,y,z,k,dist)=>{ const l=new T.PointLight('#FFD08A',0,dist,1.6); l.position.set(x,y,z); l.userData.k=k; stat.add(l); nightL.push(l); };
    const GW=v.GW, GH=v.GH, m=1.4;
    ((st.decor&&st.decor.dots)||[]).forEach(q=>{ for(let i=0;i<3;i++){ const b=mesh(G.cone4,M('#8CC070',{emissive:'#3E6B2E',emissiveIntensity:0.35}),false); b.scale.set(0.05,0.16+i*0.03,0.05); b.position.set(q.x+(i-1)*0.07,0.09,q.y+(i%2)*0.05); b.rotation.z=(i-1)*0.25; stat.add(b); } });
    const BND=st.BND; stat.add(flat(BND,'#DCCFB2',0.012));
    { const pts=[]; for(let x=Math.ceil(-m);x<GW+m;x++) pts.push(x,0.016,-m,x,0.016,GH+m); for(let y=Math.ceil(-m);y<GH+m;y++) pts.push(-m,0.016,y,GW+m,0.016,y); const g=new T.BufferGeometry(); g.setAttribute('position',new T.Float32BufferAttribute(pts,3)); const ln=new T.LineSegments(g,new T.LineBasicMaterial({color:'#6E552D',transparent:true,opacity:0.07})); stat.add(ln); }
    // road outside the gate and the apron through it
    const GT=st.GT; if(GT){ const E0=BND[GT.edge], E1=BND[(GT.edge+1)%BND.length], q=(p,k,e)=>({x:p.x+GT.n.x*k+GT.t.x*e,y:p.y+GT.n.y*k+GT.t.y*e}); const R0=60, cl=p=>({x:Math.max(-R0,Math.min(GW+R0,p.x)),y:Math.max(-R0,Math.min(GH+R0,p.y))}), ext=GW+GH+R0;
      stat.add(flat([q(E0,0.35,-ext),q(E1,0.35,ext),q(E1,1.4,ext),q(E0,1.4,-ext)].map(cl),'#8D8E8A',0.02)); const g=GT.G, h=GT.half, ap=(k,e)=>({x:g.x+GT.n.x*k+GT.t.x*e,y:g.y+GT.n.y*k+GT.t.y*e}); stat.add(flat([ap(-1.2,-h),ap(-1.2,h),ap(0.4,h),ap(0.4,-h)],'#A9A69C',0.022));
      [-1,1].forEach(k=>{ const px=g.x+GT.t.x*h*k, py=g.y+GT.t.y*h*k; stat.add(B(0.24,1.25,0.24,'#5B6770',px,0.625,py)); const lp=S(0.09,'#FFE9A8',px,1.33,py,G.sph,{emissive:'#FFD27A',emissiveIntensity:0.4}); lp.material=lp.material.clone(); lp.castShadow=false; stat.add(lp); gatePts.push({x:px,y:py,m:lp}); }); lamp(g.x-GT.n.x*0.8,2.2,g.y-GT.n.y*0.8,26,11);
      if(st.gateClosed){ const gp=B(h*2,0.98,0.06,'#D6DDE2',g.x,0.53,g.y); gp.rotation.y=-Math.atan2(GT.t.y,GT.t.x); stat.add(gp); const gs=B(h*2,0.12,0.07,'#2E8B57',g.x,0.56,g.y); gs.rotation.y=gp.rotation.y; stat.add(gs); } }
    // zones: a soft tint and a dashed outline
    st.zones.forEach(z=>{ const pts=z.pts||[{x:z.x,y:z.y},{x:z.x+z.w,y:z.y},{x:z.x+z.w,y:z.y+z.h},{x:z.x,y:z.y+z.h}]; const col=z.isYard?'#6A6C6E':z.status==='doing'?'#E07800':z.status==='done'?'#2F8A57':'#16222C';
      stat.add(flat(pts,col,0.024,{transparent:true,opacity:z.isYard?0.2:z.status==='doing'?0.16:z.status==='done'?0.14:0.05,depthWrite:false}));
      const lp=[]; pts.forEach((p,i)=>{ const q=pts[(i+1)%pts.length]; lp.push(p.x,0.03,p.y,q.x,0.03,q.y); }); const g=new T.BufferGeometry(); g.setAttribute('position',new T.Float32BufferAttribute(lp,3)); const ln=new T.LineSegments(g,new T.LineDashedMaterial({color:z.status==='doing'?'#E07800':z.status==='done'?'#2F8A57':'#5B6770',dashSize:0.18,gapSize:0.14,transparent:true,opacity:0.8})); ln.computeLineDistances(); stat.add(ln); });
    // fence: one panel group per boundary edge (the gate edge in two parts); panels facing the viewer drop to a low rail each frame
    const company=[v.company,v.site].filter(Boolean).join('　');
    BND.forEach((p,i)=>{ const q=BND[(i+1)%BND.length], ex=q.x-p.x, ey=q.y-p.y, L=Math.hypot(ex,ey)||1, ux=ex/L, uy=ey/L, nx=ey/L, ny=-ex/L; let segs=[[0,L]];
      if(GT&&i===GT.edge){ const s0=(GT.G.x-p.x)*ux+(GT.G.y-p.y)*uy, a=Math.max(0,s0-GT.half), b=Math.min(L,s0+GT.half); segs=[]; if(a>0.05) segs.push([0,a]); if(b<L-0.05) segs.push([b,L]); }
      const g=grp(), low=grp(); segs.forEach(([a,b])=>{ const len=b-a, mx=p.x+ux*(a+b)/2, my=p.y+uy*(a+b)/2, ry=-Math.atan2(uy,ux);
        const pn=B(len,1.0,0.05,'#EEF2F2',mx,0.5,my); pn.rotation.y=ry; g.add(pn); [[0.105,0.09],[0.915,0.07]].forEach(([y,h])=>{ const s=B(len+0.01,h,0.06,'#2E8B57',mx,y,my); s.rotation.y=ry; g.add(s); });
        const n=Math.max(1,Math.round(len/1.2)); for(let k=0;k<=n;k++){ const t=a+len*k/n; g.add(B(0.07,1.08,0.09,'#B9C4C9',p.x+ux*t,0.54,p.y+uy*t)); if(k%4===2){ const lm=S(0.06,'#FFC531',p.x+ux*t,1.14,p.y+uy*t,G.sph,{emissive:'#FFB000',emissiveIntensity:1}); lm.material=lm.material.clone(); lm.castShadow=false; g.add(lm); lamps.push({m:lm,ph:k*1.7+i}); } }
        const rl=B(len,0.06,0.06,'#2E8B57',mx,0.25,my); rl.rotation.y=ry; low.add(rl); for(let k=0;k<=n;k++){ const t=a+len*k/n; low.add(B(0.05,0.28,0.05,'#2E8B57',p.x+ux*t,0.14,p.y+uy*t)); }
        if(company&&len>5&&!(GT&&i===GT.edge)){ const tx=textTex(company,{col:'#2E8B57'}), hh=0.42, ww=Math.min(len*0.86,hh*tx.userData.asp), pl=mesh(new T.PlaneGeometry(ww,ww/tx.userData.asp),new T.MeshBasicMaterial({map:tx,transparent:true}),false); pl.position.set(mx-nx*0.031,0.52,my-ny*0.031); pl.rotation.y=Math.atan2(-nx,-ny); g.add(pl); } });
      stat.add(g,low); fences.push({g,low,nx,ny}); });
    // props: beams, formwork, stacks, the office, soil
    st.props.forEach(o=>{
      if(o.mound){ const r=o.r, mm=mesh(o.soil?G.ico1:G.cone,M(o.soil?'#A98B5E':'#B49A6E')); if(o.soil) mm.scale.set(r*2,r*1.1,r*2); else { mm.scale.set(r*2,r*0.9,r*2); mm.position.y=r*0.45; } mm.position.x=o.x; mm.position.z=o.y; if(o.soil){ mm.position.y=0; mm.rotation.y=(o.x*7+o.y*3)%3; soilM.push({o,m:mm}); } stat.add(mm); return; }
      let w,d,h=o.h,cx,cy,ry=0; if(o.beam){ w=Math.hypot(o.bx-o.ax,o.by-o.ay); d=o.wd; cx=(o.ax+o.bx)/2; cy=(o.ay+o.by)/2; ry=-Math.atan2(o.by-o.ay,o.bx-o.ax); } else { w=o.w; d=o.d; cx=o.x+w/2; cy=o.y+d/2; }
      const z0=o.z0||0, g=grp(); g.position.set(cx,z0,cy); g.rotation.y=ry; stat.add(g);
      if(o.cage&&!o.form){ const n=Math.max(2,Math.round(w/0.22)); for(let i=0;i<=n;i++){ const x=-w/2+w*i/n; [[0,h,d,0.025],[0,0.02,d,0.025]].forEach(()=>{}); g.add(B(0.03,h,0.03,'#A0583A',x,h/2,-d/2+0.03),B(0.03,h,0.03,'#A0583A',x,h/2,d/2-0.03),B(0.03,0.03,d,'#A0583A',x,h-0.02,0)); } [[-1,0.06],[1,0.06],[-1,h-0.03],[1,h-0.03],[0,h-0.03]].forEach(([k,y])=>g.add(B(w,0.035,0.035,'#8E4A30',0,y,k*(d/2-0.03)))); return; }
      if(o.form){ const th=0.05; const pg=grp(B(w,h,th,'#C99555',0,h/2,-d/2+th/2),B(w,h,th,'#C99555',0,h/2,d/2-th/2)); if(!o.beam) pg.add(B(th,h,d,'#C99555',-w/2+th/2,h/2,0),B(th,h,d,'#C99555',w/2-th/2,h/2,0)); [0.33,0.66].forEach(k=>{ pg.add(B(w+0.004,0.012,th+0.01,'#8A5A28',0,h*k,-d/2+th/2),B(w+0.004,0.012,th+0.01,'#8A5A28',0,h*k,d/2-th/2)); }); g.add(pg); g.add(B(w,0.04,d-th*2,'#8C6A3F',0,0.02,0));
        const rb=grp(); const n=Math.max(2,Math.round(w/0.25)); for(let i=0;i<=n;i++) rb.add(B(0.025,0.025,d-th*2-0.04,'#A0583A',-w/2+w*i/n,h*0.72,0)); [-1,1].forEach(k=>rb.add(B(w,0.03,0.03,'#8E4A30',0,h*0.72,k*(d/2-th-0.05)))); g.add(rb);
        const fl=B(w-0.01,h*0.86,d-th*2,'#9A9993',0,h*0.43,0); g.add(fl); formM.push({o,fl,rb,pg}); return; }
      if(o.sign){ g.add(B(w,h,d,'#4E7FAE',0,h/2,0),B(w+0.1,0.06,d+0.1,'#E9EEF2',0,h+0.03,0)); const n=Math.max(2,Math.floor(w/0.7)); [-1,1].forEach(k=>{ for(let i=0;i<n;i++){ const gx=-w/2+0.18+i*(w-0.36)/n; if(i===0) g.add(B(0.26,0.57,0.02,'#3A5E82',gx+0.13,0.33,k*(d/2+0.006))); else { const wm=M('#BFE3F5',{emissive:'#FFD27A',emissiveIntensity:0}).clone(); winMats.push(wm); g.add(B(0.34,0.3,0.02,wm,gx+0.22,0.47,k*(d/2+0.006)),B(0.38,0.03,0.03,'#FFFFFF',gx+0.22,0.31,k*(d/2+0.012))); } } });
        const tx=textTex(o.sign), al=w>=d, Lr=al?w:d, Dr=al?d:w, th2=Math.min(Dr*0.62,Lr*0.82/tx.userData.asp), pl=mesh(new T.PlaneGeometry(th2*tx.userData.asp,th2),new T.MeshBasicMaterial({map:tx,transparent:true}),false); pl.rotation.x=-Math.PI/2; pl.rotation.z=al?0:Math.PI/2; pl.position.y=h+0.065; g.add(pl); pl.userData.z0=pl.rotation.z; stat.userData.roof=pl; if(!st.gateClosed) lamp(cx,z0+1.9,cy+d/2+0.9,16,8);
        g.add(B(0.3,0.16,0.4,'#C9CED2',w/2-0.3,h+0.14,-d/2+0.3)); const pole=B(0.035,1.05,0.035,'#8E99A3',-w/2+0.12,h+0.52,-d/2+0.12); g.add(pole); const fg=grp(), nm=(v.company||v.site||'').trim(), ft=flagTex(nm), FH=0.34, FW=Math.min(1.8,Math.max(0.5,FH*ft.userData.asp)); const fl=mesh(new T.PlaneGeometry(FW,FH,10,1),new T.MeshBasicMaterial({map:ft,side:T.DoubleSide}),false); fl.position.x=FW/2; fl.userData.W=FW; fg.add(fl); fg.position.set(-w/2+0.12,h+0.84,-d/2+0.12); g.add(fg); flagM=fg; return; }
      if(o.pile){ const L=[]; for(let i=0;i<10;i++){ const b=B(w-(i%2)*0.06,0.062,d-((i+1)%2)*0.05,i%2?'#C99555':'#B98245',(i%3-1)*0.015,0.035+i*0.07,0); b.rotation.y=(i%3-1)*0.03; g.add(b); L.push(b); } [-0.3,0.3].forEach(x=>g.add(B(0.08,0.03,d,'#8A6B45',x,0.012,0))); pileM.push({o,L}); return; }   // 拆模 boards stacked up, one layer per piece stripped
      const bm=B(w,h,d,o.col||'#B6B5AF',0,h/2,0); g.add(bm); if(o.ply&&h>0.2){ const k=Math.round(h/0.1); for(let i=1;i<k;i++){ const s=B(w+0.006,0.008,d+0.006,'#8A5A28',0,h*i/k,0); s.castShadow=false; g.add(s); } }
      if(o.pipes){ bm.visible=false; const n=4; for(let i=0;i<n;i++){ const p=C(Math.min(h,d/n)*0.48,w,'#E6EBEF',0,h/2,-d/2+d*(i+0.5)/n,G.cyl,{flatShading:false}); p.rotation.z=Math.PI/2; g.add(p); } } });
    // backfilled cells
    (st.fills||[]).forEach(f=>{ const geo=new T.ExtrudeGeometry(shapeOf(f.poly),{depth:v.FILL_H,bevelEnabled:false}); const mm=mesh(geo,M('#B49A6E')); mm.rotation.x=-Math.PI/2; stat.add(mm); });
    // cones and the 安全第一 board
    (st.deco||[]).forEach(o=>{ if(o.k==='cone'){ const g=grp(B(0.28,0.03,0.28,'#2B3238',0,0.015,0)); const c1=mesh(G.cone,M('#F26A1B')); c1.scale.set(0.2,0.46,0.2); c1.position.y=0.26; g.add(c1); g.add(C(0.065,0.07,'#FFFFFF',0,0.25,0)); g.position.set(o.x,0,o.y); stat.add(g); }
      else if(o.k==='sign'){ const cv=document.createElement('canvas'); cv.width=256; cv.height=200; const c=cv.getContext('2d'); c.fillStyle='#fff'; c.fillRect(0,0,256,200); c.strokeStyle='#2E8B57'; c.lineWidth=14; c.strokeRect(7,7,242,186); c.fillStyle='#2E8B57'; c.fillRect(34,62,70,26); c.fillRect(56,36,26,80); c.font='800 46px "Noto Sans TC",sans-serif'; c.textAlign='center'; c.textBaseline='middle'; c.fillText('安全',180,58); c.fillText('第一',180,112); c.fillRect(30,150,196,14);
        const tx=new T.CanvasTexture(cv); tx.colorSpace=T.SRGBColorSpace; const g=grp(B(0.04,0.5,0.04,'#5B6770',-0.2,0.25,0),B(0.04,0.5,0.04,'#5B6770',0.2,0.25,0),B(0.62,0.48,0.03,'#FFFFFF',0,0.7,0)); [-1,1].forEach(k=>{ const pl=mesh(new T.PlaneGeometry(0.6,0.46),new T.MeshBasicMaterial({map:tx}),false); pl.position.set(0,0.7,k*0.017); if(k<0) pl.rotation.y=Math.PI; g.add(pl); }); g.position.set(o.x,0,o.y); g.userData.face=true; stat.add(g); stat.userData.signB=g; } });
    built={st,props:st.props,fills:st.fills,GW,GH,zk:st.zones.map(z=>z.status).join()}; }
  function buildDynamic(st){ if(dyn){ world.remove(dyn); freeTree(dyn); } dyn=grp(); world.add(dyn); people=new Map(); machines=new Map(); dogM=null; dust=[]; sprayM=[];
    st.workers.forEach(w=>{ const g=buildPerson(w); dyn.add(g); people.set(w,g); });
    st.vehicles.forEach(v=>{ const g=buildVehicle(v); dyn.add(g); machines.set(v,g); if(g.userData.blob) dyn.add(g.userData.blob); });
    if(st.dog){ dogM=buildDog(); dyn.add(dogM); }
    for(let i=0;i<40;i++){ const d=S(0.2,'#C4B292',0,0,0,G.ico,{transparent:true,opacity:0.4,depthWrite:false}); d.material=d.material.clone(); d.castShadow=false; d.receiveShadow=false; d.visible=false; dyn.add(d); dust.push(d); }
    (st.sprays||[]).forEach(s=>{ const g=grp(S(0.08,'#3E8FC4',s.x,0.6,s.y)); const ds=[]; for(let i=0;i<14;i++){ const d=S(0.05,'#4BA3D9',0,0,0,G.ico,{transparent:true,opacity:0.75}); d.castShadow=false; g.add(d); ds.push(d); } dyn.add(g); sprayM.push({s,ds}); });
    selRing=mesh(new T.RingGeometry(1.1,1.25,40),new T.MeshBasicMaterial({color:'#F5B700',side:T.DoubleSide,transparent:true,opacity:0.95}),false); selRing.rotation.x=-Math.PI/2; selRing.visible=false; dyn.add(selRing); }
  // --- the building, floor by floor (index.html works out the footprint and each floor's state; this draws it) ---
  let bldM=null, bKey='', bSt=null, bWin=[]; const UPY=new T.Vector3(0,1,0);
  function buildBldg(st,S){
    if(bldM){ world.remove(bldM); bldM.traverse(m=>{ if(m.isInstancedMesh) m.dispose(); }); freeTree(bldM); bldM=null; } bWin=[];
    const B=st.bldg; if(!B||!S) return; bldM=grp(); world.add(bldM);
    const H=B.H.map(p=>({x:p[0],y:p[1]})), E=B.edges;
    // the outline pushed out by d: each corner moves along the two edge normals (inward at a notch)
    const out=d=>H.map((p,i)=>{ const e1=E[(i-1+E.length)%E.length], e2=E[i]; let nx=e1.nx+e2.nx, ny=e1.ny+e2.ny; const L=Math.hypot(nx,ny)||1; nx/=L; ny/=L; const c=Math.max(0.3,nx*e2.nx+ny*e2.ny); return {x:p.x+nx*d/c,y:p.y+ny*d/c}; });
    const prism=(pts,z0,h,mat,holes)=>{ const sh=shapeOf(pts); (holes||[]).forEach(P=>{ const hp=new T.Path(); P.forEach((p,i)=>i?hp.lineTo(p[0],-p[1]):hp.moveTo(p[0],-p[1])); hp.closePath(); sh.holes.push(hp); });
      const m=mesh(new T.ExtrudeGeometry(sh,{depth:h,bevelEnabled:false}),typeof mat==='string'?M(mat):mat); m.rotation.x=-Math.PI/2; m.position.y=z0; bldM.add(m); return m; };
    // steel: one instanced mesh per colour
    const inst=new Map(), _m=new T.Matrix4(), _p=new T.Vector3(), _s=new T.Vector3(), _d=new T.Vector3();
    const put=(col,mx)=>{ let L=inst.get(col); if(!L) inst.set(col,L=[]); L.push(mx.clone()); };
    const post=(col,x,y,z0,z1,th)=>{ _p.set(x,(z0+z1)/2,y); _s.set(th,z1-z0,th); _m.compose(_p,_q.identity(),_s); put(col,_m); };
    const bar=(col,ax,ay,az,bx,by,bz,th)=>{ _d.set(bx-ax,bz-az,by-ay); const L=_d.length()||1e-4; _p.set((ax+bx)/2,(az+bz)/2,(ay+by)/2); _q.setFromUnitVectors(UP,_d.multiplyScalar(1/L)); _s.set(th,L,th); _m.compose(_p,_q,_s); put(col,_m); };
    const sp=Math.max(0.55,6.5/B.mPer);
    // stretches of a line that lie over the floor
    const runs=(fn,n)=>{ const R=[]; let r=null; for(let k=0;k<=n;k++){ const q=fn(k/n); if(B.inH(q[0],q[1])){ if(r) r[1]=q; else r=[q,q]; } else if(r){ R.push(r); r=null; } } if(r) R.push(r); return R.filter(x=>x[0]!==x[1]); };
    const frame=(f,col)=>{ const z0=f.z0, z1=f.z1;
      B.cols.concat(B.inner).forEach(p=>post(col,p.x,p.y,z0,z1,0.08));
      E.forEach(e=>{ bar(col,e.ax,e.ay,z1,e.bx,e.by,z1,0.07); const n=Math.max(1,Math.round(e.L/sp)); for(let i=0;i<n;i+=2){ const k0=i/n, k1=(i+1)/n, P=k=>[e.ax+(e.bx-e.ax)*k,e.ay+(e.by-e.ay)*k]; const a=P(k0), b=P(k1); bar(col,a[0],a[1],z0,b[0],b[1],z1,0.025); bar(col,b[0],b[1],z0,a[0],a[1],z1,0.025); } });
      const line=(fn,n)=>runs(fn,n).forEach(r=>bar(col,r[0][0],r[0][1],z1,r[1][0],r[1][1],z1,0.05));
      const at=(u,v)=>[u*B.ux-v*B.uy,u*B.uy+v*B.ux];
      for(let i=1;i<B.nu;i++){ const u=B.u0+(B.u1-B.u0)*i/B.nu; line(k=>at(u,B.v0+(B.v1-B.v0)*k),24); }
      for(let j=1;j<B.nv;j++){ const v=B.v0+(B.v1-B.v0)*j/B.nv; line(k=>at(B.u0+(B.u1-B.u0)*k,v),48); } };
    const deck=z=>prism(H,z-0.035,0.035,'#C4C7C2');
    const ridge=p=>{ const r=B.ridge([p.x!=null?p.x:p[0],p.y!=null?p.y:p[1]]); return r; };
    let shellTop=0; const WALL=(S.fac&&S.fac.wall)||'#DCE2E7', ROOF=(S.fac&&S.fac.roofCol)||'#8FA3B4';
    S.F.forEach((f,i)=>{ const nxt=S.F[i+1], h=f.z1-f.z0;
      if(f.state==='cut'){   // 剖開看: this floor's slab and its walls cut at about 1.2 m, nothing above
        const C=S.cut, z0=(C?C.z0:f.z0)+0.03; prism(out(0.02),z0-0.09,0.09,'#B9B3A8',C&&C.v); const s=C&&C.s; if(!s) return;   // slab top sits clear of the floor below's roof, or the two flicker when turning
        const wh=C.h, th=0.03;
        for(let k=0;k+3<s.length;k+=4){ const ax=s[k], ay=s[k+1], bx=s[k+2], by=s[k+3], dx=bx-ax, dy=by-ay, L=Math.hypot(dx,dy); if(L<1e-3) continue;
          _p.set((ax+bx)/2,z0+wh/2,(ay+by)/2); _q.setFromAxisAngle(UPY,Math.atan2(-dy,dx)); _s.set(L+th*0.5,wh,th); _m.compose(_p,_q,_s); put('#FBF8F2',_m); }
        return; }
      if(f.roof){
        const RF=S.fac&&S.fac.roof;
        if((f.state==='doing'||!S.clad)&&RF&&RF.hAt){ const col=f.state==='doing'?'#B4573E':'#66737E', dz=f.z1-f.z0, zt=(x,y)=>f.z0+RF.hAt(x,y)*dz;
          B.cols.concat(B.inner).forEach(p=>post(col,p.x,p.y,f.z0,zt(p.x,p.y),0.07));
          const along=(ax,ay,bx,by,th)=>{ const n=Math.max(1,Math.ceil(Math.hypot(bx-ax,by-ay)/(sp*0.5))); for(let i=0;i<n;i++){ const x0=ax+(bx-ax)*i/n, y0=ay+(by-ay)*i/n, x1=ax+(bx-ax)*(i+1)/n, y1=ay+(by-ay)*(i+1)/n; bar(col,x0,y0,zt(x0,y0),x1,y1,zt(x1,y1),th); } };
          E.forEach(e=>{ bar(col,e.ax,e.ay,f.z0,e.bx,e.by,f.z0,0.06); along(e.ax,e.ay,e.bx,e.by,0.05); });
          const at=(u,v)=>[u*B.ux-v*B.uy,u*B.uy+v*B.ux];
          for(let i=1;i<B.nu;i++){ const u=B.u0+(B.u1-B.u0)*i/B.nu; runs(k=>at(u,B.v0+(B.v1-B.v0)*k),24).forEach(r=>along(r[0][0],r[0][1],r[1][0],r[1][1],0.045)); }
          for(let j=1;j<B.nv;j++){ const v=B.v0+(B.v1-B.v0)*j/B.nv; runs(k=>at(B.u0+(B.u1-B.u0)*k,v),96).forEach(r=>along(r[0][0],r[0][1],r[1][0],r[1][1],0.045)); }
          return; }
        if((f.state==='doing'||!S.clad)&&!B.convex){ frame(f,f.state==='doing'?'#B4573E':'#66737E'); return; }
        if(f.state==='doing'||!S.clad){ const col=f.state==='doing'?'#B4573E':'#66737E'; B.cols.forEach(p=>{ const r=ridge(p); bar(col,p.x,p.y,f.z0,r[0],r[1],f.z1,0.05); }); E.forEach(e=>bar(col,e.ax,e.ay,f.z0,e.bx,e.by,f.z0,0.06)); const r0=B.ridge([B.u0*B.ux,B.u0*B.uy]), r1=B.ridge([B.u1*B.ux,B.u1*B.uy]); bar(col,r0[0],r0[1],f.z1,r1[0],r1[1],f.z1,0.06); return; }
        if(S.fac&&S.fac.roof){   // roof as drawn on the elevations: two slopes falling away from the ridge, gable walls under them
          const dz=f.z1-f.z0, rp=[], wp=[]; S.fac.roof.parts.forEach(P=>{ T.ShapeUtils.triangulateShape(P.map(p=>new T.Vector2(p[0],p[1])),[]).forEach(t=>t.forEach(i=>{ const p=P[i]; rp.push(p[0],f.z0+0.02+p[2]*dz,p[1]); }));
            P.forEach((p,k)=>{ const q=P[(k+1)%P.length]; if(p[2]<1e-3&&q[2]<1e-3) return; if(p[2]>0.999&&q[2]>0.999) return; wp.push(p[0],f.z0,p[1], q[0],f.z0,q[1], q[0],f.z0+q[2]*dz,q[1], p[0],f.z0,p[1], q[0],f.z0+q[2]*dz,q[1], p[0],f.z0+p[2]*dz,p[1]); }); });
          const g1=new T.BufferGeometry(); g1.setAttribute('position',new T.Float32BufferAttribute(rp,3)); g1.computeVertexNormals(); bldM.add(mesh(g1,M(ROOF,{side:T.DoubleSide})));
          if(S.fac.pv&&S.fac.pv.length&&S.fac.roof.hAt){   // 太陽能光電板: dark panels lying on the roof, a little above it, in a pale frame
            const pz=(p,o)=>f.z0+0.02+S.fac.roof.hAt(p[0],p[1])*dz+o, pp=[], fp=[], quad=(A,P,o,sh)=>{ const c=[(P[0][0]+P[2][0])/2,(P[0][1]+P[2][1])/2], Q=P.map(p=>[c[0]+(p[0]-c[0])*sh,c[1]+(p[1]-c[1])*sh]); [0,1,2,0,2,3].forEach(i=>A.push(Q[i][0],pz(Q[i],o),Q[i][1])); };
            S.fac.pv.forEach(P=>{ quad(fp,P,0.03,1); quad(pp,P,0.036,0.9); });
            [[fp,'#B9C3CC'],[pp,'#23395B']].forEach(([A,c])=>{ const g=new T.BufferGeometry(); g.setAttribute('position',new T.Float32BufferAttribute(A,3)); g.computeVertexNormals(); bldM.add(mesh(g,M(c,{side:T.DoubleSide}))); }); }
          if(wp.length){ const g2=new T.BufferGeometry(); g2.setAttribute('position',new T.Float32BufferAttribute(wp,3)); g2.computeVertexNormals(); bldM.add(mesh(g2,M(WALL,{side:T.DoubleSide}))); }
          prism(out(0.07),f.z0-0.06,0.05,'#6E7C88'); return; }
        if(!B.convex){ prism(out(0.03),f.z0,Math.min(0.12,f.z1-f.z0),ROOF); prism(out(0.07),f.z0-0.06,0.05,'#6E7C88'); return; }   // notched footprint, no roof drawn: flat roof
        const pos=[]; const O=out(0.06); O.forEach((a,k)=>{ const b=O[(k+1)%O.length], ra=ridge(H[k]), rb=ridge(H[(k+1)%H.length]); pos.push(a.x,f.z0,a.y, b.x,f.z0,b.y, rb[0],f.z1,rb[1], a.x,f.z0,a.y, rb[0],f.z1,rb[1], ra[0],f.z1,ra[1]); });
        const g=new T.BufferGeometry(); g.setAttribute('position',new T.Float32BufferAttribute(pos,3)); g.computeVertexNormals(); bldM.add(mesh(g,M('#8FA3B4',{side:T.DoubleSide})));
        prism(out(0.07),f.z0-0.06,0.05,'#6E7C88'); return; }
      if(f.state==='doing'){ frame(f,'#B4573E'); return; }
      if(!S.clad){ frame(f,'#66737E'); deck(f.z1); return; }
      const vd=nxt&&nxt.state==='cut'&&S.cut&&S.cut.v&&S.cut.v.length?S.cut.v:null; if(vd) prism(H,f.z0,0.03,'#CFCAC0');   // 挑空 above: this floor is hollow under the voids, with its own slab at the bottom
      if(S.fac){ shellTop=Math.max(shellTop,f.z1);
        if(i===0&&S.fac.open1F){ prism(out(-0.12),f.z0,h,'#6B737A'); B.cols.forEach(p=>post('#CDD2D6',p.x,p.y,f.z0,f.z1,0.09)); }   // open ground floor (parking): set-back dark wall behind the columns
        else prism(H,f.z0,h,WALL,vd); }
      else { prism(H,f.z0,h,'#DCE2E7',vd);
        const wm=M('#8FB4CC',{emissive:'#FFD27A',emissiveIntensity:0}).clone(); wm.userData.cached=false; bWin.push(wm);
        prism(out(0.015),f.z0+h*0.5,h*0.28,wm); }
      prism(out(0.02),f.z0,0.045,'#9AA5AE');
      if(!nxt||nxt.state==='doing') deck(f.z1+0.035);
    });
    if(S.fac&&shellTop>0){   // openings from the elevation drawings, on the walls built so far
      const glass=[], g8=8*S.zk, roofOn=S.clad&&S.F.some(f=>f.roof&&f.state==='done'), lim=roofOn?1e9:shellTop;
      E.forEach((e,k)=>{ const dx=e.bx-e.ax, dy=e.by-e.ay; _q.setFromAxisAngle(UPY,Math.atan2(-dy,dx));
        (S.fac.edges[k]||[]).forEach(w=>{ const z0=Math.max(0,(w.z0-S.zb)*S.zk), z1=Math.min(shellTop-0.01,(w.z1-S.zb)*S.zk); if(z1-z0<0.03) return;
          const len=e.L*(w.t1-w.t0), at=(t,o)=>_p.set(e.ax+dx*t+e.nx*o,(z0+z1)/2,e.ay+dy*t+e.ny*o);
          at((w.t0+w.t1)/2,0.004); _s.set(len,z1-z0,0.02); _m.compose(_p,_q,_s); put(w.type===2?'#30363B':w.type?'#7C868E':'#4E5A64',_m);
          if(w.type===2) return;   // an open bay (the parking entrance): dark, no glass
          if(w.type){ const n=Math.max(2,Math.round((z1-z0)/(14*S.zk))); for(let j=0;j<n;j++){ _p.set(e.ax+dx*(w.t0+w.t1)/2+e.nx*0.012,z0+(z1-z0)*(j+0.5)/n,e.ay+dy*(w.t0+w.t1)/2+e.ny*0.012); _s.set(len-g8,(z1-z0)/n*0.45,0.02); _m.compose(_p,_q,_s); put('#B4BCC2',_m); } return; }
          const n=Math.max(1,Math.round(w.cm/170)); for(let j=0;j<n;j++){ at(w.t0+(w.t1-w.t0)*(j+0.5)/n,0.012); _s.set(Math.max(0.01,len/n-g8),Math.max(0.01,z1-z0-g8),0.02); _m.compose(_p,_q,_s); glass.push(_m.clone()); } }); });
      E.forEach((e,k)=>{ const W=S.fac.edges[k]||{}, dx=e.bx-e.ax, dy=e.by-e.ay; _q.setFromAxisAngle(UPY,Math.atan2(-dy,dx));
        (W.X||[]).forEach(x=>{ const z0=Math.max(0,(x.z0-S.zb)*S.zk), z1=Math.min(lim,(x.z1-S.zb)*S.zk); if(z1-z0<0.005) return; const o0=x.o0*S.zk, o1=x.o1*S.zk, t=(x.t0+x.t1)/2, o=(o0+o1)/2;
          _p.set(e.ax+dx*t+e.nx*o,(z0+z1)/2,e.ay+dy*t+e.ny*o); _s.set(Math.max(0.01,e.L*(x.t1-x.t0)),z1-z0,Math.max(0.01,o1-o0)); _m.compose(_p,_q,_s); put(x.col||'#F1F0EC',_m); });
        (W.G||[]).forEach(g=>{ const z=(g.z-S.zb)*S.zk, r=g.r*S.zk; if(z+r>lim) return;
          const cv=document.createElement('canvas'); cv.width=cv.height=128; const c=cv.getContext('2d'); c.fillStyle=g.col||'#D9534F'; c.beginPath(); c.arc(64,64,62,0,7); c.fill();
          c.fillStyle='#fff'; c.font='700 78px "Noto Sans TC",sans-serif'; c.textAlign='center'; c.textBaseline='middle'; c.fillText(g.text||'',64,70);
          const tx=new T.CanvasTexture(cv); if(T.SRGBColorSpace) tx.colorSpace=T.SRGBColorSpace; const m=new T.Mesh(new T.CircleGeometry(r,28),new T.MeshBasicMaterial({map:tx,transparent:true}));
          m.position.set(e.ax+dx*g.t+e.nx*0.03,z,e.ay+dy*g.t+e.ny*0.03); m.rotation.y=Math.atan2(e.nx,e.ny); bldM.add(m); }); });
      if(glass.length){ const wm=M('#8FB4CC',{emissive:'#FFD27A',emissiveIntensity:0}).clone(); wm.userData.cached=false; bWin.push(wm);
        const im=new T.InstancedMesh(G.box,wm,glass.length); glass.forEach((mx,i)=>im.setMatrixAt(i,mx)); im.instanceMatrix.needsUpdate=true; bldM.add(im); } }
    inst.forEach((L,col)=>{ const im=new T.InstancedMesh(G.box,M(col),L.length); L.forEach((mx,i)=>im.setMatrixAt(i,mx)); im.instanceMatrix.needsUpdate=true; im.castShadow=true; im.receiveShadow=true; bldM.add(im); });
  }
  function resize(W,H,dpr){ R.setPixelRatio(dpr); R.setSize(W,H,false); canvas.style.width=W+'px'; canvas.style.height=H+'px'; }
  let size={W:0,H:0,dpr:0};
  function render(st,v){ if(!st) return; const t=v.t, dt=Math.min(0.1,Math.max(0,t-lastT)); lastT=t;
    if(size.W!==v.W||size.H!==v.H||size.dpr!==v.dpr){ size={W:v.W,H:v.H,dpr:v.dpr}; resize(v.W,v.H,v.dpr); }
    if(built.GW!==v.GW||built.GH!==v.GH||!water) buildBackdrop(v.GW,v.GH);
    const zk=st.zones.map(z=>z.status).join();
    if(built.st!==st||built.props!==st.props||built.fills!==st.fills||built.zk!==zk){ const fresh=built.st!==st; buildStatic(st,v); if(fresh) buildDynamic(st); }
    { const S=v.bs||null, k=S?JSON.stringify([S.F.map(f=>[f.state,+f.z0.toFixed(2),+f.z1.toFixed(2),f.roof]),S.clad,S.cut&&S.cut.key,S.fac?(S.fac.ver||1):0]):''; if(bSt!==st.bldg||bKey!==k){ bSt=st.bldg; bKey=k; buildBldg(st,S); } }
    // camera = SP(): right ∝ (x−y), up-screen ∝ −(x+y), k px per unit in the view plane
    const k=v.S/Math.SQRT2; cam.left=-v.ox/k; cam.right=(v.W-v.ox)/k; cam.top=v.oy/k; cam.bottom=-(v.H-v.oy)/k; cam.position.copy(CAMDIR).multiplyScalar(260); cam.up.set(0,1,0); cam.lookAt(0,0,0); cam.updateProjectionMatrix();
    // turning the site: the world turns about its centre, the light, sea and far shore stay put
    const a=v.rot||0, ca=Math.cos(a), sa=Math.sin(a); world.rotation.y=-a; world.position.set(v.cx-(v.cx*ca-v.cy*sa),0,v.cy-(v.cx*sa+v.cy*ca));
    const N=v.N||0, wx=v.wx||{}, dull=wx.rain?0.55:wx.dull?0.75:1;
    sun.intensity=(2.5*(1-N)+0.9*N)*dull; sun.color.set(N>0.5?'#B9C8F2':wx.dull?'#F2F4F6':'#FFF1D6'); hemi.intensity=(1.45*(1-N)+1.25*N)*(wx.rain?0.85:1); hemi.color.set(N>0.5?'#8FA6E6':'#EAF6FF'); hemi.groundColor.set(N>0.5?'#4A5880':'#C9B48A');
    const pc=new T.Vector3(v.cx,0,v.cy); sun.target.position.copy(pc); sun.position.set(v.cx+16,34,v.cy-22+0.001); sun.target.updateMatrixWorld();
    scene.background=new T.Color(N>0.5?'#24331F':wx.rain?'#8FAE7C':'#A6CF8B'); water.material.color.set(N>0.5?'#3C5236':wx.rain?'#93B57F':'#A6CF8B');
    const work=N>0.25&&!st.gateClosed&&(st.workers.length>0||st.vehicles.some(q=>!q.hidden&&q.type!=='truck'));   // someone is working after dark: the whole site is floodlit
    flood.forEach(f=>{ f.L.intensity=work?0.55*N:0; }); if(work){ hemi.intensity+=0.9*N; hemi.color.set('#C9D3EA'); sun.intensity+=0.6*N; sun.color.set('#FFF3DC'); }
    winMats.forEach(m=>{ m.emissiveIntensity=N>0.25&&!st.gateClosed?1.6:0; }); bWin.forEach(m=>{ m.emissiveIntensity=N>0.25&&!st.gateClosed?1.1:0; }); gatePts.forEach(p=>{ p.m.material.emissiveIntensity=0.4+N*3; }); nightL.forEach(l=>{ l.intensity=N>0.25?l.userData.k*N:0; });
    // fence: full height at the back, a low rail at the front
    fences.forEach(f=>{ const r0=f.nx*ca-f.ny*sa, r1=f.nx*sa+f.ny*ca, isBack=(r0+r1)<0; f.g.visible=isBack; f.low.visible=!isBack; });
    lamps.forEach(l=>{ const on=Math.sin(t*3.2+l.ph)>0.2; l.m.material.emissiveIntensity=on?1+N*3:0.05; });
    soilM.forEach(({o,m})=>{ m.position.x=o.x; m.position.z=o.y; }); pileM.forEach(P=>P.L.forEach((b,i)=>{ b.visible=i<(P.o.n||0); }));
    formM.forEach(({o,fl,rb,pg})=>{ fl.visible=!!o.filled; rb.visible=!o.filled;
      if(o.strip){ const k=o.stripped?(o.stripT==null?1:Math.min(1,Math.max(0,(t-o.stripT)/0.9))):0, e=k*k; pg.visible=k<1; pg.children.forEach(b=>{ if(b.userData.z0==null){ b.userData.z0=b.position.z; b.userData.x0=b.position.x; } b.position.z=b.userData.z0*(1+e*0.9); b.position.x=b.userData.x0*(1+e*0.25); }); pg.rotation.x=0; pg.position.y=-e*o.h*0.85; } });   // 拆模: the boards are pried off outward and dropped
    if(flagM){ const fl=flagM.children[0], W=fl.userData.W||0.5, g=fl.geometry, p=g.attributes.position; for(let i=0;i<p.count;i++){ const k=(p.getX(i)+W/2)/W; p.setZ(i,Math.sin(t*3.5-k*5)*0.045*k); } p.needsUpdate=true; flagM.rotation.y=a+Math.PI/4-0.15; }   // faces the viewer so the name reads
    if(stat&&stat.userData.signB) stat.userData.signB.rotation.y=a+Math.PI/4;
    if(stat&&stat.userData.roof){ const pl=stat.userData.roof; pl.rotation.z=pl.userData.z0; pl.updateWorldMatrix(true,false); _v.set(1,0,0).transformDirection(pl.matrixWorld); if(_v.x-_v.z<0) pl.rotation.z=pl.userData.z0+Math.PI; }   // the name on the office roof always reads left to right
    // people, machines, dog
    const yard=st.yard, inY=w=>!!(yard&&v.inZone&&v.inZone(yard,w.x,w.y));
    st.workers.forEach(w=>{ const g=people.get(w); if(!g) return; g.visible=!w.inside; if(w.inside) return; g.position.set(w.x,(w.z||0),w.y); animPerson(g,w,t,dt,st,inY(w),v); });
    st.vehicles.forEach(vh=>{ const g=machines.get(vh); if(g){ animVehicle(g,vh,t,st,v); const bl=g.userData.blob; if(bl){ const cu=vh.cur; bl.visible=!!(cu&&!vh.parked&&!vh.hidden); if(cu) bl.position.set(cu.x,0.48,cu.y); } } });
    if(dogM&&st.dog) animDog(dogM,st.dog,t,dt);
    const fx=st.fx||[]; dust.forEach((d,i)=>{ const q=fx[i]; if(!q){ d.visible=false; return; } const kk=(t-q.t0)/q.life; d.visible=kk>=0&&kk<1; d.position.set(q.x,0.12+kk*0.4,q.y); d.scale.setScalar(0.25+kk*0.55); d.material.opacity=0.42*(1-kk); });
    sprayM.forEach(({s,ds},si)=>ds.forEach((d,i)=>{ const kk=((t*0.9)+i/14+si*0.3)%1, ang=i*2.39+si, rr=s.r*kk*0.6; d.position.set(s.x+Math.cos(ang)*rr,0.6+Math.sin(kk*Math.PI)*1.1,s.y+Math.sin(ang)*rr); d.material.opacity=0.75*(1-kk); }));
    // 編輯: a ring under the machine or soil pile that is picked up
    selRing.visible=false; if(v.edit){ const mv=v.machSel&&st.vehicles.find(q=>q.key===v.machSel), so=v.soilSel&&st.props.find(o=>o.soil&&o.id===v.soilSel); const tg=mv||so; if(tg){ selRing.visible=true; selRing.position.set(tg.x,0.05,tg.y); selRing.scale.setScalar(mv?(mv.type==='digger'?1.5:1.1):Math.max(0.7,(so.r||1)*1.0)); } }
    R.render(scene,cam); }
  return {canvas,render,ok:true,dispose(){ R.dispose(); }};
}
