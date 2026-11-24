import { combatNow } from './combat-clock.js';
import { drawRobotShot } from './robot-sprites.js';
import { ctx, game } from './state.js';
import { worldWidth } from './config.js';

export const BUSTER_CONFIGS = Object.freeze({
  x: { maxLevel: 4, damage: [0,5,12,19,27], force:[0,2,4,6,8], chargeMs:[0,0,700,1450,2500] },
  zero: { maxLevel: 3, damage: [0,6,12,21], force:[0,2,4,8], chargeMs:[0,0,700,1500] },
  rock: { maxLevel: 3, damage: [0,4,12,20], force:[0,2,4,7], chargeMs:[0,0,700,1500] },
  protoman: { maxLevel: 3, damage: [0,6,11,18], force:[0,2,3,4], chargeMs:[0,0,700,1500] }
});

export class BusterProjectile {
  constructor(owner, level, direction) {
    const cfg = owner.busterConfig ?? BUSTER_CONFIGS[owner.characterId];
    this.owner=owner; this.level=level; this.direction=direction;
    if (owner.characterId === 'zero' || owner.characterId === 'rock') this.hitFighters = new WeakSet();
    this.basicShot = level === 1;
    this.damage=cfg.damage[level]; this.projectileForce=cfg.force[level];
    this.type=`buster-${owner.characterId}-${level}`; this.active=true;
    const sizeScale=owner.characterScale||1;
    this.width=(24 + level*10)*sizeScale; this.height=(14 + level*6)*sizeScale;
    this.x=owner.x + (direction>0 ? owner.width : -this.width);
    this.y=owner.getCurrentY() + owner.getCurrentHeight()*0.38;
    this.vx=direction*(15 + level*2);
  }
  update(){ this.x+=this.vx; if(this.x < -100 || this.x > worldWidth+100) this.active=false; }
  draw(cameraX){
    if(this.owner.characterId==='protoman'&&drawRobotShot(ctx,this.level>1?'protoCharge':'protoShot',
      this.x-cameraX,this.y,this.width,this.height,this.direction>0?0:Math.PI))return;
    const centerX=this.x-cameraX+this.width/2;
    const centerY=this.y+this.height/2;
    const radiusX=this.width/2, radiusY=this.height/2;
    const color=this.owner.prototypeColor || '#7fdcff';
    ctx.save();
    ctx.translate(centerX,centerY);
    ctx.scale(this.direction,1);
    ctx.shadowColor=color;
    ctx.shadowBlur=6+this.level*4;
    ctx.fillStyle=color;
    ctx.beginPath(); ctx.ellipse(0,0,radiusX,radiusY,0,0,Math.PI*2); ctx.fill();
    ctx.shadowBlur=0;
    ctx.globalAlpha=.48;
    for(let i=1;i<=this.level;i++){
      const fade=1-i/(this.level+1);
      ctx.beginPath();
      ctx.ellipse(-radiusX*(.75+i*.35),0,radiusX*.42*fade,radiusY*fade,0,0,Math.PI*2);
      ctx.fill();
    }
    ctx.globalAlpha=.95;
    ctx.fillStyle='#f4fbff';
    ctx.beginPath(); ctx.ellipse(radiusX*.22,0,radiusX*.57,radiusY*.53,0,0,Math.PI*2); ctx.fill();
    ctx.restore();
  }
}

export function initBuster(fighter, id){
  const cfg=BUSTER_CONFIGS[id]; if(!cfg) return;
  fighter.hasBuster=true; fighter.busterConfig=cfg; fighter.busterCharging=false; fighter.busterChargeStart=0; fighter.busterChargeLevel=1;
}
export function getBusterLevel(f){
  if(!f.busterCharging || !f.busterConfig) return 1;
  if(game.mode==='practice') return f.busterConfig.maxLevel;
  const elapsed=combatNow()-f.busterChargeStart; let level=1;
  for(let i=2;i<=f.busterConfig.maxLevel;i++) if(elapsed>=f.busterConfig.chargeMs[i]) level=i;
  return level;
}
