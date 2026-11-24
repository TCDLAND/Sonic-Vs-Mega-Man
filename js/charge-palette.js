// X usa las muestras X4 de la hoja. Zero conserva piel, pelo y sable.
const xBase = 'e02820 602818 d07858 d8a888 30c0a0 188868 204860 b8c0d0 9098a8 506078 283038 3880d8 3068c8 2040a8 203078';
const xCharge = [
    '3040f0 285080 6080d8 a0c0f0 48d8f8 1880a8 286090 c0f0f8 88b0c0 407890 3050a0 58b8f8 4898f8 3070d8 2850b0',
    '28e830 187040 58d078 98e8b8 40f0d0 109878 188050 b8f8e8 80b8a8 287058 209040 48f8a8 38e888 20c860 18a040',
    'e82830 701840 d05078 e898b8 c038b8 981078 801850 d0a0d0 b880a8 803868 902040 b04890 b03890 b02060 a81840',
    'b87810 785820 b87058 d0c090 d8b858 987010 704028 e0d0c0 b8a880 806838 786828 a8a860 b89050 906038 906020'
];
const zeroBase = '600000 900000 f01000 e86868 202848 606880 a8b0c8 f0f0f0';
const zeroCharge = [
    '303070 404898 7078f0 a8b0ff 203058 506890 98b8e0 d8f4ff',
    '084040 186868 28c090 90f0c8 203850 487888 98d0d0 d8fff0',
    '603820 986010 f8c028 f8e898 403020 886838 c8a870 fff4c0'
];
const split = s => s.split(' ').map(value => Number.parseInt(value,16));
function pairs(base, levels) {
    const colors = split(base);
    return levels.map(row => {
        const mappedColors = split(row);
        return new Map(colors.map((color, index) => [color, mappedColors[index]]));
    });
}
const palettes = { x: pairs(xBase,xCharge), zero: pairs(zeroBase,zeroCharge) };
const cache = new WeakMap();

export function chargedSpriteFrame(frame, id, level, time) {
    if (Math.floor(time / 95) % 2 === 0) return frame;
    const palette = palettes[id]?.[level-1];
    if (!palette) return frame;
    const key = [id,level,frame.sx,frame.sy,frame.sw,frame.sh].join(':');
    let variants = cache.get(frame.img);
    if (!variants) { variants = new Map(); cache.set(frame.img, variants); }
    if (!variants.has(key)) {
        const image=document.createElement('canvas');
        image.width=frame.sw;image.height=frame.sh;
        const ctx=image.getContext('2d',{willReadFrequently:true});
        ctx.imageSmoothingEnabled=false;
        ctx.drawImage(frame.img,frame.sx,frame.sy,frame.sw,frame.sh,0,0,frame.sw,frame.sh);
        const data=ctx.getImageData(0,0,frame.sw,frame.sh), bytes=data.data;
        for(let i=0;i<bytes.length;i+=4){
            if(!bytes[i+3]) continue;
            const target=palette.get((bytes[i]<<16)|(bytes[i+1]<<8)|bytes[i+2]);
            if(target===undefined) continue;
            bytes[i]=target>>16;bytes[i+1]=(target>>8)&255;bytes[i+2]=target&255;
        }
        ctx.putImageData(data,0,0);
        variants.set(key,image);
    }
    return {...frame,img:variants.get(key),sx:0,sy:0};
}
