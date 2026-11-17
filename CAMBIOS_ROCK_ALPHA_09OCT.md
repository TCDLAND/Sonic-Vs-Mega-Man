# Rock Alpha — ajustes finales (versión de prueba)

- Rush: el salto de acompañamiento es ofensivo una vez por salto (7 daño, empuje horizontal). Después de aterrizar entra en `jump_return` y no vuelve a saltar ofensivamente hasta reunirse con Rock. Saltos de regreso no dañan. Rush Jet y Coil preservados.
- Beat/Eddie: Beat acelera su regreso con Eddie y el seguimiento en `eddie_carry` a 12 unidades por actualización. Eddie sube 4 unidades de escala respecto al ajuste anterior (43 -> 39), tanto transportado como al soltarlo.
- Search Snake: choque contra rival por alfa de sprite/hurtbox, sin caducidad por segundos; escala de sprite conservada, recorrido inicial conservado; sube paredes de Concrete hasta alcanzar la superficie superior. Se destruye al impactar de verdad o al salir por bordes horizontales del mundo.
- Leaf Shield: las hojas lanzadas usan colisión de alfa con la hurtbox; cada hoja al impactar entra en animación de caída oscilante sin daño ni rotación. Sin caducidad por segundos. Chocan con límites de escenario y bloques Concrete.

## Pruebas manuales recomendadas
- Saltar repetidamente con Rock, incluso con Rush lejos, y verificar un único salto ofensivo hasta el reencuentro.
- Mover Rock en ambos sentidos mientras Beat trae a Eddie, verificar que Eddie no tape a Beat ni flote.
- Saltar por encima de Snake con Sonic, comprobar que no explote sin tocarla; probar ascenso por pared Concrete.
- Lanzar hojas a derecha/izquierda/arriba y contra Concrete, verificar animación de caída individual y daño sólo por contacto visible.

No se ejecutó una partida interactiva; sólo verificación estática de JavaScript e integridad del ZIP.
