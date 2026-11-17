from pathlib import Path
from PIL import Image

# Normaliza las hojas MM7 de Rock y SOBRESCRIBE los mismos nombres.
# El usuario conserva los originales fuera del proyecto.
ROOT = Path(__file__).resolve().parent
IMG_DIR = ROOT / 'assets' / 'images'
PURPLES = {(0x84,0x15,0x84),(0x47,0x00,0x47),(0xB4,0x40,0xB4),(0x64,0x06,0x64)}

# nombre: frames, ancho útil, alto útil, layout
# "shared2": 2 px iniciales y luego frame + 2 px (caso normal de estas hojas)
# "boxed2": cada frame ocupa [2 px margen + contenido + 2 px margen]
SHEETS = {
 'rock_intro.png':       (6,48,48,'shared2'),
 'rock_idle.png':        (4,48,48,'boxed2'),   # esta hoja es la excepción: 208 px
 'rock_run.png':         (10,48,48,'shared2'),
 'rock_jump.png':        (6,48,64,'shared2'),
 'rock_dash.png':        (4,56,56,'shared2'),
 'rock_fire.png':        (4,56,48,'shared2'),
 'rock_runfire.png':     (10,56,48,'shared2'),
 'rock_jumpfire.png':    (6,56,64,'shared2'),
 'rock_charge_shot.png': (5,56,48,'shared2'),
 'rock_slash_claw.png':  (4,56,48,'shared2'),
 'rock_hit.png':         (1,48,56,'boxed2'),
 'rock_air_hit.png':     (1,48,64,'boxed2'),
}

def alpha_purples(im):
 im=im.convert('RGBA'); p=im.load()
 for y in range(im.height):
  for x in range(im.width):
   r,g,b,a=p[x,y]
   if (r,g,b) in PURPLES: p[x,y]=(r,g,b,0)
 return im

def normalize(path,n,fw,fh,layout):
 im=Image.open(path).convert('RGBA')
 out_w=n*fw
 if im.size==(out_w,fh):
  out=alpha_purples(im); out.save(path); return im.size,out.size,'ya normalizada'
 expected=(2+n*(fw+2),fh) if layout=='shared2' else (n*(fw+4),fh)
 if im.size!=expected:
  raise ValueError(f'{path.name}: esperaba {expected} ({layout}) y llegó {im.size}')
 out=Image.new('RGBA',(out_w,fh),(0,0,0,0))
 for i in range(n):
  sx=2+i*(fw+2) if layout=='shared2' else 2+i*(fw+4)
  fr=alpha_purples(im.crop((sx,0,sx+fw,fh)))
  out.paste(fr,(i*fw,0))
 out.save(path)
 return im.size,out.size,'normalizada'

def main():
 print('ROCK SPRITE NORMALIZER')
 for name,spec in SHEETS.items():
  before,after,status=normalize(IMG_DIR/name,*spec)
  print(f'{name:24} {before!s:12} -> {after!s:12} {status}')
 print('Listo: mismos nombres, sin márgenes y con los 4 morados en alpha.')

if __name__=='__main__': main()
