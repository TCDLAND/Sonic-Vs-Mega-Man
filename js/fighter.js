// ========================================
// CLASE BASE FIGHTER
// ========================================

import { worldWidth } from './config.js';
import { game } from './state.js';
import { playSound, getCellCoords } from './utils.js';
import { hitAudio, sonicJumpAudio, kunaiAudio, shurikenAudio, sonicSpinDashAudio, kunaiImage, shurikenImages } from './assets.js';
import { Projectile } from './projectile.js';
import { getSpinProfile } from './spin-system.js';
import { MAX_HEALTH, dealDamage } from './combat-system.js';
import { getTouchedWall } from './wall-system.js';

export class Fighter {
    constructor(x, y, color, controls, hasSonicJump = true) {
        this.x = x;
        this.feetY = y;
        this.width = 126;
        this.height = 153;
        this.y = this.feetY - this.height;
        this.color = color;
        this.hasSonicJump = hasSonicJump;

        this.vx = 0;
        this.vy = 0;
        this.speed = 6;
        this.dashSpeed = this.speed * 4;
        this.gravity = 0.6;
        this.jumpForce = -14;
        this.isGrounded = true;

        this.controls = controls;
        this.keys = {};

        this.isCrouching = false;
        this.isSpinning = false;
        this.spinChargeLevel = 0;
        this.isSpinDashActive = false;
        this.spinDirection = 1;
        this.spinAnimFrame = 0;
        this.spinAnimTimer = 0;
        this.spinDashDurationTimer = 0;
        this.spinProfileName = 'espio';
        this.spinProfile = getSpinProfile(this.spinProfileName);
        this.spinLastChargeAt = -Infinity;
        this.spinImpactMultiplier = 1;
        this.spinSpeedMultiplier = 1;
        this.spinMaxImpact = false;
        this.spinChargeAudio = null;
        this.spinChargeAudioStopTimer = null;
        this.spinFinishAudio = null;

        this.isJabActive = false;
        this.jabTimer = 0;
        this.jabHitDone = false;
        this.jabDuration = 20;
        this.jabDamage = 3;

        this.isHeavyActive = false;
        this.heavyFrame = 0;
        this.heavyTimer = 0;
        this.heavyHitDone = false;
        this.heavyCanExtend = false;
        this.heavyExtendWindow = 0;
        this.heavyDamage = [0, 0, 5, 5, 8];

        this.isKickLightActive = false;
        this.kickLightTimer = 0;
        this.kickLightHitDone = false;
        this.kickLightDuration = 20;
        this.kickLightDamage = 4;

        this.isKickHeavyActive = false;
        this.kickHeavyPhase = 0;
        this.kickHeavyTimer = 0;
        this.kickHeavyHitDone = false;
        this.kickHeavyCanExtend = false;
        this.kickHeavyExtendWindow = 0;
        this.kickHeavyBuffered = false;
        this.kickHeavyDamageP1 = 8;
        this.kickHeavyDamageP2 = 12;

        this.heavyCooldown = 0;

        this.isTongueAttacking = false;
        this.tongueType = "";
        this.tonguePhase = "idle";
        this.tongueTimer = 0;
        this.tongueHitDone = false;
        this.tongueDamage = 15;
        this.tonguePoseDuration = 5;
        this.tongueExtendDuration = 40;
        this.tongueRetractDuration = 15;
        this.lastTongueRects = [];
        this.tongueDirection = 1;

        this.isGuarding = false;
        this.guardType = null;
        this.isVulnerable = false;
        this.vulnerableTimer = 0;
        this.vulnerableDuration = 30;

        this.lastBackReleaseTime = 0;
        this.shurikenWindup = 0;

        this.isThrowingKunai = false;
        this.kunaiTimer = 0;
        this.kunaiDuration = 25;

        this.isThrowingShuriken = false;
        this.shurikenTimer = 0;
        this.shurikenDuration = 30;

        this.bulletsReceivedInBurst = 0;
        this.lastBulletHitTime = 0;

        this.maxHealth = MAX_HEALTH;
        this.health = MAX_HEALTH;
        this.defenseMultiplier = 1;
        this.characterId = 'fighter';
        this.wallSliding = false;

        this.isSprite = false;
        this.spriteImg = null;
        this.spriteImg2 = null;
        this.animFrame = 0;
        this.frameTimer = 0;

        this.idleFrames = [1, 2, 3, 4, 5, 6, 7, 8];
        this.guardFrames = [18, 19];
        this.jumpUpFrame = 12;
        this.jumpDownFrame = 13;
        this.walkFrames = [25, 26, 27, 28, 29, 30, 31];
        this.dashFrames = [31, 32, 33, 34];

        this.idleAnimationSpeed = 0.045;
        this.guardAnimationSpeed = 0.055;
        this.walkAnimationSpeed = 0.10;
        this.dashAnimationSpeed = 0.12;

        this.isDashing = false;
        this.dashFrame = 0;
        this.dashTimer = 0;
        this.dashDirection = 0;

        this.lastDirectionState = { left: false, right: false };
        this.lastDirectionPress = { left: 0, right: 0 };
        this.doubleTapDelay = 300;

        this.wasInAirFromKnockback = false;
        this.knockbackAirTimer = 0;

        this.isIntroActive = false;
        this.introFrame = 0;
        this.introTimer = 0;
        this.introDone = false;

        this.bassSprite1BlockedUntil = 0;
        this.walkReverse = false;

        // Orientacion persistente: durante un ataque no se voltea automaticamente
        // aunque el rival cruce al otro lado (TP, dash, etc.).
        this.facingDirection = 1;
        this.facingLocked = false;
        this.facingUnlockAt = 0;
        this.guardFlashUntil = 0;
    }

    isMovingToward(opponentX) {
        if (this.x < opponentX) return this.vx > 0;
        if (this.x > opponentX) return this.vx < 0;
        return false;
    }

    isMovingAway(opponentX) {
        if (this.x < opponentX) return this.vx < 0;
        if (this.x > opponentX) return this.vx > 0;
        return false;
    }

    checkDoubleTap(direction, opponentX) {
        let isToward = (direction === "right") ? (this.x < opponentX) : (this.x > opponentX);
        if (!isToward) return;
        const now = performance.now();
        if (now - this.lastDirectionPress[direction] <= this.doubleTapDelay) {
            this.isDashing = true;
            this.dashFrame = 0;
            this.dashTimer = 0;
            this.dashDirection = (direction === "right") ? 1 : -1;
            this.vx = this.dashDirection * this.dashSpeed;
        }
        this.lastDirectionPress[direction] = now;
    }

    getCellCoords(frameNumber, sheetW, sheetH, cols, rows) {
        return getCellCoords(frameNumber, sheetW, sheetH, cols, rows);
    }

    startJab() {
        if (this.isBusy() || !this.isGrounded || this.isIntroActive) return;
        this.isJabActive = true;
        this.jabTimer = 0;
        this.jabHitDone = false;
    }

    startHeavy() {
        if (this.heavyCooldown > 0 || this.isIntroActive) return;
        if (!this.isGrounded) return;

        if (this.isHeavyActive) {
            if (this.heavyCanExtend && this.heavyExtendWindow > 0) {
                if (this.heavyFrame === 2) this.heavyFrame = 3;
                else if (this.heavyFrame === 3) this.heavyFrame = 4;
                this.heavyTimer = 0;
                this.heavyHitDone = false;
                this.heavyCanExtend = false;
                this.heavyExtendWindow = 0;
            }
            return;
        }

        if (this.isBusy()) return;
        this.isHeavyActive = true;
        this.heavyFrame = 1;
        this.heavyTimer = 0;
        this.heavyHitDone = false;
        this.heavyCanExtend = false;
    }

    startKickLight() {
        if (this.isBusy() || !this.isGrounded || this.isIntroActive) return;
        this.isKickLightActive = true;
        this.kickLightTimer = 0;
        this.kickLightHitDone = false;
    }

    startKickHeavy() {
        if (!this.isGrounded || this.isIntroActive) return;

        if (this.isKickHeavyActive) {
            if (this.kickHeavyPhase === 1) this.kickHeavyBuffered = true;
            return;
        }

        if (this.isBusy()) return;
        this.isKickHeavyActive = true;
        this.kickHeavyPhase = 1;
        this.kickHeavyTimer = 0;
        this.kickHeavyHitDone = false;
        this.kickHeavyCanExtend = false;
        this.kickHeavyExtendWindow = 0;
        this.kickHeavyBuffered = false;
    }

    startTongueAttack(type, opponentX) {
        if (this.isBusy() || !this.isGrounded || this.isIntroActive) return;
        this.isTongueAttacking = true;
        this.tongueType = type;
        this.tonguePhase = "pose";
        this.tongueTimer = 0;
        this.tongueHitDone = false;
        this.tongueDirection = (opponentX > this.x) ? 1 : -1;
    }

    isBusy() {
        return (
            this.isJabActive ||
            this.isHeavyActive ||
            this.isKickLightActive ||
            this.isKickHeavyActive ||
            this.isTongueAttacking ||
            this.isThrowingKunai ||
            this.isThrowingShuriken ||
            this.isSpinDashActive ||
            this.isSpinning ||
            this.isDashing
        );
    }

    isAttacking() {
        return (
            this.isJabActive ||
            this.isHeavyActive ||
            this.isKickLightActive ||
            this.isKickHeavyActive ||
            this.isTongueAttacking
        );
    }

    applyDamage(receiver, damage, guardBreaks, knockback = null) {
        if (receiver.isGuarding && receiver.guardType) {
            const blocked = !guardBreaks.includes(receiver.guardType);
            if (blocked) {
                dealDamage(receiver, damage, { attacker: this, attackName: 'Ataque bloqueado', multiplier: 0.15 });
                receiver.guardFlashUntil = performance.now() + 180;
                return false;
            }
        }

        dealDamage(receiver, damage, { attacker: this, attackName: 'Ataque físico' });

        if (knockback) {
            receiver.vx = knockback.vx || 0;
            receiver.vy = knockback.vy || 0;
            receiver.isGrounded = false;
            receiver.wasInAirFromKnockback = true;
            receiver.knockbackAirTimer = 0;
        }

        receiver.isVulnerable = true;
        receiver.vulnerableTimer = receiver.vulnerableDuration;

        playSound(hitAudio);
        return true;
    }

    updateFacing(opponentX) {
        const now = performance.now();
        const lockNow = this.isAttacking() || this.isThrowingKunai || this.isThrowingShuriken || this.rocketActive;
        if (lockNow) {
            this.facingLocked = true;
            // Pequena ventana despues del ataque: un TP al otro lado no hace que
            // el personaje gire instantaneamente al terminar la animacion.
            this.facingUnlockAt = now + 140;
            return;
        }
        if (this.facingLocked && now < this.facingUnlockAt) return;
        this.facingLocked = false;
        this.facingDirection = opponentX >= (this.x + this.width / 2) ? 1 : -1;
    }

    getVisualOpponentX(opponentX) {
        if (!this.facingLocked) return opponentX;
        return this.x + (this.facingDirection > 0 ? 10000 : -10000);
    }

    update(opponentX, selfInstance) {
        this.updateFacing(opponentX);
        if (this.isIntroActive) {
            this.vx = 0;
            this.introTimer++;
            const frames = this.getIntroFrames();
            const frameData = frames[this.introFrame];

            if (frameData && this.introTimer >= frameData.duration) {
                this.introTimer = 0;
                this.introFrame++;
                if (this.introFrame >= frames.length) {
                    this.isIntroActive = false;
                    this.introDone = true;
                    this.introFrame = 0;
                    this.bassSprite1BlockedUntil = performance.now() + 3000;
                }
            }

            this.vy += this.gravity;
            this.y += this.vy;
            if (this.y + this.height >= this.feetY) {
                this.y = this.feetY - this.height;
                this.vy = 0;
                this.isGrounded = true;
            }
            return;
        }

        if (this.heavyCooldown > 0) this.heavyCooldown--;
        if (this.shurikenWindup > 0) this.shurikenWindup--;

        if (this.bulletsReceivedInBurst > 0 && performance.now() - this.lastBulletHitTime > 1000) {
            this.bulletsReceivedInBurst = 0;
        }

        if (this.isVulnerable) {
            this.vulnerableTimer--;
            if (this.vulnerableTimer <= 0) this.isVulnerable = false;
        }

        const opponentOnRight = opponentX > this.x;
        const backKey = opponentOnRight ? this.controls.left : this.controls.right;
        const backPressed = this.keys[backKey];

        if (!this.isAttacking() && !this.isSpinDashActive && !this.isSpinning && this.isGrounded && !this.isVulnerable && !this.wasInAirFromKnockback) {
            if (backPressed) {
                this.isGuarding = true;
                this.guardType = this.keys[this.controls.crouch] ? "low" : "high";
            } else {
                this.isGuarding = false;
                this.guardType = null;
            }
        } else {
            this.isGuarding = false;
            this.guardType = null;
        }

        this.isCrouching = this.keys[this.controls.crouch] && this.isGrounded && !this.isSpinDashActive;

        if (!this.keys[this.controls.crouch] && this.isSpinning && !this.isSpinDashActive) {
            this.isSpinning = false;
            this.spinChargeLevel = 0;
        }

        if (this.isSpinning || this.isSpinDashActive) {
            this.spinAnimTimer += 0.4 + (this.spinChargeLevel * 0.2);
            if (this.spinAnimTimer >= 1) {
                this.spinAnimTimer = 0;
                this.spinAnimFrame++;
            }
        }

        if (this.isJabActive) {
            this.vx = 0;
            this.jabTimer++;
            if (this.jabTimer >= this.jabDuration) {
                this.isJabActive = false;
                this.jabTimer = 0;
                this.jabHitDone = false;
            }
        }

        if (this.isHeavyActive) {
            this.vx = 0;
            this.heavyTimer++;
            if (this.heavyExtendWindow > 0) this.heavyExtendWindow--;

            const durations = [0, 8, 8, 8, 14];
            const dur = durations[this.heavyFrame] || 8;

            if (this.heavyTimer >= dur) {
                this.heavyTimer = 0;
                this.heavyHitDone = false;

                if (this.heavyFrame === 1) this.heavyFrame = 2;
                else if (this.heavyFrame === 2) {
                    if (this.heavyCanExtend) {
                        this.heavyExtendWindow = 20;
                        this.heavyTimer = 0;
                    } else {
                        this.isHeavyActive = false;
                        this.heavyFrame = 0;
                    }
                }
                else if (this.heavyFrame === 3) {
                    if (this.heavyCanExtend) this.heavyExtendWindow = 20;
                    else { this.isHeavyActive = false; this.heavyFrame = 0; }
                }
                else if (this.heavyFrame === 4) {
                    this.isHeavyActive = false;
                    this.heavyFrame = 0;
                    this.heavyCooldown = 30;
                }
            }
        }

        if (this.isKickLightActive) {
            this.vx = 0;
            this.kickLightTimer++;
            if (this.kickLightTimer >= this.kickLightDuration) {
                this.isKickLightActive = false;
                this.kickLightTimer = 0;
                this.kickLightHitDone = false;
            }
        }

        if (this.isKickHeavyActive) {
            this.vx = 0;
            this.kickHeavyTimer++;

            if (this.kickHeavyPhase === 1) {
                if (this.kickHeavyTimer >= 20 && this.kickHeavyExtendWindow === 0) {
                    if (this.kickHeavyCanExtend) {
                        this.kickHeavyExtendWindow = 60;
                        this.kickHeavyTimer = 0;
                    } else {
                        this.isKickHeavyActive = false;
                        this.kickHeavyPhase = 0;
                        this.kickHeavyTimer = 0;
                        this.kickHeavyBuffered = false;
                    }
                }
            }

            if (this.kickHeavyExtendWindow > 0) {
                this.kickHeavyExtendWindow--;
                if (this.kickHeavyBuffered) {
                    this.kickHeavyPhase = 2;
                    this.kickHeavyTimer = 0;
                    this.kickHeavyHitDone = false;
                    this.kickHeavyCanExtend = false;
                    this.kickHeavyBuffered = false;
                    this.kickHeavyExtendWindow = 0;
                } else if (this.kickHeavyExtendWindow === 0) {
                    this.isKickHeavyActive = false;
                    this.kickHeavyPhase = 0;
                    this.kickHeavyTimer = 0;
                    this.kickHeavyBuffered = false;
                }
            }

            if (this.kickHeavyPhase === 2) {
                if (this.kickHeavyTimer >= 20) {
                    this.kickHeavyTimer = 0;
                    this.kickHeavyPhase = 3;
                }
            }

            if (this.kickHeavyPhase === 3) {
                if (this.kickHeavyTimer >= 10) {
                    this.isKickHeavyActive = false;
                    this.kickHeavyPhase = 0;
                    this.kickHeavyTimer = 0;
                }
            }
        }

        if (this.isTongueAttacking) {
            this.vx = 0;
            this.tongueTimer++;
            if (this.tonguePhase === "pose") {
                if (this.tongueTimer >= this.tonguePoseDuration) {
                    this.tongueTimer = 0;
                    this.tonguePhase = "extend";
                }
            } else if (this.tonguePhase === "extend") {
                if (this.tongueTimer >= this.tongueExtendDuration) {
                    this.tongueTimer = 0;
                    this.tonguePhase = "retract";
                }
            } else if (this.tonguePhase === "retract") {
                if (this.tongueTimer >= this.tongueRetractDuration) {
                    this.isTongueAttacking = false;
                    this.tonguePhase = "idle";
                    this.tongueTimer = 0;
                    this.tongueHitDone = false;
                    this.lastTongueRects = [];
                }
            }
        }

        if (this.isThrowingKunai) {
            this.vx = 0;
            this.kunaiTimer++;
            if (this.kunaiTimer === 8) {
                const direction = (opponentX > this.x) ? 1 : -1;
                game.projectiles.push(new Projectile(
                    this.x + (direction > 0 ? this.width : -50),
                    this.y, direction, kunaiImage, 150, 150, 14, 10,
                    false, 'kunai', selfInstance
                ));
                playSound(kunaiAudio);
            }
            if (this.kunaiTimer >= this.kunaiDuration) {
                this.isThrowingKunai = false;
                this.kunaiTimer = 0;
            }
        }

        if (this.isThrowingShuriken) {
            this.vx = 0;
            this.shurikenTimer++;
            if (this.shurikenTimer === 8) {
                const direction = (opponentX > this.x) ? 1 : -1;
                game.projectiles.push(new Projectile(
                    this.x + (direction > 0 ? this.width : -50),
                    this.y - 70, direction, shurikenImages, 210, 210,
                    10, 20, true, 'shuriken', selfInstance
                ));
                playSound(shurikenAudio);
            }
            if (this.shurikenTimer >= this.shurikenDuration) {
                this.isThrowingShuriken = false;
                this.shurikenTimer = 0;
            }
        }

        if (this.isSpinDashActive) {
            this.vx = this.spinDirection * this.getSpinStat('speed') * (this.spinSpeedMultiplier || 1);
            if (this.spinDashDurationTimer > 0) {
                this.spinDashDurationTimer--;
                if (this.spinDashDurationTimer <= 0) {
                    this.finishSpinDash(true);
                }
            }
        }
        else if (this.isSpinning) {
            this.vx = 0;
        }
        else if (!this.isAttacking() && !this.isDashing && !this.isCrouching && !this.wasInAirFromKnockback && !this.isVulnerable) {
            const leftPressed = this.keys[this.controls.left];
            const rightPressed = this.keys[this.controls.right];

            if (leftPressed || rightPressed) {
                const moveDir = leftPressed ? -1 : 1;
                const oppIsRight = opponentX > this.x;
                const isMovingAway = (moveDir === -1 && oppIsRight) || (moveDir === 1 && !oppIsRight);

                this.walkReverse = isMovingAway;
                this.vx = moveDir * this.speed;
            } else {
                this.vx = 0;
                this.walkReverse = false;
            }
        }
        else if (this.wasInAirFromKnockback) {}
        else {
            this.vx = 0;
        }

        if (this.isDashing) {
            this.vx = this.dashDirection * this.dashSpeed;
            this.dashTimer += this.dashAnimationSpeed;
            if (this.dashTimer >= 1) {
                this.dashTimer = 0;
                this.dashFrame++;
                if (this.dashFrame >= this.dashFrames.length) {
                    this.dashFrame = 0;
                    this.isDashing = false;
                    this.vx = 0;
                }
            }
        }

        if (!this.isBusy() && !this.isCrouching && !this.wasInAirFromKnockback && !this.isVulnerable && !this.isGuarding) {
            if (this.isMovingAway(opponentX)) this.frameTimer += this.guardAnimationSpeed;
            else if (this.isMovingToward(opponentX) && this.vx !== 0) this.frameTimer += this.walkAnimationSpeed;
            else this.frameTimer += this.idleAnimationSpeed;
            if (this.frameTimer >= 1) {
                this.animFrame++;
                this.frameTimer = 0;
            }
        }

        this.x += this.vx;

        if (this.airMobilityLocked && this.isGrounded) this.airMobilityLocked = false;
        const touchedWall = this.airMobilityLocked ? null : getTouchedWall(this);
        this.wallSliding = Boolean(touchedWall);
        if (this.wallSliding && this.vy > 2.5) this.vy = 2.5;

        // Los personajes con Spin pueden saltar mientras YA estan rodando.
        // Cargar Spin (isSpinning) sigue bloqueando el salto; Spin activo no.
        const canSpinJump = this.supportsSpin && this.isSpinDashActive;
        if (this.keys[this.controls.jump] && this.isGrounded && !this.isSpinning && (!this.isAttacking() || canSpinJump) && !this.wasInAirFromKnockback && !this.isVulnerable && this.shurikenWindup <= 0) {
            this.vy = this.jumpForce;
            this.isGrounded = false;
            this.lastBackReleaseTime = 0;
            if (this.hasSonicJump) playSound(sonicJumpAudio);
        }

        this.vy += this.gravity;
        this.y += this.vy;

        if (this.y + this.height >= this.feetY) {
            if (this.wasInAirFromKnockback && !this.isGrounded) {
                if (this.hasSonicJump) playSound(sonicJumpAudio);
                this.wasInAirFromKnockback = false;
            }
            this.y = this.feetY - this.height;
            this.vy = 0;
            this.isGrounded = true;
        } else {
            this.isGrounded = false;
        }

        if (this.wasInAirFromKnockback) {
            this.knockbackAirTimer++;
            if (this.knockbackAirTimer > 30) this.vx *= 0.94;
        }

        // Highway: los pilares laterales son solidos. Zona jugable x=226..2368.
        const stageLeftWall = 226;
        const stageRightWall = 2368;
        if (this.x < stageLeftWall) this.x = stageLeftWall;
        if (this.x + this.width > stageRightWall) this.x = stageRightWall - this.width;
    }

    setSpinProfile(name) {
        this.spinProfileName = name;
        this.spinProfile = getSpinProfile(name);
    }

    getSpinStat(stat) {
        const profile = this.spinProfile || getSpinProfile(this.spinProfileName);
        const values = profile[stat];
        if (!Array.isArray(values)) return 0;
        return values[Math.max(0, Math.min(3, this.spinChargeLevel))] || 0;
    }

    playSpinChargeSound() {
        // Una sola instancia: cada carga valida reinicia el audio; nunca se sobrepone.
        if (this.spinChargeAudioStopTimer) clearTimeout(this.spinChargeAudioStopTimer);
        if (this.spinChargeAudio) {
            this.spinChargeAudio.pause();
            this.spinChargeAudio = null;
        }
        const audio = sonicSpinDashAudio.cloneNode(true);
        audio.currentTime = 0.6;
        this.spinChargeAudio = audio;
        audio.play().catch(() => {});
        // La segunda mitad (1.5s+) se reserva para impacto/final del Spin.
        this.spinChargeAudioStopTimer = setTimeout(() => {
            if (this.spinChargeAudio === audio) {
                audio.pause();
                this.spinChargeAudio = null;
            }
        }, 1050);
    }

    stopSpinChargeSound() {
        if (this.spinChargeAudioStopTimer) {
            clearTimeout(this.spinChargeAudioStopTimer);
            this.spinChargeAudioStopTimer = null;
        }
        if (this.spinChargeAudio) {
            this.spinChargeAudio.pause();
            this.spinChargeAudio = null;
        }
    }

    playSpinFinishSound() {
        if (this.spinFinishAudio) this.spinFinishAudio.pause();
        const audio = sonicSpinDashAudio.cloneNode(true);
        this.spinFinishAudio = audio;
        const start = () => {
            try { audio.currentTime = Math.min(1.5, Math.max(0, audio.duration - 0.05)); } catch (_) {}
            audio.play().catch(() => {});
        };
        if (audio.readyState >= 1) start();
        else audio.addEventListener('loadedmetadata', start, { once: true });
    }

    chargeSpinDash(opponentX, keyCode) {
        if (keyCode !== this.controls.spinKey) return;
        if (!this.isCrouching || this.isSpinDashActive || this.isVulnerable || this.isIntroActive) return;
        if (this.spinChargeLevel >= 3) return;

        const now = performance.now();
        const interval = (this.spinProfile || getSpinProfile(this.spinProfileName)).chargeIntervalMs;
        if (this.spinChargeLevel > 0 && now - this.spinLastChargeAt < interval) return;

        this.isSpinning = true;
        this.spinChargeLevel++;
        this.spinLastChargeAt = now;
        this.spinDirection = (this.x < opponentX) ? 1 : -1;
        this.playSpinChargeSound();
    }

    releaseSpinDash() {
        if (!this.isSpinning || this.spinChargeLevel <= 0) return;
        this.stopSpinChargeSound();
        this.isSpinning = false;
        this.isSpinDashActive = true;
        this.spinDashDurationTimer = 360; // hasta 6 segundos a 60 FPS
        this.spinImpactMultiplier = 1;
        this.spinSpeedMultiplier = 1;
        this.spinMaxImpact = this.spinProfileName === 'knuckles' && this.spinChargeLevel === 3;
        if (this.characterId === 'sonic') { this.sonicSpinHits = 0; this.sonicSpinLastHit = 0; this.sonicAnimStarted = performance.now(); }
    }

    finishSpinDash(playFinish = true) {
        const wasActive = this.isSpinDashActive;
        this.isSpinDashActive = false;
        this.isSpinning = false;
        this.spinDashDurationTimer = 0;
        this.vx = 0;
        if (playFinish && wasActive) this.playSpinFinishSound();
        this.spinChargeLevel = 0;
        this.spinImpactMultiplier = 1;
        this.spinSpeedMultiplier = 1;
        this.spinMaxImpact = false;
        this.spinLastChargeAt = -Infinity;
    }

    getCurrentHeight() {
        return (this.isCrouching || this.isSpinning || this.isSpinDashActive) ? 140 : this.height;
    }

    getCurrentY() {
        // Al saltar durante Spin, la hurtbox debe seguir la Y real del personaje.
        if (this.isSpinDashActive && !this.isGrounded) return this.y + (this.height - 140);
        return (this.isCrouching || this.isSpinning || this.isSpinDashActive) ? this.feetY - 140 : this.y;
    }

    getIntroFrames() { return []; }
    draw(opponentX) {}
}