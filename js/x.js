import { combatNow } from './combat-clock.js';
import { initBuster, getBusterLevel } from './buster-system.js';
import { configureCombatant, dealDamage } from './combat-system.js';
import { PrototypeFighter } from './prototype-fighter.js';
import { opaqueInRect, opaqueFramesOverlap } from './pixel-collision.js';
import { ctx, game } from './state.js';
import { playSound } from './utils.js';
import { busterAudio } from './assets.js';
import { HIGHWAY_WALLS } from './wall-system.js';
import { X_FRAMES } from './x-frames.js';
import { X_POLISH } from './x-polish-frames.js';
import { chargedSpriteFrame } from './charge-palette.js';

const atlas = new Image();
atlas.src = 'assets/images/x-atlas.png';
const polishedAtlas = new Image();
polishedAtlas.src = 'assets/images/x-polish.png';
const SABER_COLORS = ['#c0f0d0', '#98e0b8', '#50e890', '#38c870', '#28b858'];
export const X_SABER = { ground: 11, air: 9 };
export const NOVA_DAMAGE = 28;

export class X extends PrototypeFighter {
    constructor(x, y, controls) {
        super(x, y, controls, { name: 'X', color: '#3aa9ff', hasSonicJump: false, speed: 6.5 });
        initBuster(this, 'x');
        configureCombatant(this, 'x', 'X');
        this.shotAt = 0;
        this.shotUntil = 0;
        this.hurtUntil = 0;
        this.wallKickUntil = 0;
        this.wallReturnUntil = 0;
        this.isIntroActive = true;
    }

    getIntroFrames() { return X_FRAMES.intro.map((_, index) => ({ duration: index < 3 ? 6 : 8 })); }
    isAttacking() { return Boolean(this.saber || this.nova) || super.isAttacking(); }
    isBusy() { return Boolean(this.saber || this.nova) || super.isBusy(); }
    canUseBuster() { return !this.isBusy() && !this.isIntroActive && !this.isVulnerable && !this.wasInAirFromKnockback; }

    startWallHop(side) {
        this.wallKickAt = combatNow();
        this.wallKickUntil = this.wallKickAt + 210;
        this.wallReturnUntil = this.wallKickAt + 460;
        this.xWallSide = side;
        this.facingDirection = side === 'left' ? 1 : -1;
        this.facingLocked = true;
        this.facingUnlockAt = this.wallKickUntil;
    }

    onBusterFired(level) {
        this.shotAt = combatNow();
        this.shotUntil = this.shotAt + (level > 1 ? 340 : 205);
        this.shotLevel = level;
        playSound(busterAudio);
    }

    onDamageTaken({stagger=true}={}) { if(!stagger)return;
        if (this.lastGuardImpact?.blocked) return;
        this.hurtUntil = combatNow() + 200;
        this.shotUntil = 0;
        this.saber = null;
        this.nova = null;
        this.wallKickUntil = 0;
        this.wallReturnUntil = 0;
    }

    startSaber() {
        if (!this.canUseBuster() || this.wallSliding) return false;
        const key = this.isGrounded ? 'saber' : 'airSaber';
        this.saber = { key, at: combatNow(), hit: false, direction: this.facingDirection };
        this.facingLocked = true;
        this.facingUnlockAt = this.saber.at + (X_POLISH[key] || X_FRAMES[key]).length * 56;
        return true;
    }

    startNova() {
        const at = combatNow();
        if (!this.canUseBuster() || this.isHitstunned() || (game.mode!=='practice' && at<(this.novaReadyAt??0))) return false;
        this.novaReadyAt = at + 7500;
        this.nova = { at, direction: this.facingDirection || 1, hit: false, y: this.y };
        this.busterCharging = false;
        this.busterChargeStart = 0;
        this.facingLocked = true;
        this.facingUnlockAt = at + 510;
        return true;
    }

    update(opponentX, self) {
        const now = combatNow();
        const beforeX = this.x;
        super.update(opponentX, self);
        const [left, right] = HIGHWAY_WALLS;
        if (!this.isGrounded && !this.wasInAirFromKnockback && this.wallReturnUntil > now) {
            const direction = this.xWallSide === 'left' ? 1 : -1;
            const outward = this.keys[direction > 0 ? this.controls.right : this.controls.left];
            if (now < this.wallKickAt + 105) this.x = beforeX + direction * 7;
            else if (!outward) this.x = beforeX - direction * 6;
            this.x = Math.max(left.x, Math.min(right.x - this.width, this.x));
            if (now < this.wallKickUntil) this.wallSliding = false;
        }
        if (this.nova) {
            const elapsed = now - this.nova.at;
            if (elapsed >= 510) this.nova = null;
            else if (elapsed >= 112 && elapsed < 420) {
                this.x = Math.max(left.x, Math.min(right.x - this.width, beforeX + this.nova.direction * 26));
                this.y = this.nova.y;
                this.vy = 0;
            }
        }
        const moving = this.isGrounded && Math.abs(this.vx) > .1;
        if (moving && !this.xWasMoving) this.xRunAt = combatNow();
        this.xWasMoving = moving;
        if (this.saber && now - this.saber.at >= (X_POLISH[this.saber.key] || X_FRAMES[this.saber.key]).length * 56) this.saber = null;
    }

    animation() {
        const now = combatNow();
        const firing = now < this.shotUntil;
        if (this.isIntroActive) return ['intro', this.introFrame];
        if (this.wasInAirFromKnockback || now < this.hurtUntil) return ['hurt', Math.floor(now / 75) % 4];
        if (this.nova) return ['nova', Math.min(7, Math.floor((now-this.nova.at)/48))];
        if (this.saber) return [this.saber.key, Math.floor((now - this.saber.at) / 56)];
        if (now < this.wallKickUntil && !this.isGrounded) {
            const elapsed = now - this.wallKickAt;
            if (firing) return ['wallShot', elapsed < 90 ? 0 : 1];
            return elapsed < 105 ? ['wallKick', elapsed < 55 ? 0 : 1] : ['wall', elapsed < 140 ? 4 : elapsed < 175 ? 1 : 0];
        }
        if (this.wallSliding && !this.isGrounded) return [firing ? 'wallShot' : 'wall', 2 + Math.floor(now/115)%2];
        if (this.isDashing) return ['dash', (this.dashFrame || 0) % X_FRAMES.dash.length];
        if (!this.isGrounded) {
            const frame = this.vy < -8 ? 1 : this.vy < -2 ? 3 : this.vy < 3 ? 5 : 7;
            return [firing ? 'airShot' : 'jump', frame];
        }
        if (this.isCrouching && !firing) return ['crouch', 1];
        if (Math.abs(this.vx) > .1) {
            const key = firing ? 'runShot' : 'run';
            const index = Math.floor(Math.max(0, now - (this.xRunAt ?? now)) / 60);
            return [key, index < 2 ? index : 2 + (index - 2) % (X_FRAMES[key].length - 2)];
        }
        if (firing) return [this.shotLevel > 1 ? 'charged' : 'shot', Math.floor((now - this.shotAt) / 55)];
        const key = this.health <= this.maxHealth * .3 ? 'hurtIdle' : 'idle';
        return [key, Math.floor(now / 170) % X_FRAMES[key].length];
    }

    getPixelBodyFrame() { return this.spriteFrame(true); }
    pixelBodyIntersectsRect(rect) { return opaqueInRect(this.getPixelBodyFrame(), rect, 2); }

    spriteFrame(body = false) {
        if (!atlas.complete || !atlas.naturalWidth) return null;
        let [key, index] = this.animation();
        if (body && this.nova) [key,index] = ['dash',2];
        else if (body && this.saber) [key, index] = this.saber.key === 'saber' ? ['idle', 0] : ['jump', 5];
        const cells = X_POLISH[key] || X_FRAMES[key];
        const image = X_POLISH[key] ? polishedAtlas : atlas;
        if (!image.complete || !image.naturalWidth) return null;
        const [sx, sy, sw, sh, anchor, foot = sh] = cells[Math.min(index, cells.length - 1)];
        const scale = this.height / 47;
        const feet = this.y + this.height;
        const onWall = (key === 'wall' || key === 'wallShot') && this.wallSliding;
        const [leftWall, rightWall] = HIGHWAY_WALLS;
        const attachedOnLeft = this.x + this.width / 2 < (leftWall.x + rightWall.x) / 2;
        const flipX = onWall ? !attachedOnLeft
            : key === 'wallKick' ? this.xWallSide === 'left'
            : key === 'wall' ? this.xWallSide === 'right'
            : (this.nova?.direction || this.saber?.direction || this.facingDirection) > 0;
        const pivot = !onWall && (key === 'wall' || key === 'wallShot') ? sw / 2 : anchor;
        const dw = sw * scale, dh = sh * scale;
        const dx = onWall
            ? (attachedOnLeft ? leftWall.x - anchor * scale : rightWall.x - (sw - anchor) * scale)
            : this.x + this.width / 2 - (flipX ? sw - pivot : pivot) * scale;
        return { img:image, sx, sy, sw, sh, dx, dy: feet - foot * scale, dw, dh, flipX };
    }

    tryHit(receiver) {
        if (this.nova && !this.nova.hit && receiver.minerPhase !== 'under' && receiver.minerPhase !== 'warning') {
            const elapsed = combatNow() - this.nova.at;
            const center = this.x + this.width / 2;
            const rect = { x: center - 83, y: this.y + this.height - 116, w:166, h:105 };
            const hit = receiver.pixelBodyIntersectsRect?.(rect,center) ??
                (rect.x < receiver.x + receiver.width && rect.x + rect.w > receiver.x &&
                 rect.y < receiver.y + receiver.height && rect.y + rect.h > receiver.y);
            if (elapsed >= 112 && elapsed < 420 && hit) {
                this.nova.hit = true;
                const damage=dealDamage(receiver,NOVA_DAMAGE,{attacker:this,attackName:'Nova Strike',impactX:center});
                if(damage>0&&!receiver.lastGuardImpact?.front){
                    receiver.vx=this.nova.direction*16;receiver.vy=-9;receiver.isGrounded=false;
                    receiver.wasInAirFromKnockback=true;receiver.knockbackAirTimer=0;
                }
            }
            return;
        }
        if (!this.saber || this.saber.hit || receiver.minerPhase === 'under' || receiver.minerPhase === 'warning') return;
        const frame = Math.floor((combatNow() - this.saber.at) / 56);
        if (frame < 2 || frame > 5) return;
        const blade = this.spriteFrame();
        if (!blade) return;
        blade.includeColors = SABER_COLORS;
        const target = receiver.getPixelBodyFrame?.(this.x + this.width / 2);
        const hit = target ? opaqueFramesOverlap(blade, target, null, 1) : opaqueInRect(blade, {
            x: receiver.x, y: receiver.getCurrentY(), w: receiver.width, h: receiver.getCurrentHeight()
        }, 1);
        if (!hit) return;
        this.saber.hit = true;
        dealDamage(receiver, this.saber.key === 'saber' ? X_SABER.ground : X_SABER.air, {
            attacker: this, attackName: 'Sable de X', impactX: this.x + this.width / 2
        });
    }

    draw(opponentX) {
        let f = this.spriteFrame();
        if (!f) return super.draw(opponentX);
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        if (this.busterCharging) {
            const level = getBusterLevel(this);
            f = chargedSpriteFrame(f, 'x', level, combatNow());
        }
        ctx.translate(f.dx - game.cameraX + (f.flipX ? f.dw : 0), f.dy);
        if (f.flipX) ctx.scale(-1, 1);
        ctx.drawImage(f.img, f.sx, f.sy, f.sw, f.sh, 0, 0, f.dw, f.dh);
        ctx.restore();
    }
}
