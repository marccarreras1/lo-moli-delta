"""
Prepara las imágenes de la sección «Referencias» para PUBLICAR con la web (autorizado por la propiedad
el 14/10/2026). Las imágenes NUNCA se guardan en el repositorio: el script las lee de la carpeta de
archivos aportados por la propiedad y las escribe en la carpeta de publicación.

    python3 scripts/referencias.py <carpeta-con-las-imágenes> <carpeta-de-publicación>

- Las referencias de diseño 01–11 salen del ZIP aportado (Vinallop_prompt_y_fotos_Claude.zip).
- El resto se identifica por la huella MD5 del archivo original (los duplicados se descartan).
- Las páginas del presupuesto (12 y 13 del ZIP) no se publican.
- Cada imagen se gira según su orientación, se reduce (lado mayor 1800 px) y se guarda en JPEG SIN
  metadatos (sin EXIF ni ubicación GPS).
- Escribe <publicación>/referencias/*.jpg y <publicación>/referencias/manifest.json.
"""
import glob
import hashlib
import io
import json
import os
import sys
import zipfile

from PIL import Image, ImageOps

MAX = 1800
QUALITY = 82

# referencias de diseño del ZIP: número → nombre de archivo
ZIP_REFS = {
    '01': '01_Cocina_madera_y_mineral.jpg', '02': '02_Entrada_y_fachadas.jpg', '03': '03_Salon_sofa_de_obra.jpg',
    '04': '04_Bano_lavabo_y_acabados.jpg', '05': '05_Isla_estructura_y_huecos.jpg', '06': '06_Isla_ceramica_terracota.jpg',
    '07': '07_Celosia_A_patron_fino.jpg', '08': '08_Celosia_B_huecos_cuadrados.jpg', '09': '09_Lamparas_A_barro.jpg',
    '10': '10_Lamparas_B_terracota_clara.jpg', '11': '11_Algarrobo_mesa_y_lampara.jpg',
}

GRUPOS = {
    'inspiracion': 'Imagen de inspiración',
    'bocetos': 'Bocetos de la propiedad',
    'dron': 'Fotos de dron',
    'casa': 'Fotos de la casa y el algarrobo',
    'parcela': 'Fotos de la parcela y el entorno',
    'mapa': 'Mapa',
}

# fotos sueltas: md5 del original (12 primeros caracteres) → (id, grupo, título)
FOTOS = {
    'f5216fe84aa4': ('render-referencia', 'inspiracion', 'Render de referencia: casa encalada con porche y cristalera bajo un árbol grande'),
    '183382fd82dc': ('puerta-finca', 'inspiracion', 'Referencia de la puerta de la finca: barrera de madera de acebuche de dos hojas entre pilares de piedra y pared seca'),
    'abcd1162249c': ('boceto-frontal-a', 'bocetos', 'Boceto del alzado del frontal A (6,20 m de alto, ventanal de 7 m y huecos de 2,25 m)'),
    'ea0396e82b01': ('boceto-planta-baja', 'bocetos', 'Boceto de la planta baja (dormitorio, baño, escalera, cocina y aberturas)'),
    '7030e21e4952': ('boceto-frontal-b', 'bocetos', 'Boceto del alzado del frontal B (puertas de 70 y 120 cm)'),
    '048ef391f6b4': ('boceto-altell', 'bocetos', 'Boceto del altell con la escalera'),
    '13166e1f8d83': ('dron-alto', 'dron', 'Dron: la casa en el olivar, vista alta'),
    '0bdd26924ad5': ('dron-entorno-1', 'dron', 'Dron: entorno de campos e invernaderos'),
    '0c6d2531490e': ('dron-entorno-2', 'dron', 'Dron: olivar y campos vecinos'),
    '430cea7b03db': ('dron-oblicua-1', 'dron', 'Dron: la casa y el algarrobo, vista oblicua'),
    'eda961b2482a': ('dron-cenital', 'dron', 'Dron: vista cenital de las cubiertas'),
    '02f4eb8738ef': ('dron-oblicua-2', 'dron', 'Dron: la casa entre olivos'),
    '580ef4d0557c': ('dron-cercana', 'dron', 'Dron: cubiertas de fibrocemento y fachada, de cerca'),
    '8b1264029034': ('dron-horizonte', 'dron', 'Dron: olivar con la sierra al fondo'),
    '61661e7c3aca': ('dron-olivar', 'dron', 'Dron: la casa en el olivar'),
    '2120f050e772': ('dron-finca', 'dron', 'Dron: la finca entera desde la esquina de la entrada, con los invernaderos al fondo'),
    '01f600ae06c1': ('dron-acceso', 'dron', 'Dron: la casa, el olivar y la entrada de la finca (esquina izquierda, junto al camino)'),
    'b74bb44185aa': ('casa-entre-olivos', 'casa', 'La casa entre olivos'),
    '02340701528f': ('casa-desde-olivar', 'casa', 'La casa desde el olivar'),
    '35c359984028': ('casa-lateral', 'casa', 'Fachada lateral entre árboles'),
    '0be4b92713e4': ('casa-frontal-b-1', 'casa', 'Frontal B con las puertas'),
    'bb3cf534ca1f': ('casa-frontal-b-2', 'casa', 'Frontal B con las puertas (otra toma)'),
    '80d744026544': ('casa-algarrobo-lateral', 'casa', 'Algarrobo junto al lateral de la casa'),
    'a9bdffa46b54': ('algarrobo-tronco', 'casa', 'Tronco y raíces del algarrobo'),
    '6826de6219ba': ('algarrobo-casa', 'casa', 'El algarrobo y la casa'),
    'd9dd6caa3f3b': ('olivo-cristalera', 'casa', 'Olivo grande frente a la cristalera (tronco a 3,60 m de la fachada A)'),
    '8142e9856fef': ('olivo-pequeno', 'casa', 'Olivo pequeño frente a la cristalera (tronco a 4,50 m de la fachada A)'),
    'a8ee839867c2': ('parcela-olivar-1', 'parcela', 'Olivar de la parcela'),
    '177057bfe25a': ('parcela-olivar-2', 'parcela', 'Olivar de la parcela (otra toma)'),
    '2e148469ef71': ('parcela-camino', 'parcela', 'Camino de acceso'),
    'e949de80eb2f': ('parcela-vecinos', 'parcela', 'Margen con amapolas y edificación vecina'),
    '8c75407dd25c': ('parcela-entrada', 'parcela', 'Entrada de la finca: camino de grava de 4,70 m de ancho entre la valla'),
    '3b30a1ef0998': ('parcela-entrada-fuera', 'parcela', 'Entrada de la finca desde el camino: hueco de la malla donde va la puerta menorquina, con las vallas móviles a la derecha'),
    '69efdd422079': ('mapa-satelite', 'mapa', 'Captura de Mapas de Apple (vista de satélite)'),
}


def save(img: Image.Image, path: str) -> tuple[int, int]:
    img = ImageOps.exif_transpose(img)
    img = img.convert('RGB')
    img.thumbnail((MAX, MAX), Image.LANCZOS)
    # se guarda sin exif ni icc: no hay ubicación ni datos del teléfono
    img.save(path, 'JPEG', quality=QUALITY, optimize=True, progressive=True)
    return img.size


def main(src: str, out: str) -> None:
    dest = os.path.join(out, 'referencias')
    os.makedirs(dest, exist_ok=True)
    refs = {}
    zips = glob.glob(os.path.join(src, '*Vinallop_prompt_y_fotos_Claude.zip'))
    if zips:
        with zipfile.ZipFile(zips[0]) as z:
            for n, name in ZIP_REFS.items():
                w, h = save(Image.open(io.BytesIO(z.read(name))), os.path.join(dest, f'ref-{n}.jpg'))
                refs[n] = {'src': f'referencias/ref-{n}.jpg', 'w': w, 'h': h}
    galeria = []
    seen = set()
    for f in sorted(glob.glob(os.path.join(src, '*'))):
        if not f.lower().endswith(('.jpg', '.jpeg', '.png')):
            continue
        h = hashlib.md5(open(f, 'rb').read()).hexdigest()
        if h in seen:
            continue
        seen.add(h)
        meta = FOTOS.get(h[:12])
        if not meta:
            print('sin clasificar (no se publica):', os.path.basename(f))
            continue
        fid, grupo, titulo = meta
        w, hh = save(Image.open(f), os.path.join(dest, f'{fid}.jpg'))
        galeria.append({'id': fid, 'src': f'referencias/{fid}.jpg', 'w': w, 'h': hh, 'grupo': grupo, 'titulo': titulo})
    orden = list(GRUPOS)
    ids = [v[0] for v in FOTOS.values()]
    galeria.sort(key=lambda g: (orden.index(g['grupo']), ids.index(g['id'])))
    manifest = {'version': 1, 'grupos': GRUPOS, 'refs': refs, 'galeria': galeria}
    with open(os.path.join(dest, 'manifest.json'), 'w', encoding='utf-8') as fh:
        json.dump(manifest, fh, ensure_ascii=False, indent=1)
    print(f'{len(refs)} referencias y {len(galeria)} fotos en {dest}')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
