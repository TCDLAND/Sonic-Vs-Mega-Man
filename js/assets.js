// ========================================
// CARGA DE IMÁGENES Y AUDIO
// ========================================

export const bgImage = new Image();
bgImage.src = "assets/images/highway_long.png";

// ========================================
// ESPIO
// ========================================
export const espioSprite = new Image();
espioSprite.src = "assets/images/espio_sheet.png";
export const espioSprite2 = new Image();
espioSprite2.src = "assets/images/espio_sheet2.png";
export const espioSprite3 = new Image();
espioSprite3.src = "assets/images/espio_sheet3.png";

// ========================================
// BASS - 11 hojas nuevas
// ========================================
export const bassIntro = new Image();
bassIntro.src = "assets/images/BassIntro.png";
export const bassIdle = new Image();
bassIdle.src = "assets/images/BassIdle.png";
export const bassShootHor = new Image();
bassShootHor.src = "assets/images/BassShootHor.png";
export const bassShootDiaAbajo = new Image();
bassShootDiaAbajo.src = "assets/images/BassShootDiaAbajo.png";
export const bassShootDiaArriba = new Image();
bassShootDiaArriba.src = "assets/images/BassShootDiaArriba.png";
export const bassShootArriba = new Image();
bassShootArriba.src = "assets/images/BassShootArriba.png";
export const bassJump = new Image();
bassJump.src = "assets/images/BassJump.png";
export const bassHurt = new Image();
bassHurt.src = "assets/images/BassHurt.png";
export const bassHurtHard = new Image();
bassHurtHard.src = "assets/images/BassHurtHard.png";
export const bassDash = new Image();
bassDash.src = "assets/images/BassDash.png";
export const bassCaminar = new Image();
bassCaminar.src = "assets/images/BassCaminar.png";

// ========================================
// BASS - hojas VIEJAS (para balas)
// ========================================
export const bassSprite1 = new Image();
bassSprite1.src = "assets/images/bass_sheet1.png";
export const bassSprite2 = new Image();
bassSprite2.src = "assets/images/bass_sheet2.png";
export const bassSprite3 = new Image();
bassSprite3.src = "assets/images/bass_sheet3.png";

// ========================================
// TREBLE - hojas nuevas
// ========================================
export const trebleIntro = new Image();
trebleIntro.src = "assets/images/TrebleIntro.png";
export const trebleIdle = new Image();
trebleIdle.src = "assets/images/TrebleIdle.png";
export const trebleCaminar = new Image();
trebleCaminar.src = "assets/images/TrebleCaminar.png";
export const trebleJump = new Image();
trebleJump.src = "assets/images/TrebleJump.png";
export const trebleCorrer = new Image();
trebleCorrer.src = "assets/images/TrebleCorrer.png";
// ⭐ CORREGIDO: Byson (con Y), no Bison
export const trebleBison = new Image();
trebleBison.src = "assets/images/TrebleByson.png";

// ========================================
// ALIASES para compat con main.js
// ========================================
export const trebleSprite1 = bassSprite3;

// ========================================
// PROYECTILES
// ========================================
export const kunaiImage = new Image();
kunaiImage.src = "assets/images/kunai.png";

export const shurikenImages = [new Image(), new Image(), new Image(), new Image()];
shurikenImages[0].src = "assets/images/shuriken1.png";
shurikenImages[1].src = "assets/images/shuriken2.png";
shurikenImages[2].src = "assets/images/shuriken3.png";
shurikenImages[3].src = "assets/images/shuriken4.png";

// ========================================
// AUDIOS
// ========================================
export const kunaiAudio = new Audio("assets/audio/kunai.mp3");
kunaiAudio.preload = "auto";
export const shurikenAudio = new Audio("assets/audio/shuriken.mp3");
shurikenAudio.preload = "auto";
export const sonicJumpAudio = new Audio("assets/audio/SonicJump.mp3");
sonicJumpAudio.preload = "auto";
export const sonicSpinDashAudio = new Audio("assets/audio/SonicSpinDash.mp3");
sonicSpinDashAudio.preload = "auto";
export const hitAudio = new Audio("assets/audio/hit.mp3");
hitAudio.preload = "auto";
export const busterAudio = new Audio("assets/audio/buster.mp3");
busterAudio.preload = "auto";

// Bass
export const dashBassAudio = new Audio("assets/audio/DASHBASS.ogg");
dashBassAudio.preload = "auto";
export const busterBassAudio = new Audio("assets/audio/BUSTERBASS.ogg");
busterBassAudio.preload = "auto";
export const bassBrincoIdaAudio = new Audio("assets/audio/BASSBRINCOIDA.ogg");
bassBrincoIdaAudio.preload = "auto";
export const bassPisoAudio = new Audio("assets/audio/BASSPISO.ogg");
bassPisoAudio.preload = "auto";
// ========================================
// ZERO - HOJA MAESTRA (frames variables)
// ========================================
// Se usa directamente con source rectangles; NO se divide en PNGs nuevos.
export const zeroMasterSheet = new Image();
zeroMasterSheet.src = "assets/images/Zerosprites.png";
