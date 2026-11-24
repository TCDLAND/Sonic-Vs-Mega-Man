import { drawCombatHud, tickReserveHealth } from './combat-hud.js';
import { pollXboxPads } from './xbox-pad.js';
import { tickAssistKeys } from './input.js?v=online-3v3-2';
import { drawTeamAssists, tickTeamAssists, interceptTeamAssist } from './team-assists.js';
import { drawWind, emitWind } from './wind-effects.js';
import { pollStagePad } from './battle-stages.js';
import { tickSonicWalk, drawMetalDialogue } from './sonic-chapter.js';
import { music } from './music.js';
import { tickAdventure } from './story-platform.js';
import { drawEggAssists, updateEggAssists } from './eggman.js';
import { drawSilverAssists, updateSilverAssists, handleSilverAssistShot } from './silver.js';
import { drawChaosChoices } from './chaos.js';
import { combatNow, setSimulatedCombatTime } from './combat-clock.js';
// ========================================
// PUNTO DE ENTRADA Y GAME LOOP
// ========================================

import { worldWidth, GAME_STATE } from './config.js';
import { game, ctx, canvas, tongueCtx } from './state.js';
import { storyStage, showStoryResult, pollStoryPad } from './story-mode.js';
import { bgImage, trebleSprite1, bassSprite3 } from './assets.js';
import { drawSelectionScreen } from './selection.js';
import { drawCountdown, drawModeScreen, drawResultScreen } from './menu-screen.js?v=online-3v3-2';
import { setupInput } from './input.js?v=online-3v3-2';
import { switchTeamFighter } from './battle.js?v=team3-1';
import { getCellCoords } from './utils.js';
import { drawTrebleFrame, TREBLE_BULLET_IMPACT_A, TREBLE_BULLET_IMPACT_B } from './bass.js';
import { dealDamage, DEBUG_COMBAT } from './combat-system.js';
import { tournamentSimulationActive, tournamentSimulationPaused, tournamentResult, interruptTournamentSimulation } from './tournament.js';
import { HIGHWAY_WALLS, landOnStagePlatform } from './wall-system.js';
import { checkSonicDashAttack, checkSonicRocketAttack } from './sonic.js';
import {
    checkJabCollision, checkHeavyCollision,
    checkKickLightCollision, checkKickHeavyCollision,
    checkSpinDashCollision, checkSpinVsSpin, resolveSpinVsProjectile, checkTongueCollision,
    checkBassBulletCollision, checkBulletsVsProjectiles
, checkZeroSaberCollision } from './collisions.js';

function projectileOpponent(owner, p1, p2) {
    if (owner === p1 || game.teamFighters?.p1.includes(owner)) return p2;
    if (owner === p2 || game.teamFighters?.p2.includes(owner)) return p1;
    return null;
}

function separateGroundedFighters(p1, p2, now) {
    for (const fighter of [p1, p2]) {
        if (!fighter.isGrounded || fighter.isIntroActive || fighter.tagLockedUntil > now ||
            fighter.isDashing || fighter.state === 'dash' || fighter.isSpinDashActive ||
            fighter.shadowTeleportPhase || fighter.shadowFrozenBy || fighter.grabConnected ||
            fighter.minerPhase || fighter.brakeActive || fighter.reverseBrakeActive) return;
    }
    if (Math.abs(p1.y + p1.height - p2.y - p2.height) > 20) return;
    let left = p1, right = p2;
    if (p1.x + p1.width / 2 > p2.x + p2.width / 2) [left, right] = [right, left];
    const distance = right.x + right.width / 2 - left.x - left.width / 2;
    const overlap = (left.width + right.width) * .20 - distance;
    if (overlap <= 0) return;
    const [leftWall, rightWall] = HIGHWAY_WALLS;
    const leftSpace = Math.max(0, left.x - leftWall.x);
    const rightSpace = Math.max(0, rightWall.x - right.width - right.x);
    const pushLeft = Math.min(leftSpace, Math.max(overlap / 2, overlap - rightSpace));
    left.x -= pushLeft;
    right.x += Math.min(rightSpace, overlap - pushLeft);
}

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

        const target = projectileOpponent(bullet.owner, p1, p2);
        if (target && bullet.active && !target.handleProjectileVsEddie?.(bullet)) {
            const ry = target.getCurrentY();
            const rh = target.getCurrentHeight();
            if (
                bullet.x < target.x + target.width &&
                bullet.x + bullet.width > target.x &&
                bullet.y < ry + rh &&
                bullet.y + bullet.height > ry
            ) {
                if (bullet.charged && !target.isGuarding) {
                    bullet.effectActive = true;
                    bullet.effectTimer = 0;
                    bullet.vx = 0;
                    bullet.vy = 0;
                    bullet.capturedTarget = target;
                    bullet.captureTimer = 120;
                    target.isVulnerable = true;
                    target.vulnerableTimer = 120;
                } else {
                    dealDamage(target, bullet.damage, { attacker: bullet.owner, attackName: bullet.charged ? 'Treble cargado' : 'Treble disparo', impactX: bullet.x + bullet.width / 2, projectile: true });
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
            const frameNum = 28 + (Math.floor(combatNow() / 80) % 3);
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
        const target = projectileOpponent(treble.owner, p1, p2);
        if (!target) return;
        treble.update(target.x);
        if (treble.contactCooldown > 0) return;

        const body = target.getCurrentBounds?.(treble.x) || {x:target.x,y:target.getCurrentY(),w:target.width,h:target.getCurrentHeight()};
        const tx = body.x, ty = body.y, tw = body.w, th = body.h;

        const cx = treble.x - treble.width / 2;
        const cy = treble.feetY - treble.height;
        const cw = treble.width;
        const ch = treble.height;

        if (cx < tx + tw && cx + cw > tx && cy < ty + th && cy + ch > ty) {
            if (treble.state === "following") {
                dealDamage(target, 3, { attacker: treble.owner, attackName: 'Treble contacto', impactX: treble.x });
                treble.contactCooldown = 60;
            } else if (treble.state.startsWith("attack")) {
                dealDamage(target, 10, { attacker: treble.owner, attackName: 'Treble ataque', impactX: treble.x });
                if (!target.lastGuardImpact?.front) {
                    const dir = treble.direction;
                    target.vx = dir * 12;
                    target.vy = -8;
                    target.isGrounded = false;
                    target.wasInAirFromKnockback = true;
                    target.knockbackAirTimer = 0;
                }

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
function updateCountdown(now) {
    const countdown = game.countdown;
    if (!countdown) return;
    if (countdown.phase === 'waiting') {
        const p1Ready = !game.p1.isIntroActive && game.p1.state !== 'intro';
        const p2Ready = !game.p2.isIntroActive && game.p2.state !== 'intro';
        if (p1Ready && p2Ready) {
            countdown.phase = '3';
            countdown.phaseStartedAt = now;
        }
        return;
    }
    if (countdown.phase === 'go') return;
    if (countdown.phase === '0') {
        if (now - countdown.phaseStartedAt >= 550) countdown.phase = 'go';
        return;
    }
    if (now - countdown.phaseStartedAt >= 850) {
        countdown.phase = countdown.phase === '3' ? '2' : countdown.phase === '2' ? '1' : '0';
        countdown.phaseStartedAt = now;
    }
}

function drawTagEffects(now) {
    game.tagEffects = game.tagEffects.filter((effect) => now - effect.startedAt < effect.duration);
    for (const effect of game.tagEffects) {
        const progress = Math.max(0, Math.min(1, (now - effect.startedAt) / effect.duration));
        const outgoing = progress < .42;
        const phase = outgoing ? progress / .42 : (progress - .42) / .58;
        const start = outgoing ? effect.oldX : effect.edgeX;
        const end = outgoing ? effect.edgeX : effect.targetX;
        const worldX = start + (end - start) * phase;
        const x = worldX - game.cameraX;
        const y = 600 - 78;
        if (outgoing && !effect.knockout && effect.outgoing) {
            const rival = game[effect.side === 'p1' ? 'p2' : 'p1'];
            ctx.save();
            ctx.globalAlpha = 1-phase;
            ctx.translate(worldX-effect.outgoing.x,0);
            effect.outgoing.draw(rival.x);
            ctx.restore();
        }
        const color = effect.side === 'p1' ? '#28aaff' : '#ff3e65';
        ctx.save();
        ctx.shadowColor = color;
        ctx.shadowBlur = effect.style === 'spin' ? 22 : 35;
        if (effect.style === 'spin') {
            ctx.strokeStyle = color;
            ctx.lineWidth = 8;
            for (let i = 0; i < 3; i++) {
                ctx.beginPath();
                ctx.ellipse(x, y, 48 + i * 14, 18 + i * 8, phase * Math.PI * 3 + i, 0, Math.PI * 2);
                ctx.stroke();
            }
            ctx.fillStyle = '#fff';
            ctx.beginPath(); ctx.arc(x, y, 16, 0, Math.PI * 2); ctx.fill();
        } else {
            const beamW = 32 + Math.sin(now / 28) * 8;
            const beam = ctx.createLinearGradient(0, 0, 0, 600);
            beam.addColorStop(0, 'rgba(255,255,255,0)');
            beam.addColorStop(.72, `${color}aa`);
            beam.addColorStop(1, '#fff');
            ctx.globalAlpha = .88 - progress * .28;
            ctx.fillStyle = beam;
            ctx.fillRect(x - beamW / 2, 0, beamW, 600);
            ctx.fillStyle = '#fff';
            ctx.fillRect(x - 4, 0, 8, 600);
        }
        ctx.restore();
    }
}

function drawChaosFrozen(fighter, opponentX) {
    const snapshot = fighter.shadowFrozenVisual;
    const f = snapshot?.frame;
    if (!snapshot || !f?.img?.complete || !f.img.naturalWidth) {
        fighter.draw(opponentX);
        return;
    }
    const dx = f.dx - game.cameraX;
    ctx.save(); ctx.imageSmoothingEnabled = false;
    if (f.flipX) {
        ctx.translate(dx + f.dw, 0); ctx.scale(-1, 1);
        ctx.drawImage(f.img, f.sx, f.sy, f.sw, f.sh, 0, f.dy, f.dw, f.dh);
    } else ctx.drawImage(f.img, f.sx, f.sy, f.sw, f.sh, dx, f.dy, f.dw, f.dh);
    ctx.restore();
}

const guardSpriteBounds = new WeakMap();

function getVisibleSpriteRatios(frame) {
    if (!frame?.img || !frame.sw || !frame.sh || !frame.img.complete || !frame.img.naturalWidth) {
        return { left: 0, right: 1, top: 0, bottom: 1 };
    }
    let frames = guardSpriteBounds.get(frame.img);
    if (!frames) { frames = new Map(); guardSpriteBounds.set(frame.img, frames); }
    const key = `${frame.sx}:${frame.sy}:${frame.sw}:${frame.sh}`;
    if (frames.has(key)) return frames.get(key);
    let bounds = { left: 0, right: 1, top: 0, bottom: 1 };
    try {
        const probe = document.createElement('canvas'); probe.width = frame.sw; probe.height = frame.sh;
        const probeCtx = probe.getContext('2d', { willReadFrequently: true });
        probeCtx.drawImage(frame.img, frame.sx, frame.sy, frame.sw, frame.sh, 0, 0, frame.sw, frame.sh);
        const alpha = probeCtx.getImageData(0, 0, frame.sw, frame.sh).data;
        let left = frame.sw, right = 0, top = frame.sh, bottom = 0;
        for (let y = 0; y < frame.sh; y++) for (let x = 0; x < frame.sw; x++) {
            if (alpha[(y * frame.sw + x) * 4 + 3] > 20) {
                left = Math.min(left, x); right = Math.max(right, x + 1);
                top = Math.min(top, y); bottom = Math.max(bottom, y + 1);
            }
        }
        if (right > left && bottom > top) bounds = {
            left: left / frame.sw, right: right / frame.sw,
            top: top / frame.sh, bottom: bottom / frame.sh
        };
    } catch { /* unavailable pixel data falls back to the frame rectangle */ }
    frames.set(key, bounds);
    return bounds;
}

function drawGuardEffects(...fighters) {
    const now = combatNow();
    for (const fighter of fighters) {
        const breaking = (fighter.guardBreakFlashUntil || 0) > now;
        const blockingImpact = (fighter.guardFlashUntil || 0) > now;
        if (!breaking && !blockingImpact) continue;
        const rival = fighter === game.p1 ? game.p2 : game.p1;
        const direction = fighter.characterId === 'bass'
            ? (fighter.facingLeft ? -1 : 1)
            : (fighter.facingDirection || 1);
        const frame = fighter.getPixelBodyFrame?.(rival?.x + (rival?.width || 0) / 2);
        const ratios = getVisibleSpriteRatios(frame);
        let left = fighter.x, right = fighter.x + fighter.width;
        let top = fighter.getCurrentY(), bottom = top + fighter.getCurrentHeight();
        if (frame) {
            const sourceLeft = frame.flipX ? 1 - ratios.right : ratios.left;
            const sourceRight = frame.flipX ? 1 - ratios.left : ratios.right;
            left = frame.dx + sourceLeft * frame.dw;
            right = frame.dx + sourceRight * frame.dw;
            top = frame.dy + ratios.top * frame.dh;
            bottom = frame.dy + ratios.bottom * frame.dh;
        }
        const visibleWidth = Math.max(12, right - left), visibleHeight = Math.max(24, bottom - top);
        const frontEdge = direction > 0 ? right : left;
        const x = frontEdge - game.cameraX + direction * 2;
        const y = top + visibleHeight * (fighter.guardType === 'low' ? .76 : .48);
        const rx = Math.max(10, Math.min(22, visibleWidth * .12));
        const ry = Math.max(18, Math.min(48, visibleHeight * (fighter.guardType === 'low' ? .24 : .31)));
        ctx.save(); ctx.lineWidth = breaking ? 4 : 3;
        const arcStart = direction > 0 ? -Math.PI / 2 : Math.PI / 2;
        const arcEnd = direction > 0 ? Math.PI / 2 : Math.PI * 1.5;
        if (breaking) {
            ctx.strokeStyle = 'rgba(255,91,111,.98)';
            for (let shard = 0; shard < 5; shard++) {
                const offset = (shard - 2) * ry * .34;
                ctx.beginPath(); ctx.moveTo(x, y + offset);
                ctx.lineTo(x + direction * (rx + 8), y + offset - (shard % 2 ? 10 : -10)); ctx.stroke();
            }
        } else {
            ctx.fillStyle = 'rgba(93,205,255,.18)'; ctx.strokeStyle = 'rgba(156,232,255,.96)';
            ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, arcStart, arcEnd); ctx.closePath(); ctx.fill(); ctx.stroke();
        }
        ctx.restore();
    }
}

function isTagArrivalHidden(side, fighter, now) {
    return game.tagEffects.some((effect) => effect.side === side && effect.enteringId === fighter.characterId &&
        now - effect.startedAt < effect.duration * .66);
}

function drawOffscreenFighter(fighter, color) {
    const center = fighter.x + fighter.width / 2 - game.cameraX;
    if (center >= 0 && center <= canvas.width) return;
    const onLeft = center < 0;
    const x = onLeft ? 14 : canvas.width - 14;
    const y = Math.max(165, Math.min(canvas.height - 85, fighter.y + fighter.height * .55));
    ctx.save();
    ctx.font = '800 14px system-ui';
    ctx.textAlign = onLeft ? 'left' : 'right';
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#101627';
    ctx.fillStyle = color;
    const label = onLeft ? `◀ ${fighter.characterName}` : `${fighter.characterName} ▶`;
    ctx.strokeText(label, x, y);
    ctx.fillText(label, x, y);
    ctx.restore();
}

function gameLoop(time = performance.now(), render = true) {
    if (render) {
        music.tick(time);
        pollStoryPad();
        pollStagePad();
    }
    if (game.paused) {
        return;
    }
    if (render) ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (game.gameState === GAME_STATE.MODE) {
        drawModeScreen();
    }
    else if (game.gameState === GAME_STATE.SELECT) {
        drawSelectionScreen();
    }
    else if (game.gameState === GAME_STATE.SONIC_WALK) tickSonicWalk(time);
    else if (game.gameState === GAME_STATE.ADVENTURE) tickAdventure(time);
    else if (game.gameState === GAME_STATE.BATTLE) {
        let p1 = game.p1;
        let p2 = game.p2;
        window.__GAME_P1__ = p1; window.__GAME_P2__ = p2;
        window.__CPU_AGENT_P1__ = game.cpuAgentP1;
        window.__CPU_AGENT_P2__ = game.cpuAgentP2 || game.cpuAgent;

        const blueCenter = p1.x + p1.width / 2;
        const redCenter = p2.x + p2.width / 2;
        let targetCameraX = (blueCenter + redCenter - canvas.width) / 2;
        if (game.mode === 'cpu' || game.mode === 'team') {
            const margin = 95;
            targetCameraX = Math.max(blueCenter - canvas.width + margin, Math.min(blueCenter - margin, targetCameraX));
        }
        const puddles=[p1.special,p2.special].find(move=>move?.key==='special_three_puddles');
        if(puddles)targetCameraX=puddles.anchor-canvas.width/2;
        let maxCameraX = worldWidth - canvas.width;
        if (targetCameraX < 0) targetCameraX = 0;
        if (targetCameraX > maxCameraX) targetCameraX = maxCameraX;
        game.cameraX += (targetCameraX - game.cameraX) * 0.1;

        const stageImage = storyStage || game.battleStage?.image || bgImage;
        if (render && stageImage.complete && stageImage.naturalWidth) {
            const sx = stageImage.naturalWidth / worldWidth;
            ctx.drawImage(stageImage, game.cameraX * sx, 0, canvas.width * sx, stageImage.naturalHeight,
                0, 0, canvas.width, canvas.height);
        }

        // Chaos Control congela al rival; el propio Shadow sigue activo.
        const formTime = combatNow();
        for (const fighter of game.teamFighters ? [...game.teamFighters.p1,...game.teamFighters.p2] : [p1,p2]) {
            if (fighter.superEndsAt != null && formTime >= fighter.superEndsAt) fighter.endSuperForm();
        }
        const oldFeet=[p1.y+p1.height,p2.y+p2.height];
        const grabbedBy = (target, opponent) => opponent.grabConnected &&
            !opponent.grabThrown && opponent.grabTarget === target;
        if (!p1.shadowFrozenBy && !grabbedBy(p1, p2)) p1.update(p2.x, p1);
        if (!p2.shadowFrozenBy && !grabbedBy(p2, p1)) p2.update(p1.x, p2);
        if (game.mode !== 'story' && game.battleStage?.platforms) {
            if (!p1.shadowFrozenBy && !p1.isIntroActive && !grabbedBy(p1,p2))
                landOnStagePlatform(p1,oldFeet[0],game.battleStage.platforms);
            if (!p2.shadowFrozenBy && !p2.isIntroActive && !grabbedBy(p2,p1))
                landOnStagePlatform(p2,oldFeet[1],game.battleStage.platforms);
        }
        const now = combatNow();
        tickAssistKeys(now);
        p1 = game.p1; p2 = game.p2;
        tickReserveHealth(now);
        updateCountdown(now);
        const canFight = game.countdown?.phase === '0' || game.countdown?.phase === 'go';
        if (canFight && game.roundSeconds !== null && game.roundEndsAt === null) {
            game.roundEndsAt = now + game.roundSeconds * 1000;
        }
        const remaining = game.roundEndsAt === null ? game.roundSeconds :
            Math.max(0,Math.ceil((game.roundEndsAt - now) / 1000));
        game.cpuAgentP1?.update(p2, p1, canFight);
        game.cpuAgentP2?.update(p1, p2, canFight);
        if (game.teamFighters) {
            for (const side of ['p1', 'p2']) {
                if (!game.tagRequests[side]) continue;
                game.tagRequests[side] = false;
                switchTeamFighter(side);
            }
            p1 = game.p1; p2 = game.p2;
            window.__GAME_P1__ = p1; window.__GAME_P2__ = p2;
        }
        if(p1.shadowFrozenBy||p2.shadowFrozenBy){
            // Los proyectiles se pausaran durante el bucle de congelacion.
        }
        if (canFight) separateGroundedFighters(p1, p2, now);
        // Concrete: resolver física de ambos luchadores con silueta de idle fija.
        for(const r of [p1,p2])if(['rock','wily'].includes(r?.characterId)||r?.rockCopyEnabled)for(const fighter of [p1,p2]){
          if(fighter!==r||r.characterId==='wily')r.resolveConcreteBody?.(fighter);
        }

        if (!p1.shadowFrozenBy && !p2.shadowFrozenBy) {
            game.projectiles.forEach(proj => proj.update());
            game.bassBullets.forEach(bullet => bullet.update());
            checkBulletsVsProjectiles();
        }
        updateSilverAssists();
        if (canFight && !p1.shadowFrozenBy && !p2.shadowFrozenBy) { updateEggAssists(); tickTeamAssists(); }
        game.projectiles.forEach((proj) => {
            if (!proj.active) return;
            if (render) proj.draw(game.cameraX);
            if (proj.collisionDisabled) return;
            const target = projectileOpponent(proj.owner, p1, p2);
            if (target && (handleSilverAssistShot(proj,target) || interceptTeamAssist(proj,target) || target.interceptSilverShot?.(proj))) return;
            if (!target || target.handleProjectileVsEddie?.(proj) || target.handleProjectileVsConcrete?.(proj)) return;
            const targetBounds = target.getCurrentBounds?.(proj.owner.x + proj.owner.width / 2) || {x:target.x,y:target.getCurrentY(),w:target.width,h:target.getCurrentHeight()};
            const targetY = targetBounds.y, targetH = targetBounds.h;
            const projectilePixelHit = typeof proj.pixelHitsTarget === 'function'
                ? proj.pixelHitsTarget(target)
                : (typeof target.pixelBodyIntersectsRect !== 'function' ||
                   target.pixelBodyIntersectsRect({x:proj.x,y:proj.y,w:proj.width,h:proj.height}, proj.owner.x + proj.owner.width/2));
            const hitRect = { x: proj.x, y: proj.y, w: proj.width, h: proj.height };
            const hitsShield = target.shieldIntersects?.(hitRect);
            if (proj.active && !proj.hitFighters?.has(target) && (hitsShield || (proj.x < targetBounds.x + targetBounds.w && proj.x + proj.width > targetBounds.x &&
                proj.y < targetY + targetH && proj.y + proj.height > targetY && projectilePixelHit))) {
                if (target.blocksProjectile?.()) { proj.active = false; return; }
                if (target.isSpinDashActive && resolveSpinVsProjectile(target, proj)) return;
                dealDamage(target, proj.damage, { attacker: proj.owner, attackName: proj.type || 'Proyectil', element: proj.element, basicShot: proj.basicShot, impactX: proj.x + proj.width / 2, projectile: true, hitRect });
                if (target.lastGuardImpact?.shield) { proj.active=false; return; }
                proj.hitFighters?.add(target);
                const keepOnImpact = proj.onHit?.(target) === false;
                const keep = proj.hitFighters || keepOnImpact;
                if (!keep) proj.active = false;
            }
        });

        game.bassBullets.forEach((bullet) => {
            if (!bullet.active) return;
            if (render) bullet.draw(game.cameraX);
            const target = projectileOpponent(bullet.owner, p1, p2);
            if (target && (handleSilverAssistShot(bullet,target) || interceptTeamAssist(bullet,target) || target.interceptSilverShot?.(bullet))) return;
            if (!target || target.handleProjectileVsEddie?.(bullet) || target.handleProjectileVsConcrete?.(bullet)) return;
            checkBassBulletCollision(bullet, target);
        });

        if(!p1.shadowFrozenBy&&!p2.shadowFrozenBy){updateTrebles(p1,p2);updateTrebleBullets(p1,p2);}

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

        // Cualquier ataque directo bloqueado conserva el chip damage y corta su empuje.
        for (const fighter of [p1, p2]) if (fighter.guardImpactPending) {
            fighter.guardImpactPending = false;
            fighter.vx = 0; fighter.vy = 0; fighter.isGrounded = true;
            fighter.wasInAirFromKnockback = false; fighter.knockbackAirTimer = 0;
            fighter.isVulnerable = false; fighter.vulnerableTimer = 0;
        }

        let waitingForReplacement = false;
        if (game.teamFighters) {
            for (const side of ['p1','p2']) {
                const fallen = game[side];
                if (fallen.health > 0 || !game.teamFighters[side].some(member=>member.health>0)) continue;
                fallen.koAt ??= now;
                for (const key of Object.keys(fallen.keys)) fallen.keys[key] = false;
                if (now-fallen.koAt < 420) waitingForReplacement = true;
                else switchTeamFighter(side, { knockout: true });
            }
            p1 = game.p1; p2 = game.p2;
            window.__GAME_P1__ = p1; window.__GAME_P2__ = p2;
        }

        if (render) {
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
            if (!isTagArrivalHidden('p1', p1, combatNow())) (p1.shadowFrozenBy ? drawChaosFrozen(p1,p2.x) : p1.draw(p1.getVisualOpponentX ? p1.getVisualOpponentX(p2.x) : p2.x));
            if (!isTagArrivalHidden('p2', p2, combatNow())) (p2.shadowFrozenBy ? drawChaosFrozen(p2,p1.x) : p2.draw(p2.getVisualOpponentX ? p2.getVisualOpponentX(p1.x) : p1.x));
        }
        // Tormenta fuera del radio, dibujada por encima del escenario.
        p1.drawChaosStorm?.();p2.drawChaosStorm?.();
        drawTrebles();
        drawTrebleBullets();
        drawTagEffects(combatNow());
        drawSilverAssists();
        drawEggAssists();
        drawTeamAssists();
        for (const fighter of [p1,p2]) {
            const dash=fighter.isDashing || fighter.isSpinDashActive || !!fighter.airDash;
            if (dash && !fighter.windWasDashing && Math.abs(fighter.vx)>3) {
                emitWind(fighter.isGrounded?'dust':'arc',fighter.x+fighter.width/2,
                    fighter.y+fighter.height,Math.sign(fighter.vx),1.4,.55);
            }
            fighter.windWasDashing=dash;
        }
        drawWind(ctx,game.cameraX);
        drawChaosChoices();

        if (DEBUG_COMBAT.enabled) {
            ctx.save(); ctx.font = '14px monospace'; ctx.textAlign = 'left';
            ctx.fillStyle = 'rgba(0,0,0,.72)'; ctx.fillRect(8, 8, 620, 58);
            ctx.fillStyle = '#fff'; ctx.fillText('DEBUG DAÑO', 18, 27);
            ctx.fillText(DEBUG_COMBAT.lastP1, 18, 45);
            ctx.fillText(DEBUG_COMBAT.lastP2, 18, 61); ctx.restore();
        }
        if (p2.characterId === 'cut' && p2.isIntroActive) {
                return;
        }


        drawCombatHud(now, remaining ?? '∞');
        for (const [fighter,x] of [[p1,34],[p2,916]]) if(fighter.characterId==='wily') {
            ctx.save();
            ctx.fillStyle='#161b2a';
            const y=game.teamFighters?153:130;
            ctx.fillRect(x-3,y-9,336,25);
            ctx.font='800 10px system-ui';
            for(const [index,[id,value]] of Object.entries(fighter.units).entries()) {
                const sx=x+index*111;
                const cap=fighter.unitMax[id];
                ctx.fillStyle='#373a48';ctx.fillRect(sx,y+5,105,4);
                ctx.fillStyle=id===fighter.robotId?'#ffd265':id===fighter.repairMaster?'#79e9ac':'#a7b7cc';
                ctx.fillRect(sx,y+5,105*value/cap,4);
                ctx.fillText((id===fighter.robotId?'▶ ':id===fighter.repairMaster?'+ ':'')+id.toUpperCase()+' '+Math.ceil(value)+'/'+cap,sx,y+1);
            }
            ctx.restore();
        }
        drawGuardEffects(p1,p2);
        drawOffscreenFighter(p1, '#a9ddff');
        drawOffscreenFighter(p2, '#ff9eb1');
        drawCountdown();
        if (canFight && game.mode !== 'online') {
            ctx.save();
            ctx.font = '700 12px system-ui';
            ctx.textAlign = 'center';
            ctx.fillStyle = '#e1efff';
            ctx.fillText('ESC · PAUSA', canvas.width / 2, 120);
            ctx.restore();
        }

        if (game.mode === 'story' && p2.infected) drawMetalDialogue();
        }
        const emerlRetreat = game.mode === 'story' && p2.characterId === 'emerl' &&
            p1.health > 0 && p2.health <= p2.maxHealth * .20;
        if (game.mode==='practice') {
            for(const fighter of [p1,p2]) if(fighter.health<=0) fighter.health=fighter.maxHealth;
        } else if (emerlRetreat || remaining === 0 || (!waitingForReplacement && (p1.health <= 0 || p2.health <= 0))) {
            const totalHealth = (side) => (game.teamFighters?.[side] || [game[side]])
                .reduce((total, fighter) => total + Math.round(Math.max(0, fighter.health) * 100), 0);
            const blue = totalHealth('p1'), red = totalHealth('p2');
            game.resultReason = remaining === 0 ? 'time' : 'ko';
            game.winner = emerlRetreat ? 'p1' : remaining === 0 ? (blue === red ? 'draw' : blue > red ? 'p1' : 'p2') : p1.health <= 0 && p2.health <= 0 ? 'draw' : p1.health <= 0 ? 'p2' : 'p1';
            const winner = game.winner === 'p1' ? p1 : game.winner === 'p2' ? p2 : null;
            game.winnerName = !winner ? 'EMPATE' : game.teamFighters
                ? (game.winner === 'p1' ? 'EQUIPO AZUL' : 'EQUIPO ROJO') : winner.characterName;
            const p1Won = game.winner === 'draw' ? null : game.winner === 'p1';
            const p2Won = game.winner === 'draw' ? null : game.winner === 'p2';
            game.cpuAgentP1?.finish(p1Won);
            game.cpuAgentP2?.finish(p2Won);
            for (const fighter of [p1, p2]) for (const key of Object.keys(fighter.keys)) fighter.keys[key] = false;
            game.countdown = null;
            if (game.mode === 'story') showStoryResult(game.winner === 'p1');
            else if (!tournamentResult(game.winner,game.resultReason)) game.gameState = GAME_STATE.RESULT;
        }
    }
    else if (game.gameState === GAME_STATE.RESULT) {
        drawResultScreen();
    }

    if (render && game.mode === 'online' && game.onlineStatus) {
        ctx.save();
        ctx.fillStyle = 'rgba(5,14,27,.84)';
        ctx.fillRect(380, 8, 520, 25);
        ctx.fillStyle = '#a7ffe5';
        ctx.font = '700 12px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText(game.onlineStatus, 640, 25, 500);
        ctx.restore();
    }

}

function frameDriver(time) {
    if (!tournamentSimulationActive()) pollXboxPads();
    if (!tournamentSimulationActive()) gameLoop(time);
    else if (!game.paused && !tournamentSimulationPaused() && !document.hidden) {
        const render=!game.quietSimulation;
        const deadline=performance.now()+(render?9:5);
        try {
            for(let i=0;i<(render?6:4) && tournamentSimulationActive();i++) {
                setSimulatedCombatTime(combatNow()+1000/60);
                gameLoop(time,render);
                if(performance.now()>=deadline) break;
            }
        } catch (error) {
            console.error('Error en el combate simulado',error);
            interruptTournamentSimulation(error);
        }
    }
    requestAnimationFrame(frameDriver);
}

setupInput();
requestAnimationFrame(frameDriver);
