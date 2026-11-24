import { combatNow } from './combat-clock.js';
import { captureTournamentTool } from './tournament-damage.js';
import { robotFrame, drawRobotFrame, bassSpriteScale, BASS_IDLE_FRAME_MS } from './robot-sprites.js';
import { BASS_MOVES, beginRobotMove, updateRobotMove, hitRobotMove } from './robot-combat.js';
import { configureCombatant, dealDamage } from './combat-system.js';
// ========================================
// CLASE BASS + TREBLE
// ========================================

import { Fighter } from './fighter.js';
import { ctx, game } from './state.js';
import { playSound } from './utils.js';
import {
    bassSprite3,
    busterAudio, sonicJumpAudio,
    dashBassAudio, busterBassAudio, bassBrincoIdaAudio, bassPisoAudio
} from './assets.js';
import { TREBLE_SCALE, drawTrebleAnimFrame } from './animations.js';
import { BassBullet } from './bullet.js';
import { worldWidth } from './config.js';
import { HIGHWAY_WALLS } from './wall-system.js';
import { opaqueInRect } from './pixel-collision.js';

// ========================================
// BALAS DE TREBLE (malla 3x3, bassSprite3)
// ========================================

export const TREBLE_BULLET_IMPACT_A = { cells: [
    { frameNum: 42, col: 1, row: 1 },
    { frameNum: 36, col: 1, row: 0 }
], sheet: 3 };
export const TREBLE_BULLET_IMPACT_B = { cells: [
    { frameNum: 43, col: 1, row: 1 },
    { frameNum: 37, col: 1, row: 0 }
], sheet: 3 };

const TREBLE_TARGET_HEIGHT = 210;
const TREBLE_TARGET_WIDTH = 280;
const TREBLE_BULLET_SCALE = 2; // El aumento de Treble no agranda también sus disparos.

export function drawTrebleFrame(frameData, anchorX, anchorY, facingLeft) {
    const img = bassSprite3;
    if (!img.complete || img.naturalWidth === 0) return;

    const cols = 8;
    const rows = 6;
    const cellW = img.naturalWidth / cols;
    const cellH = img.naturalHeight / rows;

    frameData.cells.forEach((cell) => {
        const offsetX = (cell.col - 1) * TREBLE_TARGET_WIDTH;
        const offsetY = (cell.row - 1) * TREBLE_TARGET_HEIGHT;

        const sx = Math.floor((cell.frameNum % cols) * cellW);
        const sy = Math.floor(Math.floor(cell.frameNum / cols) * cellH);
        const sw = Math.ceil(cellW);
        const sh = Math.ceil(cellH);

        const drawX = anchorX + offsetX;
        const drawY = anchorY + offsetY - TREBLE_TARGET_HEIGHT;

        if (facingLeft) {
            ctx.save();
            ctx.translate(anchorX + offsetX + TREBLE_TARGET_WIDTH, 0);
            ctx.scale(-1, 1);
            ctx.drawImage(img, sx, sy, sw, sh, 0, drawY, TREBLE_TARGET_WIDTH, TREBLE_TARGET_HEIGHT);
            ctx.restore();
        } else {
            ctx.drawImage(img, sx, sy, sw, sh, drawX, drawY, TREBLE_TARGET_WIDTH, TREBLE_TARGET_HEIGHT);
        }
    });
}

// ========================================
// CLASE TREBLE
// ========================================

export class Treble {
    constructor(ownerX, ownerY, owner, directionToOpponent) {
        this.owner = owner;
        this.direction = directionToOpponent;

        this.x = ownerX;
        this.feetY = ownerY;
        // Hurtbox del cuerpo a escala del idle dibujado; x sigue siendo pivote central.
        this.width = 97 * TREBLE_SCALE;
        this.height = 48 * TREBLE_SCALE;

        this.isActive = true;
        this.state = "intro";
        this.stateTimer = 0;

        this.followSpeed = 12;
        this.lifeTimer = 0;
        this.maxLife = 15 * 60;
        this.contactCooldown = 0;
        this.animTimer = 0;
        this.animFrame = 0;

        this.walkFrame = 0;
        this.walkDir = 1;
        this.walkTimer = 0;
        this.walkFrameDuration = 1000 / 6;

        this.jumpSubTimer = 0;
        this.wasInAir = false;
        this.landingTimer = 0;

        this.shotBurstActive = false;
        this.shotBurstTimer = 0;
        this.shotBurstCount = 0;
        this.maxShotBurstCount = 8;
        this.isCharging = false;
        this.chargeTimer = 0;

        this.bisonPhase = "launch";
        this.bisonTimer = 0;

        this.outroPhase = "idle";
        this.outroIdleTimer = 0;
    }

    startIntro() {
        this.state = "intro";
        this.stateTimer = 0;
    }

    startOutro() {
        this.state = "outro";
        this.stateTimer = 0;
        this.outroPhase = "idle";
        this.outroIdleTimer = 0;
    }

    startRush() {
        if (this.state !== "following") return;
        this.state = "attack_rush";
        this.stateTimer = 0;
        this.animTimer = 0;
        this.animFrame = 0;
    }

    startBison() {
        if (this.state !== "following") return;
        this.state = "attack_bison";
        this.stateTimer = 0;
        this.bisonPhase = "launch";
        this.bisonTimer = 0;
        this.animFrame = 0;
    }

    startShot(charged) {
        if (this.state !== "following") return;
        this.state = "attack_shot";
        this.stateTimer = 0;
        if (charged) {
            this.isCharging = true;
            this.chargeTimer = 0;
            this.shotBurstActive = false;
        } else {
            this.shotBurstActive = true;
            this.shotBurstTimer = 0;
            this.shotBurstCount = 0;
            this.isCharging = false;
        }
    }

    update(opponentX) {
        if (!this.isActive) return;
        if (this.contactCooldown > 0) this.contactCooldown--;

        const dt = 16.67;
        this.stateTimer += dt;

        // ============================
        // INTRO
        // ============================
        if (this.state === "intro") {
            const owner = this.owner;
            const dirToOpp = (opponentX > owner.x) ? 1 : -1;
            this.direction = dirToOpp;
            const bassCenterX = owner.x + owner.width / 2;
            this.x = bassCenterX + 30 * dirToOpp;
            this.feetY = owner.y + owner.height;

            if (this.stateTimer >= 300) {
                this.state = "following";
                this.stateTimer = 0;
                this.lifeTimer = 0;
            }
            return;
        }

        // ============================
        // OUTRO
        // ============================
        if (this.state === "outro") {
            if (this.outroPhase === "idle") {
                this.outroIdleTimer += dt;
                if (this.outroIdleTimer >= 400) {
                    this.outroPhase = "reverse";
                    this.stateTimer = 0;
                }
            } else {
                if (this.stateTimer >= 500) {
                    this.isActive = false;
                }
            }
            return;
        }

        // ============================
        // CONTADOR DE VIDA
        // ============================
        if (this.state === "following") {
            this.lifeTimer++;
            if (this.lifeTimer >= this.maxLife) {
                this.startOutro();
                return;
            }
        }

        // ============================
        // FOLLOWING
        // ============================
        if (this.state === "following") {
            const owner = this.owner;
            const dirToOpp = (opponentX > owner.x) ? 1 : -1;
            this.direction = dirToOpp;

            const bassCenterX = owner.x + owner.width / 2;
            const targetX = bassCenterX + 30 * dirToOpp;
            this.x = targetX;
            // Treble comparte la altura ACTUAL de Bass. owner.feetY es el suelo
            // fijo, así que usarlo hacía que solo cambiara el sprite de salto
            // mientras Treble permanecía físicamente pegado al piso.
            this.feetY = owner.y + owner.height;

            const bassLeft = owner.keys[owner.controls.left];
            const bassRight = owner.keys[owner.controls.right];
            const bassMoving = (bassLeft || bassRight) && owner.isGrounded;

            if (!owner.isGrounded) {
                this.wasInAir = true;
                this.landingTimer = 0;

                const vy = owner.vy;
                if (vy < -8) {
                    this.animFrame = 1;   // frame 2
                } else if (vy < -1) {
                    this.animFrame = 2;   // frame 3
                } else if (vy < 1) {
                    this.animFrame = 4;   // frame 5
                } else {
                    this.animFrame = 6;   // frame 7
                }
            } else {
                if (this.wasInAir) {
                    this.landingTimer += dt;
                    if (this.landingTimer < 100) {
                        this.animFrame = 7;  // frame 8 (aterrizaje)
                    } else {
                        this.wasInAir = false;
                        this.landingTimer = 0;
                    }
                } else if (bassMoving) {
                    const moveDir = bassLeft ? -1 : 1;
                    if (moveDir !== this.walkDir) {
                        this.walkDir = moveDir;
                        this.walkTimer = 0;
                    }
                    this.walkTimer += dt;
                    if (this.walkTimer >= this.walkFrameDuration) {
                        this.walkTimer = 0;
                        this.walkFrame += this.walkDir;
                        if (this.walkFrame >= 6) this.walkFrame = 0;
                        if (this.walkFrame < 0) this.walkFrame = 5;
                    }
                    this.animFrame = this.walkFrame;
                } else {
                    this.animTimer += dt;
                    if (this.animTimer >= 1000) {
                        this.animTimer = 0;
                        this.animFrame = (this.animFrame + 1) % 2;
                    }
                    this.animFrame = this.animFrame % 2;
                }
            }
            return;
        }

        // ============================
        // RUSH
        // ============================
        if (this.state === "attack_rush") {
            this.x += 14 * this.direction;

            this.animTimer += dt;
            if (this.animTimer >= 166) {
                this.animTimer = 0;
                this.animFrame = (this.animFrame + 1) % 6;
            }

            if (this.x < -300 || this.x > worldWidth + 300) {
                this.startOutro();
            }
            return;
        }

        // ============================
        // BISON
        // ============================
        if (this.state === "attack_bison") {
            this.bisonTimer += dt;
            this.x += 12 * this.direction;

            if (this.bisonPhase === "launch") {
                if (this.bisonTimer < 100) {
                    this.animFrame = 0;
                } else {
                    this.animFrame = 1;
                    this.bisonPhase = "air";
                    this.bisonTimer = 0;
                }
            }
            else if (this.bisonPhase === "air") {
                const cycle = Math.floor(this.bisonTimer / 62);
                if (cycle >= 8) {
                    this.bisonPhase = "descend";
                    this.bisonTimer = 0;
                } else {
                    this.animFrame = (cycle % 2 === 0) ? 6 : 5;
                }
            }
            else if (this.bisonPhase === "descend") {
                if (this.bisonTimer < 100) {
                    this.animFrame = 4;
                } else {
                    this.animFrame = 3;
                    this.bisonPhase = "impact";
                    this.bisonTimer = 0;
                }
            }
            else if (this.bisonPhase === "impact") {
                const cycle = Math.floor(this.bisonTimer / 100);
                this.animFrame = (cycle % 2 === 0) ? 3 : 2;
                if (this.bisonTimer >= 2000 || this.x < -300 || this.x > worldWidth + 300) {
                    this.startOutro();
                }
            }
            return;
        }

        // ============================
        // SHOT
        // ============================
        if (this.state === "attack_shot") {
            if (this.shotBurstActive) {
                this.shotBurstTimer += dt;
                if (this.shotBurstTimer >= 83) {
                    this.shotBurstTimer = 0;
                    this.fireBullet(false);
                    this.shotBurstCount++;

                    // La ráfaga normal de Treble es finita: 8 disparos.
                    if (this.shotBurstCount >= this.maxShotBurstCount) {
                        this.shotBurstActive = false;
                        this.startOutro();
                    }
                }
            } else if (this.isCharging) {
                this.chargeTimer += dt;
                if (this.chargeTimer >= 500) {
                    this.isCharging = false;
                    this.fireBullet(true);
                    this.startOutro();
                }
            }
            return;
        }
    }

    fireBullet(charged) {
        const dir = this.direction;

        // Durante el disparo Treble usa su idle: 97x48 a escala x2 = 194x96.
        // La bala conserva la proporción de su celda original (37.5x50) y
        // toma la MISMA altura visual que Treble: 96 px. Así deja de verse
        // gigantesca y nace literalmente superpuesta sobre la parte frontal
        // de Treble, sin alterar la altura de ninguno de los dos.
        const trebleRenderW = 97 * TREBLE_BULLET_SCALE;
        const trebleRenderH = 48 * TREBLE_BULLET_SCALE;
        const bulletH = trebleRenderH;
        const bulletW = bulletH * (37.5 / 50);
        const frontCenterX = this.x + dir * (trebleRenderW * 0.25);
        const spawnX = frontCenterX - bulletW / 2;
        const spawnY = this.feetY - bulletH;

        game.trebleBullets.push({
            x: spawnX,
            y: spawnY,
            owner: this.owner,
            vx: dir * (charged ? 12 : 16),
            vy: charged ? -8 : -4,
            gravity: charged ? 0.4 : 0.2,
            width: bulletW,
            height: bulletH,
            damage: charged ? 15 : 5,
            active: true,
            charged: charged,
            lifetime: charged ? 300 : 180,
            effectTimer: 0,
            effectActive: false,
            capturedTarget: null,
            captureTimer: 0,
            direction: dir
        });
    }

    getCurrentY() {
        return this.getPixelBodyFrame()?.dy ?? this.y;
    }

    getCurrentHeight() {
        return this.getPixelBodyFrame()?.dh ?? this.height;
    }

    draw() {
        if (!this.isActive) return;

        const facingLeft = (this.direction < 0);
        const pivotX = this.x - game.cameraX;
        const pivotY = this.feetY;

        // INTRO
        if (this.state === "intro") {
            const frameIdx = Math.min(4, Math.floor(this.stateTimer / 60));
            drawTrebleAnimFrame(ctx, "intro", frameIdx, pivotX, pivotY, facingLeft);
            return;
        }

        // OUTRO
        if (this.state === "outro") {
            if (this.outroPhase === "idle") {
                drawTrebleAnimFrame(ctx, "idle", 0, pivotX, pivotY, facingLeft);
            } else {
                const step = Math.floor(this.stateTimer / 100);
                const frameIdx = Math.max(0, 4 - step);
                drawTrebleAnimFrame(ctx, "intro", frameIdx, pivotX, pivotY, facingLeft);
            }
            return;
        }

        // FOLLOWING
        if (this.state === "following") {
            const owner = this.owner;
            if (!owner.isGrounded || this.wasInAir) {
                drawTrebleAnimFrame(ctx, "jump", this.animFrame, pivotX, pivotY, facingLeft);
            } else if (owner.keys[owner.controls.left] || owner.keys[owner.controls.right]) {
                drawTrebleAnimFrame(ctx, "caminar", this.animFrame, pivotX, pivotY, facingLeft);
            } else {
                drawTrebleAnimFrame(ctx, "idle", this.animFrame % 2, pivotX, pivotY, facingLeft);
            }
            return;
        }

        // RUSH
        if (this.state === "attack_rush") {
            drawTrebleAnimFrame(ctx, "correr", this.animFrame, pivotX, pivotY, facingLeft);
            return;
        }

        // BISON
        if (this.state === "attack_bison") {
            drawTrebleAnimFrame(ctx, "bison", this.animFrame, pivotX, pivotY, facingLeft);
            return;
        }

        // SHOT
        if (this.state === "attack_shot") {
            drawTrebleAnimFrame(ctx, "idle", 0, pivotX, pivotY, facingLeft);
            return;
        }
    }
}

// ========================================
// CLASE BASS
// ========================================

export class Bass extends Fighter {
    constructor(x, y, controls) {
        super(x, y, '#3333ff', controls, false);
        configureCombatant(this, 'bass', 'BASS');

        this.feetY = y;
        this.width = 126 * this.characterScale;
        this.height = 153 * this.characterScale;
        this.y = this.feetY - this.height;

        this.state = "intro";
        this.stateTimer = 0;
        this.animElapsed = 0;
        this.facingLeft = false;
        this.introDone = false;

        this.walkFrame = 0;
        this.walkDir = 1;
        this.walkTimer = 0;
        this.walkFrameDuration = 1000 / 14;

        this.jumpPhase = 'up';
        this.dashDirection = 1;
        this.dashTimer = 0;

        this.shootType = null;
        this.shootBurst = 0;
        this.shootBurstCount = 8;
        this.burstReadyAt = 0;
        this.shootBulletFired = false;

        this.lastDirectionPress = { left: -Infinity, right: -Infinity };
        this.doubleTapDelay = 300;

        this.activeTreble = null;
        this.trebleCooldown = 0;
    }

    setState(newState) {
        if (this.state === newState) return;
        if (this.state === 'shoot') this.burstReadyAt = combatNow() + 520;
        this.state = newState;
        this.stateTimer = 0;
        this.animElapsed = 0;
        this.shootBulletFired = false;
        // La silueta del frame alfa define el contacto; el cuerpo no crece al saltar.
    }

    checkDoubleTap(direction) { this.tryDash(direction); }

    tryDash(direction) {
        if (this.isBusy()) return;
        const now = combatNow();

        // Bass NO puede convertir una pulsación aérea en dash terrestre.
        // Antes el doble tap seguía activo durante el salto y setState("dash")
        // aplicaba dashSpeed en el aire, haciendo que recorriera media pantalla.
        if (!this.isGrounded || this.isHitstunned() || !['idle', 'walk'].includes(this.state)) {
            this.lastDirectionPress[direction] = -Infinity;
            return;
        }

        const lastPress = this.lastDirectionPress[direction];
        if (now - lastPress <= this.doubleTapDelay) {
            this.dashDirection = (direction === 'right') ? 1 : -1;
            this.dashTimer = 0;
            this.setState("dash");
            playSound(dashBassAudio);
        }
        this.lastDirectionPress[direction] = now;
    }

    tryShoot(verticalDir, horizontalDir) {
        const now = combatNow();
        if (now < this.burstReadyAt || this.robotMove || this.jetUntil > now || this.barrierUntil > now ||
            this.isHitstunned() || this.wasInAirFromKnockback) return false;
        const onGround = (this.state === "idle" || this.state === "walk") && this.isGrounded;
        const inJumpEarly = this.state === "jump" && this.stateTimer < 300;

        if (!onGround && !inJumpEarly) return false;

        // Los tiros aéreos conservan su altura y la gravedad.

        let type = 'shootHor';
        if (verticalDir === 'up' && horizontalDir === 'neutral') {
            type = 'shootArriba';
        } else if (verticalDir === 'up' && horizontalDir === 'forward') {
            type = 'shootDiaArriba';
        }

        this.shootType = type;
        this.shootBurst = 0;
        this.shootBulletFired = false;
        this.vx = 0;
        this.setState("shoot");
        return true;
    }

    update(opponentX, selfInstance) {
        this.previousBodyX = this.x;
        const dt = 16.67;
        this.stateTimer += dt;
        this.animElapsed += dt;

        if (this.trebleCooldown > 0) this.trebleCooldown--;

        this.facingLeft = (this.x > opponentX);

        if (this.isVulnerable) {
            this.vulnerableTimer--;
            if (this.vulnerableTimer <= 0) this.isVulnerable = false;
        }

        // INTRO
        if (this.state === "intro") {
            this.vx = 0;
            this.vy += this.gravity;
            this.y += this.vy;
            if (this.y + this.height >= this.feetY) {
                this.y = this.feetY - this.height;
                this.vy = 0;
                this.isGrounded = true;
            }
            if (this.stateTimer >= 2000) {
                this.introDone = true;
                this.setState("idle");
            }
            return;
        }

        const opponentOnRight = opponentX > this.x;
        const backKey = opponentOnRight ? this.controls.left : this.controls.right;
        const hitstunned = this.isHitstunned();
        if (this.barrierUntil > combatNow()) { this.vx = 0; return; }
        if (this.jetUntil > combatNow()) {
            if (combatNow() - this.jetAt < 66) { this.vx = 0; return; }
            this.vx = this.jetDirection * 15;
            this.vy = this.jetAngle;
            this.x = Math.max(HIGHWAY_WALLS[0].x, Math.min(HIGHWAY_WALLS[1].x - this.width, this.x + this.vx));
            this.y = Math.max(35, this.y + this.vy);
            return;
        }
        if (this.jetUntil) {
            this.jetUntil = 0;
            this.vx *= .35;
            this.vy = Math.max(this.vy, -2);
        }
        if (!this.isGrounded && !this.robotMove && this.state === 'idle') this.setState('jump');
        const canGuard = !this.robotMove && !hitstunned && (this.state === 'idle' || this.state === 'walk') && this.isGrounded && !this.isVulnerable && combatNow() >= (this.guardBrokenUntil || 0);
        this.isGuarding = canGuard && Boolean(this.keys[backKey]);
        this.guardType = this.isGuarding ? (this.keys[this.controls.crouch] ? 'low' : 'high') : null;


        // IDLE
        if (this.wasInAirFromKnockback) {
            this.setState("jump");
            this.vy += this.gravity;
        } else if (this.robotMove) {
            updateRobotMove(this);
            if (!this.isGrounded) this.vy += this.gravity;
        } else if (hitstunned && (this.state === "shoot" || this.state === "dash")) {
            this.setState("idle");
        } else if (this.state === "idle") {
            const leftPressed = !hitstunned && this.keys[this.controls.left];
            const rightPressed = !hitstunned && this.keys[this.controls.right];

            if (leftPressed || rightPressed) {
                const moveDir = leftPressed ? -1 : 1;
                this.walkDir = moveDir;
                this.vx = moveDir * this.speed;
                this.setState("walk");
            } else {
                if (hitstunned) {
                    this.vx *= 0.84;
                    if (Math.abs(this.vx) < 0.2) this.vx = 0;
                } else this.vx = 0;
            }

            if (!hitstunned && !this.isGuarding && this.keys[this.controls.jump] && this.isGrounded && !this.keys[this.controls.attack]) {
                this.vy = this.jumpForce;
                this.jumpPhase = 'up';
                this.setState("jump");
                this.isGrounded = false;
                playSound(bassBrincoIdaAudio);
            }
        }
        // WALK
        else if (this.state === "walk") {
            const leftPressed = !hitstunned && this.keys[this.controls.left];
            const rightPressed = !hitstunned && this.keys[this.controls.right];

            if (!leftPressed && !rightPressed) {
                if (hitstunned) {
                    this.vx *= 0.84;
                    if (Math.abs(this.vx) < 0.2) this.vx = 0;
                } else {
                    this.setState(this.isGrounded ? "idle" : "jump");
                    this.vx = 0;
                }
            } else {
                const moveDir = leftPressed ? -1 : 1;
                this.vx = moveDir * this.speed;

                if (moveDir !== this.walkDir) {
                    this.walkDir = moveDir;
                    this.walkTimer = 0;
                }

                this.walkTimer += dt;
                if (this.walkTimer >= this.walkFrameDuration) {
                    this.walkTimer = 0;
                    this.walkFrame += this.walkDir;
                    if (this.walkFrame >= 14) this.walkFrame = 0;
                    if (this.walkFrame < 0) this.walkFrame = 13;
                }
            }

            if (!hitstunned && !this.isGuarding && this.keys[this.controls.jump] && this.isGrounded && !this.keys[this.controls.attack]) {
                this.vy = this.jumpForce;
                this.jumpPhase = 'up';
                this.setState("jump");
                this.isGrounded = false;
                playSound(bassBrincoIdaAudio);
            }
        }
        else if (this.state === "jump") {
            this.jumpPhase = (this.vy < 0) ? 'up' : 'down';

            // Control aéreo normal: moverse a los lados usa speed, nunca dashSpeed.
            // Soltar ambas direcciones conserva la inercia horizontal con la que saltó.
            const leftPressed = this.keys[this.controls.left];
            const rightPressed = this.keys[this.controls.right];
            if (!hitstunned && leftPressed !== rightPressed) {
                this.vx = (leftPressed ? -1 : 1) * this.speed;
            }

            this.vy += this.gravity;
        }
        else if (this.state === "dash") {
            this.vx = this.dashDirection * this.dashSpeed;
            if (this.stateTimer >= 500) {
                this.setState("idle");
                this.vx = 0;
            }
        }
        else if (this.state === "shoot") {
            if (!this.isGrounded) this.vy += this.gravity;
            this.vx = 0;
            const frameDuration = 100 / 3;
            const currentFrame = Math.floor(this.stateTimer / frameDuration);

            if (currentFrame >= 2 && !this.shootBulletFired) {
                this.shootBulletFired = true;
                this.fireBullet(selfInstance);
                playSound(busterBassAudio);
            }

            if (this.stateTimer >= 100) {
                this.shootBurst++;
                if (this.shootBurst >= this.shootBurstCount) {
                    this.setState(this.isGrounded ? "idle" : "jump");
                    this.vx = 0;
                } else {
                    this.stateTimer = 0;
                    this.animElapsed = 0;
                    this.shootBulletFired = false;
                }
            }
        }
        else if (this.state === "hurt") { this.vx = 0; }
        else if (this.state === "hurtHard") { this.vx = 0; }

        this.x += this.vx;
        this.y += this.vy;

        if (this.y + this.height >= this.feetY) {
            if (this.wasInAirFromKnockback && !this.isGrounded) {
                playSound(bassPisoAudio);
                this.wasInAirFromKnockback = false;
            }
            this.y = this.feetY - this.height;
            this.vy = 0;
            this.isGrounded = true;
            if (this.state === "jump") {
                playSound(bassPisoAudio);
                this.setState("idle");
                this.vx = 0;
            }
        } else {
            this.isGrounded = false;
        }

        if (this.wasInAirFromKnockback) {
            this.knockbackAirTimer++;
            if (this.knockbackAirTimer > 30) this.vx *= 0.94;
        }

        const [leftWall, rightWall] = HIGHWAY_WALLS;
        this.x = Math.max(leftWall.x, Math.min(rightWall.x - this.width, this.x));

        if (this.activeTreble && !this.activeTreble.isActive) {
            this.activeTreble = null;
            this.trebleCooldown = 3 * 60;
        }
    }

    fireBullet(selfInstance) {
        const direction = this.facingLeft ? -1 : 1;
        const spawnX = this.x + this.width / 2 + direction * this.width * .38;
        const spawnY = this.y + this.height * (this.shootType==='shootHor'?.44:.37);

        let vx = direction * 18;
        let vy = 0;

        if (this.shootType === "shootArriba") { vx = 0; vy = -18; }
        else if (this.shootType === "shootDiaArriba") { vx = direction * 14; vy = -14; }

        const bullet = new BassBullet(spawnX, spawnY, vx, vy, direction, selfInstance, this.shootType);
        bullet.x -= bullet.width / 2;
        bullet.y -= bullet.height / 2;
        game.bassBullets.push(bullet);
        captureTournamentTool(selfInstance,'Bass Buster');
    }

    getPixelBodyFrame() {
        const now = combatNow();
        let key = 'bassIdle', elapsed = now, ms = BASS_IDLE_FRAME_MS, loop = true;
        if (this.jetUntil > now) {
            key = 'bassJet'; ms = 66;
            const jetAge = now - this.jetAt;
            elapsed = jetAge < 132 ? jetAge : 132 + (jetAge - 132) % 264;
            loop = false;
        } else if (this.barrierUntil > now) {
            key = 'bassBarrier'; ms = 105;
        } else if (this.guardImpactUntil > now) {
            key = 'bassGuardImpact'; elapsed = this.guardImpactFrame * 100; ms = 100; loop = false;
        } else if (this.robotMove) {
            ({ key, ms } = this.robotMove.spec);
            elapsed = now - this.robotMove.started;
            loop = false;
        }
        else if (this.state === 'intro') { key = this.stateTimer < 1890 ? 'bassIntro' : 'bassIdle'; elapsed = this.stateTimer; ms = 90; loop = false; }
        else if (this.wasInAirFromKnockback || now < this.robotHurtUntil) {
            key = this.wasInAirFromKnockback && Math.abs(this.vx) >= 9 ? 'bassHardHurt' : 'bassHurt';
            elapsed = Math.max(0, now - (this.robotHurtUntil - 210));
            ms = 65; loop = false;
        }
        else if (this.state === 'shoot') {
            key = this.shootType === 'shootHor' ? (this.isGrounded ? 'bassShot' : 'bassAirShot') : 'bassUpShot';
            ms = 100 / 3; loop = false;
            const firstTwo = this.stateTimer < ms ? 0 : 1;
            if (key === 'bassUpShot') {
                elapsed = (firstTwo + (this.isGrounded ? 0 : 2) + .5) * ms;
            } else if (key === 'bassShot') {
                const finishing = this.shootBurst === this.shootBurstCount - 1 && this.shootBulletFired;
                elapsed = (finishing ? 2.5 : firstTwo + .5) * ms;
            } else {
                elapsed = this.stateTimer;
            }
        } else if (this.state === 'dash') {
            key = 'bassDash'; ms = 100; loop = false;
            const pose = [90, 160, 330, 425].filter(end => this.stateTimer >= end).length;
            elapsed = pose * ms;
        }
        else if (this.state === 'jump') {
            key = 'bassJump'; ms = 53; loop = false;
            elapsed = this.stateTimer;
        }
        else if (this.isGuarding && !this.keys[this.controls.crouch]) {
            key = Math.abs(this.x - (this.previousBodyX ?? this.x)) > .1 ? 'bassRetreat' : 'bassGuard';
            elapsed = this.stateTimer; ms = 72;
        }
        else if (this.keys[this.controls.crouch]) { key = 'bassCrouch'; }
        else if (this.state === 'walk') { key = 'bassRun'; elapsed = this.stateTimer; ms = 58; }
        const feet = this.y + this.height;
        return robotFrame(key, elapsed, ms, this.x + this.width / 2, feet,
            bassSpriteScale(this.height), (key === 'bassJet' ? this.jetDirection : key === 'bassDash' ? this.dashDirection : this.robotMove?.direction) || (this.facingLeft ? -1 : 1), loop);
    }

    pixelBodyIntersectsRect(rect) {
        return opaqueInRect(this.getPixelBodyFrame(), rect, 2);
    }

    draw() {
        drawRobotFrame(ctx, this.getPixelBodyFrame(), game.cameraX);
    }

    startRobotAction(kind) {
        if (this.isBusy() || this.state === 'intro' || this.wasInAirFromKnockback || (!this.isGrounded && kind !== 'punch')) return false;
        if (!this.isGrounded) kind = 'airPunch';
        this.setState(this.isGrounded ? 'idle' : 'jump');
        return beginRobotMove(this, BASS_MOVES[kind], this.facingLeft ? -1 : 1);
    }

    startJet(direction, horizontal) {
        const now = combatNow();
        if (this.isBusy() || this.state === 'intro' || this.wasInAirFromKnockback || now < (this.jetCooldownUntil ?? 0)) return false;
        this.jetAt = now;
        this.jetUntil = now + 520;
        this.jetCooldownUntil = now + 1300;
        this.jetDirection = direction;
        this.jetHasHit = false;
        this.jetAngle = horizontal ? 0 : -7;
        this.y = Math.min(this.y, this.feetY - this.height - 24);
        this.isGrounded = false;
        this.setState('jump');
        return true;
    }

    startBarrier() {
        const now = combatNow();
        if (this.isBusy() || this.state === 'intro' || !this.isGrounded || now < (this.barrierCooldownUntil ?? 0)) return false;
        this.barrierUntil = now + 540;
        this.isGuarding = false;
        this.guardType = null;
        this.barrierCooldownUntil = now + 2100;
        this.setState('idle');
        return true;
    }

    blocksProjectile() { return combatNow() < (this.barrierUntil ?? 0); }

    onBlockedHit() {
        this.guardImpactFrame = ((this.guardImpactFrame ?? -1) + 1) % 2;
        this.guardImpactUntil = combatNow() + 125;
    }

    tryHit(receiver) {
        hitRobotMove(this, receiver);
        const now = combatNow();
        if (this.jetHasHit || !(now >= this.jetAt + 66 && now < this.jetUntil)) return;
        const x = this.x + this.width / 2 + this.jetDirection * 22;
        const hitRect = { x: x - 28, y: this.y + this.height * .34, w: 56, h: this.height * .48 };
        const bounds = receiver.getCurrentBounds(this.x);
        const overlap = hitRect.x < bounds.x + bounds.w && hitRect.x + hitRect.w > bounds.x &&
            hitRect.y < bounds.y + bounds.h && hitRect.y + hitRect.h > bounds.y;
        if (!overlap || receiver.pixelBodyIntersectsRect && !receiver.pixelBodyIntersectsRect(hitRect, this.x)) return;
        this.jetHasHit = true;
        dealDamage(receiver, 6, { attacker: this, attackName: 'Bass Jet', impactX: x, hitRect });
    }

    onDamageTaken({stagger=true}={}) { if(!stagger)return;
        if (this.lastGuardImpact?.blocked) return;
        this.jetUntil = 0;
        this.barrierUntil = 0;
        this.guardImpactUntil = 0;
        this.robotHurtUntil = combatNow() + 210;
        this.robotMove = null;
    }

    summonTreble(opponentX) {
        if (this.state === "intro") return;
        if (this.activeTreble && this.activeTreble.isActive) return;
        if (this.trebleCooldown > 0) return;

        const directionToOpponent = (opponentX > this.x) ? 1 : -1;
        const t = new Treble(this.x, this.feetY, this, directionToOpponent);
        this.activeTreble = t;
        game.trebles.push(t);
    }

    isAttacking() { return this.state === "shoot"; }
    isBusy() { return Boolean(this.robotMove) || this.jetUntil > combatNow() || this.barrierUntil > combatNow() || super.isBusy() || this.state === "shoot" || this.state === "hurt" || this.state === "hurtHard"; }
}
