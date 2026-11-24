import { PrototypeFighter } from './prototype-fighter.js';
import { configureCombatant } from './combat-system.js';
import { combatNow } from './combat-clock.js';
import { ctx, game } from './state.js';
import { beginRobotMove, updateRobotMove, hitRobotMove } from './robot-combat.js';
import { drawRobotFrame } from './robot-sprites.js';
import { opaqueInRect } from './pixel-collision.js';
import { TAILS_FRAMES, tailsFrame } from './tails-sprites.js';

const specs = {
    iq200: { active: [2, 3], damage: 5, range: 66, top: 99 },
    iq300: { active: [2, 4], damage: 7, range: 73, top: 103 },
    iq400: { active: [3, 5], damage: 9, range: 81, top: 117, launch: -6 },
    hook: { ms: 39, active: [8, 13], damage: 16, range: 119, top: 113, launch: -6 },
    upper: { ms: 49, active: [4, 8], damage: 12, range: 79, top: 163, launch: -13 },
    cyclone: { active: [2, 6], damage: 10, range: 94, top: 110, speed: 8 },
    typhoon: { ms: 42, active: [4, 8], damage: 10, range: 89, top: 120 },
    aimApproach: { ms: 32, speed: 15 },
    dunk: { ms: 48, active: [3, 6], damage: 12, range: 86, top: 78, launch: 6 },
    cannon: { ms: 32, shot: 13 },
    airCannon: { ms: 42, shot: 6 },
    flick: { shot: 3 },
    airFlick: { shot: 3 },
    heal: { ms: 105 }
};
for (const [key, spec] of Object.entries(specs)) {
    Object.assign(spec, { key, frames: TAILS_FRAMES[key].length, ms: spec.ms || 57 });
}
const combo = ['iq200', 'iq300', 'iq400'];

function spawnTechnique(owner, kind, direction, aim, charged) {
    const bomb = kind === 'bomb', glove = kind === 'glove';
    const size = bomb ? 22 : glove ? 76 : charged ? 40 : 26;
    const born = combatNow();
    const speed = charged ? 12 : 9;
    game.projectiles.push({
        owner, active: true, type: bomb ? 'Chu² Bomb' : glove ? 'Flick' : 'Energy Ball',
        x: owner.x + owner.width / 2 + (direction > 0 ? 12 : -size - 12),
        y: owner.y + owner.height * .42, width: size, height: size,
        vx: bomb ? direction * 2 : direction * (glove ? 2 : aim ? speed * .56 : speed),
        vy: bomb ? 1 : glove ? 0 : aim * speed * .82,
        update() {
            const age = combatNow() - born;
            this.x += this.vx;
            this.y += this.vy;
            if (bomb) {
                this.vy += .3;
                if (this.y + size >= owner.feetY) {
                    this.y = owner.feetY - size;
                    this.vx = this.vy = 0;
                    this.landedAt ??= combatNow();
                }
                if (this.landedAt && combatNow() - this.landedAt >= 680 && this.width === size) {
                    this.x -= 43;
                    this.y -= 42;
                    this.width = size + 86;
                    this.height = size + 42;
                }
            }
            this.active = age < (bomb ? 2800 : glove ? 315 : 1400) &&
                (!this.landedAt || combatNow() - this.landedAt < 880);
        },
        get damage() { return bomb ? (this.width > size ? 13 : 0) : glove ? 11 : charged ? 13 : 7; },
        get collisionDisabled() { return (bomb && this.width === size) || (glove && combatNow() - born < 75); },
        draw(camera) {
            const age = combatNow() - born;
            const key = bomb ? 'bomb' : glove ? 'glove' : 'ball';
            if (bomb && this.width > size) {
                ctx.save();
                ctx.fillStyle = '#fdd856';
                ctx.globalAlpha = Math.max(0, 1 - (combatNow() - this.landedAt - 680) / 200) * .7;
                ctx.beginPath();
                ctx.ellipse(this.x + this.width / 2 - camera, this.y + this.height * .65, this.width * .5, this.height * .4, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
                return;
            }
            const frame = glove ? Math.min(TAILS_FRAMES.glove.length - 1, Math.floor(age / 27)) : Math.floor(age / 47);
            drawRobotFrame(ctx, tailsFrame(key, frame, this.x + this.width / 2, this.y + this.height, glove ? 2.6 : size / 21, direction), camera);
        }
    });
}

export class Tails extends PrototypeFighter {
    constructor(x, y, controls) {
        super(x, y, controls, { name: 'TAILS', color: '#ffb44c', speed: 7 });
        configureCombatant(this, 'tails', 'TAILS');
        this.pose = { key: 'idle', since: combatNow(), direction: 1 };
        this.auxShot = controls.attack === 'KeyJ' ? 'KeyQ' : 'BracketLeft';
        this.auxTool = controls.attack === 'KeyJ' ? 'KeyE' : 'BracketRight';
        this.healAfter = 0;
    }

    isBusy() { return super.isBusy() || !!this.robotMove; }
    isAttacking() { return super.isAttacking() || !!this.robotMove; }

    beginTechnique(key, target, options = {}) {
        if (this.isHitstunned() || this.isVulnerable || this.isIntroActive || this.robotMove ||
            (this.isBusy() && key !== 'cyclone')) return false;
        const direction = target.x < this.x ? -1 : 1;
        if (key === 'cyclone') this.isDashing = false;
        if (key === 'dunk' && Math.abs(target.x - this.x) > 95) {
            beginRobotMove(this, specs.aimApproach, direction);
            this.robotMove.follow = 'dunk';
            return true;
        }
        if (!beginRobotMove(this, specs[key], direction)) return false;
        Object.assign(this.robotMove, options);
        return true;
    }

    handleCommand(code, target) {
        const c = this.controls, down = this.keys[c.crouch], air = !this.isGrounded;
        if (![c.attack, c.heavy, c.kickLight, c.kickHeavy, c.spinKey, this.auxShot, this.auxTool].includes(code)) return;
        if (this.isHitstunned() || this.isVulnerable) return;
        if (code === this.auxShot) {
            if (!this.isBusy()) this.chargeAt ??= combatNow();
        } else if (code === this.auxTool) {
            if (!down || !game.projectiles.some(p => p.owner === this && p.type === 'Chu² Bomb' && p.active)) {
                this.beginTechnique(air ? 'airFlick' : 'flick', target, { bomb: down });
            }
        } else if (code === c.spinKey) {
            if (air && !this.flightUsed && !this.isBusy()) {
                this.flightUsed = true;
                this.flightUntil = combatNow() + 1050;
            } else if (!air && down && this.health < this.maxHealth && combatNow() >= this.healAfter &&
                this.beginTechnique('heal', target)) this.healAfter = combatNow() + 8000;
        } else if (code === c.attack) {
            if (air) this.beginTechnique('typhoon', target);
            else if (this.robotMove && combo.includes(this.robotMove.spec.key)) {
                const move = this.robotMove;
                if (combatNow() - move.started >= move.spec.active[0] * move.spec.ms) move.chain = true;
            } else this.beginTechnique('iq200', target);
        } else if (code === c.heavy && !air) this.beginTechnique('hook', target);
        else if (code === c.kickLight && !air) this.beginTechnique('upper', target);
        else if (code === c.kickHeavy) this.beginTechnique(air ? (down ? 'dunk' : 'typhoon') : 'cyclone', target);
    }

    releaseShot(target) {
        if (this.chargeAt == null) return false;
        const charged = combatNow() - this.chargeAt >= 550;
        this.chargeAt = null;
        const aim = this.keys[this.controls.jump] ? -1 : this.keys[this.controls.crouch] ? 1 : 0;
        return this.beginTechnique(this.isGrounded ? 'cannon' : 'airCannon', target, { charged, aim });
    }

    tryHit(target) { hitRobotMove(this, target); }

    onDamageTaken(info) { if(info?.stagger===false)return;
        if (info.damage <= 0 || this.lastGuardImpact?.blocked) return;
        this.hurtAt = combatNow();
        this.robotMove = null;
        this.chargeAt = null;
        this.flightUntil = 0;
    }

    update(opponentX, self) {
        const before = this.isGrounded;
        const now = combatNow();
        const move = this.robotMove;
        if (move) {
            const frame = Math.floor((now - move.started) / move.spec.ms);
            if (move.spec.shot != null && frame >= move.spec.shot && !move.fired) {
                move.fired = true;
                const key = move.spec.key.toLowerCase();
                spawnTechnique(this, move.bomb ? 'bomb' : key.includes('flick') ? 'glove' : 'ball',
                    move.direction, move.aim ?? 0, move.charged);
            }
            if (move.spec.key === 'heal' && frame >= 4 && !move.fired) {
                move.fired = true;
                this.health = Math.min(this.maxHealth, this.health + 8);
            }
            if (move.spec.key === 'dunk' && frame >= 3 && !this.isGrounded) this.vy = Math.max(9, this.vy);
            updateRobotMove(this);
        }
        const flying = !this.isGrounded && this.keys[this.controls.spinKey] && now < this.flightUntil && !this.robotMove;
        if (!flying) this.flightUntil = 0;
        if (flying) this.vy = Math.max(this.y > 35 ? -4 : 0, this.vy - 1.8);
        super.update(opponentX, self);
        if (move) {
            if (!this.robotMove && move.follow && !this.isGrounded) {
                beginRobotMove(this, specs[move.follow], move.direction);
            } else if (!this.robotMove && move.chain && this.isGrounded) {
                const next = combo[combo.indexOf(move.spec.key) + 1];
                if (next) this.beginTechnique(next, { x: this.x + move.direction });
            } else if (this.robotMove && move.spec.speed) {
                updateRobotMove(this, true);
            }
        }
        if (!before && this.isGrounded) {
            if (this.pose.key === 'knock') this.impactLandAt = now;
            this.landAt = now;
        }
        if (this.isGrounded) this.flightUsed = false;
        const direction = this.vx && !this.isGuarding ? Math.sign(this.vx) : opponentX >= this.x ? 1 : -1;
        let key = 'idle';
        if (this.wasInAirFromKnockback) key = this.wallSliding ? 'wallHit' : 'knock';
        else if (now - (this.impactLandAt ?? -Infinity) < 265) key = 'groundHit';
        else if (now - (this.hurtAt ?? -Infinity) < 180) key = 'hurt';
        else if (this.isVulnerable) key = 'getup';
        else if (this.isGuarding) key = 'guard';
        else if (this.wallSliding) key = 'wall';
        else if (flying) key = 'fly';
        else if (!this.isGrounded) key = this.vy < 0 ? 'jump' : 'fall';
        else if (this.isDashing) key = 'dash';
        else if (now - (this.landAt ?? -Infinity) < 120) key = 'land';
        else if (Math.abs(this.vx) > .2) {
            const reversing = this.pose.key === 'run' && this.pose.direction !== direction;
            key = reversing || (this.pose.key === 'reverse' && now - this.pose.since < 210) ? 'reverse' : 'run';
        }
        else if (this.pose.key === 'run' || (this.pose.key === 'brake' && now - this.pose.since < 170)) key = 'brake';
        else if (this.pose.direction !== direction || (this.pose.key === 'turn' && now - this.pose.since < 130)) key = 'turn';
        if (this.pose.key !== key || this.pose.direction !== direction) this.pose = { key, since: now, direction };
    }

    getPixelBodyFrame() {
        const move = this.robotMove;
        let { key, since, direction } = move ? { key: move.spec.key, since: move.started, direction: move.direction } : this.pose;
        const index = Math.floor((combatNow() - since) / (move?.spec.ms ?? (key === 'idle' ? 130 : 58)));
        let poseIndex = index;
        const aimStart = key === 'cannon' ? 7 : 6;
        if (move?.aim && ['cannon', 'airCannon'].includes(key) && index >= aimStart) {
            const variant = key + (move.aim < 0 ? 'Up' : 'Down');
            if (index - aimStart < TAILS_FRAMES[variant].length) {
                key = variant;
                poseIndex = index - aimStart;
            }
        }
        const count = TAILS_FRAMES[key].length;
        const frame = move || !['idle','run','fly','guard'].includes(key) ? Math.min(count - 1, poseIndex) : poseIndex % count;
        return tailsFrame(key, frame, this.x + this.width / 2, this.y + this.height, this.height / 43, direction);
    }

    pixelBodyIntersectsRect(rect) { return opaqueInRect(this.getPixelBodyFrame(), rect); }
    draw() { drawRobotFrame(ctx, this.getPixelBodyFrame(), game.cameraX); }
}
