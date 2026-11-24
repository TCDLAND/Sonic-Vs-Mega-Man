import { HIGHWAY_WALLS } from './wall-system.js';
import { game, ctx } from './state.js';
import { combatNow } from './combat-clock.js';
import { dealDamage } from './combat-system.js';
import { animationsFor } from './animation-catalog.js';
import { drawRobotFrame, drawRobotShot } from './robot-sprites.js';
import { requestSilverAssist } from './silver.js';
import { requestEggAssist } from './eggman.js';

const cooldown=9000;
const kit={
    sonic:{name:'Windmill',clip:'sonic-battle-windmill',reach:135,damage:9,step:7},
    'metal-sonic':{name:'Fireball Crash',clip:'fireball',reach:135,damage:10,step:8},
    knuckles:{name:'Upper',clip:'upper',reach:104,damage:11,launch:-8},
    shadow:{name:'Shadow Slider',clip:'slider',reach:119,damage:9,step:7},
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
    return roster.map((_,i)=>roster[(active+i+1)%roster.length]).filter(reserve=>reserve!==game[side]);
}

export function resetTeamAssists() {
    game.teamAssists={};
    game.teamAssistReady={p1:0,p2:0};
}

export function canAssist(fighter) {
    return Boolean(fighter && fighter.health>0 && (kit[fighter.characterId] ||
        ['silver','eggman'].includes(fighter.characterId)));
}

export function teamAssistStatus(side) {
    const slots=teamAssistSlots(side);
    const seconds=Math.ceil(Math.max(0,(game.teamAssistReady?.[side]||0)-combatNow())/1000);
    return {slots,seconds};
}

export function requestTeamAssist(side,slot=0,{defensive=false}={}) {
    const now=combatNow(), active=game[side], enemy=game[rivalSide(side)];
    const reserve=teamAssistSlots(side)[slot];
    if (!canAssist(reserve) || !active || !enemy || active.health<=0 ||
        game.teamAssists?.[side] || game.silverAssist?.[side] || game.eggAssists?.[side] ||
        now<(game.teamAssistReady?.[side]||0) || active.tagLockedUntil>now || active.shadowFrozenBy ||
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
    if (started) game.teamAssistReady[side]=now+cooldown;
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

export function interceptTeamAssist(projectile,target) {
    if (!projectile.active || projectile.collisionDisabled) return false;
    const side=target===game.p1?'p1':'p2';
    const a=game.teamAssists?.[side];
    if (!a || a.active!==target || a.reserve===projectile.owner) return false;
    const age=combatNow()-a.started;
    const bounds={x:a.x-a.reserve.width*.29,y:a.floor-a.reserve.height*.78,
        w:a.reserve.width*.58,h:a.reserve.height*.78};
    if (age<90 || age>670 || projectile.x>=bounds.x+bounds.w || projectile.x+projectile.width<=bounds.x ||
        projectile.y>=bounds.y+bounds.h || projectile.y+projectile.height<=bounds.y) return false;
    dealDamage(a.reserve,projectile.damage,{attacker:projectile.owner,attackName:'Impacto a una asistencia',projectile:true});
    delete game.teamAssists[side];
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
            if(a.phase<limit && age>=275+a.phase*115) { fireAssist(a); a.phase++; }
            continue;
        }
        if (age>=160 && age<450 && a.spec.step) a.x=clamp(a.x+a.direction*a.spec.step,270,2320);
        if (a.phase || age<248 || age>=495) continue;
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
