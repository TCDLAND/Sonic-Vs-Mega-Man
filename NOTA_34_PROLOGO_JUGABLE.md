# Prólogo jugable de Sonic vs. Mega Man

Abre la carpeta del juego en VS Code, inicia Live Server desde `index.html` y entra a **Modo historia → Prólogo**. También puedes iniciar un servidor desde PowerShell en la carpeta del proyecto con `npx http-server . -p 8080` y abrir `http://localhost:8080`.

## Controles

| Acción | Teclado | Mando Xbox |
| --- | --- | --- |
| Caminar | A/D o flechas izquierda/derecha | Stick izquierdo o cruceta |
| Saltar | W, flecha arriba o espacio | A |
| Buster | J, se puede mantener | X, se puede mantener |
| Dash | K con los pies en el suelo | B con los pies en el suelo |
| Cargar buster en el recorrido | Mantener I y soltar | Teclado |
| Golpe cercano en el recorrido | M | Y |
| Cambiar entre Rock y Blues en el recorrido | L | RB |
| Avanzar diálogo | Enter, clic o J | A |
| Elegir opción en escena | Tab y Enter, o clic | Arriba/abajo y A |
| Pausar o reanudar recorrido | Esc | Menú |
| Regresar al menú desde el recorrido | T mientras está en pausa | Teclado |

Los combates del prólogo usan los controles de pelea que ya tiene cada personaje. **Elegir escena** abre el laboratorio, el inicio de calle, el rescate, la entrada del museo, los tres combates y el accidente de Wily.

## Archivos

- `js/story-script.js` contiene los diálogos y `js/story-mode.js` coordina las escenas, los accesos directos y la vida entre combates.
- `js/story-platform.js` contiene el recorrido, la cámara, los globos, el iris, los checkpoints, los patrones de calle y el viaje de Auto.
- `js/music.js` gestiona la música. `js/battle.js`, `js/input.js`, `js/main.js`, `js/config.js`, `index.html` y `style.css` integran audio, controles, fondos y escenas.
- `assets/audio/story/` y `assets/story/` contienen los recursos de los ZIP. Los recortes de Light, Roll y Auto se guardaron como PNG separados y las hojas originales siguen disponibles.

Wily Theme al inicio y Wily Stage 1 al volver al laboratorio usan el mismo MP3 de Mega Man 8. La aproximación al castillo conserva la pista de entrada de Mega Man 7. Emerl se retira al quedar con 20 % de vida en el prólogo.

## Pruebas

- Chrome con teclado. Salida del laboratorio, cruces de los dos huecos, Bunby Tank y desprendimiento de Bunby Top, Mad Grinder derrotado con el buster, rescate, viaje y recorrido del museo.
- Chrome con el estado de combate controlado para verificar el 2 vs. 3, conservar 47 y 73 de vida al entrar contra Bass, reproducir el mismo MP3 de Wily y activar la retirada de Emerl.
- Accesos directos a Robot Masters, Bass y Emerl. Contra Emerl se verificaron Rock con las copias de escudo y buster, y Blues con el escudo.
- Se verificó una caída con retorno al primer checkpoint sin duplicar tanques, y la entrada a Versus con Highway.
- Se verificaron movimiento, salto y pausa con la Gamepad API simulada en Chrome. Falta la prueba con mando Xbox físico.

## Recursos provisionales

- Los retratos de Roll y Auto salen de sus hojas. Se usa el Met del proyecto como sustituto visual del Metall FX, el fondo del laboratorio para la llegada a la fortaleza y un destello visual para la alarma. El ZIP incluye una hoja de Mash.
## Ajustes del prólogo y de combate

- El compañero dispara a los enemigos cercanos en la calle. Rock y Blues tienen medidores independientes y comparten el checkpoint. La vida restante pasa al 2 contra 3 del museo.
- Emerl copia el buster y los sets de Rock con munición propia. Rush, Beat y Eddie quedan para Rock.
- Los proyectiles rivales pueden sacar volando a Eddie mientras lo lleva Beat o antes de tocar el suelo. Un derribo interrumpe la entrega y reinicia la espera de 10 segundos.
- Bass y Blues quedaron 8 % más estrechos en el render y la colisión por píxeles. La altura objetivo en idle de Sonic, Shadow y Silver pasó a 128 px, igual que Rock. Knuckles y Espio quedan en aproximadamente 141 px para conservar su proporción con Sonic.
- En la calle se completó la parte inferior de Mad Grinder cuando pierde la cresta. El carro tiene asientos visibles para Rock, Blues y Roll. Las cinemáticas muestran las copias con ambos personajes en el piso y las poses de diálogo se reservan para Rock o Blues mientras hablan.

## Heat Man y Auto

- El fuego de Rock, incluido Flame Sword, calienta a Heat Man y pierde su daño y empuje al tocarlo. El Mega Buster y las armas sin fuego siguen dañándolo.
- La paleta de Heat Man se aclara al superar el 55 % de calor y vuelve a la normal al enfriarse. El counter abre una ventana frontal de 780 ms después de la animación de carga.
- En esa ventana devuelve proyectiles de fuego o retrocede y lanza al atacante cercano. Los proyectiles normales, los golpes por detrás y los ataques durante la preparación permiten castigarlo.
- La guía de Wily incluye las hojas nuevas de Heat Man. Auto usa su nueva hoja de pie durante el rescate y la despedida del museo.

## Segunda pasada de pulido

- Proto puede mantener I en el suelo o en el aire para cubrirse de frente y mantener J al mismo tiempo para cargar. Emerl usa las transiciones de color del buster de Rock.
- La calle tiene cuatro Bunby Tank. Mad Grinder y Auto de pie usan el doble de escala. En el museo Roll y Auto reaccionan con globos según el líder y la entrada usa un recorte del museo intacto.
- En cinemáticas cambia el brillo del retrato que habla y se mantiene su escala. En la copia de Emerl, Rock y Proto aparecen juntos a la izquierda.
- Cut Man alterna salto en arco y salto vertical según distancia. Aumentaron el tamaño de Heat Man y sus proyectiles. Los fondos de batalla cubren el ancho de mundo de 2560 px.

## Museo, Bass Jet y repertorio de Emerl

- Bass Jet puede impactar una vez por pasada y la CPU lo dirige hacia el rival para cruzar y buscar un golpe desde el otro lado.
- Emerl incorpora ataques propios al duelo contra Rock. Alterna puño, patada giratoria, golpe ascendente, patada con onda y rocket aéreo según la distancia y altura.
- El museo incorpora tres Mets, plataformas que se pueden pisar y piezas de techo y piso recortadas de su hoja. Roll y Auto reaccionan hasta cinco veces cada uno al volver a acercarse.
- Light mantiene un gesto visible al terminar la charla. Se ajustó el apoyo del carro y la altura de los globos del viaje. Se revisaron la orientación de Heat Man y el cuadro de aterrizaje de Cut Man.

## Bass bajo control humano

- El doble toque se procesa una sola vez por pulsación. Bass usa su propio estado de dash y la hoja de cinco cuadros BassDash.png.
- Las poses terrestres de Bass usan un factor de 0.88 en ambos ejes con respecto a la escala anterior y conservan el anclaje inferior. El salto conserva su escala.
- P1 usa M para puño, K para patada, Abajo + M para barrera, Atrás + K para esquiva, Espacio para Jet diagonal y Salto + Q/E para Jet horizontal. P2 usa menos, igual, Enter y corchetes para las acciones equivalentes.
