// Cosmetic two-palette system. Sprite sheets stay immutable; recolored canvases
// are generated lazily and cached. Alpha is copied byte-for-byte.
const rules = {
  sonic: [{from:[195,255],to:128},{from:[345,360],to:48},{from:[0,15],to:48},{from:[70,160],to:220}],
  shadow: [{from:[345,360],to:48},{from:[0,18],to:48},{from:[0,360],to:0,neutralize:[0.04,0.24],light:0.72}],
  tails: [{from:[15,58],to:195},{from:[345,360],to:48},{from:[0,15],to:48},{from:[195,255],to:125}],
  knuckles: [{from:[345,360],to:30},{from:[0,18],to:30},{from:[75,165],to:175}],
  'metal-sonic': [{from:[195,255],to:0,neutralize:[0.08,0.72],light:-0.12},{from:[35,68],to:0}],
  silver: [{from:[175,220],to:135},{from:[35,65],to:0,neutralize:[0.55,0.95],light:-0.15}],
  eggman: [{from:[345,360],to:125},{from:[0,18],to:125}],
  chaos: [{from:[175,255],to:0,neutralize:[0.08,0.75],light:-0.27},{from:[70,165],to:0}],
  emerl: [{from:[35,68],to:215},{from:[15,40],to:0,neutralize:[0.62,0.94],light:0.14}],
  espio: [{from:[255,325],to:350}],
  // Mega Man palettes use exact source swatches. Hue-range transforms also
  // recolored skin, eyes and linework on several of these small sprite sheets.
  // Swatch pairs are applied simultaneously and alpha/outline colors stay intact.
  rock: { swatches: [
    ['003060','A40712'], ['0040D0','E20606'], ['0088F0','C0C0C0'],
    ['1890A8','707070'], ['30C0D8','C0C0C0'], ['90D8F8','F0F0F0']
  ] },
  protoman: { swatches: [
    ['A40712','003060'], ['E20606','0040D0'], ['F9250F','0088F0'],
    ['707070','0040D0'], ['C0C0C0','90D8F8'],
    // Jump/run-shot sprites still use Proto's older brown-red ramp.
    ['603010','003060'], ['A03000','0040D0'], ['F03000','0088F0'],
    // The flying disc has an independent red palette in its own sheet.
    ['683010','003060'], ['A83008','0040D0'], ['F03808','0088F0']
  ] },
  x: { swatches: [
    ['203078','600000'], ['2040A8','900000'], ['204860','600000'],
    ['3068C8','F01000'], ['3880D8','F0F0F0'], ['E02820','28B858']
  ] },
  zero: { swatches: [
    ['600000','002868'], ['900000','0040D0'], ['F01000','0088F0'],
    ['606880','406088'], ['A8B0C8','90B0D0']
  ] },
  wily: [{from:[0,360],to:42,neutralize:[0.72,0.99],light:-0.12}],
  bass: { swatches: [
    ['504850','600000'], ['505060','600000'], ['686870','900000'],
    ['E8B840','F0F0F0'], ['F0A000','FFFFFF'], ['F0C000','F0F0F0'], ['FFA800','FFFFFF'],
    ['C870C8','00A070'], ['803888','006040'], ['8048B8','008060'],
    ['B040B0','00C080'], ['D898D8','80F0D0']
  ] },
  'megaman-zero': { swatches: [
    ['981040','581878'], ['9C1042','7030A0'], ['D02058','A040D0'],
    ['D6215A','C060D8'], ['F85060','E080E8'], ['FF5263','E080E8'],
    ['D88010','A040D0'], ['F8B800','D080E0'], ['FFBD00','E0A0E8'],
    ['F8E880','F0C8F0']
  ] }
};

const exactSwatches = new Map();
const baseSwatches = new Map();
for (const [id, profile] of Object.entries(rules)) {
  if (profile.swatches) exactSwatches.set(id, new Map(profile.swatches.map(([from,to]) => [parseInt(from,16),parseInt(to,16)])));
}
baseSwatches.set('protoman', new Map([
  ['603010','A40712'], ['A03000','E20606'], ['F03000','F9250F']
].map(([from,to]) => [parseInt(from,16),parseInt(to,16)])));

const cache = new Map();
const imageIds = new WeakMap();
let nextImageId = 1;
let cachedBytes = 0;
const MAX_CACHED_BYTES = 24 * 1024 * 1024;
let renderPalette = null;
let originalDrawImage = null;

function rgbToHsl(r,g,b) {
  r/=255;g/=255;b/=255;const max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min;
  let h=0,s=0,l=(max+min)/2;
  if(d){s=d/(1-Math.abs(2*l-1));switch(max){case r:h=((g-b)/d)%6;break;case g:h=(b-r)/d+2;break;default:h=(r-g)/d+4;}h*=60;if(h<0)h+=360;}
  return [h,s,l];
}
function hslToRgb(h,s,l) {
  const c=(1-Math.abs(2*l-1))*s,x=c*(1-Math.abs((h/60)%2-1)),m=l-c/2;
  let rgb=h<60?[c,x,0]:h<120?[x,c,0]:h<180?[0,c,x]:h<240?[0,x,c]:h<300?[x,0,c]:[c,0,x];
  return rgb.map(v=>Math.max(0,Math.min(255,Math.round((v+m)*255))));
}
function remapHueRegion(img, characterId, sx, sy, sw, sh, paletteIndex) {
  if (!img || !rules[characterId] || !img.width || !img.height || sw<=0 || sh<=0 || sw*sh*4>MAX_CACHED_BYTES) return null;
  let imageId=imageIds.get(img);if(!imageId){imageId=nextImageId++;imageIds.set(img,imageId);}
  const key=`${imageId}:${characterId}:${paletteIndex}:${sx}:${sy}:${sw}:${sh}`;
  const cached=cache.get(key);
  if(cached){cache.delete(key);cache.set(key,cached);return cached.canvas;}
  const c=document.createElement('canvas');c.width=Math.max(1,Math.ceil(sw));c.height=Math.max(1,Math.ceil(sh));
  const x=c.getContext('2d',{willReadFrequently:true});x.imageSmoothingEnabled=false;x.drawImage(img,sx,sy,sw,sh,0,0,c.width,c.height);
  try {
    const pixels=x.getImageData(0,0,c.width,c.height),data=pixels.data,profile=rules[characterId];
    const exact=paletteIndex===1?exactSwatches.get(characterId):baseSwatches.get(characterId);
    for(let i=0;i<data.length;i+=4){if(!data[i+3])continue;
      if(exact){
        const replacement=exact.get((data[i]<<16)|(data[i+1]<<8)|data[i+2]);
        if(replacement!==undefined){data[i]=(replacement>>16)&255;data[i+1]=(replacement>>8)&255;data[i+2]=replacement&255;}
        continue;
      }
      const [h,s,l]=rgbToHsl(data[i],data[i+1],data[i+2]);
      for(const rule of profile){
        const inHue=rule.from[0]<=rule.from[1] ? h>=rule.from[0]&&h<=rule.from[1] : h>=rule.from[0]||h<=rule.from[1];
        if(!inHue)continue;
        if(rule.lRange&&(l<rule.lRange[0]||l>=rule.lRange[1]))continue;
        if(rule.neutralize){if(l<rule.neutralize[0]||l>rule.neutralize[1])continue;const [r,g,b]=hslToRgb(rule.to,s*.1,Math.max(.02,Math.min(.98,l+(rule.light||0))));data[i]=r;data[i+1]=g;data[i+2]=b;}
        else if(s>.26){const [r,g,b]=hslToRgb(rule.to,s,Math.max(.02,Math.min(.98,l+(rule.light||0))));data[i]=r;data[i+1]=g;data[i+2]=b;}
        break;
      }
    }
    x.putImageData(pixels,0,0);
  } catch { return null; }
  const bytes=c.width*c.height*4;
  cache.set(key,{canvas:c,bytes});cachedBytes+=bytes;
  // A frame crop is cached instead of recoloring a whole atlas; the LRU cap
  // keeps animated sprites from growing the game's memory use indefinitely.
  while(cachedBytes>MAX_CACHED_BYTES&&cache.size>1){const oldest=cache.keys().next().value;cachedBytes-=cache.get(oldest).bytes;cache.delete(oldest);}
  return c;
}

export function installPaletteRendering(ctx) {
  if(originalDrawImage)return;
  originalDrawImage=ctx.drawImage;
  ctx.drawImage=function(image,...args){
    if(!renderPalette||!rules[renderPalette.id]||
        (renderPalette.index!==1&&!baseSwatches.has(renderPalette.id)))return originalDrawImage.call(this,image,...args);
    const sourceRect=args.length===8;
    const sx=sourceRect?args[0]:0,sy=sourceRect?args[1]:0;
    const sw=sourceRect?args[2]:(image?.naturalWidth||image?.width||0),sh=sourceRect?args[3]:(image?.naturalHeight||image?.height||0);
    const variant=remapHueRegion(image,renderPalette.id,sx,sy,sw,sh,renderPalette.index);
    if(!variant)return originalDrawImage.call(this,image,...args);
    if(sourceRect)return originalDrawImage.call(this,variant,0,0,variant.width,variant.height,...args.slice(4));
    return originalDrawImage.call(this,variant,...args);
  };
}
export function withCharacterPalette(id,index,draw) {
  const previous=renderPalette;renderPalette={id,index:index===1?1:0};
  try{return draw();}finally{renderPalette=previous;}
}
export function getSelectionPalette(selection,side) {
  const other=side==='p1'?'p2':'p1';
  const selected=selection.chars[selection[side+'Index']],opponent=selection.chars[selection[other+'Index']];
  let palette=selection[side+'Palette']===1?1:0;
  const game=window.__GAME__;
  if(game?.teamRosters?.every(roster=>Array.isArray(roster))){
    const ownIndex=side==='p1'?0:1,otherIndex=ownIndex^1;
    const mirrorIndex=game.teamRosters[otherIndex]?.indexOf(selected)??-1;
    if(mirrorIndex>=0&&palette===(game.teamPaletteRosters?.[otherIndex]?.[mirrorIndex]===1?1:0))return palette^1;
  }
  if(selection[other+'Confirmed']&&selected===opponent&&palette===selection[other+'Palette'])return palette^1;
  return palette;
}
