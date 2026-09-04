# -*- coding: utf-8 -*-
'''
reemplazador - Superpone los marcos PNG sobre los placeholders del PDF.

Recibe un PDF y una lista de rutas de marcos; obtiene la letra de grupo de
cada nombre de archivo ({letra}-{ancho}x{alto}.png), vuelve a detectar los
placeholders con el MISMO criterio del analizador y superpone cada marco
sobre el bbox de cada instancia de su grupo.

Los marcos se estiran al bbox exacto de cada instancia para cubrirlas por
completo. Devuelve el documento modificado SIN guardar: el llamador debe
pasarlo al guardador y cerrarlo.
'''
import os
import re
import pymupdf as fitz
from core import analizador

PATRON_MARCO = re.compile('^([a-z]+)-([0-9]+)x([0-9]+)[.]png$', re.IGNORECASE)


def letra_de_marco(ruta):
    'Extrae la letra de grupo del nombre de archivo del marco.'
    nombre = os.path.basename(ruta)
    m = PATRON_MARCO.match(nombre)
    if not m:
        raise ValueError('Nombre de marco no valido: ' + nombre + '. Se espera {letra}-{ancho}x{alto}.png')
    return m.group(1).lower()


def reemplazar(ruta_pdf, rutas_marcos):
    # Aplica los marcos al PDF y devuelve (doc, resumen).
    # La letra de grupo se toma del nombre de archivo de cada marco; la
    # lista puede venir en cualquier orden.
    marcos = {}
    for ruta in rutas_marcos:
        with open(ruta, 'rb') as f:
            marcos[letra_de_marco(ruta)] = f.read()
    doc = fitz.open(ruta_pdf)
    grupos = analizador.agrupar_por_color(analizador.detectar_instancias(doc))
    insertados = 0
    aplicados = []
    sin_marco = []
    for g in grupos:
        datos = marcos.get(g['letra'])
        if datos is None:
            sin_marco.append(g['letra'])
            continue
        for inst in g['instancias']:
            doc[inst['page']].insert_image(fitz.Rect(*inst['bbox']), stream=datos, keep_proportion=False)
            insertados += 1
        aplicados.append(g['letra'])
    resumen = {
        'grupos_totales': len(grupos),
        'grupos_aplicados': aplicados,
        'grupos_sin_marco': sin_marco,
        'marcos_insertados': insertados,
    }
    return doc, resumen
