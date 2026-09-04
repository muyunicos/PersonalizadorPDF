# -*- coding: utf-8 -*-
'''
metadatos - Genera y guarda el JSON de metadatos por grupo de color.

Cada grupo produce un registro con el identificador:
    nombredelpdf-{letra}-{ancho_px}x{alto_px}
(medidas SIEMPRE en pixeles, base 200 ppp).

Ubicacion del JSON:
    {dir_marcos}/{nombre_pdf}/metadata.json
'''
import json
import os
import re
from datetime import datetime, timezone

ARCHIVO_METADATOS = 'metadata.json'


def nombre_desde_archivo(ruta_o_nombre):
    'Nombre del PDF saneado (sin extension): base para carpetas e ids.'
    base = os.path.basename(str(ruta_o_nombre))
    if base.lower().endswith('.pdf'):
        base = base[:-4]
    saneado = re.sub('[^A-Za-z0-9_-]+', '_', base).strip('_')
    return saneado or 'pdf'


def id_grupo(nombre_pdf, letra, ancho_px, alto_px):
    'Identificador de grupo: nombredelpdf-{letra}-{ancho}x{alto}.'
    return '{0}-{1}-{2}x{3}'.format(nombre_pdf, letra, ancho_px, alto_px)


def ruta_marco(nombre_pdf, letra, ancho_px, alto_px):
    'Ruta relativa del marco del grupo (convencion con barras normales).'
    return 'marcos/{0}/{1}-{2}x{3}.png'.format(nombre_pdf, letra, ancho_px, alto_px)


def ruta_metadata(nombre_pdf, dir_marcos='marcos'):
    'Ruta absoluta del JSON de metadatos del PDF.'
    return os.path.join(dir_marcos, nombre_pdf, ARCHIVO_METADATOS)


def generar(nombre_pdf, grupos, dpi=200):
    'Construye el diccionario de metadatos a partir de los grupos.'
    registros = []
    for g in grupos:
        registros.append({
            'id': id_grupo(nombre_pdf, g['letra'], g['ancho_px'], g['alto_px']),
            'letra': g['letra'],
            'color': g['color'],
            'color_rgb': list(g['color_rgb']),
            'ancho_px': g['ancho_px'],
            'alto_px': g['alto_px'],
            'ancho_pt': g['ancho_pt'],
            'alto_pt': g['alto_pt'],
            'num_instancias': g['num_instancias'],
            'paginas': g['paginas'],
            'ruta_marco': ruta_marco(nombre_pdf, g['letra'], g['ancho_px'], g['alto_px']),
        })
    return {
        'pdf': nombre_pdf,
        'dpi_conversion': dpi,
        'creado': datetime.now(timezone.utc).isoformat(timespec='seconds'),
        'total_grupos': len(registros),
        'grupos': registros,
    }


def guardar(datos, ruta):
    'Escribe los metadatos como JSON UTF-8. Devuelve la ruta escrita.'
    carpeta = os.path.dirname(ruta)
    if carpeta:
        os.makedirs(carpeta, exist_ok=True)
    with open(ruta, 'w', encoding='utf-8') as f:
        json.dump(datos, f, indent=2, ensure_ascii=False)
    return ruta


def cargar(ruta):
    'Lee un JSON de metadatos previamente guardado.'
    with open(ruta, 'r', encoding='utf-8') as f:
        return json.load(f)
