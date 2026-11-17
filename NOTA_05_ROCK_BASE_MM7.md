# NOTA 05 — ROCK BASE MM7 / POWER BATTLE PREPARATION

## Objetivo
Primera versión jugable de Rock antes de Rush, Beat, Eddie y Robot Master Weapons. Se integra locomoción, Buster/carga, reacción de daño, Slash Claw y cambio de paleta de carga.

## 1. Fondos estructurales de las hojas
Problema: las hojas no vienen con alpha; contienen tres colores que son únicamente fondo/extensión/márgenes. Si se dibujaba el PNG original, esos morados aparecían alrededor de Rock.

Colores que NO pertenecen al personaje:
- `#841584`
- `#470047`
- `#B440B4`

Cambio: se generaron copias `rock_*_alpha.png` conservando exactamente el tamaño de cada hoja/celda y convirtiendo SOLO esos tres RGB a alpha 0. No se hizo auto-crop para no destruir pivotes.

## 2. Celdas y pivote
Regla MM7 normal: 48x48 con 2 px de margen/separación. Los 2 px sirven para localizar la celda y nunca forman parte del frame.

Código base:
```js
sx = 2 + frame * (cellWidth + 2);
```

Las hojas extendidas conservan un pivote basado en el cuerpo 48x48. Ejemplos: Fire/RunFire/Charge/Slash usan 56 px de ancho porque toman 8 px extra a la izquierda. Jump usa 64 px de alto y pivote vertical local 47 (aprox. 17 px desde abajo según la hoja).

## 3. Orientación
Problema potencial: los sprites base MM7 entregados miran a la izquierda, pero Rock debe iniciar mirando a la derecha. Futuras animaciones Power Battle pueden venir mirando a la derecha.

Solución: cada animación guarda `sourceFacing`. El renderer compara orientación fuente contra `facingDirection` y decide el flip. No se modifican destructivamente los PNG.

## 4. Intro
`rock_intro.png`: 6 frames. Se activa al crear Rock y usa 20 ticks por frame (~2 s total), para igualar aproximadamente la intro de Bass.

## 5. Idle / Idle herido
Se usa frame 1 normalmente. Cada 3 s se muestra brevemente frame 3. Con vida <=30%, la base pasa a frame 4 y conserva el pulso al frame 3. Frame 2 se reserva para hablar con Rush/Beat/Eddie en una actualización posterior.

## 6. Run y RunFire sincronizados
Problema a evitar: reiniciar las piernas al frame 1 cuando Rock dispara caminando.

Solución: Run y RunFire comparten el mismo índice de fase de carrera. Ciclo normal aproximado: 2 s para 10 frames. Retroceso visual usa ciclo más lento.

## 7. Jump / JumpFire
No existe hoja Fall separada. Al despegar se recorren los 6 frames rápidamente; al empezar a caer se mantiene el último frame. Si está cargando/disparando en el aire se usa JumpFire y también se conserva su último frame durante la caída.

## 8. Buster y Charge Shot
J/X sigue usando el Buster universal existente. Al soltar J se llama ahora opcionalmente:
```js
if (typeof fighter.onBusterFired === 'function') fighter.onBusterFired(level, direction);
```
Esto permite que Rock reproduzca su animación sin acoplar el sistema universal de Buster a una clase concreta.

En suelo, un tiro cargado ejecuta `rock_charge_shot` (5 frames), detiene carrera/dash y deja recovery. En aire no usa esa hoja: continúa con JumpFire.

## 9. Paletas de carga
`rock_colors_charge.png` contiene 4 paletas de 30x2: 15 colores, cada color ocupa 2 px horizontales.

Regla implementada mientras carga:
- Nv1: Paleta 1 <-> Paleta 3
- Nv2: Paleta 2 <-> Paleta 3
- Nv3: Paleta 4 <-> Paleta 3
- Sin carga: Paleta 1

El cambio se hace por coincidencia RGB exacta de los 15 colores de la paleta 1 y se cachea por hoja/paleta. No se recolorea cada píxel cada frame.

## 10. Slash Claw V1
Decisión provisional: se implementa como golpe físico, NO como agarre todavía. I/Y lo activa en suelo.

Solo el frame 3 es ofensivo. La región fuente indicada es 12x7 px, comenzando en x=7 y aproximadamente 19 px desde abajo. El sistema refleja automáticamente esa región si la animación se voltea.

Esto se deja fácil de convertir a agarre más adelante si al probarlo se siente mejor como command grab.

## Pendiente para Update 2
- Rush / Beat / Eddie y animación de conversación.
- Selector/HUD de Robot Master Weapons.
- Rolling Cutter, Flame Sword, Search Snake, Leaf Shield.
- Paletas de armas.
- Efectos/proyectiles finales del Buster en vez de placeholder genérico, si se proporcionan sprites.
- Super Mega Man.
- Golpes adicionales de Power Battle con `sourceFacing` independiente.
