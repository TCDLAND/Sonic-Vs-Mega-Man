import { hitTeamAssist } from './team-assists.js';
import { combatNow } from './combat-clock.js';
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

function fighterBounds(fighter, opponentX = fighter?.x) {
    return fighter?.getCurrentBounds?.(opponentX) || { x:fighter.x, y:fighter.getCurrentY(), w:fighter.width, h:fighter.getCurrentHeight() };
}

function sonicPixelAttackTouch(attacker, receiver, kind) {
    if (typeof attacker?.pixelAttackHits !== 'function') return true;
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
    const hitY = attacker.y + attacker.height - 110;
    const hitW = 100;
    const hitH = 110;

    if (hitTeamAssist(receiver,attacker,{x:hitX,y:hitY,w:hitW,h:hitH},attacker.jabDamage) || receiver.handleMeleeVsEddie?.({x:hitX,y:hitY,w:hitW,h:hitH},attacker)) { attacker.jabHitDone=true; return; }
    const {x:rx,y:ry,w:rw,h:rh} = fighterBounds(receiver,attacker.x+attacker.width/2);

    if (hitX < rx + rw && hitX + hitW > rx &&
        hitY < ry + rh && hitY + hitH > ry &&
        receiverPixelsTouchRect(receiver, {x:hitX,y:hitY,w:hitW,h:hitH}, attacker) &&
        sonicPixelAttackTouch(attacker, receiver, 'punch')) {
        attacker.applyDamage(receiver, attacker.jabDamage, ["low"],null,attacker.characterId==='espio'?'Puño de Espio':undefined);
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

    if (hitTeamAssist(receiver,attacker,{x:hitX,y:hitY,w:hitW,h:hitH},8) || receiver.handleMeleeVsEddie?.({x:hitX,y:hitY,w:hitW,h:hitH},attacker)) { attacker.heavyHitDone=true; return; }
    const {x:rx,y:ry,w:rw,h:rh} = fighterBounds(receiver,attacker.x+attacker.width/2);

    if (hitX < rx + rw && hitX + hitW > rx &&
        hitY < ry + rh && hitY + hitH > ry &&
        receiverPixelsTouchRect(receiver, {x:hitX,y:hitY,w:hitW,h:hitH}, attacker) &&
        sonicPixelAttackTouch(attacker, receiver, 'heavy')) {
        const dmg = attacker.heavyDamage[attacker.heavyFrame];
        const knockback = attacker.heavyFrame === 4 ? { vx: (facingRight ? 1 : -1) * 10, vy: -10 } : null;
        attacker.applyDamage(receiver, dmg, ["high"], knockback,attacker.characterId==='espio'?'Golpe fuerte de Espio':undefined);
        attacker.heavyHitDone = true;

        if (attacker.heavyFrame === 2 || attacker.heavyFrame === 3) attacker.heavyCanExtend = true;
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
    const hitY = attacker.y + attacker.height - 100;
    const hitW = 100;
    const hitH = 100;

    if (hitTeamAssist(receiver,attacker,{x:hitX,y:hitY,w:hitW,h:hitH},attacker.kickLightDamage) || receiver.handleMeleeVsEddie?.({x:hitX,y:hitY,w:hitW,h:hitH},attacker)) { attacker.kickLightHitDone=true; return; }
    const {x:rx,y:ry,w:rw,h:rh} = fighterBounds(receiver,attacker.x+attacker.width/2);

    if (hitX < rx + rw && hitX + hitW > rx &&
        hitY < ry + rh && hitY + hitH > ry &&
        receiverPixelsTouchRect(receiver, {x:hitX,y:hitY,w:hitW,h:hitH}, attacker) &&
        sonicPixelAttackTouch(attacker, receiver, 'topKick')) {
        attacker.applyDamage(receiver, attacker.kickLightDamage, ["low"], { vx: (facingRight ? 1 : -1) * 2, vy: -14 },
            attacker.characterId==='espio'?'Patada ligera de Espio':undefined);
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

    if (hitTeamAssist(receiver,attacker,{x:hitX,y:hitY,w:hitW,h:hitH},attacker.kickHeavyDamageP1) || receiver.handleMeleeVsEddie?.({x:hitX,y:hitY,w:hitW,h:hitH},attacker)) { attacker.kickHeavyHitDone=true; return; }
    const {x:rx,y:ry,w:rw,h:rh} = fighterBounds(receiver,attacker.x+attacker.width/2);

    if (hitX < rx + rw && hitX + hitW > rx &&
        hitY < ry + rh && hitY + hitH > ry &&
        receiverPixelsTouchRect(receiver, {x:hitX,y:hitY,w:hitW,h:hitH}, attacker) &&
        sonicPixelAttackTouch(attacker, receiver, 'sideKick')) {
        if (attacker.kickHeavyPhase === 2 && receiver.isGuarding && receiver.guardType === "low") return;
        attacker.applyDamage(receiver, dmg, guardBreaks, knockback,attacker.characterId==='espio'?'Patada fuerte de Espio':undefined);
        attacker.kickHeavyHitDone = true;
        if (attacker.kickHeavyPhase === 1) attacker.kickHeavyCanExtend = true;
    }
}

// ============================
// SPIN DASH
// ============================
function spinRectsOverlap(a, b) {
    const ab = fighterBounds(a,b.x+b.width/2), bb = fighterBounds(b,a.x+a.width/2);
    const geo = ab.x < bb.x + bb.w && ab.x + ab.w > bb.x && ab.y < bb.y + bb.h && ab.y + ab.h > bb.y;
    if (!geo) return false;
    const rectA={x:ab.x,y:ab.y,w:ab.w,h:ab.h};
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
    if (receiver.leafShield?.interceptSpin?.(fighterBounds(attacker, receiver.x))) {
        attacker.finishSpinDash(true);
        playSound(hitAudio);
        return;
    }
    if (receiver.handleMeleeVsEddie?.(fighterBounds(attacker,receiver.x),attacker)) {
        attacker.finishSpinDash(true);
        return;
    }
    if (!spinRectsOverlap(attacker, receiver)) return;

    // Spin vs Spin se resuelve aparte para que no se convierta en dos golpes normales.
    if (receiver.isSpinDashActive) return;

    const level = attacker.spinChargeLevel;
    const direction = attacker.spinDirection;
    const baseDamage = attacker.getSpinStat('damage');
    const horizontalForce = attacker.getSpinStat('knockbackX');
    const verticalForce = attacker.getSpinStat('knockbackY');
    const finalDamage = Math.max(1, Math.round(baseDamage * attacker.spinImpactMultiplier));

    const wasGuarding = receiver.isGuarding && receiver.guardType;
    dealDamage(receiver, finalDamage, {
        attacker,
        attackName: wasGuarding ? (attacker.spinMaxImpact ? 'Spin Dash bloqueado - Impacto Max' : 'Spin Dash bloqueado') : `Spin Dash Nv.${level}`,
        damageCategory: 'spin-dash',
        guardMultiplier: attacker.spinMaxImpact ? 0.50 : 0.10,
        impactX: attacker.x + attacker.width / 2,
        bypassLeaf: true
    });
    if (receiver.lastGuardImpact?.front) {
        attacker.finishSpinDash(true);
        attacker.sonicSpinHits = 0;
        return;
    } else {
        receiver.vx = direction * horizontalForce;
        receiver.vy = verticalForce;
        receiver.isGrounded = false;
        receiver.wasInAirFromKnockback = true;
        receiver.knockbackAirTimer = 0;
    }


    // Sonic Nv.3 es la excepcion: puede conectar hasta 3 pasadas.
    if (['sonic', 'metal-sonic'].includes(attacker.characterId) && level === 3) {
        const now = combatNow();
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
    if (!espioSprite3.complete) return;
    const cells = attacker.getTongueRects?.() ?? [];

    const cameraX = game.cameraX;
    const bounds = fighterBounds(receiver,attacker.x+attacker.width/2);
    const rx = bounds.x - cameraX;
    const ry = bounds.y;
    const rw = bounds.w;
    const rh = bounds.h;
    const STEP = 4;

    for (const cell of cells) {
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
    if (receiver.characterId === 'knuckles' &&
        (receiver.minerPhase === 'under' || receiver.minerPhase === 'warning')) return;

    const {x:rx,y:ry,w:rw,h:rh} = fighterBounds(receiver,bullet.owner.x+bullet.owner.width/2);

    const bx = bullet.x;
    const by = bullet.y;
    const bw = bullet.width;
    const bh = bullet.height;

    const hitsShield = receiver.shieldIntersects?.({ x: bx, y: by, w: bw, h: bh });
    if (!hitsShield && !(bx < rx + rw && bx + bw > rx && by < ry + rh && by + bh > ry)) return;
    if (!hitsShield && typeof receiver.pixelBodyIntersectsRect === 'function' &&
        !receiver.pixelBodyIntersectsRect({x:bx,y:by,w:bw,h:bh}, bullet.owner.x + bullet.owner.width/2)) return;

    applyBulletDamage(bullet, receiver);
}

// ============================
// APLICAR DAÑO DE BALA (ACTUALIZADO)
// ============================
export function applyBulletDamage(bullet, receiver) {
    if (receiver.isSpinDashActive) {
        const handled = resolveSpinVsProjectile(receiver, bullet);
        if (handled || !bullet.active) return;
    }

    const damage = dealDamage(receiver, bullet.damage, { attacker: bullet.owner, attackName: 'Bass Buster', basicShot: true, impactX: bullet.x + bullet.width / 2, projectile: true, hitRect: { x: bullet.x, y: bullet.y, w: bullet.width, h: bullet.height } });
    bullet.active = false;
    if (damage <= 0 || receiver.lastGuardImpact?.blocked || receiver.lastGuardImpact?.broken) return;

    const now = combatNow();
    const hits = (receiver.bassBulletHitTimes || []).filter(at => now - at < 4000);
    hits.push(now);
    receiver.bassBulletHitTimes = hits;

    // Dirección del knockback basada en la velocidad horizontal de la bala
    const dir = (bullet.vx > 0) ? 1 : (bullet.vx < 0) ? -1 : (bullet.direction || 1);

    if (hits.length >= 6) {
        hits.length = 0;
        receiver.vx = dir * 12;
        receiver.vy = -8;
        receiver.isGrounded = false;
        receiver.wasInAirFromKnockback = true;
        receiver.knockbackAirTimer = 0;
        receiver.isVulnerable = true;
        receiver.vulnerableTimer = 30;
    } else if (!receiver.wasInAirFromKnockback) {
        receiver.vx = dir * 2.5;
    }

    playSound(hitAudio);
}

// ============================
// BALAS VS PROYECTILES
// ============================
export function checkBulletsVsProjectiles() {
    const targets = game.projectiles.filter(projectile => projectile.active && projectile.hp > 0);
    for (const obstacle of targets) {
        for (const shot of [...game.projectiles, ...game.bassBullets]) {
            if (!obstacle.active || !shot.active || shot.owner === obstacle.owner || shot.hp != null || !rectsOverlap(shot, obstacle)) continue;
            obstacle.hp -= shot.damage ?? 3;
            shot.active = false;
            if (obstacle.hp <= 0) obstacle.active = false;
        }
    }
    for (const proj of game.projectiles) {
        if (!proj.active) continue;
        if (proj.type === 'shuriken' || (proj.type === 'buster-rock-3' || proj.type === 'buster-zero-3')) {
            for (const bullet of game.bassBullets) {
                if (!bullet.active || bullet.owner === proj.owner) continue;
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
