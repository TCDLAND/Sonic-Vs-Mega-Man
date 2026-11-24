// ========================================
// ESTADO GLOBAL DEL JUEGO
// ========================================

import { GAME_STATE } from './config.js';

export const game = {
    cameraX: 0,
    gameState: GAME_STATE.MODE,
    mode: 'cpu',
    modeCursor: 0,
    countdown: null,
    paused: false,
    controlOverrides: null,
    winner: null,
    cpuAgent: null,
    cpuAgentP1: null,
    cpuAgentP2: null,
    teamRosters: null,
    teamFighters: null,
    teamActiveIndex: { p1: 0, p2: 0 },
    tagRequests: { p1: false, p2: false },
    tagCooldowns: { p1: 0, p2: 0 },
    tagEffects: [],
    p1: null,
    p2: null,
    projectiles: [],
    bassBullets: [],
    trebles: [],
    trebleBullets: [],
    characterSelection: {
        p1Index: 0,
        p2Index: 0,
        p1Confirmed: false,
        p2Confirmed: false,
        chars: ["espio", "bass", "sonic", "shadow", "knuckles", "silver", "x", "zero", "rock", "protoman", "eggman", "wily", "emerl", "megaman-zero", "metal-sonic", "tails", "chaos"]
    }
};

export const canvas = document.getElementById("gameCanvas");
export const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;

export const tongueCanvas = document.createElement('canvas');
tongueCanvas.width = 1024;
tongueCanvas.height = 1024;
export const tongueCtx = tongueCanvas.getContext('2d', { willReadFrequently: true });
tongueCtx.imageSmoothingEnabled = false;
