import { formFrame } from './super-forms.js';
import { combatNow } from './combat-clock.js';
import { dealDamage } from './combat-system.js';
import { ctx, game } from './state.js';
import { drawRobotFrame } from './robot-sprites.js';
import { hitRobotMove } from './robot-combat.js';
import { emitWind, windCount, windFrame } from './wind-effects.js';
import { HIGHWAY_WALLS } from './wall-system.js';

const [left,right]=HIGHWAY_WALLS;
const center=f=>f.x+f.width/2;
const clamp=(n,lo,hi)=>Math.max(lo,Math.min(hi,n));
const combo=['jab','kick','top'];
const specs={
    jab:{name:'Sonic Punch',ms:41,damage:5,active:[2,3],range:104,top:114},
    kick:{name:'Sonic Kick',ms:42,damage:7,active:[2,4],range:117,top:101},
    top:{name:'Top Kick',ms:44,damage:9,active:[2,5],range:120,top:116,launch:-7},
    flare:{name:'Sonic Flare',ms:39,damage:15,active:[5,10],range:133,top:123,launch:-6,wind:'arc'},
    upper:{name:'Sonic Updraft',ms:48,damage:11,active:[2,5],range:105,top:163,launch:-12,wind:'balletFx'},
    windmill:{name:'Windmill',ms:42,damage:11,active:[2,6],range:100,top:104,radial:true,speed:12,wind:'vortex'},
    rocket:{name:'Sonic Rocket',ms:54,damage:10,active:[2,4],range:100,top:85,band:126,speed:8,dive:8,wind:'stormFx'},
    eagle:{name:'Sonic Eagle',ms:51,damage:12,active:[3,6],range:121,top:116,speed:15,dive:4,wind:'arc'},
    ballet:{name:'Sonic Ballet',ms:52,speed:10},
    wave:{name:'Sonic Wave',ms:85,spawn:2,shot:'wave'},
    storm:{name:'Sonic Storm',ms:85,spawn:2,shot:'storm'},
    drive:{name:'Sonic Drive',ms:67,frames:12,damage:14,active:[5,10],range:116,top:112,speed:19,wind:'dust'},
    meteor:{name:'Sonic Meteor',ms:69,frames:7,damage:15,active:[2,5],range:86,top:76,band:142,speed:6,dive:15,wind:'stormFx'},
    cracker:{name:'Sonic Cracker',ms:61,spawn:3,shot:'mine'},
    airCracker:{name:'Sonic Air Cracker',ms:61,spawn:3,shot:'mine'},
    heal:{name:'Curación',ms:115,heal:8},
    cycloneKick:{name:'Patada ciclón',ms:53,damage:13,active:[2,5],range:125,top:114,radial:true,wind:'vortex'},
    airRush:{name:'Embestida aérea',ms:44,damage:11,active:[3,6],range:105,top:118,speed:16,wind:'arc'},
    sweepKick:{name:'Barrido rasante',ms:45,damage:9,active:[2,5],range:115,top:72,band:53,lowGuardOnly:true,wind:'dust'},
    barrage:{name:'Ráfaga de puños',ms:48,frames:13,damage:3,active:[3,10],range:173,top:115,wind:false}
};
export const sonicBattleClips={...Object.fromEntries(Object.entries(specs).map(([id,spec])=>[id,spec.name])),
    land:'Aterrizaje',ring:'Anillo de Sonic Drive',fists:'Estelas de puños',balletFx:'Viento de Sonic Ballet',
    waveFx:'Onda terrestre',stormFx:'Onda aérea',vortex:'Remolino',dust:'Polvo de frenado',arc:'Arco de golpe'};

export function startSonicMove(f,key,target) {
    const now=combatNow();
    const spec=specs[key];
    if (!spec || f.isBusy() || f.isVulnerable || f.isIntroActive ||
        (key==='heal' && (f.health>=f.maxHealth || now<(f.sonicHealAt||0)))) return false;
    const direction=center(target)>=center(f)?1:-1;
    const aimUp=Boolean(f.keys[f.controls.jump]);
    f.sonicBattleMove={key,spec,direction,started:now,hit:false,aimUp};
    f.facingDirection=direction;
    f.vx=0;
    if (key==='heal') f.sonicHealAt=now+7500;
    if (key==='ballet') f.sonicBalletUsed=true;
    if (key==='drive') {
        f.sonicBattleMove.ringStart=center(f)+direction*27;
        f.sonicBattleMove.ringX=clamp(center(f)+direction*244,left.x+f.width/2,right.x-f.width/2);
    }
    return true;
}

export function sonicCommand(f,code,target) {
    const c=f.controls;
    const blue=c.attack==='KeyJ', air=!f.isGrounded;
    const down=Boolean(f.keys[c.crouch]);
    const toward=Boolean(f.keys[center(target)>center(f)?c.right:c.left]);
    const away=Boolean(f.keys[center(target)>center(f)?c.left:c.right]);
    let key;
    if (code===c.attack && !air) {
        const now=combatNow(), move=f.sonicBattleMove;
        if (move && combo.indexOf(move.key)>=0 && move.key!=='top' && now-move.started>=80) {
            move.queued=true;
            return true;
        }
        const step=now<(f.sonicComboUntil||0)?(f.sonicComboStep||0):0;
        if (startSonicMove(f,combo[step],target)) {
            f.sonicComboStep=(step+1)%3;
            f.sonicComboUntil=now+850;
        }
        return true;
    }
    if (code===c.heavy) key=air?'rocket':down?'cycloneKick':toward?'barrage':'flare';
    if (code===c.kickLight) key=air?'rocket':down?'sweepKick':'upper';
    if (code===c.kickHeavy) {
        if (air) key=toward&&!down?'airRush':'rocket';
        else if (toward || f.isDashing) {
            if (f.isDashing) { f.isDashing=false; f.dashFrame=0; }
            key='windmill';
        } else if (Math.abs(f.vx)>.5) return false;
        else key='windmill';
    }
    if (code===(blue?'KeyQ':'BracketLeft')) {
        if (air && toward && !down && !f.keys[c.jump]) key='eagle';
        else if (!down && !f.keys[c.jump] && f.startHoming(target)) return true;
        else key=air?'storm':'wave';
    }
    if (code===(blue?'KeyE':'BracketRight')) key=down?(air?'airCracker':'cracker'):(air?'meteor':'drive');
    if (code===c.spinKey && !down && !f.isSpinDashActive) {
        if (air && !f.sonicBalletUsed) key='ballet';
        else if (!air && away && !toward) key='heal';
    }
    if (!key) return false;
    const previous=f.sonicBattleMove;
    const canChain=previous?.hit && combo.includes(previous.key) &&
        ['sweepKick','windmill','cycloneKick'].includes(key) && combatNow()-previous.started>=110;
    if (canChain) f.sonicBattleMove=null;
    if (!startSonicMove(f,key,target) && canChain) f.sonicBattleMove=previous;
    return true;
}

const moveCount=(key,spec)=>spec.frames??windCount(key);
export function updateSonicMove(f) {
    const move=f.sonicBattleMove;
    if (!move) return;
    const {key,spec,direction}=move;
    const tick=Math.floor((combatNow()-move.started)/spec.ms);
    if (f.isHitstunned() || f.isVulnerable || (key==='airRush'&&tick>1&&f.isGrounded) || tick>=moveCount(key,spec)) {
        f.sonicBattleMove=null;
        f.vx=0;
        if (move.queued && !f.isHitstunned() && !f.isVulnerable) {
            const target=f===game.p1?game.p2:game.p1;
            if (target) sonicCommand(f,f.controls.attack,target);
        }
        return;
    }
    if (spec.speed) move.vx=tick>=1&&tick<6?direction*spec.speed:0;
    if (key==='drive') {
        const gap=move.ringX-center(f);
        move.vx=tick>=5&&tick<11&&gap*direction>0?direction*Math.min(spec.speed,Math.abs(gap)):0;
    }
    if (key==='airRush' && tick<7 && !f.isGrounded) f.vy=0;
    if (spec.dive && tick>=2 && !f.isGrounded) f.vy=spec.dive;
    if (key==='ballet' && tick<=3 && !f.isGrounded) {
        f.vy=Math.min(f.vy,-2);
        if (!move.effect) {
            move.effect=true;
            emitWind('balletFx',center(f)-direction*22,f.y+f.height,direction,1.8);
        }
    }
    if (key==='drive' && tick===4 && !move.effect) {
        move.effect=true;
        emitWind('dust',center(f),f.y+f.height,direction,1.65);
    }
    if (spec.shot && tick>=spec.spawn && !move.spawned) {
        move.spawned=true;
        spawnSonicShot(f,move);
    }
    if (spec.heal && tick>=3 && !move.healed) {
        emitWind('arc',center(f),f.y+f.height*.75,1,1.4,.62);
        move.healed=true;
        f.health=Math.min(f.maxHealth,f.health+spec.heal);
    }
}

export function hitSonicMove(f,target) {
    const move=f.sonicBattleMove;
    if (!move?.spec.active) return;
    const {key,spec}=move;
    const tick=Math.floor((combatNow()-move.started)/spec.ms);
    if (key==='barrage' && [3,5,7,10].includes(tick) && move.pulse!==tick) {
        move.hit=false;
        move.pulse=tick;
    }
    const power=key==='barrage' && move.pulse===10?6:spec.damage;
    if(key==='barrage' && move.pulse==null) return;
    const attack={...move,spec:{...spec,key:spec.name,damage:power+(f.superSonic&&key!=='barrage'?2:0)}};
    hitRobotMove(f,target,attack);
    move.hit=attack.hit;
}

function spawnSonicShot(owner,move) {
    const {direction,spec}=move;
    const kind=spec.shot, mine=kind==='mine', air=kind==='storm';
    const created=combatNow();
    const width=mine?31:75,height=mine?25:60;
    game.projectiles.push({
        owner,active:true,type:move.spec.name,damage:mine?12:air?9:8,width,height,
        x:center(owner)+direction*(mine?32:62)-width/2,
        y:mine?owner.y+owner.height-height:air?owner.y+owner.height*.65:owner.feetY-height,
        vx:direction*(mine?2:air?12:14),vy:mine?-.5:move.aimUp?-6:air?3:0,collisionDisabled:mine,
        update() {
            const floor=owner.feetY-height;
            this.x+=this.vx;
            this.y=Math.min(floor,this.y+this.vy);
            if(mine) {
                this.vy+=.45;
                if(this.y>=floor) { this.vx=0; this.vy=0; }
                this.collisionDisabled=combatNow()-created<280 || this.y<floor;
            }
            if(combatNow()-created>(mine?3800:770)||this.x<left.x-width||this.x>right.x||this.y < -height) this.active=false;
        },
        draw(camera) {
            const tick=Math.floor((combatNow()-created)/(mine?120:45));
            const art=mine?'mine':air?'stormFx':'waveFx';
            const index=mine?tick%2:Math.min(windCount(art)-1,tick);
            drawRobotFrame(ctx,windFrame(art,index,this.x+width/2,this.y+height,mine?2.1:1.45,direction),camera);
        },
        onHit() { emitWind(mine?'stormFx':'arc',this.x+width/2,this.y+height,direction,1.55); }
    });
}

let goldAtlas;
function goldSonicAtlas(image) {
    if (goldAtlas) return goldAtlas;
    goldAtlas=document.createElement('canvas');
    goldAtlas.width=image.naturalWidth;
    goldAtlas.height=image.naturalHeight;
    const ctx=goldAtlas.getContext('2d',{willReadFrequently:true});
    ctx.drawImage(image,0,0);
    const pixels=ctx.getImageData(0,0,goldAtlas.width,goldAtlas.height);
    const d=pixels.data;
    for(let i=0;i<d.length;i+=4) {
        const r=d[i],g=d[i+1],b=d[i+2];
        if(d[i+3] && b>59 && b-r>35 && b-g>19) {
            d[i]=clamp(76+b*.69,0,255);
            d[i+1]=clamp(34+b*.72,0,255);
            d[i+2]=clamp(g*.73,0,255);
        }
    }
    ctx.putImageData(pixels,0,0);
    return goldAtlas;
}

export function sonicMoveFrame(f) {
    const move=f.sonicBattleMove;
    if (!move) return null;
    const {direction,key,spec}=move;
    const tick=clamp(Math.floor((combatNow()-move.started)/spec.ms),0,moveCount(key,spec)-1);
    const keyArt=key==='drive'&&tick>=5?'meteor':key;
    const frame=key==='barrage'&&tick>=3&&tick<=10?3+(tick-3)%4
        :key==='barrage'&&tick>10?Math.max(0,12-tick):Math.min(tick,windCount(keyArt)-1);
    const x=center(f), feet=f.y+f.height, scale=f.height/42;
    const barrageActive=key==='barrage' && frame>=3;
    const base=windFrame(keyArt,frame,x,feet,scale,direction);
    const sprite=barrageActive && base?windFrame(keyArt,frame,x,feet,scale*.91,direction,39,base.sh-8):base;
    if (f.superSonic) {
        const mapped=['meteor','wave','storm','ballet','windmill'].includes(keyArt)?'sonicSpin'
            :key==='upper'?'sonicUpper':['rocket','eagle'].includes(key)?'sonicRocket'
            :['kick','top','flare'].includes(key)?'sonicKick':['heal','cracker','airCracker'].includes(key)?'sonicGuard':null;
        if (mapped) return formFrame(mapped,frame,x,feet,f.height/45,direction);
        if (sprite) sprite.img=goldSonicAtlas(sprite.img);
    }
    return sprite;
}

export function drawSonicMoveEffects(f) {
    const move=f.sonicBattleMove;
    if (!move) return;
    const {spec,key,direction}=move;
    const tick=Math.floor((combatNow()-move.started)/spec.ms);
    if (key==='barrage'&&tick>=3&&tick<=10) {
        const phase=(tick-3)%windCount('fists');
        drawRobotFrame(ctx,windFrame('fists',phase,center(f)+direction*100,
            f.y+f.height*.89,1.6,direction),game.cameraX,.37);
    }
    if (key==='drive'&&tick>=4&&tick<=11) {
        const progress=clamp((combatNow()-move.started-4*spec.ms)/95,0,1);
        const x=move.ringStart+(move.ringX-move.ringStart)*progress;
        drawRobotFrame(ctx,windFrame('ring',tick%windCount('ring'),x,f.y+f.height*.65,2.1,direction),game.cameraX);
    }
}
