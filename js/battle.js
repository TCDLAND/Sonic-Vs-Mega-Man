// ========================================
// INICIO DE BATALLA Y FÁBRICA DE FIGHTERS
// ========================================

import { FLOOR_Y, GAME_STATE } from './config.js';
import { game } from './state.js';
import { Espio } from './espio.js';
import { Bass } from './bass.js';
import { Sonic } from './sonic.js';
import { Shadow } from './shadow.js';
import { Knuckles } from './knuckles.js';
import { Silver } from './silver.js';
import { X } from './x.js';
import { Zero } from './zero.js';
import { Rock } from './rock.js';
import { ProtoMan } from './protoman.js';
import { Eggman } from './eggman.js';
import { Wily } from './wily.js';
import { Emerl } from './emerl.js';
import { MegaManZero } from './megaman-zero.js';

export function createFighter(character, x, y, controls) {
    const factories = {
        espio: () => new Espio(x, y, controls),
        bass: () => new Bass(x, y, controls),
        sonic: () => new Sonic(x, y, controls),
        shadow: () => new Shadow(x, y, controls),
        knuckles: () => new Knuckles(x, y, controls),
        silver: () => new Silver(x, y, controls),
        x: () => new X(x, y, controls),
        zero: () => new Zero(x, y, controls),
        rock: () => new Rock(x, y, controls),
        protoman: () => new ProtoMan(x, y, controls),
        eggman: () => new Eggman(x, y, controls),
        wily: () => new Wily(x, y, controls),
        emerl: () => new Emerl(x, y, controls),
        'megaman-zero': () => new MegaManZero(x, y, controls)
    };
    return (factories[character] || factories.espio)();
}

export function startBattle() {
    const p1Char = game.characterSelection.chars[game.characterSelection.p1Index];
    const p2Char = game.characterSelection.chars[game.characterSelection.p2Index];

    const p1Controls = {
        left: 'KeyA', right: 'KeyD', jump: 'KeyW', crouch: 'KeyS',
        attack: 'KeyJ', heavy: 'KeyI', kickLight: 'KeyM', kickHeavy: 'KeyK',
        spinKey: 'Space'
    };

    const p2Controls = {
        left: 'ArrowLeft', right: 'ArrowRight', jump: 'ArrowUp', crouch: 'ArrowDown',
        attack: 'Comma', heavy: 'Period', kickLight: 'Minus', kickHeavy: 'Equal',
        spinKey: 'Enter'
    };

    game.p1 = createFighter(p1Char, 200, FLOOR_Y, p1Controls);
    game.p2 = createFighter(p2Char, 1000, FLOOR_Y, p2Controls);

    game.gameState = GAME_STATE.BATTLE;
}