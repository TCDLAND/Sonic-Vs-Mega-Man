// ========================================
// PUNTO DE ENTRADA Y GAME LOOP
// ========================================

import { worldWidth, GAME_STATE } from './config.js';
import { game, ctx, canvas, tongueCtx } from './state.js';
import { bgImage, trebleSprite1, bassSprite3 } from './assets.js';
import { drawSelectionScreen } from './selection.js';
import { setupInput } from './input.js';
import { getCellCoords } from './utils.js';
import { drawTrebleFrame, TREBLE_BULLET_IMPACT_A, TREBLE_BULLET_IMPACT_B } from './bass.js';
import { dealDamage, DEBUG_COMBAT } from './combat-system.js';
import { checkSonicDashAttack, checkSonicRocketAttack } from './sonic.js';
import {
    checkJabCollision, checkHeavyCollision,
    checkKickLightCollision, checkKickHeavyCollision,
    checkSpinDashCollision, checkSpinVsSpin, resolveSpinVsProjectile, checkTongueCollision,
    checkBassBulletCollision, checkBulletsVsProjectiles
, checkZeroSaberCollision } from './collisions.js';

// ============================
// BALAS DE TREBLE
// ============================
function updateTrebleBullets(p1, p2) {
    game.trebleBullets.forEach((bullet) => {
        if (!bullet.active) return;

        if (bullet.effectActive) {
            bullet.effectTimer++;
            if (bullet.effectTimer >= 120) {
                bullet.active = false;
                if (bullet.capturedTarget) {
                    bullet.capturedTarget.isVulnerable = false;
                    bullet.capturedTarget = null;
                }
            }
            return;
        }

        bullet.x += bullet.vx;
        bullet.y += bullet.vy;
        bullet.vy += bullet.gravity;

        bullet.lifetime--;

        if (bullet.y >= 600 - bullet.height) {
            if (bullet.charged) {
                bullet.effectActive = true;
                bullet.effectTimer = 0;
                bullet.y = 600 - bullet.height;
                bullet.vx = 0;
                bullet.vy = 0;
            } else {
                bullet.active = false;
            }
        }

        const target = (bullet.direction > 0) ? p2 : p1;
        if (target && bullet.active) {
            const ry = target.getCurrentY();
            const rh = target.getCurrentHeight();
            if (
                bullet.x < target.x + target.width &&
                bullet.x + bullet.width > target.x &&
                bullet.y < ry + rh &&
                bullet.y + bullet.height > ry
            ) {
                if (target.isGuarding) {
                    bullet.active = false;
                    return;
                }
                if (bullet.charged) {
                    bullet.effectActive = true;
                    bullet.effectTimer = 0;
                    bullet.vx = 0;
                    bullet.vy = 0;
                    bullet.capturedTarget = target;
                    bullet.captureTimer = 120;
                    target.isVulnerable = true;
                    target.vulnerableTimer = 120;
                } else {
                    dealDamage(target, bullet.damage, { attacker: bullet.owner, attackName: bullet.charged ? 'Treble cargado' : 'Treble disparo' });
                    bullet.active = false;
                }
            }
        }

        if (bullet.lifetime <= 0) bullet.active = false;
    });

    game.trebleBullets = game.trebleBullets.filter(b => b.active);
}

function drawTrebleBullets() {
    if (!bassSprite3.complete || bassSprite3.naturalWidth === 0) return;

    game.trebleBullets.forEach((bullet) => {
        const drawX = bullet.x - game.cameraX;

        if (bullet.effectActive) {
            if (bullet.effectTimer < 6) {
                const frameData = { cells: [{ frameNum: 28, col: 1, row: 1 }], sheet: 3 };
                drawTrebleFrame(frameData, drawX, bullet.y + bullet.height, false);
            } else {
                const f = Math.floor(bullet.effectTimer / 12) % 2;
                const frameData = (f === 0) ? TREBLE_BULLET_IMPACT_A : TREBLE_BULLET_IMPACT_B;
                drawTrebleFrame(frameData, drawX, bullet.y + bullet.height, false);
            }
        } else {
            // Proyectil normal de Treble: dibujarlo con SU hitbox real, no con
            // drawTrebleFrame (280x210), que era la causa de que se viera enorme.
            const frameNum = 28 + (Math.floor(performance.now() / 80) % 3);
            const c = getCellCoords(frameNum, bassSprite3.naturalWidth, bassSprite3.naturalHeight, 8, 6);
            ctx.drawImage(
                bassSprite3,
                c.sx, c.sy, c.sw, c.sh,
                drawX, bullet.y, bullet.width, bullet.height
            );
        }
    });
}

// ============================
// TREBLES
// ============================
function updateTrebles(p1, p2) {
    game.trebles.forEach((treble) => {
        if (!treble.isActive) return;
        const opponentX = (treble.owner === p1) ? p2.x : p1.x;
        treble.update(opponentX);

        const target = (treble.owner === p1) ? p2 : p1;
        if (treble.contactCooldown > 0) return;

        const tx = target.x;
        const ty = target.getCurrentY();
        const tw = target.width;
        const th = target.getCurrentHeight();

        const cx = treble.x;
        const cy = treble.feetY - treble.height;
        const cw = treble.width;
        const ch = treble.height;

        if (cx < tx + tw && cx + cw > tx && cy < ty + th && cy + ch > ty) {
            if (treble.state === "following") {
                dealDamage(target, 3, { attacker: treble.owner, attackName: 'Treble contacto' });
                treble.contactCooldown = 60;
            } else if (treble.state.startsWith("attack")) {
                if (target.isGuarding && target.guardType === "low") {
                    treble.contactCooldown = 30;
                    return;
                }
                dealDamage(target, 10, { attacker: treble.owner, attackName: 'Treble ataque' });

                const dir = treble.direction;
                target.vx = dir * 12;
                target.vy = -8;
                target.isGrounded = false;
                target.wasInAirFromKnockback = true;
                target.knockbackAirTimer = 0;

                treble.contactCooldown = 30;
            }
        }
    });

    game.trebles = game.trebles.filter(t => t.isActive);
}

function drawTrebles() {
    game.trebles.forEach((treble) => {
        treble.draw();
    });
}

// ============================
// GAME LOOP
// ============================
function gameLoop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (game.gameState === GAME_STATE.SELECT) {
        drawSelectionScreen();
    }
    else if (game.gameState === GAME_STATE.BATTLE) {
        const p1 = game.p1;
        const p2 = game.p2;
        window.__GAME_P1__ = p1; window.__GAME_P2__ = p2;

        let targetCameraX = (p1.x + p2.x) / 2 - canvas.width / 2;
        let maxCameraX = worldWidth - canvas.width;
        if (targetCameraX < 0) targetCameraX = 0;
        if (targetCameraX > maxCameraX) targetCameraX = maxCameraX;
        game.cameraX += (targetCameraX - game.cameraX) * 0.1;

        if (bgImage.complete) {
            ctx.drawImage(bgImage, game.cameraX, 0, canvas.width, canvas.height, 0, 0, canvas.width, canvas.height);
        }

        // Chaos Control congela al rival; el propio Shadow sigue activo.
        if(!p1.shadowFrozenBy)p1.update(p2.x,p1);
        if(!p2.shadowFrozenBy)p2.update(p1.x,p2);
        if(p1.shadowFrozenBy||p2.shadowFrozenBy){
            // Los proyectiles se pausaran durante el bucle de congelacion.
        }
        // Concrete: resolver física de ambos luchadores con silueta de idle fija.
        for(const r of [p1,p2])if(r?.characterId==='rock')for(const fighter of [p1,p2]){
          if(fighter!==r)r.resolveConcreteBody?.(fighter);
        }

        game.projectiles.forEach((proj) => {
            if(!p1.shadowFrozenBy&&!p2.shadowFrozenBy)proj.update();
            proj.draw(game.cameraX);
            const rockOwner = p1?.characterId === 'rock' ? p1 : (p2?.characterId === 'rock' ? p2 : null);
            if (rockOwner?.handleProjectileVsConcrete?.(proj)) return;
            const target = (proj.owner === p1) ? p2 : p1;
            let targetY = target.getCurrentY();
            let targetH = target.getCurrentHeight();
            const projectilePixelHit = typeof proj.pixelHitsTarget === 'function'
                ? proj.pixelHitsTarget(target)
                : (typeof target.pixelBodyIntersectsRect !== 'function' ||
                   target.pixelBodyIntersectsRect({x:proj.x,y:proj.y,w:proj.width,h:proj.height}, proj.owner.x + proj.owner.width/2));
            if (proj.active && proj.x < target.x + target.width && proj.x + proj.width > target.x &&
                proj.y < targetY + targetH && proj.y + proj.height > targetY && projectilePixelHit) {
                if (target.isSpinDashActive && resolveSpinVsProjectile(target, proj)) return;
                let dmg = proj.damage;
                if (target.isGuarding && target.guardType === "high") dmg = Math.floor(dmg * 0.15);
                dealDamage(target, dmg, { attacker: proj.owner, attackName: proj.type || 'Proyectil' });
                const keep = typeof proj.onHit === 'function' && proj.onHit(target) === false;
                if (!keep) proj.active = false;
            }
        });

        game.bassBullets.forEach((bullet) => {
            if(!p1.shadowFrozenBy&&!p2.shadowFrozenBy)bullet.update();
            bullet.draw(game.cameraX);
            const rockOwner = p1?.characterId === 'rock' ? p1 : (p2?.characterId === 'rock' ? p2 : null);
            if (rockOwner?.handleProjectileVsConcrete?.(bullet)) return;
            const target = (bullet.owner === p1) ? p2 : p1;
            checkBassBulletCollision(bullet, target);
        });

        if(!p1.shadowFrozenBy&&!p2.shadowFrozenBy){updateTrebles(p1,p2);updateTrebleBullets(p1,p2);}

        checkBulletsVsProjectiles();

        game.projectiles = game.projectiles.filter(proj => proj.active);
        game.bassBullets = game.bassBullets.filter(b => b.active);

        p1.tryShadowComboHit?.(p2);p2.tryShadowComboHit?.(p1);
        p1.tryRocketHit?.(p2);p2.tryRocketHit?.(p1);
        p1.updateMagicHit?.(p2);p2.updateMagicHit?.(p1);
        checkJabCollision(p1, p2); checkJabCollision(p2, p1);
        checkHeavyCollision(p1, p2); checkHeavyCollision(p2, p1);
        checkKickLightCollision(p1, p2); checkKickLightCollision(p2, p1);
        checkKickHeavyCollision(p1, p2); checkKickHeavyCollision(p2, p1);
        checkZeroSaberCollision(p1, p2); checkZeroSaberCollision(p2, p1);
        if (typeof p1.tryHit === 'function') p1.tryHit(p2);
        if (typeof p2.tryHit === 'function') p2.tryHit(p1);
        checkSpinVsSpin(p1, p2);
        checkSpinDashCollision(p1, p2); checkSpinDashCollision(p2, p1);
        checkSonicDashAttack(p1,p2); checkSonicDashAttack(p2,p1);
        checkSonicRocketAttack(p1,p2); checkSonicRocketAttack(p2,p1);
        checkTongueCollision(p1, p2); checkTongueCollision(p2, p1);

        // El agarre de Knuckles alterna capas para que la vuelta se lea como un cuerpo
        // pasando realmente por delante y por detras del rival.
        const p1Grab = p1.characterId === 'knuckles' && p1.grabConnected && p1.grabTarget === p2;
        const p2Grab = p2.characterId === 'knuckles' && p2.grabConnected && p2.grabTarget === p1;
        if (p1Grab) {
            if (p1.grabDrawInFront()) { p2.draw(p2.getVisualOpponentX ? p2.getVisualOpponentX(p1.x) : p1.x); p1.draw(p1.getVisualOpponentX ? p1.getVisualOpponentX(p2.x) : p2.x); }
            else { p1.draw(p1.getVisualOpponentX ? p1.getVisualOpponentX(p2.x) : p2.x); p2.draw(p2.getVisualOpponentX ? p2.getVisualOpponentX(p1.x) : p1.x); }
        } else if (p2Grab) {
            if (p2.grabDrawInFront()) { p1.draw(p1.getVisualOpponentX ? p1.getVisualOpponentX(p2.x) : p2.x); p2.draw(p2.getVisualOpponentX ? p2.getVisualOpponentX(p1.x) : p1.x); }
            else { p2.draw(p2.getVisualOpponentX ? p2.getVisualOpponentX(p1.x) : p1.x); p1.draw(p1.getVisualOpponentX ? p1.getVisualOpponentX(p2.x) : p2.x); }
        } else {
            p1.draw(p1.getVisualOpponentX ? p1.getVisualOpponentX(p2.x) : p2.x);
            p2.draw(p2.getVisualOpponentX ? p2.getVisualOpponentX(p1.x) : p1.x);
        }
        // Tormenta fuera del radio, dibujada por encima del escenario.
        p1.drawChaosStorm?.();p2.drawChaosStorm?.();
        drawTrebles();
        drawTrebleBullets();

        if (DEBUG_COMBAT.enabled) {
            ctx.save(); ctx.font = '14px monospace'; ctx.textAlign = 'left';
            ctx.fillStyle = 'rgba(0,0,0,.72)'; ctx.fillRect(8, 8, 620, 58);
            ctx.fillStyle = '#fff'; ctx.fillText('DEBUG DAÑO', 18, 27);
            ctx.fillText(DEBUG_COMBAT.lastP1, 18, 45);
            ctx.fillText(DEBUG_COMBAT.lastP2, 18, 61); ctx.restore();
        }
    }

    requestAnimationFrame(gameLoop);
}

setupInput();
gameLoop();
