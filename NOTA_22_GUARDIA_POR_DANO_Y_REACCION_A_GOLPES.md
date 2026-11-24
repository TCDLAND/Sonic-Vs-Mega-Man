# NOTA 22 — Guardia por daño y reacción a golpes

Fecha: 20/11/2026

## Problemas observados

- La guardia se rompía al cuarto impacto sin importar cuánto daño hiciera cada impacto. Una ráfaga de Bass podía romperla demasiado rápido aunque fueran disparos pequeños.
- Los disparos ligeros de Bass podían dejar al rival caminando porque el input de movimiento reemplazaba el pequeño empuje en el siguiente cuadro.

## Cambios

- La guardia ahora acumula el daño base ajustado por el multiplicador defensivo de quien bloquea. Se rompe al alcanzar **60 puntos de presión**; se reinicia tras 2.8 segundos sin recibir otro golpe bloqueado. No cuenta impactos ni repeticiones por contacto.
- Los golpes bloqueados siguen causando 15% de daño de chip. El impacto que supera el umbral rompe la guardia y aplica daño completo, retroceso y recuperación de 1.5 segundos.
- Un golpe que conecta sin ser bloqueado aplica entre 110 y 190 ms de hitstun según su daño. Durante ese lapso no se puede caminar, saltar, cubrirse ni iniciar otro ataque, y el empuje existente no se borra al actualizar el movimiento.
- Los proyectiles de Bass conservan su empuje acumulado: las balas individuales producen una reacción breve, los impactos continuos aumentan el retroceso y la ráfaga larga puede lanzar al rival. Cubrirse evita ese hitstun y el retroceso de la bala.

## Archivos

- `js/combat-system.js`: presión de guardia por daño y hitstun al recibir un impacto sin bloquear.
- `js/fighter.js`: bloqueo temporal de controles de movimiento y acciones durante el hitstun.
- `js/bass.js`: hitstun integrado en caminar, saltar, cubrirse y disparar.
- `js/collisions.js`: la rutina de Bass mantiene la reacción y el retroceso acumulado de las ráfagas.
- `NOTA_19_IA_ADAPTATIVA_GUARDIA_Y_PRUEBAS.md`: marcada la regla antigua de cuatro impactos como sustituida.

## Verificación

Se revisará sintaxis y formato del diff. No se ejecutó una pelea en navegador en este cambio; falta comprobar visualmente la reacción de Bass y calibrar el umbral de 60 con los daños definitivos de los ataques.
