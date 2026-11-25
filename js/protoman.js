import { combatNow } from './combat-clock.js';
import { ROBOT_FRAMES } from './robot-frames.js';
import { initBuster } from './buster-system.js';
import { configureCombatant, dealDamage } from './combat-system.js';
import { PrototypeFighter } from './prototype-fighter.js';
import { robotFrame, drawRobotFrame } from './robot-sprites.js';
import { PROTO_MOVES, beginRobotMove, updateRobotMove, hitRobotMove } from './robot-combat.js';
import { opaqueInRect } from './pixel-collision.js';
import { ctx, game } from './state.js';
import { playSound } from './utils.js';
import { busterAudio } from './assets.js';
import { worldWidth } from './config.js';
import { protoThrowFrame, protoJumpFrame, protoFlyingShieldFrame, protoStrikeFrame,
    protoSlideFrame, protoUnshieldedFrame, protoRunShotFrame, protoHeavyBlockFrame } from './proto-shield-art.js';

const SHIELD_POSE_MS = 70;
const SHIELD_SPEED = .85;
const FLYING_SHIELD_SCALE = 1.2;
const overlaps = (a,b) => a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.h && a.y+a.h > b.y;

export class ProtoMan extends PrototypeFighter {
    constructor(x, y, controls) {
        super(x, y, controls, { name: 'PROTO MAN', color: '#ffbd55', hasSonicJump: false, speed: 6 });
        initBuster(this, 'protoman');
        configureCombatant(this, 'protoman', 'PROTO MAN');
        this.shieldRaised = false;
        this.shotUntil = 0;
        this.hurtUntil = 0;
        this.isIntroActive = true;
        this.dashFrames = [0,1,2];
        this.dashAnimationSpeed = .5;
        this.dashSpeed = 11;
        this.arenaFloor = y;
        this.shieldMeleeCapacity = 15;
    }

    getIntroFrames() { return Array.from({ length: 6 }, () => ({ duration: 10 })); }
    isAttacking() { return !!this.robotMove || this.shieldThrow?.poseAt != null ||
        this.shotLevel > 1 && combatNow() < this.shotUntil || super.isAttacking(); }
    isBusy() { return this.isAttacking() || combatNow() < this.shotUntil || super.isBusy(); }
    canUseBuster() { return !this.isBusy() && !this.isIntroActive && !this.isVulnerable && !this.wasInAirFromKnockback; }

    checkDoubleTap(direction, opponentX) {
        if (!this.keys[this.controls.heavy] && !this.isBusy()) super.checkDoubleTap(direction, opponentX);
    }

    update(opponentX, self) {
        const speed = this.speed;
        this.shieldRaised = Boolean(!this.shieldThrow && this.keys[this.controls.heavy] && !this.isBusy() && !this.isHitstunned() &&
            !this.isIntroActive && !this.wasInAirFromKnockback && !this.isVulnerable &&
            combatNow() >= (this.guardBrokenUntil || 0));
        if (this.shieldRaised) {
            this.facingDirection = opponentX >= this.x ? 1 : -1;
            this.speed *= .58;
        }
        super.update(opponentX, self);
        if (this.shieldRaised) this.facingDirection = opponentX >= this.x ? 1 : -1;
        this.speed = speed;
        updateRobotMove(this, true);
        this.updateShieldThrow();
    }

    startRobotAction(kind) {
        if (this.isBusy() || !this.isGrounded || this.isIntroActive || this.wasInAirFromKnockback) return false;
        if ((kind === 'bash' || kind === 'strike') && this.shieldThrow) return false;
        this.shieldRaised = false;
        return beginRobotMove(this, PROTO_MOVES[kind], this.facingDirection);
    }

    startShieldThrow(opponent, slope = 0, powered = false) {
        if (this.shieldThrow || this.isBusy() || this.isIntroActive || this.isVulnerable) return false;
        if (powered && !this.spendPower(100)) return false;
        const direction = opponent.x + opponent.width/2 >= this.x + this.width/2 ? 1 : -1;
        this.shieldRaised = false;
        this.busterCharging = false;
        this.shieldThrow = {phase:'windup',poseAt:combatNow(),direction,slope,powered,bounces:0};
        return true;
    }

    updateShieldThrow() {
        const shield = this.shieldThrow;
        if (!shield) return;
        const now = combatNow();
        const handX = this.x + this.width/2 + shield.direction*this.width*.24;
        const handY = this.y + this.height*.47;
        const left = 22, right = worldWidth-22;
        const ceiling = 22, floor = Math.max(ceiling+1,this.arenaFloor-22);
        const speed = SHIELD_SPEED*(shield.powered?1.45:1);
        if (shield.phase === 'windup') {
            if (now-shield.poseAt < SHIELD_POSE_MS*3) return;
            const x = Math.max(left,Math.min(right,handX)), y = Math.max(ceiling,Math.min(floor,handY));
            const magnitude = Math.hypot(1,shield.slope);
            Object.assign(shield,{phase:'out',poseAt:null,flownAt:now,updatedAt:now,x,y,previousX:x,previousY:y,
                vx:shield.direction*speed/magnitude,vy:shield.slope*speed/magnitude});
            return;
        }
        if (shield.phase === 'catch') {
            if (now-shield.poseAt >= SHIELD_POSE_MS*5) this.shieldThrow = null;
            return;
        }
        const dt = Math.min(50,Math.max(0,now-shield.updatedAt));
        shield.updatedAt = now;
        shield.previousX = shield.x;
        shield.previousY = shield.y;
        shield.x += shield.vx*dt;
        shield.y += shield.vy*dt;
        const wall = shield.x <= left && shield.vx < 0 ? 1 : shield.x >= right && shield.vx > 0 ? -1 : 0;
        const vertical = shield.y <= ceiling && shield.vy < 0 ? 1 : shield.y >= floor && shield.vy > 0 ? -1 : 0;
        if (wall || vertical) {
            shield.x = Math.max(left,Math.min(right,shield.x));
            shield.y = Math.max(ceiling,Math.min(floor,shield.y));
            this.bounceShield(wall,vertical);
        }
        if (shield.bounces >= (shield.slope ? 2 : 1) && overlaps(this.shieldFlightBounds(),{x:this.x+this.width*.20,y:this.y+this.height*.12,
            w:this.width*.60,h:this.height*.83})) {
            shield.phase = 'catch';
            shield.poseAt = now;
            shield.direction = Math.sign(shield.x-(this.x+this.width/2)) || shield.direction;
        }
    }

    bounceShield(wall = 0, vertical = 0) {
        const shield = this.shieldThrow;
        const speed = Math.hypot(shield.vx,shield.vy);
        shield.bounces++;
        if (shield.slope && shield.bounces===1) {
            if (wall) shield.vx = wall*Math.abs(shield.vx);
            if (vertical) shield.vy = vertical*Math.abs(shield.vy);
            else if (!wall) shield.vy = -shield.vy;
            return;
        }
        const dx = this.x+this.width/2-shield.x, dy = this.y+this.height*.47-shield.y;
        const x = wall ? wall*Math.max(18,Math.abs(dx)) : dx;
        const y = vertical ? vertical*Math.max(18,Math.abs(dy)) : dy;
        const distance = Math.hypot(x,y);
        if (distance > 0) {
            shield.vx = x/distance*speed;
            shield.vy = y/distance*speed;
        }
    }

    shieldFlightBounds() {
        const shield = this.shieldThrow;
        if (shield?.phase !== 'out') return null;
        const halfWidth = (shield.slope ? 8 : 12)*this.height/42*FLYING_SHIELD_SCALE;
        const halfHeight = (shield.slope ? 12 : 5)*this.height/42*FLYING_SHIELD_SCALE;
        const left = Math.min(shield.x,shield.previousX)-halfWidth;
        const top = Math.min(shield.y,shield.previousY)-halfHeight;
        return {x:left,y:top,w:Math.max(shield.x,shield.previousX)+halfWidth-left,
            h:Math.max(shield.y,shield.previousY)+halfHeight-top};
    }

    interceptFlyingShield(shot) {
        const rect = this.shieldFlightBounds();
        if (!rect || !overlaps(rect,{x:shot.x,y:shot.y,w:shot.width,h:shot.height})) return false;
        shot.active = false;
        return true;
    }

    tryHit(receiver) {
        hitRobotMove(this, receiver);
        const shield = this.shieldThrow;
        const rect = this.shieldFlightBounds();
        if (!rect || receiver.health <= 0 || receiver.minerPhase === 'under' || receiver.minerPhase === 'warning') return;
        const intersects = receiver.pixelBodyIntersectsRect?.(rect) ??
            (rect.x < receiver.x+receiver.width && rect.x+rect.w > receiver.x &&
             rect.y < receiver.y+receiver.height && rect.y+rect.h > receiver.y);
        if (!intersects) { shield.touchingRival = false; return; }
        if (shield.touchingRival) return;
        shield.touchingRival = true;
        this.bounceShield();
        dealDamage(receiver,shield.powered?22:11,{attacker:this,attackName:shield.powered?'Escudo potenciado':'Lanzamiento de escudo',
            projectile:true,impactX:shield.x,impactY:shield.y});
    }

    onBusterFired(level, direction = this.facingDirection) {
        this.shieldRaised = false;
        this.shotAt = combatNow();
        this.shotUntil = this.shotAt + (level > 1 ? 126 : 155);
        this.shotLevel = level;
        this.shotDirection = direction;
        if (level>1) this.vx = 0;
        playSound(busterAudio);
    }

    onShieldProjectileBlock(damage, now) {
        this.lastProjectileBlockAt = now;
        if (damage < 16) return;
        this.heavyBlockAt = now;
        this.heavyBlockUntil = now+330;
        this.hitstunUntil = Math.max(this.hitstunUntil || 0,this.heavyBlockUntil);
        this.shieldRaised = false;
        this.vx = 0;
    }

    onDamageTaken({stagger=true}={}) { if(!stagger)return;
        if (this.lastGuardImpact?.blocked) return;
        this.hurtUntil = combatNow() + 210;
        this.shieldRaised = false;
        this.robotMove = null;
        this.shotUntil = 0;
        if (this.shieldThrow?.phase === 'windup') this.shieldThrow = null;
    }

    getPixelBodyFrame() {
        const now = combatNow();
        let key = 'protoIdle', elapsed = now, ms = 145, loop = true;
        if (this.isIntroActive) { key = 'protoIntro'; elapsed = this.introFrame * 100; ms = 100; loop = false; }
        else if (now < this.heavyBlockUntil) {
            const pose = protoHeavyBlockFrame(Number(now-this.heavyBlockAt>=100),this.x+this.width/2,
                this.y+this.height,this.height/42,this.facingDirection);
            if (pose) return pose;
        }
        else if (this.wasInAirFromKnockback || now < this.hurtUntil) {
            key = this.wasInAirFromKnockback && Math.abs(this.vx) >= 9 ? 'protoHardHurt' : 'protoHurt';
            elapsed = Math.max(0, now - (this.hurtUntil - 210));
            ms = 65; loop = false;
        }
        else if (this.shieldThrow?.poseAt != null) {
            const shield = this.shieldThrow;
            const tick = Math.max(0,Math.floor((now-shield.poseAt)/SHIELD_POSE_MS));
            const index = shield.phase === 'windup' ? 2+Math.min(2,tick) : 4-Math.min(4,tick);
            const x = this.x+this.width/2, feet = this.y+this.height, scale = this.height/42;
            if (shield.phase==='windup' && shield.slope) {
                const key = shield.slope>0 ? 'protoMelee' : 'protoBash';
                const attackFrame = (shield.slope>0 ? [0,1,2] : [1,2,4])[Math.min(2,tick)];
                const pose = robotFrame(key,attackFrame,1,x,feet,scale,shield.direction,false);
                if (pose) return pose;
            }
            const pose = protoThrowFrame(index,x,feet,scale,shield.direction);
            if (pose) return pose;
        }
        else if (this.robotMove) {
            ({ key, ms } = this.robotMove.spec);
            elapsed = now - this.robotMove.started;
            loop = false;
            if (key === 'protoStrike') {
                const pose = protoStrikeFrame(Math.min(2,Math.floor(elapsed/ms)),this.x+this.width/2,
                    this.y+this.height,this.height/42,this.robotMove.direction);
                if (pose) return pose;
                key = 'protoMelee';
            }
            if (key === 'protoLow') {
                const pose = protoSlideFrame(Number(elapsed >= ms && elapsed < ms*2),
                    this.x+this.width/2,this.y+this.height,this.height/42,this.robotMove.direction);
                if (pose) return pose;
            }
        }
        else if (now < this.shotUntil) {
            if (this.shotLevel===1 && this.isGrounded && Math.abs(this.vx)>.1) {
                const pose = protoRunShotFrame(Math.floor(now/56),this.x+this.width/2,this.y+this.height,
                    this.height/42,this.shotDirection,Boolean(this.shieldThrow));
                if (pose) return pose;
            }
            key = !this.isGrounded ? 'protoAirShot' : this.shotLevel > 1 ? 'protoCharge' : 'protoShot';
            elapsed = now - this.shotAt; ms = this.shotLevel>1?34:45; loop = false;
        } else if (!this.shieldThrow && (this.shieldRaised || this.isGuarding)) {
            key = !this.isGrounded ? 'protoShieldAir' : Math.abs(this.vx) > .1 ? 'protoShieldWalk' : 'protoShield';
            ms = 84;
            if (!this.isGrounded) {
                elapsed = now % (2 * ms) + (this.vy >= 0 ? 2 * ms : 0);
                loop = false;
            }
        } else if (this.isDashing) {
            key = this.shieldThrow ? 'protoRun' : 'protoBash';
            elapsed = (this.dashFrame + (this.shieldThrow ? 0 : 1))*66;
            ms = 66;
            loop = false;
        } else if (this.isCrouching && this.isGrounded) {
            const pose = protoSlideFrame(0,this.x+this.width/2,this.y+this.height,this.height/42,this.facingDirection);
            if (pose) return pose;
            key = 'protoLow';
        }
        else if (!this.isGrounded) {
            const index = this.vy < -11 ? 0 : this.vy < -5 ? 1 : this.vy < 5 ? 2 : 3;
            const pose = protoJumpFrame(index,this.x+this.width/2,this.y+this.height,this.height/42,this.facingDirection);
            if (pose) return pose;
            key = 'protoJump'; ms = 56; loop = false;
            const progress = (1 + this.vy / Math.abs(this.jumpForce)) / 2;
            elapsed = Math.floor(progress * ROBOT_FRAMES.protoJump.length) * ms;
        }
        else if (Math.abs(this.vx) > .1) { key = 'protoRun'; ms = 56; }
        const x = this.x+this.width/2, feet = this.y+this.height, scale = this.height/42;
        const direction = this.robotMove?.direction || (now<this.shotUntil ? this.shotDirection :
            this.isDashing ? this.dashDirection : this.facingDirection);
        const frame = robotFrame(key,elapsed,ms,x,feet,scale,direction,loop);
        return (this.shieldThrow && protoUnshieldedFrame(frame,x,feet,scale,direction,ROBOT_FRAMES[key])) || frame;
    }

    pixelBodyIntersectsRect(rect) { return opaqueInRect(this.getPixelBodyFrame(), rect, 2); }

    draw(opponentX) {
        const frame = this.getPixelBodyFrame();
        if (!frame) return super.draw(opponentX);
        if (this.busterCharging) {
            ctx.save();
            ctx.shadowColor = '#ffce66';
            ctx.shadowBlur = 9;
            drawRobotFrame(ctx, frame, game.cameraX);
            ctx.restore();
        } else drawRobotFrame(ctx, frame, game.cameraX);
        const shield = this.shieldThrow;
        if (shield?.phase === 'out') {
            const direction = Math.sign(shield.x-shield.previousX) || shield.direction;
            const frame = protoFlyingShieldFrame(combatNow()-shield.flownAt,0,0,this.height/42*FLYING_SHIELD_SCALE,direction,shield.slope!==0);
            ctx.save();
            ctx.translate(shield.x-game.cameraX,shield.y);
            if (shield.slope) {
                const dx = Math.abs(shield.x-shield.previousX);
                const dy = shield.y-shield.previousY;
                ctx.rotate(direction*Math.atan2(dy,dx || 1)*.55);
            }
            drawRobotFrame(ctx,frame);
            ctx.restore();
        }
    }
}
