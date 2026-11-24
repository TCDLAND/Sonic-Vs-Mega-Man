import { combatNow } from './combat-clock.js';
import { ROBOT_FRAMES } from './robot-frames.js';
import { initBuster } from './buster-system.js';
import { configureCombatant } from './combat-system.js';
import { PrototypeFighter } from './prototype-fighter.js';
import { robotFrame, drawRobotFrame } from './robot-sprites.js';
import { PROTO_MOVES, beginRobotMove, updateRobotMove, hitRobotMove } from './robot-combat.js';
import { opaqueInRect } from './pixel-collision.js';
import { ctx, game } from './state.js';
import { playSound } from './utils.js';
import { busterAudio } from './assets.js';

export class ProtoMan extends PrototypeFighter {
    constructor(x, y, controls) {
        super(x, y, controls, { name: 'PROTO MAN', color: '#ffbd55', hasSonicJump: false, speed: 6 });
        initBuster(this, 'protoman');
        configureCombatant(this, 'protoman', 'PROTO MAN');
        this.shieldRaised = false;
        this.shotUntil = 0;
        this.hurtUntil = 0;
        this.isIntroActive = true;
    }

    getIntroFrames() { return Array.from({ length: 6 }, () => ({ duration: 10 })); }
    isAttacking() { return Boolean(this.robotMove) || combatNow() < this.shotUntil || super.isAttacking(); }
    isBusy() { return this.isAttacking() || super.isBusy(); }
    canUseBuster() { return !this.isBusy() && !this.isIntroActive && !this.isVulnerable && !this.wasInAirFromKnockback; }

    checkDoubleTap(direction, opponentX) {
        if (!this.keys[this.controls.heavy] && !this.isBusy()) super.checkDoubleTap(direction, opponentX);
    }

    update(opponentX, self) {
        const speed = this.speed;
        this.shieldRaised = Boolean(this.keys[this.controls.heavy] && !this.isBusy() && !this.isHitstunned() &&
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
    }

    startRobotAction(kind) {
        if (this.isBusy() || !this.isGrounded || this.isIntroActive || this.wasInAirFromKnockback) return false;
        this.shieldRaised = false;
        return beginRobotMove(this, PROTO_MOVES[kind], this.facingDirection);
    }

    tryHit(receiver) { hitRobotMove(this, receiver); }

    onBusterFired(level) {
        this.shieldRaised = false;
        this.shotAt = combatNow();
        this.shotUntil = this.shotAt + (level > 1 ? 440 : 205);
        this.shotLevel = level;
        playSound(busterAudio);
    }

    onDamageTaken({stagger=true}={}) { if(!stagger)return;
        if (this.lastGuardImpact?.blocked) return;
        this.hurtUntil = combatNow() + 210;
        this.shieldRaised = false;
        this.robotMove = null;
        this.shotUntil = 0;
    }

    getPixelBodyFrame() {
        const now = combatNow();
        let key = 'protoIdle', elapsed = now, ms = 145, loop = true;
        if (this.isIntroActive) { key = 'protoIntro'; elapsed = this.introFrame * 100; ms = 100; loop = false; }
        else if (this.wasInAirFromKnockback || now < this.hurtUntil) {
            key = this.wasInAirFromKnockback && Math.abs(this.vx) >= 9 ? 'protoHardHurt' : 'protoHurt';
            elapsed = Math.max(0, now - (this.hurtUntil - 210));
            ms = 65; loop = false;
        }
        else if (this.robotMove) { ({ key, ms } = this.robotMove.spec); elapsed = now - this.robotMove.started; loop = false; }
        else if (now < this.shotUntil) {
            key = !this.isGrounded ? 'protoAirShot' : this.shotLevel > 1 ? 'protoCharge' : 'protoShot';
            elapsed = now - this.shotAt; ms = 83; loop = false;
        } else if (this.shieldRaised || this.isGuarding) {
            key = !this.isGrounded ? 'protoShieldAir' : Math.abs(this.vx) > .1 ? 'protoShieldWalk' : 'protoShield';
            ms = 84;
            if (!this.isGrounded) {
                elapsed = now % (2 * ms) + (this.vy >= 0 ? 2 * ms : 0);
                loop = false;
            }
        } else if (this.isDashing) { key = 'protoDash'; elapsed = this.dashFrame * 66; ms = 66; loop = false; }
        else if (!this.isGrounded) {
            key = 'protoJump'; ms = 56; loop = false;
            const progress = (1 + this.vy / Math.abs(this.jumpForce)) / 2;
            elapsed = Math.floor(progress * ROBOT_FRAMES.protoJump.length) * ms;
        }
        else if (this.isCrouching) { key = 'protoLow'; }
        else if (Math.abs(this.vx) > .1) { key = 'protoRun'; ms = 56; }
        return robotFrame(key, elapsed, ms, this.x + this.width / 2, this.y + this.height, this.height / 42,
            this.robotMove?.direction || this.facingDirection, loop);
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
    }
}
