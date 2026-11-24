import { HIGHWAY_WALLS } from './wall-system.js';
import { PrototypeFighter } from './prototype-fighter.js';
import { configureCombatant, dealDamage } from './combat-system.js';
import { combatNow } from './combat-clock.js';
import { ctx, canvas, game } from './state.js';

import { FireEffect, rollingCutterScale } from './rock.js';
import { heatSpriteFrame, warmHeatSprite } from './heat-sprites.js';
import { drawRobotFrame } from './robot-sprites.js';

const names = { cut: 'Cut Man', guts: 'Guts Man', heat: 'Heat Man' };
export const MET_SCALE=3.15;
export const storyRobotBodies = { cut: { scale: 136 / 51, width: 103, height: 136 }, guts: { scale: 170 / 69, width: 164, height: 170 }, heat: { scale: 144 / 51, width: 110, height: 144 } };
const contactMoves = {
    slam: { name: 'Sacudida', damage: 16, range: 225, grounded: true },
    leap: { name: 'Tijera aérea', damage: 12, range: 100 },
    hop: { name: 'Salto vertical', damage: 12, range: 100 },
    slide: { name: 'Corte deslizante', damage: 13, range: 115, grounded: true },
    shoulder: { name: 'Carga de hombro', damage: 15, range: 132 },
    punch: { name: 'Puñetazo de Guts Man', damage: 18, range: 145 },
    rush: { name: 'Embestida de fuego', damage: 15, range: 105 },
    airRush: { name: 'Embestida aérea de fuego', damage: 15, range: 126 },
    pillar: { name: 'Columna de fuego', damage: 14, range: 125 }
};
const movement = { airRush: 16, rush: 17, leap: 10, slide: 15, shoulder: 21 };
const rockFrameMs = 65;
const rockReleaseFrame = 11;
const rockWindup = rockReleaseFrame * rockFrameMs;
const timing = {
    cutter: [330, 1170], wideCutter: [480, 1500], leap: [260, 1030], hop: [245, 1030], slide: [240, 970],
    rock: [rockWindup, 1550], doubleRock: [rockWindup, 1650], slam: [510, 1450], punch: [270, 1050], shoulder: [520, 1700], concreteThrow: [350, 1200],
    fire: [380, 1320], rush: [340, 1190], airRush: [350, 1540], pillar: [510, 1500], fireball: [290, 1020], rain: [620, 2500], counter: [345, 1375]
};
const reach = { leap: 365, slide: 410, shoulder: 390, slam: 245, punch: 165, pillar: 150, rush: 505, airRush: 535 };
const fallback = { cut: 'wideCutter', guts: 'doubleRock', heat: 'fireball' };
const patterns = {
    cut: ['cutter', 'leap', 'slide', 'wideCutter'],
    guts: ['rock', 'shoulder', 'slam', 'punch', 'doubleRock'],
    heat: ['fire', 'airRush', 'counter', 'rush', 'pillar', 'fireball', 'rain']
};
const art = {};
const cutIntroDrop = [['cutAirThrow',0], ['cutAirThrow',0], ['cutJump',0], ['cutJump',0], ['cutRun',3]];
for (const key of ['cut', 'guts', 'heat', 'page', 'cutRun', 'cutRunBare', 'cutThrow', 'cutJump', 'cutJumpBare', 'cutAirThrow', 'cutHit', 'gutsHit', 'heatHit', 'gutsCarry', 'gutsStone', 'gutsRun', 'gutsCharge', 'gutsJump', 'gutsStomp', 'met', 'metShot']) {
    art[key] = new Image();
    art[key].src = 'assets/images/story-robots/' + (key === 'page' ? 'page-entrance' : key) + '.png';
}

function sprite(key, frame, x, feet, scale, flip, hot = false) {
    const img = hot ? warmHeatSprite(art[key]) : art[key];
    if (!img || img instanceof HTMLImageElement && (!img.complete || !img.naturalWidth)) return;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.translate(x, feet);
    if (flip) ctx.scale(-1, 1);
    const w = key.startsWith('guts') && !['guts', 'gutsHit'].includes(key) ? 160 : 120;
    const h = key.startsWith('guts') && !['guts', 'gutsHit'].includes(key) ? 170 : 100;
    ctx.drawImage(img, frame * w, 0, w, h, -w * scale / 2, -h * scale, w * scale, h * scale);
    ctx.restore();
}

const groundFire = new Image();
groundFire.src = 'assets/images/Heat_fire2.png';
const heatShot = new Image();
heatShot.src = 'assets/images/Heat_fire.png';

const cutterArt = new Image();
cutterArt.src = 'assets/images/cutter.png';
const concreteArt = new Image();
concreteArt.src = 'assets/images/concreto.png';

function drawConcrete(x, y, block) {
    if (!concreteArt.complete || !concreteArt.naturalWidth) return;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(concreteArt, block.frame * 32, 0, 32, 32, x - block.width / 2 - block.paddingX, y - block.paddingY, block.drawWidth, block.drawHeight);
}

export class StoryRobot extends PrototypeFighter {
    constructor(id, x, y, controls) {
        super(x, y, controls, { name: names[id], hasSonicJump: false, speed: id === 'guts' ? 4 : 6 });
        this.robotId=id;
        configureCombatant(this, id, names[id]);
        const { width, height } = storyRobotBodies[id];
        this.width = width;
        this.height = height;
        this.y = this.feetY - height;
        this.isIntroActive = true;
        this.attackCount = 0;
        if (id === 'cut') this.jumpForce = -19;
        this.attackAt = -Infinity;
        this.released = true;
        this.nextAttack = combatNow() + 1500;
        this.windup = 390;
        this.mets = [];
        this.fireEffects = [];
        this.nextMet = combatNow() + 4200;
        if (id === 'heat') {
            this.heat = 0;
            this.heatDecayAt = 0;
            this.counterUntil = 0;
        }
    }

    commandMasterMove(move, opponentX) {
        const now=combatNow();
        const spec=timing[move];
        if (!spec || this.isIntroActive || this.isHitstunned() || this.isVulnerable || this.isBusy() ||
            now<this.nextAttack || this.tagLockedUntil>now ||
            (this.cutProjectile && ['cutter','wideCutter'].includes(move))) return false;
        this.move=move;
        this.attackAt=now;
        this.windup=spec[0];
        this.nextAttack=now+spec[1];
        this.released=false;
        this.contact=false;
        this.cutAirShot=this.robotId==='cut'&&!this.isGrounded;
        this.isDashing=false;
        this.attackDirection=opponentX>=this.x?1:-1;
        return true;
    }

    getMasterRepairFrame(id,critical,x,feet,scale=1) {
        const hitArt=art[id+'Hit'];
        if (!hitArt?.naturalWidth) return null;
        const sw=120,sh=100;
        const index=critical?Math.min(1,Math.floor(hitArt.naturalWidth/sw)-1):0;
        return {img:hitArt,sx:index*sw,sy:0,sw,sh,dx:x-sw*scale/2,dy:feet-sh*scale,dw:sw*scale,dh:sh*scale};
    }

    drawGutsAssist(frame,x,feet,dir) {
        sprite('gutsCharge',frame,x,feet,storyRobotBodies.guts.scale,dir>0);
    }

    getIntroFrames() {
        if (this.robotId === 'heat') return Array.from({ length: 17 }, (_, i) => ({ duration: i < 9 ? 4 : 6 }));
        const durations = this.robotId === 'cut' ? [5, 5, 5, 8, 11, 8, 7, 7, 9, 5, 5, 5, 5, 6] : [6, 6, 6, 6];
        return durations.map(duration => ({ duration }));
    }

    update(opponentX, self) {
        const time = combatNow();
        const heatLocked = this.robotId === 'heat' && this.updateHeat(time);
        const elapsed = time - this.attackAt;
        const movingAttack = this.released && elapsed < this.windup + (this.move === 'shoulder' ? 580 : 420) && movement[this.move];
        const walkingSpeed = this.speed;
        const committed = heatLocked || elapsed < this.windup + 460;
        if (committed) {
            this.keys[this.controls.jump] = false;
            this.keys[this.controls.crouch] = false;
        }
        if (movingAttack) {
            if (this.move === 'airRush') this.vy = Math.min(this.vy, elapsed < this.windup + 180 ? 1.5 : 4.5);
            this.speed = movement[this.move];
            this.keys[this.controls.left] = this.attackDirection < 0;
            this.keys[this.controls.right] = this.attackDirection > 0;
        } else if (committed) {
            this.keys[this.controls.left] = false;
            this.keys[this.controls.right] = false;
        }
        if (!committed && !this.manualRobot) this.reactToRock(combatNow());
        if (this.robotId === 'guts' && !committed && this.isGrounded) {
            if (this.keys[this.controls.jump] && this.gutsJumpPrepAt == null) this.gutsJumpPrepAt = combatNow();
            if (this.gutsJumpPrepAt != null) {
                this.keys[this.controls.jump] = combatNow() - this.gutsJumpPrepAt >= 165;
                if (this.keys[this.controls.jump]) this.gutsJumpPrepAt = null;
            }
        } else if (this.robotId === 'guts') this.gutsJumpPrepAt = null;
        const groundedBefore = this.isGrounded;
        super.update(opponentX, self);
        if (this.robotId === 'cut' && !groundedBefore && this.isGrounded) {
            this.cutLandedAt = combatNow();
            this.cutLandingDirection = ['leap', 'hop'].includes(this.move) ? this.attackDirection : this.facingDirection;
        }
        if (this.robotId === 'guts' && !groundedBefore && this.isGrounded) {
            this.gutsLandedAt = combatNow();
            if (this.move === 'slam' && this.released) this.stompLandedAt = this.gutsLandedAt;
        }
        this.speed = walkingSpeed;
        const now = combatNow();
        this.updateCharge(now);
        for (const fire of this.fireEffects) fire.update();
        this.fireEffects = this.fireEffects.filter(fire => fire.active);
        if (this.robotId === 'heat' && ['rush','airRush'].includes(this.move) && this.released && elapsed < this.windup + 420 &&
            [...this.fireEffects, ...(game.p1?.fireEffects ?? [])].some(fire => fire.kind === 'ground' && fire.active && fire.state === 'active' && Math.abs(fire.x - this.x - this.width / 2) < this.width / 2)) {
            this.burningUntil = now + 650;
        }
        if (this.robotId === 'cut' && this.cutProjectile && !this.cutProjectile.active && !this.cutProjectile.returned && this.health > 0) {
            this.cutProjectile.active = true;
            this.cutProjectile.age = Math.max(31, this.cutProjectile.age);
            if (!game.projectiles.includes(this.cutProjectile)) game.projectiles.push(this.cutProjectile);
        }
        if (this.robotId === 'cut' && this.cutProjectile?.returned) {
            this.cutProjectile = null;
            this.cutCaughtAt = now;
            this.cutCaughtInAir = !this.isGrounded;
            this.nextAttack = Math.max(this.nextAttack, now + 260);
        }
        if (game.countdown?.phase !== 'go' || this.isIntroActive || this.tagLockedUntil > now || this.isHitstunned() || heatLocked) return;
        if (this.robotId === 'guts' && !this.manualRobot) {
            this.updateMets(now);
            if (!committed && now >= this.nextMet && this.mets.length < 2 && this.isGrounded) {
                this.move = 'plantMet';
                this.attackAt = now;
                this.windup = 500;
                this.nextAttack = now + 920;
                this.nextMet = now + 6900;
                this.released = false;
                this.attackDirection = opponentX >= this.x ? 1 : -1;
            }
        }
        if (!this.manualRobot && this.robotId === 'guts' && !this.carriedConcrete && (elapsed >= this.windup + 460 || this.move === 'shoulder')) {
            this.catchConcrete(now);
        }
        if (!this.manualRobot && now >= this.nextAttack && now >= (this.busterDefenseUntil ?? 0) && (this.isGrounded || this.robotId === 'cut') && this.gutsJumpPrepAt == null && !this.cutProjectile && Math.abs(opponentX - this.x) < 690) {
            const distance = Math.abs(opponentX - this.x);
            this.attackCount++;
            const attacks = patterns[this.robotId];
            const chargeWindow = this.robotId === 'guts' && distance >= 155 && distance <= 390 && now >= (this.nextShoulderAt ?? 0);
            const wantsCounter = this.robotId === 'heat' && this.heat >= 75 && distance < 550 && now >= (this.counterNextAt ?? 0);
            const playerAirborne = game.p1 && !game.p1.isGrounded;
            const wantsAirRush = this.robotId === 'heat' && playerAirborne && distance >= 120 && distance <= 530 &&
                now >= (this.nextAirRushAt ?? 0);
            const planned = wantsAirRush ? 'airRush' : wantsCounter ? 'counter' : chargeWindow ? 'shoulder' :
                this.isGrounded ? attacks[(this.attackCount - 1) % attacks.length] : 'cutter';
            this.move = planned === 'leap' && distance < 150 ? 'hop' :
                distance > (reach[planned] ?? Infinity) ? fallback[this.robotId] : planned;
            if (this.move === 'shoulder') this.nextShoulderAt = now + 2700;
            if (this.move === 'airRush') this.nextAirRushAt = now + 2800;
            const [windup, interval] = timing[this.move];
            this.windup = windup;
            this.attackAt = now;
            this.cutAirShot = this.robotId === 'cut' && !this.isGrounded;
            this.isDashing = false;
            this.nextAttack = now + interval;
            this.released = false;
            this.attackDirection = opponentX >= this.x ? 1 : -1;
        }
        if (!this.released && now - this.attackAt >= this.windup) {
            this.released = true;
            this.contact = false;
            if (this.move === 'plantMet') {
                this.mets.push({ x: this.x + this.width / 2 - this.attackDirection * 100, born: now, phase: 'walk', phaseAt: now });
            } else if (this.move === 'slam') {
                this.stompLandedAt = null;
                this.vy = -9.8;
                this.isGrounded = false;
                this.nextAttack = Math.max(this.nextAttack, now + 1150);
            } else if (this.move === 'leap' || this.move === 'hop') {
                this.vy = this.move === 'hop' ? -19 : -16;
                this.isGrounded = false;
            } else if (this.move === 'airRush') {
                this.vy = -12.4;
                this.isGrounded = false;
            } else if (this.move === 'counter') {
                this.addHeat(30, now);
                this.counterUntil = now + 780;
                this.counterNextAt = now + 2600;
            } else if (this.move === 'fire') {
                for (const speed of [5, 9, 13]) this.launch(speed);
            } else if (this.move === 'rock') {
                this.launch(12);
            } else if (this.move === 'doubleRock') {
                this.launch(8);
                this.launch(15);
            } else if (this.move === 'rain') {
                for (let lane = -2; lane <= 2; lane++) {
                    const player = this===game.p1?game.p2:game.p1;
                    const center = Math.max(700, Math.min(1850, player.x + player.width / 2));
                    const x = Math.max(250, Math.min(2280, center + lane * 180 + (Math.random() - .5) * 140));
                    this.launch(0, { x, y: player.feetY - 660 - Math.random() * 160, rain: true });
                }
            } else if (this.move === 'concreteThrow') {
                const concrete = this.carriedConcrete;
                this.carriedConcrete = null;
                this.launch(16, { concrete });
            } else if (!contactMoves[this.move]) this.launch();
        }
    }

    addHeat(amount, now) {
        this.heat = Math.min(100, this.heat + amount);
        this.heatDecayAt = now + 1650;
    }

    updateHeat(now) {
        if (now >= this.heatDecayAt && this.heat > 0) {
            this.heat = Math.max(0, this.heat - 6);
            this.heatDecayAt = now + 380;
        }
        const counter = this.counterAttack;
        if (!counter) return this.counterUntil > now;
        const elapsed = now - counter.at;
        if (elapsed >= 390) {
            this.counterAttack = null;
            return false;
        }
        if (elapsed < 125) this.x = Math.max(HIGHWAY_WALLS[0].x, Math.min(HIGHWAY_WALLS[1].x - this.width, this.x - counter.direction * 4));
        if (!counter.released && elapsed >= 155) {
            counter.released = true;
            this.attackDirection = counter.direction;
            if (counter.projectile) this.launch(15, { returnedFire: true });
            else {
                const target = counter.target;
                if (![game.p1, game.p2].includes(target) || target.health <= 0 ||
                    Math.abs(this.x - target.x) > 220 || Math.abs(this.y - target.y) > 105) return true;
                const hit = dealDamage(target, 17, { attacker: this, element: 'fire',
                    attackName: 'Contraataque en llamas', impactX: this.x + this.width / 2 });
                if (hit > 0 && !target.lastGuardImpact?.blocked) {
                    target.vx = counter.direction * 13;
                    target.vy = -11;
                    target.isGrounded = false;
                    target.wasInAirFromKnockback = true;
                    target.knockbackAirTimer = 0;
                }
            }
        }
        return true;
    }

    interceptIncomingHit(damage, { attacker, element, projectile }) {
        if (this.robotId !== 'heat' || !attacker || attacker === this) return false;
        const now = combatNow();
        const fire = element === 'fire';
        if (fire) this.addHeat(projectile ? Math.max(18, damage * 3) : Math.max(12, damage * 2), now);
        const direction = attacker.x + attacker.width / 2 >= this.x + this.width / 2 ? 1 : -1;
        if (now >= this.counterUntil || direction !== this.attackDirection || this.counterAttack || projectile && !fire) return fire;
        this.counterUntil = 0;
        this.addHeat(25, now);
        this.counterAttack = { at: now, direction, target: attacker, projectile: Boolean(projectile) };
        this.nextAttack = Math.max(this.nextAttack, now + 740);
        this.attackAt = -Infinity;
        this.released = true;
        return true;
    }

    updateMets(now) {
        const target = game.p1;
        this.mets = this.mets.filter(met => now - met.born < 12500);
        for (const met of this.mets) {
            const dx = target.x + target.width / 2 - met.x;
            met.direction = Math.sign(dx) || 1;
            const elapsed = now - met.phaseAt;
            if (met.phase === 'walk') {
                if (Math.abs(dx) > 220) met.x += met.direction * 2.1;
                else { met.phase = 'hide'; met.phaseAt = now; }
            } else if (met.phase === 'hide' && elapsed >= 360) {
                met.phase = 'peek';
                met.phaseAt = now;
            } else if (met.phase === 'peek' && elapsed >= 240) {
                met.phase = 'shoot';
                met.phaseAt = now;
                for (const vy of [-2.4, 0, 2.4]) this.launchMetShot(met, vy);
            } else if (met.phase === 'shoot' && elapsed >= 410) {
                met.phase = 'walk';
                met.phaseAt = now;
            }
        }
    }

    launchMetShot(met, vy) {
        const direction = met.direction;
        game.projectiles.push({
            owner: this, type: 'Disparo Met', x: met.x + direction * 15, y: this.feetY - 38,
            width: 18, height: 16, vx: 9 * direction, vy, damage: 4, active: true, age: 0,
            update() {
                this.x += this.vx; this.y += this.vy;
                if (++this.age > 85 || this.y > this.owner.feetY) this.active = false;
            },
            draw(camera) { sprite('metShot', Math.floor(this.age / 4) % 2, this.x - camera + 9, this.y + 16, 1.6, false); }
        });
    }

    drawMets(now) {
        for (const met of this.mets) {
            const elapsed = now - met.phaseAt;
            const frame = met.phase === 'walk' ? 4 + Math.floor(now / 95) % 4
                : met.phase === 'hide' ? 0 : met.phase === 'peek' ? 1 + Math.min(2, Math.floor(elapsed / 80))
                : 3;
            const flip = met.phase === 'hide' ? met.direction < 0 : met.direction > 0;
            sprite('met', frame, met.x - game.cameraX, this.feetY, MET_SCALE, flip);
        }
    }

    reactToRock(now) {
        const rock = game.p1;
        if (!['cut', 'guts'].includes(this.robotId) || rock?.characterId !== 'rock' ||
            game.countdown?.phase !== 'go' || !this.isGrounded || this.isHitstunned()) return;
        const center = this.x + this.width / 2;
        const shot = game.projectiles.find(p => p.active && p.owner === rock && p.type?.startsWith('buster-') &&
            (center - p.x) * p.vx > 0 && Math.abs(center - p.x) < Math.abs(p.vx) * 16 &&
            p.y + p.height > this.y && p.y < this.y + this.height);
        if (!shot) return;
        const toward = rock.x > this.x ? 1 : -1;
        const jump = this.robotId === 'cut' && shot.y > this.y + this.height * .26 &&
            now >= (this.nextBusterHop ?? 0);
        this.keys[this.controls.left] = jump ? toward < 0 : toward > 0;
        this.keys[this.controls.right] = jump ? toward > 0 : toward < 0;
        this.keys[this.controls.jump] = jump;
        if (jump) this.nextBusterHop = now + 740;
        else this.busterDefenseUntil = now + 150;
    }

    catchConcrete(now, supplier = game.p1) {
        const rock = supplier;
        if (!rock?.concretes || (rock!==this && rock.characterId!=='rock') || !this.isGrounded) return;
        const center = this.x + this.width / 2;
        const direction = rock===this?(this.facingDirection||1):rock.x+rock.width/2>center?1:-1;
        const block = rock.concretes.find(item => {
            if (!item.isPlatform()) return false;
            const rect = item.platformRect;
            const near = direction > 0 ? rect.x - center : center - rect.x - rect.w;
            return near >= -rect.w && near < this.width / 2 + 95 &&
                rect.y < this.y + this.height && rect.y + rect.h > this.y;
        });
        if (!block) return;
        const rect = block.platformRect;
        const art = block.collisionFrame;
        this.carriedConcrete = {
            frame: block.frame, width: rect.w, height: rect.h, drawWidth: art.dw, drawHeight: art.dh,
            paddingX: rect.x - art.dx, paddingY: rect.y - art.dy
        };
        block.break();
        block.active = false;
        this.chargedTarget = null;
        this.move = 'concreteThrow';
        this.attackDirection = direction;
        this.attackAt = now;
        this.isDashing = false;
        this.released = false;
        [this.windup] = timing.concreteThrow;
        this.nextAttack = now + timing.concreteThrow[1];
    }

    updateCharge(now) {
        const target = this.chargedTarget;
        if (!target) return;
        if (![game.p1,game.p2].includes(target) || target.health <= 0 || this.move !== 'shoulder' || this.isHitstunned()) {
            this.chargedTarget = null;
            return;
        }
        const direction = this.attackDirection;
        const edge = direction > 0 ? HIGHWAY_WALLS[1].x - target.width : HIGHWAY_WALLS[0].x;
        const ahead = direction > 0 ? this.x + this.width : this.x - target.width;
        target.x = direction > 0 ? Math.min(edge, ahead) : Math.max(edge, ahead);
        if (target.x === edge || now >= this.chargeEndsAt) {
            this.chargedTarget = null;
            if (target.x === edge) {
                this.x = direction > 0 ? target.x - this.width : target.x + target.width;
                this.attackAt = now - this.windup - 580;
                this.vx = 0;
                dealDamage(target, 8, { attacker: this, attackName: 'Impacto contra el muro', impactX: this.x });
            }
        }
    }

    getPixelBodyFrame(opponentX = game.p1?.x ?? this.x) {
        const id = this.robotId;
        const { scale } = storyRobotBodies[id];
        const img = art[id];
        const frame = id === 'cut' ? 12 : 0;
        return { img, sx: frame * 120, sy: 0, sw: 120, sh: 100,
            dx: this.x + this.width / 2 - 60 * scale, dy: this.y + this.height - 100 * scale,
            dw: 120 * scale, dh: 100 * scale, flipX: id === 'heat' ? opponentX < this.x : opponentX > this.x };
    }

    onMeleeContact(attacker) {
        if (this.robotId !== 'heat' || this.burningUntil <= combatNow() || !this.burningUntil ||
            combatNow() < (this.nextBurnContact ?? 0)) return;
        this.nextBurnContact = combatNow() + 450;
        dealDamage(attacker, 5, { attacker: this, attackName: 'Contacto con Heat Man en llamas', projectile: true });
    }

    tryHit(target) {
        for (const fire of this.fireEffects) fire.tryHit(target);
        const elapsed = combatNow() - this.attackAt;
        const impactAge = this.move === 'slam' ? combatNow() - (this.stompLandedAt ?? Infinity) : elapsed - this.windup;
        const hitWindow = this.move === 'shoulder' ? 560 : ['leap', 'hop'].includes(this.move) ? 700 : 420;
        if (!this.released || this.contact || impactAge < 0 || impactAge > hitWindow || this.isHitstunned()) return;
        const distance = Math.abs(this.x + this.width / 2 - target.x - target.width / 2);
        const move = contactMoves[this.move];
        if (!move || distance >= move.range || target.minerPhase === 'under') return;
        const active = impactAge;
        if (['leap', 'hop'].includes(this.move) && (active < 190 || this.vy < 0)) return;
        if (this.move === 'slam' && distance > 55 + active * .62) return;
        if (move.grounded ? !target.isGrounded : Math.abs(target.y - this.y) >= 105) return;
        const toward = Math.sign(target.x + target.width / 2 - this.x - this.width / 2);
        if (!['slam', 'pillar'].includes(this.move) && toward !== this.attackDirection) return;
        this.contact = true;
        const dealt = dealDamage(target, move.damage, {
            attacker: this,
            attackName: move.name,
            element: this.robotId === 'heat' ? 'fire' : undefined,
            impactX: this.x + this.width / 2
        });
        if (dealt > 0 && !target.lastGuardImpact?.blocked && !target.lastGuardImpact?.broken) {
            target.vx = (toward || 1) * (this.move === 'punch' ? 11 : 7);
            if (this.move === 'shoulder') {
                this.chargedTarget = target;
                this.chargeEndsAt = this.attackAt + this.windup + 580;
            }
        }
    }

    onDamageTaken({stagger=true}={}) { if(!stagger)return;
        if (this.lastGuardImpact?.blocked) return;
        const now = combatNow();
        this.hurtUntil = now + 200;
        if (this.robotId === 'heat') {
            this.counterUntil = 0;
            this.counterAttack = null;
        }
        this.carriedConcrete = false;
        this.chargedTarget = null;
        this.nextAttack = Math.max(this.nextAttack, now + 340);
        this.attackAt = -Infinity;
        this.released = true;
    }

    launch(speed = 12, options = {}) {
        const owner = this, id = this.robotId, direction = this.attackDirection;
        const wide = this.move === 'wideCutter';
        const fireball = this.move === 'fireball' || options.returnedFire;
        const rock = (game.teamFighters?.p1 ?? [game.p1]).find(fighter => fighter?.characterId === 'rock');
        const cutterScale = rock ? rollingCutterScale(rock) : rollingCutterScale({ height: 153 });
        const gutsScale = storyRobotBodies.guts.scale;
        const width = options.concrete?.width ?? (id === 'guts' ? 114 * gutsScale : id === 'cut' ? 32 * cutterScale : fireball ? 78 : 53);
        const height = options.concrete?.height ?? (id === 'cut' ? 16 * cutterScale : id === 'guts' ? 89 * gutsScale : width * .7);
        const naturalRock = id === 'guts' && !options.concrete;
        const originX = this.x + this.width / 2 + direction * (naturalRock ? 8 * gutsScale : 40);
        const originY = naturalRock ? this.feetY - 69 * gutsScale - height : this.y + 38;
        const projectile = {
            hp: naturalRock ? 20 : undefined,
            owner, x: options.x ?? originX - width / 2, y: options.y ?? originY,
            width, height, vx: options.rain ? 0 : direction * speed, vy: id === 'guts' ? -8 - speed * .2 : id === 'heat' && !fireball ? -6 - speed * .24 : 0,
            age: 0, active: true, hitFighters: id === 'cut' || naturalRock ? new WeakSet() : undefined,
            damage: id === 'guts' ? (this.move === 'doubleRock' ? 10 : 14) : wide || fireball ? 13 : 9,
            element: id === 'heat' ? 'fire' : undefined,
            type: options.returnedFire ? 'Fuego devuelto' : options.concrete ? 'Concrete devuelto' : options.rain ? 'Lluvia de fuego' : wide ? 'Rolling Cutter amplio' : fireball ? 'Bola de fuego' : { cut: 'Rolling Cutter', guts: 'Roca', heat: 'Fuego rasante' }[id],
            update() {
                this.age++;
                if (this.rolling) {
                    this.x += this.vx;
                    this.vx *= .994;
                    if (this.x <= HIGHWAY_WALLS[0].x || this.x + this.width >= HIGHWAY_WALLS[1].x) this.active = false;
                    return;
                }
                if (id === 'cut' && this.age >= 32) {
                    if (this.age === 32) this.hitFighters = new WeakSet();
                    const dx = owner.x + owner.width / 2 - (this.x + this.width / 2);
                    const dy = owner.y + 12 - this.y;
                    const distance = Math.hypot(dx, dy);
                    if (distance <= 22) {
                        this.returned = true;
                        this.active = false;
                        return;
                    }
                    this.vx = dx / distance * 22;
                    this.vy = dy / distance * 22;
                }
                if (id === 'guts') this.vy += .6;
                if (id === 'heat' && !fireball) this.vy = Math.min(options.rain ? 24 : 16, this.vy + .85);
                this.x += this.vx;
                this.y += this.vy;
                const floor = owner.feetY - this.height;
                if (naturalRock && this.y >= floor) {
                    this.y = floor;
                    this.vy = 0;
                    this.rolling = true;
                    return;
                }
                if (id === 'heat' && !fireball && this.y > floor) {
                    const fire = new FireEffect(owner, 'ground', this.x + this.width / 2, owner.feetY, direction);
                    const rock = (game.teamFighters?.p1 ?? [game.p1]).find(fighter => fighter?.characterId === 'rock');
                    fire.scale = (rock?.height ?? 153) / 48;
                    owner.fireEffects.push(fire);
                    this.active = false;
                    return;
                }
                if (id === 'heat' && this.y > floor) {
                    this.y = floor;
                    this.vy = 0;
                    this.landedAt ??= this.age;
                    this.vx = 0;
                    this.height = 60;
                    this.y = owner.feetY - this.height;
                }
                if (id !== 'cut' && (this.y > floor + 40 || this.age > (options.rain ? 150 : 125) || (this.landedAt != null && this.age - this.landedAt > (options.rain ? 60 : 40)))) this.active = false;
            },
            draw(camera) {
                ctx.save();
                const x = this.x - camera + this.width / 2;
                const y = this.y + this.height / 2;
                if (options.rain && this.landedAt == null) {
                    ctx.strokeStyle = '#ffb365';
                    ctx.globalAlpha = .65;
                    ctx.lineWidth = 3;
                    ctx.beginPath();
                    ctx.ellipse(x, owner.feetY - 4, this.width * .6, 7, 0, 0, Math.PI * 2);
                    ctx.stroke();
                    ctx.globalAlpha = 1;
                }
                if (id === 'cut') {
                    if (cutterArt.complete && cutterArt.naturalWidth) {
                        ctx.imageSmoothingEnabled = false;
                        const frame = Math.floor(this.age / 3) % 9;
                        ctx.drawImage(cutterArt, frame * 32, 0, 32, 16, x - this.width / 2, y - this.height / 2, this.width, this.height);
                    }
                } else if (this.landedAt != null && groundFire.complete && groundFire.naturalWidth) {
                    const frame = (Math.floor((this.age - this.landedAt) / 4) % 6) + 2;
                    ctx.drawImage(groundFire, frame * 32, 0, 32, 64, this.x - camera, owner.feetY - 66, this.width, 66);
                } else if (options.concrete) drawConcrete(x, this.y, options.concrete);
                else if (id === 'guts' && art.gutsStone.complete && art.gutsStone.naturalWidth) {
                    ctx.imageSmoothingEnabled = false;
                    if (this.rolling) {
                        ctx.translate(x, y);
                        ctx.rotate(this.age * Math.sign(this.vx) * .1);
                        ctx.drawImage(art.gutsStone, -this.width / 2, -this.height / 2, this.width, this.height);
                    } else ctx.drawImage(art.gutsStone, this.x - camera, this.y, this.width, this.height);
                }
                else if (id === 'heat' && heatShot.complete && heatShot.naturalWidth) {
                    ctx.imageSmoothingEnabled = false;
                    ctx.translate(x, y);
                    if (direction > 0) ctx.scale(-1, 1);
                    ctx.drawImage(heatShot, Math.floor(this.age / 4) % 8 * 32, 0, 32, 32,
                        -this.width / 2, -this.height / 2, this.width, this.height);
                }
                ctx.restore();
            }
        };
        game.projectiles.push(projectile);
        if (id === 'cut') this.cutProjectile = projectile;
    }

    drawHeatPose(x, feet, scale, right, now, elapsed) {
        let key, frame = 0;
        const active = elapsed - this.windup;
        const queue = this.counterAttack;
        if (this.isIntroActive) {
            key = 'heat-intro'; frame = this.introFrame;
        } else if (this.wasInAirFromKnockback) key = 'heat-knockback';
        else if (queue) {
            key = queue.released ? 'heat-throw' : 'heat-guard-hot';
            frame = queue.released ? Math.min(4, Math.floor((now - queue.at - 155) / 47)) :
                Math.min(1, Math.floor((now - queue.at) / 74));
            right = queue.direction > 0;
        } else if (this.counterUntil > now) {
            key = 'heat-counter'; frame = Math.floor(now / 108) % 4;
        } else if (this.move === 'counter' && active < 0 || ['rush','airRush'].includes(this.move) && active < 0) {
            key = 'heat-charge'; frame = Math.min(4, Math.floor(elapsed / this.windup * 5));
        } else if (['rush','airRush'].includes(this.move) && active < 420) {
            key = 'heat-dash'; frame = Math.floor(active / 67) % 6;
        } else if (this.isGuarding) {
            key = this.heat >= 55 ? 'heat-guard-hot' : 'heat-guard';
            frame = this.lastGuardImpact?.blocked && now - this.lastGuardImpact.at < 165 ? 1 : 0;
        } else if (['fire', 'fireball', 'rain'].includes(this.move) && active < 230) {
            key = 'heat-throw';
            frame = active < 0 ? Math.min(1, Math.floor(elapsed / this.windup * 2)) :
                2 + Math.min(2, Math.floor(active / 72));
        }
        if (!key) return false;
        const retint = this.heat >= 55 && ['heat-throw', 'heat-knockback'].includes(key);
        const pose = heatSpriteFrame(key, frame, x, feet, scale, right, retint);
        if (!pose) return false;
        drawRobotFrame(ctx, pose);
        return true;
    }

    draw(opponentX) {
        const id = this.robotId;
        const x = this.x + this.width / 2 - game.cameraX;
        const feet = this.y + this.height;
        const { scale } = storyRobotBodies[id];
        const elapsed = combatNow() - this.attackAt;
        const right = elapsed < this.windup + 460 ? this.attackDirection > 0 : opponentX > this.x;
        const flip = right;
        if (id === 'guts') this.drawMets(combatNow());
        for (const fire of this.fireEffects) fire.draw();
        if (id === 'cut' && this.isIntroActive) {
            const step = this.introFrame;
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            if (step < 9) {
                sprite('page', step, canvas.width - 83, 173, 2.7, false);
                return;
            }
            const progress = (step - 8) / 5;
            const arc = progress * progress;
            const screenX=canvas.width-83+(x-canvas.width+83)*progress;
            const screenFeet=173+(feet-173)*arc;
            const [sheet,frame]=cutIntroDrop[Math.min(step-9,cutIntroDrop.length-1)];
            sprite(sheet,frame,screenX,screenFeet,scale,step>=11&&flip);
            return;
        }
        const now = combatNow();
        if (id === 'heat' && this.drawHeatPose(x, feet, scale, right, now, elapsed)) return;
        const hurt = this.hurtUntil > now;
        if (hurt) {
            if (id === 'cut' && this.cutProjectile && !this.cutProjectile.returned) { sprite('cutThrow', 7, x, feet, scale, flip); return; }
            sprite(id + 'Hit', Math.min(2, Math.floor((200 - (this.hurtUntil - now)) / 66)), x, feet, scale, flip, id === 'heat' && this.heat >= 55);
            return;
        }
        if (id === 'cut') {
            const away = Boolean(this.cutProjectile && !this.cutProjectile.returned);
            const isThrow = this.move === 'cutter' || this.move === 'wideCutter';
            const landed = this.isGrounded && now - (this.cutLandedAt ?? -Infinity) < 105;
            if (landed) {
                ctx.save();
                ctx.globalCompositeOperation = 'source-over';
                ctx.globalAlpha = 1;
                sprite(away ? 'cutJumpBare' : 'cutJump', 2, x, feet, scale, this.cutLandingDirection > 0);
                ctx.restore();
                return;
            }
            const catchAge = now - (this.cutCaughtAt ?? -Infinity);
            if (catchAge < 240) {
                if (this.cutCaughtInAir) sprite('cutAirThrow', catchAge < 100 ? 1 : 0, x, feet, scale, flip);
                else sprite('cutThrow', 3 - Math.floor(catchAge / 60), x, feet, scale, flip);
                return;
            }
            if (isThrow && elapsed < this.windup + 240) {
                if (this.cutAirShot) sprite('cutAirThrow', this.released ? 1 : 0, x, feet, scale, flip);
                else {
                    const pose = this.released ? 4 + Math.min(3, Math.floor((elapsed - this.windup) / 60))
                        : Math.min(3, Math.floor(elapsed / this.windup * 4));
                    sprite('cutThrow', pose, x, feet, scale, flip);
                }
                return;
            }
            if (!this.isGrounded) {
                if (away && this.cutAirShot) sprite('cutAirThrow', 1, x, feet, scale, flip);
                else sprite(away ? 'cutJumpBare' : 'cutJump', this.vy < 0 ? 0 : 1, x, feet, scale, flip);
                return;
            }
        }
        const cutRunning = id === 'cut' && (elapsed >= this.windup + 460 || this.cutProjectile?.active) && this.isGrounded && Math.abs(this.vx) > 1;
        if (cutRunning) {
            this.cutRunSince ??= now;
            const cutterAway = Boolean(this.cutProjectile?.active);
            const sheet = cutterAway ? 'cutRunBare' : 'cutRun';
            sprite(sheet, Math.floor((now - this.cutRunSince) / 60) % 9, x, feet, scale, this.vx > 0);
            return;
        }
        this.cutRunSince = null;
        if (id === 'cut' && this.cutProjectile && !this.cutProjectile.returned) {
            sprite('cutThrow', 7, x, feet, scale, flip);
            return;
        }
        let frame = id === 'cut' ? 12 + Math.floor(now / 135) % 4 : 0;
        const active = elapsed - this.windup;
        if (active < 0) frame = ['rush', 'slam', 'pillar', 'rain'].includes(this.move) ? 8 : 1;
        else if (active < 340) frame = this.move === 'rush' ? 9 + Math.floor(elapsed / 70) % 2
            : ['leap', 'slam'].includes(this.move) ? 9 : this.move === 'slide' ? 11 : ['punch', 'shoulder'].includes(this.move) ? 10 : this.move === 'pillar' || this.move === 'rain' ? 8 : 2;
        else if (active < 460) frame = 11;
        else if (!this.isGrounded) frame = 3;
        else if (Math.abs(this.vx) > 1) frame = 5 + Math.floor(now / 90) % 3;
        if (id === 'guts' && active >= 0 && active < 340 && ['rock', 'doubleRock', 'concreteThrow'].includes(this.move)) {
            frame = 12 + Math.min(2, Math.floor(active / 110));
        }
        if (this.move === 'slam' && active >= 0 && active < 290) {
            const progress = active / 290;
            ctx.save();
            ctx.globalAlpha = 1 - progress;
            ctx.strokeStyle = '#ffd39b';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.ellipse(x, feet - 3, 30 + 195 * progress, 4 + 13 * progress, 0, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }
        if (this.move === 'pillar' && active >= 0 && active < 350 && groundFire.complete && groundFire.naturalWidth) {
            const flame = Math.min(10, 2 + Math.floor(active / 42));
            for (const offset of [-62, 62]) {
                ctx.drawImage(groundFire, flame * 32, 0, 32, 64, x + offset - 34, feet - 120, 68, 120);
            }
        }
        if (active < 0) {
            ctx.save();
            ctx.globalAlpha = .2 + .5 * (elapsed / this.windup);
            ctx.strokeStyle = id === 'heat' ? '#ff9348' : id === 'guts' ? '#ffc879' : '#fff1bc';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.ellipse(x, feet - 3, this.width * .53, 9, 0, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }
        if (id === 'guts') {
            if (this.move === 'shoulder' && active < 580) {
                const pose = active < 0 ? Math.min(1, Math.floor(elapsed / this.windup * 2)) : 2 + Math.min(7, Math.floor(active / 72));
                sprite('gutsCharge', pose, x, feet, scale, this.attackDirection > 0);
                return;
            }
            const stompAge = now - (this.stompLandedAt ?? -Infinity);
            if (this.move === 'slam' && this.released && stompAge < 360) {
                sprite('gutsStomp', Math.floor(stompAge / 60), x, feet, scale, flip);
                return;
            }
            if (this.move === 'plantMet' && active < 170) {
                ctx.save();
                ctx.fillStyle = '#a8784c';
                for (let i = 0; i < 9; i++) ctx.fillRect(x + i * 7 - 32, feet - ((i * 19 + elapsed / 5) % 32), 5, 4);
                ctx.restore();
                sprite('gutsJump', 2, x, feet, scale, flip);
                return;
            }
            if (this.gutsJumpPrepAt != null) {
                sprite('gutsJump', Math.min(2, Math.floor((now - this.gutsJumpPrepAt) / 55)), x, feet, scale, flip);
                return;
            }
            const recentlyLanded = now - (this.gutsLandedAt ?? -Infinity) < 100;
            if (!this.isGrounded || recentlyLanded || (this.move === 'slam' && active < 0)) {
                const pose = recentlyLanded ? 5 : active < 0 && this.isGrounded ? Math.min(2, Math.floor(elapsed / this.windup * 3)) : this.vy < 0 ? 3 : 4;
                sprite('gutsJump', pose, x, feet, scale, flip);
                return;
            }
            if (active >= 460 && Math.abs(this.vx) > 1) {
                sprite('gutsRun', Math.floor(now / 75) % 10, x, feet, scale, this.isGuarding ? opponentX > this.x : this.vx > 0);
                return;
            }
        }
        if (id === 'guts' && ['rock', 'doubleRock'].includes(this.move) && active < 3 * rockFrameMs) {
            const pose = !this.released
                ? Math.min(rockReleaseFrame - 1, Math.floor(elapsed / rockFrameMs))
                : rockReleaseFrame + Math.min(2, Math.floor(active / rockFrameMs));
            sprite('gutsCarry', pose, x, feet, scale, flip);
            return;
        }
        if (this.carriedConcrete) {
            frame = 15;
            drawConcrete(x - this.attackDirection * 15, feet - 62 * scale - this.carriedConcrete.height, this.carriedConcrete);
        
        }
        if (id === 'heat' && this.move === 'rush' && active >= 0 && active < 420) {
            frame = this.burningUntil > now ? 9 + Math.floor(active / 60) % 2 : 11;
        }
        sprite(id, frame, x, feet, scale, id === 'heat' && frame === 0 ? !flip : flip, id === 'heat' && this.heat >= 55);
    }
}

export const storyRobotGuide = {
    cut: { name: 'Cut Man', moves: [
        ['Rolling Cutter', 'Las tijeras atacan de ida y vuelta.', 9, [0, 1, 2, 11]],
        ['Rolling Cutter amplio', 'Hace más daño y también regresa.', 13, [0, 1, 2, 11]],
        ['Tijera aérea', 'Salta en arco o hacia arriba de cerca y golpea al descender.', 12, [1, 3, 9, 11]],
        ['Corte deslizante', 'Se acerca al ras del suelo.', 13, [1, 11, 0]]
    ] },
    guts: { name: 'Guts Man', moves: [
        ['Lanzamiento de roca', 'Levanta una roca y la lanza en arco.', 14, Array.from({ length: 14 }, (_, i) => i), 'gutsCarry'],
        ['Doble roca', 'Dos rocas toman trayectorias distintas.', '10 por roca', Array.from({ length: 14 }, (_, i) => i), 'gutsCarry'],
        ['Carga de hombro', 'Arrastra al rival y puede estrellarlo contra el muro.', '15 + 8 en el muro', Array.from({ length: 10 }, (_, i) => i), 'gutsCharge'],
        ['Sacudida', 'El impacto se expande por el suelo. Se puede saltar.', 16, [0, 1, 2, 3, 4, 5], 'gutsStomp'],
        ['Puñetazo', 'Golpea y empuja de cerca.', 18, [0, 1, 10, 11]],
        ['Devolver Concrete', 'Recoge el bloque fijo o móvil de Rock y se lo lanza.', 14, [0, 15, 12, 13, 14]],
        ['Sacar un Met', 'Escarba y saca un Met que camina, se esconde y dispara.', '4 por proyectil', [0, 1, 2, 3, 4, 5, 6, 7], 'met']
    ] },
    heat: { name: 'Heat Man', moves: [
        ['Fuego rasante', 'Tres arcos dejan fuego donde aterrizan.', '9 por proyectil', [0, 1, 2, 3, 4], 'heat-throw'],
        ['Contraataque', 'Se sobrecarga, amaga hacia atrás y responde a un golpe frontal. Devuelve el fuego que recibe durante la guardia.', '17 cuerpo a cuerpo / 13 fuego', [0, 1, 2, 3], 'heat-counter'],
        ['Embestida de fuego', 'Se lanza en llamas en la dirección anunciada.', 15, [0, 1, 2, 3, 4, 5], 'heat-dash'],
        ['Embestida aérea', 'Salta y se impulsa en llamas en la dirección anunciada.', 15, [0,1,2,3,4,5], 'heat-dash'],
        ['Columna de fuego', 'Prende el suelo a ambos lados.', 14, [0, 1, 8, 0]],
        ['Bola de fuego', 'Disparo horizontal de largo alcance.', 13, [0, 1, 2, 3, 4], 'heat-throw'],
        ['Lluvia de fuego', 'Cinco llamas caen sobre zonas marcadas.', '9 por proyectil', [0, 3, 8, 0]]
    ] }
};

export function storyRobotAnimations(id) {
    const entry = storyRobotGuide[id];
    if (!entry) return null;
    const sequences = [
        ['idle', 'Reposo', id === 'cut' ? [12, 13, 14, 15] : [0]],
        ...(id === 'cut' ? [
            ['run', 'Carrera con tijeras', [0, 1, 2, 3, 4, 5, 6, 7, 8], 'cutRun'],
            ['run-bare', 'Carrera sin tijeras', [0, 1, 2, 3, 4, 5, 6, 7, 8], 'cutRunBare']
        ] : [id === 'guts' ? ['walk', 'Caminar', Array.from({ length: 10 }, (_, i) => i), 'gutsRun'] : ['walk', 'Desplazamiento', [5, 6, 7]]]),
        ...(id === 'cut' ? [
            ['throw', 'Lanzamiento de tijeras', [0, 1, 2, 3, 4, 5, 6, 7], 'cutThrow'],
            ['catch', 'Recoger tijeras', [3, 2, 1, 0], 'cutThrow'],
            ['jump', 'Salto con tijeras', [0, 1, 2], 'cutJump'],
            ['jump-bare', 'Salto sin tijeras', [0, 1, 2], 'cutJumpBare'],
            ['air-throw', 'Disparo aéreo', [0, 1], 'cutAirThrow']
        ] : []),
        ...(id === 'guts' ? [['jump', 'Salto de Guts Man', [0, 1, 2, 3, 4, 5], 'gutsJump'], ['met-shot', 'Proyectil Met', [0, 1], 'metShot']] : []),
        ['hurt', 'Golpe recibido', [0, 1, 2], id + 'Hit'],
        ...(id === 'cut' ? [['intro', 'Entrada · esquina superior', Array.from({ length: 9 }, (_, i) => i), 'page'], ['entry-drop', 'Entrada · descenso', cutIntroDrop]] : []),
        ...(id === 'heat' ? [
            ['intro', 'Entrada', Array.from({ length: 17 }, (_, i) => i), 'heat-intro'],
            ['charge', 'Sobrecarga', [0, 1, 2, 3, 4], 'heat-charge'],
            ['guard', 'Guardia', [0, 1], 'heat-guard'],
            ['guard-hot', 'Guardia en llamas', [0, 1], 'heat-guard-hot'],
            ['knockback', 'Retroceso fuerte', [0], 'heat-knockback']
        ] : []),
        ...entry.moves.map(([name, , , frames, sheet], index) => ['move-' + index, name, frames, sheet])
    ];
    return sequences.map(([key, name, frames, sheet = id]) => ({
        id: key, name, count: frames.length, ms: sheet === 'gutsCarry' ? rockFrameMs : key.startsWith('run') ? 60 : key === 'intro' ? 100 : key === 'idle' && id === 'cut' ? 135 : 110,
        frame(index) {
            const [source,frame]=key==='entry-drop'?frames[index]:[sheet,frames[index]];
            if (source.startsWith('heat-')) return heatSpriteFrame(source, frame, 0, 0, 1, true);
            const img = art[source];
            if (!img.complete || !img.naturalWidth) return null;
            const large = source.startsWith('guts') && !['guts', 'gutsHit'].includes(source);
            const w = large ? 160 : 120;
            const h = large ? 170 : 100;
            return { img, sx: frame * w, sy: 0, sw: w, sh: h, dx: -w / 2, dy: -h, dw: w, dh: h, flipX: false };
        }
    }));
}
