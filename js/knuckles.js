import { worldWidth, SUPER_COST } from './config.js';
import { HIGHWAY_WALLS } from './wall-system.js';
import { combatNow } from './combat-clock.js';
import { configureCombatant, dealDamage } from './combat-system.js';
import { PrototypeFighter } from './prototype-fighter.js';
import { canvas, ctx, game } from './state.js';
import { opaqueFramesOverlap, opaqueRegionInRect } from './pixel-collision.js';

const load=(src)=>{const i=new Image();i.src=src;return i;};
const MINER_SPIN_MS=100, MINER_SINK_MS=115;
export const KNUCKLES_SHEETS={
 idle:{img:load('assets/images/knuckles_idle.png'),n:8,w:48,h:48},
 idleHurt:{img:load('assets/images/knuckles_idle_hurt.png'),n:8,w:48,h:48},
 run:{img:load('assets/images/knuckles_run.png'),n:9,w:48,h:48},
 jump:{img:load('assets/images/knuckles_jump.png'),n:5,w:48,h:48},
 fall:{img:load('assets/images/knuckles_fall.png'),n:4,w:48,h:48},
 dash:{img:load('assets/images/knuckles_dash.png'),n:7,w:48,h:48},
 glide:{img:load('assets/images/knuckles_flyandponch.png'),n:6,w:48,h:48},
 guard:{img:load('assets/images/knuckles_guard.png'),n:3,w:48,h:48},
 punch:{img:load('assets/images/knuckles_punch.png'),n:6,w:48,h:48},
 punch2:{img:load('assets/images/knuckles_punch2.png'),n:7,w:48,h:48},
 upper:{img:load('assets/images/knuckles_upper.png'),n:9,w:48,h:48},
 grab:{img:load('assets/images/knuckles_agarre.png'),n:15,w:48,h:48},
 spin:{img:load('assets/images/knuckles_spin.png'),n:4,w:48,h:48},
 miner:{img:load('assets/images/knuckles_spin_minero.png'),n:18,w:48,h:48},
 dirt:{img:load('assets/images/piedras_de_suelo.png'),n:6,w:64,h:32},
 hit:{img:load('assets/images/knuckles_hit.png'),n:3,w:48,h:48},
 wall:{img:load('assets/images/knuckles_wall_cling.png'),n:2,w:48,h:48}
};
const S={...KNUCKLES_SHEETS};
// Cada cuadro registra su recorte y el centro del cuerpo dentro de la tira.
const moveArt = {"grabHold":[37,34,[[15,46,28],[57,90,70]]],
 "grab2":[45,41,[[18,53,33],[55,96,72],[103,144,121],[149,190,165]]],
 "taunt":[44,38,[[2,32,15],[41,73,54],[90,126,105],[134,171,149]]],
 "autoCounter":[55,41,[[10,36,22],[46,79,58],[88,125,100],[132,172,145]]],
 "parry":[38,34,[[10,45,24],[47,79,60],[83,111,96],[113,143,125]]],
 "ken":[67,61,[[6,42,19],[56,91,69],[99,137,115],[150,189,169],[205,242,225]]],
 "lowCounter":[35,32,[[2,27,13],[31,57,43],[64,90,76],[96,123,107]]],
 "headbuttStart":[43,39,[[5,37,17],[41,73,54],[77,110,90]]],
 "fistWave":[92,90,[[10,109,10],[133,236,133],[256,354,256],[383,458,383]]],
 "mega":[38,33,[[10,70,28],[78,137,94],[144,202,160]]],
 "last":[43,37,[[4,57,19],[72,125,86],[138,190,152]]],
 "headbuttRecovery":[47,37,[[2,34,17],[39,68,53],[75,107,88],[110,143,124]]],
 "headbutt":[46,40,[[2,46,21],[50,91,68]]],
 "chargedFx":[80,77,[[17,115,17],[133,227,133],[239,338,239],[348,448,348]]],
 "charged":[72,56,[[1,34,16]]],
 "airPunch":[50,40,[[14,40,26],[46,69,56],[77,119,92],[129,167,143]]],
 "lowPunish":[45,42,[[9,41,22],[46,81,61],[85,119,100],[130,162,144],[169,202,183],[210,242,224],[246,276,260]]]};
for(const [key,[h,feet,frames]] of Object.entries(moveArt)){
 S[key]={img:load('assets/images/knuckles-moves/'+key+'.png'),n:frames.length,h,feet,frames};
}
const specialTiming={lowCounter:[4,78],lowPunish:[7,66],parry:[4,60],
 autoCounter:[4,75],taunt:[4,95],grab2:[8,85],charged:[4,120],
 last:[3,110],mega:[9,85],ken:[5,72],headbutt:[9,70],airPunch:[4,75]};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

export class Knuckles extends PrototypeFighter {
 constructor(x,y,controls){
  super(x,y,controls,{name:'KNUCKLES',color:'#d93b3b',spinProfile:'knuckles',speed:5.5});
  configureCombatant(this,'knuckles','KNUCKLES'); this.characterId='knuckles';
  this.kAnimStart=combatNow(); this.kAction=null; this.kFrame=0; this.kHit=false;
  this.runStart=0; this.wasMoving=false; this.guardFlashUntil=0; this.hitUntil=0;
  this.dirtTrail=[]; this.lastDirtTrailAt=0;
  this.glide=false; this.glideDir=1; this.glideAttack=false;
  this.minerPhase=null; this.minerStart=0; this.undergroundStart=0; this.minerCharge=0;
  this.grabTarget=null; this.grabFacing=1; this.grabConnected=false; this.grabThrown=false;
  this.wallClingK=false; this.wallSideK=null; this.wallAnchorX=0; this.wallAnimStep=0; this.wallLastStepAt=0; this.lastWallJumpPress=0;
 }
 isAttacking(){return !!this.kAction || this.glideAttack || super.isAttacking();}
 isBusy(){return !!this.kAction || this.glide || !!this.minerPhase || super.isBusy();}
 startAction(a){if(this.isIntroActive||this.kAction||this.minerPhase||this.glide)return false; this.kAction=a;this.kFrame=0;this.kHit=false;this.kAnimStart=combatNow();this.facingLocked=true;this.facingDirection=this.facingDirection||1;return true;}
 startPunch(){return this.isGrounded&&this.startAction('punch');}
 startPunch2(){return this.isGrounded&&this.startAction('punch2');}
 startFloorPunch(){return this.isGrounded&&this.startAction('floor');}
 startUpper(){return this.isGrounded&&this.startAction('upper');}
 startSpecial(key,direction=this.facingDirection){
  if((key==='airPunch'?this.isGrounded:!this.isGrounded)||this.isBusy()||this.isIntroActive||this.isVulnerable)return false;
  if(key==='mega'&&!this.spendPower(SUPER_COST))return false;
  this.facingDirection=direction;
  return this.startAction(key);
 }
 interceptIncomingHit(damage,options){
  const key=this.kAction,age=combatNow()-this.kAnimStart;
  if(!options.attacker||age<35||age>210||this.isHitstunned())return false;
  if(key==='lowCounter'&&(options.projectile||options.element||
   /saber|sword|espada|blade|cuchilla|roca|bomba|bomb|martillo|escudo|concrete|cutter/i.test(options.attackName??'')))return false;
  if(!['lowCounter','parry'].includes(key))return false;
  this.facingDirection=options.attacker.x>=this.x?1:-1;
  this.kAction=key==='lowCounter'?'lowPunish':'autoCounter';
  this.kAnimStart=combatNow();this.kFrame=0;this.kHit=false;
  return true;
 }
 startParryTaunt(){this.kAction='taunt';this.kAnimStart=combatNow();this.kFrame=0;}
 startGrab(){if(!this.isGrounded)return false;this.grabThrown=false;return this.startAction('grab');}
 cancelSecondGrab(){
  if(this.grabTarget){this.grabTarget.isVulnerable=false;this.grabTarget=null;}
  this.kAction=null;this.facingLocked=false;
 }
 onDamageTaken({stagger=true,projectile=false,attacker}={}){
  if(this.kAction==='grab2'&&projectile){
   this.cancelSecondGrab();
   this.vx=(this.x<(attacker?.x??this.x)?-1:1)*8;
   this.vy=-5;this.isGrounded=false;this.wasInAirFromKnockback=true;this.knockbackAirTimer=0;
  }
  if(this.minerPhase==='spin'||this.minerPhase==='sink'){
   this.minerPhase=null;this.kFrame=0;this.facingLocked=false;
   this.minerReadyAt=combatNow()+420;
   this.hitUntil=combatNow()+180;
  }else if(stagger)this.hitUntil=combatNow()+260;
 }
 grabDrawInFront(){return this.kAction==='grab'&&this.grabConnected&&this.kFrame>=3&&this.kFrame<=10 ? (this.kFrame%2===0) : true;}
 _grabThrowVX(receiver){const d=clamp(receiver?.defenseMultiplier??1,0.80,1.30);const t=(d-0.80)/(1.30-0.80);const distance=canvas.width*(0.25+0.50*t);return distance/30;}
 startGlide(dir){if(this.isGrounded||this.airMobilityLocked||this.glide||this.minerPhase)return false;this.glide=true;this.glideDir=dir||this.facingDirection||1;this.glideAttack=false;this.kAnimStart=combatNow();this.vy=0;this.facingLocked=true;this.facingDirection=this.glideDir;return true;}
 attackFromGlide(){if(!this.glide||this.glideAttack)return;this.glideAttack=true;this.kAnimStart=combatNow();}
 startMiner(){
  if(!this.isGrounded||this.kAction||this.glide||this.minerPhase||this.isHitstunned()||
   this.isVulnerable||combatNow()<(this.minerReadyAt??0))return false;
  // El topo es su propio estado: no debe quedarse atrapado en crouch/spin normal.
  this.isCrouching=false; this.isSpinning=false; this.isSpinDashActive=false;
  this.minerPhase='spin'; this.minerStart=combatNow(); this.kAnimStart=this.minerStart;
  this.minerCharge=0; this.kHit=false; this.vx=0; this.vy=0; this.facingLocked=true;
  return true;
 }
 _attachWall(side){
  if(this.airMobilityLocked)return;
  this.wallClingK=true; this.wallSideK=side; this.vx=0; this.vy=0; this.isGrounded=false;
  this.wallAnchorX=side==='left'?HIGHWAY_WALLS[0].x:HIGHWAY_WALLS[1].x-this.width;
  this.x=this.wallAnchorX; this.wallLastStepAt=combatNow();
 }
 releaseWall(){
  if(!this.wallClingK)return;
  const side=this.wallSideK; this.wallClingK=false; this.wallSideK=null;
  this.vx=side==='left'?5:-5;
 }
 wallJumpPress(){ if(!this.wallClingK)return false; const n=combatNow(); if(n-this.lastWallJumpPress<320){this.releaseWall();this.lastWallJumpPress=0;return true;} this.lastWallJumpPress=n; return false; }

 _actionTiming(){return specialTiming[this.kAction]||{punch:[6,70],punch2:[7,105],floor:[3,85],upper:[9,70],grab:[15,85]}[this.kAction]||[1,100];}
 update(opponentX,self){
  const now=combatNow(); const preGround=this.isGrounded;
  const specialXBefore=this.x, specialYBefore=this.y;
  super.update(opponentX,self);
  if(!this.facingLocked) this.facingDirection=opponentX>this.x?1:-1;
  if(this.kAction==='grab2'&&this.isHitstunned())this.cancelSecondGrab();
  if(this.kAction==='mega'&&!this.kHit&&now-this.kAnimStart>=510){
   this.kHit=true;
   this.fistGuardUsed=new WeakSet();
   this.fistWaves=Array.from({length:4},(_,i)=>({
    x:this.x+this.width/2,y:this.feetY-190,dir:this.facingDirection,at:now+i*135,hits:new WeakMap()
   }));
  }
  if(this.fistWaves){
   this.fistWaves=this.fistWaves.filter(w=>w.x>-240&&w.x<worldWidth+240);
   for(const wave of this.fistWaves)if(now>=wave.at)wave.x+=wave.dir*21;
  }
  if(this.kAction){const [n,ms]=this._actionTiming();this.vx=0;this.kFrame=Math.min(n-1,Math.floor((now-this.kAnimStart)/ms));if(now-this.kAnimStart>=n*ms){if(this.kAction==='autoCounter'&&!this.isHitstunned()){this.startParryTaunt();}else{if(this.kAction==='grab2'&&this.grabTarget)this.cancelSecondGrab();this.kAction=null;this.kFrame=0;this.kHit=false;this.grabTarget=null;this.grabConnected=false;this.grabThrown=false;this.facingLocked=false;}}}
  // Planeo v2: un poco mas rapido horizontalmente y bastante mas sustentado.
  // Recorre el ancho jugable en ~3.5 s y pierde ~1/3 de la altura jugable en ese trayecto.
  if(this.airMobilityLocked){this.glide=false;this.glideAttack=false;this.wallClingK=false;this.wallSideK=null;}
  if(this.glide){
   const playableW=HIGHWAY_WALLS[1].x-HIGHWAY_WALLS[0].x-this.width, playableH=this.feetY;
   const sx=playableW/3.5/60, sy=(playableH/3)/3.5/60;
   // super.update() ya consumio el frame. Aplicamos aqui el desplazamiento real del planeo
   // para que el movimiento generico no borre vx antes de mover a Knuckles.
   this.facingLocked=true; this.facingDirection=this.glideDir;
   const attackBoost=this.glideAttack?1.45:1;
   this.x=specialXBefore+this.glideDir*sx*attackBoost; this.y=specialYBefore+sy; this.vx=this.glideDir*sx*attackBoost; this.vy=0; this.isGrounded=false;
   this.x=clamp(this.x,HIGHWAY_WALLS[0].x,HIGHWAY_WALLS[1].x-this.width);
   if(this.glideAttack && now-this.kAnimStart>180){this.glide=false;this.glideAttack=false;this.facingLocked=false;}
   if(this.y+this.height>=this.feetY){this.y=this.feetY-this.height;this.glide=false;this.glideAttack=false;this.facingLocked=false;}
  }
  // La entrada es breve y cualquier golpe con daño puede interrumpirla.
  if(this.minerPhase){
   const e=now-this.minerStart;
   if(this.minerPhase==='spin' && e>=MINER_SPIN_MS){this.minerPhase='sink';this.minerStart=now;}
   else if(this.minerPhase==='sink' && e>=MINER_SINK_MS){this.minerPhase='under';this.undergroundStart=now;this.minerStart=now;this.y=this.feetY-this.height;}
   else if(this.minerPhase==='under'){
    const u=now-this.undergroundStart; this.minerCharge=clamp(u/4000,0,1); this.vy=0; this.y=this.feetY-this.height;
    const left=this.keys[this.controls.left],right=this.keys[this.controls.right];
    const move=(left?-this.speed:0)+(right?this.speed:0);
    // Movimiento subterraneo directo: el movimiento generico se ejecuta antes y borraba vx.
    this.x=clamp(this.x+move,HIGHWAY_WALLS[0].x,HIGHWAY_WALLS[1].x-this.width); this.vx=0;
    if(now-this.lastDirtTrailAt>=70){this.dirtTrail.push({x:this.x+this.width/2,t:now,frame:Math.floor(now/90)%5});this.lastDirtTrailAt=now;}
    this.dirtTrail=this.dirtTrail.filter(p=>now-p.t<520);
    if(u>=4000)this.beginMinerExit();
   } else if(this.minerPhase==='warning'){
    this.vx=0;if(now-this.minerStart>=1000){this.minerPhase='exit';this.minerStart=now;this.kHit=false;this.vy=-10;this.isGrounded=false;this.wasInAirFromKnockback=true;this.knockbackAirTimer=0;}
   } else if(this.minerPhase==='exit'){
    const f=11+Math.floor((now-this.minerStart)/45);this.kFrame=clamp(f-1,10,17);
    if(f>=18){this.minerPhase=null;this.kFrame=0;this.facingLocked=false;}
   }
  }
  // Wall Cling v2: una vez anclado, izquierda/derecha NO lo desplazan.
  // Solo el muro real puede anclarlo. El frame cambia como maximo una vez por segundo al subir.
  const atLeft=this.x<=HIGHWAY_WALLS[0].x+.5, atRight=this.x+this.width>=HIGHWAY_WALLS[1].x-.5;
  if(this.wallClingK){
   this.x=this.wallAnchorX; this.y=specialYBefore; this.vx=0; this.vy=0; this.isGrounded=false;
   const climbing=this.keys[this.controls.jump];
   if(climbing){
    this.y-=1.35;
    if(now-this.wallLastStepAt>=1000){this.wallAnimStep=(this.wallAnimStep+1)%2;this.wallLastStepAt=now;}
   }
  } else if(!this.airMobilityLocked && !this.isGrounded && !this.glide && !this.minerPhase){
   const towardLeft=atLeft&&this.keys[this.controls.left];
   const towardRight=atRight&&this.keys[this.controls.right];
   if(towardLeft)this._attachWall('left');
   else if(towardRight)this._attachWall('right');
  }
  if(this.isGrounded&&this.wallClingK){this.wallClingK=false;this.wallSideK=null;}
  const moving=Math.abs(this.vx)>.1&&this.isGrounded&&!this.kAction;if(moving&&!this.wasMoving)this.runStart=now;this.wasMoving=moving;
 }
 beginMinerExit(){if(this.minerPhase!=='under')return;this.minerPhase='warning';this.minerStart=combatNow();this.vx=0;}

 _anim(){const now=combatNow();
  if(this.minerPhase){if(this.minerPhase==='spin')return ['miner',Math.min(3,Math.floor((now-this.minerStart)/(MINER_SPIN_MS/4)))];if(this.minerPhase==='sink')return ['miner',4+Math.min(5,Math.floor((now-this.minerStart)/(MINER_SINK_MS/6)))];if(this.minerPhase==='warning')return ['dirt',5];if(this.minerPhase==='exit')return ['miner',this.kFrame];return ['dirt',Math.floor(now/100)%5];}
  if(this.kAction==='floor')return ['punch2',Math.min(6,2+this.kFrame*2)];
  if(this.kAction==='headbutt')return this.kFrame<3?['headbuttStart',this.kFrame]:this.kFrame<5?['headbutt',this.kFrame-3]:['headbuttRecovery',this.kFrame-5];
  if(this.kAction==='charged')return ['charged',0];
  if(this.kAction==='mega')return ['mega',this.kFrame%3];
  if(this.kAction==='grab2')return this.grabTarget?['grabHold',this.kFrame<6?0:1]:['grab2',Math.min(3,Math.floor(this.kFrame/2))];
  if(this.kAction)return [this.kAction,this.kFrame];
  if(this.glide){if(this.glideAttack)return ['glide',4+Math.min(1,Math.floor((now-this.kAnimStart)/90))];const e=now-this.kAnimStart;if(e<120)return ['glide',Math.min(1,Math.floor(e/60))];return ['glide',2+Math.floor(e/100)%2];}
  if(this.wallClingK)return ['wall',this.wallAnimStep%2];
  if(this.isSpinDashActive||this.isSpinning)return ['spin',this.spinAnimFrame%4];
  if(this.isDashing){const e=now-this.kAnimStart;if(e<70)return ['dash',0];return ['dash',1+Math.floor((e-70)/70)%6];}
  if(now<this.hitUntil||this.isVulnerable||this.wasInAirFromKnockback)return ['hit',Math.floor(now/80)%3];
  if(!this.isGrounded){if(this.vy<0)return ['jump',this.vy<-5?Math.floor(now/90)%2:2+Math.floor(now/90)%3];return ['fall',Math.min(2,Math.floor(now/90)%3)];}
  if(this.guardFlashUntil>now)return ['guard',Math.floor((this.guardFlashUntil-now)/55)%3];
  if(Math.abs(this.vx)>.1){const away=this.walkReverse;const cycle=away?3000:1000;const e=now-this.runStart;if(e<cycle/9)return ['run',0];return ['run',1+Math.floor((e-cycle/9)/(cycle*8/9/8))%8];}
  if(this.health<=this.maxHealth*.3)return ['idleHurt',Math.floor(now/(1500/8))%8];return ['idle',Math.floor(now/(1000/8))%8];
 }
 _frame(){const [key,f]=this._anim(),s=S[key];if(!s?.img.complete||!s.img.naturalWidth)return null;const scale=this.height/48,dw=s.w*scale,dh=s.h*scale;let flip=this.facingDirection<0; // hojas normales miran derecha
  if(s.frames){
   const [sx,right,body]=s.frames[f]??s.frames[0];
   const sw=right-sx,anchor=body-sx;
   return {img:s.img,sx,sy:0,sw,sh:s.h,dx:this.x+this.width/2-(flip?sw-anchor:anchor)*scale,
    dy:this.y+this.height-s.feet*scale,dw:sw*scale,dh:s.h*scale,flipX:flip,key,frame:f};
  }
  if(key==='wall'){const left=this.wallSideK?this.wallSideK==='left':this.x<=HIGHWAY_WALLS[0].x+1;flip=!left;const contact=12*scale;const wall=left?HIGHWAY_WALLS[0].x:HIGHWAY_WALLS[1].x;const dx=left?wall-contact:wall-(dw-contact);return {img:s.img,sx:f*s.w,sy:0,sw:s.w,sh:s.h,dx,dy:this.y+this.height-dh,dw,dh,flipX:flip,key,frame:f};}
  if(key==='dirt'){return {img:s.img,sx:f*s.w,sy:0,sw:s.w,sh:s.h,dx:this.x+this.width/2-dw/2,dy:this.feetY-dh/2,dw,dh,flipX:false,key,frame:f};}
  return {img:s.img,sx:f*s.w,sy:0,sw:s.w,sh:s.h,dx:this.x+this.width/2-dw/2,dy:this.y+this.height-dh,dw,dh,flipX:flip,key,frame:f};}
 getPixelBodyFrame(){if(this.minerPhase==='under'||this.minerPhase==='warning')return null;return this._frame();}
 pixelBodyIntersectsRect(r){const f=this.getPixelBodyFrame();return f?opaqueRegionInRect(f,{x:0,y:0,w:1,h:1},r,1):false;}

 tryHit(receiver){
  if(!receiver)return;
  const now=combatNow();
  for(const wave of this.fistWaves??[]){
   if(now<wave.at)continue;
   const rect={x:wave.x+(wave.dir<0?-205:0),y:wave.y,w:205,h:190};
   if(receiver.pixelBodyIntersectsRect ? !receiver.pixelBodyIntersectsRect(rect) :
      rect.x>=receiver.x+receiver.width||rect.x+rect.w<=receiver.x||
      rect.y>=receiver.y+receiver.height||rect.y+rect.h<=receiver.y)continue;
   const frame=Math.floor((now-wave.at)/95)%4;
   const hit=wave.hits.get(receiver)??{counts:[0,0,0,0],at:-Infinity};
   if(hit.counts[frame]>=2||now-hit.at<46)continue;
   hit.counts[frame]++;hit.at=now;
   dealDamage(receiver,12,{attacker:this,attackName:'Megapuños',impactX:wave.x,hitRect:rect,ignoreGuard:this.fistGuardUsed.has(receiver)});
   if(receiver.lastGuardImpact?.blocked){this.fistGuardUsed.add(receiver);this.breakSpecialGuard(receiver,now);}
   wave.hits.set(receiver,hit);
  }
  const key=this.kAction;
  if(key==='grab2'){
   if(!this.kHit && !this.grabTarget && !receiver.isVulnerable &&
      Math.abs(receiver.x+receiver.width/2-this.x-this.width/2)<this.width*.8 &&
      Math.abs(receiver.y+receiver.height-this.y-this.height)<55){
    this.grabTarget=receiver;receiver.isVulnerable=true;receiver.vulnerableTimer=120;
   }
   if(this.grabTarget===receiver){
    receiver.x=this.x+this.width/2+this.facingDirection*this.width*.52-receiver.width/2;
    receiver.y=this.y;receiver.vx=0;receiver.vy=0;
    if(this.kFrame>=7){
     this.kHit=true;this.grabTarget=null;receiver.isVulnerable=false;
     if(dealDamage(receiver,16,{attacker:this,attackName:'Segundo agarre',ignoreGuard:true})>0){
      receiver.vx=this.facingDirection*12;receiver.vy=-9;receiver.isGrounded=false;
      receiver.wasInAirFromKnockback=true;receiver.knockbackAirTimer=0;
     }
    }
   }
   return;
  }
  const spec={airPunch:[1,2,1.2,12,'Puño con brinco'],headbutt:[3,4,1.1,13,'Cabezazo'],lowPunish:[2,5,1.25,14,'Castigo de guardia baja'],
   autoCounter:[1,3,1.25,14,'Contraataque'],charged:[2,3,1.7,17,'Golpe cargado'],
   last:[1,2,1.55,22,'Último equidna'],ken:[1,3,1.15,14,'Puño ascendente']}[key];
  if(spec&&!this.kHit){
   const [start,end,reach,damage,name]=spec;
   const dx=(receiver.x+receiver.width/2-this.x-this.width/2)*this.facingDirection;
   const dy=Math.abs(receiver.y+receiver.height-this.y-this.height);
   if(this.kFrame>=start&&this.kFrame<=end&&dx>=-12&&dx<this.width*reach&&dy<88){
    this.kHit=true;
    const dealt=dealDamage(receiver,damage,{attacker:this,attackName:name,impactX:this.x+this.width/2,
     ignoreGuard:['grab2','lowPunish','autoCounter'].includes(key)});
    if(key==='last'&&(receiver.lastGuardImpact?.blocked||receiver.lastGuardImpact?.broken))this.breakSpecialGuard(receiver,now);
    if(dealt>0&&!receiver.lastGuardImpact?.blocked&&['grab2','lowPunish','ken'].includes(key)){
     receiver.vy=-11;receiver.isGrounded=false;receiver.wasInAirFromKnockback=true;
     receiver.knockbackAirTimer=0;
     if(key==='grab2')receiver.vx=this.facingDirection*12;
    }
   }
  }
  if(this.kAction==='grab'){
   const my=this._frame(); const body=typeof receiver.getPixelBodyFrame==='function'?receiver.getPixelBodyFrame(this.x):null;
   if(!this.grabConnected && this.kFrame===3){
    const touch=body?opaqueFramesOverlap(my,body,null,2):Math.abs((receiver.x+receiver.width/2)-(this.x+this.width/2))<this.width*.75;
    if(touch){this.grabConnected=true;this.grabTarget=receiver;this.grabFacing=this.facingDirection||1;receiver.isVulnerable=true;receiver.vulnerableTimer=120;}
    else {this.kFrame=11;this.kAnimStart=combatNow()-11*85;}
   }
   if(this.grabConnected&&this.grabTarget===receiver){
    // Mientras dura la coreografia el rival queda pegado a Knuckles.
    // El lanzamiento ocurre UNA sola vez al final; despues no volvemos a poner vx/vy en cero.
    if(!this.grabThrown){
     // La victima cruza de lado varias veces durante la vuelta del agarre.
     const grabSides={3:1,4:-1,5:1,6:1,7:-1,8:-1,9:-1,10:-1,11:-1,12:-1,13:-1,14:-1};
     const side=grabSides[this.kFrame]??-1;
     receiver.x=this.x+this.width/2+this.grabFacing*side*this.width*.38-receiver.width/2;
     receiver.y=this.y; receiver.vx=0; receiver.vy=0; receiver.isGrounded=false;
     if(this.kFrame>=14){
      dealDamage(receiver,15,{attacker:this,attackName:'Agarre de Knuckles'});
      const throwVX=this._grabThrowVX(receiver);
      receiver.vx=-this.grabFacing*throwVX; receiver.vy=-9; receiver.isGrounded=false;
      receiver.wasInAirFromKnockback=true; receiver.knockbackAirTimer=0; receiver.isVulnerable=false;
      this.grabThrown=true; this.kHit=true;
     }
    }
   }
   return;
  }
  if(this.kHit)return;
  const body=typeof receiver.getPixelBodyFrame==='function'?receiver.getPixelBodyFrame(this.x):null;const rf=body||{dx:receiver.x,dy:receiver.getCurrentY(),dw:receiver.width,dh:receiver.getCurrentHeight()};
  const dir=this.facingDirection||1;
  if(this.kAction==='punch'&&(this.kFrame===2||this.kFrame===3)){
   const a=this._frame();if(body?opaqueFramesOverlap(a,body,{x:36/48,y:12/48,w:12/48,h:8/48},1):opaqueRegionInRect(a,{x:36/48,y:12/48,w:12/48,h:8/48},rf,1)){dealDamage(receiver,9,{attacker:this,attackName:'Knuckles Punch',impactX:this.x+this.width/2});if(!receiver.lastGuardImpact?.front)receiver.vx=dir*4;this.kHit=true;}
  }
  if(this.kAction==='punch2'){
   if(this.kFrame===0&&Math.abs((receiver.x+receiver.width/2)-(this.x+this.width/2))<this.width*.8){dealDamage(receiver,3,{attacker:this,attackName:'Punch 2 inicial',impactX:this.x+this.width/2});this.kHit=true;}
   if(this.kFrame===2&&!this.kHit&&Math.abs((receiver.x+receiver.width/2)-(this.x+this.width/2))<this.width){
    if(receiver.isGuarding&&receiver.guardType==='high'){
    dealDamage(receiver,18,{attacker:this,attackName:'Punch 2 martillo',guardMultiplier:.15,impactX:this.x+this.width/2});
     if(receiver.lastGuardImpact?.blocked){this.kFrame=4;this.kAnimStart=combatNow()-4*105;this.kHit=true;return;}
    }else{
     const lowGuardBreak=receiver.isGuarding&&receiver.guardType==='low';
     dealDamage(receiver,lowGuardBreak?16:18,{attacker:this,attackName:'Punch 2 martillo',ignoreGuard:lowGuardBreak});
    }
    if(!receiver.lastGuardImpact?.front){receiver.vy=-5;receiver.isGrounded=false;receiver.wasInAirFromKnockback=true;receiver.knockbackAirTimer=0;}this.kHit=true;
   }
  }
  if(this.kAction==='upper'&&this.kFrame>=3&&this.kFrame<=4&&Math.abs(receiver.x-this.x)<this.width){dealDamage(receiver,14,{attacker:this,attackName:'Knuckles Upper',impactX:this.x+this.width/2});if(!receiver.lastGuardImpact?.front){receiver.vx=dir*5;receiver.vy=-11;receiver.isGrounded=false;receiver.wasInAirFromKnockback=true;receiver.knockbackAirTimer=0;}this.kHit=true;}
  if(this.kAction==='floor'&&this.kFrame===2){const d=Math.abs((receiver.x+receiver.width/2)-(this.x+this.width/2));if(receiver.isGrounded&&d<=260){if(d<=20){dealDamage(receiver,18,{attacker:this,attackName:'Golpe al suelo muy cerca',impactX:this.x+this.width/2});if(!receiver.lastGuardImpact?.front){receiver.vy=-10;receiver.isGrounded=false;receiver.wasInAirFromKnockback=true;}}else if(d<=120){dealDamage(receiver,10,{attacker:this,attackName:'Onda de suelo',impactX:this.x+this.width/2});if(!receiver.lastGuardImpact?.front)receiver.vx=-Math.sign(receiver.x-this.x)*5;}else if(!receiver.isGuarding)dealDamage(receiver,4,{attacker:this,attackName:'Onda lejana',impactX:this.x+this.width/2});this.kHit=true;}}
  if(this.glide&&this.glideAttack&&combatNow()-this.kAnimStart<180&&Math.abs(receiver.x-this.x)<this.width){dealDamage(receiver,11,{attacker:this,attackName:'Glide Punch',impactX:this.x+this.width/2});if(!receiver.lastGuardImpact?.front){receiver.vx=this.glideDir*12;receiver.vy=-4;receiver.isGrounded=false;receiver.wasInAirFromKnockback=true;receiver.knockbackAirTimer=0;}this.kHit=true;}
  if(this.minerPhase==='exit'&&this.kFrame>=10&&this.kFrame<=16&&Math.abs((receiver.x+receiver.width/2)-(this.x+this.width/2))<this.width*.75){const dmg=Math.round(10+18*this.minerCharge);dealDamage(receiver,dmg,{attacker:this,attackName:'Spin Minero',impactX:this.x+this.width/2});if(!receiver.lastGuardImpact?.front){receiver.vy=-12;receiver.vx=dir*7;receiver.isGrounded=false;receiver.wasInAirFromKnockback=true;receiver.knockbackAirTimer=0;}this.vy=-9;this.isGrounded=false;this.wasInAirFromKnockback=true;this.knockbackAirTimer=0;this.kHit=true;}
 }
 breakSpecialGuard(receiver,now){
  receiver.guardDamage=0;receiver.shieldMeleePressure=0;
  receiver.isGuarding=false;receiver.guardType=null;
  receiver.guardBrokenUntil=Math.max(receiver.guardBrokenUntil??0,now+650);
 }
 drawMoveEffect(key,frame,x,y,w,h,dir){
  const s=S[key];if(!s.img.complete||!s.img.naturalWidth)return;
  ctx.save();ctx.imageSmoothingEnabled=false;
  ctx.translate(x-game.cameraX,y);ctx.scale(dir,1);
  const [sx,right]=s.frames[frame];
  ctx.drawImage(s.img,sx,0,right-sx,s.h,0,0,w,h);ctx.restore();
 }
 draw(opponentX){
  const now=combatNow();
  // Rastro de piedras: cada huella desaparece gradualmente en vez de cortarse de golpe.
  if(this.minerPhase==='under'&&S.dirt.img.complete){
   const scale=this.height/48,dw=64*scale,dh=32*scale;
   for(const p of this.dirtTrail){const age=now-p.t,alpha=clamp(1-age/520,0,0.72);if(alpha<=0)continue;ctx.save();ctx.globalAlpha=alpha;ctx.imageSmoothingEnabled=false;ctx.drawImage(S.dirt.img,p.frame*64,0,64,32,p.x-dw/2-game.cameraX,this.feetY-dh/2,dw,dh);ctx.restore();}
  }
  for(const wave of this.fistWaves??[])if(now>=wave.at)
   this.drawMoveEffect('fistWave',Math.floor((now-wave.at)/95)%4,wave.x,wave.y,205,190,wave.dir);
  if(this.kAction==='charged'&&this.kFrame>=1)
   this.drawMoveEffect('chargedFx',this.kFrame%4,this.x+this.width/2,this.y,138,85,this.facingDirection);
  const f=this._frame();if(!f)return super.draw(opponentX);
  ctx.save();ctx.imageSmoothingEnabled=false;const sx=f.dx-game.cameraX;
  if(f.flipX){ctx.translate(sx+f.dw,0);ctx.scale(-1,1);ctx.drawImage(f.img,f.sx,0,f.sw,f.sh,0,f.dy,f.dw,f.dh);}else ctx.drawImage(f.img,f.sx,0,f.sw,f.sh,sx,f.dy,f.dw,f.dh);ctx.restore();
  // Durante el hundimiento solo se dibuja la mitad inferior de las piedras para no tapar la cabeza/cara.
  if(this.minerPhase==='sink'&&S.dirt.img.complete){const scale=this.height/48,dw=64*scale,half=16*scale,fr=Math.floor(now/90)%5;ctx.save();ctx.globalAlpha=.62;ctx.imageSmoothingEnabled=false;ctx.drawImage(S.dirt.img,fr*64,16,64,16,this.x+this.width/2-dw/2-game.cameraX,this.feetY-half,dw,half);ctx.restore();}
 }
}
