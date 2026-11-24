import { ctx, canvas, game } from './state.js';

const W = 1280;
const H = 720;

function rounded(x, y, w, h, r, fill, stroke, line = 2) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = line; ctx.stroke(); }
}

function backdrop(title, subtitle) {
    const gradient = ctx.createLinearGradient(0, 0, W, H);
    gradient.addColorStop(0, '#071947');
    gradient.addColorStop(.5, '#11172e');
    gradient.addColorStop(1, '#470b22');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    ctx.globalAlpha = .17;
    for (let i = 0; i < 18; i++) {
        ctx.fillStyle = i % 2 ? '#0b9fff' : '#ff2b59';
        ctx.beginPath();
        ctx.moveTo(i * 85 - 100, 0);
        ctx.lineTo(i * 85 + 110, 0);
        ctx.lineTo(i * 85 - 300, H);
        ctx.lineTo(i * 85 - 480, H);
        ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.shadowColor = '#38aaff'; ctx.shadowBlur = 20;
    ctx.font = '900 43px system-ui, sans-serif';
    ctx.fillText(title, W / 2, 120);
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(236,243,255,.78)';
    ctx.font = '600 17px system-ui, sans-serif';
    ctx.fillText(subtitle, W / 2, 155);
    ctx.textAlign = 'left';
}

export function drawModeScreen() {
    backdrop('SONIC VS. MEGA MAN', 'ELIGE CÓMO QUIERES JUGAR');
    rounded(465, 185, 350, 59, 12, '#152b51', game.modeCursor === 3 ? '#65dbff' : '#6190bf', game.modeCursor === 3 ? 4 : 2);
    ctx.textAlign = 'center';
    ctx.font = '850 23px system-ui';
    ctx.fillStyle = '#fff';
    ctx.fillText('MODO HISTORIA · CAMPAÑAS', 640, 222);
    ctx.textAlign = 'left';
    const options = [
        { x: 170, title: 'CONTRA CPU', lines: ['Rival CPU que adapta su estrategia', 'con golpes, bloqueos y resultados.'], accent: '#28aaff' },
        { x: 665, title: 'CONTRA UN AMIGO', lines: ['Dos jugadores en el mismo teclado.', 'Cada quien elige su personaje.'], accent: '#ff3c66' }
    ];
    options.forEach((option, i) => {
        const active = game.modeCursor === i;
        rounded(option.x, 270, 445, 240, 22, active ? 'rgba(14,32,65,.94)' : 'rgba(5,9,25,.78)', active ? option.accent : 'rgba(255,255,255,.24)', active ? 4 : 2);
        ctx.save();
        if (active) { ctx.shadowColor = option.accent; ctx.shadowBlur = 25; }
        ctx.fillStyle = option.accent;
        ctx.font = '900 33px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(option.title, option.x + 222, 355);
        ctx.restore();
        ctx.fillStyle = 'rgba(240,245,255,.86)';
        ctx.font = '600 15px system-ui, sans-serif';
        ctx.fillText(option.lines[0], option.x + 222, 389);
        ctx.fillText(option.lines[1], option.x + 222, 411);
        ctx.fillStyle = active ? '#fff' : 'rgba(255,255,255,.55)';
        ctx.font = '800 14px system-ui, sans-serif';
        ctx.fillText(active ? 'PULSA J / , / ENTER PARA ELEGIR' : 'SELECCIONAR', option.x + 222, 455);
        if (active) {
            ctx.fillStyle = option.accent;
            ctx.beginPath(); ctx.moveTo(option.x + 222, 470); ctx.lineTo(option.x + 232, 484); ctx.lineTo(option.x + 212, 484); ctx.closePath(); ctx.fill();
        }
    });
    // El modo de entrenamiento ocupa el panel inferior y también es seleccionable con teclado.
    const training = game.modeCursor === 2;
    rounded(170, 540, 445, 86, 18, training ? 'rgba(28,20,58,.94)' : 'rgba(5,9,25,.8)', training ? '#bd7bff' : 'rgba(255,255,255,.26)', training ? 4 : 2);
    ctx.save();
    if (training) { ctx.shadowColor = '#bd7bff'; ctx.shadowBlur = 20; }
    ctx.fillStyle = '#d6a5ff';
    ctx.textAlign = 'center';
    ctx.font = '900 24px system-ui, sans-serif';
    ctx.fillText('JUGADOR VS CPU  •  3v3', 392, 575);
    ctx.restore();
    ctx.textAlign = 'center';
    ctx.fillStyle = training ? '#fff' : 'rgba(255,255,255,.65)';
    ctx.font = '700 12px system-ui, sans-serif';
    ctx.fillText('ELIGE AMBOS EQUIPOS  •  ASISTENCIA Y RELEVO CON U', 392, 603);
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,.62)';
    ctx.font = '600 13px system-ui, sans-serif';
    rounded(665,540,445,86,18,'#142b3d',game.modeCursor===4?'#7dffd7':'#537c94',game.modeCursor===4?4:2);
    ctx.fillStyle='#9af9dc';
    ctx.font='900 24px system-ui';
    ctx.fillText('CAMPO DE PRÁCTICA',887,575);
    ctx.fillStyle='#e5f6ff';
    ctx.font='700 12px system-ui';
    ctx.fillText('PODER Y MUNICIÓN INFINITOS · CARGA INSTANTÁNEA',887,603);
    ctx.fillStyle='rgba(255,255,255,.62)';
    ctx.font='600 13px system-ui, sans-serif';
    ctx.fillText('A / D o ← / → PARA CAMBIAR     •     J / , / ENTER PARA ELEGIR', W / 2, 703);
    rounded(145, 637, 300, 40, 9, '#162945', '#83c9ff', 2);
    ctx.fillStyle = '#e4f6ff';
    ctx.font = '800 15px system-ui';
    ctx.fillText('GUÍA DE PERSONAJES  ·  G',295,663);
    rounded(490,637,300,40,9,'#123c45',game.modeCursor===6?'#79ffe1':'#4ca598',game.modeCursor===6?4:2);
    ctx.fillStyle='#d7fff6';ctx.fillText('ONLINE · SALA 1v1',640,663);
    rounded(835,637,300,40,9,'#3d265d',game.modeCursor===5?'#dec1ff':'#9070c0',game.modeCursor===5?4:2);
    ctx.fillStyle='#f5e5ff';ctx.fillText('TORNEOS Y SIMULACIÓN',985,663);
    ctx.textAlign = 'left';
}

export function modeOptionAt(x, y) {
    if (y>=637 && y<=677) {
        if(x>=490&&x<=790)return 6;
        if(x>=835&&x<=1135)return 5;
    }
    if (x >= 465 && x <= 815 && y >= 185 && y <= 244) return 3;
    if (y>=540 && y<=626) {
        if(x>=170 && x<=615) return 2;
        if(x>=665 && x<=1110) return 4;
    }
    if (y < 270 || y > 510) return -1;
    if (x >= 170 && x <= 615) return 0;
    if (x >= 665 && x <= 1110) return 1;
    return -1;
}

export function drawCountdown() {
    const countdown = game.countdown;
    if (!countdown || countdown.phase === 'go') return;
    const waiting = countdown.phase === 'waiting';
    const label = waiting ? '¡A SUS PUESTOS!' : countdown.phase;
    ctx.save();
    if (waiting) {
        rounded(265, 286, 750, 120, 20, 'rgba(2,5,18,.72)', 'rgba(90,190,255,.8)', 2);
    } else {
        ctx.fillStyle = 'rgba(2,5,18,.58)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = '#43bcff';
    ctx.shadowBlur = waiting ? 18 : 38;
    ctx.fillStyle = '#fff';
    ctx.font = waiting ? '900 38px system-ui, sans-serif' : '1000 140px system-ui, sans-serif';
    ctx.fillText(label, canvas.width / 2, waiting ? 330 : canvas.height / 2);
    if (waiting) {
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(245,248,255,.82)';
        ctx.font = '700 17px system-ui, sans-serif';
        ctx.fillText('ESPERANDO A QUE TERMINEN LAS PRESENTACIONES', canvas.width / 2, 370);
    }
    ctx.restore();
}

export function drawResultScreen() {
    backdrop(game.winner === 'draw' ? 'EMPATE' : `${game.winnerName || 'GANADOR'} GANA`, game.resultReason === 'time' ? 'TIEMPO AGOTADO • VIDA TOTAL' : 'EL COMBATE HA TERMINADO');
    const cpuWon = game.mode === 'cpu' && game.winner === 'p1';
    const message = game.mode === 'ai'
        ? 'Ambos rivales guardaron lo aprendido para la siguiente pelea.'
        : game.mode === 'cpu'
            ? (cpuWon ? 'La CPU ajustó su estrategia para el siguiente combate.' : 'La CPU registró qué movimientos le funcionaron.')
            : '¿Listos para una revancha?';
    rounded(230, 220, 820, 140, 20, 'rgba(4,9,26,.8)', game.winner === 'p2' ? '#ff3c66' : '#28aaff', 2);
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(238,244,255,.9)';
    ctx.font = '600 18px system-ui, sans-serif';
    ctx.fillText(message, W / 2, 290);
    if (game.mode === 'cpu' && game.cpuAgent) {
        const p = game.cpuAgent.profile;
        ctx.fillStyle = 'rgba(190,215,255,.82)';
        ctx.font = '700 12px system-ui, sans-serif';
        ctx.fillText(`APRENDIZAJE CPU  •  V ${p.wins} / D ${p.losses}  •  GOLPES ${game.cpuAgent.hitsThisMatch}  •  BLOQUEOS ${game.cpuAgent.blocksThisMatch}  •  PENALIZACIONES ${game.cpuAgent.repeatPenalties}`, W / 2, 329);
    } else if (game.mode === 'ai' && game.cpuAgentP1 && game.cpuAgentP2) {
        ctx.fillStyle = 'rgba(190,215,255,.82)';
        ctx.font = '700 11px system-ui, sans-serif';
        ctx.fillText(`IA AZUL: V ${game.cpuAgentP1.profile.wins} / D ${game.cpuAgentP1.profile.losses} • GOLPES ${game.cpuAgentP1.hitsThisMatch} • BLOQUEOS ${game.cpuAgentP1.blocksThisMatch}`, W / 2, 316);
        ctx.fillText(`IA ROJA: V ${game.cpuAgentP2.profile.wins} / D ${game.cpuAgentP2.profile.losses} • GOLPES ${game.cpuAgentP2.hitsThisMatch} • BLOQUEOS ${game.cpuAgentP2.blocksThisMatch}`, W / 2, 339);
    }

    const buttons = [
        { x: 290, title: 'REVANCHA', accent: '#27aaff' },
        { x: 665, title: 'ELEGIR PERSONAJES', accent: '#ff3c66' }
    ];
    buttons.forEach((button) => {
        rounded(button.x, 430, 325, 92, 18, 'rgba(5,10,28,.86)', button.accent, 3);
        ctx.fillStyle = '#fff';
        ctx.font = '900 20px system-ui, sans-serif';
        ctx.fillText(button.title, button.x + 162, 485);
        ctx.fillStyle = 'rgba(255,255,255,.68)';
        ctx.font = '700 12px system-ui, sans-serif';
        ctx.fillText(button.x < 500 ? 'R / ENTER' : 'C / ESC', button.x + 162, 506);
    });
    ctx.textAlign = 'left';
}

export function resultActionAt(x, y) {
    if (y < 430 || y > 522) return null;
    if (x >= 290 && x <= 615) return 'rematch';
    if (x >= 665 && x <= 990) return 'characters';
    return null;
}
