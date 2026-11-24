const definitions = {
    'heat-intro': [[0, 55, 4,62,67,123,127,176,179,229,231,289,291,351,356,416,421,481,483,527],
        [55, 113, 32,102,107,177,182,252,256,326,331,369,375,413,418,456,462,500]],
    'heat-dash': [[0, 54, 11,158,166,318,328,482], [54, 110, 26,175,184,315,333,472]],
    'heat-counter': [[0, 102, 19,79,89,147,158,213,228,286]],
    'heat-charge': [[0, 65, 0,58,66,132,139,212,219,294,302,374]],
    'heat-guard-hot': [[0, 52, 2,47,54,100]],
    'heat-knockback': [[0, 48, 2,63]],
    'heat-guard': [[0, 48, 0,45,51,97]],
    'heat-throw': [[0, 67, 9,57,66,120,128,172,185,229,240,282]]
};

const sheets = Object.fromEntries(Object.entries(definitions).map(([key, bands]) => {
    const image = new Image();
    const sheet = { image, cells: [] };
    image.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(image, 0, 0);
        const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        sheet.cells = bands.flatMap(([top, bottom, ...edges]) => edges.flatMap((sx, i) => {
            if (i % 2) return [];
            const sw = edges[i + 1] - sx;
            let sy = bottom, feet = top;
            for (let y = top; y < bottom; y++) {
                for (let x = sx; x < sx + sw; x++) {
                    if (!pixels[(y * canvas.width + x) * 4 + 3]) continue;
                    sy = Math.min(sy, y);
                    feet = y + 1;
                    break;
                }
            }
            return [{ sx, sy, sw, sh: feet - sy }];
        }));
    };
    image.src = 'assets/images/story-robots/' + key + '.png';
    return [key, sheet];
}));

const warmSheets = new WeakMap();
export function warmHeatSprite(image) {
    if (!image?.complete || !image.naturalWidth) return image;
    if (warmSheets.has(image)) return warmSheets.get(image);
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(image, 0, 0);
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = pixels.data;
    for (let i = 0; i < data.length; i += 4) {
        const [r, g, b, a] = data.subarray(i, i + 4);
        if (!a || r < 34 || r <= b + 12 || r < g - 8) continue;
        data[i] = Math.min(255, 120 + r * .65);
        data[i + 1] = Math.min(255, 55 + g * .83 + r * .26);
        data[i + 2] = Math.min(235, 24 + b * .72 + g * .56);
    }
    ctx.putImageData(pixels, 0, 0);
    warmSheets.set(image, canvas);
    return canvas;
}

export function heatSpriteFrame(key, index, x, feet, scale, right, hot = false) {
    const sheet = sheets[key];
    const rect = sheet?.cells[index];
    if (!rect) return null;
    const sourceFacesRight = ['heat-intro', 'heat-guard', 'heat-guard-hot', 'heat-knockback'].includes(key);
    const flipX = sourceFacesRight !== right;
    const { sw, sh } = rect;
    const pivot = key === 'heat-dash' ? 40 : key === 'heat-throw' ? [22, 19, 21, 23, 21][index] : sw / 2;
    return { ...rect, img: hot ? warmHeatSprite(sheet.image) : sheet.image, flipX,
        dx: x - (flipX ? sw - pivot : pivot) * scale, dy: feet - sh * scale,
        dw: sw * scale, dh: sh * scale };
}