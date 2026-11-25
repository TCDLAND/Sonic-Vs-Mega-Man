import { combatNow } from './combat-clock.js';
import { initBuster, getBusterLevel, BusterProjectile } from './buster-system.js';
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

import { X_UPDATE } from './x-update-frames.js';
import { beginRobotMove, updateRobotMove, hitRobotMove } from './robot-combat.js';

const updateArt = Object.fromEntries(Object.keys(X_UPDATE).map(key => {
    const image = new Image();
    image.src = 'assets/images/x-update/' + key + '.png';
    return [key, image];
}));
const physical = {
    jab:       { ms: 50, active: [2,3], damage: 5, range: 65, top: 104 },
    lowPunch:  { ms: 105, active: [1,1], damage: 6, range: 74, top: 72 },
    lowKick:   { ms: 125, active: [1,1], damage: 8, range: 88, top: 49 },
    kick:      { ms: 105, active: [1,1], damage: 8, range: 88, top: 117 },
    heavyKick: { ms: 76, active: [2,2], damage: 11, range: 106, top: 119 },
    airPunch:  { ms: 105, active: [1,1], damage: 7, range: 76, top: 125 },
    airKick:   { ms: 51, active: [3,5], damage: 9, range: 91, top: 126 },
    upper:     { ms: 53, active: [4,6], damage: 12, range: 79, top: 176, launch: -10, lift: -8 },
    hado:      { ms: 64 }
};
const swordMoves = {
    sAir:     { ms: 58, active: [1,3], damage: 9, range: 105, top: 127 },
    sDashCut: { ms: 57, active: [0,2], damage: 12, range: 115, top: 96, speed: 9 },
    sUpper:   { ms: 55, active: [1,4], damage: 11, range: 105, top: 195, launch: -9 },
    sSpin:    { ms: 44, active: [3,8], damage: 12, range: 110, top: 144, radial: true },
    sDive:    { ms: 77, active: [1,3], damage: 12, range: 80, top: 100, band: 145 },
    sGround:  { ms: 77, active: [2,4], damage: 14, range: 215, top: 94, band: 94 }
};

const framePivots = {
    // El pivote horizontal sigue el torso. La altura se mide sobre el cuerpo,
    // sin contar el sable, el destello ni las estelas de cada recorte.
    lowPunch: [[26,42],[26,42]], lowKick: [[17,41],[17,41]],
    jab: [[24,58],[26,58],[27,58],[27,58],[24,58]],
    upper: [[21,65],[21,65],[16,64],[13,64],[21,64],[17,62],[19,65],[24,66],[18,66]],
    airPunch: [[22,56],[21,57]],
    kick: [[27,52],[32,52]],
    heavyKick: [[19,58],[21,55],[31,49],[23,42]],
    airKick: [[20,62],[21,62],[26,63],[27,60],[19,58],[26,55],[23,61]],
    airGuard: [[13,50],[13,50],[21,50],[23,57],[23,53],[21,52],[17,50]],
    hado: [[23,51],[20,50],[18,50],[28,49],[28,49],[36,49],[22,52]],
    sIdle: [[19,51],[21,51],[22,51],[20,51],[21,51]],
    sRun: [[27,69],[25,68],[19,67],[20,67],[20,68],[21,68],[17,54],[16,54],
        [24,54],[18,54],[13,53],[12,53],[17,54],[15,54]],
    sJump: [[14,76],[13,75],[16,75],[53,75],[41,75],[42,76],[41,76],[41,76],
        [18,76],[15,76],[18,76]],
    sGuard: [[15,67]], sDash: [[33,40]], sWall: [[21,76]], sHurt: [[22,48]],
    sAir: [[25,67],[24,65],[26,68],[37,64],[40,62],[24,63],[20,66]],
    sGround: [[39,87],[38,88],[34,88],[39,88],[43,89],[41,89]],
    sUpper: [[60,77],[32,77],[36,77],[32,77],[32,77],[30,77],[28,77]],
    sDashCut: [[31,43],[26,48],[28,48],[23,47],[27,48],[27,48]],
    sDive: [[14,71],[18,70],[28,70],[30,71]],
    sSpin: [[23,76],[20,73],[17,71],[32,76],[22,80],[17,82],[24,82],[49,75],[64,62],[70,73],[39,81]]
};

// Posiciones en píxeles del atlas, antes de invertir el sprite.
const busterMuzzles = {
    shot: [[4,12],[5,12],[4,12],[4,8]],
    charged: [[4,12],[2,12]],
    runShot: [[1,13],[1,13], ...Array.from({length:14}, () => [1,12])],
    airShot: [[2,13],[4,13],[0,13],[2,16],[2,14],[0,13],[3,14],[3,14]],
    wallShot: [[1,16],[41,17],[42,20],[39,24]]
};

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
    isAttacking() { return Boolean(this.saber || this.nova || this.robotMove) || super.isAttacking(); }
    isBusy() { return Boolean(this.saber || this.nova || this.robotMove) || super.isBusy(); }
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

    onBusterFired(level, direction) {
        this.shotAt = combatNow();
        this.shotDirection = this.busterDirection(direction || this.facingDirection);
        this.shotUntil = this.shotAt + (level > 1 ? 340 : 205);
        this.shotLevel = level;
        playSound(busterAudio);
    }

    onBlockedHit() {
        if (this.saberDrawn) this.saberGuardPoseUntil = combatNow() + 145;
    }

    getBusterMuzzle(level, direction, currentPose = false) {
        const [key, index] = this.animation(currentPose ? 0 : level);
        const frame = this.spriteFrame(false, [key, index], direction);
        const sockets = busterMuzzles[key];
        if (!frame || !sockets) return null;
        const [x, y] = sockets[Math.min(index, sockets.length - 1)];
        const scale = this.height / 47;
        return { x: frame.dx + (frame.flipX ? frame.sw - x : x) * scale,
            y: frame.dy + y * scale };
    }

    busterDirection(fallback) {
        if (this.wallSliding && !this.isGrounded) {
            const [left, right] = HIGHWAY_WALLS;
            return this.x + this.width / 2 < (left.x + right.x) / 2 ? 1 : -1;
        }
        return this.isGrounded ? fallback : this.facingDirection;
    }

    onDamageTaken({stagger=true}={}) { if(!stagger)return;
        if (this.lastGuardImpact?.blocked) return;
        this.hurtUntil = combatNow() + 200;
        this.shotUntil = 0;
        this.saber = null;
        this.robotMove = null;
        this.nova = null;
        this.wallKickUntil = 0;
        this.wallReturnUntil = 0;
    }

    toggleSaber() {
        if (!this.canUseBuster() || this.busterCharging || this.isHitstunned()) return false;
        this.saberDrawn = !this.saberDrawn;
        this.basicCombo = null;
        return true;
    }

    startPhysical(key) {
        if (this.saberDrawn || this.wallSliding || !this.canUseBuster() || this.isHitstunned()) return false;
        if (key === 'hado' && (!this.isGrounded || combatNow() < (this.hadoReadyAt ?? 0))) return false;
        this.busterCharging = false;
        this.busterChargeStart = 0;
        return beginRobotMove(this, { ...physical[key], key, frames: X_UPDATE[key].length }, this.facingDirection || 1);
    }

    startSaber(variant = 'normal') {
        if (!this.saberDrawn || !this.canUseBuster() || this.wallSliding || this.isHitstunned()) return false;
        if (!this.isGrounded && variant === 'normal') return this.startSwordMove('sAir');
        if (variant === 'low' && !this.isGrounded) variant = 'normal';
        const key = this.isGrounded ? 'saber' : 'airSaber';
        this.saber = { key, variant, at: combatNow(), hit: false, direction: this.facingDirection };
        this.facingLocked = true;
        this.facingUnlockAt = this.saber.at + (X_POLISH[key] || X_FRAMES[key]).length * 56;
        return true;
    }

    startSwordMove(key) {
        const spec = swordMoves[key];
        if (!spec || !this.saberDrawn || this.wallSliding || this.isHitstunned() ||
            (!this.isDashing && !this.canUseBuster()) || this.isAttacking() || this.isIntroActive ||
            this.isVulnerable || this.wasInAirFromKnockback) return false;
        this.isDashing = false;
        this.vx = 0;
        if (key === 'sDive') this.vy = Math.max(this.vy, 14);
        return beginRobotMove(this, { ...spec, key, frames: X_UPDATE[key].length }, this.facingDirection || 1);
    }

    drawBusterSprite(shot, camera) {
        const key = 'buster' + shot.level;
        const frames = X_UPDATE[key];
        const tick = Math.floor((combatNow() - shot.spawnedAt) / 70);
        return this.drawShotSprite(shot, camera, key, frames[tick % frames.length]);
    }

    drawShotSprite(shot, camera, key, frame) {
        const img = updateArt[key];
        if (!img.complete || !img.naturalWidth) return false;
        const [sx, sy, sw, sh] = frame;
        const scale = this.height / 47;
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.translate(shot.x - camera + shot.width / 2, shot.y + shot.height / 2);
        ctx.scale(shot.direction, 1);
        ctx.drawImage(img, sx, sy, sw, sh, -sw * scale / 2, -sh * scale / 2, sw * scale, sh * scale);
        ctx.restore();
        return true;
    }

    updateFacing(opponentX) {
        if (!this.isGrounded && !this.isIntroActive) return;
        super.updateFacing(this.xRivalCenter ?? opponentX);
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
        const wasGrounded = this.isGrounded;
        const rival = this === game.p1 ? game.p2 : this === game.p2 ? game.p1 : null;
        const rivalCenter = rival ? rival.x + rival.width / 2 : opponentX;
        this.xRivalCenter = rivalCenter;
        super.update(opponentX, self);
        if (wasGrounded && !this.isGrounded) {
            this.saberJumpPeak = Math.max(1, Math.abs(this.vy));
            this.saberLandUntil = 0;
        } else if (!wasGrounded && this.isGrounded) {
            this.saberLandUntil = now + 68;
        }
        const back = rivalCenter > this.x + this.width / 2 ? this.controls.left : this.controls.right;
        const wasAirGuarding = this.airGuardHeld;
        this.airGuardHeld = !this.isGrounded && this.keys[back] && !this.isAttacking() &&
            !this.isIntroActive && !this.isHitstunned() && !this.isVulnerable &&
            !this.wasInAirFromKnockback && !this.isDashing && !this.wallSliding &&
            now >= (this.guardBrokenUntil || 0);
        if (this.airGuardHeld) {
            if (!wasAirGuarding) this.airGuardAt = now;
            this.isGuarding = true;
            this.guardType = 'high';
        }
        updateRobotMove(this, this.robotMove?.spec.key === 'sDashCut');
        const move = this.robotMove;
        if (move?.spec.key === 'hado' && !move.hit && now - move.started >= 5 * move.spec.ms) {
            move.hit = true;
            this.hadoReadyAt = now + 850;
            const shot = new BusterProjectile(this, 2, move.direction);
            const scale = this.height / 47;
            Object.assign(shot, { type: 'Hadoken', damage: 12, vx: move.direction * 11, projectileForce: 3,
                width: 41 * scale, height: 28 * scale });
            const hand = this.spriteFrame(false, ['hado', 5]);
            if (hand) {
                const handX = hand.dx + (hand.flipX ? hand.sw - 55 : 55) * scale;
                shot.x = handX - (move.direction < 0 ? shot.width : 0);
                shot.y = hand.dy + 29 * scale - shot.height / 2;
            } else if (move.direction < 0) shot.x = this.x - shot.width;
            shot.draw = camera => {
                const frame = X_UPDATE.hadoFx[Math.floor((combatNow() - shot.spawnedAt) / 50) % 3];
                this.drawShotSprite(shot, camera, 'hadoFx', frame);
            };
            game.projectiles.push(shot);
        }
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
        if (moving && !this.isDashing && !this.isAttacking()) {
            const sign = Math.sign(this.vx) === this.facingDirection ? 1 : -1;
            const dt = Math.max(0, Math.min(34, now - (this.xWalkUpdatedAt ?? now)));
            this.xWalkPhase = (this.xWalkPhase ?? 0) + sign * dt / 60;
        }
        this.xWalkUpdatedAt = now;
        if (this.saber && now - this.saber.at >= (X_POLISH[this.saber.key] || X_FRAMES[this.saber.key]).length * 56) this.saber = null;
    }

    animation(pendingShotLevel = 0) {
        const now = combatNow();
        const firing = pendingShotLevel > 0 || now < this.shotUntil;
        if (this.robotMove) return [this.robotMove.spec.key, Math.max(0, Math.floor((now - this.robotMove.started) / this.robotMove.spec.ms))];
        if (this.isIntroActive) return ['intro', this.introFrame];
        if (this.wasInAirFromKnockback || now < this.hurtUntil) return [this.saberDrawn ? 'sHurt' : 'hurt', Math.floor(now / 75) % 4];
        if (this.nova) return ['nova', Math.min(7, Math.floor((now-this.nova.at)/48))];
        if (this.saber) return [this.saber.key, Math.floor((now - this.saber.at) / 56)];
        if (now < this.wallKickUntil && !this.isGrounded) {
            const elapsed = now - this.wallKickAt;
            if (firing) return ['wallShot', elapsed < 90 ? 2 : 3];
            return elapsed < 105 ? ['wallKick', elapsed < 55 ? 0 : 1] : ['wall', elapsed < 140 ? 4 : elapsed < 175 ? 1 : 0];
        }
        if (!firing && this.saberDrawn && !this.isIntroActive) {
            if (this.wallSliding) return ['sWall',0];
            if (now < (this.saberGuardPoseUntil ?? 0)) return ['sGuard',0];
            if (this.isDashing) return ['sDash',0];
            if (!this.isGrounded) {
                const speed = this.saberJumpPeak || Math.abs(this.jumpForce);
                const phase = Math.max(0, Math.min(1, (1 + this.vy / speed) / 2));
                return ['sJump', Math.min(8, Math.floor(phase * 9))];
            }
            if (now < (this.saberLandUntil ?? 0)) return ['sJump', now < this.saberLandUntil - 34 ? 9 : 10];
            if (Math.abs(this.vx) > .1) return ['sRun', this.walkFrame(X_UPDATE.sRun.length)];
            return ['sIdle', Math.floor(now / 145) % X_UPDATE.sIdle.length];
        }
        if (!firing && this.airGuardHeld) return ['airGuard', Math.floor((now - this.airGuardAt) / 26)];
        if (this.wallSliding && !this.isGrounded) return [firing ? 'wallShot' : 'wall', 2 + Math.floor(now/115)%2];
        if (this.isDashing && !firing) return ['dash', (this.dashFrame || 0) % X_FRAMES.dash.length];
        if (!this.isGrounded) {
            const frame = this.vy < -8 ? 1 : this.vy < -2 ? 3 : this.vy < 3 ? 5 : 7;
            return [firing ? 'airShot' : 'jump', frame];
        }
        if (this.isCrouching && !firing) return ['crouch', 1];
        if (Math.abs(this.vx) > .1) {
            const key = firing ? 'runShot' : 'run';
            return [key, this.walkFrame(X_FRAMES[key].length)];
        }
        if (firing) return [(pendingShotLevel || this.shotLevel) > 1 ? 'charged' : 'shot',
            pendingShotLevel ? 0 : Math.floor((now - this.shotAt) / 55)];
        const key = this.health <= this.maxHealth * .3 ? 'hurtIdle' : 'idle';
        return [key, Math.floor(now / 170) % X_FRAMES[key].length];
    }

    getPixelBodyFrame() { return this.spriteFrame(true); }
    pixelBodyIntersectsRect(rect) { return opaqueInRect(this.getPixelBodyFrame(), rect, 2); }

    walkFrame(count) {
        const tick = Math.floor(this.xWalkPhase ?? 0);
        return ((tick % count) + count) % count;
    }

    spriteFrame(body = false, pose = this.animation(), shotDirection = null) {
        if (!atlas.complete || !atlas.naturalWidth) return null;
        let [key, index] = pose;
        if (body && X_UPDATE[key]) [key, index] = this.isGrounded ? ['idle', 0] : ['jump', 5];
        if (X_UPDATE[key]) {
            const img = updateArt[key];
            if (!img.complete || !img.naturalWidth) return null;
            const frameIndex = Math.max(0, Math.min(index, X_UPDATE[key].length - 1));
            const [sx,sy,sw,sh] = X_UPDATE[key][frameIndex];
            const scale = this.height / 47;
            const flipX = (this.robotMove?.direction || this.facingDirection) < 0;
            const [pivot, foot] = framePivots[key]?.[frameIndex] ?? [Math.min(sw / 2, 22), sh - 6];
            return {img,sx,sy,sw,sh,flipX,dw:sw*scale,dh:sh*scale,
                dx:this.x+this.width/2-(flipX?sw-pivot:pivot)*scale,dy:this.y+this.height-foot*scale};
        }
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
        const firingDirection = shotDirection || this.shotDirection || this.facingDirection;
        const flipX = key === 'wallShot' ? (index === 0 ? firingDirection > 0 : firingDirection < 0)
            : onWall ? !attachedOnLeft
            : key === 'wallKick' ? this.xWallSide === 'left'
            : key === 'wall' ? this.xWallSide === 'right'
            : (shotDirection || (busterMuzzles[key] && this.shotDirection) ||
                this.nova?.direction || this.saber?.direction || this.facingDirection) > 0;
        const pivot = !onWall && (key === 'wall' || key === 'wallShot') ? sw / 2 : anchor;
        const dw = sw * scale, dh = sh * scale;
        const dx = onWall
            ? (attachedOnLeft ? leftWall.x - anchor * scale : rightWall.x - (sw - anchor) * scale)
            : this.x + this.width / 2 - (flipX ? sw - pivot : pivot) * scale;
        return { img:image, sx, sy, sw, sh, dx, dy: feet - foot * scale, dw, dh, flipX };
    }

    tryHit(receiver) {
        if (this.robotMove) { hitRobotMove(this, receiver); return; }
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
        if (this.saber.variant === 'low') blade.dy += 21;
        const hit = target ? opaqueFramesOverlap(blade, target, null, 1) : opaqueInRect(blade, {
            x: receiver.x, y: receiver.getCurrentY(), w: receiver.width, h: receiver.getCurrentHeight()
        }, 1);
        if (!hit) return;
        this.saber.hit = true;
        const { variant } = this.saber;
        const low = variant === 'low';
        dealDamage(receiver, low ? 9 : X_SABER[this.saber.key === 'saber' ? 'ground' : 'air'], {
            attacker: this, attackName: low ? 'Barrido de sable' : 'Sable de X',
            ignoreGuard: low && receiver.guardType === 'high',
            impactX: this.x + this.width / 2
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
        const flash = Math.floor((combatNow() - this.shotAt) / 44);
        if (this.shotLevel === 3 && flash >= 0 && flash < X_UPDATE.buster3Flash.length && combatNow() < this.shotUntil) {
            const direction = this.shotDirection || this.facingDirection;
            const muzzle = flash <= 1 ? this.getBusterMuzzle(3, direction, true) : null;
            if (muzzle) this.drawShotSprite({ ...muzzle, width: 0, height: 0, direction },
                game.cameraX, 'buster3Flash', X_UPDATE.buster3Flash[flash]);
        }
    }

    drawVictoryPose(x, feet) {
        const img = updateArt.win;
        if (!img.complete || !img.naturalWidth) return;
        const index = Math.min(X_UPDATE.win.length - 1, Math.floor((combatNow() - this.victoryAt) / 115));
        const [sx, sy, sw, sh] = X_UPDATE.win[Math.max(0,index)];
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, sx, sy, sw, sh, x - sw, feet - sh * 2, sw * 2, sh * 2);
        ctx.restore();
    }
}
