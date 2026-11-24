// Pantalla de selección provisional: los retratos finales se pueden sustituir
// por iconos dedicados cuando estén listos.
import { ctx, game } from './state.js';
import { robotFrame, drawRobotFrame } from './robot-sprites.js';
import { animationsFor } from './animation-catalog.js';
import { updatedFrame } from './fighter-update-art.js';
import { X_FRAMES } from './x-frames.js';

const roster = [
    { id: 'espio', label: 'ESPIO', color: '#a661f4' },
    { id: 'bass', label: 'BASS', color: '#d83c59', robotIdle: 'bassIdle' },
    { id: 'sonic', label: 'SONIC', color: '#18baff', sprite: 'sonic/sonic_idle.png', frames: 6 },
    { id: 'shadow', label: 'SHADOW', color: '#df2855', sprite: 'shadow/Shadow_Idle.png', frames: 6 },
    { id: 'knuckles', label: 'KNUCKLES', color: '#f0443e', sprite: 'knuckles_idle.png', frames: 8 },
    { id: 'silver', label: 'SILVER', color: '#d8f2ff', portrait: 'assets/images/silver/portrait.png' },
    { id: 'x', label: 'X', color: '#329cf4', sprite: 'x-atlas.png', atlasFrames: X_FRAMES.idle, defaultFlip: true },
    { id: 'zero', label: 'ZERO', color: '#eb5473', sprite: 'zero_idle.png', frames: 6, defaultFlip: true },
    { id: 'rock', label: 'MEGA MAN', color: '#29a8ff', sprite: 'rock_idle.png', frames: 4, defaultFlip: true },
    { id: 'protoman', label: 'BLUES', color: '#d94150', robotIdle: 'protoIdle' },
    { id: 'eggman', label: 'EGGMAN', color: '#e93629' },
    { id: 'wily', label: 'WILY', color: '#b88aff', portrait:'assets/Retratos/Wily/Wily_Confiado.png' },
    { id: 'emerl', label: 'EMERL', color: '#f3cf54', portrait: 'assets/Retratos/Emerl/Emerl_Normal.png' },
    { id: 'megaman-zero', label: 'MM ZERO', color: '#eb5a75', portrait: 'assets/images/mm-zero/portrait.png' },
    { id: 'metal-sonic', label: 'METAL SONIC', color: '#507eff', portrait: 'assets/Retratos/Sonic/Metal Sonic.png' },
    { id: 'tails', label: 'TAILS', color: '#ffb44c', portrait: 'assets/Retratos/Sonic/Tails.png' },
    { id: 'chaos', label: 'CHAOS', color: '#39c9ff', portrait: 'assets/images/chaos/portrait.png' }
];

const portraitImages = new Map();
const additionalIdles=new Map(roster.filter(entry=>!entry.sprite && !entry.robotIdle && entry.id!=='wily')
    .map(entry=>[entry.id,animationsFor(entry.id).find(clip=>clip.id==='idle')]));
function drawSelectionIdle(entry,x,feet,maxWidth,maxHeight,player) {
    const dir=player===1?1:-1;
    const now=performance.now();
    const idle=additionalIdles.get(entry.id);
    const frame=entry.id==='espio'
        ? updatedFrame('espio-kingnoel','idle',Math.floor(now/135),0,0,1,dir)
        : idle?.frame(Math.floor(now/Math.max(100,idle.ms))%idle.count);
    if (!frame) return false;
    const scale=Math.min(maxWidth/frame.dw,maxHeight/frame.dh);
    drawRobotFrame(ctx,{...frame,flipX:entry.id==='espio'?frame.flipX:frame.flipX!==(player===2),
        dx:x-frame.dw*scale/2,dy:feet-frame.dh*scale,dw:frame.dw*scale,dh:frame.dh*scale});
    return true;
}
function drawAtlasPortrait(entry, image, x, feet, scale, player) {
    const cells = entry.atlasFrames;
    const [sx, sy, sw, sh] = cells[Math.floor(performance.now() / 175) % cells.length];
    const flipX = Boolean(entry.defaultFlip) !== (player === 2);
    drawRobotFrame(ctx, { img: image, sx, sy, sw, sh, flipX,
        dx: x - sw * scale / 2, dy: feet - sh * scale, dw: sw * scale, dh: sh * scale });
}
for (const entry of roster) {
    if (!entry.sprite && !entry.portrait) continue;
    const image = new Image();
    image.src = entry.portrait ?? `assets/images/${entry.sprite}`;
    portraitImages.set(entry.id, image);
}

const W = 1280;
const H = 720;
const CARD_W = 66;
const CARD_H = 58;
const GRID_COLS = 4;
const GRID_GAP = 5;
const GRID_W = GRID_COLS * CARD_W + (GRID_COLS - 1) * GRID_GAP;
const leftGridX = 286;
const rightGridX = 994 - GRID_W;
const gridY = 359;
const randomButton = { x: 525, y: 211, w: 230, h: 44 };

export function canRandomizeSelection() {
    return game.mode === 'cpu' || game.mode === 'team';
}

export function randomSelectionAt(x, y) {
    const b = randomButton;
    return canRandomizeSelection() && x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
}

function roundedRect(x, y, w, h, r, fill, stroke, lineWidth = 1) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.lineWidth = lineWidth; ctx.strokeStyle = stroke; ctx.stroke(); }
}

function drawBackground() {
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#071a4d');
    bg.addColorStop(0.48, '#111634');
    bg.addColorStop(0.52, '#1c1025');
    bg.addColorStop(1, '#4c0a20');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.globalAlpha = 0.22;
    for (let i = 0; i < 18; i++) {
        const x = i * 82 - 30;
        ctx.fillStyle = i % 2 ? '#148dff' : '#f72f68';
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x + 160, 0);
        ctx.lineTo(x - 300, H);
        ctx.lineTo(x - 460, H);
        ctx.closePath();
        ctx.fill();
    }
    ctx.restore();

    // Piso de arena y líneas de perspectiva para evocar un versus sin tapar la UI.
    const floor = ctx.createLinearGradient(0, 570, 0, H);
    floor.addColorStop(0, 'rgba(5,10,27,0)');
    floor.addColorStop(1, 'rgba(2,4,16,.92)');
    ctx.fillStyle = floor;
    ctx.fillRect(0, 560, W, 160);
    ctx.strokeStyle = 'rgba(90,170,255,.2)';
    ctx.lineWidth = 1;
    for (let x = -500; x < 1800; x += 90) {
        ctx.beginPath(); ctx.moveTo(W / 2, 560); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = 590; y < H; y += 30) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    ctx.save();
    ctx.shadowBlur = 26;
    ctx.shadowColor = '#7d40ff';
    ctx.fillStyle = '#fff';
    ctx.font = '900 68px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('VS', W / 2, 354);
    ctx.restore();
    ctx.textAlign = 'left';
}

function drawPanel(x, y, w, h, accent, title, side) {
    roundedRect(x, y, w, h, 18, 'rgba(5,9,27,.76)', accent, 2);
    ctx.save();
    ctx.shadowColor = accent;
    ctx.shadowBlur = 18;
    ctx.fillStyle = accent;
    ctx.fillRect(x + 18, y + 16, 5, h - 32);
    ctx.restore();
    ctx.fillStyle = '#fff';
    ctx.font = '800 19px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(title, x + 36, y + 43);
    ctx.fillStyle = accent;
    ctx.font = '700 10px system-ui, sans-serif';
    ctx.fillText(side, x + 36, y + 62);
}

function drawPortrait(entry, x, y, w, h, accent, player, confirmed) {
    ctx.save();
    ctx.shadowColor = accent;
    ctx.shadowBlur = 24;
    roundedRect(x, y, w, h, 18, 'rgba(8,14,37,.94)', accent, 3);
    ctx.restore();

    // Fondo de retrato temporal. Los iconos oficiales reemplazan esta tarjeta después.
    const glow = ctx.createRadialGradient(x + w / 2, y + h * .45, 8, x + w / 2, y + h * .45, w * .7);
    glow.addColorStop(0, `${accent}55`);
    glow.addColorStop(1, 'rgba(4,7,21,0)');
    roundedRect(x + 6, y + 6, w - 12, h - 12, 14, 'rgba(13,20,47,.92)');
    ctx.fillStyle = glow;
    ctx.fillRect(x + 7, y + 7, w - 14, h - 14);

    const img = portraitImages.get(entry.id);
    const hasIdle=drawSelectionIdle(entry,x+w/2,y+h-58,w-28,h-80,player);
    if (!hasIdle && entry.robotIdle) {
        drawRobotFrame(ctx, robotFrame(entry.robotIdle, performance.now() + 280, entry.id === 'bass' ? 270 : 135,
            x + w / 2, y + h - 58, 2.75, player === 1 ? 1 : -1));
    } else if (!hasIdle && entry.atlasFrames && img?.naturalWidth) {
        drawAtlasPortrait(entry, img, x + w / 2, y + h - 60, 2.75, player);
    } else if (!hasIdle && img?.complete && img.naturalWidth > 0) {
        const frameW = entry.frameW || img.naturalWidth / (entry.frames || 1);
        const frameH = entry.frameH || img.naturalHeight;
        const scale = Math.min((w - 28) / frameW, (h - 80) / frameH);
        const dw = frameW * scale;
        const dh = frameH * scale;
        const frame = Math.floor(performance.now() / 100) % (entry.frames || 1);
        const flip = Boolean(entry.defaultFlip) !== (player === 2);
        ctx.imageSmoothingEnabled = false;
        const dx = x + (w - dw) / 2;
        const dy = y + 20 + (h - 72 - dh) / 2 + (entry.id==='wily'?Math.sin(performance.now()/275)*3:0);
        ctx.save();
        if (flip) { ctx.translate(dx + dw, 0); ctx.scale(-1, 1); ctx.drawImage(img, frame * frameW, entry.sourceY ?? 0, frameW, frameH, 0, dy, dw, dh); }
        else ctx.drawImage(img, frame * frameW, entry.sourceY ?? 0, frameW, frameH, dx, dy, dw, dh);
        ctx.restore();
    } else if (!hasIdle) {
        ctx.save();
        ctx.globalAlpha = .92;
        ctx.fillStyle = accent;
        ctx.font = '900 112px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(entry.label.slice(0, 1), x + w / 2, y + h * .46 + Math.sin(performance.now() / 100) * 3);
        ctx.restore();
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#fff';
    ctx.font = '900 22px system-ui, sans-serif';
    ctx.fillText(entry.label, x + w / 2, y + h - 37);
    ctx.fillStyle = accent;
    ctx.font = '700 11px system-ui, sans-serif';
    const status = player === 2 && ['cpu', 'team'].includes(game.mode) ? 'RIVAL CPU' : game.mode === 'ai' ? 'AGENTE AUTÓNOMO' : confirmed ? 'SELECCIÓN LISTA' : `JUGADOR ${player}`;
    ctx.fillText(status, x + w / 2, y + h - 18);
    ctx.textAlign = 'left';
}

function drawHand(x, y, accent, confirmed) {
    if (confirmed) return;
    const bob = Math.sin(performance.now() / 150) * 3;
    ctx.save();
    ctx.translate(x, y + bob);
    ctx.shadowColor = accent;
    ctx.shadowBlur = 12;
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#10152e';
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    // Cursor de manita pixelado apuntando a la casilla activa.
    ctx.beginPath();
    ctx.moveTo(12, 1); ctx.lineTo(20, 1); ctx.lineTo(20, 19);
    ctx.lineTo(24, 14); ctx.lineTo(29, 15); ctx.lineTo(29, 21);
    ctx.lineTo(24, 31); ctx.lineTo(9, 31); ctx.lineTo(3, 21);
    ctx.lineTo(3, 16); ctx.lineTo(8, 15); ctx.lineTo(12, 20); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.restore();
}

function drawGrid(selectedIndex, x, accent, confirmed, player) {
    for (let i = 0; i < roster.length; i++) {
        const col = i % GRID_COLS;
        const row = Math.floor(i / GRID_COLS);
        const cx = x + col * (CARD_W + GRID_GAP);
        const cy = gridY + row * (CARD_H + GRID_GAP);
        const entry = roster[i];
        const active = i === selectedIndex;

        if (!entry) {
            roundedRect(cx, cy, CARD_W, CARD_H, 9, 'rgba(9,13,30,.55)', 'rgba(255,255,255,.13)', 1);
            ctx.fillStyle = 'rgba(255,255,255,.25)';
            ctx.font = '700 18px system-ui';
            ctx.textAlign = 'center';
            ctx.fillText('?', cx + CARD_W / 2, cy + 32);
            continue;
        }

        roundedRect(cx, cy, CARD_W, CARD_H, 9, active ? `${accent}55` : 'rgba(8,12,28,.83)', active ? '#fff' : `${accent}88`, active ? 3 : 1.2);
        const image = portraitImages.get(entry.id);
        const hasIdle=drawSelectionIdle(entry,cx+CARD_W/2,cy+42,48,39,player);
        if (!hasIdle && entry.robotIdle) {
            drawRobotFrame(ctx, robotFrame(entry.robotIdle, performance.now() + 280, entry.id === 'bass' ? 270 : 135,
            cx + CARD_W / 2, cy + 41, .83, player === 1 ? 1 : -1));
        } else if (!hasIdle && entry.atlasFrames && image?.naturalWidth) {
            drawAtlasPortrait(entry, image, cx + CARD_W / 2, cy + 41, .83, player);
        } else if (!hasIdle && image?.complete && image.naturalWidth > 0) {
            const fw = entry.frameW || image.naturalWidth / (entry.frames || 1);
            const fh = entry.frameH || image.naturalHeight;
            const scale = Math.min(36 / fw, 39 / fh);
            const dw = fw * scale;
            const dh = fh * scale;
            ctx.imageSmoothingEnabled = false;
            const frame = Math.floor(performance.now() / 100) % (entry.frames||1);
            const dx = cx + (CARD_W - dw) / 2;
            const dy = cy + 2 + (39 - dh) / 2 + (entry.id==='wily'?Math.sin(performance.now()/275):0);
            const flip = Boolean(entry.defaultFlip) !== (player === 2);
            ctx.save();
            if (flip) { ctx.translate(dx + dw, 0); ctx.scale(-1, 1); ctx.drawImage(image, frame * fw, entry.sourceY ?? 0, fw, fh, 0, dy, dw, dh); }
            else ctx.drawImage(image, frame * fw, entry.sourceY ?? 0, fw, fh, dx, dy, dw, dh);
            ctx.restore();
        } else if (!hasIdle) {
            ctx.fillStyle = entry.color;
            ctx.font = '900 25px system-ui, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(entry.label.slice(0, 1), cx + CARD_W / 2, cy + 20 + Math.sin(performance.now() / 100) * 1.5);
        }
        ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = active ? '#fff' : 'rgba(235,241,255,.83)';
        ctx.font = '800 8px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(entry.label, cx + CARD_W / 2, cy + 54);
        if (active && !confirmed) drawHand(cx + CARD_W - 12, cy - 17, accent, confirmed);
        if (active && confirmed) {
            ctx.fillStyle = accent;
            ctx.font = '900 11px system-ui';
            ctx.fillText('✓', cx + CARD_W - 7, cy + 12);
        }
    }
}

function drawSide(player) {
    const isP1 = player === 1;
    const selection = game.characterSelection;
    const index = isP1 ? selection.p1Index : selection.p2Index;
    const confirmed = isP1 ? selection.p1Confirmed : selection.p2Confirmed;
    const accent = isP1 ? '#20aaff' : '#ff365f';
    const entry = roster[index] || roster[0];
    const panelX = isP1 ? 24 : 656;
    const gridX = isP1 ? leftGridX : rightGridX;
    const portraitX = isP1 ? 48 : 1024;

    const panelTitle = game.mode === 'ai' ? isP1 ? 'IA AZUL' : 'IA ROJA' : isP1 ? 'PLAYER 1' : ['cpu', 'team'].includes(game.mode) ? 'CPU RIVAL' : 'PLAYER 2';
    const panelSubtitle = game.mode === 'ai' ? 'SELECCIONA SU PELEADOR' : isP1 ? 'EQUIPO AZUL' : ['cpu', 'team'].includes(game.mode) ? 'ELIGE AL RIVAL' : 'EQUIPO ROJO';
    drawPanel(panelX, 318, 600, 350, accent, panelTitle, panelSubtitle);
    drawPortrait(entry, portraitX, 85, 218, 215, accent, player, confirmed);
    drawGrid(index, gridX, accent, confirmed, player);

    ctx.fillStyle = confirmed ? '#a7ffc4' : 'rgba(255,255,255,.78)';
    ctx.font = '700 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    if (game.mode === 'online') {
        const ownsSide = (game.onlineRole === 'host' && isP1) || (game.onlineRole === 'guest' && !isP1);
        ctx.fillText(ownsSide ? 'TÚ: MOVER A / D / W / S' : 'RIVAL EN LÍNEA', isP1 ? 474 : 841, 641);
        ctx.fillText(ownsSide ? 'CONFIRMAR: J' : 'ESPERANDO SELECCIÓN', isP1 ? 474 : 841, 657);
    } else {
        ctx.fillText(isP1 ? 'MOVER: A / D / W / S' : 'MOVER: FLECHAS', isP1 ? 474 : 841, 641);
        ctx.fillText(isP1 ? 'CONFIRMAR: J' : 'CONFIRMAR: ,', isP1 ? 474 : 841, 657);
    }
}

export function drawSelectionScreen() {
    drawBackground();

    ctx.save();
    ctx.textAlign = 'center';
    ctx.shadowColor = '#38b7ff'; ctx.shadowBlur = 18;
    ctx.fillStyle = '#fff';
    ctx.font = '900 36px system-ui, sans-serif';
    ctx.fillText('SELECCIÓN DE PERSONAJE', W / 2, 48);
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(225,235,255,.75)';
    ctx.font = '600 13px system-ui, sans-serif';
    ctx.fillText(game.mode === 'online' ? 'JUGADOR 1 CREA LA SALA  •  JUGADOR 2 SE UNE CON EL CÓDIGO' : 'ELIGE TUS LUCHADORES  •  ESC PARA VOLVER A MODOS', W / 2, 72);
    ctx.restore();

    drawSide(1);
    drawSide(2);
    if (canRandomizeSelection()) {
        const b = randomButton;
        roundedRect(b.x, b.y, b.w, b.h, 12, '#131e3c', '#8dcfff', 2);
        ctx.textAlign = 'center';
        ctx.fillStyle = '#f1f8ff';
        ctx.font = '800 15px system-ui';
        ctx.fillText(game.mode === 'team' ? 'EQUIPOS ALEATORIOS  ·  R' : 'DUELO ALEATORIO  ·  R', W / 2, b.y + 28);
    }

    const ready = game.characterSelection.p1Confirmed && game.characterSelection.p2Confirmed;
    roundedRect(410, 678, 460, 32, 12, ready ? 'rgba(37,204,122,.22)' : 'rgba(5,9,24,.78)', ready ? '#47f59a' : 'rgba(255,255,255,.22)', 2);
    ctx.textAlign = 'center';
    ctx.fillStyle = ready ? '#9bffc4' : '#fff';
    ctx.font = '900 13px system-ui, sans-serif';
    const controlsText = game.mode === 'online'
        ? (game.teamRosters ? `3v3 · AZUL ${game.teamRosters[0].length}/3 · ROJO ${game.teamRosters[1].length}/3 · WASD + J` : game.onlineRole === 'host' ? 'ERES JUGADOR 1 · WASD + JIKM · ESPERANDO A TU RIVAL' : 'ERES JUGADOR 2 · USA WASD + JIKM COMO EL JUGADOR 1')
        : game.mode === 'ai'
        ? 'CONFIGURA IA AZUL Y ROJA: P1  A / D / W / S + J     •     P2  FLECHAS + ,'
        : ['cpu', 'team'].includes(game.mode)
        ? (game.mode === 'team' ? `AZUL ${game.teamRosters[0].length}/3  •  CPU ${game.teamRosters[1].length}/3  •  ELIGE SEIS DISTINTOS` : 'TÚ: WASD + J  •  RIVAL: FLECHAS + COMA')
        : 'P1  A / D / W / S + J     •     P2  FLECHAS + ,';
    ctx.fillText(ready ? '¡LISTOS! INICIANDO COMBATE…' : controlsText, W / 2, 699);
    ctx.textAlign = 'left';
}

export function getSelectionRoster() {
    return roster;
}

export function selectionIndexAt(x, y, player) {
    const gridX = player === 1 ? leftGridX : rightGridX;
    const col = Math.floor((x - gridX) / (CARD_W + GRID_GAP));
    const row = Math.floor((y - gridY) / (CARD_H + GRID_GAP));
    if (col < 0 || col >= GRID_COLS || row < 0 || row >= Math.ceil(roster.length / GRID_COLS)) return -1;
    const cellX = x - (gridX + col * (CARD_W + GRID_GAP));
    const cellY = y - (gridY + row * (CARD_H + GRID_GAP));
    if (cellX > CARD_W || cellY > CARD_H) return -1;
    const index = row * GRID_COLS + col;
    return index < roster.length ? index : -1;
}
