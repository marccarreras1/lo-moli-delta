"""
Olivar de la finca entera, el camino y la entrada a partir de la foto de dron de toda la parcela (propiedad, 17/10/2026)
y del lindero catastral (src/data/catastro.ts). La foto NO está en el repositorio.

    python3 -I scripts/olivar_finca.py <foto-dron-finca.jpg> <carpeta-de-trabajo> [<foto-cenital-casa.jpg>]

1. Homografía foto → suelo del modelo, ajustada con elementos a ras de suelo: las dos esquinas reconocibles (la de la
   puerta y la del muro con los invernaderos), los muros de piedra y el pie de los invernaderos sobre sus linderos
   (puntos tomados a mano en la foto, abajo), más la casa, el algarrobo y la piscina como anclajes junto a la casa.
2. Ortofoto de la parcela a 0,25 m/px y detección de copas (manchas oscuras sobre la tierra).
   Con la foto cenital de alrededor de la casa (opcional, 17/10/2026), los árboles de esa zona se toman de ella (más precisa).
3. Puerta pegada a la esquina, en el lindero lateral; camino de la zona de aparcamiento a la puerta por donde no hay árboles.
4. Escribe src/data/olivarFinca.ts.
Necesita numpy, scipy y Pillow.
"""
import json
import os
import re
import sys

import numpy as np
from PIL import Image
from scipy import ndimage as ndi
from scipy.optimize import least_squares

FOTO, S = sys.argv[1], sys.argv[2].rstrip('/') + '/'
CENITAL = sys.argv[3] if len(sys.argv) > 3 else None
ROOT = os.path.join(os.path.dirname(__file__), '..')
cat = open(os.path.join(ROOT, 'src/data/catastro.ts'), encoding='utf-8').read()
P = np.array(json.loads(re.search(r'PARCELA_CATASTRO[^=]*=.*?poligono: (\[\[.*?\]\])', cat).group(1)), float)
N = len(P)
L, W = 16.33, 5.22
HOUSE_C = np.array([L / 2, W / 2])
ALGARROBO = np.array([19.47, 1.22])

# ---------- 1. homografía (píxeles de la foto original, 2576 × 1449)
# La foto mira la parcela con la esquina de la puerta (vértice 13) abajo a la izquierda. El lindero más cercano a la casa
# (≈35 m, el largo y recto: vértices 0–1) es el pie de los invernaderos, arriba; el muro de la izquierda es el lindero corto
# (13–14–0) y el muro largo de abajo, el lindero de la puerta (13–12), que sigue fuera de la foto por la derecha.
ESQ_PUERTA_PX, ESQ_INVERNADERO_PX = (450, 1265), (194, 529)  # vértices 13 y 0
MURO_IZQ = [(330, 1250), (300, 1100), (258, 903), (205, 760)]  # lindero 13–14–0
MURO_BAJO = [(500, 1265), (800, 1205), (1040, 1160), (1450, 1078), (1935, 955), (2500, 840)]  # lindero 13–12
INVERNADERO = [(645, 470), (1032, 420), (1420, 368), (1610, 333)]  # lindero 0–1
# anclajes junto a la casa (posiciones del modelo; la piscina, de la foto de dron del olivar): la casa y la copa del
# algarrobo están elevadas (≈3,5 y ≈5 m), así que pesan menos que la piscina, que está en el suelo
CASA_PX, ALG_PX, PISCINA_PX = (1210, 535), (1290, 530), (1395, 545)
PISCINA = np.array([17.4, -14.2])
MARCO = np.array([(0, 0), (2576, 0), (0, 1449), (2576, 1449)], float)


def app(h, p):
    H = np.append(h, 1).reshape(3, 3)
    v = np.c_[p, np.ones(len(p))] @ H.T
    return v[:, :2] / v[:, 2:3], v[:, 2]


def dseg(p, a, b):
    ab = b - a
    t = np.clip(((p - a) @ ab) / (ab @ ab), 0, 1)
    return np.linalg.norm(p - a - t[:, None] * ab, axis=-1)


def dpoly(p, idx):
    return np.min([dseg(p, P[a], P[b]) for a, b in zip(idx[:-1], idx[1:])], axis=0)


def dlt(img, gnd):
    A = []
    for (x, y), (X, Y) in zip(img, gnd):
        A.append([x, y, 1, 0, 0, 0, -X * x, -X * y, -X])
        A.append([0, 0, 0, x, y, 1, -Y * x, -Y * y, -Y])
    _, _, V = np.linalg.svd(np.array(A, float))
    Hm = V[-1].reshape(3, 3)
    return (Hm / Hm[2, 2]).ravel()[:8]


def res(h):
    q, w = app(h, np.array([ESQ_PUERTA_PX, ESQ_INVERNADERO_PX], float))
    a_, _ = app(h, np.array([CASA_PX, ALG_PX, PISCINA_PX], float))
    r = [(q - P[[13, 0]]).ravel() * 2,
         (a_[0] - HOUSE_C) * 0.7, (a_[1] - ALGARROBO) * 0.4, (a_[2] - PISCINA) * 1.0,
         dpoly(app(h, np.array(MURO_IZQ, float))[0], [13, 14, 0]),
         dpoly(app(h, np.array(MURO_BAJO, float))[0], [13, 12, 11]),
         dpoly(app(h, np.array(INVERNADERO, float))[0], [0, 1])]
    _, wf = app(h, MARCO)
    r.append(np.minimum(wf * np.sign(w[0]), 0) * 1e4)  # cámara real: el horizonte, fuera de la foto
    return np.concatenate(r)


best = None
for f1 in (0.3, 0.5, 0.7):
    for f2 in (0.4, 0.6, 0.8):
        h0 = dlt([ESQ_PUERTA_PX, ESQ_INVERNADERO_PX, (1610, 333), (2500, 840)],
                 [P[13], P[0], P[0] + (P[1] - P[0]) * f1, P[13] + (P[12] - P[13]) * f2])
        s_ = least_squares(res, h0, max_nfev=4000)
        if best is None or s_.cost < best.cost:
            best = s_
h = best.x
H = np.append(h, 1).reshape(3, 3)
r = res(h)
casa, alg, pis = app(h, np.array([CASA_PX, ALG_PX, PISCINA_PX], float))[0]
print('ajuste: rms', round(float(np.sqrt(np.mean(r ** 2))), 2), 'm; casa en', np.round(casa, 1).tolist(), '(centro', HOUSE_C.tolist(),
      '), algarrobo en', np.round(alg, 1).tolist(), ', piscina en', np.round(pis, 1).tolist(), '(', PISCINA.tolist(), ')')
for nm, pts, idx in [('muro izquierdo', MURO_IZQ, [13, 14, 0]), ('muro de abajo', MURO_BAJO, [13, 12, 11]), ('invernaderos', INVERNADERO, [0, 1])]:
    print(f'  {nm}: a', np.round(dpoly(app(h, np.array(pts, float))[0], idx), 1).tolist(), 'm del lindero')
np.save(S + 'H.npy', H)

# ---------- 2. cámara (para corregir la paralaje de las copas) y ortofoto
Gm = np.linalg.inv(H)
Gm = Gm / Gm[2, 2]
CX, CY = 1288, 724.5
fs = np.linspace(800, 6000, 5201)


def ortho_err(f):
    Mk = np.linalg.inv(np.array([[f, 0, CX], [0, f, CY], [0, 0, 1]])) @ Gm
    m1, m2 = Mk[:, 0], Mk[:, 1]
    return abs(m1 @ m2) / (np.linalg.norm(m1) * np.linalg.norm(m2)) + abs(np.linalg.norm(m1) - np.linalg.norm(m2)) / np.linalg.norm(m1)


F = fs[int(np.argmin([ortho_err(f) for f in fs]))]
Mk = np.linalg.inv(np.array([[F, 0, CX], [0, F, CY], [0, 0, 1]])) @ Gm
lam = 1 / np.linalg.norm(Mk[:, 0])
r1, r2, tt = Mk[:, 0] * lam, Mk[:, 1] * lam, Mk[:, 2] * lam
CAM = -np.c_[r1, r2, np.cross(r1, r2)].T @ tt
CAM[2] = abs(CAM[2])
print('cámara: focal', round(float(F)), 'px; en', np.round(CAM, 1).tolist(), '(x, y, altura en m)')


def pie(g, alto):
    """posición en planta de un punto a `alto` m cuya imagen cae en g al proyectarla al suelo"""
    return CAM[:2] + (np.asarray(g) - CAM[:2]) * (CAM[2] - alto) / CAM[2]


RES = 0.25
x0, y0 = P.min(0) - 4
x1, y1 = P.max(0) + 4
OW, OH = int((x1 - x0) / RES), int((y1 - y0) / RES)
T = np.array([[RES, 0, x0], [0, RES, y0], [0, 0, 1.0]])
Mo = Gm @ T
Mo = Mo / Mo[2, 2]
src = Image.open(FOTO).convert('RGB')
orto = src.transform((OW, OH), Image.PERSPECTIVE, tuple(Mo.ravel()[:8]), Image.BILINEAR)
orto.save(S + 'orto.jpg', quality=88)

# ---------- 3. copas: manchas oscuras sobre la tierra de la ortofoto
o = np.asarray(orto).astype(float)
lum = o.mean(2)
valid = o.sum(2) > 30
yy, xx = np.mgrid[0:OH, 0:OW]
gx, gy = x0 + (xx + 0.5) * RES, y0 + (yy + 0.5) * RES


def inside(px, py, poly):
    c = np.zeros(px.shape, bool)
    for i in range(len(poly)):
        (xa, ya), (xb, yb) = poly[i], poly[i - 1]
        c ^= ((ya > py) != (yb > py)) & (px < (xb - xa) * (py - ya) / (yb - ya + 1e-12) + xa)
    return c


dentro = inside(gx, gy, P) & valid
suelo = ndi.median_filter(np.where(dentro, lum, np.nan if False else lum), size=61)
oscuro = (lum < 0.84 * suelo) & dentro
oscuro = ndi.binary_opening(oscuro, iterations=1)
# fuera: la casa y su entorno inmediato, la piscina y el algarrobo (ya modelados)
for (ax, ay, bx, by) in [(-3, -3, 19.5, 8.5)]:
    oscuro &= ~((gx > ax) & (gx < bx) & (gy > ay) & (gy < by))
oscuro &= np.hypot(gx - PISCINA[0], gy - PISCINA[1]) > 2.5
# árboles medidos por la propiedad (ya en el modelo): algarrobo y los dos olivos de la cristalera
for (tx, ty, rr) in [(*ALGARROBO, 5.0), (13.38, -3.95, 3.0), (8.37, -4.6, 2.5)]:
    oscuro &= np.hypot(gx - tx, gy - ty) > rr
sm = ndi.gaussian_filter(oscuro.astype(float), 5)
pk = (sm == ndi.maximum_filter(sm, size=15)) & (sm > 0.27)
lab, n = ndi.label(pk)
cen = np.array(ndi.center_of_mass(pk, lab, range(1, n + 1)))
# tamaño de copa: superficie oscura de la celda de cada pico (cuenca del suavizado)
mk = np.zeros_like(lab)
for i, (cy_, cx_) in enumerate(cen):
    mk[int(cy_), int(cx_)] = i + 1
cel = ndi.distance_transform_edt(mk == 0, return_distances=False, return_indices=True)
cel = mk[cel[0], cel[1]]
area = ndi.sum(oscuro, cel, range(1, n + 1)) * RES * RES
arb = []
for (cy_, cx_), a in zip(cen, area):
    g = (x0 + (cx_ + 0.5) * RES, y0 + (cy_ + 0.5) * RES)
    d = float(np.clip(2 * np.sqrt(a / np.pi), 2.5, 8.0))
    q = pie(g, 2.0)  # la mancha corresponde a la copa (≈2 m de altura): se lleva al pie del árbol
    arb.append([round(float(q[0]), 1), round(float(q[1]), 1), round(d, 1)])
print('árboles detectados', len(arb))
json.dump(arb, open(S + 'arboles.json', 'w'))
# ---------- 3b. foto cenital de alrededor de la casa: árboles de esa zona, más precisos
# Calibración (foto original 2576 × 1449, tomada en vertical): el alero de la casa ocupa 605 px de largo (16,33 m a ≈3,3 m de
# altura) y el coche negro 160 px (≈4,55 m): suelo a 0,0291 m/px con el dron a ≈43 m. La casa sale alineada con los ejes de la
# foto (frontal A arriba, algarrobo a la derecha), y el centro de su tejado está en (1145, 207) px.
if CENITAL:
    SC, ALT, NADIR = 0.0291, 43.0, np.array([1288, 724.5])
    TEJADO = np.array([1145, 207])

    def cen2modelo(px, alto):
        g = (np.asarray(px, float) - NADIR) * SC * (1 - alto / ALT)
        g0 = (TEJADO - NADIR) * SC * (1 - 3.3 / ALT)
        return HOUSE_C + g - g0

    c_im = np.asarray(Image.open(CENITAL).convert('RGB')).astype(int)
    Rc, Gc = c_im[..., 0], c_im[..., 1]
    veg = ndi.binary_opening(((Gc - Rc) > -6) & (c_im.mean(2) < 175), iterations=2)
    veg[0:470, 820:1480] = False  # casa
    veg[0:520, 1380:1900] = False  # algarrobo
    veg[650:770, 1080:1270] = False  # coche
    smc = ndi.gaussian_filter(veg.astype(float), 22)
    pkc = (smc == ndi.maximum_filter(smc, size=110)) & (smc > 0.3)
    labc, nc = ndi.label(pkc)
    cenc = np.array(ndi.center_of_mass(pkc, labc, range(1, nc + 1)))
    mkc = np.zeros(labc.shape, int)
    for i, (yy_, xx_) in enumerate(cenc):
        mkc[int(yy_), int(xx_)] = i + 1
    ic = ndi.distance_transform_edt(mkc == 0, return_distances=False, return_indices=True)
    areac = ndi.sum(veg, mkc[ic[0], ic[1]], range(1, nc + 1)) * SC * SC
    nuevos = [[*cen2modelo((xx_, yy_), 2.5), float(np.clip(2 * np.sqrt(a_ / np.pi), 2.5, 8.0))] for (yy_, xx_), a_ in zip(cenc, areac)]
    # copas partidas en dos: se juntan las que están a menos de 3,5 m
    junt = True
    while junt:
        junt = False
        for i in range(len(nuevos)):
            for j in range(i + 1, len(nuevos)):
                if np.hypot(nuevos[i][0] - nuevos[j][0], nuevos[i][1] - nuevos[j][1]) < 3.5:
                    a_, b_ = nuevos[i], nuevos[j]
                    nuevos[i] = [(a_[0] + b_[0]) / 2, (a_[1] + b_[1]) / 2, min(8.0, max(a_[2], b_[2]) * 1.1)]
                    del nuevos[j]
                    junt = True
                    break
            if junt:
                break
    # zona que cubre la foto (en el suelo), con 3 m de margen para no tomar copas cortadas por el borde
    z0 = cen2modelo((0, 0), 0) + 3
    z1 = cen2modelo((c_im.shape[1], c_im.shape[0]), 0) - 3
    enz = lambda p: z0[0] < p[0] < z1[0] and z0[1] < p[1] < z1[1]
    antes = len(arb)
    arb = [t for t in arb if not enz(t)] + [[round(float(x), 1), round(float(y), 1), round(d, 1)] for x, y, d in nuevos if enz((x, y))]
    print('foto cenital: zona', np.round(z0, 1).tolist(), '→', np.round(z1, 1).tolist(), '; árboles', antes, '→', len(arb),
          '; coche en', np.round(cen2modelo((1178, 712), 0.8), 1).tolist())

arb_np = np.array(arb)
print('diámetro de copa: mediana', float(np.median(arb_np[:, 2])), 'm; separación entre vecinos: mediana',
      round(float(np.median(np.sort(np.hypot(*(arb_np[:, None, :2] - arb_np[None, :, :2]).transpose(2, 0, 1)), axis=1)[:, 1])), 1), 'm')

# ---------- 4. puerta y camino
# puerta pegada a la esquina sureste (vértice 13), sobre el lindero lateral (13–12): el pilar toca la esquina
v13, v12 = P[13], P[12]
u1 = (v12 - v13) / np.linalg.norm(v12 - v13)
nin = np.array([u1[1], -u1[0]])
if (P.mean(0) - v13) @ nin < 0:
    nin = -nin
GATE = v13 + u1 * 3.1
APROX = GATE + nin * 6.0
EXT = [GATE - nin * 3.5, GATE - nin * 3.5 + u1 * 45, GATE - nin * 3.5 + u1 * 95]
INICIO = np.array([15.8, 16.2])  # extremo de la zona de aparcamiento (donde deja el coche la propiedad), hacia la puerta

# camino más corto por los pasillos entre árboles (rejilla de 0,5 m; coste mayor cerca de los troncos)
import heapq
G = 0.5
gx0, gy0 = P.min(0) - 2
NX, NY = int((P.max(0)[0] - gx0) / G) + 4, int((P.max(0)[1] - gy0) / G) + 4
cx_ = gx0 + np.arange(NX) * G
cy_ = gy0 + np.arange(NY) * G
XX, YY = np.meshgrid(cx_, cy_)
dmin = np.full(XX.shape, 99.0)
for x, y, _ in arb:
    dmin = np.minimum(dmin, np.hypot(XX - x, YY - y))
dmin = np.minimum(dmin, np.hypot(XX - ALGARROBO[0], YY - ALGARROBO[1]) - 2.0)
bloq = (dmin < 2.0) | ~inside(XX, YY, P)
bloq |= (XX > -3.2) & (XX < 17.5) & (YY > -1.5) & (YY < 5.6)  # casa y anexo
bloq |= np.hypot(XX - (-6.0), YY - 2.61) < 3.0  # depósito enterrado
coste = 1 + 6 * np.exp(-(dmin - 2.0) / 1.5)


def celda(p):
    return int(round((p[1] - gy0) / G)), int(round((p[0] - gx0) / G))


s0, s1 = celda(INICIO), celda(APROX)
bloq[s0] = bloq[s1] = False
dist = np.full(XX.shape, np.inf)
prev = {}
dist[s0] = 0
hq = [(0.0, s0)]
vec = [(-1, 0), (1, 0), (0, -1), (0, 1), (-1, -1), (-1, 1), (1, -1), (1, 1)]
while hq:
    dd, (i, j) = heapq.heappop(hq)
    if (i, j) == s1:
        break
    if dd > dist[i, j]:
        continue
    for di, dj in vec:
        a, b = i + di, j + dj
        if 0 <= a < NY and 0 <= b < NX and not bloq[a, b]:
            nd = dd + np.hypot(di, dj) * (coste[i, j] + coste[a, b]) / 2
            if nd < dist[a, b]:
                dist[a, b] = nd
                prev[(a, b)] = (i, j)
                heapq.heappush(hq, (nd, (a, b)))
cam = [s1]
while cam[-1] != s0:
    cam.append(prev[cam[-1]])
cam = np.array([[cx_[j], cy_[i]] for i, j in cam[::-1]])


def simplifica(pts, tol):
    if len(pts) < 3:
        return pts
    a, b = pts[0], pts[-1]
    d = dseg(pts[1:-1], a, b)
    k = int(np.argmax(d)) + 1
    if d[k - 1] < tol:
        return np.array([a, b])
    return np.vstack([simplifica(pts[:k + 1], tol)[:-1], simplifica(pts[k:], tol)])


cam = simplifica(cam, 0.8)
camino = [[round(float(x), 1), round(float(y), 1)] for x, y in cam] + [[round(float(GATE[0]), 2), round(float(GATE[1]), 2)]]
largo = sum(np.hypot(camino[i + 1][0] - camino[i][0], camino[i + 1][1] - camino[i][1]) for i in range(len(camino) - 1))
print('camino:', len(camino), 'puntos,', round(float(largo)), 'm')

# ---------- 5. datos
r2 = lambda p: [round(float(p[0]), 2), round(float(p[1]), 2)]
out = f"""/**
 * Olivar de la finca entera, camino y entrada, sacados de la foto de dron de toda la parcela (propiedad, 17/10/2026) con
 * scripts/olivar_finca.py: cada árbol detectado en la foto y pasado a metros con una homografía ajustada a los linderos
 * catastrales, la casa, el algarrobo y la piscina, con la paralaje de las copas corregida. Generado: no editar a mano.
 * Precisión ≈1–3 m (peor lejos de la cámara, hacia el lindero oeste).
 */
import type {{ Vec2 }} from './types';

/** árboles de la parcela: [x, y, diámetro de copa en m] */
export const OLIVOS_FINCA: [number, number, number][] = {json.dumps(arb)};

/** puerta de la finca: pegada a la esquina sureste, sobre el lindero lateral */
export const ENTRADA_FINCA: Vec2 = {json.dumps(r2(GATE))};

/** camino de la zona de aparcamiento a la puerta, por los pasillos entre árboles */
export const CAMINO_FINCA: Vec2[] = {json.dumps(camino)};

/** camino agrícola por fuera del lindero, de la puerta hacia el norte */
export const CAMINO_EXTERIOR: Vec2[] = {json.dumps([r2(p) for p in EXT])};
"""
open(os.path.join(ROOT, 'src/data/olivarFinca.ts'), 'w', encoding='utf-8').write(out)
json.dump(camino, open(S + 'camino.json', 'w'))
