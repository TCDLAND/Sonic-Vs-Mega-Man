# NOTA 19 — IA adaptativa, guardia direccional y pruebas de combate

Fecha: 20/11/2026

## Investigación consultada

Los fabricantes no publican el algoritmo interno completo de la CPU de Street Fighter o Marvel vs. Capcom 2. Por eso esta nota documenta principios observables y de investigación, no una reproducción del código propietario. La IA combina detección de amenazas, distancia, estados del personaje, demora de reacción y preferencias aprendidas con recompensas.

- Capcom describe V-Rival de Street Fighter 6 como un rival construido a partir del análisis de partidas clasificatorias de muchos jugadores. Aplicación aquí: el rival toma decisiones mediante estado de combate y ajusta preferencias según resultados, con reacción retrasada.
  - https://www.youtube.com/watch?v=ZMATLvGNbiM
- El manual oficial de Marvel vs. Capcom Fighting Collection confirma que MVC2 ofrece tres tipos de asistencia α, β y γ. La enseñanza para el modo de equipos es que los compañeros deben cumplir funciones diferentes; el manual no describe la implementación interna de la CPU.
  - https://game.capcom.com/manual/MVCFC/es419/switch/page/7/1
- Künzel y Meyer-Nieberg estudian IA de juegos de lucha con objetivos múltiples y estrategias adaptables. La selección de estado incluye distancia y situación del combate; premiar solo daño puede producir estrategias poco interesantes. Aplicación aquí: puntos por conectar, bloquear, recibir daño, variedad y resultado del combate.
  - https://link.springer.com/article/10.1007/s00521-020-04794-x

## Cambios

- La CPU orienta guardia en dirección contraria al rival y reacciona con 40–75 ms de retraso a un ataque cercano que viene hacia ella. Evita guardia neutral durante ataques o proyectiles ya activos.
- La barrera visual aparece solo durante el impacto bloqueado; usa los límites alfa visibles del frame actual y su lado frontal. Si fallan los datos de píxel, usa el rectángulo del frame.
- **Regla anterior, sustituida por NOTA 22:** cuatro impactos nuevos rompían la guardia. Ahora se acumula el daño de los golpes bloqueados; se conserva la ventana de 2.8 s y la recuperación de 1.5 s.
- Un golpe bloqueado causa chip y no aplica lanzamiento/knockback. Se corrigieron rutas de Knuckles, Sonic, Spin Dash, Rush, Beat, fuego/hojas/concretos de Rock y proyectiles. Golpes desde atrás no se cuentan como bloqueos.
- Bass registra si el disparo sí inició; con oponente en el aire puede priorizar el tiro diagonal. Treble Bison se cuenta una vez y tiene tiempo para completar su secuencia.
- Sonic recibe más oportunidades de Spin Dash, salto y Rocket aéreo. Shadow tiene mayor probabilidad de escoger teletransporte cuando posee energía suficiente y su rival no está en guardia.
- El modo 3v3 arma dos equipos aleatorios de tres desde seis personajes sin repetición y pide cambio automático con vida baja o presión.
- Ajuste de IA: recompensas moderadas por impacto y bloqueo, penalización por daño recibido y victoria con castigo por repetir demasiado la misma acción.

## Verificación

- `node --check`: sintaxis de los 37 módulos JavaScript.
- `git diff --check`: sin errores de whitespace (Git avisa que normalizará algunos finales LF a CRLF).
- Los escenarios de guardia de esta versión describían el conteo anterior de impactos y quedan reemplazados por la regla de presión por daño de NOTA 22.
- Se corrieron cuatro simulaciones headless de 3v3, 2,200 pasos cada una. En esas muestras los equipos no repitieron personaje; acciones observadas incluyeron Treble/Bison y disparo diagonal; dos combates hicieron cambios de equipo. Los bloqueos confirmados por los callbacks de IA variaron entre 0 y 57 por muestra.

La simulación headless usa stubs de navegador y no ejecuta el render ni todas las colisiones del game loop. Por ello las cifras describen acciones de IA y transiciones probadas, no una certificación visual de cada impacto. La presentación de la barrera alfa y el ritmo de las animaciones debe revisarse con sprites cargados en el navegador.

