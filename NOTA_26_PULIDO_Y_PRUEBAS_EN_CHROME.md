# Nota 26 — Pulido y pruebas en Chrome

- El selector carga el idle de Sonic desde su carpeta y usa solo la parte visible del idle de Bass. Escape vuelve a los modos.
- Bass respeta las paredes de Highway. Las construcciones de Concrete quedan dentro del escenario al aterrizar. Los luchadores en el suelo se separan al coincidir, con excepciones para técnicas que atraviesan al rival y agarres.
- La cámara prioriza al jugador en partidas contra CPU si los luchadores se separan más de lo que cabe en pantalla. Una flecha al borde indica quién quedó fuera. El HUD muestra cuándo se puede relevar con L y el panel de depuración sale desactivado.
- Los proyectiles y Treble conservan su equipo al relevar. El Buster dibuja un núcleo y una estela que varían con la carga. Se añadieron sonidos originales de golpe y disparo para reemplazar referencias a archivos ausentes.
- El golpe al suelo de Knuckles usa provisionalmente cuadros de su segundo puñetazo. Al perder el foco del navegador se limpian las teclas sostenidas. Volver a elegir el kit actual de Rock conserva sus construcciones.
- La cápsula de Eddie respeta los límites de Highway y repone 20 puntos al recogerla con Rock. Prioriza el kit activo si le falta munición y usa la reserva más baja si el kit activo está lleno o Rock lleva el Buster base.

## Escenarios comprobados

- Selección por teclado en 1v1 y por mouse en 3v3. El equipo rechaza personajes repetidos durante la selección.
- Bass camina tras la ráfaga, retrocede hasta la pared y conserva el empuje si un golpe le cancela el disparo.
- Las primeras cinco balas no lanzan, la sexta sí y los impactos de hace cuatro segundos salen de la cuenta.
- Knuckles cruza Concrete bajo tierra y un Spin Dash puede desprender una hoja del Leaf Shield.
- Relevo con L, victoria por vida total y Buster disparado antes de un relevo que alcanza al rival una sola vez y continúa en pantalla.
- Separación en la esquina, cámara con rival fuera de pantalla y liberación de controles al perder foco.
- Rock recoge la entrega de Eddie con el kit base y recupera 20 puntos en su reserva más baja.

Las capturas se tomaron en Chrome real con Playwright. Las pruebas controladas colocaron personajes o proyectiles en posiciones exactas para reproducir los casos, y las peleas de CPU contra CPU sirvieron para muestrear el combate normal.

La sesión de 30 minutos generó 247 capturas periódicas de combate entre la versión inicial y las pasadas posteriores. Se revisó una selección de capturas y los registros de las últimas pasadas no mostraron errores de JavaScript ni peticiones fallidas. Las pruebas puntuales de esquina y Eddie se repitieron después de sus últimos ajustes.

## LibreSprite

El ejecutable local admite recorte por coordenadas en modo batch. Se exportó el primer cuadro de Sonic como PNG de 32 × 48 px usando una salida temporal. La hoja de origen conserva todos sus cuadros.
