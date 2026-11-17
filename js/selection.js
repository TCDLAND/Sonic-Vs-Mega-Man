// ========================================
// PANTALLA DE SELECCIÓN DE PERSONAJE
// ========================================

import { ctx, canvas, game } from './state.js';
import { espioSprite, bassIdle } from './assets.js';
import { getCellCoords } from './utils.js';

export function drawSelectionScreen() {
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#ffffff';
    ctx.font = '48px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('ELIGE TU PERSONAJE', canvas.width / 2, 80);

    const chars = game.characterSelection.chars;
    const centerY = canvas.height / 2;

    drawCharacterPortrait(chars[game.characterSelection.p1Index], canvas.width * 0.25, centerY, 1);
    drawCharacterPortrait(chars[game.characterSelection.p2Index], canvas.width * 0.75, centerY, 2);

    ctx.fillStyle = game.characterSelection.p1Confirmed ? '#00ff00' : '#ffffff';
    ctx.font = '32px monospace';
    ctx.fillText(
        `P1: ${chars[game.characterSelection.p1Index].toUpperCase()}${game.characterSelection.p1Confirmed ? ' ✓' : ''}`,
        canvas.width * 0.25,
        canvas.height - 80
    );

    ctx.fillStyle = game.characterSelection.p2Confirmed ? '#00ff00' : '#ffffff';
    ctx.fillText(
        `P2: ${chars[game.characterSelection.p2Index].toUpperCase()}${game.characterSelection.p2Confirmed ? ' ✓' : ''}`,
        canvas.width * 0.75,
        canvas.height - 80
    );

    ctx.fillStyle = '#888888';
    ctx.font = '20px monospace';
    ctx.fillText('P1: A/D + J', canvas.width * 0.25, canvas.height - 40);
    ctx.fillText('P2: ←/→ + ,', canvas.width * 0.75, canvas.height - 40);

    if (game.characterSelection.p1Confirmed && game.characterSelection.p2Confirmed) {
        ctx.fillStyle = '#ffff00';
        ctx.font = '28px monospace';
        ctx.fillText('¡EMPEZANDO...!', canvas.width / 2, canvas.height - 20);
    }

    ctx.textAlign = 'left';
}

const shadowPortrait = new Image();
shadowPortrait.src = "assets/images/shadow/Shadow1.png";

function drawCharacterPortrait(charName, x, y, player) {
    ctx.strokeStyle = (player === 1) ? '#00ff00' : '#ff0000';
    ctx.lineWidth = 4;
    ctx.strokeRect(x - 100, y - 150, 200, 280);

    ctx.fillStyle = '#2a2a4e';
    ctx.fillRect(x - 100, y - 150, 200, 280);

    let img;
    let frameNum = 0;

    if (charName === "shadow") {
        img = shadowPortrait;
    } else if (charName === "espio") {
        img = espioSprite;
        frameNum = 0;
    } else if (charName === "bass") {
        img = bassIdle;
        frameNum = 0;
    }

    if (img && img.complete && img.naturalWidth > 0) {
        const c = charName === "shadow"
            ? {sx:0,sy:0,sw:49,sh:img.naturalHeight}
            : getCellCoords(frameNum, img.naturalWidth, img.naturalHeight, 8, 6);
        ctx.drawImage(
            img,
            c.sx, c.sy, c.sw, c.sh,
            x - 100, y - 150, 200, 280
        );
    } else {
        ctx.fillStyle = '#d8d8d8';
        ctx.fillRect(x - 55, y - 95, 110, 190);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.strokeRect(x - 55, y - 95, 110, 190);
        ctx.fillStyle = '#111111';
        ctx.font = 'bold 18px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(charName.toUpperCase(), x, y + 5);
        ctx.textAlign = 'left';
    }
}