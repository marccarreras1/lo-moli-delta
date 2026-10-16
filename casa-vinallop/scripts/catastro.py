"""
Pasa los GML del Catastro aportados por la propiedad (parcela y edificio) al sistema de coordenadas del
modelo y escribe src/data/catastro.ts. Los GML NO se guardan en el repositorio, y el archivo generado
no lleva ni la referencia catastral ni coordenadas UTM: solo geometría relativa a la casa.

    python3 scripts/catastro.py <parcela.gml> <edificio.gml>

- Norte: del eje largo del edificio catastral (media de los lados, ponderada por longitud).
- Posición: el centro del rectángulo del edificio catastral coincide con el centro de la casa del
  modelo (16,33 × 5,22 m; la huella catastral mide ≈16,7 × 5,6 m).
"""
import math
import os
import re
import sys


def ring(path: str) -> list[tuple[float, float]]:
    s = open(path, encoding='utf-8').read()
    v = list(map(float, re.search(r'<gml:posList[^>]*>([^<]*)<', s).group(1).split()))
    p = list(zip(v[::2], v[1::2]))
    return p[:-1] if p[0] == p[-1] else p


def area_of(path: str, tag: str) -> float | None:
    m = re.search(rf'<{tag}[^>]*>([\d.]+)<', open(path, encoding='utf-8').read())
    return float(m.group(1)) if m else None


def main(parcela: str, edificio: str) -> None:
    P = ring(parcela)
    H = ring(edificio)
    num = den = 0.0
    for i in range(len(H)):
        (ax, ay), (bx, by) = H[i], H[(i + 1) % len(H)]
        ang = math.atan2(bx - ax, by - ay)
        L = math.hypot(bx - ax, by - ay)
        num += L * math.sin(4 * ang)
        den += L * math.cos(4 * ang)
    rumbo = math.degrees(math.atan2(num, den) / 4) % 90  # eje largo (70° aprox.)
    north = 90 - rumbo
    th = math.radians(north)
    s, c = math.sin(th), math.cos(th)
    # planta del modelo: x a lo largo de la casa, y hacia el frontal B; el norte está `north` grados en sentido horario desde −y
    plan = lambda e, n: (e * c + n * s, e * s - n * c)
    Hq = [plan(*p) for p in H]
    xs = [q[0] for q in Hq]
    ys = [q[1] for q in Hq]
    ox = (min(xs) + max(xs)) / 2 - 16.33 / 2
    oy = (min(ys) + max(ys)) / 2 - 5.22 / 2
    loc = lambda e, n: (round(plan(e, n)[0] - ox, 2), round(plan(e, n)[1] - oy, 2))
    Pm = [loc(*p) for p in P]
    Hm = [loc(*p) for p in H]
    a_par = area_of(parcela, 'cp:areaValue')
    a_edi = area_of(edificio, 'bu-ext2d:value') or None
    m = re.search(r'officialArea>.*?<bu-ext2d:value[^>]*>([\d.]+)<', open(edificio, encoding='utf-8').read(), re.S)
    if m:
        a_edi = float(m.group(1))
    fmt = lambda pts: '[' + ', '.join(f'[{x}, {y}]' for x, y in pts) + ']'
    out = f"""/**
 * Geometría catastral (GML de la Sede Electrónica del Catastro aportados por la propiedad), pasada a
 * coordenadas del modelo con scripts/catastro.py. Generado: no editar a mano.
 */
import type {{ Vec2 }} from './types';

/** norte, en grados en sentido horario desde el frontal A, según el eje del edificio catastral */
export const NORTE_CATASTRO = {round(north, 1)};

/** lindero de la parcela (superficie catastral {a_par:.0f} m²) */
export const PARCELA_CATASTRO: {{ poligono: Vec2[]; area: number }} = {{ area: {a_par:.0f}, poligono: {fmt(Pm)} }};

/** huella del edificio en el Catastro, antes de la reforma (superficie construida {a_edi:.0f} m²) */
export const EDIFICIO_CATASTRO: {{ poligono: Vec2[]; area: number }} = {{ area: {a_edi:.0f}, poligono: {fmt(Hm)} }};
"""
    dest = os.path.join(os.path.dirname(__file__), '..', 'src', 'data', 'catastro.ts')
    open(dest, 'w', encoding='utf-8').write(out)
    print(f'norte {north:.1f}°; parcela {len(Pm)} vértices, {a_par} m²; edificio {len(Hm)} vértices, {a_edi} m²')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
