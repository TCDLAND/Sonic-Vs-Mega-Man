import { configureCombatant } from './combat-system.js';
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
import {
    ANIMATIONS, TREBLE_ANIMATIONS, SCALE, TREBLE_SCALE,
    drawBassFrame, drawTrebleAnimFrame, getAnimationFrame
} from './animations.js';
import { BassBullet } from './bullet.js';
import { worldWidth } from './config.js';
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
        this.width = 100;
        this.height = 50;

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
        const trebleRenderW = 97 * TREBLE_SCALE;
        const trebleRenderH = 48 * TREBLE_SCALE;
        const bulletH = trebleRenderH;
        const bulletW = bulletH * (37.5 / 50);
        const frontCenterX = this.x + dir * (trebleRenderW * 0.25);
        const spawnX = frontCenterX - bulletW / 2;
        const spawnY = this.feetY - bulletH;

        game.trebleBullets.push({
            x: spawnX,
            y: spawnY,
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
        return this.feetY - this.height;
    }

    getCurrentHeight() {
        return this.height;
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
        this.width = 126;
        this.height = 153;
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
        this.shootBurstCount = 12;
        this.shootBulletFired = false;

        this.lastDirectionPress = { left: 0, right: 0 };
        this.doubleTapDelay = 300;

        this.activeTreble = null;
        this.trebleCooldown = 0;
    }

    setState(newState) {
        if (this.state === newState) return;

        const oldHeight = this.height;
        this.state = newState;
        this.stateTimer = 0;
        this.animElapsed = 0;
        this.shootBulletFired = false;

        if (newState === "jump") {
            this.height = 180;
        } else {
            this.height = 153;
        }

        if (oldHeight !== this.height) {
            this.y = this.y + oldHeight - this.height;
        }
    }

    tryDash(direction) {
        const now = performance.now();

        // Bass NO puede convertir una pulsación aérea en dash terrestre.
        // Antes el doble tap seguía activo durante el salto y setState("dash")
        // aplicaba dashSpeed en el aire, haciendo que recorriera media pantalla.
        if (!this.isGrounded || this.state === "jump") {
            this.lastDirectionPress[direction] = 0;
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
        const onGround = (this.state === "idle" || this.state === "walk") && this.isGrounded;
        const inJumpEarly = this.state === "jump" && this.stateTimer < 300;

        if (!onGround && !inJumpEarly) return;

        if (this.state === "jump") {
            this.vy = 0;
            this.y = this.feetY - this.height;
            this.isGrounded = true;
        }

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
    }

    update(opponentX, selfInstance) {
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

        // IDLE
        if (this.state === "idle") {
            const leftPressed = this.keys[this.controls.left];
            const rightPressed = this.keys[this.controls.right];

            if (leftPressed || rightPressed) {
                const moveDir = leftPressed ? -1 : 1;
                this.walkDir = moveDir;
                this.vx = moveDir * this.speed;
                this.setState("walk");
            } else {
                this.vx = 0;
            }

            if (this.keys[this.controls.jump] && this.isGrounded && !this.keys['KeyJ']) {
                this.vy = this.jumpForce;
                this.jumpPhase = 'up';
                this.setState("jump");
                this.isGrounded = false;
                playSound(bassBrincoIdaAudio);
            }
        }
        // WALK
        else if (this.state === "walk") {
            const leftPressed = this.keys[this.controls.left];
            const rightPressed = this.keys[this.controls.right];

            if (!leftPressed && !rightPressed) {
                this.setState("idle");
                this.vx = 0;
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

            if (this.keys[this.controls.jump] && this.isGrounded && !this.keys['KeyJ']) {
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
            if (leftPressed !== rightPressed) {
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
                    this.setState("idle");
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

        // Knockback aéreo: Bass usa un update propio y antes solo aplicaba
        // gravedad durante el estado "jump". Si un golpe lo lanzaba mientras
        // estaba en idle/walk/hurt, conservaba un vy negativo para siempre y
        // salía volando del mapa. Aplicamos gravedad también al knockback.
        if (this.wasInAirFromKnockback && !this.isGrounded && this.state !== "jump") {
            this.vy += this.gravity;
        }

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

        if (this.x < 0) this.x = 0;
        if (this.x + this.width > worldWidth) this.x = worldWidth - this.width;

        if (this.activeTreble && !this.activeTreble.isActive) {
            this.activeTreble = null;
            this.trebleCooldown = 3 * 60;
        }
    }

    fireBullet(selfInstance) {
        const direction = this.facingLeft ? -1 : 1;
        const spawnX = this.x + (direction > 0 ? 40 : -40);
        const spawnY = this.y + 30;

        let vx = direction * 18;
        let vy = 0;

        if (this.shootType === "shootArriba") { vx = 0; vy = -18; }
        else if (this.shootType === "shootDiaArriba") { vx = direction * 14; vy = -14; }

        game.bassBullets.push(new BassBullet(spawnX, spawnY, vx, vy, direction, selfInstance, this.shootType));
    }

    getPixelBodyFrame(opponentX) {
        let animKey="idle", frameIndex=0;
        if (this.state === "intro") { animKey="intro"; frameIndex=getAnimationFrame("intro",this.stateTimer); }
        else if (this.state === "idle") {
            if (this.health <= this.maxHealth*0.30) { animKey="hurt"; frameIndex=getAnimationFrame("hurt",this.stateTimer); }
            else { animKey="idle"; frameIndex=getAnimationFrame("idle",this.stateTimer); }
        }
        else if (this.state === "walk") { animKey="walk"; frameIndex=this.walkFrame; }
        else if (this.state === "jump") { animKey="jump"; frameIndex=getAnimationFrame("jump",this.stateTimer,this.jumpPhase); }
        else if (this.state === "dash") { animKey="dash"; frameIndex=getAnimationFrame("dash",this.stateTimer); }
        else if (this.state === "shoot") { animKey=this.shootType||"shootHor"; frameIndex=Math.min(2,Math.floor(this.stateTimer/(100/3))); }
        else if (this.state === "hurt") { animKey="hurt"; frameIndex=getAnimationFrame("hurt",this.stateTimer); }
        else if (this.state === "hurtHard") { animKey="hurtHard"; frameIndex=getAnimationFrame("hurtHard",this.stateTimer); }
        const anim=ANIMATIONS[animKey];
        if(!anim?.img?.complete || !anim.img.naturalWidth) return null;
        const realFrame=anim.sequence[frameIndex % anim.sequence.length];
        const dw=anim.frameW*SCALE, dh=anim.frameH*SCALE;
        const pivotX=this.x+this.width/2, pivotY=this.y+this.height;
        return {img:anim.img,sx:realFrame*anim.frameW,sy:0,sw:anim.frameW,sh:anim.frameH,
                dx:pivotX-dw/2,dy:pivotY-dh,dw,dh,flipX:this.facingLeft, key:animKey,frame:frameIndex};
    }

    pixelBodyIntersectsRect(rect, opponentX) {
        return opaqueInRect(this.getPixelBodyFrame(opponentX), rect, 2);
    }

    draw(opponentX) {
        const pivotX = this.x + this.width / 2 - game.cameraX;
        const pivotY = this.y + this.height;

        let alpha = 1;
        if (this.isVulnerable && Math.floor(performance.now() / 100) % 2 === 0) alpha = 0.5;

        ctx.save();
        ctx.globalAlpha = alpha;

        let animKey = "idle";
        let frameIndex = 0;

        if (this.state === "intro") {
            animKey = "intro";
            frameIndex = getAnimationFrame("intro", this.stateTimer);
        }
        else if (this.state === "idle") {
            // Idle lastimado: igual que Sonic, aparece al 30% de vida o menos.
            // BassHurt.png contiene los 4 frames del idle herido.
            if (this.health <= this.maxHealth * 0.30) {
                animKey = "hurt";
                frameIndex = getAnimationFrame("hurt", this.stateTimer);
            } else {
                animKey = "idle";
                frameIndex = getAnimationFrame("idle", this.stateTimer);
            }
        }
        else if (this.state === "walk") {
            animKey = "walk";
            frameIndex = this.walkFrame;
        }
        else if (this.state === "jump") {
            animKey = "jump";
            frameIndex = getAnimationFrame("jump", this.stateTimer, this.jumpPhase);
        }
        else if (this.state === "dash") {
            animKey = "dash";
            frameIndex = getAnimationFrame("dash", this.stateTimer);
        }
        else if (this.state === "shoot") {
            animKey = this.shootType || "shootHor";
            frameIndex = Math.min(2, Math.floor(this.stateTimer / (100/3)));
        }
        else if (this.state === "hurt") {
            animKey = "hurt";
            frameIndex = getAnimationFrame("hurt", this.stateTimer);
        }
        else if (this.state === "hurtHard") {
            animKey = "hurtHard";
            frameIndex = getAnimationFrame("hurtHard", this.stateTimer);
        }

        drawBassFrame(ctx, animKey, frameIndex, pivotX, pivotY, this.facingLeft);

        ctx.restore();
        this.drawHealthBar();
    }

    drawHealthBar() {
        const cameraX = game.cameraX;
        ctx.fillStyle = 'red';
        ctx.fillRect(this.x - cameraX, this.y - 20, this.width, 10);
        ctx.fillStyle = 'lime';
        ctx.fillRect(this.x - cameraX, this.y - 20, this.width * (this.health / this.maxHealth), 10);
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
    isBusy() { return this.state === "shoot" || this.state === "hurt" || this.state === "hurtHard"; }
}