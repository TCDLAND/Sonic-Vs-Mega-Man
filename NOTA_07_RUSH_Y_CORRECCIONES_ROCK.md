# NOTA 07 — Rush V1 y correcciones de Rock

## Objetivo
Agregar la primera versión funcional de Rush como compañero permanente de Rock y corregir dos detalles detectados en Rock: el cuarto morado estructural y la sincronización visual entre salto normal y salto con disparo.

## 1. Cuarto morado visible en Rock

### Síntoma
Después de normalizar las hojas todavía aparecían píxeles morados alrededor de Rock.

### Causa
El normalizador sólo eliminaba tres colores estructurales:
`#841584`, `#470047` y `#B440B4`.
Faltaba `#640664`.

### Código anterior
```python
PURPLES = {(0x84,0x15,0x84),(0x47,0x00,0x47),(0xB4,0x40,0xB4)}
```

### Corrección
```python
PURPLES = {
    (0x84,0x15,0x84),
    (0x47,0x00,0x47),
    (0xB4,0x40,0xB4),
    (0x64,0x06,0x64)
}
```
Se volvieron a procesar las hojas normalizadas. Los cuatro morados quedaron con alpha 0 sin modificar el tamaño ni el pivote de los frames.

## 2. Jump y JumpFire sincronizados
Rock conserva un único índice de salto. `rock_jump.png` y `rock_jumpfire.png` tienen seis frames equivalentes.
Al disparar/cargar en el aire se cambia de hoja, no de fase: Jump frame N -> JumpFire frame N. Al caer se mantiene el frame 6 correspondiente.
RunFire conserva su regla independiente de locomoción/disparo.

## 3. Rush permanente
Se agregó `RushCompanion` dentro del módulo de Rock. Rush existe durante toda la pelea y normalmente no hace daño ni funciona como escudo. Mantiene una posición detrás de Rock y cambia de orientación al regresar a su sitio.

### Sprites
- `rush_Intro.png`: 11 frames de 48x64. Se ejecutan todos; luego Idle usa frames 8-10 en bucle.
- `rush_run.png`: 6 frames de 80x48. Se acelera si Rock hace dash.
- `rush_coil.png`: 6 frames de 48x48.
- `rush_jet.png`: 5 frames de 190x48.
- `rush_jump.png`: 4 frames de 64x48.

Excepto Jet, Rush usa un pivote de suelo situado 2 px arriba del borde inferior.

## 4. Seguimiento y salto propio de Rush
Rush no está pegado a Rock. Busca una posición aproximadamente un cuerpo detrás de él.
Cuando Rock despega, Rush puede hacer su propio salto: es bastante más bajo que el de Rock, pero tiene mucho desplazamiento horizontal. Al aterrizar vuelve corriendo a la posición de acompañamiento.

## 5. Rush Coil
Control provisional integrado:
- P1: `S + K`
- P2: `ArrowDown + =`

Secuencia: frames 1-2 una vez, 3-4 en espera, frame 5 al contacto y frame 6 durante el lanzamiento; después vuelve al loop 3-4 mientras siga activo.

El rebote NO usa una caja rectangular completa. Sólo se acepta cuando Rock está cayendo y el pivote de sus pies toca un píxel opaco de la zona del resorte, aproximadamente 32 px desde abajo y restringida a la mitad izquierda indicada de la imagen.
El impulso de Coil (`vy = -19`) es superior al salto normal de Rock.

## 6. Rush Jet
Control provisional integrado:
- P1: `K`
- P2: `=`

Rush sale en Jet en la dirección de Rock. El contacto ofensivo se comprueba píxel contra píxel entre el sprite de Jet y el sprite corporal del rival. Sólo produce un impacto por salida. Después de impactar o completar la pasada, Rush regresa corriendo con Rock y al llegar vuelve a mirar en la dirección de su dueño.

El Z-Saber de Zero puede cortar Rush Jet. En ese caso Rush no pierde HP: la orden se cancela y Rush regresa. El mero contacto corporal de Sonic/Knuckles no cancela Jet.

## Pendientes de prueba
- Ajustar distancia exacta a la que Rush acompaña a Rock.
- Ajustar velocidad y distancia horizontal del salto propio de Rush.
- Ajustar fuerza final de Rush Coil después de probarlo en combate.
- Ajustar daño/velocidad de Rush Jet.
- Extender la interrupción de Jet a futuros ataques que lleven una propiedad explícita de ataque fuerte/cortante; evitar cancelarlo por simples cuerpos ofensivos.
- Rush/Beat/Eddie todavía no usan el frame de hablar de Rock; se añadirá cuando se cierre el sistema de órdenes/compañeros.
