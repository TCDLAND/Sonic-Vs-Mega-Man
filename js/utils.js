// ========================================
// HELPERS Y UTILIDADES
// ========================================

import { ctx } from './state.js';

// Audio Context global (uno solo para todo el juego)
let audioCtx = null;

function getAudioCtx() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioCtx;
}

// Reproducir audio con amplificación
// gainMultiplier por defecto = 5.0 (para audios de SNES)
export function playSound(audio, gainMultiplier = 5.0) {
    if (!audio) return;
    try {
        const actx = getAudioCtx();

        // Crear clon del audio para reproducir varias instancias a la vez
        const clone = audio.cloneNode(true);

        // Crear nodo fuente
        const source = actx.createMediaElementSource(clone);

        // Crear nodo de ganancia (amplificación)
        const gainNode = actx.createGain();
        gainNode.gain.value = gainMultiplier;

        // Conectar: source → gain → speakers
        source.connect(gainNode);
        gainNode.connect(actx.destination);

        clone.play().catch(() => {});
    } catch (e) {
        // Fallback sin Web Audio (por si falla)
        try {
            const clone = audio.cloneNode(true);
            clone.volume = 1.0;
            clone.play().catch(() => {});
        } catch (err) {}
    }
}

// Obtener coordenadas de una celda del sheet
export function getCellCoords(frameNumber, sheetW, sheetH, cols, rows) {
    const cellW = sheetW / cols;
    const cellH = sheetH / rows;
    const col = frameNumber % cols;
    const row = Math.floor(frameNumber / cols);
    return {
        sx: Math.floor(col * cellW),
        sy: Math.floor(row * cellH),
        sw: Math.ceil(cellW),
        sh: Math.ceil(cellH)
    };
}

// Dibujar array de celdas (multi-celda, con espejo)
export function drawCellsUniversal(img, frameNums, baseX, baseY, facingLeft) {
    let pivotCol = Infinity;
    let pivotRow = -Infinity;
    frameNums.forEach(fn => {
        const col = fn % 8;
        const row = Math.floor(fn / 8);
        if (col < pivotCol || (col === pivotCol && row > pivotRow)) {
            pivotCol = col;
            pivotRow = row;
        }
    });

    let maxCol = -Infinity;
    frameNums.forEach(fn => {
        const col = fn % 8;
        if (col > maxCol) maxCol = col;
    });
    const totalCols = maxCol - pivotCol + 1;

    frameNums.forEach(fn => {
        const col = fn % 8;
        const row = Math.floor(fn / 8);
        const offsetCol = col - pivotCol;
        const offsetRow = row - pivotRow;

        const c = getCellCoords(fn, img.naturalWidth, img.naturalHeight, 8, 6);

        if (facingLeft) {
            const mirroredCol = (totalCols - 1) - offsetCol;
            const dx = baseX + mirroredCol * 200;
            const dy = baseY + offsetRow * 280;

            ctx.save();
            ctx.translate(dx + 200, 0);
            ctx.scale(-1, 1);
            ctx.drawImage(img, c.sx, c.sy, c.sw, c.sh, -1, dy, 201, 280);
            ctx.restore();
        } else {
            const dx = baseX + offsetCol * 200;
            const dy = baseY + offsetRow * 280;
            ctx.drawImage(img, c.sx, c.sy, c.sw, c.sh, dx, dy, 201, 280);
        }
    });
}

// Chequear solapamiento de dos rectángulos
export function rectsOverlap(a, b) {
    return a.x < b.x + b.width && a.x + a.width > b.x &&
           a.y < b.y + b.height && a.y + a.height > b.y;
}