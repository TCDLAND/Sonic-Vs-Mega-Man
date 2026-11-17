import { configureCombatant } from './combat-system.js';
import { PrototypeFighter } from './prototype-fighter.js';
import { ctx, game } from './state.js';
import { worldWidth } from './config.js';
import { opaqueFramesOverlap, opaqueRegionInRect, opaqueInRect } from './pixel-collision.js';
import { dealDamage } from './combat-system.js';

// Hojas Sonic Battle: ocho celdas de 49 px; alturas independientes.
// Numeracion de frames 1..8 como en la bitacora del usuario.
const images = Array.from({length:31}, (_,i) => {
  const img = new Image();
  img.src = `assets/images/shadow/${i === 0 ? 'Shadow1' : 'shadow'+(i+1)}.png`;
  return img;
});
const frames = (sheet, first, last, pivot=3) =>
  Array.from({length:last-first+1}, (_,i)=>({sheet, frame:first+i, pivot}));
const join = (...chunks) => chunks.flat();
const repeat = (chunk, times) => Array.from({length:times},()=>chunk).flat();
const chaosBody = new Image(); chaosBody.src='assets/images/shadow/chaoscontrolshadow.png';
const chaosEffect = new Image(); chaosEffect.src='assets/images/shadow/chaoscontroleffect.png';
const magicImage=new Image();magicImage.src='assets/images/shadow/chaosmagic.png';
const idleImage=new Image();idleImage.src='assets/images/shadow/Shadow_Idle.png';
const guardImage=new Image();guardImage.src='assets/images/shadow/shadow_guard.png';
const upperHitImage=new Image();upperHitImage.src='assets/images/shadow/shadow_upperhit.png';
const rocketImage=new Image();rocketImage.src='assets/images/shadow/shadow_rocket.png';
const roamingGround=new Image();roamingGround.src='assets/images/shadow/Roamingchaosnormal.png';
const roamingAir=new Image();roamingAir.src='assets/images/shadow/Roamingchaosair.png';
const roamingOrb=new Image();roamingOrb.src='assets/images/shadow/Roamingchaosproyectil.png';
const superCache=new WeakMap();
function superImage(img){
 if(!img?.complete||!img.naturalWidth)return img;
 if(superCache.has(img))return superCache.get(img);
 const c=document.createElement('canvas');c.width=img.naturalWidth;c.height=img.naturalHeight;const cx=c.getContext('2d',{willReadFrequently:true});cx.drawImage(img,0,0);
 const pixels=cx.getImageData(0,0,c.width,c.height),d=pixels.data;
 for(let i=0;i<d.length;i+=4){if(d[i+3]<15)continue;const r=d[i],g=d[i+1],b=d[i+2];
 // Conservar rojo, blanco, piel, ojos y contornos. Recolorear grises oscuros azulados y paleta de desvanecimiento.
 const faded=(b>r*1.17&&b>g*1.08&&r<160);const dark=(Math.max(r,g,b)<105&&b>=r*.85&&b>=g*.85);
 if(!faded&&!dark)continue;const lum=Math.max(r,g,b);let rgb=lum<48?[132,116,83]:lum<95?[181,161,111]:lum<145?[216,200,144]:[248,232,176];
 if(faded&&lum<110)rgb=[168,151,110];d[i]=rgb[0];d[i+1]=rgb[1];d[i+2]=rgb[2];
 }cx.putImageData(pixels,0,0);superCache.set(img,c);return c;
}
const CHOP_COLORS=['#F88808','#F8D800','#D02000'];

// Cada secuencia es una lista de frames de distintas hojas, sin suponer
// que el cambio de PNG termina la animacion.
export const SHADOW_ANIMATIONS = {
  idle: frames(1,1,6),
  runStart: frames(1,7,8),
  run: join(frames(2,1,8),frames(3,1,8),frames(4,1,8)),
  runEnd: frames(5,1,4),
  stopping: join(frames(5,5,8,6),frames(6,1,7,4)),
  dash: join(frames(6,8,8,4),frames(7,1,4)),
  turning: join(frames(7,5,8),frames(8,1,5,4)),
  falling: join(frames(8,6,8,0),frames(9,1,2,0)),
  jumping: frames(9,3,8,0),
  landing: frames(10,1,3),
  teleport: frames(10,4,8),
  teleportAppear: frames(20,5,8).reverse(),
  chop: frames(11,1,6),
  kick: join(frames(11,7,8),frames(12,1,6)),
  backKick: join(frames(12,7,8),frames(13,1,7)),
  nightmare: join(frames(13,8,8),frames(14,1,3)),
  upper: join(frames(16,5,8),frames(17,1,8),frames(18,1,1)),
  slider: join(frames(18,2,8),frames(19,1,8,2),frames(20,1,4)),
  toward: join(frames(20,5,8),frames(21,1,1)),
  rocket: join(frames(21,3,7,4),frames(21,8,8,2),frames(22,1,1,4)),
  chaosMagic: join(frames(22,2,5,2),frames(22,6,8),frames(23,1,4)),
  airMagic: join(frames(23,5,8,0),frames(24,1,3,0),frames(24,4,5,0).map(f=>({...f,offset:-4}))),
  burst: join(frames(24,6,8,9),frames(25,1,8,5),frames(26,1,8,5),frames(27,1,5,5)),
  // Orden cronologico corregido: desaparicion antes de reaparicion.
  airBurst: join(frames(28,4,8,4),frames(29,1,3,4),frames(27,6,8,5),frames(28,1,3,4)),
  roaming: join(frames(29,4,8),frames(30,1,4)),
  airRoaming: join(frames(30,5,8),frames(31,1,3)),
  hurt: frames(31,4,6)
};

export class Shadow extends PrototypeFighter {
  constructor(x,y,controls) {
    super(x,y,controls,{name:'SHADOW',color:'#2b2b2b',spinProfile:'shadow',speed:7.5});
    configureCombatant(this,'shadow','SHADOW');
    this.shadowAnimation = 'idle';
    this.shadowAnimTick = 0;
    this.shadowPrevGrounded = true;
    this.shadowLandingTicks = 0;
    this.shadowStoppingTicks = 0;
    this.shadowPreviousVx = 0;
    this.shadowFacing = 1;
    this.jabDuration = 15;
    this.kickLightDuration = 17;
    this.shadowSpinImages = ['shadow_spin_charge.png','shadow_spin.png'].map(name => {
      const img = new Image(); img.src = `assets/images/shadow/${name}`; return img;
    });
    this.shadowSpecial = null;
    this.shadowSpecialTick = 0;
    this.shadowSpecialDuration = 0;
    this.brakeActive=false; this.reverseBrakeActive=false; this.brakeTimer=0; this.brakeTargetDirection=0;
    this.shadowCombo=null; this.shadowComboTick=0; this.shadowComboHit=false; this.shadowComboQueue=false;
    this.shadowTeleportPhase=null; this.shadowTeleportTick=0;
    this.chaosPhase=null; this.chaosTick=0; this.chaosRadius=0; this.chaosTarget=null;
    this.chaosDamage=0; this.chaosOriginalGravity=null;
    this.shadowAnimAt=performance.now();
    this.shadowRunStarted=false;this.shadowRunEndTicks=0;this.shadowRunEndPending=false;this.shadowRunStartTick=0;this.shadowRunLoopTick=0;this.shadowRunLastMoving=false;
    this.magicCharge=null;this.magicEffect=null;this.magicAnimTick=0;this.magicAftercast=0;
    this.guardHitUntil=0;this.upperHitTick=0;
    this.isSuperShadow=false;this.superTapAt=-10000;this.rocketActive=false;this.rocketTick=0;this.rocketHit=false;this.rocketDirection=1;this.roamingCast=null;this.roamingProjectile=null;

  }
  toggleSuperTap(){const now=performance.now();if(now-this.superTapAt<=300){this.isSuperShadow=!this.isSuperShadow;this.superTapAt=-10000;this.speed=this.isSuperShadow?8.6:7.5;}else this.superTapAt=now;}
  startRocket(){if(this.isGrounded||this.rocketActive||this.isVulnerable||this.isBusy())return;this.rocketActive=true;this.rocketTick=0;this.rocketHit=false;this.rocketDirection=this.facingDirection||1;this.vx=this.rocketDirection*10;this.vy=6;}
  startRoaming(){if(this.isVulnerable||this.isBusy()||this.roamingCast||this.roamingProjectile)return;this.roamingCast={tick:0,air:!this.isGrounded,spawned:false};}
  updateRoaming(receiver){
    if(this.roamingCast){const a=this.roamingCast;a.tick++;if(a.tick===10&&!a.spawned){a.spawned=true;this.roamingProjectile={x:Math.max(20,Math.min(worldWidth-40,this.x+this.width/2+(this.facingDirection||1)*440)),y:Math.max(20,this.getCurrentY()-85),phase:'create',tick:0,hit:false};}if(a.tick>=32)this.roamingCast=null;}
    const o=this.roamingProjectile;if(!o)return;o.tick++;
    if(o.phase==='create'){if(o.tick>=6){o.phase='follow';o.tick=0;}}
    else if(o.phase==='follow'){const tx=this.x+this.width/2,ty=this.getCurrentY()+this.getCurrentHeight()/2;const dx=tx-o.x,dy=ty-o.y,dist=Math.hypot(dx,dy)||1;o.x+=dx/dist*2.3;o.y+=dy/dist*2.3;
      if(receiver&&Math.abs(o.x-(receiver.x+receiver.width/2))<receiver.width/2+20&&Math.abs(o.y-(receiver.getCurrentY()+receiver.getCurrentHeight()/2))<receiver.getCurrentHeight()/2+20){o.phase='impact';o.tick=0;dealDamage(receiver,12,{attacker:this,attackName:'Chaos Roaming'});}
      else if(dist<15){this.roamingProjectile=null;return;}
      for(const proj of [...(game.projectiles||[]),...(game.bassBullets||[])]){if(proj.active&&proj.owner!==this&&Math.abs((proj.x+(proj.width||0)/2)-o.x)<24&&Math.abs((proj.y+(proj.height||0)/2)-o.y)<24){proj.active=false;o.phase='impact';o.tick=0;break;}}
    }else if(o.phase==='impact'&&o.tick>=9)this.roamingProjectile=null;
  }
  drawRoaming(){const o=this.roamingProjectile;if(o&&roamingOrb.complete&&roamingOrb.naturalWidth){const frame=o.phase==='create'?Math.min(8,Math.floor(o.tick*9/6)):o.phase==='follow'?9+Math.floor(o.tick/4)%6:15+Math.min(8,o.tick);ctx.save();ctx.imageSmoothingEnabled=false;ctx.drawImage(roamingOrb,frame*48,0,48,48,o.x-72-game.cameraX,o.y-72,144,144);ctx.restore();}}
  // J: Chop -> Kick -> Back Kick. Ventanas activas en indices 1-based.
  startShadowChop() {
    if(this.shadowCombo){
      if(this.shadowCombo==='chop'||this.shadowCombo==='kick') this.shadowComboQueue=true;
      return;
    }
    if(!this.isGrounded||this.isBusy()||this.isIntroActive||this.chaosPhase==='windup')return;
    this.shadowCombo='chop'; this.shadowComboTick=0; this.shadowComboHit=false; this.shadowComboQueue=false;
  }
  startBrake(reverse=false){
    if(!this.isGrounded||this.isVulnerable||this.isSpinDashActive||this.chaosPhase==='windup'||this.shadowCombo)return;
    const incoming=Math.sign(this.vx||this.dashDirection||1);
    this.isDashing=false;this.dashFrame=0;this.dashTimer=0;this.dashDirection=0;
    this.vx=0;this.brakeActive=!reverse;this.reverseBrakeActive=reverse;
    this.brakeTimer=0;this.brakeTargetDirection=reverse?-incoming:0;
    this.shadowRunEndTicks=reverse?0:8;this.shadowRunStarted=false;this.shadowRunLastMoving=false;
  }
  startShadowTeleport(opponent){
    if(!this.isGrounded||this.isBusy()||this.shadowCombo||this.chaosPhase||!opponent)return;
    this.shadowTeleportPhase='out';this.shadowTeleportTick=0;this.shadowTeleportTarget=opponent;
    this.vx=0;this.vy=0;
  }
  startChaosNightmare(){
    if(this.isBusy()||this.shadowCombo||this.shadowTeleportPhase||this.chaosPhase||this.isIntroActive||this.isVulnerable)return;
    this.chaosPhase='windup';this.chaosTick=0;this.chaosRadius=0;
    this.chaosTarget=null;this.chaosDamage=0;this.vx=0;this.vy=0;
    this.chaosOriginalGravity=this.gravity;this.gravity=0;
  }
  isBusy(){return super.isBusy()||!!this.shadowCombo||this.chaosPhase==='windup'||!!this.shadowTeleportPhase||this.brakeActive||this.reverseBrakeActive||!!this.magicCharge||this.magicAftercast>0||this.rocketActive||!!this.roamingCast;}
  isAttacking(){return super.isAttacking()||!!this.shadowCombo||this.chaosPhase==='windup'||!!this.magicCharge||this.magicAftercast>0;}
  getShadowAttackFrame(){
    if(!this.shadowCombo)return 0;
    const len=SHADOW_ANIMATIONS[this.shadowCombo].length;
    return Math.min(len,Math.floor(this.shadowComboTick/3)+1);
  }
  advanceShadowCombo(){
    const current=this.shadowCombo;
    this.shadowCombo=current==='chop'?'kick':'backKick';
    this.shadowComboTick=0;this.shadowComboHit=false;this.shadowComboQueue=false;
  }
  getShadowDescriptor(name=this.pickShadowAnimation(), index=null){
    const seq=SHADOW_ANIMATIONS[name];if(!seq?.length)return null;
    if(index===null)index=this.getShadowFrameIndex(name);
    const f=seq[Math.min(seq.length-1,Math.max(0,index))],img=images[f.sheet-1];
    if(!img?.complete||!img.naturalWidth)return null;
    const scale=3, dw=49*scale,dh=img.naturalHeight*scale;
    const pivot=(f.pivot||0)*scale+(f.offset||0)*scale;
    return {img,sx:(f.frame-1)*49,sy:0,sw:49,sh:img.naturalHeight,
      dx:this.x+this.width/2-dw/2,dy:this.getCurrentY()+this.getCurrentHeight()-dh+pivot,
      dw,dh,flipX:(this.facingDirection||1)>0};
  }
  getPixelBodyFrame(){
    if(this.shadowTeleportPhase)return null;
    if(this.chaosPhase && this.chaosPhase==='windup' && this.chaosTick>=8){
      const f=this.getChaosFrame(chaosBody);if(f)return f;
    }
    if(this.rocketActive||this.roamingCast){const img=this.rocketActive?rocketImage:this.roamingCast.air?roamingAir:roamingGround;if(img.complete&&img.naturalWidth){const index=this.rocketActive?(this.rocketTick<15?Math.min(4,Math.floor(this.rocketTick/3)):5+Math.floor(this.rocketTick/4)%2):Math.min((this.roamingCast.air?7:9)-1,Math.floor(this.roamingCast.tick/3));return {img,sx:index*48,sy:0,sw:48,sh:48,dx:this.x+this.width/2-72,dy:this.getCurrentY()+this.getCurrentHeight()-135,dw:144,dh:144,flipX:(this.facingDirection||1)<0};}}
    const f=this.getShadowDescriptor();
    if(f && this.shadowCombo==='chop')f.excludeColors=CHOP_COLORS;
    return f;
  }
  pixelBodyIntersectsRect(rect){const f=this.getPixelBodyFrame();return f?opaqueInRect(f,rect,1):false;}
  getChaosFrame(img){
    if(!img.complete||!img.naturalWidth)return null;
    const frame=Math.min(16,Math.max(0,Math.floor((this.chaosTick-8)/2)));
    const sw=64,sh=48,dw=192,dh=144;
    return {img,sx:frame*sw,sy:0,sw,sh,dx:this.x+this.width/2-dw/2,
      dy:this.getCurrentY()+this.getCurrentHeight()-dh+12,dw,dh,flipX:(this.facingDirection||1)>0};
  }
  tryShadowComboHit(receiver){
    if(!this.shadowCombo||this.shadowComboHit||!receiver)return;
    const frame=this.getShadowAttackFrame();
    const active=this.shadowCombo==='chop'?[3,4]:this.shadowCombo==='kick'?[2,3,4,5]:[3,4,5];
    if(!active.includes(frame))return;
    const mine=this.getShadowDescriptor(this.shadowCombo,frame-1);
    if(!mine)return;
    const target=receiver.getPixelBodyFrame?.(this.x+this.width/2);
    // Los sprites originales miran a la izquierda: mitad frontal original = izquierda.
    const region=this.shadowCombo==='chop'?null:
      {x:0,y:0,w:.5,h:this.shadowCombo==='kick'?.5:1};
    if(this.shadowCombo==='chop')mine.includeColors=CHOP_COLORS;
    const hit=target?opaqueFramesOverlap(mine,target,region,1):
      opaqueRegionInRect(mine,region||{x:0,y:0,w:1,h:1},
        {x:receiver.x,y:receiver.getCurrentY(),w:receiver.width,h:receiver.getCurrentHeight()},1);
    if(!hit)return;
    this.shadowComboHit=true;
    const damage=this.shadowCombo==='chop'?5:this.shadowCombo==='kick'?6:9;
    const frozen=receiver.shadowFrozenBy===this;
    if(frozen && this.chaosDamage>=35)return;
    const connected=this.applyDamage(receiver,frozen?Math.min(damage,35-this.chaosDamage,Math.max(0,receiver.health-1)):damage,[],null);
    if(frozen){receiver.health=Math.max(1,receiver.health);receiver.isVulnerable=false;receiver.vulnerableTimer=0;receiver.vx=0;receiver.vy=0;}

    if(connected&&!frozen){
      if(this.shadowCombo==='kick'){
        receiver.vx=0;receiver.vy=-3;receiver.isGrounded=false;
        receiver.isVulnerable=true;receiver.vulnerableTimer=Math.max(receiver.vulnerableTimer||0,18);
      }else if(this.shadowCombo==='backKick'){
        receiver.vx=(this.facingDirection||1)*3;receiver.vy=-12;receiver.isGrounded=false;
      }
    }
  }
  tryRocketHit(receiver){if(!this.rocketActive||this.rocketHit||!receiver)return;const dx=(receiver.x+receiver.width/2)-(this.x+this.width/2);if(Math.abs(dx)>this.width*.85||Math.abs(receiver.getCurrentY()-this.getCurrentY())>this.getCurrentHeight()*.9)return;this.rocketHit=true;dealDamage(receiver,12,{attacker:this,attackName:'Shadow Rocket'});receiver.vx=this.rocketDirection*8;receiver.vy=-11;receiver.isGrounded=false;receiver.isVulnerable=true;receiver.vulnerableTimer=Math.max(receiver.vulnerableTimer||0,20);}
  updateChaos(receiver){
    if(!this.chaosPhase)return;
    this.chaosTick++;
    if(this.chaosPhase==='windup'){this.vx=0;
      this.vy=0;
      // 8 ticks de inicio, 34 ticks de los 17 cuadros sincronizados.
      if(this.chaosTick>=8){
        const progress=Math.min(1,(this.chaosTick-8)/34);
        this.chaosRadius=progress*850;
        if(receiver && !this.chaosTarget){
          const dx=(receiver.x+receiver.width/2)-(this.x+this.width/2);
          const dy=(receiver.getCurrentY()+receiver.getCurrentHeight()/2)-(this.getCurrentY()+this.getCurrentHeight()/2);
          const distance=Math.hypot(dx,dy);
          const blocking=receiver.isGrounded && receiver.isGuarding && Math.abs(receiver.vx)<.5;
          if(distance<=this.chaosRadius && !blocking){
            this.chaosTarget=receiver;this.chaosPhase='freeze';this.chaosTick=0;
            receiver.shadowFrozenBy=this;this.chaosDamage=0;
            // Termino la levitacion: devolver gravedad en cuanto comienza el tiempo detenido.
            if(this.chaosOriginalGravity!==null){this.gravity=this.chaosOriginalGravity;this.chaosOriginalGravity=null;}
          }
        }
      }
      if(this.chaosPhase==='windup'&&this.chaosTick>=42)this.endChaos();
    }else if(this.chaosPhase==='freeze'){
      // Durante el tiempo detenido Shadow puede moverse normalmente.
      if(this.chaosTick>=420)this.endChaos();
    }
  }
  endChaos(){
    const target=this.chaosTarget;
    if(target?.shadowFrozenBy===this){
      target.shadowFrozenBy=null;
      target.isVulnerable=true;target.vulnerableTimer=Math.max(target.vulnerableTimer||0,35);
      target.vx=(this.facingDirection||1)*(3+Math.min(35,this.chaosDamage)*0.35);target.vy=0;target.isGrounded=false;target.wasInAirFromKnockback=true;target.knockbackAirTimer=0;
    }
    this.chaosPhase=null;this.chaosTarget=null;this.chaosTick=0;this.chaosRadius=0;this.chaosStrikePending=false;
    if(this.chaosOriginalGravity!==null)this.gravity=this.chaosOriginalGravity;
    this.chaosOriginalGravity=null;
  }
  tryChaosHit(receiver){
    if(this.chaosPhase!=='freeze'||this.chaosTarget!==receiver||this.chaosDamage>=35)return;
    const distance=Math.abs((this.x+this.width/2)-(receiver.x+receiver.width/2));
    if(distance>this.width*.8)return;
    // Ataque de seguimiento con J: no se cobra daño automáticamente por acercarse.
    if(!this.chaosStrikePending)return;
    this.chaosStrikePending=false;
    const damage=Math.min(7,35-this.chaosDamage,Math.max(0,receiver.health-1));
    if(damage>0){dealDamage(receiver,damage,{attacker:this,attackName:'Chaos Control'});this.chaosDamage+=damage;}
  }
  chaosStrike(){if(this.chaosPhase==='freeze')this.chaosStrikePending=true;}
  drawChaosStorm(){
    if(this.chaosPhase!=='windup'||this.chaosTick<8)return;
    const {canvas}=ctx,centerX=this.x+this.width/2-game.cameraX,centerY=this.getCurrentY()+this.getCurrentHeight()/2;
    ctx.save();ctx.fillStyle='rgba(90,30,155,0.22)';
    ctx.beginPath();ctx.rect(0,0,canvas.width,canvas.height);
    ctx.moveTo(centerX+this.chaosRadius,centerY);ctx.arc(centerX,centerY,this.chaosRadius,0,Math.PI*2,true);ctx.fill('evenodd');
ctx.strokeStyle='#cba4ff';ctx.lineWidth=4;ctx.beginPath();ctx.arc(centerX,centerY,this.chaosRadius,0,Math.PI*2);ctx.stroke();ctx.restore();
  }
  startChaosMagic(){
    if(this.isBusy()||this.chaosPhase==='windup'||this.isVulnerable)return;
    const air=!this.isGrounded;
    this.magicCharge={ticks:0,air};this.magicChargeAir=air;this.magicAnimTick=0;
    this.vx=0;this.vy=0;
  }
  releaseChaosMagic(){
    if(!this.magicCharge)return;
    const {ticks,air}=this.magicCharge;
    const face=this.facingDirection||1;
    const rival=game.p1===this?game.p2:game.p1;
    const hw=rival?.width||this.width,hh=rival?.getCurrentHeight?.()||this.getCurrentHeight();
    const distance=air?2*hw:Math.min(3,1+Math.floor(ticks/35))*hw;
    const center=this.x+this.width/2+face*distance;
    const requestedBottom=air?this.getCurrentY()+this.getCurrentHeight()+2*hh:this.getCurrentY()+this.getCurrentHeight();
    // Si el efecto aereo quedaria enterrado, elevarlo hasta tocar el suelo.
    const bottom=air?Math.min(requestedBottom,this.feetY):requestedBottom;
    this.magicEffect={x:center,y:bottom,ticks:0,hit:false};
    this.magicCharge=null;this.magicAftercast=20;
  }
  updateMagicHit(receiver){
    const e=this.magicEffect;
    if(!e||e.hit||!receiver||e.ticks<8||e.ticks>80)return;
    const desc=this.getMagicDescriptor();
    const target=receiver.getPixelBodyFrame?.();
    if(!desc)return;
    const hit=target?opaqueFramesOverlap(desc,target,null,1):opaqueInRect(desc,{x:receiver.x,y:receiver.getCurrentY(),w:receiver.width,h:receiver.getCurrentHeight()},1);
    if(!hit)return;
    e.hit=true;
    const frozen=receiver.shadowFrozenBy===this;
    const damage=frozen?Math.min(12,35-this.chaosDamage,Math.max(0,receiver.health-1)):12;
    if(damage<=0)return;
    dealDamage(receiver,damage,{attacker:this,attackName:'Chaos Magic'});
    if(frozen){receiver.health=Math.max(1,receiver.health);receiver.vx=0;receiver.vy=0;receiver.isVulnerable=false;}
    else {receiver.vy=-7;receiver.isGrounded=false;receiver.isVulnerable=true;receiver.vulnerableTimer=Math.max(receiver.vulnerableTimer||0,20);}
  }
  getMagicDescriptor(){
    if(!this.magicEffect||!magicImage.complete||!magicImage.naturalWidth)return null;
    const e=this.magicEffect,frame=Math.min(11,Math.floor(e.ticks/10));
    return {img:magicImage,sx:frame*64,sy:0,sw:64,sh:64,dx:e.x-96,dy:e.y-192,dw:192,dh:192,flipX:false};
  }
  onDamageTaken(info){super.onDamageTaken?.(info);if(info?.damage>0){this.roamingProjectile=null;this.roamingCast=null;}if(this.vy<0||this.wasInAirFromKnockback)this.upperHitTick=18;}
  startChaosUpper() {
    if (!this.isGrounded || this.isBusy() || this.isIntroActive) return;
    this.startKickLight();
    if (this.isKickLightActive) this.beginShadowSpecial('upper', 30);
  }
  startShadowSlider() {
    if (!this.isGrounded || this.isBusy() || this.isIntroActive) return;
    this.startKickHeavy();
    if (this.isKickHeavyActive) {
      this.beginShadowSpecial('slider', 30);
      this.vx = (this.facingDirection || 1) * 10;
    }
  }
  beginShadowSpecial(name, duration) {
    this.shadowSpecial = name;
    this.shadowSpecialTick = 0;
    this.shadowSpecialDuration = duration;
  }
  update(opponentX,selfInstance){
    const grounded=this.isGrounded;
    const levitate=this.chaosPhase==='windup';
    const yBefore=this.y;
    super.update(opponentX,selfInstance);
    if(this.rocketActive){this.rocketTick++;this.vx=this.rocketDirection*10;this.vy=Math.max(9,this.vy);if(this.isGrounded){this.rocketActive=false;this.vx=0;this.shadowLandingTicks=9;}}
    this.updateRoaming(game.p1===this?game.p2:game.p1);
    if(levitate){this.y=yBefore;this.vy=0;this.vx=0;}
    if(this.shadowSpecial){this.shadowSpecialTick++;if(this.shadowSpecialTick>=this.shadowSpecialDuration||this.isVulnerable)this.shadowSpecial=null;}
    if(!grounded&&this.isGrounded)this.shadowLandingTicks=9;
    else if(this.shadowLandingTicks>0)this.shadowLandingTicks--;
    if(this.shadowRunEndTicks>0)this.shadowRunEndTicks--;
    if(this.brakeActive||this.reverseBrakeActive){
      if(this.shadowRunEndTicks>0){this.vx=0;}else this.brakeTimer++;this.vx=0;
      const duration=this.reverseBrakeActive?16:12;
      if(this.brakeTimer>=duration){const reverse=this.reverseBrakeActive;
        this.brakeActive=false;this.reverseBrakeActive=false;this.brakeTimer=0;
        this.vx=reverse?this.brakeTargetDirection*this.speed:0;}
    }
    if(this.shadowCombo){
      this.vx=0;this.shadowComboTick++;
      const duration=SHADOW_ANIMATIONS[this.shadowCombo].length*3;
      if(this.shadowComboTick>=duration){
        if(this.shadowComboQueue&&this.shadowCombo!=='backKick')this.advanceShadowCombo();
        else{this.shadowCombo=null;this.shadowComboQueue=false;}
      }
    }
    if(this.shadowTeleportPhase){
      this.vx=0;this.shadowTeleportTick++;
      if(this.shadowTeleportPhase==='out'&&this.shadowTeleportTick>=15){
        const rival=this.shadowTeleportTarget;
        if(rival){
          // Detras del rival: lado opuesto a donde mira, no lado fijo del mapa.
          const rivalFace=rival.facingDirection||1;
          const targetX=rivalFace>0?rival.x-this.width:rival.x+rival.width;
          this.x=Math.max(0,Math.min(worldWidth-this.width,targetX));
          this.facingDirection=rivalFace;
          this.y=Math.max(0,rival.getCurrentY()-rival.getCurrentHeight());
          this.isGrounded=false;this.vy=0;
        }
        this.shadowTeleportPhase='in';this.shadowTeleportTick=0;
      }else if(this.shadowTeleportPhase==='in'&&this.shadowTeleportTick>=12){
        this.shadowTeleportPhase=null;this.shadowTeleportTarget=null;
      }
    }
    this.updateChaos(game.p1===this?game.p2:game.p1);
    if(this.magicCharge){this.magicCharge.ticks=Math.min(180,this.magicCharge.ticks+1);this.magicAnimTick++;this.vx=0;this.vy=0;}
    if(this.magicAftercast>0)this.magicAftercast--;
    if(this.magicEffect){this.magicEffect.ticks++;if(this.magicEffect.ticks>=120)this.magicEffect=null;}
    if(this.upperHitTick>0)this.upperHitTick--;
    // Estados de carrera independientes del render: no reiniciar Run Start en cada draw.
    const moving=this.isGrounded && Math.abs(this.vx)>.35 && !this.brakeActive && !this.reverseBrakeActive && !this.isDashing && !this.shadowTeleportPhase && !this.shadowCombo && !this.isVulnerable && !this.magicCharge && !this.chaosPhase?.includes('windup');
    if(moving){
      if(!this.shadowRunLastMoving){this.shadowRunStartTick=0;this.shadowRunLoopTick=0;}
      else if(this.shadowRunStartTick<4)this.shadowRunStartTick++;
      else this.shadowRunLoopTick++;
    }else{this.shadowRunStartTick=0;this.shadowRunLoopTick=0;}
    this.shadowRunLastMoving=moving;
    this.shadowPrevGrounded=this.isGrounded;
  }
  getShadowFrameIndex(name){
    const seq=SHADOW_ANIMATIONS[name];if(!seq?.length)return 0;
    if(name==='run')return Math.floor(this.shadowRunLoopTick/1.375)%seq.length;
    if(name==='runStart')return Math.min(1,Math.floor(this.shadowRunStartTick/2));
    if(name==='runEnd')return Math.min(3,Math.floor((8-this.shadowRunEndTicks)/2));
    if(name==='chaosMagic'&&this.magicCharge)return Math.min(4,Math.floor(this.magicAnimTick/3));
    if(name==='airMagic'&&this.magicCharge)return Math.min(6,Math.floor(this.magicAnimTick/3));
    if((name==='chaosMagic'||name==='airMagic')&&this.magicAftercast>0)return Math.min(seq.length-1,Math.floor((20-this.magicAftercast)/2)+(name==='chaosMagic'?4:6));
    if(name==='stopping')return Math.min(seq.length-1,Math.floor(this.brakeTimer*seq.length/12));
    if(name==='turning')return Math.min(seq.length-1,Math.floor(this.brakeTimer*seq.length/16));
    if(name==='landing')return Math.min(2,Math.floor((9-this.shadowLandingTicks)/3));
    if(name==='chop'||name==='kick'||name==='backKick')return this.getShadowAttackFrame()-1;
    if(name==='teleport'||name==='teleportAppear')return Math.min(seq.length-1,Math.floor(this.shadowTeleportTick/3));
    const ticks=name==='idle'?9:name==='upper'?2:4;
    let i=Math.floor((this.shadowSpecial?this.shadowSpecialTick:this.shadowAnimTick)/ticks);
    return ['idle','dash','slider'].includes(name)?i%seq.length:Math.min(seq.length-1,i);
  }
  pickShadowAnimation() {
    if(this.rocketActive)return 'rocketNew';
    if(this.roamingCast)return this.roamingCast.air?'roamingNewAir':'roamingNewGround';
    if(this.magicCharge)return this.magicCharge.air?'airMagic':'chaosMagic';
    if(this.magicAftercast>0)return this.magicChargeAir?'airMagic':'chaosMagic';
    if(this.isVulnerable)return 'hurt';
    if (this.isSpinning) return 'spinCharge';
    if (this.isSpinDashActive) return 'spin';
    if (this.chaosPhase==='windup') return this.chaosTick<8?'nightmare':'chaosSheets';
    if (this.shadowTeleportPhase) return this.shadowTeleportPhase==='out'?'teleport':'teleportAppear';
    if (this.shadowCombo) return this.shadowCombo;
    if (this.shadowSpecial) return this.shadowSpecial;
    if (this.isKickHeavyActive) return 'backKick';
    if (this.isHeavyActive) return 'upper';
    if (this.isKickLightActive) return 'kick';
    if (this.isJabActive) return 'chop';

    if (this.isSpinning) return 'dash';
    if (!this.isGrounded) return this.vy < 0 ? 'jumping' : 'falling';
    if (this.reverseBrakeActive) return 'turning';
    if (this.brakeActive) return this.shadowRunEndTicks>0?'runEnd':'stopping';
    if (this.shadowLandingTicks > 0 && Math.abs(this.vx)<.35) return 'landing';
    if (this.isDashing) return 'dash';
    if (Math.abs(this.vx)>0.35) return this.shadowRunStartTick<4?'runStart':'run';
    return 'idle';
  }
  draw(opponentX) {
    if(this.magicEffect){const f=this.getMagicDescriptor();if(f){ctx.save();ctx.imageSmoothingEnabled=false;ctx.drawImage(f.img,f.sx,0,f.sw,f.sh,f.dx-game.cameraX,f.dy,f.dw,f.dh);ctx.restore();}}
    this.drawRoaming();
    const name = this.pickShadowAnimation();
    if (name !== this.shadowAnimation) {
      this.shadowAnimation = name;
      this.shadowAnimTick = 0;this.shadowAnimAt=performance.now();
    } else this.shadowAnimTick++;
    if(name==='rocketNew'||name==='roamingNewAir'||name==='roamingNewGround'){const img=name==='rocketNew'?rocketImage:name==='roamingNewAir'?roamingAir:roamingGround;const frame=name==='rocketNew'?(this.rocketTick<15?Math.min(4,Math.floor(this.rocketTick/3)):5+Math.floor(this.rocketTick/4)%2):Math.min((name==='roamingNewAir'?7:9)-1,Math.floor(this.roamingCast.tick/3));if(img.complete&&img.naturalWidth){const bottom=this.getCurrentY()+this.getCurrentHeight(),face=this.facingDirection||1;ctx.save();ctx.imageSmoothingEnabled=false;ctx.translate(Math.round(this.x+this.width/2-game.cameraX),Math.round(bottom));ctx.scale(face,1);ctx.drawImage(this.isSuperShadow?superImage(img):img,frame*48,0,48,48,-72,-144+9,144,144);ctx.restore();return;}}
    if (name === 'spin' || name === 'spinCharge') {
      const img = this.shadowSpinImages[name === 'spinCharge' ? 0 : 1];
      if (img?.complete && img.naturalWidth) {
        const sw = img.naturalWidth / 4, sh = img.naturalHeight;
        const rate = name === 'spinCharge' ? 4 : (this.spinChargeLevel === 1 ? 4 : this.spinChargeLevel === 2 ? 8 : 16);
        const frame = Math.floor(performance.now() * rate / 1000 * 4) % 4;
        const w = sw * 3, h = sh * 3;
        const bottom = this.getCurrentY() + this.getCurrentHeight();
        const center = this.x + this.width/2 - game.cameraX;
        const face = this.facingDirection || 1;
        ctx.save(); ctx.imageSmoothingEnabled = false;
        ctx.translate(Math.round(center), Math.round(bottom));
        ctx.scale(-face,1);
        ctx.drawImage(img,frame*sw,0,sw,sh,-w/2,-h+9,w,h);
        ctx.restore();
        return;
      }
    }
    if(name==='chaosSheets'){
      const body=this.getChaosFrame(chaosBody),effect=this.getChaosFrame(chaosEffect);
      for(const f of [body,effect])if(f){ctx.save();ctx.imageSmoothingEnabled=false;
        if(f.flipX){ctx.translate(f.dx-game.cameraX+f.dw,0);ctx.scale(-1,1);ctx.drawImage(this.isSuperShadow?superImage(f.img):f.img,f.sx,f.sy,f.sw,f.sh,0,f.dy,f.dw,f.dh);}
        else ctx.drawImage(this.isSuperShadow?superImage(f.img):f.img,f.sx,f.sy,f.sw,f.sh,f.dx-game.cameraX,f.dy,f.dw,f.dh);
        ctx.restore();}
      return;
    }
    const isGuard=this.isGuarding&&!this.chaosPhase;
    const isUpperHit=this.isVulnerable&&this.upperHitTick>0;
    if((isGuard&&guardImage.complete&&guardImage.naturalWidth)||(isUpperHit&&upperHitImage.complete&&upperHitImage.naturalWidth)){
      const img=isGuard?guardImage:upperHitImage;
      const frame=isGuard?(performance.now()<(this.guardFlashUntil||0)?2:Math.floor(performance.now()/140)%2):Math.min(2,Math.floor((18-this.upperHitTick)/6));
      const bottom=this.getCurrentY()+this.getCurrentHeight();
      ctx.save();ctx.imageSmoothingEnabled=false;ctx.translate(Math.round(this.x+this.width/2-game.cameraX),Math.round(bottom));// Guard y Upper Hit vienen orientados al contrario de las hojas base.
      ctx.scale((this.facingDirection||1),1);
      ctx.drawImage(this.isSuperShadow?superImage(img):img,frame*48,0,48,48,-72,-144+9,144,144);ctx.restore();return;
    }
    if(name==='idle' && idleImage.complete && idleImage.naturalWidth>=288){
      const frame=this.getShadowFrameIndex('idle');
      const bottom=this.getCurrentY()+this.getCurrentHeight();
      const face=this.facingDirection||1;
      ctx.save();ctx.imageSmoothingEnabled=false;
      ctx.translate(Math.round(this.x+this.width/2-game.cameraX),Math.round(bottom));
      ctx.scale(face,1);
      ctx.drawImage(this.isSuperShadow?superImage(idleImage):idleImage,frame*48,0,48,48,-72,-144+6,144,144);
      ctx.restore();return;
    }
    const seq=SHADOW_ANIMATIONS[name];
    if(!seq?.length)return super.draw(opponentX);
    const f=seq[this.getShadowFrameIndex(name)];
    const img=images[f.sheet-1];
    if(!img?.complete||img.naturalWidth<392)return super.draw(opponentX);
    // La fila 'pivot' (0 = fila inferior) se alinea con el suelo del luchador.
    // No afecta la hitbox ni la posicion fisica.
    const scale = 3;
    const w = 49*scale;
    const h = img.naturalHeight*scale;
    const pivotOffset = (f.pivot || 0)*scale + (f.offset||0)*scale;
    const bottom = this.getCurrentY()+this.getCurrentHeight();
    const screenX = this.x + this.width/2 - game.cameraX;
    let face = this.facingDirection || (opponentX>this.x?1:-1);
    // Mantener orientacion al rival al retroceder; sprites originales miran a izquierda.
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.translate(Math.round(screenX),Math.round(bottom));
    ctx.scale(-face,1); // Shadow Battle original mira hacia la izquierda
    ctx.drawImage(this.isSuperShadow?superImage(img):img,(f.frame-1)*49,0,49,img.naturalHeight,-w/2,-h+pivotOffset,w,h);
    ctx.restore();
  }
}
