import { updatedFrame } from './fighter-update-art.js';
import { HIGHWAY_WALLS } from './wall-system.js';
import { sonicCommand, updateSonicMove, hitSonicMove, sonicMoveFrame, drawSonicMoveEffects } from './sonic-battle-kit.js';
import { emitWind, windFrame } from './wind-effects.js';
import { formFrame } from './super-forms.js';
import { drawRobotFrame } from './robot-sprites.js';
import { combatNow } from './combat-clock.js';
import { configureCombatant, dealDamage } from './combat-system.js';
import { PrototypeFighter } from './prototype-fighter.js';
import { ctx, game } from './state.js';
import { opaqueFramesOverlap, opaqueInRect, opaqueRegionInRect } from './pixel-collision.js';

export const SONIC_SHEETS = {
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

const superSonicClips={idle:'sonicIdle',idleHurt:'sonicIdle',run:'sonicRun',jump:'sonicJump',fall:'sonicFall',rocket:'sonicRocket',
  dash:'sonicDash',punch:'sonicPunch',topKick:'sonicUpper',sideKick:'sonicKick',guard:'sonicGuard',
  brake:'sonicBrake',reverseBrake:'sonicBrake',spin:'sonicSpin',spinCharge:'sonicSpin'};
const superGems=new Image();
superGems.src='assets/story/sonic/shadow-emeralds.png';

export class Sonic extends PrototypeFighter {
  constructor(x,y,controls,{ metal = false } = {}){
    super(x,y,controls,{name:'SONIC',color:'#2878ff',spinProfile:'sonic',speed:8});
    if (!metal) configureCombatant(this, 'sonic', 'SONIC');
    this.sonicSheets = {};
    if (!metal) for (const [key,[file,frames]] of Object.entries(SONIC_SHEETS)) this.sonicSheets[key] = {img:load(file),frames};
    this.sonicAnimStarted = combatNow();
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

  toggleSonicSuper(){
    const now=combatNow();
    if(this.characterId!=='sonic'||this.sonicSuperAt!=null)return;
    if(now-(this.sonicSuperTap??-Infinity)>300){this.sonicSuperTap=now;return;}
    this.sonicSuperTap=null;
    if(!this.isGrounded||this.isBusy()||this.isVulnerable)return;
    if(this.superSonic){this.superSonic=false;this.speed=8;return;}
    if(!this.spendPower(100))return;
    this.sonicSuperAt=now;
    this.vx=0;
  }

  getSuperSonicFrame(opponentX){
    const now=combatNow();
    const [code,tick]=this.pickAnimation(opponentX);
    const idle=['idle','idleHurt'].includes(code);
    const upright=idle||code==='run';
    const rise=upright?(idle?10:23)+Math.sin(now/160)*5:0;
    const key=upright?'sonicIdle':superSonicClips[code];
    const index=upright?Math.floor(now/(idle?125:105)):tick;
    const direction=Math.abs(this.vx)>.1&&!this.isGuarding?Math.sign(this.vx):opponentX>=this.x?1:-1;
    const scale=this.height/45;
    const modern = upright ? (idle ? 'idle' : 'hover') : ['spin','spinCharge'].includes(code) ? 'spin' : null;
    const feet = this.y + this.height - rise;
    const sprite = modern && updatedFrame('modern', modern, index, this.x + this.width / 2, feet, scale, direction);
    if (sprite) return sprite;
    return formFrame(key,index,this.x+this.width/2,this.y+this.height-rise,scale,direction);
  }

  drawSonicSuperChange(){
    if(this.sonicSuperAt==null)return false;
    const age=combatNow()-this.sonicSuperAt;
    const center=this.x+this.width/2, feet=this.y+this.height;
    const direction=this.facingDirection||1;
    const x=center-game.cameraX,y=this.y+this.height*.46;
    const aura=updatedFrame('modern','aura',Math.floor(age/92),center,feet+15,this.height/64,direction);
    drawRobotFrame(ctx,aura,game.cameraX,Math.min(.8,age/220,(1050-age)/210));
    if(age<660 && superGems.complete && superGems.naturalWidth) {
      for (let i=0;i<7;i++) {
        const a=i*Math.PI*2/7+age/91;
        const r=48+34*Math.sin(age*Math.PI/690);
        ctx.drawImage(superGems,i*33,0,33,25,x+Math.cos(a)*r-12,y+Math.sin(a)*r*.66-9,24,18);
      }
    }
    const glow=Math.max(0,1-Math.abs(age-650)/152);
    if(glow>0){
      ctx.save();
      const light=ctx.createRadialGradient(x,y,0,x,y,147);
      light.addColorStop(0,'#fff6c9');light.addColorStop(1,'#ffc60000');
      ctx.globalAlpha=glow*.85;ctx.fillStyle=light;
      ctx.fillRect(x-147,y-147,294,294);
      ctx.restore();
    }
  }

  startPunch(){ if (!this.isGrounded) return; this.startJab(); this.sonicAnimStarted=combatNow(); }
  startTopKick(){ if (!this.isGrounded) return; this.startKickLight(); this.sonicAnimStarted=combatNow(); }
  startSideKick(){ if (!this.isGrounded) return; if (this.isBusy()) return; this.isKickHeavyActive=true; this.kickHeavyPhase=1; this.kickHeavyTimer=0; this.kickHeavyHitDone=false; this.sonicAnimStarted=combatNow(); }
  startRocket(opponentX){
    if (this.isGrounded || this.rocketActive || this.isVulnerable) return;
    this.rocketActive=true; this.rocketFrame=0; this.rocketTimer=0; this.rocketHitDone=false;
    this.rocketDirection = opponentX > this.x ? 1 : -1;
    // Rocket: diagonal larga. Mucho mas avance horizontal y caida controlada.
    this.vx = this.rocketDirection * 16;
    this.vy = 4;
    this.sonicAnimStarted=combatNow();
  }

  startBrake(reverse=false){
    if (!this.isGrounded || this.isVulnerable || this.rocketActive || this.isSpinDashActive) return false;

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
    this.sonicAnimStarted = combatNow();
    return true;
  }

  cancelSonicMoves(){ this.sonicBattleMove=null; this.homing=null; this.sonicComboStep=0; this.sonicComboUntil=0; }

  handleSonicCommand(code,target){ return sonicCommand(this,code,target); }

  isBusy(){ return !!this.sonicBattleMove || !!this.homing || this.sonicSuperAt!=null || super.isBusy() || this.rocketActive || this.brakeActive || this.reverseBrakeActive; }
  isAttacking(){ return super.isAttacking() || this.rocketActive || !!this.homing || !!this.sonicBattleMove; }

  update(opponentX,selfInstance){
    const beforeDash = this.isDashing, beforeGround=this.isGrounded;
    updateSonicMove(this);
    const keys=this.keys;
    if(this.sonicSuperAt!=null) {
      const age=combatNow()-this.sonicSuperAt;
      if(age>=640){this.superSonic=true;this.speed=9.2;}
      if(age>=1050)this.sonicSuperAt=null;
      else this.keys={};
    }
    try {super.update(opponentX,selfInstance);}
    finally {this.keys=keys;}
    if (this.sonicBattleMove?.vx) {
      const [left,right]=HIGHWAY_WALLS;
      this.vx=this.sonicBattleMove.vx;
      this.x=Math.max(left.x,Math.min(right.x-this.width,this.x+this.vx));
    }
    if (!beforeDash && this.isDashing) this.dashHitDone=false;
    if(this.characterId==='sonic' && this.isGrounded) {
      this.sonicBalletUsed=false;
      if(!beforeGround) {
        this.sonicLandAt=combatNow();
        emitWind('dust',this.x+this.width/2,this.feetY,this.facingDirection||1,1.25,.52);
      }
    }

    if (this.spinWallBounceCooldown > 0) this.spinWallBounceCooldown--;

    // Los bordes interiores del Highway son muros reales: x=226 y x=2368.
    // Durante Spin Dash Sonic rebota y sigue rodando, en vez de quedarse pegado.
    if (this.isSpinDashActive && this.spinWallBounceCooldown <= 0) {
      const leftWall = HIGHWAY_WALLS[0].x;
      const rightWall = HIGHWAY_WALLS[1].x;
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

    if (this.isGrounded && !this.wasGroundedSonic) this.sonicAnimStarted=combatNow();
    this.wasGroundedSonic=this.isGrounded;
  }

  pickAnimation(opponentX){
    if (this.homing) return ['spin', Math.floor(combatNow()/35)%4];
    const now=combatNow();
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
    if(this.superSonic){
      const gold=this.getSuperSonicFrame(opponentX);
      if(gold)return gold;
    }
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

  homingTarget(target) {
    if (!target || target.health <= 0 || this.homingSpent || this.isHitstunned() || this.isVulnerable ||
        this.isGuarding || this.sonicSuperAt != null ||
        (!this.homing && !this.isSpinning && !this.isSpinDashActive) ||
        (this.isAttacking() && !this.isMakingHomingAttack)) return null;
    const dx = target.x + target.width / 2 - (this.x + this.width / 2);
    const dy = target.getCurrentY() + target.getCurrentHeight() / 2 - (this.y + this.height / 2);
    return Math.hypot(dx,dy) < 340 ? { dx, dy } : null;
  }

  startHoming(target) {
    if (!this.homingTarget(target) || this.homing || combatNow() < (this.homingRecoveryUntil ?? 0)) return false;
    this.homing = { target, until: combatNow() + 280 };
    this.stopSpinChargeSound();
    this.finishSpinDash(false);
    this.isGrounded = false;
    this.y -= 5;
    return true;
  }

  tryHit(target) {
    hitSonicMove(this,target);
    if (!this.homing && this.isGrounded) this.homingSpent = false;
    if (!this.homing) return;
    if (this.homing.target !== target || this.isHitstunned() || this.isVulnerable || combatNow() >= this.homing.until) {
      this.finishHoming();
      return;
    }
    this.isMakingHomingAttack = true;
    const aim = this.homingTarget(target);
    this.isMakingHomingAttack = false;
    if (!aim) { this.finishHoming(); return; }
    const { dx, dy } = aim;
    if (Math.abs(dx) < target.width * .42 + 20 && Math.abs(dy) < target.getCurrentHeight() * .42 + 20) {
      dealDamage(target,this.superSonic ? 13 : 10,{attacker:this,attackName:'Homing Attack'});
      this.finishHoming();
      this.vx = -Math.sign(dx || 1) * 4;
      this.vy = -8;
      return;
    }
    const step=Math.min(24,Math.hypot(dx,dy));
    const [left,right]=HIGHWAY_WALLS;
    this.x=Math.max(left.x,Math.min(right.x-this.width,this.x+dx/Math.hypot(dx,dy)*step));
    this.y+=dy/Math.hypot(dx,dy)*step;
    this.vx=0;
    this.vy=0;
  }

  finishHoming() {
    this.homing=null;
    this.homingSpent=true;
    this.homingRecoveryUntil=combatNow()+340;
  }

  draw(opponentX){
    const target = this === game.p1 ? game.p2 : game.p1;
    if (target && (this.homingTarget(target) || this.homing)) {
      ctx.save();
      ctx.strokeStyle='#ff384f';
      ctx.lineWidth=3;
      const x=target.x+target.width/2-game.cameraX, y=target.getCurrentY()+target.getCurrentHeight()/2;
      const radius=19+Math.sin(combatNow()/70)*3;
      ctx.beginPath();
      ctx.arc(x,y,radius,0,Math.PI*2);
      ctx.moveTo(x-radius-5,y);
      ctx.lineTo(x+radius+5,y);
      ctx.moveTo(x,y-radius-5);
      ctx.lineTo(x,y+radius+5);
      ctx.stroke();
      ctx.restore();
    }
    this.drawSonicSuperChange();
    drawSonicMoveEffects(this);
    const battle=sonicMoveFrame(this);
    if (battle) { drawRobotFrame(ctx,battle,game.cameraX); return; }
    const landAge=combatNow()-(this.sonicLandAt??-Infinity);
    if (this.characterId==='sonic' && !this.superSonic && this.isGrounded && !this.isBusy() && Math.abs(this.vx)<.5 && landAge<145) {
      const land=windFrame('land',Math.min(2,Math.floor(landAge/48)),this.x+this.width/2,this.y+this.height,this.height/42,this.facingDirection||1);
      if (land) { drawRobotFrame(ctx,land,game.cameraX); return; }
    }
    if (this.sonicSuperAt != null) {
      const age=combatNow()-this.sonicSuperAt;
      const frame=updatedFrame('modern','transform',Math.min(15,Math.floor(age/65)),
        this.x+this.width/2,this.y+this.height,this.height/40,this.facingDirection||1);
      if (frame) { drawRobotFrame(ctx,frame,game.cameraX); return; }
    }
    if(this.superSonic){
      const gold=this.getSuperSonicFrame(opponentX);
      if(gold){drawRobotFrame(ctx,gold,game.cameraX);return;}
    }
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
    dealDamage(receiver,4,{attacker,attackName:attacker.characterId === 'metal-sonic' ? 'Metal Dash' : 'Sonic Dash',impactX:attacker.x+attacker.width/2});
    const d=attacker.dashDirection||1; if(!receiver.lastGuardImpact?.front)receiver.vx=d*5; attacker.dashHitDone=true;
  }
}

export function checkSonicRocketAttack(attacker,receiver){
  if (!(attacker instanceof Sonic) || !attacker.rocketActive || attacker.rocketHitDone) return;
  const ay=attacker.getCurrentY(), ah=attacker.getCurrentHeight(), ry=receiver.getCurrentY(), rh=receiver.getCurrentHeight();
  if (attacker.x<receiver.x+receiver.width && attacker.x+attacker.width>receiver.x && ay<ry+rh && ay+ah>ry &&
      (attacker.pixelAttackHits(receiver,'rocket') ?? true)){
    dealDamage(receiver,9,{attacker,attackName:attacker.characterId === 'metal-sonic' ? 'Metal Rocket' : 'Sonic Rocket',impactX:attacker.x+attacker.width/2});
    if(!receiver.lastGuardImpact?.front){receiver.vx=attacker.rocketDirection*8;receiver.vy=6;} attacker.rocketHitDone=true;
  }
}
