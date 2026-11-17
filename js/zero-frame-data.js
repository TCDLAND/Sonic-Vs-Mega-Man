// ============================================================
// ZERO - ATLAS DE FRAMES SOBRE LA HOJA ORIGINAL
// Fuente: assets/images/Zerosprites.png (677 x 2048)
//
// IMPORTANTE:
// - NO se generan spritesheets nuevas.
// - Cada frame usa su propio rectángulo {x,y,w,h} de la hoja original.
// - Zero mira a la IZQUIERDA en la fuente; el renderer puede voltearlo.
// - originX/originY son el pivote de los pies/cuerpo dentro del recorte.
// - Los rectángulos son deliberadamente variables: los efectos del sable
//   pueden sobresalir sin obligarnos a usar celdas gigantes iguales.
// ============================================================

const F = (x, y, w, h, originX, originY, extra = {}) => ({
  x, y, w, h, originX, originY, ...extra
});

// Primer pase del atlas de combate tomado directamente de Zerosprites.png.
// Los nombres Slash A/B/C son los nombres de TU juego, no los rótulos de la hoja.
export const ZERO_ATTACK_FRAMES = {
  // Corte de arriba hacia abajo.
  slashA: [
    F(0,   140, 42, 61, 20, 58, { active:false }),
    F(37,  140, 45, 61, 22, 58, { active:false }),
    F(76,  140, 58, 61, 26, 58, { active:true  }),
    F(124, 140, 72, 61, 35, 58, { active:true  }),
    F(184, 140, 72, 61, 37, 58, { active:true  }),
    F(244, 140, 61, 61, 31, 58, { active:false }),
    F(296, 140, 53, 61, 27, 58, { active:false }),
    F(340, 140, 45, 61, 23, 58, { active:false }),
    F(380, 140, 45, 61, 23, 58, { active:false })
  ],

  // Corte horizontal.
  slashB: [
    F(0,   201, 43, 60, 21, 57, { active:false }),
    F(37,  201, 46, 60, 23, 57, { active:false }),
    F(75,  201, 58, 60, 28, 57, { active:true  }),
    F(123, 201, 75, 60, 37, 57, { active:true  }),
    F(185, 201, 76, 60, 38, 57, { active:true  }),
    F(248, 201, 65, 60, 33, 57, { active:false }),
    F(303, 201, 55, 60, 28, 57, { active:false }),
    F(350, 201, 48, 60, 24, 57, { active:false }),
    F(390, 201, 46, 60, 23, 57, { active:false })
  ],

  // Corte pesado. Sus ventanas activas son provisionales; en este ataque
  // dijiste que luego definirás exactamente startup/active/recovery por frame.
  slashC: [
    F(0,   410, 50, 66, 25, 63, { active:false }),
    F(40,  410, 55, 66, 27, 63, { active:false }),
    F(84,  410, 70, 66, 35, 63, { active:false }),
    F(140, 410, 91, 66, 45, 63, { active:true  }),
    F(217, 410, 93, 66, 46, 63, { active:true  }),
    F(296, 410, 75, 66, 37, 63, { active:true  }),
    F(357, 410, 62, 66, 31, 63, { active:false }),
    F(406, 410, 52, 66, 26, 63, { active:false })
  ],

  // Corte durante dash/deslizamiento.
  slidingSaber: [
    F(0,   516, 55, 54, 27, 51, { active:false }),
    F(43,  516, 61, 54, 30, 51, { active:false }),
    F(92,  516, 79, 54, 39, 51, { active:true  }),
    F(157, 516, 92, 54, 46, 51, { active:true  }),
    F(235, 516, 91, 54, 45, 51, { active:true  }),
    F(312, 516, 70, 54, 35, 51, { active:false }),
    F(369, 516, 55, 54, 27, 51, { active:false })
  ],

  // Corte aéreo. El pivote sigue siendo el centro corporal; y en gameplay
  // se posiciona usando los pies virtuales del Fighter, no la esquina del PNG.
  airSlash: [
    F(0,   614, 48, 75, 24, 67, { active:false }),
    F(39,  614, 57, 75, 28, 67, { active:false }),
    F(84,  614, 74, 75, 37, 67, { active:true  }),
    F(144, 614, 86, 75, 43, 67, { active:true  }),
    F(216, 614, 78, 75, 39, 67, { active:true  }),
    F(281, 614, 62, 75, 31, 67, { active:false }),
    F(331, 614, 55, 75, 27, 67, { active:false })
  ],

  // Pose/disparo de Buster tomada de la hoja original. El proyectil real del
  // juego sigue siendo entidad separada; estos frames son sólo la animación de Zero.
  buster: [
    F(0,   568, 42, 48, 21, 45, { active:false }),
    F(36,  568, 43, 48, 21, 45, { active:false }),
    F(73,  568, 44, 48, 22, 45, { active:true  }),
    F(111, 568, 44, 48, 22, 45, { active:true  }),
    F(149, 568, 44, 48, 22, 45, { active:false }),
    F(187, 568, 44, 48, 22, 45, { active:false })
  ]
};

// Estados básicos útiles para empezar a sustituir el prototipo más adelante.
export const ZERO_BASE_FRAMES = {
  idle: [
    F(0, 76, 39, 62, 19, 59),
    F(34, 76, 39, 62, 19, 59),
    F(68, 76, 39, 62, 19, 59),
    F(102,76, 39, 62, 19, 59)
  ],
  run: [
    F(0, 308, 48, 43, 24, 40),
    F(40,308, 49, 43, 24, 40),
    F(80,308, 50, 43, 25, 40),
    F(121,308,52, 43, 26, 40),
    F(164,308,52, 43, 26, 40),
    F(207,308,50, 43, 25, 40),
    F(248,308,49, 43, 24, 40),
    F(288,308,48, 43, 24, 40)
  ]
};

export function getZeroFrames(animationName) {
  return ZERO_ATTACK_FRAMES[animationName] || ZERO_BASE_FRAMES[animationName] || [];
}
