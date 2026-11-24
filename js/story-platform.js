import { canvas, ctx, game } from './state.js';
import { GAME_STATE } from './config.js';
import { music } from './music.js';
import { ROCK_SHEETS } from './rock.js';
import { drawRobotFrame, robotFrame } from './robot-sprites.js';
import { storyLines } from './story-script.js';

const W = canvas.width, H = canvas.height, FLOOR = 600;
const STEP = 1000 / 60;
const GRINDER_SCALE = 2;
const CREST = { width: 48 * (222 / 137) * GRINDER_SCALE, height: 36 * (184 / 116) * GRINDER_SCALE, anchor: 143 * GRINDER_SCALE };
const MAX_ADVENTURE_HEALTH = 12;
const keys = new Set();
const paths = {
    lab: 'assets/Fondos/DoctorLightLab.png',
    street: 'assets/story/ruinedstreet.png',
    museum: 'assets/story/museum stage.png',
    light: 'assets/story/light.png',
    lightPoint: 'assets/story/light-point.png',
    auto: 'assets/story/auto.png',
    autoIdle: 'assets/story/auto2.png',
    roll: 'assets/story/Roll.png',
    bunby: 'assets/story/Bunby Tank.png',
    grinder: 'assets/story/madgrinder1.png',
    grinderBare: 'assets/story/madgrinder2.png',
    met: 'assets/images/story-robots/met.png'
};
const art = Object.fromEntries(Object.entries(paths).map(([key, url]) => {
    const img = new Image();
    img.onerror = () => console.warn('[Historia] Recurso no disponible:', url);
    img.src = url;
    return [key, img];
}));
const stageSpec = {
    lab: { width: 2172, platforms: [[0, 2172, FLOOR]], track: 'light_lab' },
    street: { width: 4840, platforms: [[0, 1500, FLOOR], [1680, 2790, FLOOR], [2990, 4840, FLOOR]], track: 'city_stage',
        pits: [[1500, 1680], [2790, 2990]], checkpoint: 3250,
        enemies: [['tank', 680], ['tank', 965], ['met', 1200], ['met', 2070], ['tank', 2440], ['tank', 3250], ['grinder', 4170]] },
    museum: { width: 3840, platforms: [[0, 3840, FLOOR]], ledges: [[780, 1120, 511], [1640, 1920, 520], [2635, 2925, 544]],
        ceilings: [[562, 1346, 400], [2478, 3225, 435]],
        track: 'museum', enemies: [['met', 1070], ['met', 1980], ['met', 2960]] }
};
const names = { rock: 'Rock', blues: 'Blues', light: 'Light', roll: 'Roll', auto: 'Auto' };
const terrain = new Map();
const museumReminders = {
    roll: [
        name => name + ', avísanos cuando tengas noticias.',
        name => '¿Otra vez por aquí, ' + name + '? El pasillo está al fondo.',
        name => 'Se te está haciendo tarde, ' + name + '.',
        name => name + ', cada vez que regresas Wily gana tiempo.',
        name => '¡Ya basta de vueltas, ' + name + '! ¡Ve al fondo del museo!'
    ],
    auto: [
        () => '¿Ya vieron la hora, chicos? Nosotros esperamos aquí.',
        name => 'El escáner sigue apuntando al fondo, ' + name + '. Aquí ya revisé.',
        name => name + ', esto ya nos está tomando demasiado tiempo.',
        () => 'Ya les dije que cuido la entrada. ¡Vayan por los robots!',
        name => '¡' + name + ', dejen de dar vueltas! ¡Wily se nos va a escapar!'
    ]
};
let run;
let iris;
let last = 0;
let accumulator = 0;
let paused = false;
let padJump = false;
let padPause = false;
let padSwap = false;
let padSpecial = false;

export function preflightAdventure() {
    console.warn('[Historia] Metall FX: el ZIP contiene Mash. Se usa el Met del proyecto provisionalmente.');
    console.warn('[Historia] Retratos de Roll y Auto: se usan sus sprites hasta recibir retratos separados.');
}

function prepared(key, colors) {
    const image = art[key];
    if (!image?.complete || !image.naturalWidth) return null;
    if (!colors?.length) return image;
    const cacheKey = key + ':' + colors.join(',');
    if (terrain.has(cacheKey)) return terrain.get(cacheKey);
    const layer = document.createElement('canvas');
    layer.width = image.naturalWidth;
    layer.height = image.naturalHeight;
    const context = layer.getContext('2d', { willReadFrequently: true });
    context.drawImage(image, 0, 0);
    const data = context.getImageData(0, 0, layer.width, layer.height);
    for (let i = 0; i < data.data.length; i += 4) {
        const pixel = (data.data[i] << 16) | (data.data[i + 1] << 8) | data.data[i + 2];
        if (colors.includes(pixel)) data.data[i + 3] = 0;
    }
    context.putImageData(data, 0, 0);
    terrain.set(cacheKey, layer);
    return layer;
}

function makeEnemy([type, x]) {
    return { type, x, origin: x, y: FLOOR, hp: { tank: 4, met: 1, grinder: 16, top: 2 }[type],
        phase: 'idle', age: 0, direction: -1, awake: false };
}

function actor(x) {
    return { x, y: FLOOR, vx: 0, vy: 0, direction: 1, grounded: true, groundAt: 0, jumpAt: -Infinity };
}

function loadStage(name, actions, party = { lead: 'rock', health: { rock: MAX_ADVENTURE_HEALTH, blues: MAX_ADVENTURE_HEALTH } }) {
    run = {
        name, spec: stageSpec[name], actions, hero: actor(name === 'lab' ? 312 : 230), ally: actor(name === 'lab' ? 220 : 135), camera: 0,
        t: 0, lead: party.lead, health: party.health, invincibleUntil: 0, shots: [], enemies: (stageSpec[name].enemies ?? []).map(makeEnemy),
        triggered: new Set(), queue: [], bubble: null, checkpoint: 230, shakeUntil: 0,
        bossStarted: false, cleared: false, dashUntil: 0, shotUntil: 0
    };
    if (name === 'lab') run.lightPointUntil = 1550;
    if (name === 'museum') run.museumVisits = { roll: { count: 0, nearby: false }, auto: { count: 0, nearby: false } };
    music.play(run.spec.track);
}

export function startAdventure(name, actions = {}, { startAt, party } = {}) {
    keys.clear();
    paused = false;
    last = 0;
    accumulator = 0;
    loadStage(name, actions, party);
    if (startAt != null && floorAt(startAt)) {
        run.checkpoint = startAt;
        Object.assign(run.hero, actor(startAt));
        Object.assign(run.ally, actor(startAt - 82));
        run.camera = clamp(startAt - W * .42, 0, run.spec.width - W);
    }
    game.gameState = GAME_STATE.ADVENTURE;
    iris = { phase: 'open', elapsed: 0 };
}

export function stopAdventure() {
    run = null;
    iris = null;
    keys.clear();
    if (paused) music.resume();
    paused = false;
}

export function startTransport(actions, party) {
    startAdventure('street', actions, { party });
    run.transport = true;
    run.enemies = [];
    run.camera = 260;
    queueLines('travel', 7, 1);
}

export function adventureKey(event, down) {
    if (game.gameState !== GAME_STATE.ADVENTURE) return false;
    const code = event.code;
    if (!['KeyA','KeyD','KeyW','KeyJ','KeyK','KeyI','KeyM','KeyL','ArrowLeft','ArrowRight','ArrowUp','Space','Escape','KeyT'].includes(code)) return true;
    event.preventDefault();
    if (!down) {
        keys.delete(code);
        if (code === 'KeyI' && !paused && !iris && run?.chargeAt != null) releaseCharge();
        return true;
    }
    keys.add(code);
    if (event.repeat) return true;
    if (code === 'Escape') togglePause();
    if (code === 'KeyT' && paused) {
        const exit = run?.actions?.exit;
        stopAdventure();
        exit?.();
    }
    if (paused || iris || !run || run.transport || run.microUntil > run.t) return true;
    if (['KeyW', 'ArrowUp', 'Space'].includes(code)) run.hero.jumpAt = run.t;
    if (code === 'KeyJ') shoot();
    if (code === 'KeyI') run.chargeAt = run.t;
    if (code === 'KeyM') slash();
    if (code === 'KeyL') switchLead();
    if (code === 'KeyK' && run.hero.grounded) run.dashUntil = run.t + 170;
    return true;
}

function togglePause() {
    paused = !paused;
    keys.clear();
    run.chargeAt = null;
    if (paused) music.pause();
    else music.resume();
}

function pollPad() {
    const pad = Array.from(navigator.getGamepads?.() ?? []).find(Boolean);
    if (!pad) return 0;
    const pause = Boolean(pad.buttons[9]?.pressed);
    const jump = Boolean(pad.buttons[0]?.pressed);
    const shot = Boolean(pad.buttons[2]?.pressed);
    const swap = Boolean(pad.buttons[5]?.pressed);
    const special = Boolean(pad.buttons[3]?.pressed);
    if (pause && !padPause) togglePause();
    if (!paused && !iris && !run.transport && !(run.microUntil > run.t)) {
        if (jump && !padJump) run.hero.jumpAt = run.t;
        if (shot) shoot();
        if (swap && !padSwap) switchLead();
        if (special && !padSpecial) slash();
        if (pad.buttons[1]?.pressed && run.hero.grounded && run.t >= run.dashUntil + 180) run.dashUntil = run.t + 170;
    }
    padPause = pause;
    padSwap = swap;
    padSpecial = special;
    padJump = jump;
    return (pad.buttons[15]?.pressed ? 1 : 0) - (pad.buttons[14]?.pressed ? 1 : 0) ||
        (Math.abs(pad.axes[0] ?? 0) > .35 ? Math.sign(pad.axes[0]) : 0);
}

const clamp = (value, a, b) => Math.max(a, Math.min(b, value));
const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
function floorAt(x) { return run.spec.platforms.find(([left, right]) => x >= left && x <= right); }

function stepActor(who, direction, speed) {
    const oldY = who.y, oldX = who.x;
    const headHeight = 92;
    if (direction) who.direction = direction;
    who.vx = direction * speed;
    who.x = clamp(who.x + who.vx, 30, run.spec.width - 25);
    if (who.grounded) who.groundAt = run.t;
    if (run.t - who.jumpAt <= 105 && (who.grounded || run.t - who.groundAt <= 82)) {
        who.vy = -15.4;
        who.grounded = false;
        who.groundAt = -Infinity;
        who.jumpAt = -Infinity;
    }
    who.vy = Math.min(19, who.vy + .74);
    who.y += who.vy;
    who.grounded = false;
    for (const [left,right,bottom] of run.spec.ceilings ?? []) {
        const inSpan = who.x + 15 > left && who.x - 15 < right;
        if (!inSpan || who.y - headHeight >= bottom) continue;
        if (oldX + 15 <= left || oldX - 15 >= right) {
            who.x = oldX;
            who.vx = 0;
        } else if (who.vy < 0) {
            who.y = bottom + headHeight;
            who.vy = 0;
        }
    }
    const ledge = run.spec.ledges?.find(([left, right, top]) =>
        who.x >= left && who.x <= right && oldY <= top && who.y >= top);
    const floor = ledge ?? floorAt(who.x);
    if (floor && who.vy >= 0 && oldY <= floor[2] && who.y >= floor[2]) {
        who.y = floor[2];
        who.vy = 0;
        who.grounded = true;
    }
}

function follow() {
    const { ally, hero, camera } = run;
    const goal = hero.x - 93;
    const direction = Math.abs(goal - ally.x) > 29 ? Math.sign(goal - ally.x) : 0;
    if (direction && ally.grounded && !floorAt(ally.x + direction * 43)) {
        if (Math.abs(goal - ally.x) > 140) ally.jumpAt = run.t;
        else return;
    }
    stepActor(ally, direction, 6.9);
    if (ally.y > H + 125 || (Math.abs(ally.x - hero.x) > 660 && (ally.x < camera || ally.x > camera + W))) {
        const safe = floorAt(goal) ? goal : (floorAt(hero.x) ? hero.x : run.checkpoint);
        Object.assign(ally, actor(safe));
    }
}

function switchLead() {
    const next = run.lead === 'rock' ? 'blues' : 'rock';
    if (run.health[next] <= 0) return;
    run.lead = next;
    run.shotUntil = run.dashUntil = run.t;
    run.slashUntil = run.t;
    run.chargeAt = null;
}

function releaseCharge() {
    const charged = run.t - run.chargeAt >= 480;
    run.chargeAt = null;
    shoot(charged);
}

function slash() {
    if (run.slashUntil > run.t) return;
    run.slashUntil = run.t + 295;
    run.slashHit = false;
}

function shoot(charged = false, actor = run?.hero) {
    if (!actor) return;
    if (actor === run.hero) {
        if (run.chargeAt != null || run.t < run.shotUntil) return;
        run.shotUntil = run.t + 210;
    } else actor.shotUntil = run.t + 220;
    run.shots.push({ from: 'hero', x: actor.x + actor.direction * 34, y: actor.y - 59,
        vx: actor.direction * (charged ? 16 : 13), vy: 0, age: 0, damage: charged ? 3 : 1, charged });
}

function helpInCombat() {
    if (run.enemies.length === 0) return;
    const { ally, hero } = run;
    const enemy = run.enemies.find(e => !e.dead && Math.abs(e.x - ally.x) < 480 &&
        (e.type === 'met' ? e.phase === 'open' : e.type !== 'grinder' || run.bossStarted));
    if (enemy && ally.grounded && run.t >= (ally.nextShot ?? 0)) {
        ally.direction = Math.sign(enemy.x - ally.x) || 1;
        shoot(false, ally);
        ally.nextShot = run.t + 1100;
    }
    if (!(run.slashUntil > run.t) || run.slashHit) return;
    if (run.slashUntil - run.t > 205) return;
    const rect = { x: hero.direction > 0 ? hero.x : hero.x - 95, y: hero.y - 92, w: 95, h: 70 };
    const target = run.enemies.find(e => !e.dead && overlap(enemyBody(e), rect) &&
        (e.type === 'met' ? e.phase === 'open' : e.type !== 'grinder' || run.bossStarted && !hero.grounded));
    if (target) {
        run.slashHit = true;
        target.hp -= 2;
        target.flashUntil = run.t + 100;
        if (target.hp <= 0) kill(target);
    }
}

function hurt(cost) {
    if (run.t < run.invincibleUntil) return;
    run.health[run.lead] = Math.max(0, run.health[run.lead] - cost);
    run.invincibleUntil = run.t + 1050;
    if (run.health[run.lead] <= 0) {
        switchLead();
        if (run.health[run.lead] <= 0) respawn();
    }
}

function respawn(restoreHealth = true) {
    Object.assign(run.hero, actor(run.checkpoint));
    Object.assign(run.ally, actor(run.checkpoint - 82));
    run.camera = clamp(run.checkpoint - W * .42, 0, run.spec.width - W);
    if (restoreHealth) run.health.rock = run.health.blues = MAX_ADVENTURE_HEALTH;
    run.invincibleUntil = run.t + 1250;
    run.shots = [];
    if (run.bossStarted && !run.cleared) {
        const index = run.enemies.findIndex(enemy => enemy.type === 'grinder');
        if (index >= 0) run.enemies[index] = makeEnemy(['grinder', 4170]);
        run.bossStarted = false;
    }
    iris = { phase: 'open', elapsed: 0 };
}

function queueLines(id, section, priority = 0, start = 0, count = Infinity) {
    if (run.triggered.has(id)) return;
    run.triggered.add(id);
    if (priority > 0) {
        run.queue = run.queue.filter(line => line.priority >= priority);
        if (run.bubble?.priority < priority) run.bubble = null;
    }
    for (const [speaker, , text] of (storyLines[section] ?? []).slice(start, start + count)) {
        run.queue.push({ speaker, text, priority, duration: clamp(text.length * 67, 2400, 5500) });
    }
    if (run.queue.length > 6) run.queue.length = 6;
}

function bubbleStep() {
    if (run.bubble && run.t >= run.bubble.until) run.bubble = null;
    if (!run.bubble && run.queue.length) {
        const line = run.queue.shift();
        run.bubble = { ...line, since: run.t, until: run.t + line.duration };
    }
}

function routeTriggers() {
    const x = run.hero.x;
    if (run.name === 'lab') {
        if (x > 570) queueLines('lab-first', 2, 0, 0, 2);
        if (x > 1580) queueLines('lab-last', 2, 0, 2, 2);
        if (x > 2075) transition(() => {
            loadStage('street', run.actions, { lead: run.lead, health: run.health, maxHealth: MAX_ADVENTURE_HEALTH });
        }, true);
    } else if (run.name === 'street') {
        if (x > 430) queueLines('street-tank', 3, 0, 0, 2);
        if (x > 955) queueLines('street-met', 3, 0, 4, 2);
        if (x > 1810) queueLines('street-patrol', 4, 0, 0, 2);
        if (x > 2510) queueLines('duo', 4, 0, 2, 3);
        if (x > run.spec.checkpoint) run.checkpoint = run.spec.checkpoint;
        else if (x > 1250 && run.checkpoint < 1250) run.checkpoint = 1250;
        if (x > 3530 && !run.bossStarted && !run.cleared) {
            run.bossStarted = true;
            run.microUntil = run.t + 750;
            queueLines('rescue', 5, 2);
        }
    } else {
        for (const [speaker, position, radius] of [['roll', 94, 95], ['auto', 225, 122]]) {
            const visit = run.museumVisits[speaker];
            const nearby = Math.abs(x - position) < radius;
            if (nearby && !visit.nearby && visit.count < museumReminders[speaker].length) {
                const text = museumReminders[speaker][visit.count++](names[run.lead]);
                run.queue = run.queue.filter(line => line.speaker !== speaker);
                run.queue.push({ speaker, text, duration: 2900, priority: 0 });
            }
            visit.nearby = nearby || (visit.nearby && Math.abs(x - position) < radius + 20);
        }
        if (x > 850) queueLines('museum-capsules', 9, 0, 0, 2);
        if (x > 1920) queueLines('museum-panel', 9, 0, 2, 2);
        if (x > 3000) queueLines('museum-door', 9, 0, 4, 2);
        if (x > 3700) transition(() => run.actions.museumBoss?.({ lead: run.lead, health: run.health, maxHealth: MAX_ADVENTURE_HEALTH }));
    }
}

function transition(callback, reopen = false) {
    if (iris) return;
    run.queue = [];
    run.bubble = null;
    keys.clear();
    iris = { phase: 'close', elapsed: 0, callback, reopen };
}

function enemyBody(e) {
    const size = { tank: [81, 91], met: [60, 53], top: [62, 64], grinder: [202 * GRINDER_SCALE, 178 * GRINDER_SCALE] }[e.type];
    return { x: e.x - size[0] / 2, y: e.y - size[1], w: size[0], h: size[1] };
}

function attackShot(e, vx, vy, blade = false) {
    run.shots.push({ from: 'enemy', owner: e, x: e.x + e.direction * 26, y: e.y - (blade ? CREST.anchor : 34), vx, vy, age: 0, blade });
}

function enemyStep(e) {
    if (e.dead || Math.abs(e.x - run.hero.x) > 950) return;
    if (e.type === 'grinder' && (!run.bossStarted || run.microUntil > run.t)) return;
    const toward = Math.sign(run.hero.x - e.x) || 1;
    e.age++;
    if (e.type === 'met') {
        if (e.phase === 'idle' && Math.abs(e.x - run.hero.x) < 390 && e.age > 68) { e.phase = 'opening'; e.age = 0; e.direction = toward; }
        else if (e.phase === 'opening' && e.age >= 15) { e.phase = 'open'; e.age = 0; }
        else if (e.phase === 'open') {
            if (e.age === 24) for (const dy of [-2.4, 0, 2.4]) attackShot(e, e.direction * 6.8, dy);
            if (e.age > 44 && floorAt(e.x + e.direction * 24)) e.x += e.direction * 1.6;
            if (e.age >= 58) { e.phase = 'idle'; e.age = 0; }
        }
    } else if (e.type === 'tank') {
        e.direction = toward;
        if (floorAt(e.x + toward * 41) && Math.abs(e.x - e.origin) < 310) e.x += toward * 1.45;
        else if (floorAt(e.x - toward * 41)) { e.direction = -toward; e.x -= toward * 1.45; }
    } else if (e.type === 'top') {
        if (e.age < 42) e.y -= 2.7;
        else if (e.age === 42) { e.direction = toward; e.dive = clamp(Math.abs(run.hero.x - e.x) / 50, 3, 7); }
        else if (e.age < 92) { e.x = clamp(e.x + e.direction * e.dive, 45, run.spec.width - 50); e.y = Math.min(FLOOR - 18, e.y + 2.6); }
        else if (e.age > 120) e.age = 0;
    } else {
        if (e.phase === 'idle' && e.age < 60 && Math.abs(e.x - run.hero.x) > 270) {
            e.direction = toward;
            e.x = clamp(e.x + toward * 2.2, 3680, 4600);
        }
        if (e.phase === 'idle' && e.age >= 66) { e.phase = 'jump'; e.age = 0; e.direction = toward; }
        else if (e.phase === 'jump') {
            e.y = FLOOR - Math.max(0, Math.sin(e.age / 48 * Math.PI) * 133);
            if (e.age < 30) e.x = clamp(e.x + e.direction * 2.8, 3670, 4600);
            if (e.age >= 48) { e.phase = 'slam'; e.age = 0; e.y = FLOOR; run.shakeUntil = run.t + 220; }
        } else if (e.phase === 'slam') {
            const reach = 45 + e.age * 13;
            if (e.age < 28 && run.hero.grounded && Math.abs(e.x - run.hero.x) < reach) hurt(2);
            if (e.age >= 42) { e.phase = 'blade'; e.age = 0; e.direction = toward; }
        } else if (e.phase === 'blade') {
            if (e.age === 18) attackShot(e, e.direction * 8, -4, true);
            if (e.age >= 105) { e.phase = 'roll'; e.age = 0; e.direction = toward; }
        } else if (e.phase === 'roll') {
            if (e.age > 19 && e.age < 52) e.x = clamp(e.x + e.direction * 8.5, 3650, 4620);
            if (e.age >= 78) { e.phase = 'idle'; e.age = 0; }
        }
    }
    if (overlap(enemyBody(e), { x: run.hero.x - 24, y: run.hero.y - 95, w: 48, h: 95 })) hurt(e.type === 'grinder' ? 2 : 1);
}

function kill(e) {
    e.dead = true;
    e.deadAt = run.t;
    if (e.type === 'tank') {
        run.enemies.push(makeEnemy(['top', e.x]));
        queueLines('tank-head', 3, 0, 2, 2);
    }
    if (e.type === 'grinder') {
        run.cleared = true;
        run.finishedAt = run.t + 650;
        run.shots = run.shots.filter(shot => shot.owner !== e);
    }
}

function shotsStep() {
    for (const shot of run.shots) {
        if (shot.dead) continue;
        shot.age++;
        if (shot.blade) {
            if (shot.age > 59) {
                const dx = shot.owner.x - shot.x, dy = shot.owner.y - CREST.anchor - shot.y;
                const distance = Math.hypot(dx, dy);
                if (distance < 18) { shot.dead = true; continue; }
                shot.vx = dx / distance * 11;
                shot.vy = dy / distance * 11;
            } else {
                shot.vy = Math.min(11, shot.vy + .45);
                if (shot.y > FLOOR - CREST.height / 2) { shot.y = FLOOR - CREST.height / 2; shot.vy = 0; }
            }
        }
        shot.x += shot.vx;
        shot.y += shot.vy;
        if (shot.age > 130 || shot.x < 0 || shot.x > run.spec.width || shot.y > H + 100) { shot.dead = true; continue; }
        const w = shot.blade ? CREST.width * .76 : 16, h = shot.blade ? CREST.height * .72 : 10;
        const box = { x: shot.x - w/2, y: shot.y - h/2, w, h };
        if (shot.from === 'hero') {
            const enemy = run.enemies.find(e => !e.dead && (e.type !== 'grinder' || run.bossStarted && !(run.microUntil > run.t)) && overlap(enemyBody(e), box));
            if (!enemy) continue;
            shot.dead = true;
            const body = enemyBody(enemy);
            const vulnerable = enemy.type === 'met' ? enemy.phase === 'open' : enemy.type !== 'grinder' || shot.y < body.y + body.h * .78;
            enemy.flashUntil = run.t + 100;
            if (vulnerable) { enemy.hp -= shot.damage; if (enemy.hp <= 0) kill(enemy); }
        } else if (overlap(box, { x: run.hero.x - 24, y: run.hero.y - 94, w: 48, h: 94 })) {
            shot.dead = !shot.blade;
            hurt(1);
        }
    }
    run.shots = run.shots.filter(shot => !shot.dead);
}

function bitmap(img, sx, sy, sw, sh, x, y, dw, dh, flip = false) {
    if (!img || (img instanceof HTMLImageElement && (!img.complete || !img.naturalWidth))) return;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    if (flip) { ctx.translate(x + dw, y); ctx.scale(-1, 1); }
    ctx.drawImage(img, sx, sy, sw, sh, flip ? 0 : x, flip ? 0 : y, dw, dh);
    ctx.restore();
}

function drawStage() {
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, run.name === 'street' ? '#172f55' : '#121b33');
    sky.addColorStop(1, run.name === 'street' ? '#6096b7' : '#292852');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);
    const c = run.camera;
    if (run.name === 'lab') {
        bitmap(art.lab, 0, 34, 2172, 690, -c, 0, 2172, 690);
        bitmap(art.lab, 0, 723, 2172, 1, -c, 690, 2172, H - 690);
    } else if (run.name === 'street') {
        const img = prepared('street', [0x800080, 0x008000, 0x006300]);
        for (let i = -1; i <= 3; i++) bitmap(img, 0, 512, 1350, 186, i * 1350 - c * .25, 178, 1350, 186);
        // Secciones recompuestas a partir de las piezas planas de la hoja.
        for (const [index, [left, right, floor]] of run.spec.platforms.entries()) {
            const zoom = 2.5, width = right - left;
            if (right < c || left > c + W) continue;
            ctx.fillStyle = '#2a394a';
            ctx.fillRect(left - c, floor + 11, width, H - floor);
            bitmap(img, [0, 620, 1100][index], 10, width / zoom, 246, left - c, floor - 150 * zoom, width, 246 * zoom);
        }
    } else {
        const img = prepared('museum', [0x800080, 0x008000]);
        ctx.fillStyle = '#17232f';
        ctx.fillRect(0, FLOOR, W, H - FLOOR);
        bitmap(img, 0, 0, 1536, 225, -c, FLOOR - 209 * 2.5, 3840, 225 * 2.5);
    }
    if (run.name === 'museum') {
        const img = prepared('museum', [0x800080, 0x008000]);
        for (let x = 545; x < 3710; x += 320) {
            bitmap(img, 226, 0, 128, 27, x - c, 8, 320, 68);
            bitmap(img, 226, 214, 128, 10, x - c, FLOOR + 35, 320, 25);
        }
        for (const [left, right, top] of run.spec.ledges) {
            for (let x = left; x < right; x += 80) {
                const width = Math.min(80, right - x);
                bitmap(img, 544, 207, width / 2.5, 13, x - c, top, width, 32.5);
            }
        }
    }
    if (run.transport) {
        const img = prepared('street', [0x800080, 0x008000, 0x006300]);
        for (const [left, right] of run.spec.pits) {
            for (let x = left; x < right; x += 92) {
                const width = Math.min(92, right - x);
                bitmap(img, 99, 160, width / 2.5, 50, x - c, FLOOR, width, 125);
            }
        }
    }
    if (run.name !== 'street') {
        const x = run.name === 'lab' ? 2075 - c : 3700 - c;
        ctx.fillStyle = '#112435';
        ctx.fillRect(x - 40, FLOOR - 128, 79, 128);
        ctx.strokeStyle = '#81d5ff';
        ctx.lineWidth = 3;
        ctx.strokeRect(x - 40, FLOOR - 128, 79, 128);
        badge(x, FLOOR - 140, '→', '#cef8ff');
    }
}

function rockSprite(who, x = who.x - run.camera, feet = who.y, torso = false) {
    const moving = Math.abs(who.vx) > 1;
    const hero = who === run.hero && !torso;
    const fire = run.t < (hero ? run.shotUntil : who.shotUntil) && !torso;
    const key = torso ? 'idle' : hero && run.t < run.slashUntil ? 'slash' : hero && run.t < run.dashUntil ? 'dash' : !who.grounded ? (fire ? 'jumpfire' : 'jump')
        : moving ? (fire ? 'runfire' : 'run') : fire ? 'fire' : 'idle';
    const s = ROCK_SHEETS[key];
    const actionAge = hero && key === 'slash' ? 295 - (run.slashUntil - run.t) : null;
    const i = actionAge != null ? Math.min(s.n - 1, Math.floor(actionAge / 74)) : !who.grounded && !torso ? clamp(Math.floor((who.vy + 17) / 6), 0, s.n - 1) : Math.floor(run.t / (moving ? 56 : 145)) % s.n;
    const scale = torso ? 2.1 : 2.55;
    bitmap(s.img, i * s.cw, 0, s.cw, s.ch, x - (who.direction > 0 ? s.cw - s.pivotX : s.pivotX) * scale,
        feet - s.pivotY * scale, s.cw * scale, s.ch * scale, who.direction > 0);
}

function protoSprite(who, x = who.x, feet = who.y, torso = false) {
    const hero = who === run.hero && !torso;
    const key = torso ? 'protoIdle' : hero && run.t < run.slashUntil ? 'protoMelee' : hero && run.t < run.dashUntil ? 'protoDash' :
        run.t < (hero ? run.shotUntil : who.shotUntil) ? 'protoShot' : !who.grounded ? 'protoJump' : Math.abs(who.vx) > 1 ? 'protoRun' : 'protoIdle';
    const elapsed = hero && key === 'protoMelee' ? 295 - (run.slashUntil - run.t) : run.t;
    drawRobotFrame(ctx, robotFrame(key, elapsed, 74, x, feet, torso ? 2.15 : 2.65, who.direction), torso ? 0 : run.camera);
}

function rollSprite(x, feet, scale, torso = false) {
    const cells = [[0,22], [28,26], [58,26], [87,27], [118,26], [150,22], [180,22]];
    const [sx, width] = cells[Math.floor(run.t / 175) % cells.length];
    const height = torso ? 22 : 46;
    bitmap(art.roll, sx, 0, width, height, x - width * scale / 2, feet - height * scale,
        width * scale, height * scale);
}

function npcDraw() {
    if (run.name === 'lab') {
        const frame = Math.floor(run.t / 215) % 6;
        if (run.t < run.lightPointUntil) {
            bitmap(art.lightPoint, 0, 0, 47, 49, 35 - run.camera, FLOOR - 115, 110, 115, true);
        } else {
            bitmap(art.light, [42, 86, 130, 174, 217, 262][frame], 0, 36, 46,
                35 - run.camera, FLOOR - 115, 90, 115, true);
        }
    }
    if (run.name === 'street' && !run.transport) {
        rollSprite(4645 - run.camera, FLOOR, 2.22);
        bitmap(art.autoIdle, [4, 57, 111][Math.floor(run.t / 275) % 3], 57, 52, 59, 4700 - run.camera, FLOOR - 216, 192, 216);
    }
    if (run.name === 'museum') {
        rollSprite(94 - run.camera, FLOOR, 2.22);
        bitmap(art.autoIdle, [4, 57, 111][Math.floor(run.t / 275) % 3], 57, 52, 59, 130 - run.camera, FLOOR - 216, 192, 216);
    }
}

function drawEnemies() {
    const cam = run.camera;
    for (const e of run.enemies) {
        if (e.x < cam - 180 || e.x > cam + W + 180 || (e.dead && run.t - e.deadAt > 480)) continue;
        const x = e.x - cam;
        if (e.dead) {
            const t = (run.t - e.deadAt) / 480;
            ctx.fillStyle = '#ffe599';
            for (let i = 0; i < 7; i++) {
                const angle = i * Math.PI * 2 / 7;
                ctx.fillRect(x + Math.cos(angle) * (14 + 57 * t), e.y - 53 + Math.sin(angle) * (12 + 48 * t), 7, 7);
            }
            continue;
        }
        ctx.save();
        if (e.flashUntil > run.t && Math.floor(run.t / 30) % 2) ctx.globalAlpha = .5;
        if (e.type === 'met') {
            const frame = e.phase === 'idle' ? 0 : e.phase === 'opening' ? 1 : 3;
            bitmap(art.met, frame * 120, 0, 120, 100, x - 138, e.y - 230, 276, 230, e.direction > 0);
        } else if (e.type === 'tank' || e.type === 'top') {
            const bunby = prepared('bunby', [0x807058]);
            if (e.type === 'tank') bitmap(bunby, Math.floor(e.age / 6) % 3 * 44, 16, 44, 51, x - 45, e.y - 102, 90, 102, e.direction > 0);
            else bitmap(bunby, e.age > 42 && e.age < 92 ? 223 : 4, 87, 43, 44, x - 41, e.y - 83, 82, 83, e.direction > 0);
        } else {
            const detached = run.shots.some(shot => shot.owner === e && shot.blade && !shot.dead);
            const column = Math.floor(e.age / 4) % 5;
            const row = e.phase === 'jump' ? 116 : e.phase === 'roll' ? 345 : 0;
            const left = x - 111 * GRINDER_SCALE, top = e.y - 184 * GRINDER_SCALE;
            ctx.save();
            ctx.translate(e.direction > 0 ? left + 222 * GRINDER_SCALE : left, top);
            ctx.scale(e.direction > 0 ? -GRINDER_SCALE : GRINDER_SCALE, GRINDER_SCALE);
            const start = [8, 146, 282, 420, 556][column];
            if (detached) {
                bitmap(art.grinder, start, row + 61, 137, 55, 0, 97, 222, 87);
                bitmap(prepared('grinderBare', [0xff0080, 0xff00ff]), 5, 0, 119, 62, 0, 0, 193, 99);
            } else bitmap(art.grinder, start, row, 137, 116, 0, 0, 222, 184);
            ctx.restore();
            if (e.hp < 9) {
                ctx.fillStyle = '#45475788';
                for (let i = 0; i < 3; i++) {
                    const height = (e.age * 2 + i * 14) % 53;
                    ctx.fillRect(x + 26 + i * 6, e.y - 150 - height, 12, 10);
                }
            }
            if (e.phase === 'slam' && e.age < 28) {
                ctx.strokeStyle = '#ffcf7b';
                ctx.lineWidth = 4;
                ctx.beginPath();
                ctx.ellipse(x, FLOOR - 3, 25 + e.age * 13, 7, 0, 0, Math.PI * 2);
                ctx.stroke();
            }
        }
        ctx.restore();
    }
}

function drawShots() {
    for (const shot of run.shots) {
        const x = shot.x - run.camera;
        if (shot.blade) bitmap(prepared('grinderBare', [0xff0080, 0xff00ff]), 4, 121, 48, 36, x - CREST.width/2, shot.y - CREST.height/2, CREST.width, CREST.height, shot.vx > 0);
        else {
            ctx.fillStyle = shot.from === 'hero' ? '#fff4a4' : '#ffc460';
            ctx.beginPath();
            ctx.ellipse(x, shot.y, shot.charged ? 15 : 8, shot.charged ? 9 : 5, 0, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}

function badge(x, y, text, color = '#f4f8ff') {
    ctx.save();
    ctx.fillStyle = color;
    ctx.font = '700 18px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(text, x, y);
    ctx.restore();
}
function wrap(text, width) {
    const lines = [];
    let line = '';
    for (const word of text.split(' ')) {
        const proposed = line ? line + ' ' + word : word;
        if (line && ctx.measureText(proposed).width > width) { lines.push(line); line = word; }
        else line = proposed;
    }
    if (line) lines.push(line);
    return lines;
}
function drawBubble() {
    const line = run.bubble;
    if (!line) return;
    const npc = run.name === 'museum' ? { roll: 93, auto: 220 } : { roll: 4640, auto: 4795, light: 135 };
    const anchor = line.speaker === 'blues' || line.speaker === 'rock' ?
        (line.speaker === run.lead ? run.hero : run.ally) : { x: npc[line.speaker] ?? run.hero.x, y: FLOOR };
    if (run.name === 'museum' && npc[line.speaker] != null && Math.abs(run.hero.x - anchor.x) > 390) return;
    const transportOffset = { rock: -185, blues: -120, roll: -47, auto: 88 };
    const screenX = run.transport ? W / 2 + (transportOffset[line.speaker] ?? 0) : anchor.x - run.camera;
    const x = clamp(screenX, 168, W - 168);
    const y = run.transport ? (line.speaker === 'auto' ? 231 : 303) :
        clamp(anchor.y - (line.speaker === 'auto' ? 242 : 171), 147, 438);
    ctx.save();
    ctx.globalAlpha = Math.min(1, (run.t - line.since) / 150, (line.until - run.t) / 200);
    ctx.font = '600 16px system-ui';
    const lines = wrap(line.text, 280);
    const width = Math.min(308, Math.max(112, ...lines.map(item => ctx.measureText(item).width + 24)));
    const height = 36 + lines.length * 20;
    ctx.fillStyle = '#eef8ff';
    ctx.strokeStyle = '#32486a';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(x - width / 2, y - height, width, height, 12); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - 8, y - 1); ctx.lineTo(clamp(screenX, x - 34, x + 34), y + 12); ctx.lineTo(x + 10, y - 1); ctx.fill();
    ctx.fillStyle = '#162840';
    ctx.textAlign = 'center';
    ctx.fillText(names[line.speaker] ?? '', x, y - height + 20);
    for (const [i, item] of lines.entries()) ctx.fillText(item, x, y - height + 41 + i * 20);
    ctx.restore();
}

function drawTransport() {
    const x = W / 2 + Math.sin(run.t / 230) * 5, y = FLOOR;
    const left = x - 227, scale = 3.8;
    const column = 1 + Math.floor(run.t / 125) % 2;
    const sx = column * 140;
    const seat = y - 42 * scale;
    ctx.save();
    ctx.beginPath(); ctx.rect(left + 9, seat - 106, 226, 108); ctx.clip();
    const talking = run.bubble?.speaker;
    const rock = ROCK_SHEETS.idle;
    const rockPose = talking === 'rock' ? Math.floor(run.t / 150) % rock.n : 0;
    bitmap(rock.img, rockPose * rock.cw + 8, 0, 31, 31,
        left + 16, seat - 73, 73, 73, true);
    const proto = robotFrame('protoIdle', talking === 'blues' ? run.t : 0, 150, 0, 0, 1, 1);
    if (proto) bitmap(proto.img, proto.sx + 4, proto.sy, proto.sw - 7, 30, left + 76, seat - 70, (proto.sw - 7) * (70 / 30), 70, proto.flipX);
    const [rollX, rollWidth] = [[0,22],[28,26],[58,26],[87,27],[118,26],[150,22],[180,22]]
        [talking === 'roll' ? Math.floor(run.t / 165) % 7 : 0];
    bitmap(art.roll, rollX, 0, rollWidth, 25, left + 150, seat - 75, 69, 75);
    ctx.restore();
    bitmap(art.auto, sx, 0, 119, 80, left, y - 80 * scale, 119 * scale, 80 * scale);
}

function render() {
    ctx.save();
    if (run.shakeUntil > run.t) ctx.translate(Math.sin(run.t * .14) * 3, 0);
    drawStage();
    if (run.transport) drawTransport();
    else {
        npcDraw();
        drawEnemies();
        if (run.lead === 'rock') protoSprite(run.ally);
        else rockSprite(run.ally);
        if (run.t >= run.invincibleUntil || Math.floor(run.t / 75) % 2) {
            if (run.lead === 'rock') rockSprite(run.hero);
            else protoSprite(run.hero);
        }
        drawShots();
    }
    ctx.restore();
    if (!run.transport) {
        for (const [index, id] of ['rock', 'blues'].entries()) {
            const row = 20 + index * 27;
            ctx.fillStyle = '#142338';
            ctx.fillRect(100, row, 154, 19);
            ctx.fillStyle = id === 'rock' ? '#55d5ff' : '#ff605d';
            ctx.fillRect(103, row + 3, 148 * run.health[id] / MAX_ADVENTURE_HEALTH, 13);
            badge(57, row + 16, (run.lead === id ? '› ' : '') + (id === 'rock' ? 'ROCK' : 'PROTO'));
        }
        badge(203, 94, 'L / RB');
        badge(W - 125, 41, run.name === 'street' ? 'CALLE' : run.name === 'lab' ? 'LABORATORIO' : 'MUSEO');
        const boss = run.enemies.find(e => e.type === 'grinder' && !e.dead);
        if (boss && run.bossStarted) {
            ctx.fillStyle = '#292039'; ctx.fillRect(W / 2 - 125, 28, 250, 14);
            ctx.fillStyle = '#f0a14a'; ctx.fillRect(W / 2 - 125, 28, 250 * boss.hp / 16, 14);
        }
    }
    drawBubble();
    if (iris) {
        const amount = clamp(iris.elapsed / 720, 0, 1);
        const progress = iris.phase === 'open' ? amount : 1 - amount;
        const x = run.transport ? W / 2 : run.hero.x - run.camera;
        const y = run.hero.y - 55;
        const radius = progress * (Math.hypot(W, H) + 5);
        ctx.fillStyle = '#000';
        ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.moveTo(x + radius, y); ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill('evenodd');
    }
    if (paused) {
        ctx.fillStyle = '#030b1bd9'; ctx.fillRect(0, 0, W, H);
        badge(W / 2, H / 2 - 15, 'Pausa');
        badge(W / 2, H / 2 + 24, 'Esc / Menú para continuar · T para salir');
    }
}

export function tickAdventure(time) {
    if (!run) return;
    const pad = pollPad();
    const elapsed = Math.min(65, Math.max(0, time - (last || time)));
    last = time;
    if (paused) { render(); return; }
    if (iris) {
        iris.elapsed += elapsed;
        if (iris.elapsed >= 720) {
            const { phase, callback, reopen } = iris;
            iris = null;
            if (phase === 'close') {
                callback?.();
                ctx.fillStyle = '#000';
                ctx.fillRect(0, 0, W, H);
                if (run && reopen) iris = { phase: 'open', elapsed: 0 };
                return;
            }
        }
        render();
        return;
    }
    accumulator += elapsed;
    while (run && !iris && accumulator >= STEP) {
        accumulator -= STEP;
        run.t += STEP;
        bubbleStep();
        if (run.transport) {
            run.camera = Math.min(run.spec.width - W, 260 + run.t * .27);
            if (run.t >= 9000) transition(() => run.actions.arriveMuseum?.({ lead: run.lead, health: run.health, maxHealth: MAX_ADVENTURE_HEALTH }));
            continue;
        }
        if (run.microUntil > run.t) {
            run.camera += (clamp(3750 - W * .2, 0, run.spec.width - W) - run.camera) * .075;
            continue;
        }
        const keyboard = Number(keys.has('KeyD') || keys.has('ArrowRight')) - Number(keys.has('KeyA') || keys.has('ArrowLeft'));
        const direction = keyboard || pad;
        const dashing = run.t < run.dashUntil;
        if (keys.has('KeyJ')) shoot();
        stepActor(run.hero, dashing ? direction || run.hero.direction : direction, dashing ? 12 : 7.3);
        if (run.name === 'street' && run.bossStarted && !run.cleared) run.hero.x = clamp(run.hero.x, 3340, 4570);
        if (run.hero.y > H + 140) {
            run.invincibleUntil = 0;
            hurt(2);
            if (!iris) respawn(false);
            break;
        }
        follow();
        const screenX = run.hero.x - run.camera;
        if (screenX > 720 || screenX < 400) {
            const target = run.hero.x - (screenX > 720 ? 720 : 400);
            run.camera += (clamp(target, 0, run.spec.width - W) - run.camera) * .19;
        }
        routeTriggers();
        if (!iris) {
            helpInCombat();
            run.enemies.forEach(enemyStep);
            shotsStep();
        }
        if (run.finishedAt && run.t >= run.finishedAt) {
            run.bubble = null;
            render();
            const still = canvas.toDataURL();
            transition(() => run.actions.rescue?.(still, { lead: run.lead, health: run.health, maxHealth: MAX_ADVENTURE_HEALTH }));
        }
    }
    if (run) render();
}

export function adventureProgress() {
    if (!run) return null;
    return {
        name: run.name, lead: run.lead, shots: run.shots.length, x: run.hero.x, y: run.hero.y, health: run.health[run.lead], partyHealth: { ...run.health },
        checkpoint: run.checkpoint, enemies: run.enemies.map(({ type, hp, phase }) => ({ type, hp, phase })),
        iris: iris?.phase, bubble: run.bubble?.text, transport: !!run.transport,
        pointing: run.t < (run.lightPointUntil ?? 0),
        visits: run.museumVisits && Object.fromEntries(Object.entries(run.museumVisits).map(([key, visit]) => [key, visit.count]))
    };
}
