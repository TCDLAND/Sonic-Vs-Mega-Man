import { PrototypeFighter } from './prototype-fighter.js';
import { configureCombatant, dealDamage } from './combat-system.js';
import { ctx, game } from './state.js';
import { opaqueInRect, opaqueFramesOverlap } from './pixel-collision.js';

const img = (src) => { const i = new Image(); i.src = src; return i; };
const SABER_COLORS = ['#c0f0d0','#98e0b8','#50e890','#38c870','#28b858'];

const SHEETS = {
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

export class Zero extends PrototypeFighter {
  constructor(x,y,controls){
    super(x,y,controls,{name:'ZERO',color:'#e34343',hasSonicJump:false,speed:7});
    configureCombatant(this, 'zero', 'ZERO');
    this.characterId='zero';

    // Buster se deja fuera en esta prueba para concentrarnos en el Z-Saber.
    this.hasBuster=false;
    this.zeroAttack=null;
    this.zeroAttackFrame=0;
    this.zeroAttackStarted=0;
    this.zeroAttackHit=false;
    this.zeroAnimStarted=performance.now();
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

  isAttacking(){ return Boolean(this.zeroAttack) || super.isAttacking(); }

  startWallHop(side){
    this.zeroWallHopSide=side;
    this.zeroWallHopUntil=performance.now()+230;
  }

  startSaberAttack(kind){
    if(this.zeroAttack || this.isDashing || this.wasInAirFromKnockback || this.isVulnerable || this.isIntroActive) return;
    this.zeroAttack=kind;
    this.zeroAttackFrame=0;
    this.zeroAttackStarted=performance.now();
    this.zeroAttackHit=false;
    if(this.isGrounded && kind!=='AIR') this.vx=0;
    this.facingLocked=true;
    this.facingUnlockAt=performance.now()+140;
  }

  _attackSpec(){
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
    if(wasGrounded===false && this.isGrounded) this.zeroLandingAnimUntil=performance.now()+130;
    this.zeroWasGrounded=this.isGrounded;
    // Zero todavía no tiene guard propio. Al retroceder usa carrera reversa, como Bass.
    this.isGuarding=false; this.guardType=null;

    if(wasDashing && !this.isDashing && !this.zeroDashStopping){
      this.zeroDashStopping=true; this.zeroDashStopStarted=performance.now();
    }

    if(this.zeroAttack){
      // En suelo el slash planta a Zero; en aire conserva su movimiento/física.
      if(this.isGrounded) this.vx=0;
      const spec=this._attackSpec();
      const elapsed=performance.now()-this.zeroAttackStarted;
      this.zeroAttackFrame=Math.min(spec.frames-1,Math.floor(elapsed/spec.frameMs));
      if(elapsed>=spec.frames*spec.frameMs){
        this.zeroAttack=null; this.zeroAttackFrame=0; this.zeroAttackHit=false;
        this.zeroAnimStarted=performance.now();
      }
    }

    const touching=this.wallSliding && !this.isGrounded;
    if(touching){
      if(!this.zeroLastWall){ this.zeroWallTouchStarted=performance.now(); this.zeroWallMode='cling'; }
      if(performance.now()-this.zeroWallTouchStarted>=1000) this.zeroWallMode='slide';
    } else {
      this.zeroWallTouchStarted=0; this.zeroWallMode='cling';
    }
    this.zeroLastWall=touching;
  }

  pickAnimation(){
    const now=performance.now();
    if(this.isIntroActive) return ['intro',Math.min(14,this.introFrame)];
    if(this.zeroAttack){ const s=this._attackSpec(); return [s.key,this.zeroAttackFrame]; }
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
      const e=now-this.zeroAnimStarted;
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
    if(Math.abs(this.vx)>0.1) {
      const e=now-this.zeroAnimStarted; const step=1500/16;
      if(e<step*2) return ['run',Math.floor(e/step)];
      return ['run',2+Math.floor((e-step*2)/step)%14];
    }
    if(this.health<=this.maxHealth*.30) return ['idleHurt',Math.floor((now-this.zeroAnimStarted)/(2000/9))%9];
    return ['idle',Math.floor((now-this.zeroAnimStarted)/(2000/6))%6];
  }

  _frameDescriptor(opponentX, forBody=true){
    const [key,frame]=this.pickAnimation();
    const s=SHEETS[key];
    if(!s?.img?.complete || !s.img.naturalWidth) return null;
    // 48 px de sprite base = altura jugable de Zero. Hojas altas conservan efectos/sable.
    const scale=this.height/48;
    const dw=s.frameW*scale, dh=s.frameH*scale;
    let flipX=false;

    // La mayoría de hojas originales miran a la IZQUIERDA. Se espejan al mirar a la derecha.
    // Intro y muros ya vienen orientados especialmente y no siguen la regla normal.
    if(key==='wallCling' || key==='wallSlide') {
      const wallX = this.x <= 230 ? 226 : 2368;
      const onLeft = wallX===226;
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
    const region=this._saberRegion(); if(!region) return false;
    const mine=this._frameDescriptor(receiver.x+receiver.width/2,false);
    if(!mine) return false;
    mine.includeColors=SABER_COLORS;
    const target=receiver?.getPixelBodyFrame?.(this.x+this.width/2);
    if(target && opaqueFramesOverlap(mine,target,region,1)) return true;
    // Fallback para personajes sin sprite pixel-perfect.
    const rect={x:receiver.x,y:receiver.getCurrentY(),w:receiver.width,h:receiver.getCurrentHeight()};
    return opaqueInRect({...mine, region},rect,1);
  }

  applySaberHit(receiver){
    const spec=this._attackSpec(); if(!spec) return;
    dealDamage(receiver,spec.damage,{attacker:this,attackName:`Z-Saber Slash ${this.zeroAttack}`});
    const dir=this.facingDirection||1;
    // Knockback moderado. Importante: marcar knockback aéreo para que personajes
    // con update propio (Bass) reciban gravedad y no salgan volando indefinidamente.
    receiver.vx=dir*(this.zeroAttack==='C'?5:3);
    if(this.zeroAttack==='C') {
      receiver.vy=-6;
      receiver.isGrounded=false;
      receiver.wasInAirFromKnockback=true;
      receiver.knockbackAirTimer=0;
    }
    this.zeroAttackHit=true;
  }

  draw(opponentX){
    const f=this._frameDescriptor(opponentX,false);
    if(!f) return super.draw(opponentX);
    ctx.save(); ctx.imageSmoothingEnabled=false;
    if(this.isVulnerable && Math.floor(performance.now()/100)%2===0) ctx.globalAlpha=.5;
    const screenX=f.dx-game.cameraX;
    if(f.flipX){
      ctx.translate(screenX+f.dw,0); ctx.scale(-1,1);
      ctx.drawImage(f.img,f.sx,f.sy,f.sw,f.sh,0,f.dy,f.dw,f.dh);
    } else ctx.drawImage(f.img,f.sx,f.sy,f.sw,f.sh,screenX,f.dy,f.dw,f.dh);
    ctx.restore();
  }
}
