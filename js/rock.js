import { combatNow } from './combat-clock.js';
import { captureTournamentTool } from './tournament-damage.js';
import { worldWidth } from './config.js';
import { initBuster, getBusterLevel } from './buster-system.js';
import { configureCombatant, dealDamage } from './combat-system.js';
import { PrototypeFighter } from './prototype-fighter.js';
import { ctx, game } from './state.js';
import { opaqueRegionInRect, opaqueFramesOverlap } from './pixel-collision.js';
import { HIGHWAY_WALLS } from './wall-system.js';

const load=(src)=>{const i=new Image();i.src=src;return i;};
// Las hojas MM7 miran a la IZQUIERDA de origen. Los 4 morados estructurales
// (#841584, #470047, #B440B4, #640664) ya están convertidos a alpha.
// Los márgenes ya no existen en los PNG usados por el juego.
export const ROCK_SHEETS={
 intro:{img:load('assets/images/rock_intro.png'),n:6,cw:48,ch:48,gap:0,start:0,pivotX:24,pivotY:48,sourceFacing:-1},
 idle:{img:load('assets/images/rock_idle.png'),n:4,cw:48,ch:48,gap:0,start:0,pivotX:24,pivotY:48,sourceFacing:-1},
 run:{img:load('assets/images/rock_run.png'),n:10,cw:48,ch:48,gap:0,start:0,pivotX:24,pivotY:48,sourceFacing:-1},
 jump:{img:load('assets/images/rock_jump.png'),n:6,cw:48,ch:64,gap:0,start:0,pivotX:24,pivotY:47,sourceFacing:-1},
 // 56x56: los 48x48 superiores/izquierdos son la referencia; el resto es expansión.
 dash:{img:load('assets/images/rock_dash.png'),n:4,cw:56,ch:56,gap:0,start:0,pivotX:24,pivotY:48,sourceFacing:-1},
 // Fire/RunFire/Charge/Slash toman 8 px extra a la izquierda: cuerpo base empieza en x=8.
 fire:{img:load('assets/images/rock_fire.png'),n:4,cw:56,ch:48,gap:0,start:0,pivotX:32,pivotY:48,sourceFacing:-1},
 runfire:{img:load('assets/images/rock_runfire.png'),n:10,cw:56,ch:48,gap:0,start:0,pivotX:32,pivotY:48,sourceFacing:-1},
 jumpfire:{img:load('assets/images/rock_jumpfire.png'),n:6,cw:56,ch:64,gap:0,start:0,pivotX:32,pivotY:47,sourceFacing:-1},
 charge:{img:load('assets/images/rock_charge_shot.png'),n:5,cw:56,ch:48,gap:0,start:0,pivotX:32,pivotY:48,sourceFacing:-1},
 slash:{img:load('assets/images/rock_slash_claw.png'),n:4,cw:56,ch:48,gap:0,start:0,pivotX:32,pivotY:48,sourceFacing:-1},
 // Cut Shot conserva EXACTAMENTE el pivote de Slash Claw. La celda crece 20 px a la derecha: 56 -> 76.
 cutshot:{img:load('assets/images/rock_cutshotwithoutcut.png'),fx:load('assets/images/rock_cutshotwithcutter.png'),n:4,cw:76,ch:48,gap:0,start:0,pivotX:32,pivotY:48,sourceFacing:-1},
 flamesword:{img:load('assets/images/rock_flamesword_fire.png'),n:4,cw:96,ch:96,gap:0,start:0,pivotX:48,pivotY:96,sourceFacing:-1},
 hit:{img:load('assets/images/rock_hit.png'),n:1,cw:48,ch:56,gap:0,start:0,pivotX:24,pivotY:48,sourceFacing:-1},
 airhit:{img:load('assets/images/rock_air_hit.png'),n:1,cw:48,ch:64,gap:0,start:0,pivotX:24,pivotY:48,sourceFacing:-1}
};
const S=ROCK_SHEETS;

const P=[
 ['#404040','#f8b840','#a82010','#90d8f8','#30c0d8','#1890a8','#0088f0','#0040d0','#003060','#f8b080','#d07048','#804020','#f0f0f0','#989898','#282828'],
 ['#404040','#f8b840','#a82010','#b8d8f8','#78c0d8','#6090a8','#9880f0','#5840d0','#503068','#f8b080','#d07048','#804020','#f0f0f0','#989898','#482878'],
 ['#404040','#f8b840','#a82010','#d8f8f8','#78d0f0','#60b0d8','#a8f8e0','#00d090','#00a880','#f8c0a8','#d08060','#804830','#f0f0f0','#989898','#007850'],
 ['#404040','#f8b840','#a82010','#e0f8f8','#30c0d8','#1890a8','#80d0f0','#2060d0','#203068','#f8b080','#d07048','#804020','#f0f0f0','#989898','#007030'],
 // rock_colors_powers.png, paleta 2: CUT / CONCRETE.
 ['#404040','#f8b840','#a82010','#9b9d9e','#dadada','#fffefb','#716767','#4b4b4b','#1e1e1e','#f8b080','#d07048','#804020','#f0f0f0','#989898','#282828'],
 ['#404040', '#f8b840', '#a82010', '#fff87d', '#fff200', '#dad32a', '#e14f4f', '#b41616', '#800000', '#f8b080', '#d07048', '#804020', '#f0f0f0', '#989898', '#282828'],
 // Cuarta paleta de rock_colors_powers.png (x=90..119): LEAF/SNAKE/BOMB, blanca y verde.
 ['#404040','#f8b840','#a82010','#d5dde1','#dde0e1','#b2babc','#2eda00','#1e8f00','#135a00','#f8b080','#d07048','#804020','#f0f0f0','#989898','#282828']
];
const hexRGB=h=>[parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)];
export const rockPaletteRGB=P.map(a=>a.map(hexRGB));
const paletteRGB=rockPaletteRGB;
const recolorCache=new WeakMap();
function recolored(img,paletteIndex){
 if(paletteIndex===0||!img.complete||!img.naturalWidth)return img;
 let byPalette=recolorCache.get(img); if(!byPalette){byPalette=new Map();recolorCache.set(img,byPalette);} if(byPalette.has(paletteIndex))return byPalette.get(paletteIndex);
 const c=document.createElement('canvas');c.width=img.naturalWidth;c.height=img.naturalHeight;const x=c.getContext('2d',{willReadFrequently:true});x.imageSmoothingEnabled=false;x.drawImage(img,0,0);
 const d=x.getImageData(0,0,c.width,c.height),src=paletteRGB[0],dst=paletteRGB[paletteIndex];
 for(let p=0;p<d.data.length;p+=4){if(!d.data[p+3])continue;for(let i=0;i<src.length;i++){if(d.data[p]===src[i][0]&&d.data[p+1]===src[i][1]&&d.data[p+2]===src[i][2]){d.data[p]=dst[i][0];d.data[p+1]=dst[i][1];d.data[p+2]=dst[i][2];break;}}}
 x.putImageData(d,0,0);byPalette.set(paletteIndex,c);return c;
}


// ================================================================
// POWER 1 — CUT / CONCRETE
// ================================================================
const CUTTER_IMG=load('assets/images/cutter.png');
const CONCRETE_IMG=load('assets/images/concreto.png'); // 352x32 = 11 frames de 32x32
const CONCRETE_TRAIL_IMG=load('assets/images/piedras_de_suelo.png'); // 384x32, 12 frames; piedras VFX, fuente L->R

export function rollingCutterScale(fighter) { return fighter.height / 48; }

export class RollingCutter{
 constructor(owner,arc='lower'){
  this.owner=owner;this.type='rolling-cutter';this.damage=10;this.projectileForce=5;this.active=true;
  this.hitFighters=new WeakSet();
  this.direction=owner.facingDirection||1;this.arc=arc;this.scale=rollingCutterScale(owner);this.width=32*this.scale;this.height=16*this.scale;
  const rockFrame=owner._frameFor?.('cutshot',1),localX=11,localY=23,localW=21;
  this.x=rockFrame?(rockFrame.flipX?rockFrame.dx+(rockFrame.sw-(localX+localW))*this.scale:rockFrame.dx+localX*this.scale):owner.x+owner.width/2;
  this.y=rockFrame?rockFrame.dy+localY*this.scale:owner.getCurrentY()+owner.getCurrentHeight()*.35;
  this.startX=this.x;this.startY=this.y;this.age=0;this.returning=false;this.returnAge=0;this.animStart=7;this.prevX=this.x;this.prevY=this.y;
 }
 _beginReturn(){if(this.returning)return;this.returning=true;this.returnAge=0;this.returnStartX=this.x;this.returnStartY=this.y;}
 update(){
  this.prevX=this.x;this.prevY=this.y;this.age++;
  const range=92*this.scale,amp=58*this.scale,duration=23;
  if(!this.returning){
   const progress=Math.min(1,this.age/duration);
   this.x=this.startX+this.direction*range*progress;
   // M = U (baja) de ida. E/Q+M = U invertida (sube) de ida.
   const sign=this.arc==='upper'?-1:1;
   this.y=this.startY+sign*amp*Math.sin(Math.PI*progress);
   if(progress>=1)this._beginReturn();
  }else{
   this.returnAge++;
   const p=Math.min(1,this.returnAge/duration);
   // El destino se recalcula con la posición ACTUAL de Rock, pero el regreso conserva el arco opuesto.
   const tx=this.owner.x+this.owner.width/2-this.width/2,ty=this.owner.getCurrentY()+this.owner.getCurrentHeight()*.35;
   this.x=this.returnStartX+(tx-this.returnStartX)*p;
   const baseY=this.returnStartY+(ty-this.returnStartY)*p;
   const sign=this.arc==='upper'?1:-1; // upper sale ∩ y vuelve U; lower sale U y vuelve ∩.
   this.y=baseY+sign*amp*Math.sin(Math.PI*p);
   if(p>=1){this.active=false;this.owner.cutterCooldownUntil=combatNow()+500;}
  }
  if(this.age>110){this.active=false;this.owner.cutterCooldownUntil=combatNow()+500;}
 }
 _frameIndex(){return (this.animStart+Math.floor(this.age/3))%9;}
 getPixelBodyFrame(){if(!CUTTER_IMG.complete||!CUTTER_IMG.naturalWidth)return null;const sw=32,sh=16,dw=sw*this.scale,dh=sh*this.scale;return {img:CUTTER_IMG,sx:this._frameIndex()*sw,sy:0,sw,sh,dx:this.x,dy:this.y,dw,dh,flipX:this.direction<0};}
 pixelHitsTarget(target){const a=this.getPixelBodyFrame(),b=target?.getPixelBodyFrame?.(this.owner.x+this.owner.width/2);return b?opaqueFramesOverlap(a,b,null,1):true;}
 onHit(target){
  this._beginReturn();
  if(target.lastGuardImpact?.front)return false;
  const dx=this.x-this.prevX,dy=this.y-this.prevY;
  // El knockback sigue la lectura de la curva: si el Cutter viene subiendo, levanta;
  // si viene bajando, barre horizontalmente en la direccion real de su recorrido (puede acercar o alejar).
  if(dy<-.35){target.vx=Math.sign(dx||this.direction)*4;target.vy=-13;}
  else{target.vx=Math.sign(dx||this.direction)*12;target.vy=-2.5;}
  target.isGrounded=false;target.wasInAirFromKnockback=true;target.knockbackAirTimer=0;
  return false;
 }
 draw(cameraX){const f=this.getPixelBodyFrame();if(!f)return;ctx.save();ctx.imageSmoothingEnabled=false;const dx=f.dx-cameraX;if(f.flipX){ctx.translate(dx+f.dw,0);ctx.scale(-1,1);ctx.drawImage(f.img,f.sx,f.sy,f.sw,f.sh,0,f.dy,f.dw,f.dh);}else ctx.drawImage(f.img,f.sx,f.sy,f.sw,f.sh,dx,f.dy,f.dw,f.dh);ctx.restore();}
}
export class ConcreteBlock{
 constructor(owner,kind='moving'){
  this.owner=owner;this.kind=kind;this.type=`concrete-${kind}`;this.flightScale=owner.height/48;this.direction=owner.facingDirection||1;
  this.frame=0;this.state='flight';this.age=0;this.active=true;this.hp=20;this.maxHp=20;this.damageMultiplier=.80;this.hitTarget=false;this.hitTargetRef=null;this.wallBonusSpent=false;
  this.startX=owner.x+owner.width/2+this.direction*6*this.flightScale;this.startY=owner.getCurrentY()+owner.getCurrentHeight()*.35;
  this.x=this.startX;this.y=this.startY;this.lastMoveX=0;this.formedAt=0;this.solidAtMs=0;this.lastDecayAt=0;this.breakAt=0;this.surfaceY=owner.feetY;
 }
 get renderScale(){return this.frame>=6?5:this.flightScale;}
 get solidSize(){return 22*5;}
 get solidLeft(){return this.x+5*5;}
 get solidTop(){return this.surfaceY-this.solidSize;}
 get platformRect(){return {x:this.solidLeft,y:this.solidTop,w:this.solidSize,h:this.solidSize};}
 // Silueta fija del primer frame sólido (índice 6); no cambia con el desgaste.
 get collisionFrame(){return {img:CONCRETE_IMG,sx:6*32,sy:0,sw:32,sh:32,dx:this.x,dy:this.surfaceY-160,dw:160,dh:160,flipX:this.direction<0};}
 _findSurfaceY(){
  // El segundo Concrete puede apoyarse sobre el primero: no se atraviesan y se pueden encadenar/apilar.
  const futureLeft=this.x+25,futureRight=futureLeft+110;
  let y=this.owner.feetY;
  for(const c of this.owner.concretes){if(c===this||!c.active||!c.isPlatform())continue;const r=c.platformRect;if(futureRight>r.x&&futureLeft<r.x+r.w)y=Math.min(y,r.y);}
  return y;
 }
 update(){
  if(!this.active)return;this.age++;this.lastMoveX=0;
  if(this.state==='flight'){
   // Tres Concrete: MOVING nace muy cerca para poder montarlo; BUILD_NEAR cerca; BUILD_FAR prepara espacio a distancia.
   const p=Math.min(1,this.age/18);
   const travel=(this.kind==='moving'?26:this.kind==='build_near'?58:150)*this.flightScale;
   const targetX=this.startX+this.direction*travel;
   const [leftWall,rightWall]=HIGHWAY_WALLS;
   const solidOffset=25;
   const landingX=this.kind==='moving'?targetX:Math.max(leftWall.x-solidOffset,
    Math.min(rightWall.x-solidOffset-this.solidSize,targetX));
   this.x=this.startX+(landingX-this.startX)*p;
   const targetSurface=this._findSurfaceY(),groundY=targetSurface-32*this.flightScale;
   this.y=this.startY+(groundY-this.startY)*p-24*this.flightScale*Math.sin(Math.PI*p);
   this.frame=p<.34?0:p<.68?1:2;
   if(p>=1){this.surfaceY=targetSurface;this.state='forming';this.formedAt=this.age;this.frame=3;this.y=this.surfaceY-32*this.flightScale;}
  }else if(this.state==='forming'){
   const e=this.age-this.formedAt;this.frame=e<4?3:e<8?4:e<12?5:6;
   if(e>=12){this.state=this.kind==='moving'?'moving':'solid';this.frame=6;this.solidAtMs=combatNow();this.nextDecayAt=this.solidAtMs+5000;this.y=this.surfaceY-32*5;}
  }else if(this.state==='moving'){
   const dx=this.direction*3.2*this.flightScale;this.x+=dx;this.lastMoveX=dx;this.frame=this._damageFrame();this.y=this.surfaceY-32*5;
   const r=this.platformRect;
   // Si el Concrete largo atrapa al rival, lo EMPUJA con su cara frontal en vez de atravesarlo.
   // Mientras siga atrapado no puede escapar saltando; todavia puede intentar romper el bloque con sus ataques.
   if(this.hitTargetRef&&!this.wallBonusSpent){
    const t=this.hitTargetRef,tw=t.width||48;
    t.x=this.direction>0?r.x+r.w+2:r.x-tw-2;t.y=this.surfaceY-(t.height||t.getCurrentHeight?.()||48);t.vx=dx;t.vy=0;t.isGrounded=false;t.wasInAirFromKnockback=true;t.knockbackAirTimer=0;
    let targetAtWall=(this.direction<0&&t.x<=HIGHWAY_WALLS[0].x)||(this.direction>0&&t.x+tw>=HIGHWAY_WALLS[1].x);
    // Un Concrete de construcción también cuenta como pared: permite preparar el escenario y encerrar.
    for(const c of this.owner.concretes){
     if(c===this||!c.active||!c.isPlatform()||c.state==='moving')continue;
     const cr=c.platformRect;
     const front=this.direction>0?t.x+tw:t.x;
     if(t.y+(t.height||48)>cr.y&&t.y<cr.y+cr.h){
      if(this.direction>0&&front>=cr.x-4&&t.x<cr.x)targetAtWall=true;
      if(this.direction<0&&front<=cr.x+cr.w+4&&t.x+tw>cr.x+cr.w)targetAtWall=true;
     }
    }
    if(targetAtWall){for(const c of this.owner.concretes){if(c!==this&&c.active&&c.isPlatform()&&c.kind!=='moving'){const cr=c.platformRect,front=this.direction>0?t.x+tw:t.x;if(t.y+(t.height||48)>cr.y&&t.y<cr.y+cr.h&&Math.abs(front-(this.direction>0?cr.x:cr.x+cr.w))<16)c.break(true);}}dealDamage(t,5,{attacker:this.owner,attackName:'Concrete Wall Impact',impactX:this.x});if(!t.lastGuardImpact?.front){t.vx=this.direction*5;t.vy=-15;t.isGrounded=false;t.wasInAirFromKnockback=true;t.knockbackAirTimer=0;}this.wallBonusSpent=true;this.hitTargetRef=null;this.break(true);return;}
   }
   // El Concrete móvil se pulveriza al tocar una pared real O un Concrete construido.
   let blocked=r.x<=HIGHWAY_WALLS[0].x||r.x+r.w>=HIGHWAY_WALLS[1].x;
   if(!blocked){for(const c of this.owner.concretes){if(c===this||!c.active||!c.isPlatform()||c.state==='moving')continue;const cr=c.platformRect;if(r.x<cr.x+cr.w&&r.x+r.w>cr.x&&r.y<cr.y+cr.h&&r.y+r.h>cr.y){blocked=true;c.break(true);break;}}}
   if(blocked)this.break(true);
  }else if(this.state==='solid'){
   this.frame=this._damageFrame();this.y=this.surfaceY-32*5;
   // Tras 5 s comienza el desgaste: -10% de HP máximo cada segundo.
   const now=combatNow();if(now>=this.nextDecayAt){const ticks=Math.floor((now-this.nextDecayAt)/1000)+1;this.nextDecayAt+=ticks*1000;this.hp-=this.maxHp*.10*ticks;if(this.hp<=0)this.break(false);}
  }else if(this.state==='breaking'){
   const e=this.age-this.breakAt;this.frame=e<10?9:10;if(e>28)this.active=false;
  }
 }
 _damageFrame(){const ratio=this.hp/this.maxHp;if(ratio>.70)return 6;if(ratio>.20)return 7;return 8;}
 isPlatform(){return this.active&&(this.state==='solid'||this.state==='moving');}
 takeDamage(raw,{breaksConcrete=false}={}){if(!this.isPlatform())return false;const dmg=breaksConcrete?this.hp:Math.max(0.1,raw*this.damageMultiplier);this.hp-=dmg;if(this.hp<=0.8)this.break(false);return true;}
 break(wall=false){if(this.state==='breaking'||!this.active)return;this.hp=0;this.state='breaking';this.breakAt=this.age;this.frame=9;if(this.kind==='moving')this.owner.concreteMovingCooldownUntil=combatNow()+2800;}
 tryHit(target){
  if(this.kind!=='moving'||this.state!=='moving'||this.hitTarget||!target)return false;const r=this.platformRect,ty=target.getCurrentY(),th=target.getCurrentHeight();
  if(r.x<target.x+target.width&&r.x+r.w>target.x&&r.y<ty+th&&r.y+r.h>ty){dealDamage(target,8,{attacker:this.owner,attackName:'Concrete Shot',projectile:true,impactX:this.x+this.width/2});if(!target.lastGuardImpact?.front){target.vx=this.direction*4;target.vy=0;target.isGrounded=false;target.wasInAirFromKnockback=true;target.knockbackAirTimer=0;}this.hitTarget=true;if(!target.lastGuardImpact?.front)this.hitTargetRef=target;return true;}return false;
 }
 draw(cameraX){
  if(!CONCRETE_IMG.complete)return;const scale=this.renderScale,dw=32*scale,dh=32*scale,dx=this.x-cameraX;
  // piedras_de_suelo.png es 384x32 = 6 frames de 64x32 (NO 12 de 32x32).
  // Reutilizamos los primeros 5 como Knuckles: centrados verticalmente sobre la linea de suelo,
  // detras del bloque y sin hitbox. El sexto queda fuera para no mostrar el remate final.
  if(this.state==='moving'&&CONCRETE_TRAIL_IMG.complete){const useFrames=5,fi=Math.floor(this.age/5)%useFrames,sw=64,sh=32,trailScale=this.flightScale,tdw=sw*trailScale,tdh=sh*trailScale;ctx.save();ctx.globalAlpha=.72;ctx.imageSmoothingEnabled=false;const anchorX=this.direction>0?dx+27*5:dx+5*5,anchorY=this.surfaceY-tdh/2;if(this.direction>0){ctx.drawImage(CONCRETE_TRAIL_IMG,fi*sw,0,sw,sh,anchorX-tdw,anchorY,tdw,tdh);}else{ctx.translate(anchorX+tdw,0);ctx.scale(-1,1);ctx.drawImage(CONCRETE_TRAIL_IMG,fi*sw,0,sw,sh,0,anchorY,tdw,tdh);}ctx.restore();}
  ctx.save();ctx.imageSmoothingEnabled=false;const flip=this.direction<0;if(flip){ctx.translate(dx+dw,0);ctx.scale(-1,1);ctx.drawImage(CONCRETE_IMG,this.frame*32,0,32,32,0,this.y,dw,dh);}else ctx.drawImage(CONCRETE_IMG,this.frame*32,0,32,32,dx,this.y,dw,dh);
  if(this.state==='breaking'&&this.frame===10){for(let i=0;i<3;i++){ctx.globalAlpha=Math.max(0,.65-(this.age-this.breakAt)/45);const ox=(i-1)*12*5,oy=-i*5*5;ctx.drawImage(CONCRETE_IMG,10*32,0,32,32,dx+ox,this.y+oy,dw,dh);}}ctx.restore();
 }
}
// ================================================================
// RUSH V1 - compañero permanente de Rock
// Las hojas de Rush ya vienen limpias, sin márgenes y con alpha.
// Excepto Jet, el punto de suelo de Rush está 2 px arriba del borde inferior.
// ================================================================
export const RUSH_S={
 intro:{img:load('assets/images/rush_Intro.png'),n:11,cw:48,ch:64,pivotX:24,pivotY:62,sourceFacing:1},
 run:{img:load('assets/images/rush_run.png'),n:6,cw:80,ch:48,pivotX:40,pivotY:46,sourceFacing:1},
 coil:{img:load('assets/images/rush_coil.png'),n:6,cw:48,ch:48,pivotX:24,pivotY:46,sourceFacing:1},
 jet:{img:load('assets/images/rush_jet.png'),n:5,cw:190,ch:48,pivotX:95,pivotY:47,sourceFacing:1},
 jump:{img:load('assets/images/rush_jump.png'),n:4,cw:64,ch:48,pivotX:32,pivotY:46,sourceFacing:1}
};

class RushCompanion{
 constructor(owner){
  this.owner=owner; this.scale=Math.max(1,owner.height/48-1);
  this.x=owner.x+owner.width/2-(owner.facingDirection||1)*owner.width;
  // Pivote físico único: suelo real del escenario. Todas las hojas salvo Jet usan 2 px desde abajo.
  this.y=owner.feetY;
  this.vx=0; this.vy=0; this.state='intro'; this.stateAt=combatNow();
  this.facing=owner.facingDirection||1;
  this.ownerAirHandled=!owner.isGrounded;this.jumpReady=true;this.jumpHit=false;this.jumpDirection=1;
  this.jetHit=false; this.jetStartX=this.x; this.jetNeedsReturn=false;
  this.jetCooldownUntil=0; this.coilCooldownUntil=0;
  this.coilUntil=0; this.jetY=this.y; this.lastCommand=null;
 }
 _floor(){return this.owner.feetY;}
 _followX(){return this.owner.x+this.owner.width/2-(this.owner.facingDirection||1)*this.owner.width;}
 _setState(s){if(this.state===s)return;this.state=s;this.stateAt=combatNow();}
 _ground(){this.y=this._floor();this.vy=0;}
 _commandFree(){return this.state==='idle'||this.state==='run';}
 startCoil(){
  const now=combatNow();
  if(!this._commandFree()||now<this.coilCooldownUntil)return false;
  // COIL ES ATÓMICO: Rush se transforma EXACTAMENTE donde está. No TP, no corre hacia Rock.
  this.vx=0;this.vy=0;this._ground();this.coilUntil=combatNow()+6000;
  this.lastCommand='coil';this._setState('coil_start');return true;
 }
 startJet(direction){
  // Jet puede cancelar cualquier acción excepto otro Jet o su regreso obligatorio.
  if(this.state==='jet'||this.jetNeedsReturn)return false;
  const dir=Math.sign(direction||this.owner.facingDirection||1)||1;
  this.facing=dir;this.jetHit=false;this.jetStartX=this.x;this.jetY=this.y;
  this.vx=dir*14;this.vy=0;this.coilUntil=0;
  this.jetNeedsReturn=true;this.lastCommand='jet';this._setState('jet');return true;
 }
 interrupt(){
  // Sólo un golpe capaz de anular Jet puede forzar SU regreso. No habilita otro comando.
  if(this.state==='jet'){this.jetHit=true;this._setState('return');return true;}return false;
 }
 _startJump(){
  if(!this._commandFree()||!this.jumpReady)return false;
  this.jumpReady=false;this.jumpHit=false;this.jumpDirection=this.owner.facingDirection||1;
  // Salto independiente: menor altura que Rock pero recorrido horizontal grande.
  this.facing=this.owner.facingDirection||1;this.vy=-10;this.vx=this.facing*11.5;this._setState('jump');return true;
 }
 _anim(){
  const now=combatNow(),e=now-this.stateAt;
  if(this.state==='intro'){
   const f=Math.min(10,Math.floor(e/65));
   if(e>=11*65){this._setState('idle');return ['intro',7];}
   return ['intro',f];
  }
  if(this.state==='coil_start'){
   if(e<90)return ['coil',0];if(e<180)return ['coil',1];this._setState('coil');return ['coil',2];
  }
  if(this.state==='coil_bounce'){
   if(e<75)return ['coil',4];if(e<155)return ['coil',5];this._setState('coil');return ['coil',2];
  }
  if(this.state==='coil')return ['coil',2+Math.floor(e/130)%2];
  if(this.state==='jet')return ['jet',Math.floor(e/65)%5];
  if(this.state==='jump'){
   if(e<80)return ['jump',0];if(e<160)return ['jump',1];return ['jump',this.vy<0?2:3];
  }
  if(this.state==='run'||this.state==='return'||this.state==='jump_return'){
   const fast=this.owner.isDashing&&this.state==='run';return ['run',Math.floor(e/(fast?55:90))%6];
  }
  // Idle SOLO es fallback cuando Rush no corre, salta, hace Coil, Jet o regresa.
  return ['intro',7+Math.floor(e/220)%3];
 }
 getCurrentY(){const f=this.getPixelBodyFrame();return f?f.dy:this.y-48*this.scale;}
 getCurrentHeight(){const f=this.getPixelBodyFrame();return f?f.dh:48*this.scale;}
 get width(){return 48*this.scale;}
 getPixelBodyFrame(){
  const [key,fi]=this._anim(),a=RUSH_S[key];if(!a?.img.complete||!a.img.naturalWidth)return null;
  const dw=a.cw*this.scale,dh=a.ch*this.scale;
  // El pivote this.x/this.y NO se corrige por animación. La hoja se dibuja alrededor de él.
  return {img:a.img,sx:fi*a.cw,sy:0,sw:a.cw,sh:a.ch,dx:this.x-a.pivotX*this.scale,dy:this.y-a.pivotY*this.scale,dw,dh,flipX:this.facing!==a.sourceFacing,key,frame:fi};
 }
 _tryCoilBounce(){
  if(this.state!=='coil'||!this.owner||this.owner.isGrounded||this.owner.vy<=0)return;
  const f=this.getPixelBodyFrame();if(!f)return;
  const px=this.owner.x+this.owner.width/2,py=this.owner.y+this.owner.height;
  const point={x:px-2,y:py-3,w:4,h:6};
  // Aproximadamente 32 px desde abajo; sólo mitad izquierda y píxel real del resorte.
  const springRegion={x:0,y:(48-34)/48,w:.5,h:6/48};
  if(opaqueRegionInRect(f,springRegion,point,1)){
   this.owner.vy=-19;this.owner.isGrounded=false;this.owner.jumpStartedAt=combatNow();
   this._setState('coil_bounce');
  }
 }
 _finishReturn(now){
  this.vx=0;this._ground();this.facing=this.owner.facingDirection||1;
  // Cooldowns empiezan al REGRESAR: 4 s mismo comando, 2 s el otro.
  if(this.lastCommand==='jet'){this.jetNeedsReturn=false;this.jetCooldownUntil=0;}
  else if(this.lastCommand==='coil'){this.coilCooldownUntil=now+4000;this.jetCooldownUntil=Math.max(this.jetCooldownUntil,now+2000);}
  this.lastCommand=null;this._setState('idle');
 }
 update(opponent){
  const now=combatNow(),floor=this._floor();

  if(this.state==='intro'){
   this._ground();this._anim();
   if(this.owner.isGrounded)this.ownerAirHandled=false;
   return;
  }

  // COMANDOS: autoridad absoluta. No Run/Jump/Idle puede interrumpirlos.
  if(this.state==='coil_start'||this.state==='coil'||this.state==='coil_bounce'){
   this._ground();this._tryCoilBounce();
   if(now>=this.coilUntil){this.coilUntil=0;this._setState('return');}
   return;
  }
  if(this.state==='jet'){
   this.x+=this.vx;this.y=this.jetY;
   const jf=this.getPixelBodyFrame();
   // Los bordes del mundo también terminan Jet: no se permite escapar del escenario.
   if(jf&&(jf.dx<=0||jf.dx+jf.dw>=worldWidth))this._setState('return');
   else if(jf)for(const c of this.owner.concretes){
    if(c.isPlatform()&&opaqueRegionInRect(jf,{x:0,y:0,w:1,h:1},c.platformRect,2)){
     this._setState('return');break;
    }
   }
   return;
  }
  if(this.state==='jump_return'){
   this._ground();const target=this._followX(),d=target-this.x;
   this.facing=Math.abs(d)>3?Math.sign(d):(this.owner.facingDirection||1);
   if(Math.abs(d)>7){this.x+=Math.sign(d)*Math.min(9,Math.abs(d));}
   else{this.x=target;this.jumpReady=true;this._setState('idle');}
   return;
  }
  if(this.state==='return'){
   // Regresa CAMINANDO. Mientras regresa sigue ocupado y no acepta Coil/Jet.
   this._ground();const target=this._followX(),d=target-this.x;
   this.facing=Math.abs(d)>3?(d>0?1:-1):(this.owner.facingDirection||1);
   if(Math.abs(d)>7){this.x+=Math.sign(d)*Math.min(9,Math.abs(d));}
   else{this.x=target;this._finishReturn(now);}
   return;
  }

  if(this.state==='jump'){
   // Rush completa SU salto hasta tocar el suelo real; no usa la Y de Rock como suelo.
   this.x+=this.vx;this.vy+=.6;this.y+=this.vy;
   if(this.y>=floor){this.y=floor;this.vy=0;this.vx=0;this._setState('jump_return');}
   return;
  }

  // Rock sólo DISPARA el salto de Rush una vez por cada estancia en el aire.
  if(this.owner.isGrounded){this.ownerAirHandled=false;}
  else if(!this.ownerAirHandled){
   this.ownerAirHandled=true;
   if(this._startJump())return;
  }

  // FOLLOW NORMAL. Si Rock camina, Rush usa RUN aunque ya esté a la distancia correcta.
  const target=this._followX(),d=target-this.x;
  const ownerMoving=this.owner.isGrounded&&Math.abs(this.owner.vx)>.1;
  const needsCatch=Math.abs(d)>8;
  this.facing=needsCatch?(d>0?1:-1):(this.owner.facingDirection||1);
  const max=this.owner.isDashing?13:7;

  if(needsCatch){
   this.x+=Math.sign(d)*Math.min(max,Math.abs(d));
   this._setState('run');
  }else{
   // Mantener formación sin hacer que Idle gane mientras Rock está caminando.
   this.x=target;
   if(ownerMoving)this._setState('run');
   else this._setState('idle');
  }
  this._ground();
 }
 tryHit(receiver){
  if(!receiver)return false;
  if(this.state==='jump'&&!this.jumpHit){
   const mine=this.getPixelBodyFrame(),target=receiver.getPixelBodyFrame?.(this.x);
   if(mine&&target&&opaqueFramesOverlap(mine,target,null,2)){
    this.jumpHit=true;dealDamage(receiver,7,{attacker:this.owner,attackName:'Rush Jump',impactX:this.x,impactY:this.y-20*this.scale});
    const side=(receiver.x+receiver.width/2>=this.x)?1:-1;if(!receiver.lastGuardImpact?.front)receiver.vx=side*8;return true;
   }
  }
  if(this.state!=='jet'||this.jetHit)return false;
  const mine=this.getPixelBodyFrame(),target=receiver.getPixelBodyFrame?.(this.x)||null;
  let hit=target?opaqueFramesOverlap(mine,target,null,2):false;
  if(!target){const r={x:receiver.x,y:receiver.getCurrentY(),w:receiver.width,h:receiver.getCurrentHeight()};hit=opaqueRegionInRect(mine,{x:0,y:0,w:1,h:1},r,2);}
  if(!hit)return false;
  dealDamage(receiver,10,{attacker:this.owner,attackName:'Rush Jet',impactX:this.x+this.width/2});if(!receiver.lastGuardImpact?.front){receiver.vx=this.facing*2.5;receiver.vy=-15;receiver.isGrounded=false;receiver.wasInAirFromKnockback=true;receiver.knockbackAirTimer=0;}this.jetHit=true;this._setState('return');return true;
 }
 draw(){
  const f=this.getPixelBodyFrame();if(!f)return;
  ctx.save();ctx.imageSmoothingEnabled=false;const sx=f.dx-game.cameraX;
  if(f.flipX){ctx.translate(sx+f.dw,0);ctx.scale(-1,1);ctx.drawImage(f.img,f.sx,f.sy,f.sw,f.sh,0,f.dy,f.dw,f.dh);}else ctx.drawImage(f.img,f.sx,f.sy,f.sw,f.sh,sx,f.dy,f.dw,f.dh);
  ctx.restore();
 }
}


// Rush Jet independiente: no altera los estados ni los tiempos de Rush Coil.
class IndependentRushJet{
 constructor(owner){this.owner=owner;}
 start(direction){return this.owner.activeRush?.startJet(direction)||false;}
 update(){} // RushCompanion handles travel, hit, and physical return.
 tryHit(){return false;} // RushCompanion.tryHit already checks pixel overlap.
 draw(){} // Avoid drawing a duplicate Rush.
}
// ================================================================
// BEAT V1 - compañero aéreo permanente de Rock
// FOLLOW queda SIEMPRE detrás de Rock y no copia su salto: mantiene su altura.
// I/Y = Crescent. Izquierda+Derecha+I/Y = Patrol horizontal.
// ================================================================
export const BEAT_S={
 idle:{img:load('assets/images/beat_idle.png'),n:6,cw:32,ch:32,sourceFacing:1},
 lados:{img:load('assets/images/beat_lados.png'),n:15,cw:48,ch:48,sourceFacing:1}
};

class BeatCompanion{
 constructor(owner){
  this.owner=owner;this.scale=owner.height/48;
  this.x=this._followX();this.y=this._followY();
  this.state='intro';this.stateAt=combatNow();this.eddieCarry=null;this.eddieSearchDir=1;this.facing=owner.facingDirection||1;
  this.pathT=0;this.pathStartX=this.x;this.pathStartY=this.y;this.pathDir=this.facing;
  this.patrolLeg=0;this.patrolStartX=this.x;this.dropQueue=0;this.dropCount=0;this.dropPrep=null;this.lastPatrolFrame=0;
  this.crescentCooldownUntil=0;this.patrolCooldownUntil=0;this.hitDone=false;
 }
 _followX(){
  // Beat siempre queda DETRÁS de Rock. Si Rock cambia de lado, Beat cruza por detrás físicamente.
  return this.owner.x+this.owner.width/2-(this.owner.facingDirection||1)*this.owner.width*.85;
 }
 _followY(){return this.owner.feetY-this.owner.height*1.72;}
 _setState(s){if(this.state===s)return;this.state=s;this.stateAt=combatNow();}
 _commandFree(){return this.state==='follow';}
 startCrescent(){
  const now=combatNow();if(!this._commandFree()||now<this.crescentCooldownUntil)return false;
  this.pathStartX=this.x;this.pathStartY=this.y;this.pathDir=this.owner.facingDirection||1;this.pathT=0;this.hitDone=false;
  this.facing=this.pathDir;this._setState('crescent');return true;
 }
 startPatrol(){
  const now=combatNow();if(!this._commandFree()||now<this.patrolCooldownUntil)return false;
  this.patrolLeg=0;this.patrolStartX=this.x;this.pathDir=this.owner.facingDirection||1;this.facing=this.pathDir;
  this.dropQueue=0;this.dropCount=0;this.dropPrep=null;this.lastPatrolFrame=0;this._setState('patrol');return true;
 }
 requestDrop(){
  if(this.state!=='patrol'||this.dropCount+this.dropQueue>=4)return false;
  this.dropQueue++;const f=this._ladosFrame();
  // Si faltan más de 3 frames, acercamos la animación al momento de soltar. Si ya está a <=3, espera la vuelta.
  const forward=(14-f+15)%15;if(forward>3&&forward<12)this.dropPrep={started:combatNow(),reverse:false};
  else if(forward>=12)this.dropPrep={started:combatNow(),reverse:true};
  return true;
 }
 _finishCommand(kind){
  const now=combatNow();
  // Compañeros: 4 s para repetir el MISMO ataque, 2 s para cambiar al otro.
  if(kind==='crescent'){this.crescentCooldownUntil=now+4000;this.patrolCooldownUntil=Math.max(this.patrolCooldownUntil,now+2000);}
  if(kind==='patrol'){this.patrolCooldownUntil=now+4000;this.crescentCooldownUntil=Math.max(this.crescentCooldownUntil,now+2000);}
  this._setState('return');
 }
 _ladosFrame(){
  const e=combatNow()-this.stateAt;
  if(this.state==='crescent'||this.state==='intro'){
   // Los 15 sprites describen la vuelta completa. La zona baja conserva más tiempo
   // los frames boca abajo para que la U sea ancha y poco profunda.
   const t=Math.max(0,Math.min(1,this.pathT));
   const stops=[0,.055,.11,.17,.23,.29,.35,.41,.47,.56,.65,.74,.82,.90,1];
   let f=14;for(let i=0;i<stops.length;i++){if(t<=stops[i]){f=i;break;}}return f;
  }
  // Patrol: una orden puede acercar visualmente a Beat a los 3 frames previos al drop.
  if(this.state==='patrol'&&this.dropPrep){const q=Math.min(3,Math.floor((combatNow()-this.dropPrep.started)/55));return this.dropPrep.reverse?[11,12,13,14][q]:[11,12,13,14][q];}
  return Math.floor(e/55)%15;
 }
 _frame(){
  let a,fi;
  if(this.state==='follow'||this.state==='return'||this.state==='eddie_carry'){a=BEAT_S.idle;fi=Math.floor((combatNow()-this.stateAt)/90)%6;}
  else {a=BEAT_S.lados;fi=this._ladosFrame();}
  if(!a.img.complete||!a.img.naturalWidth)return null;
  const dw=a.cw*this.scale,dh=a.ch*this.scale;
  return {img:a.img,sx:fi*a.cw,sy:0,sw:a.cw,sh:a.ch,dx:this.x-dw/2,dy:this.y-dh/2,dw,dh,flipX:this.facing!==a.sourceFacing,key:a===BEAT_S.idle?'idle':'lados',frame:fi};
 }
 update(){
  const now=combatNow();
  if(this.state==='intro'){
   // Entrada de fiesta: misma U del Crescent, pero SIN daño.
   if(!this._introInit){this._introInit=true;this.pathStartX=this.owner.x-420;this.pathStartY=this._followY()-170;this.x=this.pathStartX;this.y=this.pathStartY;this.pathDir=1;this.stateAt=now;}
   this.pathT=Math.min(1,(now-this.stateAt)/1500);const t=this.pathT;
   this.x=this.pathStartX+(this._followX()-this.pathStartX)*t;
   this.y=this.pathStartY+(this._followY()-this.pathStartY)*t+75*Math.sin(Math.PI*t); // U visual con final exactamente en FOLLOW.
   this.facing=1;
   if(t>=1){
    // Pequeño ajuste final de intro para cerrar formación con Rock; FOLLOW normal no usa TP.
    const tx=this._followX(),ty=this._followY();this.x=tx;this.y=ty;
    this.facing=this.owner.facingDirection||1;this._setState('follow');
   }
   return;
  }
  if(this.state==='eddie_search'){
   const t=Math.min(1,(now-this.stateAt)/1100);this.pathT=t;
   this.x=this.pathStartX-this.eddieSearchDir*650*t;
   this.y=this.pathStartY-150*Math.sin(Math.PI*t);
   this.facing=-this.eddieSearchDir;
   if(t>=1){this.x=-90;this.y=this._followY()-290;this.facing=1;this._setState('eddie_return');}
   return;
  }
  if(this.state==='eddie_return'){
   const tx=this._followX(),ty=this._followY()-230;
   this.facing=1;this.x+=Math.max(-12,Math.min(12,tx-this.x));this.y+=(ty-this.y)*.09;
   if(Math.abs(this.x-tx)<=5){this.x=tx;this._setState('eddie_carry');}return;
  }
  if(this.state==='eddie_carry'){
   const tx=this._followX(),ty=this._followY()-230;
   this.x+=Math.max(-12,Math.min(12,tx-this.x));this.y+=(ty-this.y)*.1;
   this.facing=this.owner.facingDirection||1;return;
  }
  if(this.state==='crescent'){
   this.pathT=Math.min(1,(now-this.stateAt)/900);const t=this.pathT;
   const travel=720;
   this.x=this.pathStartX+this.pathDir*travel*t;
   this.y=this.pathStartY+this.owner.height*.72*Math.sin(Math.PI*t); // U ancha/poco profunda.
   this.facing=this.pathDir;
   if(t>=1)this._finishCommand('crescent');
   return;
  }
  if(this.state==='patrol'){
   const legDuration=1500,legT=Math.min(1,(now-this.stateAt)/legDuration),range=900;
   const dir=(this.patrolLeg%2===0?this.pathDir:-this.pathDir);this.facing=dir;
   this.x=this.patrolStartX+dir*range*legT; // horizontal: Beat NO sube/baja con Rock.
   // Hasta 4 cajas por Patrol. El input prepara visualmente los frames cercanos al drop.
   const pf=this._ladosFrame();
   if(this.dropPrep&&combatNow()-this.dropPrep.started>=165&&this.dropQueue>0){
    this.owner.spawnBeatBox?.(this.x,this.y);this.dropQueue--;this.dropCount++;this.dropPrep=null;
    // Si ya gastó sus 4 cajas no completa vueltas inútiles: vuelve con Rock inmediatamente.
    if(this.dropCount>=4){this._finishCommand('patrol');return;}
   }
   else if(!this.dropPrep&&this.dropQueue>0&&this.lastPatrolFrame>pf&&pf<=2){this.dropPrep={started:combatNow(),reverse:false};}
   this.lastPatrolFrame=pf;
   if(legT>=1){
    this.patrolLeg++;this.patrolStartX=this.x;this.stateAt=now;
    if(this.patrolLeg>=4)this._finishCommand('patrol');
   }
   return;
  }
  if(this.state==='return'){
   const tx=this._followX(),ty=this._followY(),dx=tx-this.x,dy=ty-this.y,d=Math.hypot(dx,dy);
   this.facing=Math.abs(dx)>4?(dx>0?1:-1):(this.owner.facingDirection||1);
   if(d>12){const sp=Math.min(12,d);this.x+=dx/d*sp;this.y+=dy/d*sp;}
   else{this.x=tx;this.y=ty;this.facing=this.owner.facingDirection||1;this._setState('follow');}
   return;
  }
  // FOLLOW: sólo sigue horizontalmente y conserva una altura fija respecto al SUELO.
  // Por eso si Rock brinca, Beat NO brinca ni sube con él.
  const tx=this._followX(),ty=this._followY(),dx=tx-this.x;
  this.facing=this.owner.facingDirection||1;
  if(Math.abs(dx)>4)this.x+=Math.sign(dx)*Math.min(8,Math.abs(dx));else this.x=tx;
  this.y=ty;
 }
 tryHit(receiver){
  if(this.state!=='crescent'||this.hitDone||!receiver)return false;
  const mine=this._frame(),target=receiver.getPixelBodyFrame?.(this.x)||null;if(!mine)return false;
  let hit=target?opaqueFramesOverlap(mine,target,null,2):false;
  if(!target){const r={x:receiver.x,y:receiver.getCurrentY(),w:receiver.width,h:receiver.getCurrentHeight()};hit=opaqueRegionInRect(mine,{x:0,y:0,w:1,h:1},r,2);}
  if(hit){
   dealDamage(receiver,8,{attacker:this.owner,attackName:'Beat Crescent',impactX:this.x});
   if(!receiver.lastGuardImpact?.front){
    // Beat es anti-aéreo: el impacto lanza al rival, no sólo lo empuja.
    receiver.vx=this.pathDir*30;receiver.vy=-2;receiver.isGrounded=false;
    receiver.wasInAirFromKnockback=true;receiver.knockbackAirTimer=0;
   }
   this.hitDone=true;return true;
  }return false;
 }
 draw(){
  const f=this._frame();if(!f)return;ctx.save();ctx.imageSmoothingEnabled=false;const sx=f.dx-game.cameraX;
  if(f.flipX){ctx.translate(sx+f.dw,0);ctx.scale(-1,1);ctx.drawImage(f.img,f.sx,f.sy,f.sw,f.sh,0,f.dy,f.dw,f.dh);}else ctx.drawImage(f.img,f.sx,f.sy,f.sw,f.sh,sx,f.dy,f.dw,f.dh);ctx.restore();
 }
}

// Cajas de Beat V1: por ahora Beat NO dispara proyectiles.
// Cada Patrol puede soltar una sola caja; el tamaño determina daño y caída.
class BeatBox{
 constructor(owner,x,y){
  this.owner=owner;
  const variants=[
   {size:24,damage:5,vy:4},
   {size:34,damage:8,vy:4.8},
   {size:46,damage:12,vy:5.6}
  ];
  this.spec=variants[Math.floor(Math.random()*variants.length)];
  this.x=x;this.y=y;this.vy=this.spec.vy;this.dead=false;this.hit=false;
 }
 update(){
  if(this.dead)return;
  this.vy+=0.28;this.y+=this.vy;
  const floor=this.owner.feetY;
  if(this.y+this.spec.size/2>=floor){this.y=floor-this.spec.size/2;this.dead=true;}
 }
 tryHit(receiver){
  if(this.dead||this.hit||!receiver)return false;
  const z=this.spec.size,r={x:this.x-z/2,y:this.y-z/2,w:z,h:z};
  const ry=receiver.getCurrentY(),rh=receiver.getCurrentHeight();
  const geo=r.x<receiver.x+receiver.width&&r.x+r.w>receiver.x&&r.y<ry+rh&&r.y+r.h>ry;
  const pixel=geo&&(typeof receiver.pixelBodyIntersectsRect==='function'?receiver.pixelBodyIntersectsRect(r,this.x):true);
  if(!pixel)return false;
  dealDamage(receiver,this.spec.damage,{attacker:this.owner,attackName:`Beat Box ${z}px`,impactX:this.x});
  if(!receiver.lastGuardImpact?.front){receiver.vy=-Math.max(4,z/6);receiver.isGrounded=false;receiver.wasInAirFromKnockback=true;receiver.knockbackAirTimer=0;}
  this.hit=true;this.dead=true;return true;
 }
 draw(){
  if(this.dead)return;
  const z=this.spec.size,x=Math.round(this.x-z/2-game.cameraX),y=Math.round(this.y-z/2);
  ctx.save();ctx.imageSmoothingEnabled=false;
  ctx.fillStyle='#9b5a2e';ctx.fillRect(x,y,z,z);
  ctx.fillStyle='#d79a52';ctx.fillRect(x+3,y+3,z-6,z-6);
  ctx.fillStyle='#6b3b20';ctx.fillRect(x+Math.floor(z*.44),y,z*.12,z);ctx.fillRect(x,y+Math.floor(z*.44),z,z*.12);
  ctx.restore();
 }
}


// FIRE — 3 acciones: bala normal, arco Heat y espada ascendente.
const HEAT=load('assets/images/Heat_fire.png'),HEAT_GROUND=load('assets/images/Heat_fire2.png');
const FIRE_BULLET=load('assets/images/fireman_shot.png'),FIRE_COLUMN=load('assets/images/fireman_shield.png');
const SWORD_FX=load('assets/images/rock_flameswordwithsword.png');
function fireDraw(f){if(!f)return;ctx.save();ctx.imageSmoothingEnabled=false;const x=f.dx-game.cameraX;
 if(f.flipX){ctx.translate(x+f.dw,0);ctx.scale(-1,1);ctx.drawImage(f.img,f.sx,f.sy,f.sw,f.sh,0,0,f.dw,f.dh);}
 else ctx.drawImage(f.img,f.sx,f.sy,f.sw,f.sh,x,f.dy,f.dw,f.dh);
 ctx.restore();}
function fireDrawFrame(f){if(!f)return;ctx.save();ctx.imageSmoothingEnabled=false;const x=f.dx-game.cameraX;
 if(f.flipX){ctx.translate(x+f.dw,f.dy);ctx.scale(-1,1);ctx.drawImage(f.img,f.sx,f.sy,f.sw,f.sh,0,0,f.dw,f.dh);}
 else ctx.drawImage(f.img,f.sx,f.sy,f.sw,f.sh,x,f.dy,f.dw,f.dh);ctx.restore();}
function fireKnock(target,dir,kind='bullet'){
 const air=!target.isGrounded;
 target.vx=dir*(kind==='column'?7:kind==='ground'?2.4:air?9:5);
 if(kind==='column')target.vy=-13;
 else if(kind==='bullet')target.vy=air?-5:-2;
 else if(air)target.vy=Math.min(target.vy||0,-2);
 if(kind!=='ground'){target.isGrounded=false;target.wasInAirFromKnockback=true;target.knockbackAirTimer=0;}
}
export class FireEffect{
 constructor(owner,type,x,y,dir=1){this.owner=owner;this.type='rock-fire-'+type;this.kind=type;this.x=x;this.y=y;this.dir=dir;this.age=0;this.active=true;this.scale=owner.height/48;this.lastHit=new WeakMap();this.feed=0;this.expires=combatNow()+4500;this.state='spawn';this.stateAt=combatNow();this.vx=dir*8*this.scale;this.vy=-11*this.scale;this.frames=0;}
 getPixelBodyFrame(){let img,sw,sh,frame,flip=this.dir<0;
  if(this.kind==='shot'){img=FIRE_BULLET;sw=16;sh=16;frame=Math.floor(this.age/5)%2;}
  else if(this.kind==='heat'){img=HEAT;sw=32;sh=32;frame=Math.floor(this.age/4)%8;flip=this.vy<0?this.dir>0:this.dir<0;}
  else if(this.kind==='ground'){img=HEAT_GROUND;sw=32;sh=64;const e=combatNow()-this.stateAt;
   frame=this.state==='spawn'?Math.floor(e/(500/9))%3:this.state==='active'?3+Math.floor(e/105)%4:this.state==='extinguishing'?7+Math.floor(e/100)%2:7+Math.min(3,Math.floor(e/110));flip=false;}
  else{img=FIRE_COLUMN;sw=32;sh=48;frame=Math.floor(this.age/5)%3;}
  if(!img.complete||!img.naturalWidth)return null;
  const w=sw*this.scale,h=sh*this.scale;
  return {img,sx:frame*sw,sy:0,sw,sh,dx:this.x-w/2,dy:this.kind==='ground'||this.kind==='column'?this.y-h:this.y-h/2,dw:w,dh:h,flipX:flip};
 }
 update(){this.age++;const now=combatNow();
  if(this.kind==='shot'){this.x+=this.vx;if(this.age>85)this.active=false;
   for(const g of this.owner.fireEffects){if(g.kind!=='ground'||!g.active||g.state==='end')continue;
    if(Math.abs(this.x-g.x)<23*this.scale&&Math.abs(this.y-(g.y-24*this.scale))<36*this.scale){g.feed++;g.expires=Math.max(g.expires,now)+900;this.active=false;
      if(g.feed>=3){g.feed=0;this.owner.fireEffects.push(new FireEffect(this.owner,'column',g.x,g.y,this.dir));}break;}}
  }else if(this.kind==='heat'){this.x+=this.vx;this.y+=this.vy;this.vy+=.56*this.scale;
   if(this.y>=(this.heatGroundY??this.owner.feetY)-8*this.scale){this.owner.fireEffects.push(new FireEffect(this.owner,'ground',this.x,this.heatGroundY??this.owner.feetY,this.dir));this.active=false;}
   if(this.age>115)this.active=false;
  }else if(this.kind==='ground'){
   if(this.state==='spawn'&&now-this.stateAt>=500){this.state='active';this.stateAt=now;}
   if(now>=this.expires&&this.state!=='end'){this.state='end';this.stateAt=now;}
   if(this.state==='extinguishing'&&now-this.stateAt>=500){this.state='end';this.stateAt=now;}
   if(this.state==='end'&&now-this.stateAt>=440)this.active=false;
  }else{this.x+=this.vx*.65;if(this.age>95)this.active=false;}
 }
 tryHit(target){if(!this.active||!target)return;
  if(this.kind==='ground'&&this.state!=='active')return;
  const a=this.getPixelBodyFrame(),b=target.getPixelBodyFrame?.(this.owner.x+this.owner.width/2);
  if(!a||!b||!opaqueFramesOverlap(a,b,null,2))return;
  const now=combatNow(),last=this.lastHit.get(target)||0;
  if(now-last<(this.kind==='ground'?550: this.kind==='column'?400:1000))return;
  this.lastHit.set(target,now);
  const dmg=this.kind==='shot'?3:this.kind==='heat'?7:this.kind==='ground'?2:12;
  const damage=dealDamage(target,dmg,{attacker:this.owner,attackName:'Rock FIRE '+this.kind,element:'fire',projectile:this.kind==='shot'||this.kind==='heat',impactX:this.x});if(damage>0&&!target.lastGuardImpact?.front)fireKnock(target,this.dir,this.kind==='column'?'column':this.kind==='ground'?'ground':'bullet');
  if(this.kind==='shot'||this.kind==='heat')this.active=false;
 }
 draw(){fireDrawFrame(this.getPixelBodyFrame());}
}


// POWER VERDE: sprites independientes con pivote inferior, sin modificar los assets.
const EDDIE_IMG=load('assets/images/eddie.png');
const PARACHUTE_IMG=load('assets/images/paracaidas.png');
const EDDIE_BOB=[3,4,5,6,7,6];
function drawEddieSprite(img,frame,x,y,scale,face=-1){
 if(!img.complete||!img.naturalWidth)return;
 const w=72*scale,h=72*scale,dx=x-w/2-game.cameraX,dy=y-h;
 ctx.save();ctx.imageSmoothingEnabled=false;
 if(face===1){ctx.translate(dx+w,0);ctx.scale(-1,1);ctx.drawImage(img,frame*72,0,72,72,0,dy,w,h);}
 else ctx.drawImage(img,frame*72,0,72,72,dx,dy,w,h);
 ctx.restore();
}
class EddieSupply{
 constructor(owner,x,y,dir){this.owner=owner;this.x=x;this.y=y;this.dir=dir;this.vx=dir*1.5*owner.height/48;this.vy=-1.8*owner.height/48;this.active=true;this.age=0;this.r=7*owner.height/48;}
 update(){if(!this.active)return;this.age++;const oldY=this.y;this.x+=this.vx;this.y+=this.vy;this.vy=Math.min(8,this.vy+.24*this.owner.height/48);
  const [leftWall,rightWall]=HIGHWAY_WALLS;
  if(this.x-this.r<leftWall.x||this.x+this.r>rightWall.x){
   this.x=Math.max(leftWall.x+this.r,Math.min(rightWall.x-this.r,this.x));this.vx*=-.3;
  }
  for(const c of this.owner.concretes){if(!c.isPlatform())continue;const r=c.platformRect;
   if(this.y+this.r>r.y&&this.y-this.r<r.y+r.h&&this.x+this.r>r.x&&this.x-this.r<r.x+r.w){
    if(oldY+this.r<=r.y+3&&this.vy>=0){this.y=r.y-this.r;this.vy=0;this.vx*=.85;}
    else {this.x=this.vx>0?r.x-this.r:r.x+r.w+this.r;this.vx*=-.25;}
   }
  }
  if(this.y+this.r>=this.owner.feetY){this.y=this.owner.feetY-this.r;this.vy=0;this.vx*=.8;if(Math.abs(this.vx)<.07)this.vx=0;}
  if(this.age>2400){this.active=false;return;}
  const rock=this.owner,ammo=rock.weaponAmmo;
  const reserves=Object.keys(ammo);
  const mostDepleted=reserves.reduce((lowest,set)=>ammo[set]<ammo[lowest]?set:lowest,reserves[0]);
  const set=ammo[rock.weaponSet]<100?rock.weaponSet:mostDepleted;
  const rect={x:this.x-this.r,y:this.y-this.r,w:this.r*2,h:this.r*2};
  if(ammo[set]<100&&rock.pixelBodyIntersectsRect(rect)){
   ammo[set]=Math.min(100,ammo[set]+20);
   this.active=false;
  }
 }
 draw(){
  if(!this.active)return;
  const x=Math.round(this.x-game.cameraX),y=Math.round(this.y),r=this.r;
  ctx.save();
  ctx.fillStyle='#112545';ctx.fillRect(x-r,y-r,r*2,r*2);
  ctx.strokeStyle='#9ddfff';ctx.lineWidth=2;ctx.strokeRect(x-r,y-r,r*2,r*2);
  ctx.fillStyle='#38689d';ctx.fillRect(x-r+3,y-r+3,r*2-6,r*.30);
  ctx.fillStyle='#80ebff';ctx.shadowColor='#51cfff';ctx.shadowBlur=5+3*Math.sin(this.age/7);
  ctx.fillRect(x-r*.45,y-r*.13,r*.9,r*.26);
  ctx.fillRect(x-r*.13,y-r*.45,r*.26,r*.9);
  ctx.restore();
 }
}
class EddieDelivery{
 constructor(owner,x,y,face){this.owner=owner;this.scale=owner.height/48;this.x=x;this.y=y;this.facing=face;this.state='parachute';this.age=0;this.stateAge=0;this.frame=0;this.ground=this.owner.feetY;this.deliveryDir=face;this.exitDir=face;this.spawned=false;this.active=true;this.swing=0;this.wasOpened=false;this.landingCycles=0;this.rocketFrames=0;}
 setState(state){this.state=state;this.stateAge=0;this.frame=0;}
 surfaceBelow(oldY,nextY){let ground=this.owner.feetY;for(const c of this.owner.concretes){if(!c.isPlatform())continue;const r=c.platformRect;
  if(this.x+10*this.scale>r.x&&this.x-10*this.scale<r.x+r.w&&oldY<=r.y+3&&nextY>=r.y&&r.y<ground)ground=r.y;
 }return ground;}
 knockAway(projectile){
  this.knockVx=Math.sign(projectile.vx || this.x-projectile.owner.x || 1)*8;
  this.knockVy=-11;this.setState('knocked');
 }
 update(){if(!this.active)return;this.age++;this.stateAge++;const rock=this.owner;const s=this.scale;
  if(this.state==='knocked'){
   this.frame=3;this.x+=this.knockVx;this.y+=this.knockVy;this.knockVy+=.39;
   if(this.stateAge>64||this.x<-90||this.x>worldWidth+90)this.active=false;
   return;
  }
  if(this.state==='parachute'){
   const opened=this.stateAge>=36;const parachuteFrame=opened?2:Math.min(1,Math.floor(this.stateAge/18));
   this.frame=opened?Math.floor(this.stateAge/9)%4:Math.floor(this.stateAge/12)%4;
   this.facing=rock.x+rock.width/2>=this.x?1:-1;
   if(opened){this.swing=Math.sin(this.stateAge*.055)*3*s;this.x+=Math.max(-.65*s,Math.min(.65*s,(rock.x+rock.width/2-this.x)*.018));this.x+=Math.cos(this.stateAge*.055)*.16*s;}
   const next=this.y+(opened?.55*s:1.1*s);const ground=this.surfaceBelow(this.y,next);
   this.ground=ground;this.y=Math.min(next,ground);
   if(this.y>=ground-6*s){this.y=Math.min(this.y,ground-6*s);this.setState('rocketLanding');}
   this.parachuteFrame=parachuteFrame;return;
  }
  if(this.state==='rocketLanding'){this.facing=rock.x+rock.width/2>=this.x?1:-1;this.frame=13+Math.floor(this.stateAge/7)%2;this.x-=this.facing*.12*s;this.y=Math.min(this.ground,this.y+.55*s);if(this.y>=this.ground&&this.stateAge>=14)this.setState('tired');return;}
  if(this.state==='tired'){this.facing=rock.x+rock.width/2>=this.x?1:-1;this.frame=5+Math.floor(this.stateAge/18)%2;if(this.stateAge>=108)this.setState('hop');return;}
  if(this.state==='hop'){this.facing=rock.x+rock.width/2>=this.x?1:-1;this.frame=7;if(this.stateAge>=10){this.deliveryDir=rock.x+rock.width/2>=this.x?1:-1;this.facing=this.deliveryDir;this.deliveryTargetX=rock.x+rock.width/2;this.setState('deliver');}return;}
  if(this.state==='deliver'){
   // Frame 9 es índice 8. Se congela el objetivo al ENTRAR, no se recalcula.
   this.frame=Math.min(12,8+Math.floor(this.stateAge/14));
   if(this.frame===12&&!this.spawned){this.spawned=true;this.owner.eddieSupplies.push(new EddieSupply(rock,this.x+this.deliveryDir*10*s,this.y-13*s,this.deliveryDir));}
   if(this.stateAge>=72)this.setState('recover');return;
  }
  if(this.state==='recover'){this.frame=5+Math.floor(this.stateAge/18)%2;if(this.stateAge>=36)this.setState('exitHop');return;}
  if(this.state==='exitHop'){this.frame=7;if(this.stateAge>=12){this.exitDir=this.x<=worldWidth-this.x?-1:1;this.facing=this.exitDir;this.setState('exit');}return;}
  if(this.state==='exit'){this.facing=this.exitDir;this.frame=this.stateAge<8?3:13+Math.floor(this.stateAge/7)%2;this.x+=this.exitDir*4.2*s;this.y-=1.9*s;if(this.x<-72*s||this.x>worldWidth+72*s||this.y<-120*s)this.active=false;}
 }
 draw(){if(!this.active)return;drawEddieSprite(EDDIE_IMG,this.frame,this.x,this.y,this.scale,this.facing);
  if(this.state==='parachute'){drawEddieSprite(PARACHUTE_IMG,this.parachuteFrame||0,this.x,this.y,this.scale,this.facing);}
 }
}

const BOMB_IMG=load('assets/images/bomb.png'),SNAKE_IMG=load('assets/images/snakes.png'),LEAF_IMG=load('assets/images/shield_leaf.png');
function drawGreen(img,frame,sw,sh,x,y,w,h,flip=false,alpha=1){if(!img.complete||!img.naturalWidth)return;ctx.save();ctx.imageSmoothingEnabled=false;ctx.globalAlpha=alpha;if(flip){ctx.translate(x+w,0);ctx.scale(-1,1);ctx.drawImage(img,frame*sw,0,sw,sh,0,y,w,h);}else ctx.drawImage(img,frame*sw,0,sw,sh,x,y,w,h);ctx.restore();}
const greenAlphaBounds=new WeakMap();
function greenVisibleBounds(img,frame,sw,sh){
 if(!img.complete||!img.naturalWidth)return {left:0,right:sw,top:0,bottom:sh};
 let cache=greenAlphaBounds.get(img);if(!cache){cache=new Map();greenAlphaBounds.set(img,cache);}
 const key=`${frame}:${sw}:${sh}`;if(cache.has(key))return cache.get(key);
 const c=document.createElement('canvas');c.width=sw;c.height=sh;
 const cx=c.getContext('2d',{willReadFrequently:true});cx.drawImage(img,frame*sw,0,sw,sh,0,0,sw,sh);
 const rgba=cx.getImageData(0,0,sw,sh).data;
 let left=sw,right=0,top=sh,bottom=0;
 for(let y=0;y<sh;y++)for(let x=0;x<sw;x++)if(rgba[(y*sw+x)*4+3]>0){left=Math.min(left,x);right=Math.max(right,x+1);top=Math.min(top,y);bottom=Math.max(bottom,y+1);}
 const bounds=right>left?{left,right,top,bottom}:{left:0,right:sw,top:0,bottom:sh};cache.set(key,bounds);return bounds;
}
class RockBomb{
 constructor(owner){this.owner=owner;this.scale=owner.height/48;this.dir=owner.facingDirection||1;this.x=owner.x+owner.width/2;this.y=owner.y+owner.height*.42;this.vx=this.dir*(owner.isGrounded?3:4.6)*this.scale;this.vy=(owner.isGrounded?-4.6:-6.3)*this.scale;this.age=0;this.active=true;this.blast=0;this.hit=new WeakSet();this.resting=false;}
 explode(){if(this.blast)return;this.blast=1;this.age=0;}
 _frame(){return Math.floor(this.age/9)%2;}
 _bounds(){return greenVisibleBounds(BOMB_IMG,this._frame(),32,32);}
 _bottom(){return this.y-32*this.scale+this._bounds().bottom*this.scale;}
 update(){this.age++;if(this.blast){if(this.age>14)this.active=false;return;}
  const previous=this._bottom();
  if(!this.resting){this.x+=this.vx;this.y+=this.vy;this.vy+=.55*this.scale;}
  const next=this._bottom(),b=this._bounds();let surface=this.owner.feetY;
  for(const c of this.owner.concretes){if(!c.isPlatform())continue;const r=c.platformRect;
   const left=this.x-16*this.scale+b.left*this.scale,right=this.x-16*this.scale+b.right*this.scale;
   if(right<=r.x||left>=r.x+r.w)continue;
   if(previous<=r.y+Math.max(2,Math.abs(this.vy)+2)&&next>=r.y&&r.y<surface)surface=r.y;
  }
  if(!this.resting&&this.vy>=0&&next>=surface){this.y+=surface-next;this.vx=0;this.vy=0;this.resting=true;}
  if(this.resting){const bottom=this._bottom();const supported=bottom>=this.owner.feetY-.5||this.owner.concretes.some(c=>{if(!c.isPlatform())return false;const r=c.platformRect;return this.x-16*this.scale+b.right*this.scale>r.x&&this.x-16*this.scale+b.left*this.scale<r.x+r.w&&Math.abs(bottom-r.y)<2;});if(!supported){this.resting=false;this.vy=.55*this.scale;}}
  if(this.age>280)this.explode();
  for(const f of this.owner.fireEffects)if(f.active&&Math.abs(f.x-this.x)<23*this.scale&&Math.abs(f.y-this.y)<40*this.scale)this.explode();
 }
 tryHit(t){if(!t)return;const d=Math.hypot(t.x+t.width/2-this.x,t.y+t.height/2-this.y);if(this.blast&&d<95*this.scale&&!this.hit.has(t)){this.hit.add(t);const strength=Math.max(0,1-d/(95*this.scale));dealDamage(t,Math.round(5+19*strength),{attacker:this.owner,attackName:'Hyper Bomb',impactX:this.x});if(!t.lastGuardImpact?.front){const side=(t.x+t.width/2>=this.x?1:-1);t.vx=side*(5+21*strength);t.vy=-(5+17*strength);t.isGrounded=false;t.wasInAirFromKnockback=true;t.knockbackAirTimer=0;}}}
 draw(){const w=32*this.scale,h=32*this.scale;drawGreen(BOMB_IMG,this.blast?2:this._frame(),32,32,this.x-w/2-game.cameraX,this.y-h,w,h,false,this.blast?Math.max(.15,1-this.age/16):.83+.17*Math.sin(this.age*.38));}
}
// Search Snake: sprites reales contra hurtbox; trepa los muros de Concrete.
class RockSnake{
 constructor(owner){this.owner=owner;this.scale=owner.height/48;this.dir=owner.facingDirection||1;this.x=owner.x+owner.width/2;this.y=owner.feetY;this.age=0;this.active=true;this.climbing=false;this.wall=null;this.particles=[];this.hit=false;this.hopVy=-2.6*this.scale;this.hopFrames=0;this.falling=false;this.fallVy=0;this.recentWall=null;this.wallClearance=0;}
 explode(){if(this.particles.length)return;for(let i=0;i<12;i++){const a=i*2.39996,speed=(.25+(i%4)*.12)*this.scale;this.particles.push({x:this.x+Math.cos(a)*3,y:this.y-12*this.scale+Math.sin(a)*3,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed-.15*this.scale,life:18+i%8});}}
 getPixelBodyFrame(){
  const sc=2,sw=48,sh=32,frame=Math.floor(this.age/8)%3;
  // La hitbox pixel-perfect utiliza la misma imagen rotada que se dibuja en la pared.
  if(this.climbing){
    if(!SNAKE_IMG.complete||!SNAKE_IMG.naturalWidth)return null;
    if(!RockSnake.rotatedFrames)RockSnake.rotatedFrames=new Map();
    const key=`${frame}:${this.wall?.side||'left'}`;
    if(!RockSnake.rotatedFrames.has(key)){
      const canvas=document.createElement('canvas');canvas.width=sh;canvas.height=sw;
      const g=canvas.getContext('2d');g.imageSmoothingEnabled=false;
      g.translate(sh/2,sw/2);g.rotate(this.wall?.side==='left'?Math.PI/2:-Math.PI/2);
      g.drawImage(SNAKE_IMG,frame*sw,0,sw,sh,-sw/2,-sh/2,sw,sh);
      RockSnake.rotatedFrames.set(key,canvas);
    }
    const img=RockSnake.rotatedFrames.get(key);
    return {img,sx:0,sy:0,sw:sh,sh:sw,dx:this.x-sh*sc/2,dy:this.y-sw*sc/2,dw:sh*sc,dh:sw*sc,flipX:false};
  }
  return {img:SNAKE_IMG,sx:frame*sw,sy:0,sw,sh,dx:this.x-sw*sc/2,dy:this.y-sh*sc,dw:sw*sc,dh:sh*sc,flipX:this.dir<0};
 }
 update(){this.age++;if(this.particles.length){for(const p of this.particles){p.x+=p.vx;p.y+=p.vy;p.vy+=.025*this.scale;p.life--;}if(this.particles.every(p=>p.life<=0))this.active=false;return;}
  if(this.hopFrames<20){this.hopFrames++;this.x+=this.dir*2*this.scale;this.y+=this.hopVy;this.hopVy+=.30*this.scale;if(this.y>=this.owner.feetY){this.y=this.owner.feetY;this.hopFrames=20;}/* Keep wall checks active even during the opening hop. */}
  // La misma geometría de paredes que usan X y Zero, además de Concrete.
  const blocks=this.owner.concretes.filter(c=>c.isPlatform());
  const faces=[...HIGHWAY_WALLS.map(w=>({edge:w.x,top:w.top,bottom:w.bottom,side:w.x<worldWidth/2?'right':'left',outer:true})),
    ...blocks.flatMap(c=>{const r=c.platformRect;return [
      {edge:r.x,top:r.y,bottom:r.y+r.h,side:'left',outer:false},
      {edge:r.x+r.w,top:r.y,bottom:r.y+r.h,side:'right',outer:false}];})];
  if(this.wallClearance>0)this.wallClearance--;
  if(this.climbing&&this.wall){
    const face=this.wall;
    this.x=face.edge+(face.side==='left'?-1:1)*8*this.scale;
    this.y-=1.25*this.scale;
    if(this.y<=face.top){
      // Al coronar una pared: invertir rumbo y caer hacia el interior.
      this.y=face.top;
      this.dir=face.side==='left'?-1:1;
      this.x=face.edge+this.dir*25*this.scale;
      this.climbing=false;this.wall=null;
      this.falling=true;this.fallVy=0;
      this.recentWall=face.edge;this.wallClearance=35;
    }
  }else if(this.falling){
    // Sigue desplazándose y es ofensiva durante toda la caída.
    this.x+=this.dir*1.15*this.scale;
    this.fallVy=Math.min(this.fallVy+.22*this.scale,4*this.scale);
    const oldY=this.y;this.y+=this.fallVy;
    let surface=this.owner.feetY;
    for(const c of blocks){const r=c.platformRect;
      if(this.x>=r.x&&this.x<=r.x+r.w&&oldY<=r.y&&this.y>=r.y&&r.y<surface)surface=r.y;
    }
    if(this.y>=surface){this.y=surface;this.falling=false;this.fallVy=0;}
  }else{
    const next=this.x+this.dir*1.15*this.scale;
    const wall=faces.find(face=>{
      if(this.wallClearance>0&&face.edge===this.recentWall)return false;
      if((this.dir>0&&face.side!=='left')||(this.dir<0&&face.side!=='right'))return false;
      const crossed=this.dir>0?this.x<=face.edge+20*this.scale&&next+20*this.scale>=face.edge:this.x>=face.edge-20*this.scale&&next-20*this.scale<=face.edge;
      return crossed&&this.y>face.top+2&&this.y-32*this.scale<face.bottom;
    });
    if(wall){this.climbing=true;this.wall=wall;this.x=wall.edge+(wall.side==='left'?-1:1)*8*this.scale;}
    else{
      this.x=next;
      let surface=this.owner.feetY;
      for(const c of blocks){const r=c.platformRect;if(this.x>=r.x&&this.x<=r.x+r.w&&this.y<=r.y+5&&r.y<surface)surface=r.y;}
      this.y=Math.min(surface,this.y+4*this.scale);
    }
  }
  // Un borde del mapa nunca debe matar a la serpiente: la devuelve al interior.
  const leftBound=HIGHWAY_WALLS[0]?.x??0,rightBound=HIGHWAY_WALLS[HIGHWAY_WALLS.length-1]?.x??worldWidth;
  if(this.x<leftBound){this.x=leftBound+20*this.scale;this.dir=1;this.falling=true;this.climbing=false;this.wall=null;}
  if(this.x>rightBound){this.x=rightBound-20*this.scale;this.dir=-1;this.falling=true;this.climbing=false;this.wall=null;}

 }
 tryHit(t){if(!t||this.hit||this.particles.length)return;const mine=this.getPixelBodyFrame(),target=t.getPixelBodyFrame?.(this.x);
  if(mine&&target&&opaqueFramesOverlap(mine,target,null,1)){dealDamage(t,7,{attacker:this.owner,attackName:'Search Snake',projectile:true,impactX:this.x,impactY:this.y-20});if(t.lastGuardImpact?.front){this.hit=true;this.explode();return;}const wallHit=this.climbing;
    if(wallHit && (t.characterId==='x'||t.characterId==='zero'||t.characterId==='knuckles')){
      t.airMobilityLocked=true;
      t.wallSliding=false;
      t.wallClingK=false;t.wallSideK=null;
      t.glide=false;t.glideAttack=false;
      t.zeroWallHopUntil=0;
      t.facingLocked=false;
      t.isGrounded=false;
      t.vy=Math.max(1,t.vy||0);
      t.vx=this.wall?.side==='right'?-9:9;
      t.x+=Math.sign(t.vx)*14;
    }else t.vx=this.dir*5;
    this.hit=true;this.explode();}}
 draw(){if(this.particles.length){ctx.save();ctx.fillStyle='#7ddc56';for(const p of this.particles)if(p.life>0)ctx.fillRect(p.x-game.cameraX,p.y,Math.max(2,this.scale*2),Math.max(2,this.scale*2));ctx.restore();return;}const f=this.getPixelBodyFrame();if(!f)return;ctx.save();ctx.imageSmoothingEnabled=false;if(f.flipX){ctx.translate(f.dx-game.cameraX+f.dw,0);ctx.scale(-1,1);ctx.drawImage(f.img,f.sx,f.sy,f.sw,f.sh,0,f.dy,f.dw,f.dh);}else ctx.drawImage(f.img,f.sx,f.sy,f.sw,f.sh,f.dx-game.cameraX,f.dy,f.dw,f.dh);ctx.restore();}
}
class RockLeafShield{
 constructor(owner){this.owner=owner;this.leaves=[0,1,2,3].map(i=>({slot:i,alive:true,fall:0,x:0,y:0}));this.active=true;this.thrown=false;this.throwAge=0;this.dir=owner.facingDirection||1;this.x=owner.x+owner.width/2;this.y=owner.y+owner.height/2;this.hit=new WeakSet();}
 launch(dx=this.owner.facingDirection||1,dy=0){if(this.thrown)return;const positions=this.leaves.map(l=>this.leafFrame(l));this.thrown=true;this.throwAge=0;const len=Math.hypot(dx,dy)||1;this.dir=dx/len;this.dirY=dy/len;this.x=this.owner.x+this.owner.width/2;this.y=this.owner.y+this.owner.height/2;for(let i=0;i<this.leaves.length;i++){this.leaves[i].x=positions[i].px;this.leaves[i].y=positions[i].py;}}
 quadrant(x,y){const cx=this.owner.x+this.owner.width/2,cy=this.owner.y+this.owner.height/2;return (y<cy?0:2)+(x>=cx?1:0);}
 breakLeaf(l,x,y){if(!l?.alive)return;l.alive=false;l.fall=1;l.x=x;l.y=y;}
 interceptSpin(bounds){
  if(this.thrown||!this.active)return false;
  for(const leaf of this.leaves){
   if(!leaf.alive)continue;
   const f=this.leafFrame(leaf);
   if(bounds.x>=f.dx+f.dw||bounds.x+bounds.w<=f.dx||
      bounds.y>=f.dy+f.dh||bounds.y+bounds.h<=f.dy)continue;
   this.breakLeaf(leaf,f.px,f.py);
   return true;
  }
  return false;
 }
 intercept({x,y,attacker}={}){if(this.thrown||!this.active)return false;const q=this.quadrant(x??(attacker?.x??this.owner.x),y??(attacker?.y??this.owner.y));const leaf=this.leaves[q];if(!leaf?.alive)return false;this.breakLeaf(leaf,this.owner.x+this.owner.width*(q%2?.78:.22),this.owner.y+this.owner.height*(q<2?.25:.75));return true;}
 leafFrame(l){const w=64,scale=this.owner.height/48,angle=combatNow()/360+l.slot*Math.PI/2,radius=23*scale;const cx=this.owner.x+this.owner.width/2,cy=this.owner.y+this.owner.height/2;const px=this.thrown?l.x:cx+Math.cos(angle)*radius,py=this.thrown?l.y:cy+Math.sin(angle)*radius;return {img:LEAF_IMG,sx:((Math.floor(combatNow()/65)+l.slot*3)%12)*32,sy:0,sw:32,sh:32,dx:px-w/2,dy:py-w/2,dw:w,dh:w,flipX:false,px,py};}
 update(){
  const speed=3*this.owner.height/48;
  if(this.thrown)this.throwAge++;
  for(const l of this.leaves){
   if(l.alive&&this.thrown){
    l.x+=this.dir*speed;l.y+=(this.dirY||0)*speed;
    const f=this.leafFrame(l),dx=this.dir,dy=this.dirY||0;
    // Colisiones del escenario según el sentido de vuelo, no por rozar el suelo.
    let collide=(dx<0&&f.dx<=0)||(dx>0&&f.dx+f.dw>=worldWidth)
      ||(dy<0&&f.dy<=0)||(dy>0&&f.dy+f.dh>=this.owner.feetY);
    if(!collide)for(const c of this.owner.concretes){
     if(!c.isPlatform())continue;
     const r=c.platformRect;
     // Sólo la cara de la superficie hacia la que viaja puede detener la hoja.
     const crosses=(dx>0&&f.dx<r.x&&f.dx+f.dw>=r.x)
       ||(dx<0&&f.dx<=r.x+r.w&&f.dx+f.dw>r.x+r.w)
       ||(dy>0&&f.dy<r.y&&f.dy+f.dh>=r.y)
       ||(dy<0&&f.dy<=r.y+r.h&&f.dy+f.dh>r.y+r.h);
     if(crosses&&opaqueRegionInRect(f,{x:0,y:0,w:1,h:1},r,2)){collide=true;break;}
    }
    if(collide)this.breakLeaf(l,f.px,f.py);
   }
   if(l.fall){l.fall++;l.y+=.7*this.owner.height/48;l.x+=Math.sin(l.fall*.15)*.7;if(l.fall>80)l.fall=0;}
  }
  if(!this.leaves.some(l=>l.alive)&&!this.leaves.some(l=>l.fall))this.active=false;
 }
 tryHit(t){if(!this.thrown||!t)return;const target=t.getPixelBodyFrame?.(this.x);if(!target)return;
  for(const l of this.leaves){if(!l.alive)continue;const f=this.leafFrame(l);if(opaqueFramesOverlap(f,target,null,1)){
   dealDamage(t,4,{attacker:this.owner,attackName:'Leaf Shield',projectile:true,impactX:f.px,impactY:f.py});if(!t.lastGuardImpact?.front)t.vx=this.dir*6;this.breakLeaf(l,f.px,f.py);
  }}
 }
 draw(){for(const l of this.leaves){if(l.fall){const f=12+Math.min(4,Math.floor(l.fall/9));drawGreen(LEAF_IMG,f,32,32,l.x-32-game.cameraX,l.y-32,64,64,false,Math.max(.2,1-l.fall/85));continue;}if(!l.alive)continue;const f=this.leafFrame(l);drawGreen(LEAF_IMG,f.sx/32,32,32,f.dx-game.cameraX,f.dy,f.dw,f.dh);}}
}

export class Rock extends PrototypeFighter {
 constructor(x,y,controls){
  super(x,y,controls,{name:'ROCK',color:'#3588e8',hasSonicJump:false,speed:6});
  initBuster(this,'rock'); configureCombatant(this,'rock','ROCK'); this.characterId='rock';
  this.isIntroActive=true; this.introFrame=0; this.introTimer=0;
  this.rockBornAt=combatNow(); this.runStartedAt=combatNow(); this.wasRunning=false;
  this.jumpStartedAt=0; this.wasGroundedRock=true;
  this.fireStartedAt=0; this.fireUntil=0; this.chargeShotStartedAt=0; this.chargeShotUntil=0;
  this.slashActive=false; this.slashStartedAt=0; this.slashHit=false;
  // Rock inicia BASE. Doble abajo abre selector; tercer input elige set.
  this.weaponSet='base';this.weaponAmmo={cut_concrete:100,fire:100,leaf_snake:100};this.weaponAmmoLastAt=combatNow();this.weaponMenuOpen=false;this.lastCrouchTap=0;this.weaponFlashUntil=0;this.weaponFlashTarget=0;
  this.cutShotActive=false;this.cutShotStartedAt=0;this.cutShotSpawned=false;
  this.concretes=[];this.concreteMovingCooldownUntil=0;this.cutterCooldownUntil=0;this.fireEffects=[];this.heatCasting=false;this.swordCasting=false;this.fireShotCooldown=0;
  this.hitUntil=0;this.leafShield=null;this.snakes=[];this.bombs=[];this.greenCast=null;this.bombCooldownUntil=0;
  // Rush NO se invoca: nace automáticamente con Rock y permanece como compañero.
  this.activeRush=new RushCompanion(this);this.independentJet=new IndependentRushJet(this);
  this.activeBeat=new BeatCompanion(this);
  this.beatBoxes=[];this.eddies=[];this.eddieSupplies=[];this.eddieCooldownUntil=0;
 }
 getIntroFrames(){return [5,6,5,6,5,6].map(duration=>({duration}));} // Bass: 22 frames/2 s ~= 91 ms por sprite; Rock: 6 frames ~= 0.55 s.
 isAttacking(){return this.heatCasting||this.swordCasting||this.cutShotActive||this.slashActive||combatNow()<this.chargeShotUntil||super.isAttacking();}
 isBusy(){return this.heatCasting||this.swordCasting||this.cutShotActive||this.slashActive||combatNow()<this.chargeShotUntil||super.isBusy();}
 onDamageTaken({stagger=true}={}){if(!stagger)return;this.hitUntil=combatNow()+260;this.weaponMenuOpen=false;}
 startRushCoil(){if(this.isIntroActive||this.weaponMenuOpen)return false;return captureTournamentTool(this,'Rush Coil',this.activeRush?.startCoil()||false);}
 startRushJet(direction){if(this.isIntroActive||this.weaponMenuOpen)return false;return captureTournamentTool(this,'Rush Jet',this.independentJet?.start(direction)||false);}
 startBeatCrescent(){if(this.isIntroActive||this.isBusy())return false;return this.activeBeat?.startCrescent()||false;}
 startBeatPatrol(){if(this.isIntroActive||this.isBusy())return false;return captureTournamentTool(this,'Beat Patrol',this.activeBeat?.startPatrol()||false);}
 requestBeatDrop(){return this.activeBeat?.requestDrop()||false;}
 handleProjectileVsEddie(projectile){
  if(!projectile.active || projectile.owner===this)return false;
  const rect={x:projectile.x,y:projectile.y,w:projectile.width,h:projectile.height};
  if (!this.hitEddie(rect,projectile)) return false;
  projectile.active=false;
  return true;
 }
 handleMeleeVsEddie(rect,attacker){
  return attacker!==this && this.hitEddie(rect,{owner:attacker,vx:0},true);
 }
 hitEddie(rect,impact,preferRock=false){
  const beat=this.activeBeat;
  const carrying=beat && ['eddie_return','eddie_carry'].includes(beat.state);
  const carried=carrying ? {x:beat.x,y:beat.y+39*beat.scale,scale:beat.scale,facing:beat.facing,
   frame:Math.floor(combatNow()/100)%4} : null;
  const candidates=this.eddies.filter(eddie=>eddie.active && eddie.state!=='knocked');
  if(carried)candidates.push(carried);
  const hit=candidates.find(eddie=>{
   const s=eddie.scale;
   const x=eddie.x+(eddie.facing===1?-21:-14)*s;
   const y=eddie.y-35*s;
   return rect.x<x+35*s && rect.x+rect.w>x && rect.y<y+35*s && rect.y+rect.h>y;
  });
  if(!hit || (preferRock && this.pixelBodyIntersectsRect(rect)))return false;
  if(hit===carried){
   const dropped=new EddieDelivery(this,hit.x,hit.y,hit.facing);
   this.eddies.push(dropped);dropped.knockAway(impact);beat._setState('return');
  }else hit.knockAway(impact);
  this.eddieCooldownUntil=combatNow()+10000;
  return true;
 }
 releaseEddie(){const beat=this.activeBeat;if(beat?.state!=='eddie_carry')return false;this.eddies.push(new EddieDelivery(this,beat.x,beat.y+39*beat.scale,this.facingDirection||1));beat._setState('return');return true;}
 requestEddie(){const now=combatNow();if(this.isIntroActive||now<this.eddieCooldownUntil||this.eddies.some(e=>e.active)||!this.activeBeat||this.activeBeat.state!=='follow')return false;
  this.eddieCooldownUntil=now+10000;const beat=this.activeBeat;beat.eddieSearchDir=this.facingDirection||1;beat.pathStartX=beat.x;beat.pathStartY=beat.y;beat._setState('eddie_search');return captureTournamentTool(this,'Eddie');}

 spawnBeatBox(x,y){this.beatBoxes.push(new BeatBox(this,x,y));}
 spendWeaponAmmo(cost,set=this.weaponSet){if(game.mode==='practice'||set==='base')return true;const left=this.weaponAmmo[set]??0;if(left<cost)return false;this.weaponAmmo[set]=left-cost;return true;}
 handleWeaponSelectorInput(code){
  const now=combatNow(),c=this.controls;
  if(code===c.crouch){
   if(this.weaponMenuOpen){this.selectWeaponSet('base');return true;}
   if(now-this.lastCrouchTap<=300){this.weaponMenuOpen=true;this.vx=0;this.lastCrouchTap=0;return true;}
   this.lastCrouchTap=now;return false;
  }
  if(!this.weaponMenuOpen)return false;
  if(code===c.attack){this.selectWeaponSet('base');return false;}
  if(code===c.jump){this.selectWeaponSet('cut_concrete');return true;}
  if(code===c.right){this.selectWeaponSet('fire');return true;}
  if(code===c.left){this.selectWeaponSet('leaf_snake');return true;}
  return true;
 }
 selectWeaponSet(set){
  this.weaponMenuOpen=false;
  if(set===this.weaponSet)return true;
  // Cambiar de set limpia entidades temporales, pero conserva las tres reservas de munición.
  this.busterCharging=false;this.busterChargeStart=0;
  this.cleanupWeaponSet();this.weaponSet=set;this.weaponFlashUntil=combatNow()+2000;this.weaponFlashTarget=set==='cut_concrete'?4:set==='fire'?5:set==='leaf_snake'?6:0;return true;
 }
 cleanupWeaponSet(){for(const p of game.projectiles)if(p.owner===this&&p.type==='rolling-cutter')p.active=false;for(const c of this.concretes)c.active=false;this.concretes=[];}
 startGreen(kind){if(this.weaponSet!=='leaf_snake'||this.isBusy()||this.isIntroActive||this.greenCast)return false;
  if(kind==='snake'&&this.snakes.filter(o=>o.active).length>=2)return false;
  if(kind==='bomb'&&(this.bombs.filter(o=>o.active).length>=3||combatNow()<this.bombCooldownUntil))return false;
  const cost={snake:8,bomb:13,leaf:12}[kind]||0;if(!this.spendWeaponAmmo(cost))return false;
  if(kind==='leaf'){if(!this.leafShield)this.leafShield=new RockLeafShield(this);else this.leafShield.launch();return true;}
  if(kind==='bomb')this.bombCooldownUntil=combatNow()+900;
  this.greenCast={kind,at:combatNow(),spawned:false};this.facingLocked=true;return true;}
 launchLeaf(dx,dy){if(!this.leafShield||this.leafShield.thrown)return false;const cost=Math.max(2,this.leafShield.leaves.filter(l=>l.alive).length*2);if(!this.spendWeaponAmmo(cost))return false;this.leafShield.launch(dx,dy);return true;}
 startConcrete(kind='moving'){
  if(this.weaponSet!=='cut_concrete'||this.isBusy()||this.isIntroActive||this.weaponMenuOpen)return false;
  const builds=this.concretes.filter(c=>c.active&&(c.kind==='build_near'||c.kind==='build_far')).length;
  if((kind==='build_near'||kind==='build_far')&&builds>=2)return false;
  if(kind==='moving'&&(combatNow()<this.concreteMovingCooldownUntil||this.concretes.some(c=>c.active&&c.kind==='moving')))return false;
  if(!this.spendWeaponAmmo(kind==='moving'?14:8))return false;
  this.fireStartedAt=combatNow();this.fireUntil=this.fireStartedAt+260;this.concretes.push(new ConcreteBlock(this,kind));return true;
 }
 resolveConcreteBody(f){
  if(!f||!Number.isFinite(f.x)||!Number.isFinite(f.y))return;
  if(f.minerPhase==='under'||f.minerPhase==='warning'){
   f._concretePreviousX=f.x;f._concretePreviousY=f.y;
   return;
  }
  // Bounding box derivado del primer idle: la muestra alfa se calcula una vez por imagen.
  const idle=f.characterId==='rock'?S.idle.img:(f.getPixelBodyFrame?.()?.img);
  let insetX=.18,insetY=.08,widthRatio=.64,heightRatio=.88;
  if(idle?.complete&&idle.naturalWidth){
   if(!idle._concreteIdleBounds){try{const sw=f.characterId==='rock'?48:Math.min(48,idle.naturalWidth),sh=f.characterId==='rock'?48:Math.min(48,idle.naturalHeight);const can=document.createElement('canvas');can.width=sw;can.height=sh;const c=can.getContext('2d',{willReadFrequently:true});c.drawImage(idle,0,0,sw,sh,0,0,sw,sh);const a=c.getImageData(0,0,sw,sh).data;let x0=sw,y0=sh,x1=0,y1=0;for(let y=0;y<sh;y++)for(let x=0;x<sw;x++)if(a[(y*sw+x)*4+3]>32){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}idle._concreteIdleBounds=x0<=x1?{x0:x0/sw,x1:(x1+1)/sw,y0:y0/sh,y1:(y1+1)/sh}:null;}catch{idle._concreteIdleBounds=null;}}
   const b=idle._concreteIdleBounds;if(b){insetX=b.x0;insetY=b.y0;widthRatio=b.x1-b.x0;heightRatio=b.y1-b.y0;}
  }
  const fw=f.width||48,fh=f.height||48, left=f.x+fw*insetX,right=left+fw*widthRatio,top=f.y+fh*insetY,bottom=top+fh*heightRatio;
  for(const c of this.concretes){if(!c.isPlatform())continue;const r=c.platformRect;if(right<=r.x||left>=r.x+r.w||bottom<=r.y||top>=r.y+r.h)continue;
   const prevX=f._concretePreviousX??(f.x-(f.vx||0)),prevY=f._concretePreviousY??(f.y-(f.vy||0));
   const oldBottom=prevY+fh*(insetY+heightRatio),oldTop=prevY+fh*insetY;
   const oldRight=prevX+fw*(insetX+widthRatio),oldLeft=prevX+fw*insetX;
   if((f.vy??0)>=0&&oldBottom<=r.y+12){f.y=r.y-fh*(insetY+heightRatio);f.vy=0;f.isGrounded=true;f.x+=c.lastMoveX||0;}
   else if((f.vy??0)<0&&oldTop>=r.y+r.h-12){f.y=r.y+r.h-fh*insetY;f.vy=0;}
   else {
    const [leftWall,rightWall]=HIGHWAY_WALLS;
    const leftExit=r.x-fw*(insetX+widthRatio)-.1;
    const rightExit=r.x+r.w-fw*insetX+.1;
    const preferLeft=oldRight<=r.x+15||f.x+fw/2<r.x+r.w/2;
    if(leftExit<leftWall.x)f.x=rightExit;
    else if(rightExit+fw>rightWall.x)f.x=leftExit;
    else f.x=preferLeft?leftExit:rightExit;
    f.vx=0;f.isDashing=false;
   }
  }
  f._concretePreviousX=f.x;f._concretePreviousY=f.y;
 }
 handleProjectileVsConcrete(proj){
  if(!proj?.active||proj.owner===this)return false;
  for(const c of this.concretes){if(!c.isPlatform())continue;const r=c.platformRect;if(proj.x<r.x+r.w&&proj.x+proj.width>r.x&&proj.y<r.y+r.h&&proj.y+proj.height>r.y){const breaks=proj.type==='buster-x-4';c.takeDamage(proj.damage||3,{breaksConcrete:breaks});proj.active=false;return true;}}
  return false;
 }
 startFireShot(){if(this.weaponSet!=='fire'||this.isIntroActive||this.weaponMenuOpen||combatNow()<this.fireShotCooldown||!this.spendWeaponAmmo(2))return false;const dir=this.facingDirection||1;this.fireShotCooldown=combatNow()+160;this.fireStartedAt=combatNow();this.fireUntil=this.fireStartedAt+250;this.fireEffects.push(new FireEffect(this,'shot',this.x+this.width/2+dir*28,this.y+this.height*.45,dir));return true;}
 startHeatFire(){if(this.weaponSet!=='fire'||this.isBusy()||this.isIntroActive||!this.spendWeaponAmmo(14))return false;this.heatCasting=true;this.heatCastAt=combatNow();this.heatSpawned=false;this.facingLocked=true;return true;}
 startFlameSword(){if(this.weaponSet!=='fire'||this.isBusy()||this.isIntroActive||!this.spendWeaponAmmo(12))return false;this.swordCasting=true;this.swordCastAt=combatNow();this.swordHit=false;this.facingLocked=true;this.vy=-14;this.isGrounded=false;return true;}
 startSlashClaw(){if(!this.isGrounded||this.isBusy()||this.isIntroActive)return false;this.slashActive=true;this.slashStartedAt=combatNow();this.slashHit=false;this.facingLocked=true;return true;}
 startRollingCutter(arc='lower'){
  if(this.weaponSet!=='cut_concrete'||this.isBusy()||this.isIntroActive||this.weaponMenuOpen||combatNow()<this.cutterCooldownUntil)return false;
  // Sólo puede existir UN Rolling Cutter de Rock a la vez.
  if(game.projectiles.some(p=>p.active&&p.owner===this&&p.type==='rolling-cutter')||!this.spendWeaponAmmo(10))return false;
  this.cutShotActive=true;this.cutShotArc=arc;this.cutShotStartedAt=combatNow();this.cutShotSpawned=false;this.vx=0;this.isDashing=false;this.facingLocked=true;return true;
 }
 onBusterFired(level){
  const now=combatNow();this.fireStartedAt=now;this.fireUntil=now+260;
  if(level===1)this.lastBasicShotAt=now;
  if(level>1&&this.isGrounded){this.chargeShotStartedAt=now;this.chargeShotUntil=now+450;this.vx=0;this.isDashing=false;this.facingLocked=true;}
 }
 update(opponentX,self){
  const wasGround=this.isGrounded;
  super.update(opponentX,self);
  const now=combatNow();
  if (this.weaponSet==='base' && !this.weaponMenuOpen && !this.isIntroActive &&
      !this.isHitstunned() && !this.isVulnerable && !this.busterCharging && this.keys[this.controls.attack] &&
      ['0','go'].includes(game.countdown?.phase)) {
   this.busterCharging=true;
   this.busterChargeStart=now;
   this.busterChargeLevel=1;
  }
  const ammoDelta=Math.max(0,now-this.weaponAmmoLastAt);this.weaponAmmoLastAt=now;
  for(const set of ['cut_concrete','fire','leaf_snake'])if(set!==this.weaponSet)this.weaponAmmo[set]=Math.min(100,this.weaponAmmo[set]+ammoDelta*.0008);
  if(!this.facingLocked)this.facingDirection=opponentX>this.x?1:-1;
  if(wasGround&&!this.isGrounded)this.jumpStartedAt=now;
  const running=this.isGrounded&&Math.abs(this.vx)>.1&&!this.slashActive&&now>=this.chargeShotUntil;
  if(running&&!this.wasRunning)this.runStartedAt=now;this.wasRunning=running;
  if(this.greenCast){const e=now-this.greenCast.at;this.vx=0;if(e>=170&&!this.greenCast.spawned){const k=this.greenCast.kind;this.greenCast.spawned=true;if(k==='bomb')this.bombs.push(new RockBomb(this));else if(k==='snake')this.snakes.push(new RockSnake(this));}if(e>=340){this.greenCast=null;this.facingLocked=false;}}
  if(this.heatCasting){const e=now-this.heatCastAt;this.vx=0;if(!this.heatSpawned&&e>=170){const dir=this.facingDirection||1;const fx=new FireEffect(this,'heat',this.x+this.width/2+dir*20,this.y+this.height*.48,dir);
   // Concrete móvil ~26 px fuente: Heat cae cerca de esa zona, más lejos en el aire.
   fx.vx=dir*(this.isGrounded?3.0:4.3)*fx.scale;fx.vy=(this.isGrounded?-5.3:-6.6)*fx.scale;fx.heatGroundY=this.feetY;
   this.fireEffects.push(fx);this.heatSpawned=true;}if(e>=340){this.heatCasting=false;this.facingLocked=false;}}
  if(this.swordCasting&&now-this.swordCastAt>=360){this.swordCasting=false;this.facingLocked=false;}
  for(const fx of this.fireEffects)fx.update();this.fireEffects=this.fireEffects.filter(fx=>fx.active);
  if(this.slashActive){this.vx=0;if(now-this.slashStartedAt>=4*85){this.slashActive=false;this.slashHit=false;this.facingLocked=false;}}
  if(this.cutShotActive){
   this.vx=0;const e=now-this.cutShotStartedAt;
   // Frames 1-2: Cutter todavía está pegado a la animación de Rock. Al entrar al frame 3 se desprende.
   if(!this.cutShotSpawned&&e>=170){game.projectiles.push(new RollingCutter(this,this.cutShotArc||'lower'));this.cutShotSpawned=true;}
   if(e>=4*85){this.cutShotActive=false;this.cutShotSpawned=false;this.facingLocked=false;}
  }
  if(now<this.chargeShotUntil){this.vx=0;}else if(this.chargeShotUntil&&this.facingLocked&&!this.slashActive){this.chargeShotUntil=0;this.facingLocked=false;}
  for(const c of this.concretes)c.update();
  this.concretes=this.concretes.filter(c=>c.active);
  // Rock puede montar ambos Concrete una vez sólidos. La plataforma móvil transporta sólo en X.
  if(this.vy>=0){for(const c of this.concretes){if(!c.isPlatform())continue;const r=c.platformRect,feet=this.y+this.height;if(this.x+this.width>r.x&&this.x<r.x+r.w&&feet>=r.y-8&&feet<=r.y+18){this.y=r.y-this.height;this.vy=0;this.isGrounded=true;this.x+=c.lastMoveX||0;break;}}}
  if(this.weaponMenuOpen)this.vx=0;
  this.wasGroundedRock=this.isGrounded;
  this.activeRush?.update(self);this.independentJet?.update();
  for(const o of [...this.snakes,...this.bombs])o.update();
  this.snakes=this.snakes.filter(o=>o.active);this.bombs=this.bombs.filter(o=>o.active);
  this.leafShield?.update();if(this.leafShield&&!this.leafShield.active)this.leafShield=null;
  this.activeBeat?.update();
  for(const e of this.eddies)e.update();this.eddies=this.eddies.filter(e=>e.active);
  for(const item of this.eddieSupplies)item.update();this.eddieSupplies=this.eddieSupplies.filter(e=>e.active);
  for(const box of this.beatBoxes)box.update();
  this.beatBoxes=this.beatBoxes.filter(box=>!box.dead);
 }
 _paletteIndex(){
  const now=combatNow();
  if(now<this.weaponFlashUntil){const elapsed=2000-(this.weaponFlashUntil-now);return Math.floor(elapsed/200)%2===0?2:this.weaponFlashTarget;}
  if(this.weaponSet==='cut_concrete')return 4;
  if(this.weaponSet==='fire')return 5;
  if(this.weaponSet==='leaf_snake')return 6;
  if(!this.busterCharging)return 0;
  const level=getBusterLevel(this);const base=level===1?0:level===2?1:3;
  return Math.floor(combatNow()/95)%2===0?base:2; // Nv1 P1<->P3, Nv2 P2<->P3, Nv3 P4<->P3
 }
 _runFrame(){const cycle=this.walkReverse?2160:720;return Math.floor(((combatNow()-this.runStartedAt)%cycle)/(cycle/10));}
 _anim(){
  const now=combatNow();
  if(this.isIntroActive)return ['intro',Math.min(5,this.introFrame)];
  if(now<this.hitUntil||this.wasInAirFromKnockback)return [this.isGrounded?'hit':'airhit',0];
  if(this.swordCasting)return ['flamesword',Math.min(3,Math.floor((now-this.swordCastAt)/90))];
  if(this.greenCast)return [this.greenCast.kind==='snake'?'fire':'slash',Math.min(3,Math.floor((now-this.greenCast.at)/85))];
  if(this.heatCasting)return ['slash',Math.min(3,Math.floor((now-this.heatCastAt)/85))];
  if(this.cutShotActive)return ['cutshot',Math.min(3,Math.floor((now-this.cutShotStartedAt)/85))];
  if(this.slashActive)return ['slash',Math.min(3,Math.floor((now-this.slashStartedAt)/85))];
  if(now<this.chargeShotUntil)return ['charge',Math.min(4,Math.floor((now-this.chargeShotStartedAt)/90))];
  if(this.isDashing){const seq=[3,0,1,2];return ['dash',seq[Math.min(3,this.dashFrame)]??2];}
  const firing=this.busterCharging||now<this.fireUntil;
  if(!this.isGrounded){
   const e=Math.max(0,now-this.jumpStartedAt);let f=Math.min(5,Math.floor(e/75));if(this.vy>=0)f=5;
   return [firing?'jumpfire':'jump',f];
  }
  if(Math.abs(this.vx)>.1)return [firing?'runfire':'run',this._runFrame()];
  if(now<this.fireUntil)return ['fire',Math.min(3,Math.floor((now-this.fireStartedAt)/65))];
  // Idle: frame 1 normal; cada 3 s muestra brevemente frame 3. Herido: frame 4 y el mismo parpadeo al 3.
  const pulse=(now-this.rockBornAt)%3000<170;const hurt=this.health<=this.maxHealth*.30;
  return ['idle',pulse?2:(hurt?3:0)];
 }
 _frameFor(key,fi){
  const s=S[key];if(!s?.img.complete||!s.img.naturalWidth)return null;
  const scale=this.height/48;const sw=s.cw,sh=s.ch,dw=sw*scale,dh=sh*scale;
  const pivotWorldX=this.x+this.width/2,pivotWorldY=this.y+this.height;
  const dx=pivotWorldX-s.pivotX*scale,dy=pivotWorldY-s.pivotY*scale;
  const flip=(this.facingDirection!==s.sourceFacing); // source=-1; mirando derecha => flip.
  return {img:key==='flamesword'?s.img:recolored(s.img,this._paletteIndex()),sx:s.start+fi*(s.cw+s.gap),sy:0,sw,sh,dx,dy,dw,dh,flipX:flip,key,frame:fi,scale};
 }
 _frame(){const [key,fi]=this._anim();return this._frameFor(key,fi);}
 getPixelBodyFrame(){return this._frame();}
 pixelBodyIntersectsRect(r){const f=this._frame();return f?opaqueRegionInRect(f,{x:0,y:0,w:1,h:1},r,1):false;}
 tryHit(receiver){
  this.activeRush?.tryHit(receiver);this.independentJet?.tryHit(receiver);
  this.activeBeat?.tryHit(receiver);
  for(const box of this.beatBoxes)box.tryHit(receiver);
  for(const c of this.concretes)c.tryHit(receiver);
  for(const fx of this.fireEffects)fx.tryHit(receiver);
  for(const b of this.bombs)b.tryHit(receiver);for(const sn of this.snakes)sn.tryHit(receiver);this.leafShield?.tryHit(receiver);
  if(this.swordCasting&&!this.swordHit){const e=combatNow()-this.swordCastAt;if(e>=70&&e<360){const body=this._frame();const target=receiver?.getPixelBodyFrame?.(this.x+this.width/2);if(body&&target){const sword={...body,img:SWORD_FX};if(opaqueFramesOverlap(sword,target,null,1)){const damage=dealDamage(receiver,12,{attacker:this,attackName:'Flame Sword',element:'fire',impactX:this.x+this.width/2,impactY:this.y+this.height*.45});if(damage>0&&!receiver.lastGuardImpact?.front)fireKnock(receiver,this.facingDirection,'column');this.swordHit=true;}}}}
  if(!receiver||!this.slashActive||this.slashHit)return;
  const elapsed=combatNow()-this.slashStartedAt;if(elapsed<170||elapsed>=255)return; // frame 3 (indice 2)
  const f=this._frame();if(!f)return;
  // Region dada sobre el frame fuente: x=7..18, 7 px de alto empezando 19 px desde abajo.
  const lx=7,ly=48-19-7,lw=12,lh=7,s=f.scale;
  let wx;if(f.flipX)wx=f.dx+(f.sw-(lx+lw))*s;else wx=f.dx+lx*s;
  const rect={x:wx,y:f.dy+ly*s,w:lw*s,h:lh*s};
  const ry=receiver.getCurrentY(),rh=receiver.getCurrentHeight();
  const geo=rect.x<receiver.x+receiver.width&&rect.x+rect.w>receiver.x&&rect.y<ry+rh&&rect.y+rect.h>ry;
  const pixel=typeof receiver.pixelBodyIntersectsRect==='function'?receiver.pixelBodyIntersectsRect(rect,this.x+this.width/2):true;
  if(geo&&pixel){dealDamage(receiver,7,{attacker:this,attackName:'Rock Slash Claw'});receiver.vx=this.facingDirection*4;this.slashHit=true;}
 }
 draw(opponentX){
  if(!this.independentJet?.active)this.activeRush?.draw();this.independentJet?.draw();
  if(['eddie_return','eddie_carry'].includes(this.activeBeat?.state))drawEddieSprite(EDDIE_IMG,Math.floor(combatNow()/100)%4,this.activeBeat.x,this.activeBeat.y+39*this.activeBeat.scale,this.activeBeat.scale,this.activeBeat.facing);
  this.activeBeat?.draw();
  for(const e of this.eddies)e.draw();for(const item of this.eddieSupplies)item.draw();
  for(const box of this.beatBoxes)box.draw();
  for(const c of this.concretes)c.draw(game.cameraX);
  for(const fx of this.fireEffects)fx.draw();
  for(const b of this.bombs)b.draw();for(const sn of this.snakes)sn.draw();
  if(this.weaponMenuOpen){const cx=this.x+this.width/2-game.cameraX,cy=this.y-32;ctx.save();ctx.font='12px monospace';ctx.textAlign='center';ctx.fillStyle='rgba(0,0,0,.72)';ctx.fillRect(cx-70,cy-42,140,78);ctx.fillStyle='#fff';ctx.fillText('↑ CUT / CONCRETE',cx,cy-22);ctx.fillStyle='#777';ctx.fillText('← LEAF     FIRE →',cx,cy-3);ctx.fillStyle='#fff';ctx.fillText('↓ BASE / BUSTER',cx,cy+17);ctx.restore();}
  const f=this._frame();if(!f)return super.draw(opponentX);
  ctx.save();ctx.imageSmoothingEnabled=false;const dx=f.dx-game.cameraX;
  if(f.flipX){ctx.translate(dx+f.dw,0);ctx.scale(-1,1);ctx.drawImage(f.img,f.sx,f.sy,f.sw,f.sh,0,f.dy,f.dw,f.dh);}else ctx.drawImage(f.img,f.sx,f.sy,f.sw,f.sh,dx,f.dy,f.dw,f.dh);
  ctx.restore();
  this.leafShield?.draw();
  if(f.key==='flamesword'){fireDrawFrame({...f,img:SWORD_FX});}
  // Overlay del Cutter sostenido: sólo existe en frames 1 y 2; desde frame 3 ya es proyectil independiente.
  if(f.key==='cutshot'&&f.frame<2&&S.cutshot.fx.complete){ctx.save();ctx.imageSmoothingEnabled=false;const fx=S.cutshot.fx,fxdx=f.dx-game.cameraX;if(f.flipX){ctx.translate(fxdx+f.dw,0);ctx.scale(-1,1);ctx.drawImage(fx,f.frame*76,0,76,48,0,f.dy,f.dw,f.dh);}else ctx.drawImage(fx,f.frame*76,0,76,48,fxdx,f.dy,f.dw,f.dh);ctx.restore();}
 }
}
