# NOTA 09 — Rush: Follow, Run, Jump y Coil

## Síntomas
- Rush seguía a Rock sin reproducir correctamente `rush_run`.
- Al saltar Rock, Rush no ejecutaba su salto propio.
- Rush no recorría la trayectoria horizontal descrita para `rush_jump`.
- Rush Coil se activaba en el lugar donde Rush estuviera y quedaba inmóvil.
- El pivote parecía cambiar según el estado/animación.

## Causa raíz
`_setState('run')` se llamaba repetidamente durante el seguimiento y reiniciaba `stateAt`, por lo que la animación de carrera podía quedarse visualmente en su primer frame. Además, `startCoil()` teletransportaba `x/y` de Rush directamente a Rock. El seguimiento y las acciones especiales no tenían una separación suficientemente estricta de responsabilidades.

## Corrección
- `_setState()` ahora no reinicia el reloj si Rush ya está en ese estado.
- El pivote físico `this.x / this.y` se conserva. Todas las hojas salvo Jet se dibujan con el punto de suelo a 2 px del borde inferior mediante sus `pivotY` ya definidos; no se desplaza el pivote para acomodar animaciones.
- FOLLOW mueve físicamente a Rush hacia su posición detrás de Rock. Si existe distancia, usa `rush_run`; durante dash aumenta velocidad y FPS.
- Cuando Rock despega, Rush inicia una parábola propia (`vy=-8.2`, `vx=11.5` en la dirección de Rock): salto más bajo y con gran recorrido horizontal. Frames 1-2 impulso, 3 ascenso/avance, 4 descenso.
- Coil ahora comienza con `coil_move`: Rush corre físicamente hasta la posición de Coil. Sólo al llegar ejecuta frames 1-2 y después 3-4 en bucle.
- El rebote sigue requiriendo que Rock esté descendiendo y que el pivote de sus pies contacte píxeles opacos de la zona izquierda del resorte. Frame 5 = contacto; frame 6 = lanzamiento; luego vuelve 3-4.
- Jet e Intro no fueron rediseñados porque ya funcionaban.

## Pendiente de prueba
Ajustar únicamente sensaciones (distancia de seguimiento, altura/avance del salto, velocidad de llegada al Coil y fuerza del Coil) después de verlo en juego. No compensar esas sensaciones moviendo el pivote.
