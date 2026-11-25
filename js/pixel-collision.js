// Pixel-perfect helpers for sprite-based hurtboxes/hitboxes.
// A frame descriptor uses WORLD coordinates (camera-independent):
// { img,sx,sy,sw,sh, dx,dy,dw,dh, flipX }
const cache = new WeakMap();
const cvs = document.createElement('canvas');
const cctx = cvs.getContext('2d', { willReadFrequently: true });

function alphaData(frame) {
  const img = frame?.img;
  if (!img || frame.sw <= 0 || frame.sh <= 0) return null;
  const isCanvas = img instanceof HTMLCanvasElement;
  // Las variantes de paleta se guardan como lienzos en lugar de imágenes.
  if (isCanvas ? !img.width || !img.height : !img.complete || !img.naturalWidth) return null;
  let byImage = cache.get(img);
  if (!byImage) { byImage = new Map(); cache.set(img, byImage); }
  const key = `${frame.sx}|${frame.sy}|${frame.sw}|${frame.sh}`;
  if (byImage.has(key)) return byImage.get(key);
  cvs.width = Math.max(1, Math.ceil(frame.sw));
  cvs.height = Math.max(1, Math.ceil(frame.sh));
  cctx.clearRect(0,0,cvs.width,cvs.height);
  cctx.imageSmoothingEnabled = false;
  cctx.drawImage(img, frame.sx, frame.sy, frame.sw, frame.sh, 0,0,cvs.width,cvs.height);
  try {
    const d = cctx.getImageData(0,0,cvs.width,cvs.height).data;
    const out = { data:d, w:cvs.width, h:cvs.height };
    byImage.set(key,out); return out;
  } catch { return null; }
}

function parseHex(hex){
  const h=String(hex).replace('#','');
  return [parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)];
}
function colorMatches(list,r,g,b){
  if(!list?.length) return false;
  for(const c of list){ const [cr,cg,cb]=parseHex(c); if(r===cr&&g===cg&&b===cb) return true; }
  return false;
}

function alphaAt(frame, worldX, worldY) {
  if (worldX < frame.dx || worldX >= frame.dx + frame.dw || worldY < frame.dy || worldY >= frame.dy + frame.dh) return 0;
  const a = alphaData(frame); if (!a) return 0;
  let u = (worldX - frame.dx) / frame.dw;
  const v = (worldY - frame.dy) / frame.dh;
  if (frame.flipX) u = 1 - u;
  const px = Math.max(0, Math.min(a.w-1, Math.floor(u*a.w)));
  const py = Math.max(0, Math.min(a.h-1, Math.floor(v*a.h)));
  const i=(py*a.w+px)*4;
  const r=a.data[i],g=a.data[i+1],b=a.data[i+2],alpha=a.data[i+3];
  if(alpha===0) return 0;
  if(frame.includeColors?.length && !colorMatches(frame.includeColors,r,g,b)) return 0;
  if(frame.excludeColors?.length && colorMatches(frame.excludeColors,r,g,b)) return 0;
  return alpha;
}

export function opaqueInRect(frame, rect, step=2) {
  if (!frame) return false;
  const x1=Math.max(frame.dx,rect.x), y1=Math.max(frame.dy,rect.y);
  const x2=Math.min(frame.dx+frame.dw,rect.x+rect.w), y2=Math.min(frame.dy+frame.dh,rect.y+rect.h);
  if (x1>=x2 || y1>=y2) return false;
  for(let y=y1;y<y2;y+=step) for(let x=x1;x<x2;x+=step) if(alphaAt(frame,x,y)>0) return true;
  return false;
}

export function opaqueFramesOverlap(a,b,regionA=null,step=2){
  if(!a||!b) return false;
  let ax=a.dx, ay=a.dy, aw=a.dw, ah=a.dh;
  if(regionA){
    // normalized region BEFORE flip; flip is handled by alphaAt, but the world-side region must mirror too.
    let rx=regionA.x, rw=regionA.w;
    if(a.flipX) rx=1-rx-rw;
    ax=a.dx+rx*a.dw; ay=a.dy+regionA.y*a.dh; aw=rw*a.dw; ah=regionA.h*a.dh;
  }
  const x1=Math.max(ax,b.dx), y1=Math.max(ay,b.dy);
  const x2=Math.min(ax+aw,b.dx+b.dw), y2=Math.min(ay+ah,b.dy+b.dh);
  if(x1>=x2||y1>=y2) return false;
  for(let y=y1;y<y2;y+=step){
    for(let x=x1;x<x2;x+=step){
      if(alphaAt(a,x,y)>0 && alphaAt(b,x,y)>0) return true;
    }
  }
  return false;
}

export function opaqueRegionInRect(frame, region, rect, step=2){
  if(!frame) return false;
  let rx=region?.x??0, ry=region?.y??0, rw=region?.w??1, rh=region?.h??1;
  if(frame.flipX) rx=1-rx-rw;
  const regionRect={x:frame.dx+rx*frame.dw,y:frame.dy+ry*frame.dh,w:rw*frame.dw,h:rh*frame.dh};
  const x1=Math.max(regionRect.x,rect.x), y1=Math.max(regionRect.y,rect.y);
  const x2=Math.min(regionRect.x+regionRect.w,rect.x+rect.w), y2=Math.min(regionRect.y+regionRect.h,rect.y+rect.h);
  if(x1>=x2||y1>=y2) return false;
  for(let y=y1;y<y2;y+=step) for(let x=x1;x<x2;x+=step) if(alphaAt(frame,x,y)>0) return true;
  return false;
}
