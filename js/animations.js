// ========================================
// DEFINICIÓN DE ANIMACIONES
// ========================================

import {
    bassIntro, bassIdle,
    bassShootHor, bassShootDiaAbajo, bassShootDiaArriba, bassShootArriba,
    bassJump, bassHurt, bassHurtHard, bassDash, bassCaminar,
    trebleIntro, trebleIdle, trebleCaminar, trebleJump, trebleCorrer, trebleBison
} from './assets.js';

export const SCALE = 3;             // Bass ×3
export const TREBLE_SCALE = 2;      // Reducido un nivel desde x3.

// ========================================
// ANIMACIONES DE BASS
// ========================================

export const ANIMATIONS = {
    intro: {
        img: bassIntro, frameW: 52, frameH: 159,
        totalFrames: 22, sequence: Array.from({length: 22}, (_, i) => i),
        totalDuration: 2000, loop: false
    },
    idle: {
        img: bassIdle, frameW: 52, frameH: 159,
        totalFrames: 4, sequence: [0, 1, 2, 3],
        totalDuration: 1000, loop: true
    },
    shootHor: {
        img: bassShootHor, frameW: 48, frameH: 48,
        totalFrames: 3, sequence: [0, 1, 2], totalDuration: 100, loop: false
    },
    shootDiaAbajo: {
        img: bassShootDiaAbajo, frameW: 48, frameH: 48,
        totalFrames: 3, sequence: [0, 1, 2], totalDuration: 100, loop: false
    },
    shootDiaArriba: {
        img: bassShootDiaArriba, frameW: 48, frameH: 48,
        totalFrames: 3, sequence: [0, 1, 2], totalDuration: 100, loop: false
    },
    shootArriba: {
        img: bassShootArriba, frameW: 48, frameH: 48,
        totalFrames: 3, sequence: [0, 1, 2], totalDuration: 100, loop: false
    },
    jump: {
        img: bassJump, frameW: 48, frameH: 64,
        totalFrames: 4, sequence: [0, 1, 2, 3],
        frameDurations: [100, 0, 100, 0], loop: false
    },
    hurt: {
        img: bassHurt, frameW: 48, frameH: 64,
        totalFrames: 4, sequence: [0, 1, 2, 3], totalDuration: 1000, loop: true
    },
    hurtHard: {
        img: bassHurtHard, frameW: 48, frameH: 64,
        totalFrames: 9, sequence: [0,1,2,3,4,5,6,7,8], totalDuration: 1500, loop: true
    },
    dash: {
        img: bassDash, frameW: 64, frameH: 48,
        totalFrames: 5, sequence: [0, 1, 2, 3, 4],
        frameDurations: [100, 50, 50, 0, 50], loop: false
    },
    walk: {
        img: bassCaminar, frameW: 64, frameH: 48,
        totalFrames: 14, sequence: Array.from({length: 14}, (_, i) => i),
        totalDuration: 1000, loop: true    // 1 segundo, doble velocidad
    }
};

// ========================================
// ANIMACIONES DE TREBLE
// ========================================

export const TREBLE_ANIMATIONS = {
    intro: {
        img: trebleIntro, frameW: 64, frameH: 96,
        totalFrames: 5, sequence: [0, 1, 2, 3, 4],
        totalDuration: 300, loop: false
    },
    idle: {
        img: trebleIdle, frameW: 97, frameH: 48,
        totalFrames: 2, sequence: [0, 1],
        totalDuration: 2000, loop: true
    },
    caminar: {
        img: trebleCaminar, frameW: 97, frameH: 48,
        totalFrames: 6, sequence: [0, 1, 2, 3, 4, 5],
        totalDuration: 1000, loop: true    // 1 segundo, doble velocidad
    },
    // ⭐ CORREGIDO: 768 / 8 = 96 (8 frames)
    jump: {
        img: trebleJump, frameW: 96, frameH: 64,
        totalFrames: 8, sequence: [0, 1, 2, 3, 4, 5, 6, 7],
        loop: false
    },
    correr: {
        img: trebleCorrer, frameW: 97, frameH: 48,
        totalFrames: 6, sequence: [0, 1, 2, 3, 4, 5],
        totalDuration: 1000, loop: true
    },
    bison: {
        img: trebleBison, frameW: 167, frameH: 53,
        totalFrames: 7, sequence: [0, 1, 2, 3, 4, 5, 6],
        loop: false
    }
};

// ========================================
// HELPERS DE DIBUJO
// ========================================

export function drawBassFrame(ctx, animKey, frameIndex, pivotX, pivotY, facingLeft, characterScale = 1) {
    const anim = ANIMATIONS[animKey];
    if (!anim) return;
    if (!anim.img.complete || anim.img.naturalWidth === 0) return;

    const seqIdx = frameIndex % anim.sequence.length;
    const realFrame = anim.sequence[seqIdx];
    const sx = realFrame * anim.frameW;
    const sy = 0;
    const sw = anim.frameW;
    const sh = anim.frameH;
    const renderW = anim.frameW * SCALE * characterScale;
    const renderH = anim.frameH * SCALE * characterScale;
    const drawX = pivotX - renderW / 2;
    const drawY = pivotY - renderH;

    if (facingLeft) {
        ctx.save();
        ctx.translate(pivotX + renderW / 2, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(anim.img, sx, sy, sw, sh, 0, drawY, renderW, renderH);
        ctx.restore();
    } else {
        ctx.drawImage(anim.img, sx, sy, sw, sh, drawX, drawY, renderW, renderH);
    }
}

export function drawTrebleAnimFrame(ctx, animKey, frameIndex, pivotX, pivotY, facingLeft) {
    const anim = TREBLE_ANIMATIONS[animKey];
    if (!anim) return;
    if (!anim.img.complete || anim.img.naturalWidth === 0) return;

    const seqIdx = frameIndex % anim.sequence.length;
    const realFrame = anim.sequence[seqIdx];
    const sx = realFrame * anim.frameW;
    const sy = 0;
    const sw = anim.frameW;
    const sh = anim.frameH;
    const renderW = anim.frameW * TREBLE_SCALE;
    const renderH = anim.frameH * TREBLE_SCALE;
    const drawX = pivotX - renderW / 2;
    const drawY = pivotY - renderH;

    if (facingLeft) {
        ctx.save();
        ctx.translate(pivotX + renderW / 2, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(anim.img, sx, sy, sw, sh, 0, drawY, renderW, renderH);
        ctx.restore();
    } else {
        ctx.drawImage(anim.img, sx, sy, sw, sh, drawX, drawY, renderW, renderH);
    }
}

export function getAnimationFrame(animKey, elapsedMs, phaseOverride = null) {
    const anim = ANIMATIONS[animKey];
    if (!anim) return 0;

    if (animKey === 'jump' && phaseOverride !== null) {
        if (phaseOverride === 'up') {
            if (elapsedMs < 100) return 0;
            return 1;
        } else {
            if (elapsedMs < 100) return 2;
            return 3;
        }
    }

    if (animKey === 'dash') {
        if (elapsedMs < 100) return 0;
        if (elapsedMs < 150) return 1;
        if (elapsedMs < 200) return 2;
        return 3;
    }

    if (anim.loop && anim.totalDuration) {
        const frameDuration = anim.totalDuration / anim.sequence.length;
        const loopedTime = elapsedMs % anim.totalDuration;
        return Math.floor(loopedTime / frameDuration);
    }

    if (anim.totalDuration) {
        const frameDuration = anim.totalDuration / anim.sequence.length;
        const idx = Math.floor(elapsedMs / frameDuration);
        return Math.min(idx, anim.sequence.length - 1);
    }

    return 0;
}
