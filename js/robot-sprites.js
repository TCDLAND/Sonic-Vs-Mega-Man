import { ROBOT_FRAMES } from './robot-frames.js';
import { bassDash } from './assets.js';

const atlas = new Image();
atlas.src = 'assets/images/bass-proto-atlas.png';
const shots = new Image();
shots.src = 'assets/images/bass-proto-shots.png';
const LEFT_FACING = new Set(['bassUpShot', 'bassPunch', 'bassAirPunch', 'protoCharge', 'protoBash', 'protoLow', 'protoDodge', 'protoMelee']);
export const BASS_IDLE_FRAME_MS = 270;

export function bassSpriteScale(height) {
    return height / 51;
}

export function drawRobotShot(ctx, key, x, y, width, height, angle) {
    if (!shots.complete || !shots.naturalWidth) return false;
    const [sx, sw, sh] = {
        bassA: [0, 31, 36], bassB: [32, 31, 39],
        protoShot: [64, 30, 34], protoCharge: [96, 56, 50]
    }[key];
    ctx.save();
    ctx.translate(x + width / 2, y + height / 2);
    ctx.rotate(angle);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(shots, sx, 0, sw, sh, -width / 2, -height / 2, width, height);
    ctx.restore();
    return true;
}

export function robotFrame(key, elapsed, frameMs, x, feet, scale, facing, loop = true) {
    const img = key === 'bassDash' ? bassDash : atlas;
    if (!img.complete || !img.naturalWidth) return null;
    const cells = ROBOT_FRAMES[key];
    const tick = Math.max(0, Math.floor(elapsed / frameMs));
    const frame = loop ? tick % cells.length : Math.min(cells.length - 1, tick);
    const [sx, sy, sw, sh, anchor] = cells[frame];
    const sourceFacesLeft = LEFT_FACING.has(key) || (key === 'protoDash' && (frame === 0 || frame === 3));
    const flipX = (facing < 0) !== sourceFacesLeft;
    const groundedBass = /^bass(Idle|Run|Retreat|Crouch|Guard|GuardImpact|Barrier|Punch|Kick|Dash|Dodge|Shot)$/.test(key);
    const bodyScale = groundedBass ? scale * .88 : scale;
    const scaleX = /^(bass|proto)/.test(key) ? bodyScale * .92 : bodyScale;
    return { img, sx, sy, sw, sh, frame, key, flipX,
        dx: x - (flipX ? sw - anchor : anchor) * scaleX, dy: feet - sh * bodyScale,
        dw: sw * scaleX, dh: sh * bodyScale };
}

export function drawRobotFrame(ctx, frame, cameraX = 0, alpha = 1) {
    if (!frame) return;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.globalAlpha = alpha;
    ctx.translate(frame.dx - cameraX + (frame.flipX ? frame.dw : 0), frame.dy);
    if (frame.flipX) ctx.scale(-1, 1);
    ctx.drawImage(frame.img, frame.sx, frame.sy, frame.sw, frame.sh, 0, 0, frame.dw, frame.dh);
    ctx.restore();
}
