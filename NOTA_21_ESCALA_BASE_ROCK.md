# Nota 21: Rock como referencia de tamaño

## Referencia

- Mega Man / Rock conserva su escala actual: el idle tiene unos **128 px visibles** sin contar alpha transparente.
- Esa silueta representa la estatura de referencia de **132 cm**.
- Cada luchador se ajusta usando su altura de historia y el alto visible actual de su idle. El ancho y el cuerpo físico reciben el mismo multiplicador para que sprites y hurtboxes sigan coincidiendo.
- Eggman y Wily no se ajustan en esta etapa porque aparecerán usando sus naves.

## Ajustes del elenco

- Sonic 100 cm; Knuckles 110 cm; Shadow 100 cm; Espio 110 cm; Silver 100 cm.
- X 160 cm; Zero y MegaManZero 175 cm; Emerl 110 cm.
- Bass y Proto Man: **138 cm de trabajo**, una estimación para dejarlos ligeramente más altos que Rock, como pidió el usuario. No es una medida oficial confirmada.
- Los perfiles parten de los altos visibles alfa medidos en las hojas actuales: Rock 128 px, Sonic 112, Knuckles 112, Shadow 108, Espio 132, Bass 129 y Zero 150. Los placeholders sin hojas propias usan su alto de cuerpo actual.

## Compañeros

- Rush reduce su multiplicador en una unidad (`owner.height / 48 - 1`).
- Treble baja de multiplicador x3 a x2.
- Beat y Eddie conservan el multiplicador previo.

## Implementación

La tabla de perfiles y proporciones está en `js/combat-system.js`. Los renderizadores con escala fija (Bass y Shadow), así como sus proyectiles principales, leen el multiplicador del luchador. Rock y el mundo del escenario no se amplían globalmente.
