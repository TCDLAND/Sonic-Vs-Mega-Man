# Spin Dash - reglas integradas

- Carga universal de 3 niveles: tres cargas/sonidos validos = Nv.3.
- El audio de carga nunca se sobrepone: cada carga valida reinicia una unica instancia.
- La primera mitad del audio se usa al cargar; desde 1.5 s se reproduce al impactar o terminar el Spin.
- Tras salir, el Spin puede durar hasta 6 segundos y termina al tocar al rival.
- El personaje puede saltar mientras conserva el Spin activo.
- Perfiles preparados: Sonic, Shadow, Espio, Silver y Knuckles.
- Silver tiene Spin flojo, pero su carga no es exageradamente lenta.
- Knuckles es el mas lento de preparar y el mas fuerte al conectar.
- Spin vs Spin usa fuerza de choque separada de velocidad/penetracion.
- Spin vs proyectil NO resta fuerza acumulativamente: cada proyectil se compara contra la fuerza base del Spin.
- Ganar por >= 2x conserva 100% del impacto; >= 1.5x deja 75%; una victoria mas cerrada deja 50%.
- Si Spin y proyectil empatan, ambos se detienen/cancelan.
- Si el proyectil supera al Spin, el personaje rebota y pierde el Spin.
- Knuckles Nv.3 limpio tiene Impacto Maximo. Proyectiles Nv.1 no se lo quitan; uno superior si.
- Knuckles Nv.3 con Impacto Maximo castiga fuertemente incluso si el rival se cubre.

Los numeros concretos estan centralizados en `js/spin-system.js` para poder balancearlos sin reescribir la logica.
