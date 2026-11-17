KNUCKLES - BUILD DE PRUEBA

Controles P1:
J = Punch
S + J = Punch Floor (CODIGO LISTO, pero el ZIP recibido NO incluia knuckles_punch_floor.png)
I = Punch 2
Hacia el rival + I = Agarre
M = Upper
K en aire = iniciar planeo
K durante planeo = golpe de planeo
S + K en suelo = Spin Minero
K bajo tierra = elegir salida (aviso 1 s y luego upper de salida)
Space + agachado = Spin Dash normal
W en pared = escalar; doble pulsacion de W = soltarse

Knuckles Glide:
- conserva direccion aunque cruce al rival
- extremo a extremo ~= 4 s
- en ese recorrido pierde ~= media altura jugable

Spin Minero:
- 0.8 s frames 1-4: spin castigable
- 0.4 s frames 5-10: se hunde; hurtbox sigue pixels visibles
- hasta 4 s bajo tierra
- mas espera = mas daño
- salida imbloqueable en esta prueba

Zero:
- Run: frames 1-2 solo arranque; loop 3-16
- K en aire usa zero_air_slash.png
- Air Slash: frame 1 sin daño; 2-5 activos; frame 6 solo donde haya paleta Z-Saber; 7-9 sin daño
- Slash A/B/C terrestres ya no se lanzan en aire

Guard:
- la guardia sigue siendo logica al mantener atras
- Sonic/Knuckles solo muestran sprite de guard al BLOQUEAR un impacto
- al retroceder, Run se reproduce 3x mas lento

IMPORTANTE:
En el ZIP recibido faltaba assets/images/knuckles_punch_floor.png. El codigo ya lo referencia; agregalo con ese nombre para ver la animacion del golpe de suelo.

UPDATE 2026-10-06:
- Wall Cling v2: anclaje fijo; horizontal no lo suelta; doble salto lo libera; animacion cambia 1 vez/s al subir.
- Spin Minero v2: movimiento subterraneo corregido y pivote del efecto de tierra centrado en el piso.
- Agarre v2: lanzamiento final ya no es borrado por la propia coreografia.
- Glide v2: ~3.5 s de extremo a extremo y ~1/3 de altura perdida por cruce.
- Ver NOTA_03_UPDATE_KNUCKLES_FIXES.md para bitacora tecnica y codigo antes/despues.
