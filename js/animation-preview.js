import { animationsFor } from './animation-catalog.js';
import { drawRobotFrame } from './robot-sprites.js';

function node(tag, text) {
    const item = document.createElement(tag);
    if (text) item.textContent = text;
    return item;
}

export function createAnimationPreview(id) {
    const clips = animationsFor(id);
    const section = node('section');
    section.className = 'guide-animation';
    section.append(node('h3', 'Animaciones'));
    if (!clips.length) {
        section.append(node('p', 'Este personaje aún usa un modelo provisional sin hojas de animación.'));
        return section;
    }
    const select = node('select');
    select.setAttribute('aria-label', 'Animación');
    for (const item of clips) select.add(new Option(item.name, item.id));
    const canvas = node('canvas');
    canvas.width = 416;
    canvas.height = 227;
    const ctx = canvas.getContext('2d');
    const toolbar = node('div');
    toolbar.className = 'animation-toolbar';
    const speed = node('select');
    speed.setAttribute('aria-label', 'Velocidad de animación');
    for (const [value, name] of [['.25','0.25×'],['.5','0.5×'],['1','1× Base'],['1.5','1.5×'],['2','2×']]) {
        speed.add(new Option(name,value));
    }
    speed.value = '1';
    const play = node('button', 'Pausar');
    const prev = node('button', '◀');
    const next = node('button', '▶');
    prev.setAttribute('aria-label', 'Fotograma anterior');
    next.setAttribute('aria-label', 'Fotograma siguiente');
    for (const button of [play, prev, next]) button.type = 'button';
    const slider = node('input');
    slider.type = 'range';
    slider.min = '1';
    slider.setAttribute('aria-label', 'Número de fotograma');
    const label = node('output');
    const source = node('small');
    const frameControls = node('div');
    frameControls.className = 'animation-frame-controls';
    frameControls.append(label, slider);
    toolbar.append(prev, play, next, speed);
    section.append(select, canvas, toolbar, frameControls, source);

    let selected = clips[0], frame = 0, playing = true, elapsed = 0, last = null;
    let resolvedFrames = [], previewScale = 2;
    function paint() {
        ctx.clearRect(0,0,canvas.width,canvas.height);
        const footY = canvas.height - 32;
        const center = canvas.width / 2;
        ctx.strokeStyle = '#527aa5';
        ctx.beginPath();
        ctx.moveTo(16,footY+.5);
        ctx.lineTo(canvas.width-16,footY+.5);
        ctx.stroke();
        const f = resolvedFrames[frame];
        if (f) drawRobotFrame(ctx, { ...f,
            dx: center + f.dx * previewScale, dy: footY + f.dy * previewScale,
            dw: f.dw * previewScale, dh: f.dh * previewScale });
        label.textContent = `Frame ${frame+1} de ${selected.count}`;
        slider.value = String(frame+1);
        source.textContent = f
            ? `${selected.id} · ${Math.round(selected.ms)} ms base · ${f.sw} × ${f.sh} px · origen ${Math.round(f.sx)}, ${Math.round(f.sy)}`
            : `${selected.id} · Cargando sprite…`;
    }
    function resolve() {
        resolvedFrames = Array.from({length:selected.count},(_, i) => selected.frame(i));
        const present = resolvedFrames.filter(Boolean);
        if (!present.length) return;
        const halfWidth = Math.max(...present.map(f => Math.max(-f.dx, f.dx + f.dw)));
        const high = Math.max(...present.map(f => -f.dy));
        const low = Math.max(1, ...present.map(f => f.dy + f.dh));
        previewScale = Math.min(2.6, 190 / Math.max(1,halfWidth), 180 / Math.max(1,high), 31 / low);
    }
    function choose() {
        selected = clips.find(item => item.id === select.value) || clips[0];
        slider.max = String(selected.count);
        slider.disabled = selected.count === 1;
        frame = 0;
        elapsed = 0;
        last = null;
        resolve();
        paint();
    }
    function toggle(value) {
        playing = value;
        play.textContent = value ? 'Pausar' : 'Reproducir';
        elapsed = 0;
        last = null;
    }
    function step(value) {
        toggle(false);
        frame = (value + selected.count) % selected.count;
        paint();
    }
    select.addEventListener('change', choose);
    play.addEventListener('click', () => toggle(!playing));
    prev.addEventListener('click', () => step(frame-1));
    next.addEventListener('click', () => step(frame+1));
    slider.addEventListener('input', () => step(Number(slider.value)-1));
    choose();
    requestAnimationFrame(function tick(now) {
        if (!section.isConnected || !section.closest('dialog')?.open) return;
        const delta = last === null ? 0 : Math.min(150, now-last);
        last = now;
        if (resolvedFrames.some(f => !f)) { resolve(); paint(); }
        if (playing) {
            elapsed += delta * Number(speed.value);
            const steps = Math.floor(elapsed / selected.ms);
            if (steps > 0) {
                elapsed -= steps * selected.ms;
                frame = (frame + steps) % selected.count;
                paint();
            }
        }
        requestAnimationFrame(tick);
    });
    return section;
}
