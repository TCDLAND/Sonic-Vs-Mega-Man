import { opaqueInRect } from './pixel-collision.js';

const walkCuts = [0, 52, 105, 157, 210, 263, 316, 369, 422, 463];
const guardCuts = [0, 52, 104, 156, 208, 260];
const sheets = Object.fromEntries(['walk', 'front', 'back', 'guard', 'guard-front'].map(key => {
    const img = new Image();
    img.src = 'assets/images/emerl-shield-' + key + '.png';
    return [key, img];
}));

export function shieldLayers(guard, frame, x, feet, scale, direction) {
    const cuts = guard ? guardCuts : walkCuts;
    const sw = cuts[frame + 1] - cuts[frame];
    const flipX = direction < 0;
    const pivot = 19;
    const data = { sx: cuts[frame], sy: 0, sw, sh: 41, dx: x - (flipX ? sw - pivot : pivot) * scale,
        dy: feet - 41 * scale, dw: sw * scale, dh: 41 * scale, flipX };
    const behind = !guard && frame >= 3 && frame <= 6;
    return {
        body: { ...data, img: sheets[guard ? 'guard' : 'walk'] },
        shield: { ...data, img: sheets[guard ? 'guard-front' : behind ? 'back' : 'front'] },
        behind
    };
}

export function shieldIntersects(layers, rect) {
    return Boolean(layers && opaqueInRect(layers.shield, rect, 1));
}

export function copyShieldAnimations() {
    return [false, true].map(guard => {
        const cache = [];
        return {
            id: guard ? 'copy-shield-guard' : 'copy-shield-walk',
            name: guard ? 'Caminar cubriéndose con el escudo' : 'Caminar con el escudo',
            count: guard ? 5 : 9, ms: 82,
            frame(index) {
                if (!cache[index]) {
                    const { body, shield, behind } = shieldLayers(guard, index, 19, 41, 1, 1);
                    if (![body, shield].every(part => part.img.complete && part.img.naturalWidth)) return null;
                    const img = document.createElement('canvas');
                    img.width = body.sw;
                    img.height = 41;
                    const context = img.getContext('2d');
                    for (const part of (behind ? [shield, body] : [body, shield])) {
                        context.drawImage(part.img, part.sx, part.sy, part.sw, part.sh, 0, 0, part.sw, part.sh);
                    }
                    cache[index] = { ...body, img, sx: 0, sy: 0, dx: -19, dy: -41 };
                }
                return cache[index];
            }
        };
    });
}
