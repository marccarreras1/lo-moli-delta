"""
Olivar real a partir de la foto de dron de la propiedad (16/10/2026). Las fotos NO están en el repositorio.

    python3 -I scripts/olivar.py <foto-dron.jpg> <foto-dron-con-el-camino-en-rojo.jpg> <carpeta-de-trabajo>

1. Detecta las copas (verde grisáceo sobre la tierra rojiza) dentro del olivar y quita casa, piscina y algarrobo.
2. Ajusta la homografía imagen → suelo: las esquinas del tejado deben dar 16,33 × 5,22 m y la separación entre olivos
   vecinos debe ser uniforme en toda la foto (el olivar está plantado en marco regular).
3. Pasa cada copa a metros (con su diámetro), fusiona detecciones de la misma copa y saca el eje del camino marcado en rojo.
4. Escribe src/data/olivar.ts.
Necesita numpy, scipy y Pillow.
"""
import sys
FOTO, FOTO_CAMINO, S = sys.argv[1], sys.argv[2], sys.argv[3].rstrip('/') + '/'

# ---------- 1. detección
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi
src=Image.open(FOTO).convert('RGB')
im=np.asarray(src).astype(int); h,w,_=im.shape
R,G,B=im[...,0],im[...,1],im[...,2]
lum=(R+G+B)/3
veg=((R-G)<6)&(lum>55)&(lum<215)&((G-B)>-5)
veg=ndi.binary_opening(veg,iterations=1)
# zona del olivar: por debajo del borde con los campos y a la izquierda del muro de piedra
yy,xx=np.mgrid[0:h,0:w]
top=np.interp(xx,[0,600,1280,2000,2576],[520,345,205,85,0])
right=np.interp(yy,[840,1449],[2576,2290])
zona=(yy>top)&(xx<right)
# casa, piscina y algarrobo (ya modelados) fuera
for x0,y0,x1,y1 in [(1000,920,1400,1250),(660,1120,780,1230),(860,720,1150,1010)]:
    zona[y0:y1,x0:x1]=False
veg&=zona
peaks=[]
bands=[(0,350,8,34),(350,600,11,46),(600,850,14,58),(850,1100,17,70),(1100,1449,20,82)]
for y0,y1,sg,win in bands:
    pad=60
    a=max(0,y0-pad); b=min(h,y1+pad)
    sm=ndi.gaussian_filter(veg[a:b].astype(float),sg)
    mx=ndi.maximum_filter(sm,size=win)
    pk=(sm==mx)&(sm>0.30)
    lab,n=ndi.label(pk)
    cs=ndi.center_of_mass(pk,lab,range(1,n+1))
    for cy,cx in cs:
        Y=cy+a
        if y0<=Y<y1: peaks.append((Y,cx,float(sm[int(cy),int(cx)])))
peaks=np.array(peaks)
print('olivos detectados',len(peaks))
im2=src.copy(); d=ImageDraw.Draw(im2)
for y,x,v in peaks: d.ellipse([x-10,y-10,x+10,y+10],outline=(255,0,0),width=5)
im2.resize((1288,725)).save(S+'picos.png')
np.save(S+'picos.npy',peaks)

# ---------- 2. ajuste de la homografía
import numpy as np, json
from scipy.spatial import cKDTree
from scipy.optimize import least_squares
pk=np.load(S+'picos.npy')
P=pk[:,[1,0]]
# quita duplicados en la imagen: fusiona picos muy cercanos para la escala local (≤ 0,45 × separación típica de la zona)
ti=cKDTree(P); di,ii=ti.query(P,k=2)
keep=np.ones(len(P),bool)
for k,(d,j) in enumerate(zip(di[:,1],ii[:,1])):
    loc=np.median(di[np.hypot(*(P-P[k]).T)<250,1])
    if d<0.55*loc and keep[j] and j<k: keep[k]=False
P=P[keep]; print('picos para el ajuste',len(P))
L,W=16.33,5.22
roof=np.array([(1022,1000),(1115,938),(1260,1172),(1370,1112)],float)
house=np.array([(L,0),(L,W),(0,0),(0,W)],float)
def H_from(img, gnd):
    A=[]
    for (x,y),(X,Y) in zip(img,gnd):
        A.append([x,y,1,0,0,0,-X*x,-X*y,-X]); A.append([0,0,0,x,y,1,-Y*x,-Y*y,-Y])
    _,_,V=np.linalg.svd(np.array(A,float)); H=V[-1].reshape(3,3); return H/H[2,2]
H0=H_from(roof,house)
def apply(H,pts):
    v=np.c_[pts,np.ones(len(pts))]@H.T; return v[:,:2]/v[:,2:3]
# vecinos fijados en la imagen (los 4 más próximos de cada pico)
tI=cKDTree(P); dI,iI=tI.query(P,k=5)
def res(p):
    H=np.append(p,1).reshape(3,3)
    g=apply(H,P)
    if not np.all(np.isfinite(g)): return np.full(len(P)*4+8,1e3)
    d=np.hypot(*(g[iI[:,1:]]-g[:,None,:]).transpose(2,0,1))  # (n,4)
    ld=np.log(np.maximum(d,1e-3))
    r1=(ld-np.median(ld)).ravel()*0.5
    r2=(apply(H,roof)-house).ravel()*3.0
    return np.r_[r1,r2]
sol=least_squares(res,(H0/H0[2,2]).ravel()[:8],x_scale='jac',max_nfev=4000)
H=np.append(sol.x,1).reshape(3,3)
g=apply(H,P); tg=cKDTree(g); dg,_=tg.query(g,k=2)
print('casa reproyectada (m):',np.round(apply(H,roof),2).tolist())
for name,sel in [('izq abajo',(P[:,0]<900)&(P[:,1]>700)),('der abajo',(P[:,0]>1500)&(P[:,1]>700)),('izq arriba',(P[:,0]<1100)&(P[:,1]<500)),('der arriba',(P[:,0]>1600)&(P[:,1]<500))]:
    print(f'{name:12s} vecino suelo {np.median(dg[sel,1]):5.1f} m')
np.save(S+'H.npy',H)
for name,pt in [('piscina diam',None)]:
    a,b=apply(H,np.array([[675,1170],[760,1170]])); print('piscina ≈',round(float(np.hypot(*(a-b))),1),'m')

# ---------- 3. copas, camino y comprobación
import numpy as np, json
from PIL import Image, ImageDraw
from scipy import ndimage as ndi
from scipy.spatial import cKDTree
H=np.load(S+'H.npy'); Hi=np.linalg.inv(H)
def ap(x,y):
    v=H@np.array([x,y,1.0]); return v[:2]/v[2]
def toimg(x,y):
    v=Hi@np.array([x,y,1.0]); return v[:2]/v[2]
def pxm(x,y):  # píxeles por metro en ese punto
    a=ap(x,y); b=ap(x+1,y); c=ap(x,y+1); return 1/np.sqrt(abs((b-a)[0]*(c-a)[1]-(b-a)[1]*(c-a)[0]))
s_house=pxm(1190,1080)
def ground(x,y):  # punto del suelo: la referencia está a ≈3,5 m (tejado); se compensa la paralaje vertical
    return ap(x, y-45*pxm(x,y)/s_house)
src=Image.open(FOTO).convert('RGB')
im=np.asarray(src).astype(int); h,w,_=im.shape
R,G,B=im[...,0],im[...,1],im[...,2]; lum=(R+G+B)/3
veg=ndi.binary_opening(((R-G)<6)&(lum>55)&(lum<215)&((G-B)>-5),iterations=1)
pk=np.load(S+'picos.npy')
pts=[]
for y,x,_ in pk:
    g=ap(x,y); k=pxm(x,y); rpx=int(max(12,3.0*k))
    y0,y1,x0,x1=max(0,int(y)-rpx),min(h,int(y)+rpx),max(0,int(x)-rpx),min(w,int(x)+rpx)
    yy,xx=np.mgrid[y0:y1,x0:x1]; circ=(yy-y)**2+(xx-x)**2<=rpx**2
    area=veg[y0:y1,x0:x1][circ].sum()/k**2
    pts.append([float(g[0]),float(g[1]),float(np.clip(2*np.sqrt(area/np.pi)*1.2,3,7.5))])
changed=True
while changed:
    changed=False; a=np.array(pts); t=cKDTree(a[:,:2]); pr=list(t.query_pairs(3.0))
    if pr:
        i,j=min(pr,key=lambda p: np.hypot(*(a[p[0],:2]-a[p[1],:2])))
        m=[(pts[i][0]+pts[j][0])/2,(pts[i][1]+pts[j][1])/2,min(7.5,max(pts[i][2],pts[j][2])*1.08)]
        pts=[p for k2,p in enumerate(pts) if k2 not in (i,j)]+[m]; changed=True
a=np.array(pts); t=cKDTree(a[:,:2]); d,_=t.query(a[:,:2],k=2)
print('olivos',len(a),'vecino mediana',np.median(d[:,1]).round(1),'diam mediana',np.median(a[:,2]).round(1))
json.dump([[round(p[0],1),round(p[1],1),round(p[2],1)] for p in pts],open(S+'olivos.json','w'))
# camino (línea roja) y entrada
im2=np.asarray(Image.open(FOTO_CAMINO).convert('RGB')).astype(int)
kk=2576/im2.shape[1]; m=(im2[...,0]>200)&(im2[...,1]<110)&(im2[...,2]<90)&(im2[...,0]-im2[...,1]>120)
cent=[]
for y in range(0,im2.shape[0],6):
    xs=np.nonzero(m[y])[0]
    if len(xs)<2: continue
    gr=np.split(xs,np.nonzero(np.diff(xs)>6)[0]+1); cs=[g.mean() for g in gr]
    if len(cs)>=2:
        l,r=min(cs),max(cs); gl,gr2=ground(l*kk,y*kk),ground(r*kk,y*kk); cent.append(((gl+gr2)/2).tolist()+[float(np.hypot(*(gl-gr2)))])
cent=np.array(cent)[::-1]  # de la casa a la entrada
# simplifica a puntos cada ≈5 m
path=[cent[0,:2]]
for p in cent[1:,:2]:
    if np.hypot(*(p-path[-1]))>=5: path.append(p)
if np.hypot(*(cent[-1,:2]-path[-1]))>1: path.append(cent[-1,:2])
path=[[round(float(x),1),round(float(y),1)] for x,y in path]
L=16.33; W=5.22
print('camino',path)
print('longitud',round(sum(np.hypot(path[i+1][0]-path[i][0],path[i+1][1]-path[i][1]) for i in range(len(path)-1)),1),'ancho mediano',np.median(cent[:,2]).round(1))
print('entrada a',round(float(np.hypot(path[-1][0]-L,path[-1][1]-W)),1),'m de la esquina (L,W)')
json.dump(path,open(S+'camino.json','w'))
# comprobación visual
d2=ImageDraw.Draw(src)
for x,y,dm in pts:
    c=toimg(x,y); e=toimg(x+dm/2,y); r=max(6,float(np.hypot(*(e-c))))
    d2.ellipse([c[0]-r,c[1]-r*0.8,c[0]+r,c[1]+r*0.8],outline=(255,40,40),width=4)
def gimg(x,y):  # suelo -> imagen
    c=toimg(x,y); return (c[0], c[1]+45*pxm(*c)/s_house)
d2.line([gimg(*p) for p in path],fill=(255,200,0),width=10)
d2.polygon([gimg(*p) for p in [(0,0),(L,0),(L,W),(0,W)]],outline=(0,200,255))
src.resize((1288,725)).save(S+'olivos-check.png')

# ---------- 4. datos
import numpy as np, json
from scipy.spatial import ConvexHull
pts=np.array(json.load(open(S+'olivos.json')))
hull=ConvexHull(pts[:,:2]); hp=pts[hull.vertices,:2]
c=hp.mean(0); hp=c+(hp-c)*(1+3.0/np.linalg.norm(hp-c,axis=1))[:,None]
path=json.load(open(S+'camino.json'))
lines=["/**",
" * Olivar real alrededor de la casa, sacado de la foto de dron de la propiedad (16/10/2026): cada copa detectada en la foto",
" * y pasada a metros con una homografía ajustada a las medidas de la casa (16,33 × 5,22 m) y a la separación regular",
" * del olivar. [x, y, diámetro de copa en m]. Precisión de ±1–2 m cerca de la casa y peor al fondo. Generado por",
" * scripts/olivar.py; no editar a mano.",
" */",
"import type { Vec2 } from './types';",
"",
f"export const OLIVOS_FOTO: [number, number, number][] = {json.dumps([[round(a,1),round(b,1),round(d,1)] for a,b,d in pts.tolist()])};",
"",
"/** zona del suelo que cubre la foto: dentro solo van los olivos detectados; fuera, el olivar en retícula */",
f"export const ZONA_FOTO: Vec2[] = {json.dumps([[round(a,1),round(b,1)] for a,b in hp.tolist()])};",
"",
"/** eje del camino de acceso marcado por la propiedad sobre la foto (de la casa a la entrada de la finca) */",
f"export const CAMINO_FOTO: Vec2[] = {json.dumps(path)};",
""]
open('src/data/olivar.ts','w').write("\n".join(lines))
print(len(pts), len(hp))
