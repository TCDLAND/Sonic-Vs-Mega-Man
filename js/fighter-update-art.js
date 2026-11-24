import { updateFrames } from './fighter-update-frames.js';

const images = Object.fromEntries(Object.keys(updateFrames).map(sheet => {
    const image = new Image();
    image.src = 'assets/images/fighter-update/' + sheet + '.png';
    return [sheet, image];
}));

export function updatedCells(sheet, key) {
    return updateFrames[sheet][key].map(([sx, sy, sw, sh]) => ({ img: images[sheet], sx, sy, sw, sh }));
}

export function updatedFrame(sheet, key, index, center, feet, scale, direction, pivot, support) {
    const cells = updateFrames[sheet][key];
    const img = images[sheet];
    if (!cells?.length || !img.complete || !img.naturalWidth) return null;
    const [sx, sy, sw, sh] = cells[index % cells.length];
    const flipX = direction < 0;
    const anchor = pivot ?? sw / 2;
    return { img, sx, sy, sw, sh, flipX, dx: center - (flipX ? sw - anchor : anchor) * scale,
        dy: feet - (support ?? sh) * scale, dw: sw * scale, dh: sh * scale };
}
