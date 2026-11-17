# NOTA 16 — LEAF / SNAKE / BOMB, Concrete, Rush y Heat Fire

## Implementado (versión experimental)
- Cuarta paleta verde/blanca desde `rock_colors_powers.png` (120×2; segmento x=90..119), índice 6.
- Set verde seleccionable mediante doble abajo + izquierda.
- J: Search Snake, hasta dos simultáneas; animación 3×48, pivote x=2 inferior, sube Concrete y partículas al terminar.
- M: Hyper Bomb, 3×32, alternancia 1/2 y explosión frame 3, tiro corto suelo / más largo aire; se detona con fuego cercano.
- I: Leaf Shield, cuatro hojas giratorias independientes; cada cuadrante protege sólo mientras conserva su hoja; hojas caen frames 13..17. I de nuevo lanza hojas restantes y daño según cantidad.
- Rush Jet: se permite interrumpir `return` y completar intro vencida; siguen los cooldowns y la exclusión de Coil activo.
- Heat Fire: velocidad y altura de arco reducidas; mayor distancia al disparar desde el aire.
- Concrete: detección estable basada en silueta del primer idle (alfa) y resolución física para el rival, además de Rock; prioridad E+J corregida.

## Limitaciones y pruebas pendientes
- No se ha ejecutado una prueba visual completa en navegador. Comprobar física de Concrete al saltar, dash y cambios de dirección. La resolución usa el rectángulo envolvente de la silueta opaca, no todos sus píxeles interiores.
- El sistema de daño central recibe puntos de impacto aproximados cuando el ataque no los suministra; golpes de sable que cruzan dos cuadrantes requieren integrar el punto exacto del primer píxel de contacto en su propio detector.
- Las serpientes sólo suben los Concrete del propio Rock; falta integración con paredes del mapa.
- Hyper Bomb: detonación por ataques físicos/proyectiles ajenos aún requiere enganchar todos los detectores de colisión del motor.
- La protección Leaf intercepta daño central, pero algunos ataques aplican knockback incluso si se bloquea daño; revisar cada detector.
- Validar los controles de los dos jugadores, la temporización de Rush y los sprites en navegador antes de considerar esta versión estable.
