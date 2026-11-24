// Parámetros de los movimientos de esta versión. Los rectángulos parten
// del centro y los pies de Zero, orientados hacia donde mira.
export const ZERO_TECHNIQUES = {
    LAND: { key: 'land', frameMs: 55, damage: 11, active: [2, 5], area: [0, -85, 125, 85], ground: true, low: true },
    WALL: { key: 'wall', frameMs: 51, damage: 12, active: [1, 5], area: [0, -135, 140, 110], wall: true },
    WALLKICK: { key: 'wallkick', frameMs: 68, damage: 7, active: [0, 2], area: [-5, -108, 86, 82], wall: true, jump: -12, speed: 10, travel: 3 },
    BURST: { key: 'burst', frameMs: 49, damage: 15, active: [4, 7], area: [-125, -95, 250, 95], ground: true, launch: -7 },
    THRUST: { key: 'thrust', frameMs: 48, damage: 13, active: [10, 13], area: [18, -101, 190, 56], ground: true, speed: 5, travel: 8 },
    FIREUP: { key: 'fireup', frameMs: 54, damage: 15, active: [3, 7], area: [5, -170, 100, 140], ground: true, launch: -11, lift: -12 },
    ELECUP: { key: 'elecup', frameMs: 57, damage: 12, active: [3, 6], area: [3, -210, 76, 190], ground: true, launch: -14, lift: -8 },
    ICEDIVE: { key: 'icedive', frameMs: 51, damage: 12, active: [2, 6], area: [-24, -55, 78, 90], air: true, dive: 12, landedFrame: 6 },
    FIREDIVE: { key: 'firedive', frameMs: 52, damage: 14, active: [2, 7], area: [-44, -60, 116, 92], air: true, dive: 15, landedFrame: 6, launch: -5 },
    AIRSPIN: { key: 'airspin', frameMs: 52, damage: 12, active: [1, 6], area: [-95, -155, 190, 145], air: true },
    FROSTDASH: { key: 'frostdash', frameMs: 52, damage: 10, active: [1, 4], area: [11, -91, 109, 83], ground: true, speed: 12, travel: 5 }
};
