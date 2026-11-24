import { music } from './music.js';
import { preflightAdventure, startAdventure, startTransport, stopAdventure } from './story-platform.js';
import { storyLines } from './story-script.js';
import { game } from './state.js';
import { GAME_STATE } from './config.js';
import { MAX_HEALTH } from './combat-system.js';
import { startBattle } from './battle.js';
import { sonicScenes, chapterBackgrounds, chapterPortraits, drawSonicChapter, startSonicWalk,
    resetMetalDialogue } from './sonic-chapter.js';
import { ROCK_SHEETS } from './rock.js';
import { robotFrame, drawRobotFrame } from './robot-sprites.js';
import { frameFor as emerlFrame } from './emerl.js';
import { shieldLayers } from './emerl-shield.js';

const backgrounds = {};
for (const [key, file] of Object.entries({ wily: 'DoctorWilyLab', light: 'DoctorLightLab', museum: 'Museo', city: 'DoctorLightLab' })) {
    backgrounds[key] = new Image();
    backgrounds[key].src = 'assets/Fondos/' + file + '.png';
}

backgrounds.museumEntrance = new Image();
backgrounds.museumEntrance.src = 'assets/story/museum-entrance.png';

const portraits = {
    wily: ['Dr. Wily', 'Wily/Wily_', 'Confiado'],
    bass: ['Bass', 'Bass/bass_', 'neutral'],
    rock: ['Rock', 'Mega Man/Rock_', 'normal'],
    blues: ['Blues', 'Proto Man/ProtoMan', ''],
    light: ['Dr. Light', 'Light/Light', ''],
    roll: ['Roll', null, 'roll'],
    auto: ['Auto', null, 'auto'],
    cut: ['Cut Man', null, 'cut'],
    guts: ['Guts Man', null, 'guts'],
    emerl: ['Emerl', 'Emerl/Emerl_', 'Normal']
};
const megaScenes = [
    { id: 'intro', bg: 'wily', track: 'wily_intro', pair: ['wily', 'bass'], lines: storyLines[0] },
    { id: 'lab', bg: 'light', track: 'light_lab', pair: ['light', 'rock'], lines: storyLines[1], exit: 'lab' },
    { id: 'rescue', bg: 'city', track: 'city_stage', pair: ['roll', 'rock'], lines: storyLines[6], exit: 'travel' },
    { id: 'arrival', bg: 'museumEntrance', track: 'museum', pair: ['rock', 'auto'], lines: storyLines[8], exit: 'museum' },
    { id: 'masters', bg: 'museum', track: 'museum', battleTrack: 'triple_boss', pair: ['rock', 'cut'], boss: 'masters', lines: storyLines[10] },
    { id: 'museumExit', bg: 'museum', track: 'museum', pair: ['rock', 'blues'], lines: storyLines[11] },
    { id: 'castle', bg: 'wily', track: 'castle_approach', pair: ['rock', 'blues'], lines: [['blues', '', 'Encontré la entrada. La señal viene del laboratorio.']] },
    { id: 'bass', bg: 'wily', track: 'bass_boss', battleTrack: 'bass_boss', pair: ['rock', 'bass'], boss: 'bass', lines: storyLines[12].slice(0, 7) },
    { id: 'afterBass', bg: 'wily', track: 'wily_final', pair: ['rock', 'bass'], lines: storyLines[12].slice(7) },
    { id: 'accident', bg: 'wily', track: 'wily_final', pair: ['rock', 'wily'], lines: [
        ...storyLines[13], [null, '', 'El portal se abre. La energía interrumpe el anclaje temporal.', 'alarm']
    ] },
    { id: 'emerl', bg: 'wily', track: null, battleTrack: 'emerl_boss', pair: ['rock', 'emerl'], boss: 'emerl', lines: [
        ...storyLines[14].slice(0, -2),
        [null, '', 'Emerl observa a Rock. Una cuadrícula de luz envuelve su brazo y aparece el Mega Buster.', 'copy'],
        [null, '', 'Luego observa a Blues. La barrera se condensa y toma la forma de su escudo.', 'copy-shield'],
        ...storyLines[14].slice(-2)
    ] },
    { id: 'end', bg: 'wily', track: null, pair: ['rock', 'blues'], lines: [
        [null, '', 'Emerl baja el brazo un instante. Al abrirse otra grieta, aprovecha para escapar.'],
        ['wily', 'Sorprendido', '¡La máquina sigue detectando anomalías!'],
        ['rock', 'normal', 'Primero tenemos que estabilizarla. Luego averiguaremos adónde fue.']
    ] }
];

let scenes = megaScenes;
let campaign = 'mega';
let previousBackground;
const progressKey = 'sonic-vs-megaman-campaign-v1';
function readProgress() {
    try { return JSON.parse(localStorage.getItem(progressKey)) ?? {}; } catch { return {}; }
}
function saveProgress(flags) {
    try { localStorage.setItem(progressKey, JSON.stringify({ ...readProgress(), ...flags })); } catch {}
}
Object.assign(backgrounds, chapterBackgrounds);
for (const [id, label] of Object.entries({ sonic:'Sonic', knuckles:'Knuckles', tails:'Tails', eggman:'Eggman', metal:'Metal Sonic', tikal:'Tikal' })) {
    portraits[id] = [label, null, ''];
}

const customPortraits = {
    ...chapterPortraits,
    roll: 'assets/story/roll-dialog.png', auto: 'assets/story/auto-dialog.png',
    cut: 'assets/story/Cutmanretrato.png', guts: 'assets/story/Gutsmanretrato.png'
};

export let storyStage = null;
let sceneIndex = 0;
let lineIndex = 0;
let bassCheckpoint;
let emerlOpponent;
let sceneJump = false;
let audited = false;
let rescueBackdrop;
let adventureParty;
const expressions = {};
const panel = document.createElement('dialog');
panel.className = 'story-dialog';
panel.setAttribute('aria-label', 'Prólogo');
panel.innerHTML = '<div class="story-scene"><div class="story-portrait"></div><div class="story-speech"><strong></strong><p></p><button type="button">Continuar</button></div><div class="story-portrait"></div><div class="story-nav"><button class="story-select" type="button">Elegir escena</button><button class="story-exit" type="button">Salir</button></div><div class="story-choices" hidden></div></div>';
document.body.append(panel);
const stage = panel.querySelector('.story-scene');
const slots = panel.querySelectorAll('.story-portrait');
const cast = document.createElement('canvas');
cast.className = 'story-cast';
cast.width = 1280;
cast.height = 720;
cast.setAttribute('aria-hidden', 'true');
stage.prepend(cast);
const castContext = cast.getContext('2d');
const light = [
    ['assets/story/light-idle.png', 44],
    ['assets/story/light-point.png', 47]
].map(([src, width]) => { const image = new Image(); image.src = src; return { image, width }; });
let castStarted = 0;
let castSpeaker;
let castPair = [];
let castEvent;
let castPoint = false;
const speaker = panel.querySelector('strong');
const dialogue = panel.querySelector('p');
const next = panel.querySelector('.story-speech button');
const leave = panel.querySelector('.story-exit');
const chooseScene = panel.querySelector('.story-select');
const choices = panel.querySelector('.story-choices');

function showChoices(title, options, cancel) {
    const heading = document.createElement('h2');
    heading.textContent = title;
    choices.replaceChildren(heading);
    for (const [label, action, disabled] of [...options, ['Volver', cancel]]) {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = label;
        button.disabled = Boolean(disabled);
        button.onclick = () => { choices.hidden = true; action(); };
        choices.append(button);
    }
    choices.hidden = false;
    choices.querySelector('button:not(:disabled)').focus();
}

function selectDuelFighter() {
    showChoices('¿Con quién peleas contra Emerl?', [['Rock', () => select('rock')], ['Blues', () => select('protoman')]],
        () => { if (sceneJump) showSceneChoices(); else next.focus(); });
    function select(id) { emerlOpponent = id; playBoss(); }
}

function showSceneChoices() {
    if (campaign === 'sonic') {
        const options = new URLSearchParams(location.search).has('chapter-test')
            ? [['Altar', () => goTo('sonic-altar')], ['Casco', () => goTo('sonic-helmet')],
                ['Contra Metal Sonic', () => goTo('sonic-metal')], ['Tikal', () => goTo('sonic-tikal')]]
            : [['Reiniciar capítulo', () => startSonicChapter()]];
        showChoices('Sonic — Capítulo 1', options, () => next.focus());
        return;
    }
    showChoices('Elegir escena', [
        ['Rock y Blues vs. Robot Masters', () => jumpTo('masters')],
        ['Contra Bass', () => jumpTo('bass')],
        ['Contra Emerl', () => jumpTo('emerl')],
        ['Laboratorio de Light', () => beginAdventure('lab')],
        ['Inicio de calle', () => beginAdventure('street')],
        ['Rescate de Roll y Auto', () => beginAdventure('street', { startAt: 3250 })],
        ['Entrada del museo', () => goTo('arrival')],
        ['Wily y el accidente', () => goTo('accident')]
    ], () => next.focus());
    function jumpTo(boss) {
        sceneIndex = scenes.findIndex(scene => scene.boss === boss);
        sceneJump = true;
        bassCheckpoint = undefined;
        emerlOpponent = undefined;
        next.textContent = 'Continuar';
        lineIndex = 0;
        paintLine();
        if (boss === 'emerl') selectDuelFighter();
        else playBoss();
    }
}
chooseScene.onclick = showSceneChoices;

function goTo(id) {
    stopAdventure();
    sceneIndex = scenes.findIndex(scene => scene.id === id);
    showScene();
}

function beginAdventure(id, options) {
    panel.close();
    const actions = {
        rescue: (image, party) => { rescueBackdrop = image; adventureParty = party; goTo('rescue'); },
        arriveMuseum: party => { adventureParty = party; goTo('arrival'); },
        museumBoss: party => { adventureParty = party; goTo('masters'); },
        exit: closeStory
    };
    if (id === 'travel') startTransport(actions, adventureParty);
    else startAdventure(id, actions, { party: adventureParty, ...options });
}

function paintLine() {
    const scene = scenes[sceneIndex];
    const [who, expression, text, event] = scene.lines[lineIndex];
    const source = campaign === 'sonic' && scene.bg === 'deathEgg' && (scene.id !== 'sonic-wake' || lineIndex >= 2)
        ? chapterBackgrounds.deathEggDark.src : backgrounds[scene.bg].src;
    stage.classList.toggle('sonic-story', campaign === 'sonic');
    if (campaign === 'sonic' && source !== previousBackground) {
        stage.animate([{ opacity: .14 }, { opacity: 1 }], { duration: 300 });
        previousBackground = source;
    }
    if (who) expressions[who] = expression;
    stage.style.backgroundImage = 'url("' + (scene.id === 'rescue' && rescueBackdrop ? rescueBackdrop : source) + '")';
    stage.classList.remove('story-alarm');
    stage.classList.toggle('story-museum-entrance', scene.id === 'arrival');
    castEvent = event;
    stage.classList.toggle('story-copy', event === 'copy' || event === 'copy-shield');
    stage.classList.toggle('story-copy-shield', event === 'copy-shield');
    castPoint = scene.id === 'lab' && who === 'light' && text.includes('por la derecha');
    stage.classList.toggle('story-light-point', castPoint);
    castStarted = performance.now();
    castSpeaker = who;
    if (event === 'tikal') music.play('tikalMoment');
    if (event === 'altar-empty') music.stop(500);
    if (['alarm', 'virus', 'rift'].includes(event)) stage.classList.add('story-alarm');
    if (event === 'alarm') music.stop(350);
    if (event === 'alarm') stage.classList.add('story-alarm');
    const pair = campaign === 'sonic' && scene.id === 'sonic-return' && lineIndex >= 10
        ? ['tails', 'sonic'] : campaign === 'sonic' && scene.id === 'sonic-tikal' && (lineIndex < 2 || scene.lines.slice(0,lineIndex+1).some(line => line[3] === 'altar-empty'))
        ? ['knuckles', null] : [...scene.pair];
    if (who && !pair.includes(who)) pair[1] = who;
    castPair = pair;
    pair.forEach((id, index) => {
        slots[index].style.visibility = id ? '' : 'hidden';
        if (!id) { slots[index].replaceChildren(); return; }
        const [name, path, fallback] = portraits[id];
        const image = new Image();
        image.alt = name;
        image.src = customPortraits[id] ?? ('assets/Retratos/' + path + (expressions[id] || fallback) + '.png');
        image.classList.toggle('story-sprite-portrait', id === 'roll' || id === 'auto');
        if (path) image.onerror = () => { image.onerror = null; image.src = 'assets/Retratos/' + path + fallback + '.png'; };
        slots[index].replaceChildren(image);
        slots[index].classList.toggle('speaking', id === who);
    });
    speaker.textContent = who ? portraits[who][0] : '';
    dialogue.textContent = text;
}

function showScene() {
    lineIndex = 0;
    next.textContent = 'Continuar';
    game.gameState = GAME_STATE.STORY;
    const track = scenes[sceneIndex].track;
    if (track) music.play(track); else music.stop();
    paintLine();
    if (!panel.open) panel.showModal();
    next.focus();
}

export function openStoryCampaigns() {
    stopAdventure();
    game.gameState = GAME_STATE.STORY;
    storyStage = null;
    panel.setAttribute('aria-label', 'Campañas');
    if (!panel.open) panel.showModal();
    const flags = readProgress();
    const test = new URLSearchParams(location.search).has('chapter-test');
    const options = [['Mega Man · Prólogo compartido', startStory]];
    options.push(flags.sharedPrologueComplete
        ? ['Sonic — Capítulo 1', startSonicChapter]
        : ['Sonic — Capítulo 1 · Completa primero el prólogo', null, true]);
    if (test && !flags.sharedPrologueComplete) options.push(['Probar Sonic — Capítulo 1', startSonicChapter]);
    options.push(['Emerl · Campaña futura', null, true]);
    showChoices('Campañas', options, closeStory);
}

export function startSonicChapter() {
    campaign = 'sonic';
    scenes = sonicScenes;
    sceneJump = false;
    choices.hidden = true;
    sceneIndex = 0;
    previousBackground = undefined;
    panel.setAttribute('aria-label', 'Sonic — Capítulo 1');
    showScene();
}

export function startStory() {
    campaign = 'mega';
    scenes = megaScenes;
    panel.setAttribute('aria-label', 'Prólogo');
    if (!audited) { preflightAdventure(); audited = true; }
    emerlOpponent = undefined;
    rescueBackdrop = undefined;
    adventureParty = undefined;
    sceneJump = false;
    choices.hidden = true;
    sceneIndex = 0;
    bassCheckpoint = undefined;
    for (const key of Object.keys(expressions)) delete expressions[key];
    showScene();
}

function playBoss() {
    panel.close();
    storyStage = campaign === 'sonic' ? chapterBackgrounds.deathEggDark : backgrounds[scenes[sceneIndex].bg];
    game.mode = 'story';
    music.play(scenes[sceneIndex].battleTrack);
    game.controlOverrides = null;
    if (campaign === 'sonic') {
        resetMetalDialogue();
        startBattle({ rosters: [['sonic'], ['metal-sonic']], infected: true });
        return;
    }
    const againstBass = scenes[sceneIndex].boss === 'bass';
    const againstEmerl = scenes[sceneIndex].boss === 'emerl';
    startBattle({
        rosters: againstEmerl ? [[emerlOpponent], ['emerl']] : [['rock', 'protoman'], againstBass ? ['bass'] : ['cut', 'guts', 'heat']],
        ...(againstBass ? bassCheckpoint : !againstEmerl && !sceneJump && adventureParty ? {
            health: ['rock', 'blues'].map(id => adventureParty.health[id] * MAX_HEALTH / adventureParty.maxHealth),
            activeIndex: adventureParty.lead === 'rock' ? 0 : 1
        } : undefined)
    });
    if (againstEmerl) {
        if (emerlOpponent === 'rock') game.p2.unlockRockCopy();
        else game.p2.unlockShieldCopy();
    }
}

export function showStoryResult(won) {
    game.gameState = GAME_STATE.STORY;
    storyStage = null;
    if (won) {
        if (sceneJump) { closeStory(); return; }
        if (campaign === 'mega' && scenes[sceneIndex].boss === 'emerl') saveProgress({ sharedPrologueComplete:true });
        if (scenes[sceneIndex].boss === 'masters') {
            bassCheckpoint = {
                health: game.teamFighters.p1.map(fighter => Math.max(0, fighter.health)),
                activeIndex: game.teamActiveIndex.p1
            };
        }
        sceneIndex++;
        showScene();
        return;
    }
    panel.showModal();
    speaker.textContent = campaign === 'sonic' ? 'Sonic' : 'Rock';
    dialogue.textContent = 'Hay que volver a intentarlo.';
    next.textContent = 'Reintentar';
    next.focus();
}

function advance() {
    if (!choices.hidden) return;
    if (next.textContent === 'Reintentar') {
        next.textContent = 'Continuar';
        playBoss();
        return;
    }
    const scene = scenes[sceneIndex];
    if (++lineIndex < scene.lines.length) paintLine();
    else if (scene.boss === 'emerl' && !emerlOpponent) { lineIndex--; selectDuelFighter(); }
    else if (scene.boss) playBoss();
    else if (scene.exit) beginAdventure(scene.exit);
    else if (scene.walk) {
        panel.close();
        startSonicWalk(scene.walk, () => { sceneIndex++; showScene(); }, openStoryCampaigns);
    } else if (++sceneIndex < scenes.length) showScene();
    else if (campaign === 'sonic') {
        saveProgress({ sonicChapter1Complete:true, dimensionalRuptureObserved:true });
        showChoices('Fin del capítulo 1 — Sonic', [['Volver a campañas', openStoryCampaigns]], openStoryCampaigns);
    } else openStoryCampaigns();
}

export function closeStory() {
    stopAdventure();
    music.stop();
    choices.hidden = true;
    panel.close();
    storyStage = null;
    next.textContent = 'Continuar';
    game.gameState = GAME_STATE.MODE;
}

next.onclick = advance;
leave.onclick = closeStory;
panel.addEventListener('cancel', event => { event.preventDefault(); closeStory(); });
panel.addEventListener('keydown', event => {
    if (!event.repeat && ['KeyJ', 'Comma'].includes(event.code)) { event.preventDefault(); advance(); }
});

let padPressed = false;
let padNavigation = 0;
function drawCast() {
    const c = castContext;
    const age = performance.now() - castStarted;
    const copying = castEvent === 'copy' || castEvent === 'copy-shield';
    const scene = scenes[sceneIndex];
    c.clearRect(0, 0, cast.width, cast.height);
    c.imageSmoothingEnabled = false;
    if (campaign === 'sonic') { drawSonicChapter(c, scene, Math.min(lineIndex, scene.lines.length - 1), age); return; }
    if (copying) {
        const from = castEvent === 'copy' ? 'rock' : 'blues';
        drawCastMember('blues', from === 'blues' ? 493 : 366, 520, 1, age, false);
        drawCastMember('rock', from === 'rock' ? 493 : 366, 520, 1, age, false);
        const key = castEvent === 'copy' && age > 220 ? 'equip' : 'idle';
        const e = emerlFrame(key, key === 'idle' ? 0 : Math.min(6, Math.floor((age - 220) / 90)), 790, 520, 3, -1);
        if (castEvent === 'copy-shield' && age > 320) {
            const layers = shieldLayers(true, 0, 790, 520, 3, -1);
            if (layers?.body) drawRobotFrame(c, layers.body);
            else drawRobotFrame(c, e);
            if (layers?.shield?.img.complete) drawRobotFrame(c, layers.shield);
        } else drawRobotFrame(c, e);
        const strength = Math.max(0, 1 - age / 1250);
        c.fillStyle = '#89f2ff';
        c.globalAlpha = strength;
        for (let i = 0; i < 24; i++) {
            const x = 734 + (i * 37 + age * .08) % 114;
            const y = 408 + (i * 29 + age * .21) % 108;
            c.fillRect(x, y, 5, 5);
        }
        c.globalAlpha = 1;
        return;
    }
    const lab = scene.id === 'lab';
    if (lab) drawCastMember('light', 406, 637, 1, age, castPoint && age < 1250);
    castPair.forEach((id, index) => {
        if (id !== 'rock' && id !== 'blues') return;
        const x = lab ? 650 : index === 0 ? 455 : 815;
        drawCastMember(id, x, lab ? 635 : scene.id === 'arrival' ? 681 : 520, index === 0 ? 1 : -1, age, id === castSpeaker);
    });
}

function drawCastMember(id, x, feet, direction, age, speaking) {
    const c = castContext;
    const frame = speaking && age < 2400 ? 1 + Math.floor(age / 140) % 3 : 0;
    if (id === 'light') {
        const { image, width } = light[speaking ? 1 : 0];
        if (image.complete && image.naturalWidth) {
            c.save();
            c.translate(x, feet);
            c.scale(-1, 1);
            c.drawImage(image, -width * 1.35, -125, width * 2.7, 125);
            c.restore();
        }
    } else if (id === 'rock') {
        const { img } = ROCK_SHEETS.idle;
        if (img.complete && img.naturalWidth) drawRobotFrame(c, {
            img, sx: frame * 48, sy: 0, sw: 48, sh: 48, flipX: direction > 0,
            dx: x - 72, dy: feet - 144, dw: 144, dh: 144
        });
    } else drawRobotFrame(c, robotFrame('protoIdle', frame * 100, 100, x, feet, 3, direction));
}

export function pollStoryPad() {
    if (panel.open && choices.hidden) drawCast();
    const pad = Array.from(navigator.getGamepads?.() || []).find(Boolean);
    const pressed = Boolean(pad?.buttons[0]?.pressed);
    const direction = Number(Boolean(pad?.buttons[13]?.pressed)) - Number(Boolean(pad?.buttons[12]?.pressed)) ||
        (Math.abs(pad?.axes[1] ?? 0) > .45 ? Math.sign(pad.axes[1]) : 0);
    if (direction && direction !== padNavigation && panel.open && !choices.hidden) {
        const buttons = [...choices.querySelectorAll('button:not(:disabled)')];
        const index = buttons.indexOf(document.activeElement);
        buttons[(index + direction + buttons.length) % buttons.length]?.focus();
    }
    padNavigation = direction;
    if (pressed && !padPressed && panel.open) {
        if (!choices.hidden && choices.contains(document.activeElement)) document.activeElement.click();
        else advance();
    }
    padPressed = pressed;
}
