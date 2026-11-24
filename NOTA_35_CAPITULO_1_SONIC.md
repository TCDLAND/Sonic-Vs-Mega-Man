# Sonic, capítulo 1 — La esmeralda que desapareció

## Cómo entrar

Desde **Modo historia → Campañas**, completa el prólogo compartido hasta la retirada de Emerl para habilitar **Sonic — Capítulo 1**. El progreso se guarda en el almacenamiento local del navegador y conserva las demás marcas de campaña. Para pruebas sin progreso previo, abre el juego servido por HTTP con `?chapter-test=1` y selecciona **Probar Sonic — Capítulo 1**. Si el juego se ejecuta en VS Code, puedes usar Live Server desde `index.html`.

El diálogo se avanza con **J**, **Enter**, el botón de continuar o **A**. Para caminar usa **A/D**, flechas o el stick. Interactúa con el casco con **J / A** al acercarte o continúa hasta interceptarlo. **W / Espacio** salta en los recorridos. El combate usa los controles normales del juego. **Esc** pausa los recorridos y **T** vuelve al menú desde la pausa. En Versus, tras confirmar luchadores, se abre el selector de escenarios. Emerald Zone comparte la pista Angel Island Act 2 y los recorridos de plataformas quedan fuera del selector.

## Capítulo y música

| Tramo | Fondo y audio |
| --- | --- |
| Primer aviso de Knuckles | Altar Emerald · Angel Island Zone Act 2 |
| Entrada, investigación, casco y despertar de Metal | Instalaciones de Eggman, Gimme Shelter y Death Egg Arena · Death Egg Robot en una sola reproducción |
| Persecución, confrontación y combate | Death Egg Arena · Stardust Speedway Bad Future JP/EU |
| Resonancia | Death Egg Arena · fundido de la pista de combate |
| Aparición de Tikal | Altar Emerald · Theme of Tikal inicia con su aparición |
| Epílogo | Gimme Shelter · silencio musical |

Los cuatro fondos suministrados son PNG de **2172 × 724**, los seis retratos son PNG de **512 × 512**, y las cuatro pistas son MP3. La Master Emerald y las seis Chaos Emeralds de la instalación usan recortes de la hoja suministrada, con tamaños distintos y paletas separadas. La capa del altar se retocó a partir del propio fondo para quitar la gema pintada. La cámara de Metal usa una variante de la misma arena que apaga el holograma durante la confrontación.

## Metal Sonic

Metal usa su propia hoja de **648 × 1863** con rectángulos por fila y pivotes de apoyo. Comparte el comportamiento de Sonic mediante subclase, con ranura, imagen, ID y catálogo propios. La infección y el efecto de los ojos se activan al iniciar la batalla de historia. Las poses se pueden revisar en la guía.

| Estado | Fuente visible | Cuadros |
| --- | --- | ---: |
| Reposo | Idle Metal Sonic Style | 5 |
| Reposo dañado | Combinación de impacto y reposo de Metal | 5 |
| Carrera | Run | 11 |
| Frenada | Salida de Run y reposo | 4 |
| Frenada inversa | Salida de Run, transición baja y giro | 4 |
| Dash | Dash Attack y vuelta a reposo | 9 |
| Salto | Inicio de Metal Lift Off | 7 |
| Caída | Final de Metal Lift Off | 5 |
| Guardia | Guard y posturas bajas propias | 3 |
| Puño | Inicio de Combo Attack | 6 |
| Ascendente | Upper Attack | 7 |
| Golpe lateral | Final del combo y estocada lateral | 7 |
| Rocket | Drill Strike y desplazamiento horizontal de Dash Attack | 7 |
| Carga Spin Dash | Preparación de la órbita de la hoja | 4 |
| Spin Dash | Giro al final de la órbita | 5 |
| Impacto / retroceso | Hit / Knockback | 3 / 4 |

Las variantes de respiración herida, frenada y frenada inversa y la equivalencia de Spin y Rocket se componen con cuadros propios disponibles. Hacen falta hojas dedicadas si se quiere sustituir esas transiciones por poses exactas. Se conserva la hoja con disparos, escudo diamante, ataques eléctricos, curación y otros efectos para evolución futura. Los ZIP aportan los seis retratos base. Las expresiones adicionales, efectos de sonido especializados y una variante original del altar sin gema quedan como recursos opcionales. Chaos permanece disponible en la hoja de Tikal para el tramo previsto en el guion.

## Archivos

- Nuevos módulos `js/sonic-chapter.js`, `js/sonic-chapter-lines.js`, `js/metal-sonic.js` y `js/battle-stages.js`.
- Integración de historia y menús en `js/story-mode.js`, `js/main.js`, `js/input.js`, `js/config.js`, `js/music.js`, `js/menu-screen.js` y `style.css`.
- Integración de combate y selector en `js/sonic.js`, `js/fighter.js`, `js/combat-system.js`, `js/collisions.js`, `js/cpu.js`, `js/battle.js`, `js/state.js`, `js/selection.js`, `js/pause-menu.js`, `js/animation-catalog.js` y `js/character-guide.js`.
- Nuevos recursos de los ZIP en `assets/Fondos/`, `assets/audio/story/` y `assets/Retratos/Sonic/`. Hojas y recortes en `assets/story/sonic/`. Prólogo y sus archivos de guion anteriores conservados.

## Pruebas en Chrome

- Campañas y acceso de desarrollo. Exploración del casco, persecución, diálogo sobre gameplay, combate con control de Sonic y CPU infectada, derrota y reintento, salida del combate tras victoria, Tikal, desaparición de la gema, final, guardado y retorno al menú.
- La prueba cambió los puntos de vida para recorrer de manera reproducible las dos ramas del jefe. La apertura, el movimiento, los recorridos y los ataques se ejecutaron por los puntos de entrada normales.
- Metal contra Sonic y Rock en Versus con el selector y sonido de Death Egg Arena. Se comprobaron cuadros disponibles para todos los estados y se ejecutaron puño, ascendente, lateral, salto, Rocket, carga y Spin con teclado. Se confirmó daño real de puño en ambos cruces y reproducción del MP3.
- Se recorrió el prólogo hasta la retirada de Emerl y se verificó el desbloqueo de Sonic sin el parámetro de desarrollo. El selector de escenarios también se probó con la Gamepad API simulada. Mando Xbox físico pendiente de prueba.

## Revisión de recortes y puesta en escena

- Se ajustaron los límites y pivotes de los cuadros de Metal Sonic y se separó la estela de la máscara de contacto de dash, Rocket y Spin Dash. El visor incluye 31 secuencias, entre ellas los ataques y poses adicionales de la hoja. Se confirmó daño de puño, ascendente y lateral contra Rock, y la cancelación con frenada.
- Sonic y Rock miden alrededor de 128 px opacos en reposo. Emerl aumentó de unos 104 a unos 121 px visibles y se ajustó la escala de los otros luchadores del reparto.
- Eggman mira hacia sus interlocutores. Knuckles se acerca bajando y subiendo según el plano del altar, con Tikal y una secuencia de Chaos tomada de la hoja original antes de la desaparición.
- Los torsos del carro se compusieron por separado. La cresta de Mad Grinder usa la escala de su hoja corporal, los techos del museo limitan el salto y Heat Man cuenta con una embestida aérea. La intro de Cut Man usa los cuadros completos del salto y conserva los brillos opacos.


## Pulido de Metal Sonic, Tails jugable y Super Shadow

Metal Sonic usa las seis hojas separadas para reposo, arranque, carrera de seis cuadros, frenada, salto y caída con aterrizaje. Las poses de desplazamiento conservan pivotes y espejo por lado. La guía incluye las secuencias de la hoja general y distingue los efectos del cuerpo.

En combate conserva puño, golpe ascendente, golpe lateral, Rocket, frenada, giro y Spin Dash. El salto junto a una pared activa Metal Rebound. Con Q se usa Metal Cannon y con Abajo + Q, Thunder Shock. Con E en suelo se activa el escudo diamante, con E en aire se usa Diamond Thunder y con Abajo + E en suelo se dispara Metal Thunder Wave. Los comandos auxiliares del lado rojo son [ y ]. La onda reproduce su cuadro de salida y cicla el rayo mientras viaja. Los ataques especiales consumen poder y las ventanas de guardia y contacto son independientes de la estela dibujada.

Tails está en Versus y en la Guía de personajes. Su primera adaptación incluye la cadena IQ200/IQ300/IQ400, Magic Hook, Magic Upper, Tails Cyclone, Typhoon, Tails Dunk, vuelo, cura, Energy Ball dirigible, Flick y Chu² Bomb. La guía de animaciones permite inspeccionar los recortes de sus poses, proyectiles y reacciones. El capítulo reutiliza el reposo recortado para sus escenas.

Shadow mantiene el doble toque de abajo. Siete Chaos Emeralds orbitan alrededor del personaje y el destello coincide con el cambio a la paleta super. Si Shadow recibe daño directo antes del destello, la transformación se interrumpe. El segundo doble toque vuelve a la forma base.

Se verificaron en Chrome los 35 clips de Metal, los seis cuadros del bucle de carrera en partida, los golpes con daño, Rocket, Spin Dash, el rebote de pared y los especiales de proyectil y escudo. Se probó el combo, vuelo, cura, bomba y cañón de Tails, incluido apuntar con los controles del lado rojo. También se verificaron la transformación completa de Shadow y su interrupción por daño. El capítulo y el regreso al prólogo pasaron la prueba de recorrido. Un 3 contra 3 de CPU con Metal, Tails y Shadow confirmó relevos y resultado por tiempo.
