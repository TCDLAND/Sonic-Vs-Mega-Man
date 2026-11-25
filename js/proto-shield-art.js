function load(name) {
    const image = new Image();
    image.src = 'assets/images/proto-update/' + name + '.png';
    return image;
}

const throwSheet = load('throw');
const jumpSheet = load('jump-edited');
const runShot = load('run-shot');
const runShotUnshielded = load('run-shot-unshielded');
const heavyBlock = load('shield-heavy-block');
const shieldSheet = load('shield-flight');
const discSheet = load('shield-disc');
const releaseSheet = load('release');
const strikeSheet = load('strike');
const throwCells = [
    [12, 23, 106, 34, 81], [124, 18, 98, 38, 74], [224, 14, 82, 42, 59],
    [311, 14, 51, 43, 29], [408, 18, 43, 40, 21]
];
const jumpCells = [[2,0,28,64,15],[41,0,29,64,15],[79,0,41,64,20],[126,0,41,64,20]];
const runShotCells = [[1,48,22],[56,106,20],[114,166,22],[175,229,24],[239,291,21],
    [301,346,20],[358,403,19],[413,466,23],[474,531,25],[538,592,22]];
const slideSheet = load('slide-new');
const slideCells = [[1,8,49,31,24],[54,8,49,31,24]];
const unshielded = Object.fromEntries(['Idle','Run','AirShot','Charge'].map(key =>
    ['proto'+key,load(key.toLowerCase()+'-unshielded')]));
const strikeCells = [[29, 3, 32, 36, 16], [96, 2, 33, 37, 16], [166, 2, 46, 37, 20]];
const spinCells = [[5, 0, 14, 35], [57, 0, 10, 35], [105, 0, 14, 35], [153, 0, 18, 35],
    [205, 0, 14, 35], [257, 0, 10, 35], [305, 0, 14, 35], [353, 0, 18, 35]];

function bodyFrame(img, cell, x, feet, scale, flipX) {
    if (!img.naturalWidth) return null;
    const [sx, sy, sw, sh, anchor] = cell;
    const scaleX = scale * .92;
    return { img, sx, sy, sw, sh, flipX, dx:x-(flipX ? sw-anchor : anchor)*scaleX,
        dy:feet-sh*scale, dw:sw*scaleX, dh:sh*scale };
}

export function protoThrowFrame(index, x, feet, scale, dir) {
    return bodyFrame(throwSheet, throwCells[index], x, feet, scale, dir > 0);
}

export function protoJumpFrame(index, x, feet, scale, dir) {
    return bodyFrame(jumpSheet, jumpCells[index], x, feet, scale, dir < 0);
}

export function protoRunShotFrame(index,x,feet,scale,dir,withoutShield) {
    const [left,right,anchor] = runShotCells[index%runShotCells.length];
    return bodyFrame(withoutShield?runShotUnshielded:runShot,[left,0,right-left+1,44,anchor],x,feet,scale,dir<0);
}

export function protoHeavyBlockFrame(index,x,feet,scale,dir) {
    return bodyFrame(heavyBlock,index===0?[3,0,40,42,19]:[51,0,50,42,22],x,feet,scale,dir<0);
}

export function protoSlideFrame(index,x,feet,scale,dir) {
    return bodyFrame(slideSheet,slideCells[index],x,feet,scale,dir<0);
}

export function protoUnshieldedFrame(frame, x, feet, scale, dir, cells) {
    const img = unshielded[frame?.key];
    if (!img || !cells) return null;
    const [sx,,sw,,anchor] = cells[frame.frame];
    const center = frame.key==='protoIdle' ? [22,23,22,22,22][frame.frame] : anchor;
    return bodyFrame(img,[sx,0,sw,img.naturalHeight,center],
        x,feet,scale,frame.key==='protoCharge'?dir>0:dir<0);
}

export function protoStrikeFrame(index, x, feet, scale, dir) {
    return bodyFrame(strikeSheet, strikeCells[index], x, feet, scale, dir < 0);
}

export function protoFlyingShieldFrame(age, x, y, scale, dir, diagonal) {
    if (!shieldSheet.naturalWidth) return null;
    if (!diagonal && discSheet.naturalWidth) {
        const edge = Math.floor(age/68)%2 === 1;
        const sh = edge ? 7 : 17;
        return {img:discSheet,sx:edge?52:4,sy:edge?4:5,sw:24,sh,flipX:dir<0,
            dx:x-12*scale,dy:y-sh*scale*.28,dw:24*scale,dh:sh*scale*.56};
    }
    const useRelease = age < 45 && releaseSheet.naturalWidth > 0;
    const [sx, sy, sw, sh] = useRelease ? [0,0,24,22] : spinCells[Math.floor(age/45)%spinCells.length];
    return {img:useRelease ? releaseSheet : shieldSheet,sx,sy,sw,sh,flipX:useRelease ? dir>0 : dir<0,
        dx:x-sw*scale/2,dy:y-sh*scale/2,dw:sw*scale,dh:sh*scale};
}
