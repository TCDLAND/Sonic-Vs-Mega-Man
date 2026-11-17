# NOTA 13 — POWER 1: sets por paleta + Rolling Cutter

## 1. De dónde salió el sistema de Weapon Sets
El plan anterior trataba cuatro poderes como armas aisladas: Rolling Cutter, Flame Sword, Search Snake y Leaf Shield. Al revisar las paletas oficiales apareció un problema de diseño: Search Snake y Leaf Shield dejan a Mega Man con una identidad verde/blanca muy parecida. Recolorear Leaf Shield sólo para distinguirlo iba contra la fidelidad visual buscada.

La solución fue convertir esa coincidencia en regla del personaje: una paleta representa un SET de dos poderes. Así se reorganizó Rock en tres pares: CUT/CONCRETE, FIRE y LEAF/SNAKE. La primera prueba técnica es CUT/CONCRETE. Mientras un set especial esté equipado, Mega Buster queda fuera; BASE/Buster será su propio modo. Al cambiar de set, el set anterior deberá limpiar sus entidades persistentes para impedir apilar herramientas de varias paletas.

## 2. Paleta CUT / CONCRETE
`rock_colors_powers.png` mide 60x2. Contiene dos bloques de 30 px: paleta normal y primera paleta de poder. Cada color ocupa 2 px, igual que el sistema usado para las cargas.

La paleta CUT/CONCRETE extraída es:
`#404040 #f8b840 #a82010 #9b9d9e #dadada #fffefb #716767 #4b4b4b #1e1e1e #f8b080 #d07048 #804020 #f0f0f0 #989898 #282828`

Para este prototipo Rock inicia directamente en `cut_concrete`, por lo que se ve con esta paleta y J deja temporalmente de cargar Mega Buster.

## 3. Animación de Rock: conservar Slash Claw y crear Cut Shot independiente
Se decidió NO sustituir `rock_slash_claw.png`. El ataque físico normal y el lanzamiento del Cutter deben poder evolucionar por separado aunque compartan la misma base de poses.

Nuevas hojas:
- `rock_cutshotwithoutcut.png`: 304x48, 4 frames de 76x48. Contiene a Rock sin la tijera.
- `rock_cutshotwithcutter.png`: 304x48, 4 frames de 76x48. Funciona como overlay del Cutter sostenido en frames 1 y 2; frames 3 y 4 están vacíos.

La hoja original Slash Claw tenía celdas lógicas 56x48. Las nuevas agregan 20 px A LA DERECHA, así que 56+20=76. El pivote de Rock NO cambia: sigue siendo `pivotX=32, pivotY=48`. Esto evita mover el cuerpo por haber ampliado el lienzo.

Código anterior relevante:
```js
slash:{img:load('assets/images/rock_slash_claw.png'),n:4,cw:56,ch:48,pivotX:32,pivotY:48,sourceFacing:-1}
```

Nuevo descriptor:
```js
cutshot:{
  img:load('assets/images/rock_cutshotwithoutcut.png'),
  fx:load('assets/images/rock_cutshotwithcutter.png'),
  n:4,cw:76,ch:48,pivotX:32,pivotY:48,sourceFacing:-1
}
```

## 4. Punto exacto donde está el Cutter antes de desprenderse
En el frame 2 del overlay, el arma ocupa aproximadamente 21x12 px. La medición dada fue 1-based: comienza en x=12 (1..11 vacíos) y queda a 14 px desde abajo. En coordenadas 0-based de código corresponde a `localX=11`, `localY=23`, tamaño `21x12` dentro de una celda 76x48.

Esto es importante porque el frame 3 ya no dibuja la tijera junto a Rock. Al entrar al frame 3 se crea la entidad `RollingCutter` en la posición mundial que ocupaba el arma durante el frame 2. El cálculo respeta el espejo horizontal de Rock.

## 5. Sprite del proyectil
`cutter.png` mide 288x16: 9 frames de 32x16. El frame 8 es la orientación que coincide con el instante del lanzamiento. En esa celda el dibujo empieza aproximadamente en x=7 (1-based) y queda 2 px desde el borde inferior, coherente con la medición manual.

El proyectil inicia su ciclo visual en el frame 8 y continúa rotando por los 9 frames. Cuando Rock mira al lado contrario se refleja en X, igual que los demás sprites de Mega Man.

## 6. Hitbox: no usar todo el rectángulo transparente
El requisito fue que sólo los píxeles no-alpha del Cutter hagan daño. El sistema general antes comprobaba el rectángulo del proyectil contra los píxeles del rival, pero no comprobaba alpha contra alpha del propio proyectil.

Antes:
```js
target.pixelBodyIntersectsRect({x:proj.x,y:proj.y,w:proj.width,h:proj.height}, ...)
```

Ahora Rolling Cutter expone su frame real y usa:
```js
opaqueFramesOverlap(cutterFrame, targetFrame, null, 1)
```

`main.js` consulta `proj.pixelHitsTarget(target)` cuando el proyectil ofrece esa función. Los demás proyectiles conservan el comportamiento anterior. Así el espacio transparente dentro de los 32x16 del Cutter no causa daño.

## 7. Límite de Cutter
Se mantuvo la regla recordada: Rock sólo puede tener UN Rolling Cutter activo. `startRollingCutter()` busca una entidad activa `rolling-cutter` del mismo dueño y rechaza un segundo lanzamiento hasta que el primero desaparezca o impacte.

## 8. Controles temporales para probar trayectorias
Mientras probamos POWER 1, J se dedica a Rolling Cutter:
- `J`: arco medio/clásico.
- Mirando a la derecha: `E + J` = parábola alta `∩`; `D + J` = parábola baja `∪`.
- Mirando a la izquierda: `Q + J` = parábola alta `∩`; `A + J` = parábola baja `∪`.

Las tres trayectorias se calculan como curvas con desplazamiento horizontal y término cuadrático en Y. Los coeficientes son de primera prueba y deben ajustarse jugando, no considerarse balance final.

## 9. Estado de la animación
Rock queda comprometido durante los cuatro frames del lanzamiento: se detiene, bloquea el facing y no puede iniciar otra acción ocupada. Frames 1-2 muestran el Cutter como overlay. Al entrar al frame 3, el overlay ya no existe y nace el proyectil independiente.

## 10. Pendiente
- Probar visualmente el punto de desprendimiento y ajustar 1-2 px si la transición frame 2 -> proyectil revela un salto.
- Afinar altura, alcance y velocidad de los tres arcos.
- Confirmar daño/knockback definitivo de Rolling Cutter después de probar contra varios tamaños.
- Implementar Concrete Shot y la geometría sólida del set.
- Construir el selector de sets: ↑ CUT/CONCRETE, → FIRE, ← LEAF/SNAKE, ↓ BASE/Buster.
- Al cambiar de set, implementar `cleanup()` para Cutter, concreto, hojas, serpientes y efectos persistentes.
- Integrar las futuras paletas añadidas a `rock_colors_powers.png` sin romper la paleta CUT/CONCRETE.

---

# ITERACIÓN 2 — Concrete Shot, selector de sets y corrección de Rolling Cutter

## 11. Problema detectado: Rolling Cutter se estaba comportando como proyectil largo
La primera versión de Rolling Cutter usaba parábolas largas y podía recorrer una parte excesiva del escenario. Esto no coincidía con la intención nueva: Cutter debe ser un boomerang de alcance corto/medio, útil por colocación y altura, no un proyectil que controle todo el mapa.

### Solución
- Se movió Rolling Cutter de J a M mientras CUT/CONCRETE está equipado.
- Sale a distancia corta, hace un arco y regresa hacia la POSICIÓN ACTUAL de Rock.
- Sigue existiendo máximo un Cutter activo.
- Al tocar al rival aplica knockback y comienza el regreso en vez de desaparecer inmediatamente.
- `rock_slash_claw` NO se elimina: M vuelve a Slash Claw cuando Rock está en BASE.

## 12. Reorganización de controles de CUT / CONCRETE
El set ya no usa J exclusivamente para Cutter.

- J = Concrete largo/móvil.
- abajo + J = Concrete cercano/de construcción.
- M = Rolling Cutter.
- I = Beat, sin cambio.
- K = Rush, sin cambio.
- BASE recupera J = Mega Buster y M = Slash Claw.

La razón es que Concrete Shot sale del Buster y visualmente debe reutilizar las poses Fire/RunFire/JumpFire, mientras Cutter conserva su animación Cut Shot separada.

## 13. `concreto.png`: lectura física de los 11 frames
El PNG entregado mide 352x32: 11 celdas de 32x32. El bloque sólido visible mide 22x22 y se renderiza con la misma escala x3 aproximada de Rock: 66x66 físicos.

La hoja YA está orientada izquierda -> derecha. Sólo se refleja cuando el disparo viaja hacia la izquierda.

Lectura de estados definida durante la iteración:
1. proyectil subiendo;
2. viaje más horizontal;
3. proyectil bajando;
4. ejecución muy cerca del suelo (6 px fuente = 18 px render);
5. primer contacto con suelo;
6. expansión/formación, todavía NO permite subirse;
7. bloque completo 22x22: desde aquí nace la plataforma sólida;
8. bloque con grietas leves;
9. bloque muy agrietado;
10. colapso: pierde altura y el personaje que estaba encima debe bajar con la superficie;
11. polvo/destrucción: se reutiliza varias veces con desplazamientos y fade-out.

Los frames comparten pivote conceptual centro-abajo. Las mediciones internas dadas para cada frame se conservan como referencia visual, pero no deben convertirse en once pivotes independientes.

## 14. Dos Concrete, un mismo lanzamiento
Problema de diseño: si cercano y largo tenían lanzamientos distintos, el rival podía leer inmediatamente cuál era y la mecánica de montar el largo podía quedar demasiado lejos de Rock.

Decisión: AMBOS usan exactamente el mismo lanzamiento corto y la misma formación 1->7. Sólo se separan después de formarse:
- cercano: queda quieto como plataforma;
- largo: empieza a deslizarse horizontalmente por el suelo.

El lanzamiento se mantiene corto para que Rock tenga tiempo real de saltar sobre el Concrete móvil.

## 15. Límites simultáneos
Los límites son por categoría, no un pool global:
- máximo 2 Concrete cercanos/de construcción;
- máximo 1 Concrete largo/móvil;
- máximo total posible: 3.

El Concrete largo además entra en cooldown DESPUÉS de romperse/desaparecer. Primera prueba: 2.8 s. La razón es impedir presión casi infinita si Rock logra arrinconar al rival.

## 16. Plataforma móvil
Nueva idea aceptada: Rock puede subirse al Concrete largo una vez que alcanza frame 7. No se pega artificialmente al bloque: se trata como superficie móvil.

- hereda el desplazamiento X mientras está apoyado;
- puede caminar/saltar desde él;
- si se rompe debajo, cae normalmente;
- frames 1-6 no tienen plataforma;
- Concrete cercano también es plataforma desde frame 7.

Esto crea una técnica propia del set: viajar sobre Concrete y usar la altura/movimiento para colocar Rolling Cutter.

## 17. Rush y Concrete
Problema evitado: Rush no debe copiar la altura de Rock cuando Rock se sube al Concrete. Eso haría que el perro flotara.

Decisión: Rush conserva su suelo físico del escenario y sigue caminando por debajo/detrás. Subirse a una plataforma no se interpreta como salto de Rock. Rush sólo usa su comportamiento aéreo normal cuando corresponde a su propia lógica.

## 18. Vida, resistencia y grietas
Primera prueba de balance:
- HP base: 20.
- multiplicador de daño recibido: 0.80.
- Bass: 8 balas x 3 x 0.80 = 19.2; se considera que una ráfaga completa lo rompe "apenitas" (umbral residual <=0.8).
- X Buster máximo puede marcarse como `breaksConcrete` y destruirlo directamente.

Estados visuales por integridad:
- >70%: frame 7 intacto;
- >20% y <=70%: frame 8 con grietas;
- <=20%: frame 9 crítico;
- destrucción: 10 -> 11.

La resistencia/HP son valores de PRUEBA, elegidos alrededor de la ráfaga completa de Bass; deberán probarse contra el roster.

## 19. Concrete largo contra rival y pared
El largo es plataforma + ataque de presión.
- Al conectar hace daño moderado y empuja en la dirección de viaje.
- El Concrete también pierde integridad al choque.
- Si el rival empujado llega a una pared real del escenario (x≈226 o x≈2368), recibe un único daño extra de impacto contra pared y el Concrete se rompe.
- El bonus de pared no puede repetirse en el mismo Concrete.

Los valores actuales (8 impacto, +5 pared) son PROVISIONALES para prueba jugable, no balance definitivo.

## 20. Estela de Spin Minero reutilizada
Mientras el Concrete largo corre por el piso se reutiliza `knuckles_spin_minero.png` como VFX de tierra/piedras.

Corrección importante de orientación: esta hoja YA viene izquierda -> derecha, igual que `concreto.png`; NO comparte la orientación invertida de los sprites de Rock. Sólo se refleja al viajar hacia la izquierda.

- pivote visual: borde inferior trasero del Concrete; la referencia entregada fue aproximadamente x=27 del frame del Concrete cuando viaja a la derecha;
- las partículas quedan siempre DETRÁS del bloque;
- se reproduce la secuencia sin llegar al último frame de piedras/emergencia;
- no tiene hitbox, hurtbox, daño ni interacción: es 100% visual.

## 21. Mini selector de Weapon Sets: doble abajo + tercer input
Se descartó el cambio automático/directo anterior. El comando final es encadenado:
- abajo una vez = agacharse normal;
- abajo, abajo en ventana corta (~300 ms) = abrir selector;
- el tercer input puede darse inmediatamente (jugador experto) o después de mirar el menú.

Direcciones previstas:
- abajo + abajo + arriba = CUT/CONCRETE;
- abajo + abajo + derecha = FIRE;
- abajo + abajo + izquierda = LEAF/SNAKE;
- abajo + abajo + abajo = BASE/BUSTER.

En esta entrega FIRE y LEAF/SNAKE aparecen como reservados/no funcionales hasta tener sus poderes. Al abrir el selector el combate NO se pausa. Rock se detiene; recibir daño cancela el menú.

## 22. Confirmación visual de cambio de paleta
Corrección de una confusión durante el diseño: NO se alterna "paleta anterior <-> paleta nueva".

`rock_colors_charge.png` tiene 4 paletas y la P3 (índice 2) es la paleta común de destello que ya se intercala con las demás cargas:
- Nv1: P1 <-> P3;
- Nv2: P2 <-> P3;
- Nv3: P4 <-> P3.

Al cambiar Weapon Set se reutiliza ese lenguaje visual:
`P3 DE CARGA <-> PALETA DESTINO`, 10 cambios durante ~2 s, terminando fija en la paleta destino.

Ejemplos:
- SSW -> P3 <-> CUT/CONCRETE -> gris fijo.
- SSS -> P3 <-> BASE -> azul fijo.

El cambio mecánico ocurre al confirmar; los 2 s son feedback visual, no una espera para habilitar el arma.

## 23. Código nuevo / arquitectura de esta prueba
Se añadieron entidades `ConcreteBlock` administradas por Rock. Una misma clase usa `kind='near'` o `kind='far'`; no se duplicó la implementación.

Estados principales:
`flight -> forming -> solid/moving -> breaking`.

También se añadió:
- `handleWeaponSelectorInput()`;
- `selectWeaponSet()`;
- `cleanupWeaponSet()`;
- `startConcrete()`;
- `handleProjectileVsConcrete()`.

`cleanupWeaponSet()` destruye Cutter/Concrete persistentes al abandonar el set para impedir mezclar herramientas de paletas distintas.

## 24. Problemas/puntos que todavía necesitan prueba real
- Ajustar el arco corto de Concrete con gameplay; la intención es que Rock pueda alcanzarlo cómodamente.
- Ajustar velocidad de la plataforma móvil.
- Revisar el descenso exacto sobre frame 10: la implementación actual ya cambia a destrucción, pero el seguimiento pixel-a-pixel de la superficie puede refinarse.
- Confirmar qué frames exactos de `knuckles_spin_minero.png` dan la mejor estela; actualmente se omite el último.
- Probar que Rush nunca herede una altura falsa por estar Rock montado.
- Probar Bass: una ráfaga completa debe romperlo apenas.
- Probar X máximo: debe romperlo de una.
- Balancear daño 8 / pared +5 y cooldown 2.8 s.
- FIRE y LEAF/SNAKE siguen reservados; siguiente bloque planeado: Fire Storm + Flame Sword.

---

# ITERACIÓN V3 — Cutter doble arco, Concrete encadenable y companions (07/10/2026)

## Problemas encontrados en la prueba V2
- Rolling Cutter seguía recorriendo demasiado espacio horizontal y el arco se percibía poco.
- Sólo existía una trayectoria práctica. El diseño correcto necesita dos: M y E/Q+M.
- El VFX del Concrete móvil estaba usando `knuckles_spin_minero.png`, por lo que aparecía Knuckles en vez de las piedras del suelo.
- Concrete se formaba demasiado lejos para que Rock pudiera usarlo cómodamente como plataforma y dos Concrete podían atravesarse.
- Los bloques permanentes podían quedarse demasiado tiempo en pantalla.
- El Concrete móvil necesitaba desaparecer al llegar a una pared real.
- Rush Jet necesitaba una función clara de launcher: poco desplazamiento horizontal y mucho vertical.
- Beat Crescent tenía muy poco knockback horizontal.
- Beat Patrol permitía una sola caja y obligaba al jugador a adivinar demasiado el frame exacto del drop.
- Beat quedaba demasiado alto y su intro necesitaba un pequeño ajuste final hacia Rock.

## Soluciones implementadas
### Rolling Cutter
- M: ida en U (arco bajo) y regreso en U invertida.
- E/Q + M: ida en U invertida (arco alto) y regreso en U.
- Alcance horizontal reducido y amplitud vertical aumentada.
- Sigue existiendo un solo Cutter activo.
- El punto final del regreso se reajusta a la posición actual de Rock, pero conserva el arco opuesto.
- Knockback horizontal aumentado ligeramente.

### Concrete
- Los dos tipos conservan exactamente el mismo lanzamiento inicial.
- Lanzamiento acortado para que el bloque se forme cerca de Rock y haya tiempo de montarlo.
- Desde el frame 7 el render pasa a escala x5: la parte sólida de 22x22 queda en 110x110 px.
- El segundo Concrete detecta plataformas Concrete existentes y puede formarse sobre ellas en lugar de atravesarlas; esto permite encadenar/apilar las dos construcciones.
- Concrete fijo: después de 5 s empieza a perder 10% de sus 20 HP cada segundo.
- Concrete móvil: se rompe al tocar las paredes reales del escenario.
- Se conserva el límite de 2 Concrete fijos + 1 móvil.
- El VFX móvil ahora usa `piedras_de_suelo.png` (384x32, 12 frames), no el sprite de Knuckles. Se reproducen sólo los primeros 11 frames. Es exclusivamente visual, sin daño ni colisión.
- El spritesheet de piedras ya viene orientado izquierda->derecha; sólo se espeja al viajar a la izquierda.

### Rush Jet
- Sale recto en la dirección fijada al activarse.
- Si llega a una pared real o impacta al rival, termina Jet y vuelve caminando.
- Impacto: poco knockback horizontal y fuerte lanzamiento vertical para permitir continuaciones de Rock.

### Beat
- Crescent ahora expulsa con fuerza en la dirección en la que viaja Beat; las cajas NO heredan este knockback.
- FOLLOW se bajó un poco.
- Al terminar la intro se permite un pequeño ajuste/TP final hacia la formación con Rock. El FOLLOW normal sigue siendo físico.
- Patrol admite hasta 4 cajas por patrulla.
- Al pedir caja, Beat prepara visualmente los frames cercanos al drop. Si ya está demasiado cerca del momento de lanzamiento, la orden espera la siguiente vuelta para evitar un salto visual brusco.

## Razón de diseño
La intención no es aumentar daño sin más, sino dar funciones distintas: Cutter controla dos alturas en ida/regreso; Concrete crea rutas y plataformas temporales; Rush abre combos verticales; Beat desplaza horizontalmente y sus cajas mantienen una función separada. Esto también evita que los companions se sientan como el mismo ataque con sprites distintos.

## Pendiente de prueba/balance
- Ajustar alcance/amplitud exactos de ambos arcos de Cutter después de sentirlos en partida.
- Confirmar que 110x110 px es una plataforma cómoda sin bloquear demasiado el escenario.
- Revisar la velocidad de formación del segundo Concrete al apilarlo.
- Probar el deterioro de 10%/s contra Bass y otros proyectiles.
- Afinar `vx/vy` de Beat Crescent y Rush Jet según combos reales.
- Revisar visualmente la preparación acelerada de Beat antes de cada caja.

---
## ITERACION V4 — PRUEBA REAL: KNOCKBACK, EMPUJE Y VFX DE CONCRETE
Fecha: 2026-10-07

### Retro de la prueba V3
- Rolling Cutter: la nueva curva U / U invertida se sintió muy bien y se conserva.
- Problema: faltaba una pausa mínima entre ciclos y el impacto no comunicaba la dirección vertical de la curva.
- Concrete: los dos bloques de construcción ya se apilan correctamente.
- Problema grave del Concrete largo: atravesaba al rival en vez de transportarlo y el efecto de piedras estaba mal interpretado/dibujado.

### Rolling Cutter — solución V4
- Se conserva un solo Cutter activo.
- Se añade cooldown de 500 ms al terminar/desaparecer el ciclo.
- El daño base sigue siendo el mismo por ahora; primero se prueba el cooldown antes de nerfear daño.
- El knockback ahora usa el desplazamiento REAL del Cutter entre frames:
  - si viene de abajo hacia arriba, lanza fuerte hacia arriba;
  - si viene descendiendo, barre fuerte horizontalmente siguiendo la dirección real del recorrido.
- Como el regreso tiene la curva opuesta, un golpe de regreso puede acercar o alejar al rival según la trayectoria real.

### Concrete largo — empuje correcto
Problema V3: al tocar al rival hacía daño pero lo atravesaba. Además el propio Concrete perdía vida al primer contacto.

Solución V4:
- Primer contacto: 8 de daño y el rival queda delante de la cara del bloque.
- Mientras el bloque avanza, arrastra/empuja físicamente al rival; no lo atraviesa.
- Mientras está atrapado se mantiene sin salto vertical para evitar que simplemente escape por arriba; la intención es que pueda intentar destruir el bloque con sus herramientas.
- El Concrete NO se autodaña sólo por haber atrapado a alguien.
- Si el rival llega atrapado hasta la pared real, recibe un segundo impacto de pared (5 provisional), sale disparado como uppercut (`vy=-14`) y el Concrete se rompe.
- Si el Concrete llega a la pared sin rival, también se rompe.
- Se mantiene el cooldown del Concrete largo después de romperse.

### Error encontrado en la estela de piedras
V3 interpretó `piedras_de_suelo.png` como 12 frames de 32x32. Eso era incorrecto.
La hoja real es 384x32 = 6 frames de 64x32, igual que la usada por Spin Minero de Knuckles.

Corrección:
- usar los primeros 5 frames; no usar el remate final;
- orientación fuente natural izquierda -> derecha;
- mirror sólo al viajar hacia la izquierda;
- misma referencia VERTICAL que Knuckles: la tira se centra sobre la línea del suelo (`feetY - dh/2`);
- sólo se cambia la referencia HORIZONTAL para quedar detrás del borde del Concrete;
- se dibuja antes del bloque para que el cubo quede por delante;
- VFX puro: cero daño / cero colisión.

### Pendiente de prueba
- comprobar si 500 ms de cooldown del Cutter basta o si además conviene bajar daño;
- comprobar que el empuje de Concrete permite al rival responder atacando el bloque sin poder saltarlo;
- ajustar daño del choque contra pared sólo después de sentir el combo completo;
- verificar que la estela ahora coincide visualmente con Spin Minero.

## V5 — tres comandos Concrete y pared creada por Rock

### Problema de V4
El Concrete móvil se formaba demasiado lejos para montarlo con comodidad y el sistema near/far mezclaba construcción con ataque. Además el wall-impact dependía de los pilares del escenario.

### Nueva distribución
- `D + J`: Concrete MOVING. Se forma muy cerca de Rock para que `D+J -> salto` sea una acción razonable y Rock pueda viajar encima.
- `S + J`: Concrete BUILD_NEAR, construcción cercana.
- `E + J`: Concrete BUILD_FAR, construcción lejana. Evita usar W y por tanto no condiciona el salto; puede prepararse desde el aire si el estado de Rock lo permite.
- Máximo: 2 Concrete de construcción compartidos entre near/far + 1 móvil.
- Rolling Cutter no cambia: `M = U -> ∩`; `E+M = ∩ -> U`.

### Concrete contra Concrete
Un Concrete de construcción sólido cuenta como pared válida para el móvil. Rock puede colocar un muro, reposicionarse y lanzar el móvil para empujar al rival contra SU propio muro. Al comprimir al rival contra pilar o Concrete construido: segundo golpe, el móvil se rompe y el rival sale verticalmente tipo uppercut.

### Setplay emergente descubierto
`muro lejano -> muro/móvil -> Beat`: el rival puede saltar para evitar Concrete, Beat cubre el aire y puede devolverlo a la zona preparada. No se nerfea todavía; primero se prueba daño total y opciones de escape.

### Conservado
- 20 HP, multiplicador de daño 0.80.
- Bloque sólido x5.
- Construcciones pierden 10% de HP máximo por segundo desde 5 s después de formarse.
- El móvil se rompe al terminar contra pared/Concrete.
- Estela de piedras es sólo VFX y no hace daño.
