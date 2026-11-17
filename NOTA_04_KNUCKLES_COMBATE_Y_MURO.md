# NOTA 04 — Knuckles: combate, agarre, planeo, piedras y muro derecho

## Objetivo de la actualización
Corregir problemas observados al probar la primera revisión de Knuckles: efecto de piedras demasiado brusco, sprite de hit que no siempre aparecía, agarre sin lanzamiento visible, falta de profundidad visual en la vuelta del agarre, muro derecho adelantado respecto al arte, golpe de planeo sin knockback real y salida del Spin Minero sin impulsar a ambos luchadores.

## 1. Piedras del Spin Minero — fade out y cara visible
### Problema
El efecto de tierra cambiaba de posición/frame sin dejar una desaparición gradual. Además, durante el hundimiento un efecto completo de 64x32 podía cubrir demasiado a Knuckles.

### Antes
El estado subterráneo devolvía directamente un frame de tierra:
```js
return ['dirt', Math.floor(now / 100) % 5];
```
No existía historial de partículas ni alpha decreciente.

### Cambio
Se añadió `dirtTrail`, que guarda huellas durante 520 ms. Cada huella se dibuja con alpha decreciente:
```js
const alpha = clamp(1 - age / 520, 0, 0.72);
```
Durante `sink` solo se dibuja la mitad inferior del spritesheet de piedras (`sourceY=16`, `sourceH=16`), para dejar libre la parte superior de Knuckles.

## 2. Animación `knuckles_hit.png` al recibir daño
### Problema
`dealDamage()` descontaba vida, pero no notificaba a Knuckles de que había recibido daño. Además, la selección de salto/caída podía ganar prioridad sobre `hit` cuando el golpe lo levantaba.

### Antes
```js
receiver.health = Math.max(0, Math.round((receiver.health - finalDamage) * 100) / 100);
```
No había callback visual de daño.

### Cambio
`combat-system.js` llama a un hook opcional:
```js
if (finalDamage > 0 && typeof receiver.onDamageTaken === 'function')
    receiver.onDamageTaken({ attacker, attackName, damage: finalDamage });
```
Knuckles implementa `onDamageTaken()` y mantiene `knuckles_hit.png` durante ~260 ms. La reacción de hit ahora tiene prioridad sobre jump/fall.

## 3. Agarre — lanzamiento según resistencia
### Problema
El lanzamiento anterior era fijo y corto:
```js
receiver.vx = -this.grabFacing * 12;
receiver.vy = -5;
```
Aunque existía velocidad, no representaba el objetivo de que un personaje resistente viaje mucho menos que uno frágil.

### Cambio
Se usa `defenseMultiplier` para interpolar la distancia deseada. Con defensa 0.80 (Knuckles) el objetivo es aproximadamente 1/4 del ancho visible; con 1.30 (Proto Man), aproximadamente 3/4. La velocidad inicial se calcula para ~30 frames de vuelo y se acompaña de `vy=-9`.

## 4. Agarre — profundidad visual
### Problema
`main.js` siempre dibujaba P1 y después P2:
```js
p1.draw(...);
p2.draw(...);
```
Por ello la coreografía podía mover al rival de lado, pero no podía representar que Knuckles pasara por delante y detrás durante la vuelta.

### Cambio
Mientras el agarre está conectado, `main.js` alterna el orden de dibujo según el frame del agarre. También se definió una secuencia de lados para mover físicamente al rival alrededor de Knuckles.

## 5. Muro derecho del Highway
### Problema
El código trataba `x=2334` como la cara interior derecha:
```js
const stageRightWall = 2334;
```
Visualmente ese punto todavía está en espacio libre; por eso Zero y Knuckles podían quedar flotando antes de tocar el pilar.

### Cambio
Tras revisar `highway_long.png` (2560x720), se movió la cara jugable derecha a `x=2368`. Se actualizó la referencia en `fighter.js`, `wall-system.js`, `zero.js`, `sonic.js` y `knuckles.js`. El muro izquierdo permanece en `x=226`, porque ya coincidía correctamente.

## 6. Golpe durante el planeo
### Problema
El golpe asignaba únicamente:
```js
receiver.vx = dir * 8;
```
pero no activaba el estado de knockback aéreo. El movimiento normal del rival podía absorber o reemplazar rápidamente esa velocidad.

### Cambio
El golpe de planeo ahora aplica velocidad horizontal mayor, un pequeño impulso vertical y activa `wasInAirFromKnockback`. Mientras se pulsa el ataque, Knuckles recibe además un pequeño aumento de avance (`1.45x`) para que el input se sienta como una embestida.

También se fuerza `facingDirection = glideDir` durante todo el planeo. Pasar por encima del rival ya no debe voltear automáticamente el sprite. El planeo solo cambia/termina cuando la mecánica correspondiente lo ordena.

## 7. Salida del Spin Minero
### Problema
El ataque de salida lanzaba al rival, pero Knuckles permanecía demasiado pegado al suelo y el impacto no se leía como un choque ascendente entre ambos.

### Cambio
Al comenzar `exit`, Knuckles recibe impulso vertical. Si conecta, el rival recibe `vy=-12` y empuje horizontal, mientras Knuckles conserva/recibe su propio impulso ascendente. Ambos quedan en estado aéreo de knockback.

## Idea futura — energía/electricidad en el suelo
No se implementa todavía. Se deja anotada como interacción futura: ciertos personajes podrían electrificar o energizar el piso y convertir el terreno en un peligro para Knuckles mientras usa Spin Minero. Conviene resolverlo después mediante una propiedad global de superficie (por ejemplo, `groundHazard`) para que no sea un `if` exclusivo contra Knuckles y pueda reutilizarse con otras mecánicas.
