# NOTA 17 — HUD, guardia, relevos, IA y energía de armas

Fecha: 2026-11-19

## HUD de vida

- La vida se muestra en el HUD, no sobre el sprite.
- En 1v1 cada lado muestra una barra con su luchador y vida actual.
- En entrenamiento 3v3 cada lado muestra tres segmentos, uno por integrante; el activo queda marcado y un KO vacía su segmento.
- Se retiraron las barras que Bass y Espio dibujaban encima del personaje.
- El HUD de poder existente se conserva.

## Guardia común

- Sostener atrás, en dirección opuesta al rival, activa guardia alta; atrás + abajo activa guardia baja.
- Los golpes directos que antes llamaban `dealDamage` sin pasar por `Fighter.applyDamage` ahora también respetan la guardia: reciben 15% de daño y no conservan el empuje del golpe.
- Los proyectiles se pueden cubrir. Las excepciones de altura (golpe alto contra guardia alta o bajo contra baja) describen vulnerabilidad de postura; la rotura de guardia general ahora depende de presión acumulada por daño, según NOTA 22. El Spin Dash máximo conserva chip reforzado, no una rotura instantánea.
- Se dibuja una barrera direccional para hacer visible la guardia de todos los personajes. Zero ya no borra la guardia común en cada actualización.
- La IA espera entre 110 y 180 ms después de detectar ataque o proyectil antes de cubrirse.

## Relevos

- El cambio manual tiene 6 segundos de enfriamiento.
- Un relevo por KO ignora el enfriamiento; el personaje que entra conserva el bloqueo de llegada ya existente.
- Se mantiene la selección de relevo de CPU en 3v3.

## IA por personaje

- Bass prefiere media/larga distancia, dispara ráfagas y llama a Treble. Treble alterna ráfaga, embestida y ataque Bison según el espacio.
- Knuckles usa el Spin Minero y su salida, intenta agarres a corta distancia y responde a rivales aéreos con uppercut o planeo.
- Rock prepara el Concrete fijo lejano y después lanza el móvil; también usa Cutter, fuego, serpientes, Leaf Shield, Beat y Rush según distancia y situación.
- Sonic usa Brake para cortar entradas y variar el ritmo, además de su Spin Dash.
- Los personajes con Buster mantienen la carga y disparan cuando alcanzan el tiempo elegido para la distancia.
- Se añadieron categorías de aprendizaje para que los aciertos, bloqueos, daño recibido, victorias y repetición afecten la selección de movimientos.

## Bass y Treble

- Treble sube de escala 2 a 3. Su hurtbox corporal pasa a 291 × 144 px, alineada con el tamaño de su sprite idle. El tamaño de sus balas se mantiene en la escala anterior.
- Bass mantiene altura corporal constante al saltar; se eliminó el aumento especial de 153 a 180 px. Su zona amplia de contacto usa los límites del frame visible y las colisiones finas siguen usando sus píxeles alfa mediante `getPixelBodyFrame` / `pixelBodyIntersectsRect`.

## Energía por kit de Rock

Cada kit alternativo comienza con 100 puntos y conserva su propia reserva. Las armas guardadas recuperan 0.8 puntos por segundo; el kit equipado no regenera mientras se usa.

| Kit | Movimiento | Coste |
|---|---|---:|
| CUT/CONCRETE | Concrete fijo cerca o lejos | 8 |
| CUT/CONCRETE | Concrete móvil | 14 |
| CUT/CONCRETE | Rolling Cutter | 10 |
| FIRE | Fire Shot repetible | 2 |
| FIRE | Heat Fire | 14 |
| FIRE | Flame Sword | 12 |
| LEAF/SNAKE | Search Snake | 8 |
| LEAF/SNAKE | Hyper Bomb | 13 |
| LEAF/SNAKE | Activar Leaf Shield | 12 |
| LEAF/SNAKE | Lanzar hojas | 2 por hoja viva |

BASE sigue usando su carga de Buster. Los costes son valores iniciales de balance y se pueden retocar en esta misma tabla de nota/código.

## Controles Concrete

- `J`: crea el Concrete fijo lejos.
- `J + D`: lanza el Concrete móvil.
- `J + abajo`: conserva la opción de construcción cercana.
- La secuencia principal queda como se acordó: `J` → `J + D`.

## Chaos Control

- Al entrar en congelamiento, Shadow guarda el descriptor de sprite del rival cuando está disponible y lo dibuja desde esa captura hasta liberar el tiempo. Así no cambia de pose durante el ataque.
- Los luchadores sin descriptor pixelado mantienen su estado de actualización detenido, que deja inmóvil su representación actual.

## Verificación

- `node --check` pasó en 14 archivos JavaScript modificados y `git diff --check` no reportó errores de whitespace.
- Simulación headless de tres combates 3v3, 900 frames por combate: sin excepciones y 126 acciones especiales registradas en total. La simulación no provocó KO, por eso el relevo se comprobó aparte.
- Comprobación aislada: guardia alta reduce 20 de daño a 3; KO permite relevo, el cambio manual se bloquea durante 6 s y vuelve a habilitarse después.
- Comprobación aislada de energía: `J` + `J+D` consume 22 de Concrete; Fire Shot + Heat Fire consumen 16; Search Snake consume 8; Treble queda en escala 3.
- No se hizo una comprobación visual en navegador en esta sesión. La simulación no valida sprites, encuadre ni balance jugable.
