import { ctx } from './state.js';
import { worldWidth } from './config.js';

export const BUSTER_CONFIGS = Object.freeze({
  x: { maxLevel: 4, damage: [0,7,14,23,34], force:[0,2,4,7,10], chargeMs:[0,0,650,1350,2250] },
  zero: { maxLevel: 3, damage: [0,6,12,21], force:[0,2,4,8], chargeMs:[0,0,700,1500] },
  rock: { maxLevel: 3, damage: [0,6,12,20], force:[0,2,4,7], chargeMs:[0,0,700,1500] },
  protoman: { maxLevel: 3, damage: [0,6,11,18], force:[0,2,3,4], chargeMs:[0,0,700,1500] }
});

export class BusterProjectile {
  constructor(owner, level, direction) {
    const cfg = BUSTER_CONFIGS[owner.characterId];
    this.owner=owner; this.level=level; this.direction=direction;
    this.damage=cfg.damage[level]; this.projectileForce=cfg.force[level];
    this.type=`buster-${owner.characterId}-${level}`; this.active=true;
    this.width=24 + level*10; this.height=14 + level*6;
    this.x=owner.x + (direction>0 ? owner.width : -this.width);
    this.y=owner.getCurrentY() + owner.getCurrentHeight()*0.38;
    this.vx=direction*(15 + level*2);
  }
  update(){ this.x+=this.vx; if(this.x < -100 || this.x > worldWidth+100) this.active=false; }
  draw(cameraX){
    ctx.save();
    ctx.fillStyle=this.owner.prototypeColor || '#7fdcff';
    ctx.globalAlpha=.9; ctx.fillRect(this.x-cameraX,this.y,this.width,this.height);
    ctx.strokeStyle='#fff'; ctx.lineWidth=2; ctx.strokeRect(this.x-cameraX,this.y,this.width,this.height);
    ctx.restore();
  }
}

export function initBuster(fighter, id){
  const cfg=BUSTER_CONFIGS[id]; if(!cfg) return;
  fighter.hasBuster=true; fighter.busterConfig=cfg; fighter.busterCharging=false; fighter.busterChargeStart=0; fighter.busterChargeLevel=1;
}
export function getBusterLevel(f){
  if(!f.busterCharging || !f.busterConfig) return 1;
  const elapsed=performance.now()-f.busterChargeStart; let level=1;
  for(let i=2;i<=f.busterConfig.maxLevel;i++) if(elapsed>=f.busterConfig.chargeMs[i]) level=i;
  return level;
}
