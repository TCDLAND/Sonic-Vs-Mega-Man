// ========================================
// TODAS LAS COLISIONES
// ========================================

import { game, tongueCtx } from './state.js';
import { playSound, getCellCoords, rectsOverlap } from './utils.js';
import { hitAudio, espioSprite3, bassSprite3 } from './assets.js';
import { getProjectileForce, impactMultiplierAfterProjectile } from './spin-system.js';
import { dealDamage } from './combat-system.js';


function receiverPixelsTouchRect(receiver, rect, attacker) {
    if (typeof receiver?.pixelBodyIntersectsRect !== 'function') return true;
    return receiver.pixelBodyIntersectsRect(rect, attacker.x + attacker.width / 2);
}

function sonicPixelAttackTouch(attacker, receiver, kind) {
    if (attacker?.characterId !== 'sonic' || typeof attacker.pixelAttackHits !== 'function') return true;
    const result = attacker.pixelAttackHits(receiver, kind);
    return result === null ? true : result;
}

// ============================
// JAB
// ============================
export function checkJabCollision(attacker, receiver) {
    if(attacker?.characterId==='shadow')return;
    if (!attacker.isJabActive) return;
    if (attacker.jabHitDone) return;
    if (attacker.jabTimer < 5 || attacker.jabTimer > 15) return;

    const facingRight = attacker.x < receiver.x;
    const hitX = facingRight ? attacker.x + attacker.width - 30 : attacker.x - 70;
    const hitY = attacker.feetY - 110;
    const hitW = 100;
    const hitH = 110;

    const ry = receiver.getCurrentY();
    const rh = receiver.getCurrentHeight();

    if (hitX < receiver.x + receiver.width && hitX + hitW > receiver.x &&
        hitY < ry + rh && hitY + hitH > ry &&
        receiverPixelsTouchRect(receiver, {x:hitX,y:hitY,w:hitW,h:hitH}, attacker) &&
        sonicPixelAttackTouch(attacker, receiver, 'punch')) {
        attacker.applyDamage(receiver, attacker.jabDamage, ["low"]);
        attacker.jabHitDone = true;
    }
}

// ============================
// HEAVY
// ============================
export function checkHeavyCollision(attacker, receiver) {
    if(attacker?.characterId==='shadow')return;
    if (!attacker.isHeavyActive) return;
    if (attacker.heavyHitDone) return;
    if (attacker.heavyFrame < 2) return;

    const facingRight = attacker.x < receiver.x;
    const hitX = facingRight ? attacker.x + attacker.width - 30 : attacker.x - 70;
    const hitY = attacker.y + 40;
    const hitW = 100;
    const hitH = 100;

    const ry = receiver.getCurrentY();
    const rh = receiver.getCurrentHeight();

    if (hitX < receiver.x + receiver.width && hitX + hitW > receiver.x &&
        hitY < ry + rh && hitY + hitH > ry &&
        receiverPixelsTouchRect(receiver, {x:hitX,y:hitY,w:hitW,h:hitH}, attacker) &&
        sonicPixelAttackTouch(attacker, receiver, 'heavy')) {
        const dmg = attacker.heavyDamage[attacker.heavyFrame];
        const knockback = attacker.heavyFrame === 4 ? { vx: (facingRight ? 1 : -1) * 10, vy: -10 } : null;
        attacker.applyDamage(receiver, dmg, ["high"], knockback);
        attacker.heavyHitDone = true;

        if (attacker.heavyFrame === 2) attacker.heavyCanExtend = true;
        if (attacker.heavyFrame === 4) {
            const dir = facingRight ? -1 : 1;
            attacker.vx = dir * 8;
            attacker.vy = -8;
            attacker.isGrounded = false;
        }
    }
}

// ============================
// KICK LIGHT
// ============================
export function checkKickLightCollision(attacker, receiver) {
    if(attacker?.characterId==='shadow')return;
    if (!attacker.isKickLightActive) return;
    if (attacker.kickLightHitDone) return;
    if (attacker.kickLightTimer < 5 || attacker.kickLightTimer > 15) return;

    const facingRight = attacker.x < receiver.x;
    const hitX = facingRight ? attacker.x + attacker.width - 30 : attacker.x - 70;
    const hitY = attacker.feetY - 100;
    const hitW = 100;
    const hitH = 100;

    const ry = receiver.getCurrentY();
    const rh = receiver.getCurrentHeight();

    if (hitX < receiver.x + receiver.width && hitX + hitW > receiver.x &&
        hitY < ry + rh && hitY + hitH > ry &&
        receiverPixelsTouchRect(receiver, {x:hitX,y:hitY,w:hitW,h:hitH}, attacker) &&
        sonicPixelAttackTouch(attacker, receiver, 'topKick')) {
        attacker.applyDamage(receiver, attacker.kickLightDamage, ["low"], { vx: (facingRight ? 1 : -1) * 2, vy: -14 });
        attacker.kickLightHitDone = true;
    }
}

// ============================
// KICK HEAVY
// ============================
export function checkKickHeavyCollision(attacker, receiver) {
    if(attacker?.characterId==='shadow')return;
    if (!attacker.isKickHeavyActive) return;
    if (attacker.kickHeavyHitDone) return;

    const facingRight = attacker.x < receiver.x;
    const hitX = facingRight ? attacker.x + attacker.width - 30 : attacker.x - 70;
    const hitW = 100;
    let hitY, hitH, dmg, guardBreaks, knockback;

    if (attacker.kickHeavyPhase === 1) {
        if (attacker.kickHeavyTimer < 10) return;
        hitY = attacker.y + 60;
        hitH = 80;
        dmg = attacker.kickHeavyDamageP1;
        guardBreaks = ["high"];
        knockback = { vx: (facingRight ? 1 : -1) * 4, vy: -8 };
    } else if (attacker.kickHeavyPhase === 2) {
        hitY = attacker.y + 60;
        hitH = 100;
        dmg = attacker.kickHeavyDamageP2;
        guardBreaks = [];
        knockback = { vx: (facingRight ? 1 : -1) * 3, vy: -18 };
    } else {
        return;
    }

    const ry = receiver.getCurrentY();
    const rh = receiver.getCurrentHeight();

    if (hitX < receiver.x + receiver.width && hitX + hitW > receiver.x &&
        hitY < ry + rh && hitY + hitH > ry &&
        receiverPixelsTouchRect(receiver, {x:hitX,y:hitY,w:hitW,h:hitH}, attacker) &&
        sonicPixelAttackTouch(attacker, receiver, 'sideKick')) {
        if (attacker.kickHeavyPhase === 2 && receiver.isGuarding && receiver.guardType === "low") return;
        attacker.applyDamage(receiver, dmg, guardBreaks, knockback);
        attacker.kickHeavyHitDone = true;
        if (attacker.kickHeavyPhase === 1) attacker.kickHeavyCanExtend = true;
    }
}

// ============================
// SPIN DASH
// ============================
function spinRectsOverlap(a, b) {
    const ay = a.getCurrentY();
    const ah = a.getCurrentHeight();
    const by = b.getCurrentY();
    const bh = b.getCurrentHeight();
    const geo = a.x < b.x + b.width && a.x + a.width > b.x && ay < by + bh && ay + ah > by;
    if (!geo) return false;
    const rectA={x:a.x,y:ay,w:a.width,h:ah};
    if (!receiverPixelsTouchRect(b,rectA,a)) return false;
    if (!sonicPixelAttackTouch(a,b,'spin')) return false;
    return true;
}

export function checkSpinVsSpin(a, b) {
    if (!a.isSpinDashActive || !b.isSpinDashActive) return false;
    if (!spinRectsOverlap(a, b)) return false;

    const forceA = a.getSpinStat('clashForce');
    const forceB = b.getSpinStat('clashForce');

    if (forceA === forceB) {
        a.vx = -a.spinDirection * 8;
        b.vx = -b.spinDirection * 8;
        a.finishSpinDash(true);
        b.finishSpinDash(true);
        return true;
    }

    const winner = forceA > forceB ? a : b;
    const loser = winner === a ? b : a;
    const loserDir = loser.spinDirection;
    loser.finishSpinDash(true);
    loser.vx = -loserDir * 12;
    loser.vy = -10;
    loser.isGrounded = false;
    loser.wasInAirFromKnockback = true;
    loser.knockbackAirTimer = 0;
    // El ganador conserva su Spin: ganar un choque no lo convierte en una barra de HP.
    return true;
}

export function resolveSpinVsProjectile(spinner, projectile) {
    if (!spinner?.isSpinDashActive || !projectile?.active) return false;
    const sy = spinner.getCurrentY();
    const sh = spinner.getCurrentHeight();
    if (!(projectile.x < spinner.x + spinner.width && projectile.x + projectile.width > spinner.x &&
          projectile.y < sy + sh && projectile.y + projectile.height > sy)) return false;

    const spinForce = spinner.getSpinStat('projectileForce');
    const projectileForce = getProjectileForce(projectile);

    if (spinForce > projectileForce) {
        projectile.active = false;
        // No se resta fuerza. Solo puede bajar la potencia del futuro impacto.
        spinner.spinImpactMultiplier = Math.min(
            spinner.spinImpactMultiplier,
            impactMultiplierAfterProjectile(spinForce, projectileForce)
        );
        // Knuckles Nv.3 conserva Impacto Maximo frente a Nv.1; algo superior se lo quita.
        if (spinner.spinMaxImpact && projectileForce > 1) spinner.spinMaxImpact = false;
        return true;
    }

    if (spinForce === projectileForce) {
        projectile.active = false;
        const dir = spinner.spinDirection;
        spinner.finishSpinDash(true);
        spinner.vx = -dir * 8;
        return true;
    }

    // El proyectil gana: el Spin se rompe/rebota. El proyectil sigue vivo para aplicar su golpe.
    const dir = spinner.spinDirection;
    spinner.finishSpinDash(true);
    spinner.vx = -dir * 12;
    spinner.vy = -9;
    spinner.isGrounded = false;
    spinner.wasInAirFromKnockback = true;
    spinner.knockbackAirTimer = 0;
    return false;
}

export function checkSpinDashCollision(attacker, receiver) {
    if (!attacker.isSpinDashActive) return;
    if (!spinRectsOverlap(attacker, receiver)) return;

    // Spin vs Spin se resuelve aparte para que no se convierta en dos golpes normales.
    if (receiver.isSpinDashActive) return;

    const level = attacker.spinChargeLevel;
    const direction = attacker.spinDirection;
    const baseDamage = attacker.getSpinStat('damage');
    const horizontalForce = attacker.getSpinStat('knockbackX');
    const verticalForce = attacker.getSpinStat('knockbackY');
    const finalDamage = Math.max(1, Math.round(baseDamage * attacker.spinImpactMultiplier));

    if (receiver.isGuarding) {
        if (attacker.spinMaxImpact) {
            // Knuckles Nv.3 limpio: cubrirse reduce el golpe, pero no lo anula.
            dealDamage(receiver, finalDamage, { attacker, attackName: 'Spin Dash bloqueado - Impacto Max', multiplier: 0.50 });
            receiver.vx = direction * horizontalForce;
            receiver.isVulnerable = true;
            receiver.vulnerableTimer = Math.max(receiver.vulnerableDuration, 36);
        } else {
            // Spin normal bloqueado: chip pequeno y empuje.
            dealDamage(receiver, finalDamage, { attacker, attackName: 'Spin Dash bloqueado', multiplier: 0.10 });
            receiver.vx = direction * Math.max(3, horizontalForce * 0.35);
        }
    } else {
        dealDamage(receiver, finalDamage, { attacker, attackName: `Spin Dash Nv.${level}` });
        receiver.vx = direction * horizontalForce;
        receiver.vy = verticalForce;
        receiver.isGrounded = false;
        receiver.wasInAirFromKnockback = true;
        receiver.knockbackAirTimer = 0;
    }


    // Sonic Nv.3 es la excepcion: puede conectar hasta 3 pasadas.
    if (attacker.characterId === 'sonic' && level === 3) {
        const now = performance.now();
        if (!attacker.sonicSpinLastHit || now - attacker.sonicSpinLastHit > 220) {
            attacker.sonicSpinHits = (attacker.sonicSpinHits || 0) + 1;
            attacker.sonicSpinLastHit = now;
        }
        if ((attacker.sonicSpinHits || 0) < 3) {
            // Cada impacto de Sonic reduce 20% su velocidad y potencia restante.
            // Tambien ocurre al rebotar contra una pared (sonic.js).
            attacker.spinImpactMultiplier = Math.max(0.35, attacker.spinImpactMultiplier * 0.80);
            attacker.spinSpeedMultiplier = Math.max(0.45, (attacker.spinSpeedMultiplier || 1) * 0.80);
            attacker.spinDirection *= -1;
            attacker.vx = attacker.spinDirection * attacker.getSpinStat('speed') * attacker.spinSpeedMultiplier;
            return;
        }
        attacker.sonicSpinHits = 0;
        attacker.sonicSpinLastHit = 0;
    }

    const recoil = 6 + level * 3;
    attacker.finishSpinDash(true);
    attacker.vx = -direction * recoil;
    attacker.vy = -10 - level * 2;
}

// ============================
// TONGUE
// ============================
export function checkTongueCollision(attacker, receiver) {
    if (!attacker.isTongueAttacking) return;
    if (attacker.tonguePhase !== "extend") return;
    if (attacker.tongueHitDone) return;
    if (!attacker.lastTongueRects || attacker.lastTongueRects.length === 0) return;
    if (!espioSprite3.complete) return;

    const cameraX = game.cameraX;
    const receiverY = receiver.getCurrentY();
    const receiverH = receiver.getCurrentHeight();
    const rx = receiver.x - cameraX;
    const ry = receiverY;
    const rw = receiver.width;
    const rh = receiverH;
    const STEP = 4;

    for (const cell of attacker.lastTongueRects) {
        if (!cell.isDamageCell) continue;
        if (cell.x + cell.w <= rx || cell.x >= rx + rw || cell.y + cell.h <= ry || cell.y >= ry + rh) continue;

        tongueCtx.clearRect(0, 0, cell.w, cell.h);
        tongueCtx.drawImage(espioSprite3, cell.sx, cell.sy, cell.sw, cell.sh, 0, 0, cell.w, cell.h);

        let imageData;
        try {
            imageData = tongueCtx.getImageData(0, 0, cell.w, cell.h);
        } catch (e) {
            dealDamage(receiver, attacker.tongueDamage, { attacker, attackName: 'Lengua' });
            attacker.tongueHitDone = true;
            return;
        }

        const data = imageData.data;
        const overlapX1 = Math.max(cell.x, rx);
        const overlapY1 = Math.max(cell.y, ry);
        const overlapX2 = Math.min(cell.x + cell.w, rx + rw);
        const overlapY2 = Math.min(cell.y + cell.h, ry + rh);

        for (let py = overlapY1; py < overlapY2; py += STEP) {
            for (let px = overlapX1; px < overlapX2; px += STEP) {
                let localX = Math.floor(px - cell.x);
                let localY = Math.floor(py - cell.y);
                if (cell.facingLeft) localX = cell.w - 1 - localX;
                if (localX < 0 || localX >= cell.w || localY < 0 || localY >= cell.h) continue;
                const idx = (localY * cell.w + localX) * 4;
                const alpha = data[idx + 3];
                if (alpha > 0) {
                    dealDamage(receiver, attacker.tongueDamage, { attacker, attackName: 'Lengua' });
                    attacker.tongueHitDone = true;
                    return;
                }
            }
        }
    }
}

// ============================
// BASS BULLET (ACTUALIZADO)
// ============================
export function checkBassBulletCollision(bullet, receiver) {
    if (!bullet.active) return;

    const receiverY = receiver.getCurrentY();
    const receiverH = receiver.getCurrentHeight();
    const rx = receiver.x;
    const ry = receiverY;
    const rw = receiver.width;
    const rh = receiverH;

    const bx = bullet.x;
    const by = bullet.y;
    const bw = bullet.width;
    const bh = bullet.height;

    if (!(bx < rx + rw && bx + bw > rx && by < ry + rh && by + bh > ry)) return;
    if (typeof receiver.pixelBodyIntersectsRect === 'function' &&
        !receiver.pixelBodyIntersectsRect({x:bx,y:by,w:bw,h:bh}, bullet.owner.x + bullet.owner.width/2)) return;

    if (!bassSprite3.complete || bassSprite3.naturalWidth === 0) return;
    const frameNum = bullet.getFrameNum();
    const c = getCellCoords(frameNum, bassSprite3.naturalWidth, bassSprite3.naturalHeight, 8, 6);

    tongueCtx.clearRect(0, 0, bw, bh);
    tongueCtx.drawImage(bassSprite3, c.sx, c.sy, c.sw, c.sh, 0, 0, bw, bh);

    let imageData;
    try {
        imageData = tongueCtx.getImageData(0, 0, bw, bh);
    } catch (e) {
        applyBulletDamage(bullet, receiver);
        return;
    }

    const data = imageData.data;
    const overlapX1 = Math.max(bx, rx);
    const overlapY1 = Math.max(by, ry);
    const overlapX2 = Math.min(bx + bw, rx + rw);
    const overlapY2 = Math.min(by + bh, ry + rh);

    const STEP = 4;
    for (let py = overlapY1; py < overlapY2; py += STEP) {
        for (let px = overlapX1; px < overlapX2; px += STEP) {
            let localX = Math.floor(px - bx);
            let localY = Math.floor(py - by);
            // Espejar si va hacia la izquierda
            if (bullet.vx < 0) localX = bw - 1 - localX;
            if (localX < 0 || localX >= bw || localY < 0 || localY >= bh) continue;
            const idx = (localY * bw + localX) * 4;
            const alpha = data[idx + 3];
            if (alpha > 0) {
                applyBulletDamage(bullet, receiver);
                return;
            }
        }
    }
}

// ============================
// APLICAR DAÑO DE BALA (ACTUALIZADO)
// ============================
export function applyBulletDamage(bullet, receiver) {
    if (receiver.isSpinDashActive) {
        const handled = resolveSpinVsProjectile(receiver, bullet);
        if (handled || !bullet.active) return;
    }

    if (receiver.isGuarding) {
        receiver.guardFlashUntil = performance.now() + 180;
        bullet.active = false;
        return;
    }

    dealDamage(receiver, bullet.damage, { attacker: bullet.owner, attackName: 'Bass Buster' });

    receiver.bulletsReceivedInBurst++;
    receiver.lastBulletHitTime = performance.now();

    const count = receiver.bulletsReceivedInBurst;
    // Dirección del knockback basada en la velocidad horizontal de la bala
    const dir = (bullet.vx > 0) ? 1 : (bullet.vx < 0) ? -1 : (bullet.direction || 1);

    if (count >= 12) {
        if (!receiver.isGrounded) {
            receiver.vx = -dir * 15;
            receiver.vy = -12;
        } else {
            receiver.vx = -dir * 18;
            receiver.vy = 0;
        }
        receiver.isGrounded = false;
        receiver.wasInAirFromKnockback = true;
        receiver.knockbackAirTimer = 0;
    } else if (count >= 6 && count <= 11) {
        receiver.vx = -dir * 2;
    } else if (count >= 1 && count <= 5) {
        receiver.vx = -dir * 1;
    }

    if (count >= 5) {
        receiver.isVulnerable = true;
        receiver.vulnerableTimer = 30;
    }

    bullet.active = false;
    playSound(hitAudio);
}

// ============================
// BALAS VS PROYECTILES
// ============================
export function checkBulletsVsProjectiles() {
    for (const proj of game.projectiles) {
        if (!proj.active) continue;
        if (proj.type === 'shuriken') {
            for (const bullet of game.bassBullets) {
                if (!bullet.active) continue;
                if (rectsOverlap(bullet, proj)) {
                    bullet.active = false;
                }
            }
        } else if (proj.type === 'kunai') {
            let destroyed = 0;
            for (const bullet of game.bassBullets) {
                if (!bullet.active) continue;
                if (destroyed >= 4) break;
                if (rectsOverlap(bullet, proj)) {
                    bullet.active = false;
                    destroyed++;
                }
            }
            if (destroyed > 0) proj.active = false;
        }
    }
}
// ============================
// ZERO - Z-SABER POR PALETA
// ============================
export function checkZeroSaberCollision(attacker, receiver) {
    if (attacker?.characterId !== 'zero' || typeof attacker.saberHits !== 'function') return;
    // Rush Jet sí puede ser cortado por el sable. Rush no pierde HP: la orden se anula
    // y vuelve corriendo con Rock. El cuerpo de Sonic/Knuckles no cancela Jet por contacto.
    const rush = receiver?.activeRush;
    if (rush?.state === 'jet' && attacker.saberHits(rush)) {
        rush.interrupt();
        attacker.zeroAttackHit = true;
        return;
    }
    if (attacker.saberHits(receiver)) attacker.applySaberHit(receiver);
}
