# NOTA 03 — Correcciones Knuckles: muro, Spin Minero, agarre y planeo

Fecha: 2026-10-06
Build base: `JuegoPeleas_KNUCKLES_PRIMERA_PRUEBA(1).zip`

Esta nota se deja como bitácora técnica. A partir de esta build, las notas del proyecto usan el prefijo `NOTA_XX_` y las siguientes actualizaciones deben continuar la numeración y consultar las notas anteriores antes de modificar estos sistemas.

## 1. Wall Cling: TP/desplazamiento raro y caída al mover izquierda/derecha

### Síntoma
Knuckles podía anclarse al pilar, pero al pulsar horizontal el movimiento general se ejecutaba antes que la lógica de pared. Eso podía separarlo del borde, hacer que dejara de cumplir `atLeft/atRight` y provocar un desplazamiento/caída rara. Además, aun quieto, la gravedad de `super.update()` movía su Y antes de que Knuckles pusiera `vy = 0`.

### Código problemático anterior
```js
const atLeft=this.x<=226.5, atRight=this.x+this.width>=2333.5;
if(!this.isGrounded && (atLeft||atRight) && !this.glide && !this.minerPhase){
 const toward=atLeft?this.keys[this.controls.left]:this.keys[this.controls.right];
 if(toward||this.wallClingK){
  this.wallClingK=true;
  this.vx=0;
  this.vy=0;
  const up=this.keys[this.controls.jump];
  if(up){this.y-=3;this.wallAnimStep++;}
 }
}
```

### Qué faltaba
No existían `wallSideK` ni `wallAnchorX`, así que el anclaje dependía de que Knuckles siguiera casualmente tocando la coordenada del muro después de las físicas generales. Tampoco se restauraba la Y previa a la gravedad.

### Cambio
Ahora, al engancharse, se guarda el lado y una X fija. Mientras siga anclado, izquierda/derecha no alteran la posición. La Y se conserva si no sube. Solo doble pulsación de salto lo desprende. Al subir se mueve lentamente y el frame 1/2 cambia como máximo una vez por segundo; si deja de subir, conserva exactamente el frame donde quedó.

```js
_attachWall(side){
 this.wallClingK=true;
 this.wallSideK=side;
 this.wallAnchorX=side==='left'?226:2334-this.width;
 this.x=this.wallAnchorX;
}

if(this.wallClingK){
 this.x=this.wallAnchorX;
 this.y=specialYBefore;
 this.vx=0;
 this.vy=0;
 if(this.keys[this.controls.jump]){
  this.y-=1.35;
  if(now-this.wallLastStepAt>=1000){
   this.wallAnimStep=(this.wallAnimStep+1)%2;
   this.wallLastStepAt=now;
  }
 }
}
```

## 2. Spin Minero: estado subterráneo no se desplazaba correctamente

### Síntoma
La secuencia podía entrar en el estado del topo, pero el movimiento bajo tierra no se aplicaba de forma fiable.

### Código problemático anterior
```js
const left=this.keys[this.controls.left],right=this.keys[this.controls.right];
this.vx=(left?-this.speed:0)+(right?this.speed:0);
```

### Problema real
`Knuckles.update()` llama primero a `super.update()`. El movimiento físico (`this.x += this.vx`) ocurre dentro de `super.update()` ANTES de que el bloque del Spin Minero asignara ese nuevo `vx`. En el siguiente frame el movimiento genérico podía volver a poner `vx` en 0 porque Knuckles estaba en un estado especial. Por eso se calculaba velocidad, pero no necesariamente se convertía en desplazamiento.

### Cambio
El desplazamiento subterráneo ahora se aplica directamente a X dentro del propio estado `under`, con límites del escenario. Al comenzar el topo también se limpian crouch/Spin Dash normales para que no compitan con el estado minero.

```js
const move=(left?-this.speed:0)+(right?this.speed:0);
this.x=clamp(this.x+move,226,2334-this.width);
this.vx=0;
```

Se conserva el diseño acordado:
- 0.8 s: frames 1–4, Spin castigable.
- 0.4 s: frames 5–10, hundimiento.
- máximo 4 s bajo tierra.
- 1 s de aviso antes de salir.
- más tiempo enterrado = más daño.

También se corrigió `piedras_de_suelo.png`: su pivote vertical está ahora en la mitad del sprite (Y=16 en la hoja original), alineado con el piso, en lugar de colocar todo el efecto por encima del suelo.

## 3. Agarre: la animación funcionaba pero el rival no salía lanzado

### Código problemático anterior
```js
receiver.x=...;
receiver.y=this.y;
receiver.vx=0;
receiver.vy=0;

if(this.kFrame>=9&&!this.kHit){
 receiver.vx=-this.grabFacing*12;
 receiver.vy=-5;
 this.kHit=true;
}
```

### Problema real
El lanzamiento sí asignaba `vx/vy`, pero en los frames siguientes la misma coreografía volvía a ejecutar `receiver.vx=0; receiver.vy=0;`. El propio agarre borraba el lanzamiento que acababa de crear.

### Cambio
Se añadió `grabThrown`. El rival queda pegado durante la coreografía y se lanza una sola vez al final (frame 15 / índice 14). Después del lanzamiento ya no se vuelve a reposicionar ni se borran sus velocidades.

```js
if(!this.grabThrown){
 // coreografía...
 if(this.kFrame>=14){
  receiver.vx=-this.grabFacing*12;
  receiver.vy=-5;
  receiver.wasInAirFromKnockback=true;
  this.grabThrown=true;
 }
}
```

El daño extra por estrellarse contra un muro sigue pendiente para una actualización posterior.

## 4. Planeo: poco sustentado y velocidad física inconsistente

### Código anterior
```js
const sx=playableW/4/60;
const sy=playableH/8/60;
this.vx=this.glideDir*sx;
this.vy=sy;
```

### Problemas
1. El diseño inicial era ~4 s de extremo a extremo perdiendo media altura, pero en prueba se pidió un planeo algo más rápido y que dure más en el aire.
2. Igual que con el topo, asignar `vx/vy` después de `super.update()` hacía que el desplazamiento dependiera de lo que las físicas genéricas hubieran hecho antes.
3. La gravedad genérica podía sumar caída adicional antes de que se restaurara `vy`.

### Cambio de prueba
- ancho jugable completo: ~3.5 s.
- en ese recorrido pierde aproximadamente 1/3 de la altura jugable.
- conserva la dirección aunque cruce al rival.
- el desplazamiento se aplica desde la posición que tenía al comenzar el frame, evitando que el movimiento genérico/gravedad cambien el resultado.

```js
const sx=playableW/3.5/60;
const sy=(playableH/3)/3.5/60;
this.x=specialXBefore+this.glideDir*sx;
this.y=specialYBefore+sy;
```

Estos valores son de prueba y se pueden balancear después de jugar la build.

## Pendientes conocidos que NO se resolvieron aquí

- `knuckles_punch_floor.png` sigue sin venir en el ZIP base; el código ya lo espera.
- Daño adicional del agarre al estrellar al rival contra un muro.
- Cámara dinámica / zoom y muros invisibles de cámara.
- Knuckles Update 2: piedra grande, golpes verticales adicionales y otros ataques.
- Probar de nuevo las correcciones recientes de Zero (Run y Air Slash).
