# NOTA 14 — WILY: diseño futuro consolidado (NO IMPLEMENTAR TODAVÍA)

Esta nota conserva las ideas discutidas mientras se termina Rock. No representa alcance inmediato. La prioridad sigue siendo terminar los personajes base y, en particular, CUT/CONCRETE -> FIRE -> LEAF/SNAKE -> Eddie antes de abrir el frente de Wily.

## 1. Fantasía central
Wily no debe sentirse como "el doctor pegando". Su identidad es dirigir Robot Masters, inventos y tropas. La referencia estructural es un personaje entrenador/controlador, pero con una diferencia importante: comparte HP global y sus Robot Masters tienen integridad propia reparable.

V1 deliberadamente pequeña: sólo Cut Man, Fire Man y Guts Man, más la cápsula de Wily. No construir todavía 12 Robot Masters, presets ni selección personalizada.

## 2. HP global + integridad
- Wily conserva un HP global objetivo de 150.
- Cada Robot Master tiene una barra menor de integridad.
- Un golpe recibido por el Robot Master, después de su resistencia, resta al HP global Y a su integridad. No son dos daños globales: el mismo impacto alimenta dos recursos diferentes.
- Integridad 0 = Robot Master destruido permanentemente durante ese combate.
- Retirarlo antes de 0 permite reparar integridad mientras otro estado está activo.
- Reparar integridad NUNCA cura HP global.
- Un Robot Master destruido nunca se repara.

Primer concepto de velocidades a probar:
- otro Robot Master activo: retirados vivos reparan x1.0;
- cápsula de Wily activa: retirados vivos reparan x0.5;
- Wily taggeado fuera mientras pelea otro miembro del equipo: x0.5.

La relación exacta REPARAR vs SOPORTE sigue abierta y no debe darse por cerrada hasta probarla.

## 3. Cápsula de Wily
Cuarto estado interno del personaje:
- vuela dentro del límite superior del escenario;
- disparo básico;
- puede soltar N Metals hacia abajo;
- herramienta de escape/empuje;
- permite cambiar de Robot Master;
- usa directamente HP global, sin barra de integridad separada;
- mientras está activa, los Robot Masters vivos reparan más lento.

Los N Metals lanzados directamente por Wily pueden ser más dirigidos/agresivos que los N Metals autónomos de soporte.

## 4. Cut Man
Debe ser especialista del Cutter, mientras Rock sigue siendo generalista.
- Cutters con más alcance que Rock.
- Hasta 2 Cutters simultáneos.
- Mucha agilidad.
- Doble salto.
- Counter de melee/cuerpo: entra en postura; si recibe un ataque físico apropiado, bloquea/captura y responde con su ataque de tijera/cabeza.
- No necesita ser counter universal de proyectiles.
- Intencionalmente no debe ser top tier solo: la fuerza de Wily está en elegir el Robot Master correcto.

## 5. Fire Man y Guts Man
Fire Man todavía requiere moveset detallado. Debe ocupar un rol diferente a Cut Man.

Guts Man se perfila como pesado/anchor-like por identidad, SIN bonificaciones especiales de "Anchor". Fuerte, resistente y capaz en el futuro de recoger entidades `ConcreteBlock` y lanzarlas. Conviene que Concrete sea una entidad reutilizable y no lógica enterrada exclusivamente en Rock.

## 6. Soporte de Wily
Cuando un Robot Master está activo, Wily puede aportar inventos/mobs desde fuera. La idea es reutilizar sistemas que ya existan en el proyecto en lugar de duplicar código.

Pool potencial pequeño (aprox. 5-7 opciones legibles):
- Concrete;
- Search Snake;
- Leaf Shield;
- N Metal / Met;
- Foot Holder u otros mobs clásicos seleccionados.

Las probabilidades dependen del Robot Master activo mediante algo equivalente a `supportWeights`:
- Cut Man puede recibir más herramientas que creen altura/posición;
- Guts Man puede favorecer Concrete porque puede recogerlo;
- Fire Man puede favorecer herramientas que obliguen al rival a moverse/saltar.

No debe sentirse como lotería pura: Wily "elige" estratégicamente aunque internamente haya pesos.

## 7. Regla de exclusión por Robot Masters seleccionados
Wily NO ofrece como soporte tecnología derivada de cualquiera de sus tres Robot Masters actualmente seleccionados.

Ejemplo V1 Cut/Fire/Guts:
- soporte CUT excluido;
- soporte FIRE excluido;
- soporte GUTS excluido.

En un futuro, si Cut Man sale del equipo y entra Quick Man, tecnología CUT podría volver al pool de soporte. Conviene etiquetar cada soporte con origen (`source: 'CUT'`, etc.) y filtrar por selección.

Esto también permite que un Robot Master que algún día se vuelva personaje independiente "se gradúe" fuera de Wily sin desperdiciar sus sistemas.

## 8. N Metal / Met autónomo
Versión de soporte autónoma:
- entra caminando desde un lado del escenario;
- si el rival se acerca demasiado, se esconde en el casco;
- escondido es invulnerable y no dispara;
- cuando el rival se aleja lo suficiente, vuelve a salir y dispara;
- usar dos distancias distintas (histeresis) para evitar parpadeo constante entre estados;
- daño moderado;
- inicialmente máximo 1 activo para no saturar pantalla.

Diferencia con cápsula: Wily puede apuntar/soltar sus propios N Metals; el soporte autónomo tiene comportamiento propio.

## 9. Foot Holder / mob saltador
Se propuso reutilizar el enemigo clásico tipo "zapato/plataforma" como apoyo de presión:
- entra y hace saltos de distinta altura/alcance;
- daño/knockback moderado;
- obliga a reaccionar sin convertirse en el ataque principal.

No construirlo hasta que Wily realmente entre en producción.

## 10. Ulti: Yellow Devil
Super de muchas barras.
- Yellow Devil ejecuta DOS ciclos de separación/reconstrucción clásicos.
- NO usa láser.
- El Robot Master activo permanece controlable y puede seguir atacando durante el patrón.
- Si una pieza del Yellow Devil toca al rival: daño + reacción.
- Después de un impacto, el rival recibe 1 segundo de inmunidad SÓLO contra Yellow Devil de forma global; no una inmunidad por pieza.
- Durante ese segundo el Robot Master de Wily sí puede seguir golpeando normalmente.
- Tras el segundo ciclo Yellow Devil se reforma brevemente y desaparece.
- No tercer ciclo, no láser.

## 11. Ulti: Estampida de Wily
Wily libera gran cantidad de robots/mobs que cruzan el escenario.
- muchos Mets y otros enemigos de tamaños/velocidades/timings distintos;
- cada unidad hace daño reducido/moderado;
- el rival SÍ puede recibir varios impactos a lo largo de la estampida;
- debe existir protección MUY breve contra impactos simultáneos del mismo montón para evitar que diez cuerpos apilados peguen en el mismo frame;
- no usar i-frames largos: robots posteriores sí deben poder conectar;
- durante la estampida el jugador no puede atacar aparte con el Robot Master; la estampida es la ofensiva del super;
- el Robot Master puede seguir visible/moverse de forma básica si se decide, pero su ofensiva queda bloqueada;
- presentación: alarma, polvo, efectos, ligero shake, variedad de siluetas.

## 12. Posible Guts Man G
Idea de ulti grande para el futuro. No hay diseño cerrado todavía; conservar como posibilidad y no implementar hasta definir función, coste y counterplay.

## 13. Emerl contra Wily
Emerl NO copia "a Wily entero". Su objetivo de copia es la unidad actualmente activa:
- Cut Man activo -> `copyTraits` de Cut;
- Fire Man -> traits de Fire;
- Guts Man -> traits de Guts;
- cápsula -> traits personales/de cápsula de Wily.

Si Wily cambia de unidad, cambia qué propiedades están disponibles para copiar. Lo ya copiado por Emerl persiste durante el encuentro; no se borra por el switch.

Emerl NO copia Support Pool ni Yellow Devil: son recursos/inventos externos, no propiedades intrínsecas del cuerpo/unidad activa.

Cada Robot Master debe declarar explícitamente sus tres `copyTraits`; no inferirlos automáticamente. Esto evita que una expansión futura de Wily rompa el sistema de Emerl.

Consecuencia estratégica interesante: Wily puede controlar qué propiedades expone a Emerl eligiendo qué unidad pone en campo.

## 14. Escalabilidad MUY futura
Si algún día hay muchos Robot Masters:
- elegir 3 antes del combate;
- presets temáticos por juego (ej. MM1 Cut/Fire/Guts; MM2 Bubble/Wood/Quick);
- posible Custom;
- internamente se pueden etiquetar roles Point/Mid/Anchor sólo para organización, sin buffs automáticos.

Nada de esto pertenece a V1. Primero hay que demostrar que Cut/Fire/Guts + cápsula funciona y es divertido.

## 15. Principio de producción
Wily puede convertirse fácilmente en el personaje más caro del roster. Para evitar scope creep:
1. terminar Rock y los 8 personajes base objetivo;
2. construir sistemas reutilizables (Concrete, Snake, Leaf, mobs);
3. reutilizar esos sistemas cuando llegue Wily;
4. empezar Wily con sólo 3 Robot Masters;
5. añadir soporte/supers después de que el núcleo de cambio + integridad + reparación funcione.

La idea central a conservar es: Wily gana por administración de herramientas, unidades y presión, no por ser personalmente el mejor peleador.
