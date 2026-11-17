import { configureCombatant, dealDamage } from './combat-system.js';
import { PrototypeFighter } from './prototype-fighter.js';
import { ctx, game } from './state.js';
import { opaqueFramesOverlap, opaqueInRect, opaqueRegionInRect } from './pixel-collision.js';

const SHEETS = {
  idle: ['sonic_idle.png', 6],
  idleHurt: ['sonic_idle_hurt.png', 6],
  run: ['sonic_run.png', 9],
  brake: ['sonic_brake.png', 4],
  reverseBrake: ['sonic_reverse_brake.png', 4],
  dash: ['sonic_dash.png', 7],
  jump: ['sonic_jump.png', 5],
  fall: ['sonic_fall.png', 4],
  guard: ['sonic_guard.png', 3],
  punch: ['sonic_punch.png', 6],
  topKick: ['sonic_top_kick.png', 5],
  sideKick: ['sonic_side_kick.png', 6],
  rocket: ['sonic_rocket.png', 7],
  spinCharge: ['sonic_spin_dash_charge.png', 4],
  spin: ['sonic_spin_dash.png', 4]
};

function load(name) {
  const img = new Image();
  img.src = `assets/images/sonic/${name}`;
  return img;
}

export class Sonic extends PrototypeFighter {
  constructor(x,y,controls){
    super(x,y,controls,{name:'SONIC',color:'#2878ff',spinProfile:'sonic',speed:8});
    configureCombatant(this, 'sonic', 'SONIC');
    this.sonicSheets = {};
    for (const [key,[file,frames]] of Object.entries(SHEETS)) this.sonicSheets[key] = {img:load(file),frames};
    this.sonicAnimStarted = performance.now();
    this.wasGroundedSonic = true;
    this.rocketActive = false;
    this.rocketFrame = 0;
    this.rocketTimer = 0;
    this.rocketHitDone = false;
    this.rocketDirection = 1;
    this.dashHitDone = false;
    this.sonicSpinHits = 0;
    this.sonicSpinLastHit = 0;
    this.spinWallBounceCooldown = 0;
    this.brakeActive = false;
    this.reverseBrakeActive = false;
    this.brakeTimer = 0;
    this.brakeStartVx = 0;
    this.brakeTargetDirection = 0;

    // Sonic: ataques rapidos. Los sistemas de colision existentes usan estos estados.
    this.jabDuration = 12;
    this.jabDamage = 5;
    this.kickLightDuration = 12;
    this.kickLightDamage = 6;
    this.kickHeavyDamageP1 = 8;
    this.kickHeavyDamageP2 = 8;
  }

  startPunch(){ if (!this.isGrounded) return; this.startJab(); this.sonicAnimStarted=performance.now(); }
  startTopKick(){ if (!this.isGrounded) return; this.startKickLight(); this.sonicAnimStarted=performance.now(); }
  startSideKick(){ if (!this.isGrounded) return; if (this.isBusy()) return; this.isKickHeavyActive=true; this.kickHeavyPhase=1; this.kickHeavyTimer=0; this.kickHeavyHitDone=false; this.sonicAnimStarted=performance.now(); }
  startRocket(opponentX){
    if (this.isGrounded || this.rocketActive || this.isVulnerable) return;
    this.rocketActive=true; this.rocketFrame=0; this.rocketTimer=0; this.rocketHitDone=false;
    this.rocketDirection = opponentX > this.x ? 1 : -1;
    // Rocket: diagonal larga. Mucho mas avance horizontal y caida controlada.
    this.vx = this.rocketDirection * 16;
    this.vy = 4;
    this.sonicAnimStarted=performance.now();
  }

  startBrake(reverse=false){
    if (!this.isGrounded || this.isVulnerable || this.rocketActive || this.isSpinDashActive) return;

    // Brake tiene prioridad sobre el dash. Si Sonic iba en dash, se cancela EN ESTE
    // MISMO input antes de que Fighter.update vuelva a imponer dashSpeed.
    const incomingDirection = Math.sign(this.vx || this.dashDirection || 1);
    if (this.isDashing) {
      this.isDashing = false;
      this.dashFrame = 0;
      this.dashTimer = 0;
      this.dashDirection = 0;
      this.dashHitDone = false;
    }

    // También corta el movimiento normal inmediatamente. La animación de Brake
    // puede continuar, pero Sonic ya no recorre media pantalla mientras frena.
    this.vx = 0;
    this.brakeActive = !reverse;
    this.reverseBrakeActive = reverse;
    this.brakeTimer = 0;
    this.brakeStartVx = 0;
    this.brakeTargetDirection = reverse ? -incomingDirection : 0;
    this.sonicAnimStarted = performance.now();
  }

  isBusy(){ return super.isBusy() || this.rocketActive || this.brakeActive || this.reverseBrakeActive; }
  isAttacking(){ return super.isAttacking() || this.rocketActive; }

  update(opponentX,selfInstance){
    const beforeDash = this.isDashing;
    super.update(opponentX,selfInstance);
    if (!beforeDash && this.isDashing) this.dashHitDone=false;

    if (this.spinWallBounceCooldown > 0) this.spinWallBounceCooldown--;

    // Los bordes interiores del Highway son muros reales: x=226 y x=2368.
    // Durante Spin Dash Sonic rebota y sigue rodando, en vez de quedarse pegado.
    if (this.isSpinDashActive && this.spinWallBounceCooldown <= 0) {
      const leftWall = 226;
      const rightWall = 2368;
      if (this.x <= leftWall && this.spinDirection < 0) {
        this.x = leftWall + 2;
        this.spinDirection = 1;
        this.spinSpeedMultiplier = Math.max(0.45, (this.spinSpeedMultiplier || 1) * 0.80);
        this.spinImpactMultiplier = Math.max(0.35, this.spinImpactMultiplier * 0.80);
        this.vx = this.getSpinStat('speed') * this.spinSpeedMultiplier;
        this.spinWallBounceCooldown = 6;
      } else if (this.x + this.width >= rightWall && this.spinDirection > 0) {
        this.x = rightWall - this.width - 2;
        this.spinDirection = -1;
        this.spinSpeedMultiplier = Math.max(0.45, (this.spinSpeedMultiplier || 1) * 0.80);
        this.spinImpactMultiplier = Math.max(0.35, this.spinImpactMultiplier * 0.80);
        this.vx = -this.getSpinStat('speed') * this.spinSpeedMultiplier;
        this.spinWallBounceCooldown = 6;
      }
    }

    if (this.brakeActive || this.reverseBrakeActive) {
      this.isGuarding = false;
      this.brakeTimer++;
      const duration = this.reverseBrakeActive ? 16 : 12;
      const t = Math.min(1, this.brakeTimer / duration);
      this.vx = this.brakeStartVx * (1 - t);
      if (this.brakeTimer >= duration) {
        const reverse = this.reverseBrakeActive;
        this.brakeActive = false;
        this.reverseBrakeActive = false;
        this.brakeTimer = 0;
        this.vx = reverse ? this.brakeTargetDirection * this.speed : 0;
      }
    }

    if (this.rocketActive) {
      this.isGuarding=false;
      this.vx = this.rocketDirection * 16;
      // No permitir que la gravedad convierta Rocket en una caida casi vertical.
      this.vy = Math.min(this.vy, 5.5);
      this.rocketTimer++;
      this.rocketFrame = Math.min(6, Math.floor(this.rocketTimer / 2));
      if (this.isGrounded || this.rocketTimer >= 45) {
        this.rocketActive=false; this.rocketFrame=0; this.rocketTimer=0; this.rocketHitDone=false;
      }
    }
    // Side Kick usa exactamente sus 6 frames una vez; no se queda clavado en el ultimo.
    if (this.isKickHeavyActive && this.kickHeavyTimer >= 12) {
      this.isKickHeavyActive = false;
      this.kickHeavyPhase = 0;
      this.kickHeavyTimer = 0;
      this.kickHeavyHitDone = false;
    }

    if (this.isGrounded && !this.wasGroundedSonic) this.sonicAnimStarted=performance.now();
    this.wasGroundedSonic=this.isGrounded;
  }

  pickAnimation(opponentX){
    const now=performance.now();
    if (this.rocketActive) return ['rocket', this.rocketFrame];
    if (this.reverseBrakeActive) return ['reverseBrake', Math.min(3, Math.floor(this.brakeTimer / 4))];
    if (this.brakeActive) return ['brake', Math.min(3, Math.floor(this.brakeTimer / 3))];
    if (this.isSpinning) {
      const fps=16; // 4 frames x 4 ciclos por segundo
      return ['spinCharge', Math.floor((now-this.sonicAnimStarted)*fps/1000)%4];
    }
    if (this.isSpinDashActive) {
      const cycles = this.spinChargeLevel===1?4:this.spinChargeLevel===2?8:16;
      const fps=cycles*4;
      return ['spin', Math.floor((now-this.sonicAnimStarted)*fps/1000)%4];
    }
    if (this.isJabActive) return ['punch', Math.min(5,Math.floor(this.jabTimer/2))];
    if (this.isKickLightActive) return ['topKick', Math.min(4,Math.floor(this.kickLightTimer/2.4))];
    if (this.isKickHeavyActive) return ['sideKick', Math.min(5,Math.floor(this.kickHeavyTimer/2))];
    if (this.guardFlashUntil > now) return ['guard', Math.floor((this.guardFlashUntil-now)/60)%3];
    if (this.isDashing) return ['dash', Math.min(6,Math.floor(this.dashFrame*7/Math.max(1,this.dashFrames.length)))];
    if (!this.isGrounded) {
      if (this.vy < 0) {
        const progress=Math.min(4,Math.max(0,Math.floor((this.vy-this.jumpForce)/(-this.jumpForce)*5)));
        return ['jump',progress];
      }
      return ['fall',Math.floor((now-this.sonicAnimStarted)/80)%4];
    }
    if (Math.abs(this.vx)>0.1) { const ms=this.walkReverse?165:55; return ['run',Math.floor((now-this.sonicAnimStarted)/ms)%9]; }
    if (this.health <= this.maxHealth*0.30) return ['idleHurt',Math.floor((now-this.sonicAnimStarted)/(1500/6))%6];
    return ['idle',Math.floor((now-this.sonicAnimStarted)/(1000/6))%6];
  }

  getPixelBodyFrame(opponentX){
    const [key,frame]=this.pickAnimation(opponentX);
    const data=this.sonicSheets[key];
    if(!data?.img?.complete || !data.img.naturalWidth) return null;
    const sw=data.img.naturalWidth/data.frames, sh=data.img.naturalHeight;
    const scale=this.height/sh;
    const dw=sw*scale, dh=this.height;
    const center=this.x+this.width/2;
    const dy=this.getCurrentY()+this.getCurrentHeight()-dh;
    let faceRight=opponentX>this.x;
    if(Math.abs(this.vx)>0.1 && !this.isGuarding) faceRight=this.vx>0;
    return {img:data.img,sx:frame*sw,sy:0,sw,sh,dx:center-dw/2,dy,dw,dh,flipX:!faceRight,key,frame};
  }

  pixelBodyIntersectsRect(rect, opponentX){
    return opaqueInRect(this.getPixelBodyFrame(opponentX), rect, 2);
  }

  pixelAttackHits(receiver, attackKind){
    const target=receiver?.getPixelBodyFrame?.(this.x+this.width/2);
    const mine=this.getPixelBodyFrame(receiver.x+receiver.width/2);
    if(!mine) return false;
    // Regions are defined in Sonic's ORIGINAL right-facing frame and mirror automatically.
    // punch/side kick: front half. top kick: upper-front quarter.
    // rocket: narrow horizontal band through Sonic's pivot/center; only opaque pixels in it hurt.
    // dash/spin: whole visible body.
    const regions={
      punch:{x:.50,y:0,w:.50,h:1},
      topKick:{x:.50,y:0,w:.50,h:.50},
      sideKick:{x:.50,y:0,w:.50,h:1},
      rocket:{x:0,y:.42,w:1,h:.18},
      dash:{x:0,y:0,w:1,h:1},
      spin:{x:0,y:0,w:1,h:1}
    };
    const region=regions[attackKind]||regions.dash;
    if(target) return opaqueFramesOverlap(mine,target,region,2);
    return opaqueRegionInRect(mine,region,{x:receiver.x,y:receiver.getCurrentY(),w:receiver.width,h:receiver.getCurrentHeight()},2);
  }

  draw(opponentX){
    const [key,frame]=this.pickAnimation(opponentX);
    const data=this.sonicSheets[key];
    if (!data?.img?.complete || !data.img.naturalWidth) return super.draw(opponentX);
    const sw=data.img.naturalWidth/data.frames, sh=data.img.naturalHeight;
    const scale=this.height/sh;
    const dw=sw*scale, dh=this.height;
    const screenCenter=(this.x+this.width/2)-game.cameraX;
    const dy=this.getCurrentY()+this.getCurrentHeight()-dh;
    const facingRight=opponentX>this.x;
    // Al alejarse Sonic corre de espaldas al rival; se respeta la direccion real de movimiento.
    let faceRight=facingRight;
    if (Math.abs(this.vx)>0.1 && !this.isGuarding) faceRight=this.vx>0;
    ctx.save();
    ctx.translate(screenCenter,0);
    ctx.scale(faceRight?1:-1,1);
    ctx.imageSmoothingEnabled=false;
    ctx.drawImage(data.img, frame*sw,0,sw,sh, -dw/2,dy,dw,dh);
    ctx.restore();
  }
}

export function checkSonicDashAttack(attacker,receiver){
  if (!(attacker instanceof Sonic) || !attacker.isDashing || attacker.dashHitDone) return;
  const ay=attacker.getCurrentY(), ah=attacker.getCurrentHeight(), ry=receiver.getCurrentY(), rh=receiver.getCurrentHeight();
  if (attacker.x<receiver.x+receiver.width && attacker.x+attacker.width>receiver.x && ay<ry+rh && ay+ah>ry &&
      (attacker.pixelAttackHits(receiver,'dash') ?? true)){
    dealDamage(receiver,4,{attacker,attackName:'Sonic Dash'});
    const d=attacker.dashDirection||1; receiver.vx=d*5; attacker.dashHitDone=true;
  }
}

export function checkSonicRocketAttack(attacker,receiver){
  if (!(attacker instanceof Sonic) || !attacker.rocketActive || attacker.rocketHitDone) return;
  const ay=attacker.getCurrentY(), ah=attacker.getCurrentHeight(), ry=receiver.getCurrentY(), rh=receiver.getCurrentHeight();
  if (attacker.x<receiver.x+receiver.width && attacker.x+attacker.width>receiver.x && ay<ry+rh && ay+ah>ry &&
      (attacker.pixelAttackHits(receiver,'rocket') ?? true)){
    dealDamage(receiver,9,{attacker,attackName:'Sonic Rocket'});
    receiver.vx=attacker.rocketDirection*8; receiver.vy=6; attacker.rocketHitDone=true;
  }
}
