// Highway: los dos pilares/bordes exteriores miden 226 px.
// Las caras interiores jugables son x=226 y x=2368 (2560-226), de arriba a abajo.
export const HIGHWAY_WALLS = Object.freeze([
  { x: 226, top: 0, bottom: 720 },
  { x: 2368, top: 0, bottom: 720 }
]);

export function canWallJump(f){ return f.characterId === 'x' || f.characterId === 'zero'; }
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
