# Tablero de desarrollo — Sonic vs. Mega Man

Actualizado: 25 de noviembre de 2026
Fuente: notas del repositorio, código actual y últimos commits. Las tarjetas antiguas no se consideran vigentes automáticamente; se marcan para verificar antes de reabrirlas.

> No hay conexión de Notion, Trello o AppFlowy en esta sesión. Este documento y `TABLERO_IMPORTABLE.csv` son una exportación portable. AppFlowy parece ser la herramienta que recuerdas: sus documentos oficiales la describen como alternativa a Notion con modo sin conexión y tablero Kanban.

## Bugs

| Prioridad | Tarjeta | Estado | Siguiente paso |
|---|---|---|---|
| P1 | Confirmar el error de simulación que podía dejar congelado el combate al morir Egg Pawn | Arreglo de frame ya está en el historial; falta regresión | Correr torneo 2 carriles con Eggman y capturar el JSON si vuelve a fallar; revisar el combate activo y el error guardado. |
| P1 | Verificar que los ataques de Wily dañen a Rock en partidas reales | Revisión pendiente | Probar cada proyectil con y sin Concrete, guardia y distancia; registrar qué ataque conecta. |
| P1 | Revisar espejos de Rock que se quedaban sin atacar detrás de un muro | Sin cierre documentado | Probar Rock vs. Rock en Highway y otro escenario, con CPU en ambos lados. |
| P2 | Revisar la exposición y vulnerabilidad de Beat/Eddie durante sus asistencias | Notas antiguas la dejan pendiente | Confirmar en el código actual y probar que un golpe los interrumpa y los pueda sacar. |

## Por probar

| Prioridad | Tarjeta | Estado | Siguiente paso |
|---|---|---|---|
| P1 | Validar las paletas de Proto Man en salto, correr-disparando y escudo | Ajuste local reciente; sin prueba interactiva | Comparar Paleta 1 y 2 en selector y combate; confirmar salto rojo actualizado y escudo azul en Paleta 2. |
| P1 | Probar los ataques nuevos de Knuckles y sus comandos en la pausa | Implementados en el último commit; falta una pasada jugable registrada | Probar counter alto/bajo, parry, agarre 2, golpe cargado y ultimate; confirmar que todos aparezcan en la guía. |
| P1 | Regresión de torneo de todos contra todos en dos carriles | Función implementada | Ejecutar con omisión, sin límite de tiempo y personajes espejo; validar progreso, ganador, memoria y causa de cierre en el JSON. |
| P1 | Probar sala 3v3 con dos jugadores y espectadores | Código de salas y espectador presente | Conectar desde dos equipos, iniciar una pelea 3v3 y verificar entrada/salida de espectador y reconexión. |
| P2 | Probar mando Xbox físico | La guía solo registra Gamepad API simulada | Revisar selección, combos, cambio/asistencia con LB/LT y ayudas de pausa en un mando real. |
| P2 | Revalidar medidor, defensa y estrategias de CPU con datos nuevos | Cambios de balance ya integrados, resultados variables | Correr el análisis individual por personaje; comparar daño por ataque, guardia, KO y tiempo antes de parchear. |
| P2 | Reconciliar pendientes heredados de las notas 1–42 con el código actual | Auditoría pendiente | Confirmar qué notas ya quedaron resueltas y cerrar las tarjetas antiguas que ya no aplican. |

## Backlog

| Prioridad | Tarjeta | Estado | Siguiente paso |
|---|---|---|---|
| P2 | Pulir asistencias 3v3: exposición, castigo, daño y recargas | Primera versión ya existe | Balancear entrada/ataque/salida por personaje con los datos de CPU. |
| P2 | Completar diagnóstico por personaje y mantener sus JSON individuales | Menú y exportación aparecen en `tournament.js` | Verificar que informe ataques nunca usados, porcentajes, guardia, bloqueos y daño por rival sin mezclar temporadas. |
| P2 | Revisar interacciones globales de Hyper Bomb, fuego y Leaf Shield | Algunas notas antiguas reportan detectores incompletos | Auditar los detectores de colisión vigentes antes de añadir reglas duplicadas. |
| P3 | Definir repertorio y rol de Tails | Diseño todavía abierto | Elegir identidad de movimiento y apoyo antes de buscar/recortar recursos. |
| P3 | Diseñar más armas y ataques de X/Proto Man con sus hojas disponibles | Ampliación futura | Inventariar sprites, comandos, coste, recuperación y counterplay antes de implementar. |

## Ideas en espera

- Wily: la nota 14 dice explícitamente **NO IMPLEMENTAR TODAVÍA** para varios sistemas futuros; conservarla como diseño y no como tarea comprometida.
- Riesgos globales de escenario, ataques extra de Power Battle y mejoras visuales sin recursos definitivos: revisar cuando se priorice cada personaje.
- Evitar convertir cifras provisionales antiguas de daño, cooldown o escala en valores de balance aprobados.

## Hecho recientemente / disponible en el código

- Salas online experimentales, equipos online 3v3 y entrada de espectadores.
- Controles de mando Xbox, guía de combos y ayuda de ataques en pausa.
- Selección de duración de combate y opciones de 99/199/299.
- Simulación de round robin de cruces únicos en dos carriles, con omisión y registro de memoria/errores.
- Análisis individual de personajes con acciones, porcentaje de ataques, guardia, bloqueos, daño y resultados por KO/tiempo.
- Soportes Eggman/Egg Pawn, nuevas herramientas de combate de Knuckles y estrategias de CPU contra enfrentamientos concretos.
- Paletas alternativas: el estado de Git aún tiene cambios locales sin confirmar; revisar y publicar por separado después de validar en el juego.

## Actualizaciones históricas

Cada archivo de nota se representa como una actualización de historial en el CSV. Las notas originales siguen siendo la fuente para detalles y pruebas; tener una tarjeta histórica no significa que cada elemento de esa nota esté terminado o validado.

| Actualización histórica | Fuente |
|---|---|
| Update: ACTUALIZACION DE COMBATE - PROTOTIPO | [ACTUALIZACION_COMBATE.txt](../ACTUALIZACION_COMBATE.txt) |
| Update: Cambios de prueba — Beat, Eddie y kit verde | [CAMBIOS_08OCT_BEAT_EDDIE.md](../CAMBIOS_08OCT_BEAT_EDDIE.md) |
| Update: Rock Alpha — ajustes finales (versión de prueba) | [CAMBIOS_ROCK_ALPHA_09OCT.md](../CAMBIOS_ROCK_ALPHA_09OCT.md) |
| Update: SHADOW ALPHA 02 | [CAMBIOS_SHADOW_ALPHA_02.md](../CAMBIOS_SHADOW_ALPHA_02.md) |
| Update: Spin Dash - reglas integradas | [NOTA_01_SPIN_DASH.md](../NOTA_01_SPIN_DASH.md) |
| Update: Zero: hoja maestra por coordenadas | [NOTA_02_ZERO_ATLAS.md](../NOTA_02_ZERO_ATLAS.md) |
| Update: NOTA 03 — Correcciones Knuckles: muro, Spin Minero, agarre y planeo | [NOTA_03_UPDATE_KNUCKLES_FIXES.md](../NOTA_03_UPDATE_KNUCKLES_FIXES.md) |
| Update: NOTA 04 — Knuckles: combate, agarre, planeo, piedras y muro derecho | [NOTA_04_KNUCKLES_COMBATE_Y_MURO.md](../NOTA_04_KNUCKLES_COMBATE_Y_MURO.md) |
| Update: NOTA 05 — ROCK BASE MM7 / POWER BATTLE PREPARATION | [NOTA_05_ROCK_BASE_MM7.md](../NOTA_05_ROCK_BASE_MM7.md) |
| Update: NOTA 06 — Rock: normalización de hojas y velocidad visual | [NOTA_06_ROCK_NORMALIZACION_SPRITES.md](../NOTA_06_ROCK_NORMALIZACION_SPRITES.md) |
| Update: NOTA 07 — Rush V1 y correcciones de Rock | [NOTA_07_RUSH_Y_CORRECCIONES_ROCK.md](../NOTA_07_RUSH_Y_CORRECCIONES_ROCK.md) |
| Update: NOTA 08 — Rush automático + limpieza definitiva del morado | [NOTA_08_RUSH_AUTO_Y_ALPHA_MORADO.md](../NOTA_08_RUSH_AUTO_Y_ALPHA_MORADO.md) |
| Update: NOTA 09 — Rush: Follow, Run, Jump y Coil | [NOTA_09_RUSH_FOLLOW_RUN_JUMP_COIL.md](../NOTA_09_RUSH_FOLLOW_RUN_JUMP_COIL.md) |
| Update: NOTA 10 — Rush: estados atómicos, Run/Jump y Coil de 6 s | [NOTA_10_RUSH_ESTADOS_ATOMICOS_Y_FOLLOW.md](../NOTA_10_RUSH_ESTADOS_ATOMICOS_Y_FOLLOW.md) |
| Update: NOTA 11 — Beat: Follow, Crescent y Patrol | [NOTA_11_BEAT_FOLLOW_CRESCENT_PATROL.md](../NOTA_11_BEAT_FOLLOW_CRESCENT_PATROL.md) |
| Update: NOTA 12 — Beat: entrada sin TP, lanzamiento aéreo, cajas y más recorrido | [NOTA_12_BEAT_SIN_TP_CAJAS_Y_RECORRIDO.md](../NOTA_12_BEAT_SIN_TP_CAJAS_Y_RECORRIDO.md) |
| Update: NOTA 13 — POWER 1: sets por paleta + Rolling Cutter | [NOTA_13_POWER1_CUT_CONCRETE_ROLLING_CUTTER.md](../NOTA_13_POWER1_CUT_CONCRETE_ROLLING_CUTTER.md) |
| Update: NOTA 14 — WILY: diseño futuro consolidado (NO IMPLEMENTAR TODAVÍA) | [NOTA_14_WILY_DISENO_FUTURO.md](../NOTA_14_WILY_DISENO_FUTURO.md) |
| Update: NOTA 15 — FIRE / KNockback / pendientes heredados | [NOTA_15_FIRE_Y_PENDIENTES.md](../NOTA_15_FIRE_Y_PENDIENTES.md) |
| Update: NOTA 16 — LEAF / SNAKE / BOMB, Concrete, Rush y Heat Fire | [NOTA_16_VERDE_CONCRETE_RUSH.md](../NOTA_16_VERDE_CONCRETE_RUSH.md) |
| Update: NOTA 17 — HUD, guardia, relevos, IA y energía de armas | [NOTA_17_COMBATE_HUD_GUARDIA_IA_Y_MUNICION.md](../NOTA_17_COMBATE_HUD_GUARDIA_IA_Y_MUNICION.md) |
| Update: Nota 18 — IA: guardia, movimiento y equipos 3v3 aleatorios | [NOTA_18_IA_DEFENSA_MOVIMIENTO_Y_3V3_ALEATORIO.md](../NOTA_18_IA_DEFENSA_MOVIMIENTO_Y_3V3_ALEATORIO.md) |
| Update: NOTA 19 — IA adaptativa, guardia direccional y pruebas de combate | [NOTA_19_IA_ADAPTATIVA_GUARDIA_Y_PRUEBAS.md](../NOTA_19_IA_ADAPTATIVA_GUARDIA_Y_PRUEBAS.md) |
| Update: Nota 20: intento de escala global descartado | [NOTA_20_ESCALA_MUNDO_150PX_100CM.md](../NOTA_20_ESCALA_MUNDO_150PX_100CM.md) |
| Update: Nota 21: Rock como referencia de tamaño | [NOTA_21_ESCALA_BASE_ROCK.md](../NOTA_21_ESCALA_BASE_ROCK.md) |
| Update: NOTA 22 — Guardia por daño y reacción a golpes | [NOTA_22_GUARDIA_POR_DANO_Y_REACCION_A_GOLPES.md](../NOTA_22_GUARDIA_POR_DANO_Y_REACCION_A_GOLPES.md) |
| Update: Nota 23 — Cruces contra Bass | [NOTA_23_CRUCES_CON_BASS.md](../NOTA_23_CRUCES_CON_BASS.md) |
| Update: Nota 24 — Bass, selección y tiempo | [NOTA_24_BASS_SELECCION_Y_TIEMPO.md](../NOTA_24_BASS_SELECCION_Y_TIEMPO.md) |
| Update: Nota 25 — Topo, Leaf Shield y retroceso de Bass | [NOTA_25_TOPO_LEAF_SHIELD_Y_RETROCESO.md](../NOTA_25_TOPO_LEAF_SHIELD_Y_RETROCESO.md) |
| Update: Nota 26 — Pulido y pruebas en Chrome | [NOTA_26_PULIDO_Y_PRUEBAS_EN_CHROME.md](../NOTA_26_PULIDO_Y_PRUEBAS_EN_CHROME.md) |
| Update: Nota 27 — Selección aleatoria y Zero | [NOTA_27_ALEATORIO_Y_ATAQUES_ZERO.md](../NOTA_27_ALEATORIO_Y_ATAQUES_ZERO.md) |
| Update: Nota 28 — Pausa, controles por lado y atlas de Zero | [NOTA_28_PAUSA_CONTROLES_Y_ATLAS_ZERO.md](../NOTA_28_PAUSA_CONTROLES_Y_ATLAS_ZERO.md) |
| Update: Nota 29 — Carga y doce técnicas de Zero | [NOTA_29_ZERO_BUSTER_Y_DOCE_TECNICAS.md](../NOTA_29_ZERO_BUSTER_Y_DOCE_TECNICAS.md) |
| Update: Nota 30 — Bass, Proto Man y tajo de pared de Zero | [NOTA_30_BASS_PROTO_Y_ANCLA_DE_ZERO.md](../NOTA_30_BASS_PROTO_Y_ANCLA_DE_ZERO.md) |
| Update: Nota 31 — Guía, X y carga del escudo de Proto | [NOTA_31_GUIA_X_Y_CARGA_DE_PROTO.md](../NOTA_31_GUIA_X_Y_CARGA_DE_PROTO.md) |
| Update: Nota 32 — Visor de animaciones, carrera de X e idle de Bass | [NOTA_32_VISOR_DE_ANIMACIONES.md](../NOTA_32_VISOR_DE_ANIMACIONES.md) |
| Update: Nota 33 — Animaciones de X, Zero, Bass y Proto Man | [NOTA_33_ANIMACIONES_X_ZERO_BASS_PROTO.md](../NOTA_33_ANIMACIONES_X_ZERO_BASS_PROTO.md) |
| Update: Prólogo jugable de Sonic vs. Mega Man | [NOTA_34_PROLOGO_JUGABLE.md](../NOTA_34_PROLOGO_JUGABLE.md) |
| Update: Sonic, capítulo 1 — La esmeralda que desapareció | [NOTA_35_CAPITULO_1_SONIC.md](../NOTA_35_CAPITULO_1_SONIC.md) |
| Update: Chaos 0 en Versus | [NOTA_36_CHAOS.md](../NOTA_36_CHAOS.md) |
| Update: Silver y Super Silver | [NOTA_37_SILVER.md](../NOTA_37_SILVER.md) |
| Update: MM Zero | [NOTA_38_MM_ZERO.md](../NOTA_38_MM_ZERO.md) |
| Update: Campo de práctica y pulido de MM Zero, Sonic, Shadow y Silver | [NOTA_39_PRACTICA_Y_FORMAS_SUPER.md](../NOTA_39_PRACTICA_Y_FORMAS_SUPER.md) |
| Update: Actualización 40 | [NOTA_40_GUARDIA_Y_EGGMOBILE.md](../NOTA_40_GUARDIA_Y_EGGMOBILE.md) |
| Update: Actualización 41 | [NOTA_41_EGGMOBILE_Y_METAL_SONIC.md](../NOTA_41_EGGMOBILE_Y_METAL_SONIC.md) |
| Update: Actualización 42 | [NOTA_42_EDDIE_Y_BOLA_DE_EGGMAN.md](../NOTA_42_EDDIE_Y_BOLA_DE_EGGMAN.md) |
| Update: Sonic Battle y efectos compartidos | [NOTA_SONIC_BATTLE_Y_VIENTO.md](../NOTA_SONIC_BATTLE_Y_VIENTO.md) |
| Update: Sonic, cruces de CPU y asistencias | [NOTA_SONIC_CRUCES_Y_ASISTENCIAS.md](../NOTA_SONIC_CRUCES_Y_ASISTENCIAS.md) |
| Update: Wily y sus Robot Masters | [NOTA_WILY_ROBOT_MASTERS.md](../NOTA_WILY_ROBOT_MASTERS.md) |
| Update: SHADOW ALPHA - Integracion al juego completo | [SHADOW_ALPHA_NOTAS.txt](../SHADOW_ALPHA_NOTAS.txt) |
| Update: ataques de Knuckles y guía de movimientos | commit f6c07d2 |
| Update: simulación round robin de pares únicos en dos carriles | commit 97df9b7 |
| Update: simulación continúa en segundo plano | commit 9556947 |
| Update: corrección de animación de daño de Egg Pawn | commit 6e4c8fa |
| Update: guardar stack de error de combate en resultados | commit 2498d4a |
| Update: registrar combate activo por carril | commit 1daca76 |
| Update: soportes de Eggman y contenido de personajes | commit 954a40a |
| Update: salas online 3v3 y espectadores | commit df8999a |
| Update: timer de combate seleccionable | commit f433324 |
| Update: guía de movimientos accesible durante pausa online | commit 6091806 |
## Importar

`TABLERO_IMPORTABLE.csv` usa columnas sencillas (`Título`, `Lista`, `Estado`, `Prioridad`, `Área`, `Descripción`, `Fuente`, `Etiquetas`). En AppFlowy crea una base de datos, importa el CSV y agrupa la vista Board por `Lista`. En Notion puedes importarlo como base de datos; en Trello puede servir como plantilla para recrear las listas y tarjetas.
