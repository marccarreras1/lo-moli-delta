"""
Corrige la proyección de la foto de dron (scripts/olivar.py) con el lindero catastral (scripts/catastro.py) y escribe
src/data/ajusteFoto.ts con la homografía de corrección (suelo de la foto → suelo del modelo) y la entrada de la finca.

    python3 -I scripts/ajuste_catastro.py <carpeta-de-trabajo-de-olivar.py>

La homografía de olivar.py se ajustó solo con la casa y la separación entre olivos: al fondo de la foto comprimía
la escala (el borde con los campos quedaba a ≈66 m de la casa y el lindero está a ≈88 m). Aquí se ajusta una
segunda homografía que deja la casa en su sitio y lleva:
- el muro de piedra (derecha de la foto) sobre el lindero oeste (vértices 0–1 de la parcela),
- el borde del olivar con los campos (arriba de la foto) sobre el lindero este (vértices 12–13),
- el final del camino marcado en rojo a la entrada, en la esquina sureste del lindero (indicación de la propiedad).
"""
import json
import os
import re
import sys

import numpy as np
from scipy.optimize import least_squares

S = sys.argv[1].rstrip('/') + '/'
ROOT = os.path.join(os.path.dirname(__file__), '..')
H = np.load(S + 'H.npy')


def ap(x, y):
    v = H @ np.array([x, y, 1.0])
    return v[:2] / v[2]


def pxm(x, y):
    a, b, c = ap(x, y), ap(x + 1, y), ap(x, y + 1)
    return 1 / np.sqrt(abs((b - a)[0] * (c - a)[1] - (b - a)[1] * (c - a)[0]))


s_house = pxm(1190, 1080)
ground = lambda x, y: ap(x, y - 45 * pxm(x, y) / s_house)
# puntos tomados en la foto (píxeles de la foto original, 2576 × 1449)
BORDE = [(0, 500), (320, 410), (660, 300), (1000, 240), (1300, 200), (1700, 120)]
MURO = [(2200, 1440), (2300, 1280), (2400, 1120), (2500, 960), (2576, 840)]
B = np.array([ground(*p) for p in BORDE])
W = np.array([ground(*p) for p in MURO])

cat = open(os.path.join(ROOT, 'src/data/catastro.ts'), encoding='utf-8').read()
P = np.array(json.loads(re.search(r'PARCELA_CATASTRO[^=]*=.*?poligono: (\[\[.*?\]\])', cat).group(1)))
ol = open(os.path.join(ROOT, 'src/data/olivar.ts'), encoding='utf-8').read()
C = np.array(json.loads(re.search(r'CAMINO_FOTO[^=]*=\s*(\[.*?\]);', ol, re.S).group(1)))
house = np.array([(0, 0), (16.33, 0), (16.33, 5.22), (0, 5.22)], float)

# entrada: en la esquina sureste (vértice 13), metida 3,5 m por la bisectriz para que quepa la puerta de 4,70 m
v13, v12, v14 = P[13], P[12], P[14]
u1 = (v12 - v13) / np.linalg.norm(v12 - v13)
u2 = (v14 - v13) / np.linalg.norm(v14 - v13)
bis = (u1 + u2) / np.linalg.norm(u1 + u2)
ENT = v13 + bis * 3.5


def line_res(pts, a, b):
    d = (b - a) / np.linalg.norm(b - a)
    return (pts - a) @ np.array([-d[1], d[0]])


def app(h, pts):
    Hm = np.append(h, 1).reshape(3, 3)
    v = np.c_[pts, np.ones(len(pts))] @ Hm.T
    return v[:, :2] / v[:, 2:3]


def res(h):
    return np.r_[(app(h, house) - house).ravel() * 10, line_res(app(h, W), P[0], P[1]), line_res(app(h, B), P[12], P[13]),
                 (app(h, C[-1:]) - ENT).ravel() * 0.7]


h = least_squares(res, np.eye(3).ravel()[:8]).x
G = np.append(h, 1).reshape(3, 3)
print('casa tras el ajuste', np.round(app(h, house), 2).tolist())
print('muro → lindero oeste (m)', np.round(line_res(app(h, W), P[0], P[1]), 1).tolist())
print('campos → lindero este (m)', np.round(line_res(app(h, B), P[12], P[13]), 1).tolist())
print('final del camino', np.round(app(h, C[-1:]), 1).tolist(), 'entrada', np.round(ENT, 1).tolist())
out = f"""/**
 * Corrección de la foto de dron con el lindero catastral (scripts/ajuste_catastro.py). Generado: no editar a mano.
 * AJUSTE_FOTO lleva el suelo de la foto (olivar.ts) al del modelo; ENTRADA_FINCA es la puerta, en la esquina sureste.
 */
import type {{ Vec2 }} from './types';

export const AJUSTE_FOTO: number[] = {json.dumps([round(float(v), 7) for v in G.ravel()])};

export const ENTRADA_FINCA: Vec2 = [{ENT[0]:.2f}, {ENT[1]:.2f}];

/** aplica AJUSTE_FOTO a un punto de la foto */
export const ajustarFoto = ([x, y]: Vec2): Vec2 => {{
  const [a, b, c, d, e, f, g, h, i] = AJUSTE_FOTO;
  const w = g * x + h * y + i;
  return [Math.round(((a * x + b * y + c) / w) * 10) / 10, Math.round(((d * x + e * y + f) / w) * 10) / 10];
}};
"""
open(os.path.join(ROOT, 'src/data/ajusteFoto.ts'), 'w', encoding='utf-8').write(out)
