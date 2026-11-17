# NOTA 15 — FIRE / KNockback / pendientes heredados

## Objetivo
Incorporar el set FIRE de Rock a partir de los seis PNG entregados y `rock_paleta2.png`, preservando BASE, CUT/CONCRETE, Rush y Beat.

## Cambios incluidos en esta versión de prueba
- Selector S,S,D habilita FIRE; BASE y CUT/CONCRETE conservados.
- J = Fire Man Shot, disparo repetible en suelo o aire. E+J = Heat Fire parabólico, con animación de Slash Claw, lanzamiento en tercer frame, y zona de fuego al impactar el piso.
- M = Flame Sword ascendente. La hoja `rock_flamesword_fire.png` es una versión recoloreada del cuerpo Power Battle; la espada conserva su hoja de efectos y colisión por píxeles alfa.
- Heat Fire2: nacimiento 1–3 repetidos durante 0.5s; bucle 4–7; extinción 8–11; intento de extinción 8–9.
- Cada Fire Man Shot que llega a la zona alimenta el fuego y suma un impacto; al tercero se crea una columna de fuego que avanza horizontalmente y levanta al rival.
- Knockback FIRE: proyectiles empujan más a un rival aéreo, fuego de suelo aplica empuje horizontal moderado por tic y la columna levanta.
- Cancelación Spin Dash al soltar agacharse sosteniendo dirección contraria; cancela movimiento y puede apagar fuego cercano.
- Colisión entre Concrete móvil y fijo: ambos pasan a romperse. Entrada de Beat termina en el punto de seguimiento.
- Ajuste menor a la reactivación de Rush Jet desde estado de retorno próximo al objetivo; su funcionamiento debe verificarse jugando.

## Parámetros provisionales a probar
- Fire Shot 3 de daño, Heat proyectil 7, suelo 2 por tic, columna 12 por tic, Flame Sword 12.
- Fuego suelo 4.5 segundos iniciales; cada disparo agrega 0.9 segundos.
- Columna 95 ticks de existencia, avanza y atraviesa enemigos.
- Estas cifras NO están aprobadas definitivamente por el diseñador.

## Pendientes importantes NO RESUELTOS O NO VERIFICADOS
1. Rush Jet reportado como inoperante: probar desde idle, run, jump, return, cooldown, ambos lados. El pequeño ajuste incluido no garantiza solucionar la causa.
2. Concrete D+J, S+J, E+J: revisar prioridad y coherencia de comandos. D+J actualmente puede producir comportamiento distinto según teclado y orientación.
3. Concrete debe tener colisión física universal (pared, techo, suelo, transporte) con TODOS los luchadores, no sólo Rock; aún falta integrarlo a la física central.
4. Concrete móvil contra construido: verificar destrucción simultánea, launcher y daño por impacto sin dobles golpes.
5. Beat: comprobar visualmente que no hay teletransporte al finalizar intro.
6. Validar frames exactos y pivotes de Heat Fire y Flame Sword en navegador.
7. Colisiones por alfa del Fire Shot y columna, límites de objetos simultáneos, persistencia entre sets, daño a Chaos e inmunidad al fuego: por integrar.
8. No hay pruebas de juego automatizadas con Canvas real en esta entrega; sólo verificación de sintaxis JavaScript.
9. El juego aún requiere un sistema universal de knockback por tipo de impacto, especialmente aéreo. FIRE implementa una primera versión local, NO modifica el sistema global.

## Bitácora técnica
- Antes: selector bloqueaba FIRE, J seguía el Buster y no existían objetos de fuego.
- Después: nueva rama de entradas FIRE, animaciones y efectos independientes en `js/rock.js`, paleta FIRE de `rock_colors_powers.png`, conversión de Power Battle a colores FIRE.
- Causa del cambio Concrete: el móvil se rompía al tocar un construido, pero el construido seguía intacto.
- Causa del ajuste Beat: trayectoria de intro no acababa exactamente en el punto de seguimiento.
- Nota de pruebas: no marcar Rush Jet ni Concrete universal como corregidos sin verificación en juego.
