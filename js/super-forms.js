import { SUPER_FRAMES } from './super-frames.js';

const atlas = new Image();
atlas.src = 'assets/images/super-forms/atlas.png';

export function formFrame(key,index,x,feet,scale,dir) {
    if (!atlas.complete || !atlas.naturalWidth) return null;
    const sequence=SUPER_FRAMES[key];
    const [sx,sy,sw,sh]=sequence[Math.max(0,index)%sequence.length];
    const pivot=key==='sonicRocket' ? sw*.43 : sw/2;
    const flipX=dir<0;
    return {img:atlas,sx,sy,sw,sh,dx:x-(flipX?sw-pivot:pivot)*scale,
        dy:feet-sh*scale,dw:sw*scale,dh:sh*scale,flipX,key,frame:index};
}

const labels={
    sonicIdle:'Reposo levitando',sonicRun:'Vuelo de avance',sonicJump:'Salto',sonicFall:'Caída',
    sonicRocket:'Patada aérea',sonicDash:'Flare Burst',sonicPunch:'Golpes',sonicKick:'Patada giratoria',
    sonicUpper:'Remolino ascendente',sonicGuard:'Guardia',sonicBrake:'Freno',sonicSpin:'Giro',
    shadowIdle:'Reposo',shadowEagle:'Shadow Eagle y estela',shadowTeleportAir:'Shadow Teleport aéreo',
    shadowHeal:'Curación',shadowBurst:'Chaos Burst',shadowBurstAir:'Air Chaos Burst',shadowBurstFx:'Efecto Chaos Burst'
};

export function formAnimations(prefix) {
    return Object.keys(SUPER_FRAMES).filter(key=>key.startsWith(prefix)).map(id=>({
        id,name:(prefix==='sonic'?'Super Sonic · ':'Shadow · ')+labels[id],count:SUPER_FRAMES[id].length,ms:id==='sonicIdle'?125:65,
        frame(index){return formFrame(id,index,0,0,1,1);}
    }));
}
