# Nota 32 — Visor de animaciones, carrera de X e idle de Bass

- La guía reproduce las secuencias que tienen hojas integradas. Cada opción muestra un nombre y el identificador usado en el código. Los personajes provisionales sin hojas tienen una indicación en lugar de una vista vacía.
- El visor tiene velocidad de 0.25× a 2×, reproducción, pausa, flechas de cuadro y un deslizador. Muestra el cuadro actual, el total y el rectángulo fuente en píxeles. La línea inferior marca la referencia de los pies. Algunas velocidades son referencias del visor porque en combate el salto, la pared y otros estados se sincronizan con física o entradas.
- Se recortaron de nuevo, por espacios entre sprites, los 16 cuadros de carrera y los 16 de carrera con disparo de X. En combate la postura de arranque se reproduce una vez al empezar a correr.
- El idle de Bass usa ocho poses de la primera hoja con los pies completos y 270 ms por cuadro. Las poses de puño, guardia y tiro de la hoja de proporciones distintas usan una escala reducida. El visor aplica la misma escala relativa.
- En Chrome se comprobaron los cambios de personaje y secuencia, el conteo de cuadros, la pausa, el avance manual, el selector de velocidad y la carrera de X junto al idle de Bass en combate.
