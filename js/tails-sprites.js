const image=new Image();
image.src='assets/story/sonic/tails.png';

// Rectángulos por pose. Los separadores y rótulos quedan fuera de los recortes.
function row(sy,bottom,edges) {
    const frames=[];
    for(let i=0;i<edges.length;i+=2)frames.push({sx:edges[i],sy,sw:edges[i+1]-edges[i],sh:bottom-sy});
    return frames;
}
export const TAILS_FRAMES={
    idle:row(8,47,[8,46,50,88,93,129,134,172,177,214,219,256,262,297,303,342]),
    turn:row(49,85,[11,42,47,73,78,106]),
    run:row(87,128,[10,49,60,100,105,144,149,187,192,232,237,278,283,322,327,365,370,409]),
    brake:row(133,170,[10,45,50,93,98,137,143,180]),
    reverse:row(175,214,[7,48,54,85,91,125,131,166]),
    dash:row(216,257,[9,48,62,104,108,145,151,185,190,228]),
    jump:row(259,308,[19,36,42,62,68,92,98,128,133,167]),
    fall:row(312,354,[9,45,51,82,89,117,123,154]),
    land:row(356,393,[12,43,49,86,91,125]),
    fly:row(397,438,[8,49,60,105,110,150,156,194,199,238,249,287]),
    guard:row(443,479,[8,44,49,80,86,121,128,163]),
    heal:row(484,522,[13,47,60,98,101,139,144,177,182,217,227,264,268,303]),
    iq200:row(526,567,[8,43,48,82,87,133,137,182,188,226,231,270]),
    iq300:row(569,608,[10,45,50,74,80,117,122,156,161,197,201,235,240,269,275,304]),
    iq400:row(613,652,[14,47,52,79,85,112,118,155,160,199,205,241,246,284,289,328]),
    hook:[...row(657,701,[8,51,56,99,103,146,150,193,197,240,244,287,292,335,340,384,389,437,442,482,487,533,538,585,590,636,641,686]),
        ...row(704,742,[12,57,62,109,114,151,156,190,195,227,232,263,268,299,304,339,344,379,384,415,420,457])],
    upper:row(748,802,[9,51,56,100,105,147,152,198,203,248,253,300,305,351,356,400,405,447,452,496,501,545,551,588]),
    cyclone:row(805,840,[9,49,54,92,97,132,137,183,188,228,233,273,278,316,321,360,365,401,406,437]),
    typhoon:row(847,891,[9,49,54,92,97,132,137,183,188,228,233,279,284,324,329,375,380,420,425,465,471,509,514,553,558,594]),
    aimApproach:row(892,943,[19,38,43,70,75,109,120,156,161,198,203,240,245,281]),
    dunk:row(945,995,[13,45,50,89,94,131,136,168,173,202,207,245,250,288,293,329]),
    cannon:row(1007,1050,[8,48,53,93,98,138,143,183,188,228,233,273,277,318,323,371,376,424,429,476,481,526,
        531,576,581,628,633,681,685,733,738,786,791,834,839,881,886,928,933,969,974,1011]),
    airCannon:row(1168,1203,[11,45,50,84,89,127,132,178,183,226,231,273,285,332,337,378,383,418,423,455,476,509,514,552,558,590,595,630]),
    cannonUp:row(1055,1095,[310,346,351,393,398,440,445,487,492,531,536,575,580,621,626,668,673,715,
        720,762,767,809,814,856,861,903,908,945,950,989]),
    cannonDown:row(1105,1146,[310,349,354,386,391,423,428,459,464,496,501,531,536,567,572,604,609,641,
        646,678,683,720,725,763,768,800,804,834,839,875]),
    airCannonUp:row(1227,1275,[288,325,334,370,379,411,420,452]),
    airCannonDown:row(1280,1325,[285,331,338,370,380,405,424,446]),
    flick:row(1393,1435,[8,47,52,88,93,122,125,160,165,201,206,238,243,278,283,325]),
    airFlick:row(1438,1481,[8,47,52,88,93,122,127,162,167,203,208,239,244,279,284,321]),
    hurt:row(1584,1628,[9,50,55,97,102,138]),
    knock:row(1675,1725,[8,51,56,90,97,134,139,175,180,212,217,254,259,295,300,332]),
    wallHit:row(1731,1775,[9,28,33,53,58,91,96,133,138,176,181,221,226,247,252,273]),
    groundHit:row(1782,1835,[10,39,44,75,79,105,110,140,145,176,181,221,226,270,275,315]),
    blocked:row(1885,1914,[9,51,56,99,104,142]),
    getup:row(1837,1874,[9,49,54,95,100,142,147,185,190,223,228,267,272,312]),
    wall:row(1916,1955,[10,41]),
    ball:row(1334,1374,[15,39,43,65,69,93,97,119,123,147,151,173,177,201,205,227,231,255,259,281]),
    bomb:row(1530,1568,[85,100,111,124,129,143,148,161,166,179,184,198,203,216]),
    glove:row(1484,1527,[14,20,25,39,44,68,73,99,104,130,135,164,169,198,203,229,234,258,263,294,299,313])
};

let pixels;
const trims=new WeakMap();
function trim(cell) {
    if(trims.has(cell))return trims.get(cell);
    if(!pixels){
        const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
        const c=canvas.getContext('2d',{willReadFrequently:true});c.drawImage(image,0,0);
        pixels=c.getImageData(0,0,canvas.width,canvas.height);
    }
    let l=cell.sw,r=-1,t=cell.sh,b=-1;
    for(let y=0;y<cell.sh;y++)for(let x=0;x<cell.sw;x++){
        if(pixels.data[((cell.sy+y)*pixels.width+cell.sx+x)*4+3]<16)continue;
        l=Math.min(l,x);r=Math.max(r,x);t=Math.min(t,y);b=Math.max(b,y);
    }
    const result=r<l?cell:{sx:cell.sx+l,sy:cell.sy+t,sw:r-l+1,sh:b-t+1};
    trims.set(cell,result);
    return result;
}
export function tailsFrame(key,index,x,feet,scale,direction=1){
    if(!image.complete||!image.naturalWidth)return null;
    const clip=TAILS_FRAMES[key];
    const cell=trim(clip[Math.max(0,index)%clip.length]);
    const {sx,sy,sw,sh}=cell;
    const effects=['ball','bomb','glove'].includes(key);
    // Las colas ocupan el lado trasero de las poses de pie. El pivote acompaña al cuerpo.
    const pivot=effects?sw*.5:sw*(['idle','run','cannon'].includes(key) ? .62 : .55);
    const flipX=direction<0;
    return {img:image,sx,sy,sw,sh,dx:x-(flipX?sw-pivot:pivot)*scale,dy:feet-sh*scale,
        dw:sw*scale,dh:sh*scale,flipX,key,frame:index};
}
const names={idle:'Reposo',turn:'Giro',run:'Carrera',brake:'Freno',reverse:'Giro en carrera',dash:'Tails Hop',jump:'Salto',
    fall:'Caída',land:'Aterrizaje',fly:'Vuelo',guard:'Guardia',heal:'Curación',iq200:'IQ200',iq300:'IQ300',iq400:'IQ400',
    hook:'Magic Hook',upper:'Magic Upper',cyclone:'Tails Cyclone',typhoon:'Typhoon',dunk:'Tails Dunk',cannon:'Energy Ball',
    airCannon:'Energy Ball aéreo',cannonUp:'Energy Ball terrestre hacia arriba',cannonDown:'Energy Ball terrestre hacia abajo',
    airCannonUp:'Energy Ball aéreo hacia arriba',airCannonDown:'Energy Ball aéreo hacia abajo',aimApproach:'Trayectoria hacia el rival',
    wallHit:'Impacto en pared',groundHit:'Impacto en el piso',blocked:'Ataque bloqueado',flick:'Flick',airFlick:'Flick aéreo',hurt:'Impacto',knock:'Retroceso',getup:'Levantarse',
    wall:'Agarre de pared',ball:'Efecto Energy Ball',bomb:'Efecto Chu² Bomb',glove:'Big Hand'};
export function tailsAnimations(){
    return Object.entries(TAILS_FRAMES).map(([id,frames])=>({id,name:names[id],count:frames.length,
        ms:id==='idle'?128:75,frame(index){return tailsFrame(id,index,0,0,1);}}));
}
