# Nota 18 — IA: guardia, movimiento y equipos 3v3 aleatorios

## Cambios

- Cada inicio de entrenamiento 3v3 baraja la plantilla disponible de seis peleadores y la reparte en dos equipos de tres. La plantilla no se repite entre equipos.
- La IA mantiene la guardia durante ráfagas preventivas más largas cuando el rival está cerca. También reacciona con un retraso corto a ataques en rango y a proyectiles que se aproximan, siempre en la dirección opuesta al rival.
- Se añadieron saltos evasivos al detectar Search Snake o una amenaza terrestre cercana que avanza hacia el peleador.
- Knuckles conserva el control del topo mientras está bajo tierra, se desplaza hacia la posición actual del rival y sale al acercarse o al alcanzar el límite de carga. Al salir, orienta el golpe hacia el rival.
- Rock ya no cede el control de su plan de IA cuando no ejecuta una habilidad: se acerca o retrocede, cambia su posición, usa ataques cuerpo a cuerpo y puede saltar para montar un Concrete fijo.
- Rock llama a Eddie cuando Beat está disponible, tiene espacio y no detecta un ataque ni un proyectil que venga del rival. Al llegar Eddie, la IA lo libera para entregar la munición.
- La espera de Eddie queda en 10 segundos tras la llamada.

## Verificación

- `node --check` pasó para `js/cpu.js`, `js/battle.js`, `js/knuckles.js` y `js/rock.js`; `git diff --check` pasó.
- Se corrieron seis simulaciones headless de 2,400 frames cada una. En las seis, ambos equipos tuvieron tres personajes y ningún personaje apareció en ambos equipos. La IA generó planes de guardia en los dos lados en la mayoría de las peleas; las pruebas registraron desplazamiento y acciones de concreto, spin dash, ataques cercanos y topo, según los personajes asignados.
- La simulación usa un entorno DOM mínimo y colisiones principales, no ejecuta el bucle completo de renderizado del navegador. Los contadores de guardia son intentos de guardia; los bloqueos confirmados dependen de los impactos exactos durante una partida real. Hace falta una revisión visual y de balance en el juego.
