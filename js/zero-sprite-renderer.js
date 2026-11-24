// Renderer de Zero para frames de tamaño variable dentro de una sola hoja.
import { getZeroFrames } from './zero-frame-data.js';
const zeroMasterSheet = new Image();
zeroMasterSheet.src = 'assets/images/Zerosprites.png';

export const ZERO_RENDER_SCALE = 3;

/**
 * Dibuja un frame sin crear spritesheets intermedias.
 * pivotX/pivotY = punto del mundo donde deben quedar los pies/pivote de Zero.
 * sourceFacesLeft = true porque Zerosprites.png mira a la izquierda.
 */
export function drawZeroAtlasFrame(ctx, animationName, frameIndex, pivotX, pivotY, facingRight, scale = ZERO_RENDER_SCALE) {
  const frames = getZeroFrames(animationName);
  if (!frames.length || !zeroMasterSheet.complete || zeroMasterSheet.naturalWidth === 0) return null;

  const f = frames[Math.max(0, Math.min(frameIndex, frames.length - 1))];
  const dw = f.w * scale;
  const dh = f.h * scale;
  const ox = f.originX * scale;
  const oy = f.originY * scale;

  ctx.save();

  // La hoja original mira a la izquierda. Si Zero debe mirar a la derecha,
  // reflejamos alrededor del pivote; no hay que crear otro PNG.
  if (facingRight) {
    ctx.translate(pivotX, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(
      zeroMasterSheet,
      f.x, f.y, f.w, f.h,
      -ox, pivotY - oy,
      dw, dh
    );
  } else {
    ctx.drawImage(
      zeroMasterSheet,
      f.x, f.y, f.w, f.h,
      pivotX - ox, pivotY - oy,
      dw, dh
    );
  }

  ctx.restore();
  return f;
}

export function getZeroAtlasFrame(animationName, frameIndex) {
  const frames = getZeroFrames(animationName);
  if (!frames.length) return null;
  return frames[Math.max(0, Math.min(frameIndex, frames.length - 1))];
}
