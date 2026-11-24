// Highway: los dos pilares/bordes exteriores miden 226 px.
// Las caras interiores jugables son x=226 y x=2368 (2560-226), de arriba a abajo.
import { worldWidth, FLOOR_Y } from "./config.js";

export const HIGHWAY_WALLS = Object.freeze([
  { x: 226, top: 0, bottom: 720 },
  { x: 2368, top: 0, bottom: 720 }
]);

// The same wall records are shared by movement, wall jumps and projectiles.
export function setArenaGeometry(stage) {
  const highway=!stage?.id || stage.id==='highway';
  HIGHWAY_WALLS[0].x=highway?226:0;
  HIGHWAY_WALLS[1].x=highway?2368:worldWidth;
  return stage?.floor??FLOOR_Y;
}

export function landOnStagePlatform(fighter, oldFeet, platforms=[]) {
  if (fighter.vy<0 || fighter.minerPhase==='under') return;
  const feet=fighter.y+fighter.height;
  const surface=platforms.find(p=>oldFeet<=p.y+2 && feet>=p.y &&
    fighter.x+fighter.width*.78>p.x && fighter.x+fighter.width*.22<p.end);
  if (!surface) return;
  fighter.y=surface.y-fighter.height;
  fighter.vy=0;
  fighter.isGrounded=true;
  fighter.wasInAirFromKnockback=false;
}

export function canWallJump(f){ return f.characterId === 'x' || f.characterId === 'zero' || f.characterId === 'metal-sonic' || f.characterId === 'megaman-zero'; }
export function getTouchedWall(f){
  if(!canWallJump(f) || f.isGrounded) return null;
  const y=f.getCurrentY(), bottom=y+f.getCurrentHeight();
  for(const wall of HIGHWAY_WALLS){
    if(bottom < wall.top || y > wall.bottom) continue;
    const leftDist=Math.abs(f.x-wall.x);
    const rightDist=Math.abs((f.x+f.width)-wall.x);
    if(leftDist<=12) return { ...wall, side:'left' };
    if(rightDist<=12) return { ...wall, side:'right' };
  }
  return null;
}
