import { combatNow } from './combat-clock.js';
import { updatedCells, updatedFrame } from './fighter-update-art.js';
import { drawRobotFrame } from './robot-sprites.js';

const counts=new Map();
export function windFrame(key,index,x,y,scale,dir,pivot,support) {
    return updatedFrame('sonicBattle',key,index,x,y,scale,dir,pivot,support);
}
export function windCount(key) {
    if (!counts.has(key)) counts.set(key,updatedCells('sonicBattle',key).length);
    return counts.get(key);
}

let effects=[];
export function resetWind() { effects=[]; }
export function emitWind(key,x,y,dir=1,scale=1,alpha=.7,ms=32) {
    if (!Number.isFinite(x+y)) return;
    effects.push({key,x,y,dir,scale,alpha,ms,start:combatNow()});
    if (effects.length>34) effects.shift();
}
export function impactWind(receiver,damage,options,guarded) {
    const {attacker,projectile,hitRect,wind}=options;
    if (!attacker || damage<=0 || wind===false || (!wind && (projectile || damage<8))) return;
    const x=receiver.x+receiver.width/2;
    const dir=x>=attacker.x+(attacker.width||0)/2?1:-1;
    const y=hitRect?Math.max(receiver.y+28,Math.min(receiver.y+receiver.height,hitRect.y+hitRect.h*.65))
        :receiver.y+receiver.height*.75;
    emitWind(wind||(guarded?'arc':damage>=16?'stormFx':'balletFx'),x-dir*22,y,dir,
        Math.min(2.05,1.0+damage/19),guarded?.35:.57);
}
export function drawWind(ctx,cameraX) {
    const now=combatNow();
    effects=effects.filter(effect=>{
        const age=now-effect.start;
        const index=Math.floor(age/effect.ms);
        const count=windCount(effect.key);
        if (index>=count) return false;
        const sway=effect.key==='dust'?age*.065:age*.035;
        drawRobotFrame(ctx,windFrame(effect.key,index,effect.x+effect.dir*sway,effect.y,
            effect.scale,effect.dir),cameraX,effect.alpha*(1-age/(count*effect.ms)*.55));
        return true;
    });
}
