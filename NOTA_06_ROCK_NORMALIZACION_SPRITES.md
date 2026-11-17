# NOTA 06 — Rock: normalización de hojas y velocidad visual

## Síntoma
Las hojas preparadas de Mega Man 7 todavía conservaban márgenes/separadores morados. Como no todas usan exactamente el mismo patrón de separación (por ejemplo `rock_idle.png` es una excepción), al cambiar de animación podían aparecer franjas moradas o pequeños desplazamientos visuales. Además, la intro y la caminata de Rock se sentían demasiado lentas.

## Causa
`rock.js` todavía leía las hojas con `start:2` y `gap:2` y dependía de copias `*_alpha.png`. Eso mantenía la estructura editorial de las hojas dentro del pipeline del juego. La intro de Rock también se había forzado a durar aproximadamente 2 segundos aunque sólo tiene 6 sprites, mientras Bass usa 22 sprites en 2 segundos. Run tenía un ciclo de 2 segundos para sólo 10 frames.

## Solución
Se agregó `tools_normalize_rock_sprites.py`. El script trabaja caso por caso, recorta únicamente los márgenes conocidos (NO hace auto-crop del personaje), vuelve transparentes exactamente `#841584`, `#470047` y `#B440B4`, junta los frames sin huecos y sobrescribe los mismos nombres originales.

Ejemplos finales:
- `rock_intro.png`: 302x48 -> 288x48 (6 x 48)
- `rock_idle.png`: 208x48 -> 192x48 (4 x 48)
- `rock_run.png`: 502x48 -> 480x48 (10 x 48)
- `rock_jumpfire.png`: 350x64 -> 336x64 (6 x 56)
- `rock_hit.png`: 52x56 -> 48x56

`rock.js` ahora usa `start:0` y `gap:0` y carga directamente `rock_*.png`. Se eliminaron las copias `*_alpha.png` para evitar dos versiones de la misma animación.

## Intro
Bass usa 22 frames durante 2000 ms: aproximadamente 91 ms por sprite. Para conservar ese ritmo visual, los 6 sprites de Rock duran aproximadamente 0.55 s en total en lugar de 2 s.

Código anterior:
```js
getIntroFrames(){
    return Array.from({length:6},()=>({duration:20}));
}
```

Código nuevo:
```js
getIntroFrames(){
    return [5,6,5,6,5,6].map(duration=>({duration}));
}
```

## Run
Bass recorre 14 sprites en 1 segundo (~71 ms por sprite). Rock tiene 10, por lo que su ciclo normal se cambió a 720 ms. El retroceso conserva el criterio anterior de ser 3 veces más lento: 2160 ms.

## Importante
El normalizador NO elimina espacios transparentes internos ni centra sprites según sus píxeles visibles. Los pivotes y extensiones intencionales de 56/64 px se conservan. Esto permite distinguir un problema de margen de un problema real de pivote.

## Pendiente de prueba
- Confirmar visualmente que no aparece morado al cambiar de animación.
- Confirmar que Intro y Run ya se sienten ágiles.
- Probar Slash Claw en combate.
- Si una animación todavía se mueve unos píxeles al cambiar, corregir su pivote específico en `rock.js`; no volver a recortar el personaje.
