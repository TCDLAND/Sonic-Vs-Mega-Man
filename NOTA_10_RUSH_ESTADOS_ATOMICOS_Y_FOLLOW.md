# NOTA 10 — Rush: estados atómicos, Run/Jump y Coil de 6 s

## Síntomas
- Rush mostraba Idle mientras acompañaba a Rock caminando; Run aparecía principalmente al hacer dash.
- Al saltar Rock, Rush intentaba iniciar Jump pero Idle/seguimiento podía recuperar el control.
- El salto de Rush usaba indirectamente la altura de Rock como referencia de suelo, por lo que no completaba su recorrido propio.
- Coil intentaba mover a Rush hacia Rock antes de activarse, contrario al diseño: debe activarse exactamente donde Rush está.
- Rush Jet podía volver a ordenarse antes de terminar correctamente su ciclo de regreso.

## Causas
1. El seguimiento elegía Idle cuando la distancia al punto objetivo era pequeña, aunque Rock siguiera caminando.
2. `_floor()` dependía de `owner.y + owner.height`; durante el salto de Rock ese valor subía/bajaba y alteraba la física de Rush.
3. Coil tenía un estado `coil_move` y un objetivo `coilTargetX` que recolocaban a Rush.
4. Los comandos aceptaban `return` como estado válido, permitiendo interrumpir el regreso.

## Corrección
- El suelo de Rush ahora usa `owner.feetY`, que permanece fijo en el escenario.
- Si Rock está caminando, Rush usa `rush_run` incluso cuando ya mantiene correctamente la formación.
- Cada salto de Rock sólo dispara una vez el salto independiente de Rush. Rush conserva su propia `vx/vy` hasta que SU pivote vuelve a tocar el suelo.
- Prioridad visual/estado: Coil > Jet > Return > Jump > Run > Idle. Idle es únicamente fallback.
- Rush Coil se activa exactamente en la X actual de Rush, sin TP y sin desplazamiento previo. Dura 6000 ms. Durante esos 6 s puede lanzar a Rock repetidamente.
- Coil/Jet/Return son acciones atómicas: mientras una orden no termina, ninguna otra orden de Rush es aceptada.
- Rush Jet regresa caminando. Sólo al llegar junto a Rock empieza un cooldown de 2000 ms antes de permitir otro Jet.
- El pivote físico de Rush no se mueve para acomodar animaciones. Todas las hojas salvo Jet conservan la referencia de 2 px desde abajo.

## Código anterior problemático
```js
_floor(){return this.owner.y+this.owner.height;}

if(Math.abs(d)>8){
    this.x += ...;
    this._setState('run');
}else{
    this.x=target;
    this._setState('idle');
}

startCoil(){
    this.coilTargetX=this.owner.x+this.owner.width/2;
    this._setState('coil_move');
}
```

## Idea corregida
```js
_floor(){ return this.owner.feetY; }

if (needsCatch) {
    // mover y Run
} else {
    this.x = target;
    if (ownerMoving) this._setState('run');
    else this._setState('idle');
}

startCoil(){
    if (!this._commandFree()) return false;
    this.coilUntil = performance.now() + 6000;
    this._setState('coil_start');
}
```

## Pendiente de prueba
- Afinar velocidad horizontal y altura exacta de `rush_jump` según sensación en combate.
- Afinar fuerza de Rush Coil si -19 resulta demasiado alta/baja.
- Afinar cooldown de Rush Jet (actualmente 2 s después del regreso).

## Ajuste V3 — Rush Jet launcher
- Jet conserva trayectoria recta y no persigue al rival.
- Termina al impactar al rival o al alcanzar una pared real; después regresa caminando.
- Su golpe ahora tiene poco knockback horizontal y mucho vertical para funcionar como launcher y permitir una continuación de Rock.
- Rush no flota para seguir a Rock cuando Rock está sobre Concrete: mantiene su lógica terrestre.

---
## V4 — CORRECCION DE RUSH JET TRAS PRUEBA
Fecha: 2026-10-07

Problema observado: en V3 Rush dejó de ejecutar Jet de forma fiable. El comando estaba condicionado por el estado ocupado de Rock y Rush podía estar en su salto automático, por lo que K parecía no hacer nada.

Solución:
- K puede ordenar Rush Jet aunque Rock esté realizando otra animación normal; sólo el selector de armas/intro de Rock lo bloquea.
- Rush Jet puede cancelar el estado normal de salto/idle/run de Rush para responder al comando.
- No puede interrumpir estados atómicos: Intro, Coil, otro Jet o Return.
- Al iniciar Jet, Rush se coloca en la línea del suelo y viaja recto hacia su facing hasta rival o pared.
- Impacto conserva poco empuje horizontal y gran lanzamiento vertical (`vy=-15`) para preparar continuaciones de Rock.
- Tras impacto o pared vuelve caminando y después empieza el cooldown.

## V5 — Rush Jet, salto y cooldown cruzado

### Problema observado
Rush Jet seguía sintiéndose condicionado por la IA de salto/follow y no quedaba clara la disponibilidad entre Coil y Jet.

### Decisión
- Coil sigue siendo atómico: mientras está en Coil no acepta Jet.
- Si Rush está en cooldown tampoco puede repetir el comando bloqueado.
- Jet sí puede activarse desde el estado JUMP. Esto convierte `salto de Rock -> Rush salta -> K` en una ruta rápida intencional: Rush se transforma en Jet desde su altura actual y sale recto.
- Jet ya no fuerza su Y al suelo cada frame: conserva la altura desde la que fue activado.
- Al terminar y regresar físicamente con Rock comienza el cooldown: 4 s para repetir el mismo comando y 2 s para usar el otro.
- Jet termina al impactar al rival o al llegar a pared y vuelve caminando.

### Resultado esperado
Rush ya no necesita estar cerca del enemigo para recibir Jet y el salto puede utilizarse deliberadamente para variar/adelantar su salida, sin permitir cancelar Coil.
