# NOTA 11 — Beat: Follow, Crescent y Patrol

## Objetivo
Beat ahora es un compañero aéreo permanente de Rock, independiente de Rush.

## Comportamiento de FOLLOW
- Beat se estaciona aproximadamente un cuerpo por encima de Rock.
- Beat SIEMPRE busca el lado de atrás de Rock según su facing.
- A diferencia de Rush, Beat NO salta con Rock. Su altura de Follow se calcula desde `feetY` (suelo estable), no desde `Rock.y`.
- Si Rock cruza al rival/cambia de facing, Beat se desplaza físicamente al nuevo lado trasero.

## Entrada
Beat entra desde el cielo haciendo una U ancha y poco profunda con `beat_lados.png`. Esta entrada no tiene hitbox ofensiva. Al terminar pasa a FOLLOW y usa `beat_idle.png`.

## Controles V1
- `I/Y`: Beat Crescent.
- `izquierda + derecha + I/Y`: Beat Patrol horizontal.
- Durante Patrol, `I/Y`: deja pendiente una orden de drop. Beat NO salta de frame; ejecuta la orden cuando su animación llega naturalmente al frame 15.
- `M/A`: Slash Claw (movido desde I/Y para liberar el botón de Beat).
- Rush conserva `K/B`, y `abajo + K/B` conserva Coil.

## Crescent
La trayectoria es una U (`∪`) MUY ancha y poco profunda: empieza alta, baja en el centro y vuelve a subir. Su intención es cubrir salto/aire; personajes bajos normalmente pueden quedar debajo si permanecen en suelo.

Los 15 frames de `beat_lados.png` se aprovechan como rotación. Los frames centrales permanecen más tiempo en la zona inferior para que Beat se vea boca abajo mientras cruza el fondo de la U.

Daño V1 provisional: 8. Sólo puede golpear una vez por Crescent.

## Patrol horizontal
Beat hace 4 tramos: ida → regreso → ida → regreso. En cada tramo la animación 1..15 puede repetirse varias veces. Por tanto el frame 15 puede aparecer varias veces dentro de una misma ida.

El jugador puede pulsar I durante el recorrido. Se guarda `dropRequested`; al llegar naturalmente al frame 15 se genera `owner.beatDropEvent`. El objeto real queda pendiente de conectarse cuando exista el sistema de power-ups/objetos. Tras ejecutar un drop, ese Patrol no permite otro.

## Cooldowns
Crescent y Patrol tienen cooldown separado de 3 segundos. El cooldown del movimiento usado empieza al terminarlo. El otro movimiento puede utilizarse al volver Beat a FOLLOW si está disponible. Ningún comando nuevo se acepta mientras Beat no haya regresado a FOLLOW.

## Pendiente
- Definir sprites/tabla/daños/física de los objetos que Beat puede soltar.
- Implementar hurtbox de Beat durante estados ofensivos y reacción al recibir un golpe (Beat debe ser vulnerable a cualquier ataque durante Crescent/Patrol/Return ofensivo).
- Ajustar distancias/velocidades/daño tras prueba jugable.

## Ajuste V3 — respuesta de input y knockback
- Crescent empuja fuertemente en la dirección de viaje de Beat; las cajas conservan su física independiente.
- Beat vuela un poco más bajo en FOLLOW.
- La intro termina con un pequeño ajuste de posición hacia Rock; esto no habilita TP durante FOLLOW.
- Patrol puede soltar hasta 4 cajas por recorrido.
- El input de caja prepara los frames cercanos al drop para reducir la sensación de tener que adivinar el frame exacto; si la animación ya está a 3 frames o menos, se reserva para la siguiente vuelta.

---
## V4 — KNOCKBACK DE BEAT
Fecha: 2026-10-07

Resultado V3: navegación, altura, intro y control de cajas ya se sienten bien. El problema restante fue que el golpe corporal de Crescent todavía no desplazaba al rival con suficiente fuerza.

Cambio V4:
- Beat Crescent pasa de vx 13 a vx 22 en la dirección REAL de viaje de Beat.
- Beat viajando izquierda -> derecha expulsa con fuerza hacia la derecha; derecha -> izquierda hace lo contrario.
- Se mantiene componente vertical pequeño: este ataque debe ser principalmente expulsión horizontal.
- Este cambio NO afecta las cajas; sólo el contacto directo de Beat durante Crescent.

## V5 — cooldown cruzado, 4 cajas y knockback

### Ajustes de prueba
- Tras terminar un ataque de Beat: 4 s para repetir ESE mismo ataque y 2 s para poder usar el otro.
- Patrol mantiene máximo 4 cajas por salida.
- Si Beat ya soltó la cuarta caja, no completa vueltas sobrantes: cancela el resto de la patrulla y vuelve con Rock.
- Crescent/embestida aumenta otra vez su knockback horizontal para que la dirección del vuelo sea evidente: derecha expulsa fuerte a derecha e izquierda a izquierda. Las cajas no heredan este knockback.

### Motivo
La orden de cajas ya se siente bien; el problema era castigar al jugador con recorrido visual inútil después de gastar las cuatro y que la embestida todavía no desplazaba lo suficiente.
