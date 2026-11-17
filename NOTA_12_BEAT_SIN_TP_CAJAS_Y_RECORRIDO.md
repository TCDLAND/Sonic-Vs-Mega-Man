# NOTA 12 — Beat: entrada sin TP, lanzamiento aéreo, cajas y más recorrido

## Síntomas / cambios pedidos
1. Al terminar la intro, Beat era teletransportado directamente a su posición FOLLOW.
2. Beat Crescent golpeaba, pero sólo empujaba horizontalmente; debía lanzar al rival por el aire.
3. Beat Drop todavía no tenía objeto real. Por ahora sólo debe soltar cajas de distintos tamaños/daños, no proyectiles especiales.
4. Patrol horizontal y Crescent/U recorrían poca distancia.

## Causa
- La intro terminaba asignando explícitamente `x = _followX()` y `y = _followY()`.
- Crescent sólo asignaba `receiver.vx`.
- Patrol generaba un evento provisional `beatDropEvent` sin entidad física.
- Los recorridos estaban fijados en 650 px (Patrol) y 560 px (Crescent).

## Código anterior problemático
```js
if(t>=1){this.x=this._followX();this.y=this._followY(); ... }
const travel=560;
const range=650;
receiver.vx=this.pathDir*4;
this.owner.beatDropEvent={x:this.x,y:this.y,at:now};
```

## Corrección
- La intro cambia a FOLLOW desde el punto exacto donde terminó la U. FOLLOW lo lleva físicamente detrás de Rock, sin TP.
- Crescent ahora aplica `vx=dir*6`, `vy=-9` y estado aéreo/knockback.
- Crescent aumenta a 720 px.
- Patrol aumenta a 900 px por tramo y 1500 ms para conservar lectura visual de los 15 frames.
- Se añadió `BeatBox`: tres tamaños (24/34/46 px) con daños 5/8/12. Caen con gravedad, chocan con el cuerpo del rival y desaparecen al golpear o tocar el suelo.
- Cada Patrol sigue permitiendo una sola caja: I deja la orden pendiente y el frame 15 la suelta.

## Pendiente
- Sustituir las cajas dibujadas por arte definitivo si se crean sprites propios.
- Ajustar daños/tamaños/velocidad después de pruebas reales.
- Conectar vulnerabilidad de Beat durante Crescent/Patrol/Return ofensivo al sistema general de ataques.
