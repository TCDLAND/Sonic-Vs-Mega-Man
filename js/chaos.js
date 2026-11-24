import { PrototypeFighter } from './prototype-fighter.js';
import { ctx, game } from './state.js';
import { combatNow } from './combat-clock.js';
import { configureCombatant, dealDamage } from './combat-system.js';
import { beginRobotMove, hitRobotMove, updateRobotMove } from './robot-combat.js';
import { HIGHWAY_WALLS } from './wall-system.js';
import { drawRobotFrame } from './robot-sprites.js';
import { opaqueInRect } from './pixel-collision.js';
import { CHAOS_FRAMES } from './chaos-frames.js';

const atlas = new Image();
atlas.src = 'assets/images/chaos/atlas.png';
const dive = [0,1,2,...Array.from({length:16},(_,i)=>3+i%4),7,8,9];
const combo = ['stretch', 'elastic', 'flexible'];
const clamp = (value, lo, hi) => Math.min(hi, Math.max(lo, value));
const center = fighter => fighter.x + fighter.width / 2;

function frame(key, index, x, feet, scale, direction = 1) {
    if (!atlas.complete || !atlas.naturalWidth) return null;
    const cells = CHAOS_FRAMES[key];
    const [sx,sy,sw,sh] = cells[clamp(index, 0, cells.length - 1)];
    const pivot = ({stretch:.32, flexible:.36, rocket:.46})[key] ?? .5;
    const mirrored = direction < 0;
    return { img:atlas, sx,sy,sw,sh, flipX:mirrored,
        dx:x-sw*scale*(mirrored ? 1-pivot : pivot), dy:feet-sh*scale, dw:sw*scale, dh:sh*scale };
}

const moves = {
    stretch: { active:[3,4], damage:6, range:103, top:105 },
    elastic: { active:[3,4], damage:8, range:96, top:108 },
    flexible: { active:[3,5], damage:11, range:125, top:110, launch:-6 },
    doubleStab: { pose:'heavy', ms:49, active:[4,8], damage:14, range:136, top:119, effect:'stabFx' },
    upper: { pose:'heavy', ms:48, active:[4,8], damage:12, range:94, top:175, effect:'upperFx', launch:-14 },
    crush: { pose:'heavy', ms:49, active:[5,9], damage:13, range:113, top:116, effect:'stabFx' },
    airCrush: { active:[3,6], damage:13, range:105, top:112, drop:10 },
    dolphin: { active:[2,4], damage:12, range:123, top:125, speed:12 },
    rocket: { active:[2,6], damage:10, range:108, top:105, speed:9 },
    impact: { pose:'rocket', active:[2,6], damage:13, range:115, top:102, drop:11 },
    aim: { frames:5, speed:18 },
    shot: { shot:3 },
    airShot: { shot:3 },
    splash: { pose:'dash', trap:3 },
    airSplash: { trap:4, drop:9 },
    heal: { ms:115, heal:3 }
};
for (const [key, spec] of Object.entries(moves)) {
    Object.assign(spec, {key, pose:spec.pose ?? key, ms:spec.ms ?? 53});
    spec.frames ??= CHAOS_FRAMES[spec.pose].length;
}

const specials = {
    special_arm_wrap: { duration:1230, pose:'stretch' },
    special_three_puddles: { duration:1750, pose:'dash' },
    ultimate_chaos4_flood: { cost:100, duration:3020, pose:'dash' },
    ultimate_perfect_chaos: { cost:100, duration:2090, pose:'dash' }
};
const passStarts = [660, 1130, 1600, 2070];
const passDuration = 395;
const puddleButtons = fighter => [fighter.controls.attack, fighter.controls.heavy, fighter.controls.kickLight];

function overlapsTarget(target, rect, impactX) {
    if (target.shieldIntersects?.(rect)) return true;
    if (target.pixelBodyIntersectsRect) return target.pixelBodyIntersectsRect(rect, impactX);
    return target.x < rect.x+rect.w && target.x+target.width > rect.x &&
        target.getCurrentY() < rect.y+rect.h && target.getCurrentY()+target.getCurrentHeight()>rect.y;
}

function ripple(x, y, radius, phase) {
    const screenX = x - game.cameraX;
    ctx.save();
    ctx.fillStyle = '#108ddd85';
    ctx.strokeStyle = '#9eecff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(screenX, y, radius, 5 + radius * .08, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    for (let i=0;i<3;i++) {
        const t = (phase + i / 3) % 1;
        ctx.globalAlpha = 1-t;
        ctx.beginPath();
        ctx.arc(screenX + (i-1)*radius*.55, y-2-t*20, 2+t*4, 0, Math.PI*2);
        ctx.stroke();
    }
    ctx.restore();
}

function liquidShot(owner, direction, trap) {
    const born = combatNow();
    const size = trap ? 74 : 31;
    game.projectiles.push({
        owner, active:true, type:trap ? 'Chaos Splash' : 'Chaos Shot', damage:trap ? 9 : 8,
        x:center(owner) + direction * 33 - size / 2,
        y:owner.y + owner.height * .53, width:size, height:trap ? 34 : size,
        vx:direction * (trap ? 1.5 : 10), vy:trap ? 3 : 0,
        update() {
            this.x += this.vx;
            this.y += this.vy;
            if (trap) {
                this.vy += .45;
                if (this.y + this.height >= owner.feetY) {
                    this.x = clamp(this.x,HIGHWAY_WALLS[0].x,HIGHWAY_WALLS[1].x-this.width);
                    this.y = owner.feetY - this.height;
                    this.vx = this.vy = 0;
                    this.landedAt ??= combatNow();
                }
            }
            this.active = combatNow() - born < (trap ? 4200 : 1650);
        },
        get collisionDisabled() { return trap && (this.landedAt == null || combatNow() - this.landedAt < 230); },
        draw(camera) {
            const t = combatNow() - born;
            if (trap && this.landedAt != null) ripple(this.x + size/2, this.y + this.height, size/2, t/630%1);
            else {
                const key = trap ? 'puddle' : 'orb';
                const sprite = frame(key, Math.floor(t/80)%6, this.x+size/2, this.y+this.height, trap ? 1.6 : 1.45, direction);
                drawRobotFrame(ctx, sprite, camera);
            }
        }
    });
}

export class Chaos extends PrototypeFighter {
    constructor(x, y, controls) {
        super(x,y,controls,{name:'CHAOS',color:'#39c9ff',speed:7.4});
        configureCombatant(this,'chaos','CHAOS');
        this.pose = {key:'idle',at:combatNow(),dir:1};
        this.dashSpeed = 17;
        this.dashAnimationSpeed = this.dashFrames.length / 44;
        this.aux1 = controls.attack === 'KeyJ' ? 'KeyQ' : 'BracketLeft';
        this.aux2 = controls.attack === 'KeyJ' ? 'KeyE' : 'BracketRight';
    }

    isBusy() { return super.isBusy() || Boolean(this.robotMove || this.special); }
    isAttacking() { return super.isAttacking() || Boolean(this.robotMove || this.special); }

    beginMove(key, target) {
        const cancelDash = key === 'dolphin' && this.isDashing;
        if (this.tagLockedUntil > combatNow() || (this.isBusy() && !cancelDash) || this.isHitstunned() || this.isIntroActive || this.isVulnerable) return false;
        if (cancelDash) this.isDashing = false;
        const ok = beginRobotMove(this, moves[key], target.x >= this.x ? 1 : -1);
        if (ok && key === 'aim') this.robotMove.follow = 'impact';
        return ok;
    }

    startSpecial(key, target) {
        const spec = specials[key];
        if (!spec || this.tagLockedUntil > combatNow() || this.isBusy() || this.isVulnerable || this.isIntroActive || !this.isGrounded ||
            target.health <= 0 || (spec.cost && !this.spendPower(spec.cost))) return false;
        const dir = target.x >= this.x ? 1 : -1;
        const viewLeft = clamp(game.cameraX, HIGHWAY_WALLS[0].x, HIGHWAY_WALLS[1].x-450);
        const viewRight = clamp(game.cameraX + ctx.canvas.width, viewLeft+450, HIGHWAY_WALLS[1].x);
        const anchor = clamp(center(target), HIGHWAY_WALLS[0].x+164, HIGHWAY_WALLS[1].x-164);
        this.special = {key, spec, at:combatNow(), dir, target, anchor, viewLeft, viewRight, hits:new Set()};
        if (key === 'special_three_puddles') {
            this.special.puddles = [anchor-134,anchor,anchor+134];
            this.special.exit = Math.floor(Math.random()*3);
        }
        this.isGuarding = false;
        this.isCrouching = false;
        this.vx = 0;
        return true;
    }

    answerPuddle(target, index) {
        const s = this.special;
        const age = s ? combatNow()-s.at : -1;
        if (s?.key !== 'special_three_puddles' || s.target !== target || s.answer != null || age < 380 || age >= 1170) return false;
        s.answer = index;
        return true;
    }

    answerPuddleAsCpu(target, random) {
        const s = this.special;
        if (s?.key!=='special_three_puddles' || s.answer!=null || combatNow()-s.at<970) return;
        this.answerPuddle(target,random()<.52 ? s.exit : Math.floor(random()*3));
    }

    cancelChaosMoves() {
        this.special = null;
        this.robotMove = null;
        this.flightUntil = 0;
    }

    interceptIncomingHit() {
        const s = this.special;
        if (s?.key !== 'special_three_puddles') return false;
        const age = combatNow()-s.at;
        return age >= 380 && age < 1170;
    }

    handleCommand(code, target) {
        const c = this.controls;
        const down = this.keys[c.crouch], air = !this.isGrounded;
        if (code === c.attack) {
            const move = this.robotMove;
            if (move && combo.includes(move.spec.key) && combatNow()-move.started >= move.spec.ms*2) move.chain = true;
            else this.beginMove(air ? 'rocket' : 'stretch',target);
        } else if (code === c.heavy) this.beginMove(air ? 'airCrush' : down ? 'crush' : 'doubleStab',target);
        else if (code === c.kickLight && !air) this.beginMove('upper',target);
        else if (code === c.kickHeavy) this.beginMove(air ? (down ? 'aim' : 'rocket') : 'dolphin',target);
        else if (code === this.aux1) {
            if (!air && this.keys[c.spinKey]) this.startSpecial('ultimate_perfect_chaos',target);
            else if (down && !air) this.startSpecial('special_arm_wrap',target);
            else this.beginMove(air ? 'airShot' : 'shot',target);
        } else if (code === this.aux2) {
            const forward=target.x>=this.x?c.right:c.left;
            const remote=this.keys[forward] && Math.abs(center(target)-center(this))>=180;
            if (!air && this.keys[c.spinKey]) this.startSpecial('ultimate_chaos4_flood',target);
            else if (!air && (down || remote)) this.startSpecial('special_three_puddles',target);
            else this.beginMove(air ? 'airSplash' : 'splash',target);
        } else if (code === c.spinKey) {
            if (air && !this.flightUsed && !this.isBusy()) {
                this.flightUsed = true;
                this.flightUntil = combatNow()+850;
            } else if (down && this.health < this.maxHealth && combatNow() >= (this.healAfter ?? 0) &&
                this.beginMove('heal',target)) this.healAfter = combatNow()+8000;
        }
    }

    onDamageTaken({stagger=true}={}) { if(!stagger)return;
        if (this.lastGuardImpact?.blocked) return;
        this.cancelChaosMoves();
        this.isDashing = false;
        this.hurtAt = combatNow();
    }

    checkDoubleTap(direction, opponentX) {
        if (!this.isBusy()) super.checkDoubleTap(direction,opponentX);
    }

    update(opponentX, self) {
        const now = combatNow();
        const ground = this.isGrounded;
        const s = this.special;
        if (s && (now-s.at >= s.spec.duration || s.target.health <= 0 || (s.target!==game.p1 && s.target!==game.p2))) this.special = null;
        // La salida devuelve el cuerpo y el apoyo al piso antes de habilitar la hitbox.
        if (this.special?.key === 'special_three_puddles' && now-s.at >= 1170 && !s.emerged) {
            s.emerged = true;
            this.x = clamp(s.puddles[s.exit]-this.width/2, HIGHWAY_WALLS[0].x, HIGHWAY_WALLS[1].x-this.width);
            this.y = this.feetY-this.height;
            this.vx = this.vy = 0;
            this.isGrounded = true;
        }

        const move = this.robotMove;
        if (move) {
            const index = Math.floor((now-move.started)/move.spec.ms);
            if (!move.fired && index >= (move.spec.shot ?? move.spec.trap ?? move.spec.heal ?? Infinity)) {
                move.fired = true;
                if (move.spec.heal) this.health = Math.min(this.maxHealth,this.health+8);
                else liquidShot(this,move.direction,Boolean(move.spec.trap));
            }
            if (!this.isGrounded && move.spec.drop && index >= 2) this.vy = Math.max(move.spec.drop,this.vy);
            updateRobotMove(this);
        }
        const flying = !this.isGrounded && this.keys[this.controls.spinKey] && now < this.flightUntil && !this.isBusy();
        if (flying) this.vy = Math.max(this.y > 35 ? -3.6 : 0,this.vy-1.7);
        else this.flightUntil = 0;

        const keys = this.keys;
        if (this.special) this.keys = {};
        try { super.update(opponentX,self); }
        finally { this.keys = keys; }

        if (move && !this.robotMove) {
            const next = move.follow && !this.isGrounded ? move.follow : move.chain && this.isGrounded ? combo[combo.indexOf(move.spec.key)+1] : null;
            if (next) beginRobotMove(this,moves[next],move.direction);
        } else if (move?.spec.speed) updateRobotMove(this,true);
        if (!ground && this.isGrounded) {
            this.landAt = now;
            if (this.pose.key === 'knock' || this.pose.key === 'up') this.impactAt = now;
        }
        if (this.isGrounded) this.flightUsed = false;
        const moving = Math.abs(this.vx) > .2;
        const dir = moving && !this.isGuarding ? Math.sign(this.vx) : opponentX >= this.x ? 1 : -1;
        let key = 'idle';
        if (this.wasInAirFromKnockback) key = this.vy < -3 ? 'up' : 'knock';
        else if (now-(this.impactAt ?? -Infinity)<230) key = 'groundHit';
        else if (now-(this.hurtAt ?? -Infinity)<170) key = 'hurt';
        else if (this.isVulnerable) key = 'getup';
        else if (this.isGuarding) key = 'guard';
        else if (flying || (!this.isGrounded && this.vy<0)) key = 'jump';
        else if (!this.isGrounded) key = 'fall';
        else if (this.isDashing) key = 'dash';
        else if (now-(this.landAt ?? -Infinity)<125) key = 'land';
        else if (moving) key = (this.pose.key==='run' && this.pose.dir!==dir) ||
            (this.pose.key==='reverse' && now-this.pose.at<190) ? 'reverse' : 'run';
        else if (this.pose.key==='run' || (this.pose.key==='brake' && now-this.pose.at<185)) key = 'brake';
        else if (this.pose.dir!==dir || (this.pose.key==='turn' && now-this.pose.at<145)) key = 'turn';
        if (key!==this.pose.key || dir!==this.pose.dir) this.pose = {key,at:now,dir};
    }

    floodPass(s, age) {
        const index = passStarts.findIndex(at => age >= at && age < at+passDuration);
        if (index < 0) return null;
        const t = (age-passStarts[index])/passDuration;
        const dir = s.dir * (index%2 ? -1 : 1);
        const from = dir>0 ? s.viewLeft-62 : s.viewRight+62;
        const to = dir>0 ? s.viewRight+62 : s.viewLeft-62;
        const foot = this.feetY-[0,76,36,16][index]-Math.sin(Math.PI*t)*(index===3 ? 88 : 35);
        return {index,dir,x:from+(to-from)*t,foot};
    }

    specialHit(target, token, rect, damage, dir, launch, impactX) {
        const s = this.special;
        if (s.hits.has(token)) return;
        if (!overlapsTarget(target,rect,impactX)) return;
        s.hits.add(token);
        s.splash = {x:center(target), y:target.y+target.height*.69, at:combatNow(), dir};
        dealDamage(target,damage,{attacker:this,attackName:s.key,impactX,hitRect:rect});
        if (target.lastGuardImpact?.blocked) {
            target.x = clamp(target.x+dir*18,HIGHWAY_WALLS[0].x,HIGHWAY_WALLS[1].x-target.width);
            return;
        }
        target.vx = dir*(launch ? 10 : 5);
        if (launch) {
            target.isGrounded = false;
            target.vy = launch;
            target.wasInAirFromKnockback = true;
            target.knockbackAirTimer = 0;
        }
    }

    airArms() {
        const move = this.robotMove;
        if (move?.spec.key!=='airCrush') return null;
        const index = Math.floor((combatNow()-move.started)/move.spec.ms);
        if (index<3 || index>5) return null;
        const shoulder = this.y + this.height*.52;
        const height = Math.min(this.feetY-shoulder,175);
        if (height<35) return null;
        const x = center(this)+move.direction*26;
        const sprite = frame('airArms',index-3,x,shoulder+height,height/59,move.direction);
        return {sprite,rect:{x:x-23,y:shoulder,w:46,h:height}};
    }

    tryHit(target) {
        if (this.health<=0 || target.health<=0 || this.shadowFrozenBy) return;
        const move = this.robotMove;
        const wasHit = move?.hit;
        const arms = this.airArms();
        if (arms && !move.hit && target.minerPhase!=='under' && overlapsTarget(target,arms.rect,center(this))) {
            move.hit = true;
            dealDamage(target,move.spec.damage,{attacker:this,attackName:'Air Chaos Crush',hitRect:arms.rect,impactX:center(this)});
        }
        hitRobotMove(this,target);
        if (move?.hit && !wasHit && target.lastGuardImpact?.blocked) this.recoilUntil = combatNow()+125;
        const s = this.special;
        if (!s || s.target!==target || target.minerPhase==='under') return;
        const age = combatNow()-s.at;
        const floor = this.feetY;
        // Al cruzar la costura, el origen del impacto pasa al borde opuesto y cambia la dirección de guardia.
        if (s.key==='special_arm_wrap' && age>=540 && age<965) {
            const origin = s.dir>0 ? HIGHWAY_WALLS[1].x : HIGHWAY_WALLS[0].x;
            const x = origin-s.dir*((age-540)/425)*(HIGHWAY_WALLS[1].x-HIGHWAY_WALLS[0].x);
            const previous = s.armX ?? origin;
            s.armX = x;
            this.specialHit(target,0,{x:Math.min(x,previous)-18,y:floor-104,w:Math.abs(x-previous)+36,h:46},12,-s.dir,-4,origin);
        } else if (s.key==='special_three_puddles' && age>=1170 && age<1400 && s.answer!==s.exit) {
            const x = s.puddles[s.exit];
            const a=Math.min(x,s.anchor)-115,b=Math.max(x,s.anchor)+115;
            this.specialHit(target,0,{x:a,y:floor-170,w:b-a,h:170},18,Math.sign(center(target)-x)||s.dir,-11,x);
        } else if (s.key==='ultimate_chaos4_flood') {
            const pass = this.floodPass(s,age);
            if (!pass) return;
            const previous = s.lastPass?.index===pass.index ? s.lastPass.x : pass.x;
            s.lastPass = pass;
            // Cada pasada registra su propio impacto, incluso si la estela cruza más de un cuerpo por cuadro.
            this.specialHit(target,pass.index,{x:Math.min(previous,pass.x)-71,y:pass.foot-94,w:Math.abs(previous-pass.x)+142,h:98},
                pass.index===3 ? 13 : 7,pass.dir,pass.index===3 ? -13 : -4,pass.x);
        } else if (s.key==='ultimate_perfect_chaos' && age>=940 && age<1320) {
            const edge = s.anchor-s.dir*350;
            const tip = edge+s.dir*((age-940)/380)*700;
            this.specialHit(target,0,{x:Math.min(edge,tip)-50,y:floor-154,w:Math.abs(edge-tip)+100,h:154},36,s.dir,-16,tip);
        }
    }

    getPixelBodyFrame() {
        return this.bodyFrame();
    }

    pixelBodyIntersectsRect(rect) { return opaqueInRect(this.bodyFrame(),rect); }

    bodyFrame() {
        if (this.interceptIncomingHit()) return null;
        const now = combatNow();
        const move = this.robotMove;
        const s = this.special;
        let {key,at,dir} = this.pose;
        let ms = key==='idle' ? 118 : 59;
        if (now < (this.recoilUntil ?? 0) && !s) { key='blocked'; at=this.recoilUntil-125; ms=42; }
        else if (s) {
            const age = now-s.at;
            key = s.key==='special_three_puddles' && s.emerged ? 'dolphin' : s.spec.pose;
            at = s.emerged ? s.at+1170 : s.at;
            dir = s.dir;
            if (s.key.startsWith('ultimate') && age>480 && age<s.spec.duration-290) { key='dash'; at=now-59*4; }
        } else if (move) { key=move.spec.pose; at=move.started; ms=move.spec.ms; dir=move.direction; }
        let index = Math.floor((now-at)/ms);
        if (key==='dash' && !s && !move && this.isDashing) index = dive[Math.min(dive.length-1,Math.floor((this.dashFrame+this.dashTimer)*dive.length/this.dashFrames.length))];
        if (['idle','run','guard'].includes(key)) index %= CHAOS_FRAMES[key].length;
        return frame(key,index,center(this),this.y+this.height,this.height/43,dir);
    }

    draw() {
        this.drawSpecial();
        const body = this.bodyFrame();
        drawRobotFrame(ctx,this.airArms()?.sprite,game.cameraX);
        drawRobotFrame(ctx,body,game.cameraX);
        const move = this.robotMove;
        if (move?.spec.effect) {
            const elapsed = combatNow()-move.started-move.spec.ms*2;
            if (elapsed>=0) drawRobotFrame(ctx,frame(move.spec.effect,Math.floor(elapsed/39),
                center(this)+move.direction*69,this.y+this.height,2.85,move.direction),game.cameraX);
        }
    }

    drawSpecial() {
        const s = this.special;
        if (!s) return;
        const age = combatNow()-s.at, floor = this.feetY;
        if (s.key==='special_arm_wrap') {
            const source = center(this), outgoing = s.dir>0 ? HIGHWAY_WALLS[0].x : HIGHWAY_WALLS[1].x;
            const incoming = s.dir>0 ? HIGHWAY_WALLS[1].x : HIGHWAY_WALLS[0].x;
            if (age>=220 && age<600) ripple(clamp(incoming,game.cameraX+25,game.cameraX+ctx.canvas.width-25),floor-82,23,age/450%1);
            const y = floor-83;
            ctx.save();
            ctx.lineCap='round';
            ctx.shadowBlur=12;
            ctx.shadowColor='#39c9ff';
            const arm = (a,b) => {
                ctx.beginPath();
                ctx.moveTo(a-game.cameraX,y);
                ctx.quadraticCurveTo((a+b)/2-game.cameraX,y+Math.sin(age/85)*13,b-game.cameraX,y);
                ctx.lineWidth=23;
                ctx.strokeStyle='#168dde';
                ctx.stroke();
                ctx.lineWidth=7;
                ctx.strokeStyle='#a9f5ff';
                ctx.stroke();
            };
            if (age>=130) arm(source, source+(outgoing-source)*Math.min(1,(age-130)/390)*Math.min(1,(1230-age)/200));
            if (s.armX != null && age<1110) {
                const tip = s.armX+(incoming-s.armX)*Math.max(0,(age-960)/150);
                arm(incoming,tip);
                drawRobotFrame(ctx,frame('stabFx',4,tip,y+21,1.65,-s.dir),game.cameraX);
            }
            ctx.restore();
        } else if (s.key==='special_three_puddles') {
            s.puddles.forEach((x,i) => {
                ripple(x,floor,i===s.exit && age>925 ? 43 : 39,(age/530+i*.25)%1);
                if (age>=1170 && i===s.exit) drawRobotFrame(ctx,frame('upperFx',Math.floor((age-1170)/43),
                    x,floor,3.1,s.dir),game.cameraX);
            });
        } else if (s.key==='ultimate_chaos4_flood') {
            const level=clamp(Math.min((age-250)/420,(s.spec.duration-age)/440),0,1);
            ctx.save();
            const gradient=ctx.createLinearGradient(0,0,0,ctx.canvas.height);
            gradient.addColorStop(0,'#18cbff25');
            gradient.addColorStop(1,'#0078bdbb');
            ctx.globalAlpha=level;
            ctx.fillStyle=gradient;
            ctx.fillRect(0,0,ctx.canvas.width,ctx.canvas.height);
            ctx.restore();
            if (level>.08) {
                for (let i=0;i<8;i++) ripple(game.cameraX+i*183+(age/9)%183,floor-12,75,(age/720+i*.14)%1);
            }
            const pass=this.floodPass(s,age);
            if (pass) {
                ripple(pass.x-pass.dir*64,pass.foot-12,83,age/320%1);
                drawRobotFrame(ctx,frame('chaos4',pass.index===3 ? 4 : 1,pass.x,pass.foot,2.65,pass.dir),game.cameraX);
                if (pass.index===3) drawRobotFrame(ctx,frame('stabFx',4+Math.floor((age-passStarts[3])/65),
                    pass.x-pass.dir*87,pass.foot+10,3.8,pass.dir),game.cameraX,.84);
            } else if (age>=410 && age<660) drawRobotFrame(ctx,frame('chaos4',0,center(this),floor,2.2,s.dir),game.cameraX);
        } else {
            ripple(center(this),floor,58+Math.min(165,age/6),age/480%1);
            const growth=clamp(Math.min((age-380)/470,(s.spec.duration-age-140)/500),0,1);
            if (growth>0) {
                const x=clamp(s.anchor-s.dir*285,s.viewLeft+145,s.viewRight-145);
                ctx.save();
                ctx.globalAlpha=Math.min(growth*2,1);
                drawRobotFrame(ctx,frame('perfect',0,x,floor+180*(1-growth),1.8,-s.dir),game.cameraX,ctx.globalAlpha);
                if (age>=780 && age<1560) {
                    const t=clamp((age-850)/480,0,1);
                    const sweep=s.anchor+s.dir*(-310+t*640);
                    drawRobotFrame(ctx,frame('tail',Math.min(3,Math.floor(t*4)),sweep,floor+26,2.2,s.dir),game.cameraX,ctx.globalAlpha);
                    ripple(sweep,floor-6,90,(age/360)%1);
                }
                ctx.restore();
            }
        }
        const splash = s.splash;
        if (splash && combatNow()-splash.at<320) {
            const t = (combatNow()-splash.at)/320;
            const scale = s.key.startsWith('ultimate') ? 4.4 : 2.4;
            drawRobotFrame(ctx,frame('stabFx',4+Math.floor(t*7),splash.x,splash.y+28,scale,splash.dir),game.cameraX,1-t*.78);
        }
    }
}

export function handleChaosPuddleKey(code) {
    for (const [attacker, target] of [[game.p1,game.p2],[game.p2,game.p1]]) {
        const index = puddleButtons(target).indexOf(code);
        if (index>=0 && attacker.answerPuddle?.(target,index)) return true;
    }
    return false;
}

export function handleChaosPuddlePointer(x,y) {
    for (const [attacker,target,cpu] of [[game.p1,game.p2,game.cpuAgentP2],[game.p2,game.p1,game.cpuAgentP1]]) {
        if (cpu || y<target.feetY-58 || y>target.feetY+18) continue;
        const index = attacker.special?.puddles?.findIndex(point=>Math.abs(point-game.cameraX-x)<49) ?? -1;
        if (index>=0 && attacker.answerPuddle?.(target,index)) return true;
    }
    return false;
}

export function drawChaosChoices() {
    for (const [attacker, target, y] of [[game.p1,game.p2,173],[game.p2,game.p1,228]]) {
        const s=attacker.special;
        if (s?.key!=='special_three_puddles') continue;
        const age=combatNow()-s.at;
        if (age<380 || age>=1400) continue;
        const labels = target.controls.attack==='KeyJ' ? ['J','I','M'] : [',','.','−'];
        ctx.save();
        ctx.textAlign='center';
        ctx.font='bold 19px system-ui';
        ctx.fillStyle='#0b2944';
        ctx.fillRect(ctx.canvas.width/2-157,y-24,314,55);
        ctx.fillStyle='#e4faff';
        ctx.fillText(age<1170 ? '¿De qué charco sale Chaos?' : s.answer===s.exit ? '¡Lectura correcta!' : '¡Chaos emerge!',ctx.canvas.width/2,y);
        s.puddles.forEach((x,i)=>{
            ctx.fillStyle=s.answer===i ? '#ffdc75' : '#bdf6ff';
            const screenX=x-game.cameraX;
            ctx.fillRect(screenX-15,target.feetY-49,30,28);
            ctx.fillStyle='#0d304c';
            ctx.fillText(labels[i],screenX,target.feetY-28);
        });
        if (age<1170) {
            ctx.fillStyle='#8be9ff';
            ctx.fillRect(ctx.canvas.width/2-147,y+17,294*(1170-age)/790,5);
        }
        ctx.restore();
    }
}

export function chaosAnimations() {
    const names={idle:'Reposo',run:'Carrera',dash:'Chaos Dive',jump:'Salto / Chaos Flight',fall:'Caída',land:'Aterrizaje',
        brake:'Frenada',guard:'Guardia',turn:'Giro',reverse:'Giro en carrera',heal:'Curación',stretch:'Stretch Chaos',
        elastic:'Elastic Chaos',flexible:'Flexible Chaos',heavy:'Double Stab / Upper / Crush',dolphin:'Chaos Dolphin',
        rocket:'Chaos Rocket / Impact',aim:'Impulso dirigido',shot:'Chaos Shot',airShot:'Air Chaos Shot',airCrush:'Air Chaos Crush',
        airSplash:'Air Chaos Splash',airArms:'Brazos extendidos de Air Chaos Crush',orb:'Orbe de agua',puddle:'Chaos Splash',stabFx:'Efecto Double Stab / Crush',
        upperFx:'Efecto Upper Chaos',hurt:'Impacto',up:'Lanzamiento hacia arriba',knock:'Retroceso',wallHit:'Impacto en pared',
        groundHit:'Impacto en piso',getup:'Levantarse',blocked:'Ataque bloqueado',wall:'Agarre de pared',
        chaos4:'Chaos 4',perfect:'Perfect Chaos',tail:'Coletazo de Perfect Chaos'};
    return Object.entries(names).map(([id,name])=>({
        id,name,count:id==='dash'?dive.length:CHAOS_FRAMES[id].length,ms:id==='dash'?50:80,
        frame(index){return frame(id,id==='dash'?dive[index]:index,0,0,1);}
    }));
}
