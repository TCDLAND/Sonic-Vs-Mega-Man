# NOTA 08 — Rush automático + limpieza definitiva del morado

## Síntomas
1. Rush podía interpretarse como si hubiera que invocarlo, cuando su diseño correcto es aparecer automáticamente desde el inicio junto con Rock.
2. Todavía se veía `#640664` en sprites de Rock aunque el normalizador ya conocía ese color.

## Causa
- Rush ya se construía desde el constructor de Rock, pero no estaba documentado de forma inequívoca como compañero permanente. Sus botones son **órdenes**, no invocaciones.
- Los PNG del build anterior ya estaban normalizados de tamaño. Agregar un color nuevo al script normalizador no modifica mágicamente los PNG ya generados si no se vuelve a ejecutar el proceso sobre ellos.

## Corrección
- Rush se crea automáticamente con `new RushCompanion(this)` al crear Rock. Comienza en `intro`, reproduce `rush_intro` y después queda acompañándolo. No existe botón de invocación.
- `K/B` sólo ordena Rush Jet y `abajo + K/B` sólo ordena Rush Coil.
- Se volvió a ejecutar la limpieza sobre TODOS los PNG normalizados de Rock.
- Se verificó por píxel que ya no quede visible ninguno de estos cuatro colores estructurales:
  - `#841584`
  - `#470047`
  - `#B440B4`
  - `#640664`
- La verificación del build dio **0 píxeles visibles** de esos cuatro colores en todas las hojas de Rock (exceptuando la imagen de paletas, que no es una hoja renderizada de animación).

## Regla de Rush
`inicio pelea -> rush_intro automático -> idle 8-10 -> seguir a Rock permanentemente`

Las órdenes cambian temporalmente su estado y, al terminar, Rush vuelve con Rock.

## Pendiente de prueba
Ajustar sólo sensaciones de gameplay después de probar: separación de seguimiento, altura/avance de salto, fuerza de Coil y velocidad/rango de Jet.
