import { combatNow } from './combat-clock.js';
import { chargedSpriteFrame } from './charge-palette.js';
import { PrototypeFighter } from './prototype-fighter.js';
import { configureCombatant, dealDamage } from './combat-system.js';
import { ctx, game } from './state.js';
import { initBuster, getBusterLevel } from './buster-system.js';
import { HIGHWAY_WALLS, getTouchedWall } from './wall-system.js';
import { ZERO_TECHNIQUES } from './zero-techniques.js';
import { ZERO_TECHNIQUE_FRAMES } from './zero-technique-frames.js';
import { playSound } from './utils.js';
import { busterAudio } from './assets.js';
import { opaqueInRect, opaqueFramesOverlap } from './pixel-collision.js';

const img = (src) => { const i = new Image(); i.src = src; return i; };
const techniqueAtlas = img('assets/images/zero-techniques.png');
const SABER_COLORS = ['#c0f0d0','#98e0b8','#50e890','#38c870','#28b858'];
const SLIDE_COLORS = ['#f05098', '#f8e0f8', '#f8c0f0', '#f088c0'];
// Inicio, fin exclusivo y ancla horizontal del cuerpo dentro de la tira.
export const EXTRA_SHEETS = {
  slidingSaber: { img: img('assets/images/zero-slide.png'), bottom: 51, cells: [
    [0,66,31],[69,127,98],[130,227,190],[229,346,315],[349,454,421],
    [459,535,513],[545,603,575],[610,661,638],[675,724,704],[741,787,766]
  ] },
  crouchSaber: { img: img('assets/images/zero-crouch-cut.png'), bottom: 45, cells: [
    [1,63,36],[67,125,100],[133,225,196],[229,325,301],[327,422,397],
    [426,511,472],[515,584,556],[603,665,642],[674,733,713]
  ] },
  busterPose: { img: img('assets/images/zero-buster-pose.png'), bottom: 55, cells: [
    [0,64,42],[71,135,113],[143,206,183],[215,278,254],[285,348,325],[355,406,384]
  ] }
};

export const ZERO_SHEETS = {
  dash:      { img: img('assets/images/zero_dash.png'),       frames: 5,  frameW: 80,  frameH: 48 },
  idle:      { img: img('assets/images/zero_idle.png'),       frames: 6,  frameW: 48,  frameH: 48 },
  idleHurt:  { img: img('assets/images/zero_idle_hurt.png'),  frames: 9,  frameW: 48,  frameH: 48 },
  intro:     { img: img('assets/images/zero_intro.png'),      frames: 15, frameW: 80,  frameH: 80 },
  run:       { img: img('assets/images/zero_run.png'),        frames: 16, frameW: 64,  frameH: 48 },
  slashA:    { img: img('assets/images/zero_slash_a.png'),    frames: 17, frameW: 112, frameH: 64 },
  slashB:    { img: img('assets/images/zero_slash_b.png'),    frames: 12, frameW: 128, frameH: 48 },
  slashC:    { img: img('assets/images/zero_slash_c.png'),    frames: 15, frameW: 176, frameH: 80 },
  wallCling: { img: img('assets/images/zero_wall_cling.png'), frames: 3,  frameW: 48,  frameH: 64 },
  wallSlide: { img: img('assets/images/zero_wall_slide.png'), frames: 3,  frameW: 48,  frameH: 80 },
  // El usuario añadirá este PNG al ZIP: 672x80, 14 frames de 48x80.
  jump:      { img: img('assets/images/zero_jump.png'),       frames: 14, frameW: 48,  frameH: 80 },
  airSlash:  { img: img('assets/images/zero_air_slash.png'),  frames: 9,  frameW: 160, frameH: 80 }
};
const SHEETS = ZERO_SHEETS;

export class Zero extends PrototypeFighter {
  constructor(x,y,controls){
    super(x,y,controls,{name:'ZERO',color:'#e34343',hasSonicJump:false,speed:7});
    configureCombatant(this, 'zero', 'ZERO');
    this.characterId='zero';

    initBuster(this, 'zero');
    this.zeroAttack=null;
    this.zeroAttackFrame=0;
    this.zeroAttackStarted=0;
    this.zeroAttackHit=false;
    this.zeroAnimStarted=combatNow();
    this.zeroDashStopping=false;
    this.zeroDashStopStarted=0;
    this.zeroWallTouchStarted=0;
    this.zeroWallMode='cling';
    this.zeroLastWall=false;
    this.zeroWallHopUntil=0;
    this.zeroWallHopSide=null;
    this.zeroLandingAnimUntil=0;
    this.zeroWasGrounded=true;

    // La intro de Zero dura lo mismo que la de Bass: 2 segundos.
    this.isIntroActive=true;
    this.introDone=false;
    this.introFrame=0;
    this.introTimer=0;
  }

  getIntroFrames(){
    // Fighter mide estas duraciones en ticks (~60 fps): 15 * 8 = 120 ticks ≈ 2 s.
    return Array.from({length:15},()=>({duration:8}));
  }

  isAttacking(){ return Boolean(this.zeroAttack) || combatNow()<this.zeroBusterRecoveryUntil || super.isAttacking(); }
  isBusy(){ return Boolean(this.zeroAttack) || combatNow()<this.zeroBusterRecoveryUntil || super.isBusy(); }
  canUseBuster(){return !this.isBusy()&&!this.isIntroActive&&!this.isVulnerable&&!this.wasInAirFromKnockback;}

  startWallHop(side){
    this.zeroWallHopSide=side;
    this.zeroWallHopUntil=combatNow()+230;
  }

  startSaberAttack(kind){
    if(!this.canUseBuster()) return false;
    const technique=ZERO_TECHNIQUES[kind];
    const wall=technique?.wall?getTouchedWall(this):null;
    if((technique?.ground&&!this.isGrounded)||(technique?.air&&this.isGrounded)||(technique?.wall&&!wall))return false;
    if(['ADVANCE','UPPER','SLIDE','CROUCH'].includes(kind)&&!this.isGrounded)return false;
    this.zeroAttack=kind;
    this.zeroAttackFrame=0;
    this.zeroAttackStarted=combatNow();
    this.zeroAttackHit=false;
    if(this.isGrounded && kind!=='AIR') this.vx=0;
    this.facingLocked=true;
    this.facingUnlockAt=this.zeroAttackStarted+(technique? technique.frameMs*ZERO_TECHNIQUE_FRAMES[technique.key].length : kind==='SLIDE'||kind==='ADVANCE'?300:140);
    if(wall){
      this.facingDirection=wall.side==='left'?1:-1;
      this.zeroTechniqueWallX=this.x;
      this.zeroTechniqueWallY=this.y;
      this.zeroTechniqueWallSide=wall.side;
    }
    if(technique?.jump){
      this.vy=technique.jump;
      this.wallSliding=false;
    }
    return true;
  }

  _attackSpec(){
    const technique=ZERO_TECHNIQUES[this.zeroAttack];
    if(technique)return {...technique,frames:ZERO_TECHNIQUE_FRAMES[technique.key].length};
    if(this.zeroAttack==='SLIDE') return {key:'slidingSaber', frames:10, frameMs:57, damage:14};
    if(this.zeroAttack==='CROUCH') return {key:'crouchSaber', frames:9, frameMs:52, damage:9};
    if(this.zeroAttack==='ADVANCE') return {key:'slashA', frames:17, frameMs:40, damage:10};
    if(this.zeroAttack==='UPPER') return {key:'slashC', frames:15, frameMs:46, damage:13};
    if(this.zeroAttack==='A') return {key:'slashA', frames:17, frameMs:58, damage:12};
    if(this.zeroAttack==='B') return {key:'slashB', frames:12, frameMs:42, damage:10};
    if(this.zeroAttack==='C') return {key:'slashC', frames:15, frameMs:62, damage:18};
    if(this.zeroAttack==='AIR') return {key:'airSlash', frames:9, frameMs:58, damage:14};
    return null;
  }

  update(opponentX,selfInstance){
    const wasDashing=this.isDashing;
    const wasGrounded=this.isGrounded;
    super.update(opponentX,selfInstance);
    if(this.isDashing && this.zeroDashStarted==null) {
      this.zeroDashStarted=combatNow();
      this.zeroDashStopping=false;
    }
    if(wasGrounded===false && this.isGrounded) this.zeroLandingAnimUntil=combatNow()+130;
    this.zeroWasGrounded=this.isGrounded;
    // Mantiene la guardia direccional común de Fighter al sostener atrás.

    if(wasDashing && !this.isDashing && !this.zeroDashStopping){
      this.zeroDashStopping=true; this.zeroDashStopStarted=combatNow();
    }
    if(!this.isDashing) this.zeroDashStarted=null;

    if(this.zeroAttack){
      // En suelo el slash planta a Zero; en aire conserva su movimiento/física.
      if(this.isGrounded) this.vx=0;
      const spec=this._attackSpec();
      let elapsed=combatNow()-this.zeroAttackStarted;
      if(spec.landedFrame&&this.isGrounded&&elapsed<spec.landedFrame*spec.frameMs){
        elapsed=spec.landedFrame*spec.frameMs;
        this.zeroAttackStarted=combatNow()-elapsed;
      }
      this.zeroAttackFrame=Math.min(spec.frames-1,Math.floor(elapsed/spec.frameMs));
      if(['ADVANCE','SLIDE'].includes(this.zeroAttack)&&this.isGrounded&&this.zeroAttackFrame<6&&!this.isHitstunned()){
        const [left,right]=HIGHWAY_WALLS;
        const speed=this.zeroAttack==='SLIDE'?7:5;
        this.x=Math.max(left.x,Math.min(right.x-this.width,this.x+this.facingDirection*speed));
      }
      if(!this.isHitstunned()){
        if(spec.speed&&this.zeroAttackFrame<spec.travel){
          const [left,right]=HIGHWAY_WALLS;
          this.x=Math.max(left.x,Math.min(right.x-this.width,this.x+this.facingDirection*spec.speed));
        }
        if(spec.dive&&!this.isGrounded&&this.zeroAttackFrame>=1)this.vy=Math.max(this.vy,spec.dive);
        if(spec.lift&&this.zeroAttackFrame===3&&this.isGrounded){this.vy=spec.lift;this.isGrounded=false;}
        if(this.zeroAttack==='WALL'&&!this.isGrounded){
          this.x=this.zeroTechniqueWallX;this.y=this.zeroTechniqueWallY;this.vx=0;this.vy=0;
        }
      }
      if(elapsed>=spec.frames*spec.frameMs){
        this.zeroAttack=null; this.zeroAttackFrame=0; this.zeroAttackHit=false;
        this.zeroAnimStarted=combatNow();
      }
    }

    const touching=this.wallSliding && !this.isGrounded;
    if(touching){
      if(!this.zeroLastWall){ this.zeroWallTouchStarted=combatNow(); this.zeroWallMode='cling'; }
      if(combatNow()-this.zeroWallTouchStarted>=1000) this.zeroWallMode='slide';
    } else {
      this.zeroWallTouchStarted=0; this.zeroWallMode='cling';
    }
    this.zeroLastWall=touching;
  }

  pickAnimation(){
    const now=combatNow();
    if(this.isIntroActive) return ['intro',Math.min(14,this.introFrame)];
    if(this.zeroAttack){ const s=this._attackSpec(); return [s.key,this.zeroAttackFrame]; }
    if(this.zeroBusterPoseUntil>now) return ['busterPose',Math.min(5,Math.floor((now-this.zeroBusterPoseStarted)/this.zeroBusterFrameMs))];
    // Durante el pequeño zigzag de wall-jump se usa el frame 1 de cling aunque Zero
    // esté temporalmente separado del pilar.
    if(this.zeroWallHopUntil>now && !this.isGrounded) return ['wallCling',0];
    if(this.wallSliding && !this.isGrounded){
      if(this.zeroWallMode==='slide') return ['wallSlide',Math.floor((now-this.zeroWallTouchStarted)/1000)%3];
      // frame 1 al aproximarse; una vez pegado alterna 2-3.
      const held=now-this.zeroWallTouchStarted;
      return ['wallCling', held<90 ? 0 : 1+Math.floor((held-90)/110)%2];
    }
    if(this.zeroDashStopping){
      const e=now-this.zeroDashStopStarted;
      if(e<55) return ['dash',1];
      if(e<110) return ['dash',0];
      this.zeroDashStopping=false;
    }
    if(this.isDashing){
      // 1, 2 y después 3-5 en bucle hasta llegar al destino.
      const e=now-(this.zeroDashStarted??now);
      if(e<55) return ['dash',0];
      if(e<110) return ['dash',1];
      return ['dash',2+Math.floor((e-110)/55)%3];
    }
    if(!this.isGrounded){
      // Jump: 4-6 subida, 7 ápice, 8-12 caída. Los frames 1-3 son el impulso
      // desde suelo y 13-14 el aterrizaje; aquí priorizamos que la fase aérea coincida
      // exactamente con la física.
      if(this.vy < -2) return ['jump',3 + (Math.floor(now/75)%3)];
      if(this.vy <= 2) return ['jump',6];
      return ['jump',7 + (Math.floor(now/70)%5)];
    }
    if(this.zeroLandingAnimUntil>now) return ['jump', now < this.zeroLandingAnimUntil-65 ? 12 : 13];
    if(this.isCrouching) return ['crouch', Math.floor(now/155)%3];
    if(Math.abs(this.vx)>0.1) {
      const e=now-this.zeroAnimStarted; const step=1500/16;
      if(e<step*2) return ['run',Math.floor(e/step)];
      return ['run',2+Math.floor((e-step*2)/step)%14];
    }
    if(this.health<=this.maxHealth*.30) return ['idleHurt',Math.floor((now-this.zeroAnimStarted)/(2000/9))%9];
    return ['idle',Math.floor((now-this.zeroAnimStarted)/(2000/6))%6];
  }

  _frameDescriptor(opponentX, forBody=true){
    let [key,frame]=this.pickAnimation();
    if(forBody&&ZERO_TECHNIQUES[this.zeroAttack]){
      [key,frame]=this.isGrounded
        ? (this.zeroAttack==='FROSTDASH'||this.zeroAttack==='LAND'?['crouch',0]:['idle',0])
        : ['jump',6];
    }
    const cells=ZERO_TECHNIQUE_FRAMES[key];
    if(cells){
      if(!techniqueAtlas.complete||!techniqueAtlas.naturalWidth)return null;
      const [sx,sy,sw,sh,anchorX,anchorY]=cells[frame];
      const scale=this.height/48;
      if(key==='wall'){
        const left=this.zeroTechniqueWallSide==='left';
        const wallX=HIGHWAY_WALLS[left?0:1].x;
        const footX=[25,34,88,89,89,69,44,30,34,34,24][frame];
        const footY=83;
        return {img:techniqueAtlas,sx,sy,sw,sh,
          dx:wallX-(left?sw-footX:footX)*scale,
          dy:this.y+this.height-5*scale-footY*scale,dw:sw*scale,dh:sh*scale,
          flipX:left,key,frame};
      }
      const flipX=this.facingLocked ? this.facingDirection>0 : opponentX>this.x;
      return {img:techniqueAtlas,sx,sy,sw,sh,dx:this.x+this.width/2-(flipX?sw-anchorX:anchorX)*scale,
        dy:this.y+this.height-anchorY*scale,dw:sw*scale,dh:sh*scale,flipX,key,frame};
    }
    const extra=EXTRA_SHEETS[key];
    if(extra){
      if(!extra.img.complete||!extra.img.naturalWidth)return null;
      const [sx,end,anchor]=extra.cells[frame];
      const sw=end-sx, scale=this.height/48;
      const flipX=this.facingLocked ? this.facingDirection>0 : opponentX>this.x;
      const pivot=flipX?end-anchor:anchor-sx;
      return {img:extra.img,sx,sy:0,sw,sh:extra.bottom,
        dx:this.x+this.width/2-pivot*scale,dy:this.y+this.height-extra.bottom*scale,
        dw:sw*scale,dh:extra.bottom*scale,flipX,key,frame,
        excludeColors:forBody?(key==='slidingSaber'?SLIDE_COLORS:SABER_COLORS):null};
    }
    const s=SHEETS[key];
    if(!s?.img?.complete || !s.img.naturalWidth) return null;
    // 48 px de sprite base = altura jugable de Zero. Hojas altas conservan efectos/sable.
    const scale=this.height/48;
    const dw=s.frameW*scale, dh=s.frameH*scale;
    let flipX=false;

    // La mayoría de hojas originales miran a la IZQUIERDA. Se espejan al mirar a la derecha.
    // Intro y muros ya vienen orientados especialmente y no siguen la regla normal.
    if(key==='wallCling' || key==='wallSlide') {
      const wallX = this.x <= HIGHWAY_WALLS[0].x+4 ? HIGHWAY_WALLS[0].x : HIGHWAY_WALLS[1].x;
      const onLeft = wallX===HIGHWAY_WALLS[0].x;
      flipX=!onLeft;
      const contactPx = key==='wallCling' ? 12 : 8;
      const contactWorld = contactPx*scale;
      const dx = onLeft ? wallX-contactWorld : wallX-(dw-contactWorld);
      return {img:s.img,sx:frame*s.frameW,sy:0,sw:s.frameW,sh:s.frameH,dx,dy:this.y+this.height-dh,dw,dh,flipX,
              key,frame,excludeColors:forBody?SABER_COLORS:null};
    }

    if(key==='intro') {
      // La intro ya está orientada; el último frame es la excepción indicada.
      flipX = frame===14;
    } else {
      const faceRight=this.facingLocked ? this.facingDirection>0 : opponentX>this.x;
      flipX=faceRight;
      // Al retroceder NO se voltea: corre en reversa manteniendo la mirada al rival.
    }

    const center=this.x+this.width/2;
    // Slash C: el pivote de suelo está 8 px arriba del borde inferior del frame.
    // Por eso bajamos visualmente la hoja 8 px (escalados) para que ese punto toque piso.
    const pivotBottomPx = key==='slashC' ? 8 : 0;
    return {img:s.img,sx:frame*s.frameW,sy:0,sw:s.frameW,sh:s.frameH,
            dx:center-dw/2,dy:this.y+this.height-dh+pivotBottomPx*scale,dw,dh,flipX,key,frame,
            excludeColors:forBody?SABER_COLORS:null};
  }

  getPixelBodyFrame(opponentX){ return this._frameDescriptor(opponentX,true); }
  pixelBodyIntersectsRect(rect,opponentX){ return opaqueInRect(this.getPixelBodyFrame(opponentX),rect,1); }

  _saberRegion(){
    const f=this.zeroAttackFrame+1; // especificación humana 1..N
    if(this.zeroAttack==='ADVANCE') return f>=3&&f<=6?{x:0,y:0,w:1,h:1}:null;
    if(this.zeroAttack==='UPPER') return f>=3&&f<=5?{x:0,y:0,w:1,h:.58}:null;
    if(this.zeroAttack==='SLIDE'||this.zeroAttack==='CROUCH') return f>=3&&f<=5?{x:0,y:.15,w:.70,h:.85}:null;
    if(this.zeroAttack==='A'){
      if(f===3) return {x:0,y:0,w:1,h:.55}; // arriba solamente
      if(f>=4 && f<=7) return {x:0,y:0,w:1,h:1};
      return null;
    }
    if(this.zeroAttack==='AIR'){
      if(f>=2 && f<=6) return {x:0,y:0,w:1,h:1};
      return null;
    }
    if(this.zeroAttack==='B'){
      // Original mira a la izquierda: frontal=mitad izquierda, espalda=mitad derecha.
      if(f>=2 && f<=3) return {x:0,y:0,w:.5,h:1};
      if(f===4) return {x:0,y:0,w:1,h:1};
      if(f>=5 && f<=8) return {x:.5,y:0,w:.5,h:1};
      return null;
    }
    if(this.zeroAttack==='C'){
      if(f===1) return null; // sable demasiado pequeño: no cuenta
      if(f===2) return {x:.5,y:0,w:.5,h:1}; // espalda
      if(f===3) return {x:0,y:0,w:1,h:.55}; // arriba
      if(f>=4 && f<=5) return {x:0,y:0,w:1,h:1}; // cubre frente y arriba
      if(f>=6 && f<=9) return {x:0,y:0,w:.58,h:1}; // frontal
      return null;
    }
    return null;
  }

  saberHits(receiver){
    if(!this.zeroAttack || this.zeroAttackHit) return false;
    if(this.isHitstunned() || receiver.minerPhase==='under' || receiver.minerPhase==='warning')return false;
    const technique=ZERO_TECHNIQUES[this.zeroAttack];
    if(technique){
      const [first,last]=technique.active;
      if(this.zeroAttackFrame<first||this.zeroAttackFrame>last)return false;
      if(!techniqueAtlas.complete||!techniqueAtlas.naturalWidth)return false;
      const scale=this.height/153, [offsetX,offsetY,w,h]=technique.area.map(n=>n*scale);
      const center=this.x+this.width/2, direction=this.facingDirection||1;
      const rect={x:center+(direction>0?offsetX:-offsetX-w),y:this.y+this.height+offsetY,w,h};
      if(typeof receiver.pixelBodyIntersectsRect==='function')return receiver.pixelBodyIntersectsRect(rect,center);
      return rect.x<receiver.x+receiver.width&&rect.x+rect.w>receiver.x&&
        rect.y<receiver.getCurrentY()+receiver.getCurrentHeight()&&rect.y+rect.h>receiver.getCurrentY();
    }
    const region=this._saberRegion(); if(!region) return false;
    const mine=this._frameDescriptor(receiver.x+receiver.width/2,false);
    if(!mine) return false;
    mine.includeColors=this.zeroAttack==='SLIDE'?SLIDE_COLORS:SABER_COLORS;
    const target=receiver?.getPixelBodyFrame?.(this.x+this.width/2);
    if(target && opaqueFramesOverlap(mine,target,region,1)) return true;
    // Fallback para personajes sin sprite pixel-perfect.
    const rect={x:receiver.x,y:receiver.getCurrentY(),w:receiver.width,h:receiver.getCurrentHeight()};
    return opaqueInRect({...mine, region},rect,1);
  }

  applySaberHit(receiver){
    const spec=this._attackSpec(); if(!spec) return;
    const damage=dealDamage(receiver,spec.damage,{
      attacker:this,attackName:`Z-Saber Slash ${this.zeroAttack}`,
      element: ['FIREUP', 'FIREDIVE'].includes(this.zeroAttack) ? 'fire' : undefined,
      lowAttack:this.zeroAttack==='CROUCH'||spec.low,
      ignoreGuard:(this.zeroAttack==='CROUCH'||spec.low)&&receiver.guardType==='high'
    });
    this.zeroAttackHit=true;
    if(damage<=0||receiver.lastGuardImpact?.blocked||receiver.lastGuardImpact?.broken)return;
    const dir=this.facingDirection||1;
    // Knockback moderado. Importante: marcar knockback aéreo para que personajes
    // con update propio (Bass) reciban gravedad y no salgan volando indefinidamente.
    receiver.vx=dir*(this.zeroAttack==='C'?5:3);
    if(this.zeroAttack==='C'||this.zeroAttack==='UPPER'||spec.launch) {
      receiver.vy=spec.launch??(this.zeroAttack==='UPPER'?-10:-6);
      receiver.isGrounded=false;
      receiver.wasInAirFromKnockback=true;
      receiver.knockbackAirTimer=0;
    }
  }

  onBusterFired(level,direction){
    this.zeroBusterPoseStarted=combatNow();
    const groundCharge=level>=2&&this.isGrounded;
    const duration=groundCharge?450:228;
    this.zeroBusterFrameMs=duration/6;
    this.zeroBusterPoseUntil=this.zeroBusterPoseStarted+duration;
    if(groundCharge){
      this.zeroBusterRecoveryUntil=this.zeroBusterPoseUntil;
      this.facingDirection=direction;
      this.facingLocked=true;
      this.facingUnlockAt=this.zeroBusterPoseUntil;
      this.vx=0;
    }
    playSound(busterAudio);
  }

  draw(opponentX){
    let f=this._frameDescriptor(opponentX,false);
    if(!f) return super.draw(opponentX);
    if(this.zeroAttack==='FROSTDASH'){
      const [sx,sw]=[[197,68],[278,66],[359,69]][this.zeroAttackFrame%3];
      const scale=this.height/48, dir=this.facingDirection;
      const edge=this.x+this.width/2-dir*13*scale-game.cameraX;
      ctx.save();
      ctx.translate(edge,this.y+this.height-41*scale);
      ctx.scale(dir,1);
      ctx.globalAlpha=.76;
      ctx.drawImage(techniqueAtlas,sx,929,sw,46,-sw*scale,0,sw*scale,46*scale);
      ctx.restore();
    }
    if(this.zeroAttack==='BURST'&&this.zeroAttackFrame>=4&&this.zeroAttackFrame<=7){
      const fade=1-(this.zeroAttackFrame-4)/4;
      const rx=(72+(this.zeroAttackFrame-4)*16)*this.height/153;
      ctx.save();
      ctx.globalAlpha=fade*.7;
      ctx.strokeStyle='#a0eaff';ctx.lineWidth=4;
      ctx.beginPath();
      ctx.ellipse(this.x+this.width/2-game.cameraX,this.y+this.height-12,rx,16,0,0,Math.PI*2);
      ctx.stroke();
      ctx.restore();
    }
    ctx.save(); ctx.imageSmoothingEnabled=false;
    if(this.isVulnerable && Math.floor(combatNow()/100)%2===0) ctx.globalAlpha=.5;
    if(this.busterCharging){
      const level=getBusterLevel(this);
      f=chargedSpriteFrame(f,'zero',level,combatNow());
      const pulse=(1+Math.sin((combatNow()-this.busterChargeStart)/60))/2;
      const glow=['','#77d4ff','#88f8cb','#ffdb66'][level];
      ctx.shadowColor=glow;
      ctx.shadowBlur=(3+level*3)*pulse;
    }
    const screenX=f.dx-game.cameraX;
    if(f.flipX){
      ctx.translate(screenX+f.dw,0); ctx.scale(-1,1);
      ctx.drawImage(f.img,f.sx,f.sy,f.sw,f.sh,0,f.dy,f.dw,f.dh);
    } else ctx.drawImage(f.img,f.sx,f.sy,f.sw,f.sh,screenX,f.dy,f.dw,f.dh);
    ctx.restore();
    if(this.busterCharging){
      const level=getBusterLevel(this);
      ctx.save();
      ctx.font='700 12px system-ui';
      ctx.textAlign='center';
      ctx.strokeStyle='#10162b';ctx.lineWidth=4;
      ctx.fillStyle=['','#b3e8ff','#bfffdc','#ffe482'][level];
      const label=level===3?'BUSTER MAX':`BUSTER ${level}`;
      const x=this.x+this.width/2-game.cameraX,y=this.y-13;
      ctx.strokeText(label,x,y);ctx.fillText(label,x,y);
      ctx.restore();
    }
  }
}
