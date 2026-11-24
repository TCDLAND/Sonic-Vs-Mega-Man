import { HIGHWAY_WALLS } from './wall-system.js';
import { updatedCells } from './fighter-update-art.js';
import { Sonic, SONIC_SHEETS } from './sonic.js';
import { configureCombatant } from './combat-system.js';
import { ctx, game } from './state.js';
import { combatNow } from './combat-clock.js';
import { beginRobotMove, updateRobotMove, hitRobotMove } from './robot-combat.js';
import { drawRobotFrame } from './robot-sprites.js';

const image = new Image();
image.src = 'assets/story/sonic/metal sonic.png';

// Las filas se recortan por sus límites reales. El pivote y la línea de apoyo se
// expresan en píxeles de la hoja, antes de aplicar el espejo.
function row(top, bottom, intervals, img = image) {
    return intervals.map(([left, right, pivot = (right-left)/2, airOffset = 0]) => ({
        img,sx:left,sy:top,sw:right-left,sh:bottom-top,pivot,airOffset
    }));
}
function strip(name, height, intervals) {
    const img = new Image();
    img.src = 'assets/story/sonic/metal-motion/' + name + '.png';
    return row(0, height, intervals, img);
}
const idle=strip('idle',34,[[0,27,15],[31,57,15],[61,88,15],[91,117,15],[119,146,15]]);
const runStart=strip('runStart',32,[[0,27,14],[35,62,15],[64,94,19]]);
const run=strip('run',36,[[0,35,22],[40,68,16],[77,102,14],[107,136,18],[142,172,18],[179,208,18]]);
const brake=strip('brake',36,[[0,30,15],[36,63,15]]);
const jump=strip('jump',36,[[0,28,16],[34,59,15],[67,87,11],[94,114,11],[119,141,11]]);
const falling=strip('fall',47,[[0,22,11],[29,51,11],[56,81,14],[88,110,11],[114,136,11],[141,163,11],[168,195,15]]);
const fall=falling.slice(0,5);
const land=falling.slice(5);
const updated = key => updatedCells('metal', key).map(cell => ({...cell, pivot: cell.sw / 2, airOffset: 0}));
const upper = updated('upper');
const punch = updated('jab').map((cell,index)=>({...cell,pivot:[12,12,13,12,12,10][index]}));
const stab = updated('kick');
const cruise = row(805,860, [[3,66,40,7],[69,131,41,7],[132,201,44,7],[201,263,44,7],
    [263,326,45,7],[328,388,43,7],[393,430,22,7],[433,470,23,7],[472,509,23,7],[511,549,24,7]]);
const drillReady = row(765,802, [[14,41],[46,66],[70,91],[93,114],[117,138],[144,171],[176,196],[204,224],[231,251],[256,276]]);
const drillFlight = row(743,760, [[295,327,17,13],[332,372,23,13],[376,417,25,13],[419,460,26,13]]);
const guard = row(1256,1295, [[11,33],[38,60],[64,88]]);
const orbit = row(1143,1198, [[104,142,18],[142,187,22],[191,238,23],[241,292,26],
    [294,347,26],[351,397,24],[401,464,32]]);
const turn = row(1199,1244, [[7,64,30],[68,101,17],[103,136,17],[136,169,17],[171,204,17]]);
const hurt = row(1048,1090, [[10,35],[42,74],[78,107]]);
const knockback = row(1091,1138, [[6,41],[48,85],[90,125],[135,172]]);
const air = row(877,922, [[4,37],[38,79],[87,130],[133,174],[175,218],[224,260],[267,298],[305,325],[330,350],[355,377]]);
const wall = row(932,978, [[5,31],[39,62],[69,94],[101,128],[132,159],[164,192],[194,225],
    [232,257],[260,283],[289,309],[316,336],[341,363],[371,393]]);
const aim = row(997,1047, [[9,32],[36,59],[63,91],[96,127],[132,157],[161,184],[188,216],[221,251],[257,285]]);
const shadow = row(180,223, [[10,39],[44,73],[79,108],[116,145],[152,181],[186,216],[221,241],
    [245,275],[282,312],[317,346],[352,381],[388,417]]);

export const METAL_SHEETS = {
    idle, idleHurt:[hurt[0], idle[0], idle[1], idle[2], idle[3]],
    runStart, run, brake, reverseBrake:[...brake,...runStart],
    dash:[...cruise.slice(0,8),brake[1]], jump, fall, land, guard,
    punch, topKick:upper, sideKick:stab,
    rocket:[drillReady[2],drillReady[3],...drillFlight,air[6]],
    spinCharge:orbit.slice(0,4), spin:turn, hurt, knockback
};

// Las secuencias especiales de la hoja también se pueden revisar en la guía.
const bonus = {
    metalJab:['Metal Jab',punch],
    metalSwipe:['Metal Swipe',updated('swipe')],
    metalKick:['Metal Kick',stab],
    electricUpper:['Electric Upper',upper],
    fireball:['Fireball Crash',updated('fireball')],
    rocketNew:['Metal Rocket',updated('rocketNew')],
    eagle:['Metal Eagle',updated('eagle')],
    grenade:['Plasma Grenade',updated('grenade')],
    grenadeAir:['Air Plasma Grenade',updated('grenadeAir')],
    pursuit:['Pursuit',updated('pursuit')],
    jetOff:['Jet Deactivation',updated('jetOff')],
    wallNew:['Agarre de pared · hoja nueva',updated('wallNew')],
    shadowDash:['Desplazamiento · Chaos Control',shadow],
    thunder:['Electrical Discharge',updated('thunder')],
    wave:['Heavy · Metal Thunder Wave',row(315,359, [[10,31],[37,58],[66,87],[93,114],[122,145],[148,169],[178,218],[227,283],[295,313],[317,341],[347,365],[373,392],[401,425],[433,452],[459,477],[488,512],[522,540],[553,573],[583,610]])],
    cannon:['Electric Bolt · suelo',updated('cannon')],
    cannonShot:['Proyectil · G1 Metal Cannon',row(516,541,[[120,134],[139,153],[157,171],[179,193],[201,224],[228,255],[260,290],[295,316],[322,366],[375,419]])],
    waveShot:['Proyectil · Metal Thunder Wave',row(315,359,[[295,313],[317,341],[347,365],[373,392]])],
    cannonAir:['Electric Bolt · aire',updated('cannonAir')],
    electric:['Electric Bolt · efecto',updated('electric')],
    diamond:['Black Shield',updated('diamond').filter((_,i)=>i!==4)],
    trap:['Taladro · preparación en suelo',row(703,742, [[3,30],[35,55],[59,80],[81,102],[106,127],[133,160],[169,189]])],
    drill:['Taladro · preparación en aire',drillReady],
    dashTail:['Rastro · Dash Attack',cruise.slice(8)],
    air:['Diamond Thunder',air],
    wall:['Rebote · Metal/Rebound',wall],
    aim:['Ataque dirigido · Rebound Thunder',aim],
    guardOrbit:['Guardia · órbita',orbit],
    world:['Over World',row(1424,1456,[[4,27],[29,54]])]
};

const metalTechniques = {
    metalJab: { key:'metalJab',ms:47,damage:5,active:[2,3],range:115,top:118,band:68 },
    metalSwipe: { key:'metalSwipe',ms:42,damage:7,active:[3,5],range:126,top:130,band:97,speed:3.1 },
    metalKick: { key:'metalKick',ms:45,damage:9,active:[2,4],range:127,top:108,band:75,speed:3 },
    electricUpper: { key:'electricUpper',ms:38,damage:10,active:[4,8],range:109,top:163,band:127,launch:-9 },
    fireball: { key:'fireball',ms:56,damage:12,active:[1,4],range:108,top:111,band:92,speed:16,travel:[1,4] },
    rocketNew: { key:'rocketNew',ms:57,damage:10,active:[2,4],range:110,top:77,band:119,speed:9,travel:[2,4],dive:8 },
    eagle: { key:'eagle',ms:52,damage:12,active:[2,5],range:123,top:132,speed:14,travel:[1,4],dive:3 },
    jetOff: { key:'jetOff',ms:64,dive:13 },
    grenade: { key:'grenade',ms:59,shot:3 },
    grenadeAir: { key:'grenadeAir',ms:57,shot:3 },
    beam: { key:'cannon', ms:78, frames:10, damage:16, active:[4,5], range:315, top:99, band:44 },
    cannon: { key: 'cannon', ms: 54, shot: 3 },
    cannonAir: { key: 'cannonAir', ms: 54, shot: 3 },
    wave: { key: 'wave', ms: 71, shot: 5, frames: 7 },
    diamond: { key: 'diamond', ms: 47 },
    air: { key: 'air', ms: 48, damage: 10, active: [1, 4], range: 92, top: 113 },
    thunder: { key: 'thunder', ms: 42, damage: 14, active: [6, 14], range: 96, top: 120, radial: true }
};
for (const spec of Object.values(metalTechniques)) spec.frames ??= bonus[spec.key][1].length;

const sources = new WeakMap();
const trimmed = new WeakMap();
function crop(cell) {
    if (trimmed.has(cell)) return trimmed.get(cell);
    const image = cell.img;
    let pixels = sources.get(image);
    if (!pixels) {
        const canvas=document.createElement('canvas');
        canvas.width=image.naturalWidth; canvas.height=image.naturalHeight;
        const context=canvas.getContext('2d',{willReadFrequently:true});
        context.drawImage(image,0,0);
        pixels=context.getImageData(0,0,canvas.width,canvas.height);
        sources.set(image,pixels);
    }
    let left=cell.sw, right=-1, top=cell.sh, bottom=-1;
    for(let y=0;y<cell.sh;y++)for(let x=0;x<cell.sw;x++) {
        if(pixels.data[((cell.sy+y)*pixels.width+cell.sx+x)*4+3]<16)continue;
        left=Math.min(left,x); right=Math.max(right,x); top=Math.min(top,y); bottom=Math.max(bottom,y);
    }
    const result=right<left ? cell : {sx:cell.sx+left,sy:cell.sy+top,sw:right-left+1,sh:bottom-top+1,
        pivot:cell.pivot-left,airOffset:cell.airOffset};
    trimmed.set(cell,result);
    return result;
}

export function metalSpriteFrame(key, frame, x, feet, scale, direction = 1) {
    const cells = METAL_SHEETS[key] ?? bonus[key]?.[1];
    if (!cells?.length) return null;
    const cell=cells[Math.max(0,frame) % cells.length];
    if (!cell.img.complete || !cell.img.naturalWidth) return null;
    const { sx, sy, sw, sh, pivot, airOffset } = crop(cell);
    const flipX = direction < 0;
    return { img:cell.img,sx,sy,sw,sh,flipX,frame,key,
        dx:x-(flipX?sw-pivot:pivot)*scale,dy:feet-(sh+airOffset)*scale,dw:sw*scale,dh:sh*scale };
}

export class MetalSonic extends Sonic {
    constructor(x, y, controls) {
        super(x, y, controls, { metal: true });
        this.characterName = 'METAL SONIC';
        configureCombatant(this, 'metal-sonic', this.characterName);
        this.infected = false;
        this.comboStep=0;
        this.reboundAt = -Infinity;
        this.motion = { running: false, direction: 1, runAt: -Infinity, stopAt: -Infinity, airAt: -Infinity, landAt: -Infinity };
    }

    isBusy() { return super.isBusy() || !!this.robotMove; }
    isAttacking() { return super.isAttacking() || !!this.robotMove; }

    beginMetalTechnique(key, target) {
        const spec = metalTechniques[key];
        if (!spec || this.isBusy() || this.isVulnerable || this.isHitstunned()) return false;
        const direction=target.x+target.width/2<this.x+this.width/2?-1:1;
        this.facingDirection=direction;
        return beginRobotMove(this, spec, direction);
    }

    startWallHop(side) {
        this.reboundAt = combatNow();
        this.reboundDirection = side === 'left' ? 1 : -1;
    }

    handleMetalCommand(code, target) {
        const c=this.controls;
        const blue = c.attack === 'KeyJ';
        const down=Boolean(this.keys[c.crouch]);
        const direction=target.x+target.width/2>=this.x+this.width/2?1:-1;
        const toward=Boolean(this.keys[direction>0?c.right:c.left]);
        if (code===c.attack) {
            const move=this.robotMove;
            if (move && ['metalJab','metalSwipe'].includes(move.spec.key) && move.hit &&
                combatNow()-move.started>=move.spec.active[0]*move.spec.ms) {
                this.comboQueued=true;
                return true;
            }
            if (combatNow()>(this.comboUntil||0)) this.comboStep=0;
            const key=['metalJab','metalSwipe','metalKick'][this.comboStep];
            if (this.beginMetalTechnique(key,target)) {
                this.comboStep=(this.comboStep+1)%3;
                this.comboUntil=combatNow()+840;
            }
            return true;
        }
        if (code===c.heavy) { this.beginMetalTechnique('electricUpper',target); return true; }
        if (code===c.kickLight) { this.beginMetalTechnique('metalKick',target); return true; }
        if (code===c.kickHeavy) {
            if (!this.isGrounded) this.beginMetalTechnique(down?'jetOff':toward?'eagle':'rocketNew',target);
            else if (toward || down) this.beginMetalTechnique('fireball',target);
            else if (Math.abs(this.vx)>.5) this.startBrake(Boolean(this.keys[this.vx>0?c.left:c.right]));
            else this.beginMetalTechnique('fireball',target);
            return true;
        }
        if (code === (blue ? 'KeyQ' : 'BracketLeft')) {
            const toward = target.x >= this.x ? this.controls.right : this.controls.left;
            this.beginMetalTechnique(this.isGrounded
                ? (this.keys[this.controls.crouch] ? 'thunder' : this.keys[toward] ? 'beam' : 'cannon')
                : 'cannonAir', target);
        } else if (code === (blue ? 'KeyE' : 'BracketRight')) {
            const key=down?(toward&&this.isGrounded?'wave':this.isGrounded?'grenade':'grenadeAir')
                :this.isGrounded?'diamond':'air';
            this.beginMetalTechnique(key,target);
        }
    }

    tryHit(target) { hitRobotMove(this, target); }

    blocksProjectile() {
        if (this.robotMove?.spec.key !== 'diamond') return false;
        const index = Math.floor((combatNow() - this.robotMove.started) / this.robotMove.spec.ms);
        return index >= 1 && index <= 4;
    }

    spawnGrenade(direction) {
        const owner=this;
        const created=combatNow();
        const center=this.x+this.width/2;
        game.projectiles.push({
            owner,active:true,type:'Plasma Grenade',damage:13,
            x:center-8+direction*36,y:this.y+this.height*.66,width:16,height:16,vx:direction*5,vy:-2,
            update() {
                if (combatNow()-created>1400) { this.active=false; return; }
                if (this.y+this.height>=owner.feetY) { this.vx=0; this.vy=0; return; }
                this.x=Math.max(HIGHWAY_WALLS[0].x,Math.min(HIGHWAY_WALLS[1].x-16,this.x+this.vx));
                this.vy+=.55;
                this.y=Math.min(owner.feetY-this.height,this.y+this.vy);
            },
            draw(camera) {
                const tick=Math.floor((combatNow()-created)/68);
                drawRobotFrame(ctx,metalSpriteFrame('electric',tick,this.x+8,this.y+16,.95,direction),camera);
            }
        });
    }

    spawnShot(direction, wave) {
        const scale = this.height / 45;
        const created = combatNow();
        const width = (wave ? 21 : 11) * scale;
        const height = (wave ? 26 : 11) * scale;
        game.projectiles.push({
            owner: this, active: true, type: wave ? 'Metal Thunder Wave' : 'Metal Cannon', damage: wave ? 13 : 9,
            x: this.x + this.width / 2 + direction * 22 * scale - width / 2,
            y: this.y + this.height * (wave ? .42 : .5), width, height,
            vx: direction * (wave ? 8 : 13), vy: 0,
            update() {
                this.x += this.vx;
                this.active = combatNow() - created < (wave ? 950 : 1300);
            },
            draw(camera) {
                const age = combatNow() - created;
                const tick = Math.floor(age / (wave ? 64 : 45));
                const index = wave ? (age >= 880 ? 3 : tick % 3) : tick % 6;
                const key = wave ? 'waveShot' : 'electric';
                const source = metalSpriteFrame(key, index, 0, 0, 1, direction);
                if (!source) return;
                const visualScale = Math.min(scale, this.width * 1.5 / source.sw, height * 1.25 / source.sh);
                const centerX = this.x + this.width / 2;
                const feet = this.y + (height + source.sh * visualScale) / 2;
                drawRobotFrame(ctx, metalSpriteFrame(key, index, centerX, feet, visualScale, direction), camera);
            }
        });
    }

    update(opponentX, self) {
        const move = this.robotMove;
        if (move) {
            if (!move.fired && move.spec.shot != null && combatNow() - move.started >= move.spec.shot * move.spec.ms) {
                move.fired = true;
                if (['grenade','grenadeAir'].includes(move.spec.key)) this.spawnGrenade(move.direction);
                else this.spawnShot(move.direction, move.spec.key === 'wave');
            }
            const tick=Math.floor((combatNow()-move.started)/move.spec.ms);
            if (move.spec.dive && tick>=(move.spec.key==='jetOff'?1:2) && tick<=4 && !this.isGrounded) this.vy=move.spec.dive;
            updateRobotMove(this);
            if (!this.robotMove && this.comboQueued) {
                this.comboQueued=false;
                const target=this===game.p1?game.p2:game.p1;
                if (target) this.handleMetalCommand(this.controls.attack,target);
            }
        }
        const ground = this.isGrounded;
        const previousX = this.x;
        const wasRocket = this.rocketActive;
        super.update(opponentX,self);
        const now=combatNow(), motion=this.motion;
        if (!this.isGrounded && now - this.reboundAt < 105 && !this.isHitstunned()) {
            this.x = previousX + this.reboundDirection * 7;
            this.wallSliding = false;
        }
        const moving=this.isGrounded && Math.abs(this.vx)>.2 && !this.isBusy() && !this.isGuarding && !this.isCrouching;
        if (moving && (!motion.running || Math.sign(this.vx)!==motion.direction)) {
            motion.runAt=now;
            motion.direction=Math.sign(this.vx);
        }
        if (!moving && motion.running && this.isGrounded && !this.isBusy() && !this.isGuarding) motion.stopAt=now;
        if (ground&&!this.isGrounded) motion.airAt=now;
        if (!ground&&this.isGrounded) {
            motion.landAt=now;
            if (wasRocket) motion.direction=this.rocketDirection;
        }
        motion.running=moving;
    }

    startBrake(reverse = false) {
        const direction = Math.sign(this.vx || this.dashDirection || this.motion.direction);
        const started = super.startBrake(reverse);
        if (started) this.motion.direction = direction;
        return started;
    }

    onDamageTaken({stagger=true}={}) { if(!stagger)return;
        if (!this.lastGuardImpact?.blocked) {
            this.metalHurtAt = combatNow();
            this.robotMove = null;
            this.comboStep=0;
            this.comboQueued=false;
            this.reboundAt = -Infinity;
            this.rocketActive = false;
            this.rocketTimer = 0;
            this.brakeActive = false;
            this.reverseBrakeActive = false;
            this.isDashing = false;
        }
    }

    getMetalFrame(opponentX = this.x) {
        const age = combatNow() - (this.metalHurtAt ?? -Infinity);
        const move = this.robotMove;
        if (move) {
            const frame = Math.min(move.spec.frames - 1, Math.floor((combatNow() - move.started) / move.spec.ms));
            return metalSpriteFrame(move.spec.key, frame, this.x + this.width / 2, this.y + this.height, this.height / 45, move.direction);
        }
        const reboundAge = combatNow() - this.reboundAt;
        if (!this.isGrounded && !this.isBusy() && reboundAge < 300) {
            const frame = Math.min(wall.length - 1, Math.floor(reboundAge / 24));
            return metalSpriteFrame('wall', frame, this.x + this.width / 2, this.y + this.height, this.height / 45, this.reboundDirection);
        }
        if (this.wallSliding && !this.isBusy() && age>=155) {
            const direction=this.x+this.width/2>1300?1:-1;
            return metalSpriteFrame('wallNew',0,this.x+this.width/2,this.y+this.height,this.height/45,direction);
        }
        let [key, tick] = this.pickAnimation(opponentX);
        if (this.wasInAirFromKnockback) { key = 'knockback'; tick = Math.min(3, Math.floor(age / 67)); }
        else if (age < 155) { key = 'hurt'; tick = Math.min(2, Math.floor(age / 52)); }
        else if (this.isGuarding && ['idle', 'idleHurt', 'run'].includes(key)) { key = 'guard'; tick = 0; }
        const now=combatNow();
        const motion=this.motion;
        if (key==='run' && motion.running && now-motion.runAt<156) key='runStart';
        if (['idle','idleHurt','run','runStart'].includes(key) && this.isGrounded) {
            if (now-motion.landAt<100) key='land';
            else if (!motion.running && now-motion.stopAt<130) key='brake';
        }
        const count = SONIC_SHEETS[key]?.[1] ?? METAL_SHEETS[key].length;
        const frames=METAL_SHEETS[key].length;
        const animationAge=now-this.sonicAnimStarted;
        const spinCycles=this.spinChargeLevel===1?4:this.spinChargeLevel===2?8:16;
        const index=key==='runStart'?Math.floor((now-motion.runAt)/52)
            : key==='run'?Math.floor((now-(Number.isFinite(motion.runAt)?motion.runAt:this.sonicAnimStarted)-156)/(this.walkReverse?145:57))%frames
            : key==='reverseBrake'?Math.floor(this.brakeTimer*frames/16)
            : key==='fall'?Math.floor(Math.max(0,this.vy)/3.2)
            : key==='land'?Math.floor((now-motion.landAt)/50)
            : key==='spin'?Math.floor(animationAge*spinCycles*frames/1000)%frames
            : key==='jump'?(now-motion.airAt<32?0:Math.floor((this.vy-this.jumpForce)/(-this.jumpForce)*frames))
            : key==='brake'?Math.floor((this.brakeActive?tick*48:now-motion.stopAt)/65)
            : Math.floor(tick*frames/count);
        const time=key==='dash'?this.dashFrame/Math.max(1,this.dashFrames.length-1)
            : key==='punch'?this.jabTimer/11 : key==='topKick'?this.kickLightTimer/11
            : key==='sideKick'?this.kickHeavyTimer/11 : null;
        const rocket=this.rocketTimer;
        const requested=key==='rocket'?(rocket<8?Math.floor(rocket/4):rocket>=37?frames-1:2+Math.floor((rocket-8)/3)%4)
            : time==null?index:Math.floor(time*frames);
        const frame=Math.max(0,Math.min(frames-1,requested));
        let direction=Math.sign(opponentX-this.x) || this.facingDirection || 1;
        if(Math.abs(this.vx)>.1&&!this.isGuarding&&key!=='knockback')direction=Math.sign(this.vx);
        if(['brake','land'].includes(key))direction=motion.direction;
        if(key==='reverseBrake')direction=tick>=2?this.brakeTargetDirection||direction:-(this.brakeTargetDirection||-direction);
        const feet = this.isGrounded ? this.feetY : this.y + this.height;
        return metalSpriteFrame(key, frame, this.x + this.width / 2, feet, this.height / 45, direction);
    }

    getPixelBodyFrame(opponentX) {
        const f = this.getMetalFrame(opponentX);
        if (!f) return f;
        if (this.robotMove && ['thunder','diamond','eagle','fireball','electricUpper','grenade','grenadeAir'].includes(f.key)) {
            return metalSpriteFrame('idle',0,this.x+this.width/2,this.y+this.height,this.height/45,
                this.robotMove.direction);
        }
        const scale=f.dh/f.sh;
        const center=(this.x+this.width/2-f.dx)/scale;
        const hasTrail=['dash','spin','spinCharge','rocket','diamond','air','thunder'].includes(f.key);
        const left=hasTrail?Math.max(0,Math.floor(center-16)):0;
        const right=hasTrail?Math.min(f.sw,Math.ceil(center+18)):f.sw;
        const top=f.key==='topKick'?Math.max(0,f.sh-35):0;
        if(right<=left)return f;
        return { ...f,sx:f.sx+(f.flipX?f.sw-right:left),sw:right-left,dx:f.dx+left*scale,dw:(right-left)*scale,
            sy:f.sy+top,sh:f.sh-top,dy:f.dy+top*scale,dh:(f.sh-top)*scale };
    }

    draw(opponentX) {
        const frame = this.getMetalFrame(opponentX);
        drawRobotFrame(ctx, frame, game.cameraX);
        const move=this.robotMove;
        if (move?.spec === metalTechniques.beam) this.drawBeam(move);
        if (this.infected && frame && !['spin', 'spinCharge', 'knockback'].includes(frame.key)) {
            ctx.save();
            ctx.globalAlpha = .25 + .20 * Math.sin(combatNow() / 95);
            ctx.fillStyle = '#ff4967';
            ctx.fillRect(this.x + this.width * .5 - game.cameraX, frame.dy + frame.dh * .25, 4, 3);
            ctx.restore();
        }
    }

    drawBeam(move) {
        const tick=Math.floor((combatNow()-move.started)/move.spec.ms);
        if (tick<2 || tick>5) return;
        const x=this.x+this.width/2-game.cameraX, y=this.y+this.height-77;
        const end=x+move.direction*(tick<4?95:315);
        ctx.save();
        ctx.strokeStyle=tick<4?'#9678ff':'#7bb7ff';
        ctx.lineWidth=tick<4?2:15;
        ctx.beginPath(); ctx.moveTo(x,y);
        for(let i=1;i<8;i++)ctx.lineTo(x+(end-x)*i/8,y+Math.sin(i*3+tick)*8);
        ctx.lineTo(end,y); ctx.stroke();
        ctx.strokeStyle='#f2f7ff'; ctx.lineWidth=2; ctx.stroke();
        ctx.restore();

    }
}

export function metalAnimations() {
    const moves = Object.entries(METAL_SHEETS).map(([id, cells]) => ({
        id, name: ({ idle:'Reposo', idleHurt:'Reposo dañado', runStart:'Arranque de carrera', run:'Carrera · bucle', land:'Aterrizaje', brake:'Frenada', reverseBrake:'Giro de frenada',
            dash:'Dash', jump:'Salto', fall:'Caída', guard:'Guardia', punch:'Puño', topKick:'Ataque ascendente',
            sideKick:'Golpe lateral', rocket:'Rocket aéreo', spinCharge:'Carga Spin Dash', spin:'Spin Dash',
            hurt:'Impacto', knockback:'Retroceso' })[id],
        count: cells.length, ms: ({ run:57, runStart:52, brake:65, land:50, idle:130 })[id] ?? 75,
        frame(index) { return metalSpriteFrame(id, index, 0, 0, 1); }
    }));
    return [...moves,...Object.entries(bonus).map(([id,[name,cells]])=>({
        id,name,count:cells.length,ms:85,frame(index){return metalSpriteFrame(id,index,0,0,1);}
    }))];
}
