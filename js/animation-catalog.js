import { sonicBattleClips } from './sonic-battle-kit.js';
import { updatedFrame, updatedCells } from './fighter-update-art.js';
import { silverAnimations } from './silver.js';
import { chaosAnimations } from './chaos.js';
import { tailsAnimations } from './tails-sprites.js';
import { formAnimations } from './super-forms.js';
import { mmZeroAnimations } from './megaman-zero.js';
import { metalAnimations } from './metal-sonic.js';
import { emerlAnimations } from './emerl.js';
import { storyRobotAnimations } from './story-robot.js';
import { X_FRAMES } from './x-frames.js';
import { X_POLISH } from './x-polish-frames.js';
import { chargedSpriteFrame } from './charge-palette.js';
import { ROBOT_FRAMES } from './robot-frames.js';
import { robotFrame, bassSpriteScale, BASS_IDLE_FRAME_MS } from './robot-sprites.js';
import { SONIC_SHEETS } from './sonic.js';
import { ROCK_SHEETS, RUSH_S, BEAT_S } from './rock.js';
import { KNUCKLES_SHEETS } from './knuckles.js';
import { EXTRA_SHEETS, ZERO_SHEETS } from './zero.js';
import { ZERO_TECHNIQUES } from './zero-techniques.js';
import { ZERO_TECHNIQUE_FRAMES } from './zero-technique-frames.js';
import { SHADOW_ANIMATIONS } from './shadow.js';
import { TREBLE_ANIMATIONS } from './animations.js';
import { espioSprite3 } from './assets.js';
import { getCellCoords } from './utils.js';

const pictures = new Map();
function picture(name) {
    if (!pictures.has(name)) {
        const image = new Image();
        image.src = 'assets/images/' + name;
        pictures.set(name, image);
    }
    return pictures.get(name);
}

const names = {
    idle: 'Idle', idleHurt: 'Idle herido', hurtIdle: 'Idle herido', intro: 'Entrada', run: 'Carrera',
    runShot: 'Carrera con disparo', runfire: 'Carrera con disparo', jump: 'Salto', fall: 'CaÃ­da',
    dash: 'Dash', shot: 'Disparo', charged: 'Disparo cargado', airShot: 'Disparo aÃ©reo',
    wall: 'Agarre de pared', wallKick: 'Salto de pared', wallShot: 'Disparo en pared', nova: 'Nova Strike',
    hurt: 'Golpe recibido', hit: 'Golpe recibido', airhit: 'Golpe recibido en el aire',
    guard: 'Guardia', crouch: 'Agachado', saber: 'Sable en suelo', airSaber: 'Sable aÃ©reo',
    slashA: 'Corte A', slashB: 'Corte B', slashC: 'Corte C', airSlash: 'Corte aÃ©reo',
    slidingSaber: 'Sable deslizante', crouchSaber: 'Corte agachado', busterPose: 'Postura del Buster',
    land: 'Barrido al ras', wallkick: 'Patada de pared', burst: 'Pulso',
    thrust: 'Estocada elÃ©ctrica', fireup: 'Ascenso de fuego', elecup: 'Ascenso elÃ©ctrico',
    icedive: 'Picado de hielo', firedive: 'Picado de fuego', airspin: 'Giro aÃ©reo',
    frostdash: 'Deslizamiento de hielo', punch: 'PuÃ±o', punch2: 'Segundo puÃ±o', topKick: 'Patada alta',
    sideKick: 'Patada lateral', rocket: 'Rocket', spinCharge: 'Carga de Spin Dash', spin: 'Spin Dash',
    brake: 'Freno', reverseBrake: 'Freno inverso', miner: 'Topo', dirt: 'Rastro del topo', grab: 'Agarre',
    upper: 'Golpe ascendente', glide: 'Planeo', charge: 'Disparo cargado', jumpfire: 'Disparo en salto',
    cutshot: 'Rolling Cutter', flamesword: 'Flame Sword', slash: 'Slash Claw', fire: 'Buster',
    shield: 'Escudo', shieldWalk: 'Caminar con escudo', shieldAir: 'Escudo en el aire',
    hardHurt: 'Golpe recibido Â· retroceso fuerte', bash: 'Escudazo', melee: 'Golpe cercano', kick: 'Patada ascendente', dodge: 'Esquiva',
    airPunch: 'PuÃ±o aÃ©reo', jet: 'Bass Jet', barrier: 'Barrera de proyectiles', guardImpact: 'Impacto bloqueado', retreat: 'Retroceso', upShot: 'Disparo hacia arriba o diagonal', low: 'Agachado',
    runStart: 'Inicio de carrera', runEnd: 'Fin de carrera', stopping: 'Freno',
    turning: 'Giro', jumping: 'Salto', falling: 'CaÃ­da', landing: 'Aterrizaje',
    teleport: 'Teletransporte, salida', teleportAppear: 'Teletransporte, llegada',
    chop: 'Chop', backKick: 'Patada hacia atrÃ¡s', nightmare: 'Chaos Nightmare',
    upperHit: 'Impacto ascendente', slider: 'Slider', toward: 'Avance',
    chaosMagic: 'Chaos Magic', airMagic: 'Chaos Magic aÃ©reo', airBurst: 'Burst aÃ©reo',
    roaming: 'Chaos Roaming', airRoaming: 'Chaos Roaming aÃ©reo', orb: 'Proyectil Chaos Roaming',
    caminar: 'Caminar', correr: 'Correr', bison: 'Bison', coil: 'Rush Coil', jet: 'Rush Jet',
    follow: 'Seguimiento', lados: 'Vuelo lateral', tongue: 'Lengua frontal', tongueUp: 'Lengua hacia arriba',
    heavy: 'Golpe fuerte', lightKick: 'Patada ligera', heavyKick: 'Patada fuerte',
    shuriken: 'Shuriken', kunai: 'Kunai', wallCling: 'Agarre de pared', wallSlide: 'Deslizamiento de pared'
};

function clip(id, count, ms, frame, name = names[id] ?? id) {
    return { id, count, ms, frame, name };
}

function source(img, sx, sy, sw, sh, anchor = sw / 2, feet = sh, flip = false, scale = 1) {
    if (!img?.complete || !img.naturalWidth || !sw || !sh) return null;
    return { img, sx, sy, sw, sh, dx: -(flip ? sw - anchor : anchor) * scale, dy: -feet * scale,
        dw: sw * scale, dh: sh * scale, flipX: flip };
}

function atlasClips(data, img, timings, flip = true, withAnchors = true) {
    return Object.entries(data).map(([key, cells]) => clip(key, cells.length, timings[key] || 70, i => {
        const [sx, sy, sw, sh, anchor, feet] = cells[i];
        return source(img, sx, sy, sw, sh, anchor, withAnchors ? feet : sh, flip);
    }));
}

function chargeClips(id, count, idle) {
    return Array.from({ length:count }, (_, index) => clip('charge-level-' + (index+1), 2, 95, frame => {
        const sprite = idle.frame(0);
        return sprite ? chargedSpriteFrame(sprite, id, index+1, frame*95) : null;
    }, 'Carga de Buster Â· nivel ' + (index+1)));
}

function stripClips(sheets, timings, facing = false, prefix = '') {
    return Object.entries(sheets).map(([key, s]) => clip(prefix ? prefix.trim() + ' ' + key : key, s.n ?? s.frames, timings[key] || 93, i => {
        const w = s.cw ?? s.w ?? s.frameW, h = s.ch ?? s.h ?? s.frameH;
        return source(s.img, (s.start || 0) + i * (w + (s.gap || 0)), 0, w, h,
            s.pivotX, s.pivotY, s.sourceFacing ? s.sourceFacing < 0 : facing);
    }, prefix + (names[key] ?? key)));
}

function effectClips(entries) {
    return entries.map(([id, name, file, count, w, h, ms]) => {
        const img = picture(file);
        return clip(id, count, ms, i => source(img, i * w, 0, w, h), name);
    });
}

const xTiming = { idle: 170, hurtIdle: 170, run: 60, runShot: 60, shot: 55, charged: 55, saber: 56, airSaber: 56 };
const robotTiming = {
    bassIdle: BASS_IDLE_FRAME_MS, bassRun: 58, bassRetreat: 72, bassJump: 53, bassIntro: 90, bassDash: 100,
    bassShot: 100 / 3, bassAirShot: 100 / 3, bassUpShot: 100 / 3, bassHurt: 75, bassPunch: 62, bassAirPunch: 62, bassJet: 66, bassBarrier: 105, bassGuardImpact: 100, bassKick: 74, bassDodge: 55,
    protoIdle: 145, protoIntro: 100, protoJump: 56, protoRun: 56, protoShieldWalk: 84, protoShot: 83, protoCharge: 83, protoAirShot: 83,
    protoMelee: 65, protoBash: 71, protoDodge: 57
};

function robotClips(prefix) {
    const clips = Object.entries(ROBOT_FRAMES).filter(([key]) => key.startsWith(prefix)).map(([key, cells]) => {
        const short = key.slice(prefix.length);
        const name = short[0].toLowerCase() + short.slice(1);
        const ms = robotTiming[key] || 84;
        return clip(key, cells.length, ms, i => robotFrame(key, (i + .5) * ms, ms, 0,
            0, prefix === 'bass' ? bassSpriteScale(51) : 1, 1, false),
        names[name] ?? name);
    });
    if (prefix === 'bass') for (const [key, anim] of Object.entries(TREBLE_ANIMATIONS)) {
        clips.push(clip('treble-' + key, anim.sequence.length,
            (anim.totalDuration || 550) / anim.sequence.length,
            i => source(anim.img, anim.sequence[i] * anim.frameW, 0, anim.frameW, anim.frameH),
            'Treble Â· ' + (names[key] ?? key)));
    }
    return clips;
}

function shadowClips() {
    const clips = Object.entries(SHADOW_ANIMATIONS).map(([key, cells]) => clip(key, cells.length, key === 'run' ? 23 : 64, i => {
        const f = cells[i], img = picture('shadow/' + (f.sheet === 1 ? 'Shadow1' : 'shadow' + f.sheet) + '.png');
        return source(img, (f.frame - 1) * 49, 0, 49, img.naturalHeight, 24.5,
            img.naturalHeight - (f.pivot || 0) - (f.offset || 0), true);
    }, key === 'idle' ? 'Idle del atlas original' : names[key] ?? key));
    const extras = {
        idleLive: ['Shadow_Idle.png', 6, 48, 'Idle', 125], guard: ['shadow_guard.png', 3, 48, 'Guardia'],
        upperHit: ['shadow_upperhit.png', 3, 48, 'Impacto ascendente'],
        rocketLive: ['shadow_rocket.png', 7, 48, 'Rocket en juego'],
        roamingLive: ['Roamingchaosnormal.png', 9, 48, 'Chaos Roaming en suelo'],
        airRoamingLive: ['Roamingchaosair.png', 7, 48, 'Chaos Roaming en aire'],
        orb: ['Roamingchaosproyectil.png', 24, 48, 'Proyectil de Chaos Roaming'],
        spinCharge: ['shadow_spin_charge.png', 4, 48, 'Carga de Spin Dash'],
        spin: ['shadow_spin.png', 4, 48, 'Spin Dash']
    };
    for (const [id, [file,count,size,label,ms]] of Object.entries(extras)) {
        const img = picture('shadow/' + file);
        clips.push(clip(id, count, ms || 74, i => source(img, size*i, 0, size, size), label));
    }
    clips.push(...effectClips([
        ['chaos-control','Chaos Control Â· pose','shadow/chaoscontrolshadow.png',17,64,48,34],
        ['chaos-control-vfx','Chaos Control Â· efecto','shadow/chaoscontroleffect.png',17,64,48,34]
    ]));
    return clips;
}

function espioClips() {
    const sets = [
        ['tongue',espioSprite3,[3,4,5,6]],
        ['tongueUp',espioSprite3,[0,1,2,9,10]]
    ];
    const animations=['idle','run','guard','dash','jump','fall','crouch','spin','shuriken','kunai',
        'jab','heavy','kick','upper','drill','smoke','tornado'];
    return animations.map(key=>clip(key,updatedCells('espio-kingnoel',key).length,80,
        i=>updatedFrame('espio-kingnoel',key,i,0,0,1,1))).concat(sets.map(([key,img,seq]) => clip(key, seq.length, 80, i => {
        if(!img.naturalWidth) return null;
        const r = getCellCoords(seq[i], img.naturalWidth, img.naturalHeight, 8, 6);
        return source(img,r.sx,r.sy,r.sw,r.sh);
    })));
}

export function animationsFor(id) {
    if (id === 'silver') return silverAnimations();
    if (id === 'chaos') return chaosAnimations();
    if (id === 'tails') return tailsAnimations();
    if (id === 'megaman-zero') return mmZeroAnimations();
    const updateClips = (sheet, entries) => Object.entries(entries).map(([key,name]) =>
        clip(key,updatedCells(sheet,key).length,85,index=>updatedFrame(sheet,key,index,0,0,1,1),name));
    if (id==='eggman') return updateClips('egg',{idle:'Eggmobile',boost:'Eggmobile Boost',jump:'Egg Boost',
        hover:'Egg Hover',guard:'Energy Field',jab:'Egg Fist',spike:'Spike Jab',upper:'Upper Fist',drill:'Egg Driver',
        heavy:'Wrecker Swing (arte de referencia)',air:'Wrecking Ball (arte de referencia)',
        shot:'Scrap Toss',missile:'Missile Launch',bomb:'Egg Bomb'});
    if (id === 'metal-sonic') return metalAnimations();
    if (id === 'emerl') return emerlAnimations();
    const robot = storyRobotAnimations(id);
    if (robot) return robot;
    if (id === 'x') {
        const clips=atlasClips(X_FRAMES, picture('x-atlas.png'), xTiming, true, false)
            .filter(entry=>!X_POLISH[entry.id]);
        const polish=atlasClips(X_POLISH,picture('x-polish.png'),{...xTiming,nova:48});
        const wall = polish.find(entry => entry.id === 'wall');
        const cling = clip('wallCling', 2, 115, index => wall.frame(index + 2), 'Agarre en combate Â· cuadros 3 y 4');
        return [...clips, ...polish, cling, ...chargeClips('x', 4, clips.find(entry => entry.id === 'idle'))];
    }
    if (id === 'bass' || id === 'protoman') return robotClips(id === 'bass' ? 'bass' : 'proto');
    if (id === 'sonic') return updateClips('modern',{idle:'Super Sonic Â· idle',hover:'Super Sonic Â· avance',spin:'Super Sonic Â· giro',transform:'Super Sonic Â· transformaciÃ³n',aura:'Super Sonic Â· aura'}).concat(formAnimations('sonic'),updateClips('sonicBattle',sonicBattleClips).map(clip=>({...clip,id:'sonic-battle-'+clip.id})),Object.entries(SONIC_SHEETS).map(([key,[file,count]]) => {
        const img = picture('sonic/' + file);
        return clip(key,count,({ idle: 167, idleHurt: 250, run: 55 })[key] || 65,
            i => source(img, i * img.naturalWidth / count, 0, img.naturalWidth / count, img.naturalHeight));
    }));
    if (id === 'knuckles') return stripClips(KNUCKLES_SHEETS,{ idle: 125, run: 111, punch: 70, punch2: 105, grab: 85 });
    if (id === 'rock') return [
        ...stripClips(ROCK_SHEETS,{ idle: 170, run: 72, charge: 90, fire: 65 }),
        ...stripClips(RUSH_S,{},false,'Rush Â· '), ...stripClips(BEAT_S,{},false,'Beat Â· '),
        ...effectClips([
            ['concrete','Concrete Â· formaciÃ³n y rotura','concreto.png',11,32,32,70],
            ['concrete-trail','Concrete Â· rastro de tierra','piedras_de_suelo.png',5,64,32,82],
            ['rolling-cutter','Rolling Cutter Â· proyectil','cutter.png',9,32,16,50],
            ['fireman','Fire Man Â· disparo','fireman_shot.png',2,16,16,83],
            ['heatman','Heat Man Â· disparo','Heat_fire.png',8,32,32,83],
            ['heat-ground','Heat Man Â· fuego en el suelo','Heat_fire2.png',11,32,64,65],
            ['fire-column','Columna de fuego','fireman_shield.png',3,32,48,83],
            ['leaf-shield','Leaf Shield Â· hojas','shield_leaf.png',17,32,32,65],
            ['eddie','Eddie Â· entrega','eddie.png',15,72,72,85],
            ['eddie-parachute','Eddie Â· paracaÃ­das','paracaidas.png',3,72,72,130]
        ])
    ];
    if (id === 'shadow') return [...shadowClips(),...formAnimations('shadow'),
        ...updateClips('superShadow',{idle:'Super Shadow · reposo',flight:'Super Shadow · vuelo',brake:'Super Shadow · freno',
            jump:'Super Shadow · salto',land:'Super Shadow · aterrizaje',teleport:'Super Shadow · teletransporte',
            appear:'Super Shadow · reaparición',guard:'Super Shadow · guardia',guardRing:'Super Shadow · anillo de guardia',
            heal:'Super Shadow · curación',chop:'Super Shadow Chop',kick:'Super Shadow Kick',backKick:'Super Shadow Back Kick',
            rocket:'Super Shadow Rocket',eagle:'Super Shadow Eagle',atomicUpper:'Atomic Upper',atomicBurst:'Atomic Burst · hoja',
            arrow:'Blast Arrow · pose',arrowAir:'Air Blast Arrow · pose',bolt:'Blast Arrow · efecto de la hoja',
            roam:'Super Shadow · Roaming Chaos',roamAir:'Super Shadow · Roaming Chaos aéreo',hurt:'Super Shadow · daño',
            transform:'Super Shadow · transformación'}).map(clip=>({...clip,id:'super-shadow-'+clip.id}))];
    if (id === 'espio') return espioClips();
    if (id === 'zero') {
        const timings = Object.fromEntries(Object.values(ZERO_TECHNIQUES).map(s => [s.key,s.frameMs]));
        const clips=stripClips(ZERO_SHEETS,{ idle: 333, idleHurt: 222, slashA: 58, slashB: 42, slashC: 62, airSlash: 58 },true);
        return [
            ...clips,
            ...chargeClips('zero',3,clips.find(entry=>entry.id==='idle')),
            ...stripClips({slashA:ZERO_SHEETS.slashA},{slashA:40},true).map(c => ({...c,id:'advance',name:'Corte de avance'})),
            ...stripClips({slashC:ZERO_SHEETS.slashC},{slashC:46},true).map(c => ({...c,id:'upper',name:'Corte ascendente'})),
            ...Object.entries(EXTRA_SHEETS).map(([key,s]) => clip(key,s.cells.length,({ slidingSaber:57,crouchSaber:52,busterPose:38 })[key],i => {
                const [sx,end,anchor] = s.cells[i];
                return source(s.img,sx,0,end-sx,s.bottom,anchor-sx,s.bottom,true);
            })),
            ...atlasClips(ZERO_TECHNIQUE_FRAMES,picture('zero-techniques.png'),timings).map(c =>
                c.id === 'wall' ? {...c,name:'Tajo de pared'} : c)
        ];
    }
    return [];
}

