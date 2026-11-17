# Zero: hoja maestra por coordenadas

Este build conserva `assets/images/Zerosprites.png` completa (677×2048) y NO genera hojas nuevas.

Archivos añadidos:
- `js/zero-frame-data.js`: coordenadas `{x,y,w,h}` independientes para cada frame.
- `js/zero-sprite-renderer.js`: usa `ctx.drawImage()` con source rectangles variables y pivote por frame.
- `assets/images/Zerosprites.png`: hoja original proporcionada.

Ataques preparados en el atlas:
- `slashA`
- `slashB`
- `slashC`
- `slidingSaber`
- `airSlash`
- `buster`

También hay un primer pase de `idle` y `run` para facilitar la integración posterior.

## Regla importante de orientación
La fuente de Zero mira a la izquierda. `drawZeroAtlasFrame()` refleja el frame sólo al renderizar cuando Zero necesita mirar a la derecha.

## Regla importante de colisión
El rectángulo fuente es VISUAL, no una hitbox. El Z-Saber/efecto visible no debe convertirse en hurtbox de Zero. Las regiones corporales y ofensivas deben definirse por separado al integrar colisiones pixel-perfect.

## Slash C
Las banderas `active` incluidas son provisionales. El diseño acordado es que Slash C tendrá startup/active/recovery y regiones personalizadas por frame cuando se den los datos definitivos.

## Ejemplo
```js
import { drawZeroAtlasFrame } from './zero-sprite-renderer.js';

drawZeroAtlasFrame(
  ctx,
  'slashB',
  frameIndex,
  zero.x - game.cameraX + zero.width / 2,
  zero.feetY,
  opponentX > zero.x
);
```

El resto del proyecto antiguo se conserva; esto es una capa nueva para Zero y no sustituye las mecánicas existentes de Bass/Espio/Sonic/etc.
