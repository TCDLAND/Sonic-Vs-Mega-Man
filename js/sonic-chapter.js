import { sonicChapterLines } from './sonic-chapter-lines.js';
import { SONIC_SHEETS } from './sonic.js';
import { tailsFrame } from './tails-sprites.js';
import { metalSpriteFrame } from './metal-sonic.js';
import { drawRobotFrame } from './robot-sprites.js';
import { music } from './music.js';
import { canvas, ctx, game } from './state.js';
import { GAME_STATE } from './config.js';
import { combatNow } from './combat-clock.js';

const folder = 'assets/story/sonic/';
const load = src => { const img = new Image(); img.src = src; return img; };
export const chapterBackgrounds = Object.fromEntries([
    ['altar', folder + 'altar-vacio.png'], ['eggmanEntry', 'assets/Fondos/instalaciones de Eggman.png'],
    ['shelter', 'assets/Fondos/Gimme Shelter.png'], ['deathEgg', 'assets/Fondos/Death Egg Arena.png'], ['deathEggDark', folder + 'death-egg-capsula-apagada.png']
].map(([id, src]) => [id, load(src)]));

export const chapterPortraits = Object.fromEntries(
    Object.entries({ sonic:'Sonic', knuckles:'Knuckles', tails:'Tails', eggman:'Eggman', metal:'Metal Sonic', tikal:'Tikal' })
        .map(([id, name]) => [id, 'assets/Retratos/Sonic/' + name + '.png'])
);

const scenes = [
    ['sonic-altar', 'altar', 'angelIsland', ['knuckles','tails']],
    ['sonic-entry', 'eggmanEntry', 'eggmanBase', ['sonic','eggman']],
    ['sonic-return', 'shelter', 'eggmanBase', ['knuckles','sonic'], { walk:'met' }],
    ['sonic-helmet', 'shelter', 'eggmanBase', ['sonic','eggman']],
    ['sonic-scan', 'shelter', 'eggmanBase', ['tails','eggman']],
    ['sonic-wake', 'deathEgg', 'eggmanBase', ['sonic','eggman'], { walk:'chase' }],
    ['sonic-metal', 'deathEgg', 'metalBattle', ['sonic','metal'], { boss:'metal', battleTrack:'metalBattle' }],
    ['sonic-rupture', 'deathEgg', null, ['sonic','tails']],
    ['sonic-tikal', 'altar', null, ['knuckles','tikal']],
    ['sonic-end', 'shelter', null, ['sonic','tails']]
];
export const sonicScenes = scenes.map(([id,bg,track,pair,extra], i) => ({
    id, bg, track, pair, lines: sonicChapterLines[i + 1], ...extra
}));
sonicScenes[2].lines[9] = [...sonicScenes[2].lines[9], 'knuckles-exit'];
sonicScenes[4].lines[9] = [...sonicScenes[4].lines[9], 'virus'];
sonicScenes[5].lines[2] = [...sonicScenes[5].lines[2], 'metal-wake'];
sonicScenes[5].lines[5] = [...sonicScenes[5].lines[5], 'link'];
sonicScenes[7].lines[6] = [...sonicScenes[7].lines[6], 'resonance'];
sonicScenes[7].lines[8] = [...sonicScenes[7].lines[8], 'rift'];
sonicScenes[8].lines[2] = [...sonicScenes[8].lines[2], 'tikal'];
const departure = sonicScenes[8].lines.findIndex(([speaker, , text]) => speaker === 'knuckles' && text.includes('¿Tikal?') && text.startsWith('...'));
if (departure >= 0) sonicScenes[8].lines[departure] = [...sonicScenes[8].lines[departure], 'altar-empty'];

export const dimensionalRegions = [
    ['emerald-beach','Emerald Beach'], ['green-hill','Green Hill Zone'], ['highway-x1','Highway Stage · Mega Man X1'],
    ['neo-arcadia','Neo Arcadia'], ['zero-space-x5','Zero Space Stage 3 · Mega Man X5'],
    ['solaris','End of the World / Solaris'], ['moon','Luna']
];

const art = {
    sonic: load('assets/images/sonic/' + SONIC_SHEETS.idle[0]),
    run: load('assets/images/sonic/' + SONIC_SHEETS.run[0]),
    jump: load('assets/images/sonic/' + SONIC_SHEETS.jump[0]),
    knuckles: load('assets/images/knuckles_idle.png'),
    knucklesRun: load('assets/images/knuckles_run.png'),
    eggman: load(folder + 'eggman.png'), tikal: load(folder + 'tikal.png'),
    master: load(folder + 'master-green.png'), chaos: load(folder + 'chaos-green.png'),
    met: load('assets/images/story-robots/met.png')
};

function frame(c, key, sx, sy, sw, sh, x, y, scale, face = 1, alpha = 1) {
    const img = art[key];
    if (!img.complete || !img.naturalWidth) return;
    c.save();
    c.globalAlpha *= alpha;
    c.imageSmoothingEnabled = false;
    c.translate(x, y);
    c.scale(face, 1);
    c.drawImage(img,sx,sy,sw,sh,-sw*scale/2,-sh*scale,sw*scale,sh*scale);
    c.restore();
}

function strip(c, key, count, i, x, feet, scale, face) {
    const img = art[key];
    if (!img.naturalWidth) return;
    const w = img.naturalWidth / count;
    frame(c, key, i % count * w, 0, w, img.naturalHeight, x, feet, scale, face);
}

function npc(c, key, x, feet, age, direction = 1) {
    if (key === 'knuckles') strip(c,key,8,Math.floor(age/135),x,feet,2.64,direction);
    else if (key === 'knucklesRun') strip(c,key,9,Math.floor(age/69),x,feet,2.64,direction);
    else if (key === 'tails') {
        const pose = tailsFrame('idle', Math.floor(age / 125), x, feet, 2.85, direction);
        drawRobotFrame(c, pose);
    }
    else if (key === 'eggman') frame(c,key,[4,42,81][Math.floor(age/215)%3],15,38,47,x,feet,3,-direction);
    else if (key === 'tikal') frame(c,key,[3,39,68,99,130,156][Math.floor(age/150)%6],231,26,37,x,feet,3,direction,.88);
    else if (key === 'sonic') strip(c,key,6,Math.floor(age/145),x,feet,3.19,direction);
}
function met(c, index, x, feet, face = 1) {
    frame(c,'met',120*index,0,120,100,x,feet,2,face);
}

function fracture(c, age, amount = 1) {
    c.save();
    c.globalAlpha = .48 * amount;
    c.strokeStyle = '#b9d5ff';
    c.lineWidth = 3;
    c.shadowBlur = 18;
    c.shadowColor = '#c796ff';
    for (const [i, x] of [231,670,1040].entries()) {
        const y = 190 + i * 35;
        c.beginPath();
        c.moveTo(x - 63, y - 91);
        for (let q = 1; q <= 8; q++) c.lineTo(x + Math.sin(q * 1.8 + age/470) * 31 + q * 4, y - 92 + q * 23);
        c.stroke();
    }
    c.restore();
}

export function drawSonicChapter(c, scene, lineIndex, age) {
    const id = scene.id;
    const isAltar = scene.bg === 'altar';
    const feet = isAltar ? 647 : 595;
    if (isAltar) {
        const vanished = id === 'sonic-tikal' && lineIndex >= departure && departure >= 0;
        if (!vanished) {
            c.save();
            c.shadowBlur = 19 + Math.sin(age / 100) * 7;
            c.shadowColor = '#63ff9a';
            frame(c,'master',0,0,96,73,640,423,2.23,1);
            c.restore();
        }
        const tikalScene=id==='sonic-tikal';
        const inApproach=tikalScene&&lineIndex>=5&&lineIndex<=7;
        const path=tikalScene ? lineIndex<5 ? 0 : lineIndex>7 ? 1
            : Math.min(1,((lineIndex-5)*430+age)/1170) : 0;
        const approachX=410+214*path;
        const approachY=647-168*path;
        c.save();
        c.fillStyle='#21173766';
        c.beginPath();c.ellipse(approachX,approachY-2,25,5,0,0,Math.PI*2);c.fill();
        c.restore();
        npc(c,inApproach&&path<1?'knucklesRun':'knuckles',approachX,approachY,age);
        if (tikalScene) {
            fracture(c,age,vanished ? .45 : .75);
            if (lineIndex>=2&&!vanished) {
                c.save();
                c.shadowBlur=12;
                c.shadowColor='#ffeab0';
                const fade=lineIndex===8?Math.max(.22,1-Math.max(0,age-660)/980):1;
                c.globalAlpha=fade;
                npc(c,'tikal',730,478,age,-1);
                if(lineIndex>=4&&lineIndex<=8){
                    const chaosFrames=[[20,59],[65,101],[107,147],[156,197],[210,251],[262,283]];
                    const cycle=[0,1,2,3,2,1];
                    const index = lineIndex===8&&age>820 ? Math.min(5,3+Math.floor((age-820)/145)) : cycle[Math.floor(age/125)%cycle.length];
                    const [left,right]=chaosFrames[index];
                    frame(c,'tikal',left,1209,right-left,38,823,494,2.55,-1,.85);
                }
                c.restore();
            }
            if (lineIndex === departure && age < 390) {
                c.fillStyle = 'rgba(255,250,235,' + (1 - age / 390) + ')';
                c.fillRect(0,0,1280,720);
            }
        }
        return;
    }
    npc(c,'sonic',402,feet,age);
    if (id === 'sonic-entry' || id === 'sonic-return' && lineIndex < 10) {
        const offset = id === 'sonic-return' && lineIndex === 9 ? Math.min(700, age * .9) : 0;
        npc(c,'knuckles',264-offset,feet,age,offset ? -1 : 1);
    }
    if (scene.bg !== 'deathEgg' || id === 'sonic-wake') {
        npc(c,'tails',507,feet,age);
        npc(c,'eggman',906,feet,age,-1);
    }
    if (id === 'sonic-entry') {
        for (let n = 0; n < 6; n++) frame(c,'chaos',n*33,0,33,25,799+n*26,393,.63,n%2 ? -1 : 1);
    }
    if (id === 'sonic-helmet') {
        met(c,lineIndex === 2 ? 1 : lineIndex >= 7 && lineIndex <= 8 ? 4 : 0,
            716 + (lineIndex === 2 ? Math.sin(age/65)*3 : lineIndex === 7 ? Math.min(46,age/14) : 0),feet);
    }
    if (id === 'sonic-scan') {
        met(c,lineIndex >= 9 ? 2 : 0,686,526);
        if (lineIndex >= 9) {
            c.strokeStyle='#fc6b99'; c.lineWidth=3; c.setLineDash([12,9]); c.lineDashOffset=-age/14;
            c.beginPath();c.moveTo(686,504);c.lineTo(686,434);c.lineTo(783,403);c.lineTo(826,313);c.stroke();
            c.setLineDash([]);c.fillStyle='#fb7f9b';c.font='bold 20px monospace';c.fillText('W // ENLACE EXTERNO',750,296);
        }
    }
    if (id === 'sonic-wake' && lineIndex >= 2 || id === 'sonic-metal' || id === 'sonic-rupture') {

        const x = id === 'sonic-wake' ? 715 + (lineIndex >= 5 ? Math.min(95,age*.14) : 0) : 845;
        drawRobotFrame(c,metalSpriteFrame(id === 'sonic-rupture' ? 'knockback' : 'idle',0,x,feet,3.4,-1));
    }
    if (id === 'sonic-wake' && lineIndex >= 5 || id === 'sonic-rupture' && lineIndex >= 1) {
        c.fillStyle='#32172ee0';c.fillRect(560,100,226,44);
        c.fillStyle='#ff9eaa';c.font='bold 15px monospace';c.fillText('WDL / ENVÍO PROGRAMADO',575,128);
    }
    if (id === 'sonic-rupture' && lineIndex >= 6 || id === 'sonic-end') fracture(c,age,lineIndex >= 8 || id === 'sonic-end' ? 1 : .45);
    if (id === 'sonic-end' && lineIndex >= 3) {
        const first = Math.floor(age / 1700) % dimensionalRegions.length;
        c.fillStyle = '#07192edb';
        c.fillRect(525, 170, 287, 124);
        c.fillStyle = '#91d9f9';
        c.font = '700 14px monospace';
        c.fillText('TAILS / REGIONES DETECTADAS', 542, 195);
        c.font = '13px monospace';
        for (let row = 0; row < 3; row++) {
            const [,name] = dimensionalRegions[(first + row) % dimensionalRegions.length];
            c.fillText('› ' + name, 542, 219 + row * 23);
        }
    }
}

let walk;
const keys = new Set();
let padPress = false;
let lastTime = 0;

export function startSonicWalk(kind, done, exit) {
    walk = { kind, done, exit, x: 318, metX: 764, y: 594, vy: 0, age:0, iris:0, finishAt:0, paused:false };
    keys.clear();
    lastTime = 0;
    music.play(kind === 'chase' ? 'metalBattle' : 'eggmanBase');
    game.gameState = GAME_STATE.SONIC_WALK;
}

export function sonicWalkKey(event, down) {
    if (!walk || game.gameState !== GAME_STATE.SONIC_WALK) return false;
    event.preventDefault();
    if (!down) keys.delete(event.code);
    else {
        keys.add(event.code);
        if (!event.repeat && event.code === 'Escape') {
            walk.paused = !walk.paused;
            if (walk.paused) music.pause(); else music.resume();
        }
        if (!event.repeat && event.code === 'KeyT' && walk.paused) { const {exit}=walk;walk=null;music.resume();exit(); }
    }
    return true;
}

function walkBubble(text, x, y) {
    ctx.save();ctx.font='600 17px system-ui';ctx.textAlign='center';
    const width = Math.min(520,ctx.measureText(text).width+34);
    ctx.fillStyle='#102744ed';ctx.beginPath();ctx.roundRect(x-width/2,y-23,width,42,10);ctx.fill();
    ctx.fillStyle='#f4faff';ctx.fillText(text,x,y+3);ctx.restore();
}

export function tickSonicWalk(time) {
    if (!walk) return;
    const w = walk;
    const delta = Math.min(50,Math.max(0,time-(lastTime||time)));
    lastTime=time;
    const pad = Array.from(navigator.getGamepads?.() ?? []).find(Boolean);
    const press = Boolean(pad?.buttons[0]?.pressed || pad?.buttons[2]?.pressed);
    const padAction = press && !padPress;
    padPress = press;
    const left = keys.has('KeyA') || keys.has('ArrowLeft') || pad?.axes[0]<-.45 || pad?.buttons[14]?.pressed;
    const right = keys.has('KeyD') || keys.has('ArrowRight') || pad?.axes[0]>.45 || pad?.buttons[15]?.pressed;
    const speed = Number(Boolean(right))-Number(Boolean(left));
    const floor = 594;
    if (!w.paused) {
        w.age+=delta;
        if (!w.finishAt && w.age > 400) {
            w.x=Math.max(185,Math.min(1110,w.x+speed*delta*.46));
            if ((keys.has('Space') || keys.has('KeyW') || keys.has('ArrowUp') || padAction && w.kind==='chase')&&w.y===floor) w.vy=-.75;
            w.vy+=delta*.00245;
            w.y=Math.min(floor,w.y+w.vy*delta);
            if (w.y===floor) w.vy=0;
            if (w.kind === 'met' && w.x>620) w.metX=Math.min(846,w.metX+delta*.12);
            if (w.kind === 'met' && (Math.abs(w.x-w.metX)<112 && (keys.has('KeyJ') || padAction) || w.x>930)) w.finishAt=w.age;
            if (w.kind === 'chase' && w.x>1050) w.finishAt=w.age;
        }
    }
    const image=chapterBackgrounds[w.kind==='met'?'shelter':'deathEggDark'];
    if (image.naturalWidth) ctx.drawImage(image,0,0,canvas.width,canvas.height);
    const x = w.x;
    const anim = w.y<floor?'jump':speed?'run':'sonic';
    const count = anim==='jump'?5:anim==='run'?9:6;
    strip(ctx,anim,count,Math.floor(w.age/(speed?63:145)),x,w.y,3.19,speed<0?-1:1);
    if (w.kind==='met') {
        met(ctx,w.x>620 && !w.finishAt ? 1+Math.floor(w.age/130)%4 : 0,w.metX,floor,1);
        if (w.x>605) walkBubble('J / A · Revisar el casco',Math.min(1010,w.metX),floor-124);
        else if (w.age>450 && w.age<4250) walkBubble('Tails · Revisa el extremo del pasillo.',385,109);
    } else {
        const metalX=Math.min(1190,Math.max(772,w.x+250));
        drawRobotFrame(ctx,metalSpriteFrame('run',Math.floor(w.age/60),metalX,floor,3.5,1));
        if (w.age>450&&w.age<4050) walkBubble('Tails · ¡Sonic, que no llegue a la salida!',377,109);
    }
    if (w.paused) walkBubble('Pausa · Esc para volver · T para salir',640,220);
    const shutter=w.finishAt ? 1-Math.min(1,(w.age-w.finishAt)/410) : Math.min(1,w.age/380);
    if(shutter<1){
        const r=Math.hypot(1280,720)*shutter;
        ctx.beginPath();ctx.rect(0,0,1280,720);ctx.moveTo(x+r,w.y-80);ctx.arc(x,w.y-80,r,0,Math.PI*2);
        ctx.fillStyle='#000';ctx.fill('evenodd');
    }
    if (w.finishAt&&w.age-w.finishAt>=410) { const done=w.done;walk=null;keys.clear();done(); }
}

let battleStart=0;
let battleBubble;
let delivered=new Set();
let metalObserved;
export function resetMetalDialogue() { battleStart=0;battleBubble=null;delivered=new Set();metalObserved={ dash:false, spin:false }; }
export function drawMetalDialogue() {
    if (game.countdown?.phase!=='go') return;
    const now=combatNow();
    battleStart ||= now;
    metalObserved ??= { dash:false, spin:false };
    metalObserved.dash ||= game.p2.isDashing;
    metalObserved.spin ||= game.p2.isSpinDashActive;
    if (battleBubble && battleBubble.end>now) {
        const sonic=battleBubble.name==='Sonic';
        const x=sonic?Math.max(179,Math.min(1100,game.p1.x-game.cameraX+game.p1.width/2)):366;
        const y=sonic?Math.max(245,game.p1.y-27):183;
        walkBubble(battleBubble.name+' · '+battleBubble.text,x,y);
        return;
    }
    const metal=game.p2;
    const cues=[
        ['start',true,'Tails','¡Su señal de control viene de otro lugar!'],
        ['dash',metalObserved.dash,'Sonic','¡Je! ¡Hasta corre como yo!'],
        ['spin',metalObserved.spin,'Tails','¡Cuidado, está copiando tu estilo!'],
        ['hit',metal.health<metal.maxHealth*.73,'Eggman','¡Metal Sonic, deja de ignorarme!'],
        ['link',now-battleStart>24000||metal.health<metal.maxHealth*.34,'Tails','¡El enlace está casi completo!']
    ];
    const cue=cues.find(([id,ready])=>ready&&!delivered.has(id));
    if(cue){delivered.add(cue[0]);battleBubble={name:cue[2],text:cue[3],end:now+3100};}
}
