import { configureCombatant, dealDamage } from './combat-system.js';
import { PrototypeFighter } from './prototype-fighter.js';
import { canvas, ctx, game } from './state.js';
import { opaqueFramesOverlap, opaqueRegionInRect } from './pixel-collision.js';

const load=(src)=>{const i=new Image();i.src=src;return i;};
const S={
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
 floor:{img:load('assets/images/knuckles_punch_floor.png'),n:3,w:48,h:48},
 upper:{img:load('assets/images/knuckles_upper.png'),n:9,w:48,h:48},
 grab:{img:load('assets/images/knuckles_agarre.png'),n:15,w:48,h:48},
 spin:{img:load('assets/images/knuckles_spin.png'),n:4,w:48,h:48},
 miner:{img:load('assets/images/knuckles_spin_minero.png'),n:18,w:48,h:48},
 dirt:{img:load('assets/images/piedras_de_suelo.png'),n:6,w:64,h:32},
 hit:{img:load('assets/images/knuckles_hit.png'),n:3,w:48,h:48},
 wall:{img:load('assets/images/knuckles_wall_cling.png'),n:2,w:48,h:48}
};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

export class Knuckles extends PrototypeFighter {
 constructor(x,y,controls){
  super(x,y,controls,{name:'KNUCKLES',color:'#d93b3b',spinProfile:'knuckles',speed:5.5});
  configureCombatant(this,'knuckles','KNUCKLES'); this.characterId='knuckles';
  this.kAnimStart=performance.now(); this.kAction=null; this.kFrame=0; this.kHit=false;
  this.runStart=0; this.wasMoving=false; this.guardFlashUntil=0; this.hitUntil=0;
  this.dirtTrail=[]; this.lastDirtTrailAt=0;
  this.glide=false; this.glideDir=1; this.glideAttack=false;
  this.minerPhase=null; this.minerStart=0; this.undergroundStart=0; this.minerCharge=0;
  this.grabTarget=null; this.grabFacing=1; this.grabConnected=false; this.grabThrown=false;
  this.wallClingK=false; this.wallSideK=null; this.wallAnchorX=0; this.wallAnimStep=0; this.wallLastStepAt=0; this.lastWallJumpPress=0;
 }
 isAttacking(){return !!this.kAction || this.glideAttack || super.isAttacking();}
 isBusy(){return !!this.kAction || this.glide || !!this.minerPhase || super.isBusy();}
 startAction(a){if(this.isIntroActive||this.kAction||this.minerPhase||this.glide)return false; this.kAction=a;this.kFrame=0;this.kHit=false;this.kAnimStart=performance.now();this.facingLocked=true;this.facingDirection=this.facingDirection||1;return true;}
 startPunch(){if(this.isGrounded)this.startAction('punch');}
 startPunch2(){if(this.isGrounded)this.startAction('punch2');}
 startFloorPunch(){if(this.isGrounded)this.startAction('floor');}
 startUpper(){if(this.isGrounded)this.startAction('upper');}
 startGrab(){if(this.isGrounded){this.grabThrown=false;this.startAction('grab');}}
 onDamageTaken(){this.hitUntil=performance.now()+260;}
 grabDrawInFront(){return this.kAction==='grab'&&this.grabConnected&&this.kFrame>=3&&this.kFrame<=10 ? (this.kFrame%2===0) : true;}
 _grabThrowVX(receiver){const d=clamp(receiver?.defenseMultiplier??1,0.80,1.30);const t=(d-0.80)/(1.30-0.80);const distance=canvas.width*(0.25+0.50*t);return distance/30;}
 startGlide(dir){if(this.isGrounded||this.airMobilityLocked||this.glide||this.minerPhase)return;this.glide=true;this.glideDir=dir||this.facingDirection||1;this.glideAttack=false;this.kAnimStart=performance.now();this.vy=0;this.facingLocked=true;this.facingDirection=this.glideDir;}
 attackFromGlide(){if(!this.glide||this.glideAttack)return;this.glideAttack=true;this.kAnimStart=performance.now();}
 startMiner(){
  if(!this.isGrounded||this.kAction||this.glide||this.minerPhase)return false;
  // El topo es su propio estado: no debe quedarse atrapado en crouch/spin normal.
  this.isCrouching=false; this.isSpinning=false; this.isSpinDashActive=false;
  this.minerPhase='spin'; this.minerStart=performance.now(); this.kAnimStart=this.minerStart;
  this.minerCharge=0; this.kHit=false; this.vx=0; this.vy=0; this.facingLocked=true;
  return true;
 }
 _attachWall(side){
  if(this.airMobilityLocked)return;
  this.wallClingK=true; this.wallSideK=side; this.vx=0; this.vy=0; this.isGrounded=false;
  this.wallAnchorX=side==='left'?226:2368-this.width;
  this.x=this.wallAnchorX; this.wallLastStepAt=performance.now();
 }
 releaseWall(){
  if(!this.wallClingK)return;
  const side=this.wallSideK; this.wallClingK=false; this.wallSideK=null;
  this.vx=side==='left'?5:-5;
 }
 wallJumpPress(){ if(!this.wallClingK)return false; const n=performance.now(); if(n-this.lastWallJumpPress<320){this.releaseWall();this.lastWallJumpPress=0;return true;} this.lastWallJumpPress=n; return false; }

 _actionTiming(){return {punch:[6,70],punch2:[7,105],floor:[3,85],upper:[9,70],grab:[15,85]}[this.kAction]||[1,100];}
 update(opponentX,self){
  const now=performance.now(); const preGround=this.isGrounded;
  const specialXBefore=this.x, specialYBefore=this.y;
  super.update(opponentX,self);
  if(!this.facingLocked) this.facingDirection=opponentX>this.x?1:-1;
  if(this.kAction){const [n,ms]=this._actionTiming();this.vx=0;this.kFrame=Math.min(n-1,Math.floor((now-this.kAnimStart)/ms));if(now-this.kAnimStart>=n*ms){this.kAction=null;this.kFrame=0;this.kHit=false;this.grabTarget=null;this.grabConnected=false;this.grabThrown=false;this.facingLocked=false;}}
  // Planeo v2: un poco mas rapido horizontalmente y bastante mas sustentado.
  // Recorre el ancho jugable en ~3.5 s y pierde ~1/3 de la altura jugable en ese trayecto.
  if(this.airMobilityLocked){this.glide=false;this.glideAttack=false;this.wallClingK=false;this.wallSideK=null;}
  if(this.glide){
   const playableW=2368-226-this.width, playableH=this.feetY;
   const sx=playableW/3.5/60, sy=(playableH/3)/3.5/60;
   // super.update() ya consumio el frame. Aplicamos aqui el desplazamiento real del planeo
   // para que el movimiento generico no borre vx antes de mover a Knuckles.
   this.facingLocked=true; this.facingDirection=this.glideDir;
   const attackBoost=this.glideAttack?1.45:1;
   this.x=specialXBefore+this.glideDir*sx*attackBoost; this.y=specialYBefore+sy; this.vx=this.glideDir*sx*attackBoost; this.vy=0; this.isGrounded=false;
   this.x=clamp(this.x,226,2368-this.width);
   if(this.glideAttack && now-this.kAnimStart>180){this.glide=false;this.glideAttack=false;this.facingLocked=false;}
   if(this.y+this.height>=this.feetY){this.y=this.feetY-this.height;this.glide=false;this.glideAttack=false;this.facingLocked=false;}
  }
  // Topo: 0.8 s spin castigable + 0.4 s hundimiento pixel-perfect.
  if(this.minerPhase){
   const e=now-this.minerStart;
   if(this.minerPhase==='spin' && e>=800){this.minerPhase='sink';this.minerStart=now;}
   else if(this.minerPhase==='sink' && e>=400){this.minerPhase='under';this.undergroundStart=now;this.minerStart=now;this.y=this.feetY-this.height;}
   else if(this.minerPhase==='under'){
    const u=now-this.undergroundStart; this.minerCharge=clamp(u/4000,0,1); this.vy=0; this.y=this.feetY-this.height;
    const left=this.keys[this.controls.left],right=this.keys[this.controls.right];
    const move=(left?-this.speed:0)+(right?this.speed:0);
    // Movimiento subterraneo directo: el movimiento generico se ejecuta antes y borraba vx.
    this.x=clamp(this.x+move,226,2368-this.width); this.vx=0;
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
  const atLeft=this.x<=226.5, atRight=this.x+this.width>=2367.5;
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
 beginMinerExit(){if(this.minerPhase!=='under')return;this.minerPhase='warning';this.minerStart=performance.now();this.vx=0;}

 _anim(){const now=performance.now();
  if(this.minerPhase){if(this.minerPhase==='spin')return ['miner',Math.min(3,Math.floor((now-this.minerStart)/(800/4)))];if(this.minerPhase==='sink')return ['miner',4+Math.min(5,Math.floor((now-this.minerStart)/(400/6)))];if(this.minerPhase==='warning')return ['dirt',5];if(this.minerPhase==='exit')return ['miner',this.kFrame];return ['dirt',Math.floor(now/100)%5];}
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
  if(key==='wall'){const left=this.wallSideK?this.wallSideK==='left':this.x<=227;flip=!left;const contact=12*scale;const wall=left?226:2368;const dx=left?wall-contact:wall-(dw-contact);return {img:s.img,sx:f*s.w,sy:0,sw:s.w,sh:s.h,dx,dy:this.y+this.height-dh,dw,dh,flipX:flip,key,frame:f};}
  if(key==='dirt'){return {img:s.img,sx:f*s.w,sy:0,sw:s.w,sh:s.h,dx:this.x+this.width/2-dw/2,dy:this.feetY-dh/2,dw,dh,flipX:false,key,frame:f};}
  return {img:s.img,sx:f*s.w,sy:0,sw:s.w,sh:s.h,dx:this.x+this.width/2-dw/2,dy:this.y+this.height-dh,dw,dh,flipX:flip,key,frame:f};}
 getPixelBodyFrame(){if(this.minerPhase==='under'||this.minerPhase==='warning')return null;return this._frame();}
 pixelBodyIntersectsRect(r){const f=this.getPixelBodyFrame();return f?opaqueRegionInRect(f,{x:0,y:0,w:1,h:1},r,1):false;}

 tryHit(receiver){
  if(!receiver)return;
  if(this.kAction==='grab'){
   const my=this._frame(); const body=typeof receiver.getPixelBodyFrame==='function'?receiver.getPixelBodyFrame(this.x):null;
   if(!this.grabConnected && this.kFrame===3){
    const touch=body?opaqueFramesOverlap(my,body,null,2):Math.abs((receiver.x+receiver.width/2)-(this.x+this.width/2))<this.width*.75;
    if(touch){this.grabConnected=true;this.grabTarget=receiver;this.grabFacing=this.facingDirection||1;receiver.isVulnerable=true;receiver.vulnerableTimer=120;}
    else {this.kFrame=11;this.kAnimStart=performance.now()-11*85;}
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
   const a=this._frame();if(body?opaqueFramesOverlap(a,body,{x:36/48,y:12/48,w:12/48,h:8/48},1):opaqueRegionInRect(a,{x:36/48,y:12/48,w:12/48,h:8/48},rf,1)){dealDamage(receiver,9,{attacker:this,attackName:'Knuckles Punch'});receiver.vx=dir*4;this.kHit=true;}
  }
  if(this.kAction==='punch2'){
   if(this.kFrame===0&&Math.abs((receiver.x+receiver.width/2)-(this.x+this.width/2))<this.width*.8){dealDamage(receiver,3,{attacker:this,attackName:'Punch 2 inicial'});this.kHit=true;}
   if(this.kFrame===2&&!this.kHit&&Math.abs((receiver.x+receiver.width/2)-(this.x+this.width/2))<this.width){
    if(receiver.isGuarding&&receiver.guardType==='high'){receiver.guardFlashUntil=performance.now()+180;this.kFrame=4;this.kAnimStart=performance.now()-4*105;this.kHit=true;return;}
    const dmg=receiver.isGuarding&&receiver.guardType==='low'?16:18;dealDamage(receiver,dmg,{attacker:this,attackName:'Punch 2 martillo'});receiver.vy=-5;receiver.isGrounded=false;receiver.wasInAirFromKnockback=true;receiver.knockbackAirTimer=0;this.kHit=true;
   }
  }
  if(this.kAction==='upper'&&this.kFrame>=3&&this.kFrame<=4&&Math.abs(receiver.x-this.x)<this.width){dealDamage(receiver,14,{attacker:this,attackName:'Knuckles Upper'});receiver.vx=dir*5;receiver.vy=-11;receiver.isGrounded=false;receiver.wasInAirFromKnockback=true;receiver.knockbackAirTimer=0;this.kHit=true;}
  if(this.kAction==='floor'&&this.kFrame===2){const d=Math.abs((receiver.x+receiver.width/2)-(this.x+this.width/2));if(receiver.isGrounded&&d<=260){if(d<=20){dealDamage(receiver,18,{attacker:this,attackName:'Golpe al suelo muy cerca'});receiver.isGuarding=false;receiver.guardType=null;receiver.vy=-10;receiver.isGrounded=false;receiver.wasInAirFromKnockback=true;}else if(d<=120){dealDamage(receiver,10,{attacker:this,attackName:'Onda de suelo'});receiver.vx=-Math.sign(receiver.x-this.x)*5;}else if(!receiver.isGuarding)dealDamage(receiver,4,{attacker:this,attackName:'Onda lejana'});this.kHit=true;}}
  if(this.glide&&this.glideAttack&&performance.now()-this.kAnimStart<180&&Math.abs(receiver.x-this.x)<this.width){dealDamage(receiver,11,{attacker:this,attackName:'Glide Punch'});receiver.vx=this.glideDir*12;receiver.vy=-4;receiver.isGrounded=false;receiver.wasInAirFromKnockback=true;receiver.knockbackAirTimer=0;this.kHit=true;}
  if(this.minerPhase==='exit'&&this.kFrame>=10&&this.kFrame<=16&&Math.abs((receiver.x+receiver.width/2)-(this.x+this.width/2))<this.width*.75){const dmg=Math.round(10+18*this.minerCharge);dealDamage(receiver,dmg,{attacker:this,attackName:'Spin Minero'});receiver.vy=-12;receiver.vx=dir*7;receiver.isGrounded=false;receiver.wasInAirFromKnockback=true;receiver.knockbackAirTimer=0;this.vy=-9;this.isGrounded=false;this.wasInAirFromKnockback=true;this.knockbackAirTimer=0;this.kHit=true;}
 }
 draw(opponentX){
  const now=performance.now();
  // Rastro de piedras: cada huella desaparece gradualmente en vez de cortarse de golpe.
  if(this.minerPhase==='under'&&S.dirt.img.complete){
   const scale=this.height/48,dw=64*scale,dh=32*scale;
   for(const p of this.dirtTrail){const age=now-p.t,alpha=clamp(1-age/520,0,0.72);if(alpha<=0)continue;ctx.save();ctx.globalAlpha=alpha;ctx.imageSmoothingEnabled=false;ctx.drawImage(S.dirt.img,p.frame*64,0,64,32,p.x-dw/2-game.cameraX,this.feetY-dh/2,dw,dh);ctx.restore();}
  }
  const f=this._frame();if(!f)return super.draw(opponentX);
  ctx.save();ctx.imageSmoothingEnabled=false;const sx=f.dx-game.cameraX;
  if(f.flipX){ctx.translate(sx+f.dw,0);ctx.scale(-1,1);ctx.drawImage(f.img,f.sx,0,f.sw,f.sh,0,f.dy,f.dw,f.dh);}else ctx.drawImage(f.img,f.sx,0,f.sw,f.sh,sx,f.dy,f.dw,f.dh);ctx.restore();
  // Durante el hundimiento solo se dibuja la mitad inferior de las piedras para no tapar la cabeza/cara.
  if(this.minerPhase==='sink'&&S.dirt.img.complete){const scale=this.height/48,dw=64*scale,half=16*scale,fr=Math.floor(now/90)%5;ctx.save();ctx.globalAlpha=.62;ctx.imageSmoothingEnabled=false;ctx.drawImage(S.dirt.img,fr*64,16,64,16,this.x+this.width/2-dw/2-game.cameraX,this.feetY-half,dw,half);ctx.restore();}
 }
}
