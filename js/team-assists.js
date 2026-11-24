import { HIGHWAY_WALLS } from './wall-system.js';
import { game, ctx } from './state.js';
import { combatNow } from './combat-clock.js';
import { dealDamage } from './combat-system.js';
import { animationsFor } from './animation-catalog.js';
import { drawRobotFrame, drawRobotShot } from './robot-sprites.js';
import { requestSilverAssist } from './silver.js';
import { requestEggAssist } from './eggman.js';

const cooldown=1200;
const kit={
    sonic:{name:'Windmill',clip:'sonic-battle-windmill',reach:135,damage:9,step:7},
    'metal-sonic':{name:'Fireball Crash',clip:'fireball',reach:135,damage:10,step:8},
    knuckles:{name:'Upper',clip:'upper',reach:104,damage:11,launch:-8},
    shadow:{name:'Shadow Slider',clip:'slider',reach:119,damage:9,step:7},
    espio:{name:'Golpe ninja',clip:'jab',reach:110,damage:8,step:5},
    zero:{name:'Z-Saber',clip:'saber',reach:122,damage:10,step:5},
    'megaman-zero':{name:'Z-Saber',clip:'saber',reach:122,damage:10,step:5},
    chaos:{name:'Brazo de Chaos',clip:'attack',reach:130,damage:9,step:4},
    tails:{name:'Tail Swipe',clip:'attack',reach:110,damage:8,step:5},
    wily:{name:'Disparo de apoyo',clip:'shot',shot:true,damage:8},
    emerl:{name:'Golpe de apoyo',clip:'punch',reach:108,damage:9,step:5},
    x:{name:'Buster',clip:'shot',shot:true,damage:9},
    rock:{name:'Mega Buster',clip:'fire',shot:true,damage:7},
    bass:{name:'Ráfaga Bass Buster',clip:'upShot',shot:true,burst:true,damage:3},
    protoman:{name:'Ráfaga Proto Buster',clip:'shot',shot:true,burst:true,damage:4}
};
const center=f=>f.x+f.width/2;
const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
const rivalSide=side=>side==='p1'?'p2':'p1';

export function teamAssistSlots(side) {
    const roster=game.teamFighters?.[side]??[];
    const active=game.teamActiveIndex?.[side]??0;
    return roster.filter((_,index)=>index!==active);
}

export function resetTeamAssists() {
    game.teamAssists={};

}

export function canAssist(fighter) {
    return Boolean(fighter && fighter.health>0 && (kit[fighter.characterId] ||
        ['silver','eggman'].includes(fighter.characterId)));
}

export function requestTeamAssist(side,slot=0,{defensive=false}={}) {
    const now=combatNow(), active=game[side], enemy=game[rivalSide(side)];
    const reserve=teamAssistSlots(side)[slot];
    if (!canAssist(reserve) || !active || !enemy || active.health<=0 ||
        game.teamAssists?.[side] || game.silverAssist?.[side] || game.eggAssists?.[side] ||
        now<(reserve.teamAssistReadyAt||0) || active.tagLockedUntil>now || active.shadowFrozenBy ||
        !['0','go'].includes(game.countdown?.phase)) return false;
    let started;
    if (reserve.characterId==='silver') started=requestSilverAssist(side,slot===1&&!defensive,reserve);
    else if (reserve.characterId==='eggman') started=requestEggAssist(side,slot===1,reserve);
    else {
        const spec=kit[reserve.characterId];
        if (!spec) return false;
        const direction=center(enemy)>=center(active)?1:-1;
        const x=clamp(center(active)-direction*58,270,2320);
        game.teamAssists[side]={active,reserve,spec,direction,x,started:now,floor:active.feetY,phase:0};
        started=true;
    }
    if (started) reserve.teamAssistReadyAt=now+825+cooldown;
    return started;
}

function fireAssist(assist) {
    const {reserve,direction,spec}=assist;
    const age=combatNow(), art=reserve.characterId==='protoman'?'protoShot':null;
    game.projectiles.push({
        owner:reserve,active:true,type:spec.name,damage:spec.damage,
        x:assist.x+direction*45-13,y:assist.floor-reserve.height*.60,width:29,height:22,vx:direction*14,
        update(){ this.x+=this.vx; if (combatNow()-age>=890 || this.x<HIGHWAY_WALLS[0].x-1 || this.x>HIGHWAY_WALLS[1].x)this.active=false; },
        draw(camera){
            if(art&&drawRobotShot(ctx,art,this.x-camera,this.y,this.width,this.height,direction>0?0:Math.PI))return;
            ctx.fillStyle='#fff49b';ctx.fillRect(this.x-camera,this.y+6,this.width,9);
        }
    });
}

export function hitTeamAssist(target, attacker, rect, damage, projectile = false) {
    const side = target === game.p1 ? 'p1' : 'p2';
    if (game[side] !== target || !attacker || attacker === target ||
        game.teamFighters?.[side]?.includes(attacker) || !(damage > 0)) return false;
    const group = [game.teamAssists,game.silverAssist,game.eggAssists].find(item=>item?.[side]);
    const assist = group?.[side];
    if (!assist || assist.active !== target) return false;
    const reserve = assist.reserve ?? assist.silver;
    const age = combatNow()-assist.started;
    if (age < 45 || age >= 700) return false;
    const centerX = assist.origin ? assist.origin.x + assist.origin.width/2 :
        assist.silver ? assist.x-assist.dir*58*(1-Math.min(1,age/168)) : assist.x;
    const foot = assist.origin ? assist.origin.y+assist.origin.height : assist.floor ?? assist.y;
    const half = reserve.width*.29;
    if (rect.x >= centerX+half || rect.x+rect.w <= centerX-half ||
        rect.y >= foot || rect.y+rect.h <= foot-reserve.height*.78) return false;
    delete group[side];
    dealDamage(reserve,damage,{attacker,attackName:'Castigo de asistencia',projectile,impactX:rect.x});
    return true;
}

export function interceptTeamAssist(projectile,target) {
    if (!projectile.active || projectile.collisionDisabled) return false;
    const {x,y,width:w,height:h}=projectile;
    if (!hitTeamAssist(target,projectile.owner,{x,y,w,h},projectile.damage,true)) return false;
    projectile.active=false;
    return true;
}

export function tickTeamAssists() {
    for (const [side,a] of Object.entries(game.teamAssists??{})) {
        const age=combatNow()-a.started;
        const target=game[rivalSide(side)];
        if (age>=825 || a.active!==game[side] || a.reserve.health<=0 || !target || target.health<=0) {
            delete game.teamAssists[side];
            continue;
        }
        if(a.spec.shot) {
            const limit=a.spec.burst?3:1;
            if(a.phase<limit && age>=320+a.phase*95) { fireAssist(a); a.phase++; }
            continue;
        }
        if (age>=160 && age<450 && a.spec.step) a.x=clamp(a.x+a.direction*a.spec.step,270,2320);
        if (a.phase || age<320 || age>=495) continue;
        const gap=(center(target)-a.x)*a.direction;
        if(gap< -45 || gap>a.spec.reach || target.getCurrentY()+target.getCurrentHeight()<a.floor-115) continue;
        a.phase=1;
        dealDamage(target,a.spec.damage,{attacker:a.reserve,attackName:a.spec.name,impactX:a.x,wind:'balletFx'});
        if(a.spec.launch && !target.lastGuardImpact?.front) {
            target.vy=a.spec.launch;target.isGrounded=false;target.wasInAirFromKnockback=true;
        }
    }
}

const clipCache=new Map();
export function drawTeamAssists() {
    for(const a of Object.values(game.teamAssists??{})) {
        const age=combatNow()-a.started;
        const id=a.reserve.characterId;
        if (!clipCache.has(id)) {
            const clips=animationsFor(id);
            clipCache.set(id,clips.find(c=>c.id===a.spec.clip)??clips.find(c=>c.id==='idle')??clips[0]);
        }
        const clip=clipCache.get(id);
        const frame=clip?.frame(clamp(Math.floor((age-80)/Math.max(42,clip.ms)),0,clip.count-1));
        if (!frame) continue;
        const scale=a.reserve.height/(frame.sh+7);
        const alpha=clamp(Math.min(age/135,(825-age)/160),0,1);
        drawRobotFrame(ctx,{...frame,flipX:Boolean(frame.flipX)!==(a.direction<0),
            dx:a.x-frame.sw*scale/2,dy:a.floor-frame.sh*scale,dw:frame.sw*scale,dh:frame.sh*scale},
            game.cameraX,alpha);
    }
}
