# -*- coding: utf-8 -*-
'''
marcos - Creador de marcos PNG.

Lee los metadatos ({dir_marcos}/{nombre_pdf}/metadata.json) y genera un PNG
TOTALMENTE TRANSPARENTE por grupo, con las dimensiones exactas del grupo en
pixeles (base 200 ppp):

    {dir_marcos}/{nombre_pdf}/{letra}-{ancho_px}x{alto_px}.png

Es idempotente: si el PNG ya existe con el tamano correcto no se regenera,
salvo que se pase regenerar=True.
'''
import os
from PIL import Image
from core import metadatos


def ruta_marco(dir_marcos, nombre_pdf, letra, ancho_px, alto_px):
    'Ruta absoluta del PNG del grupo.'
    nombre_archivo = '{0}-{1}x{2}.png'.format(letra, ancho_px, alto_px)
    return os.path.join(dir_marcos, nombre_pdf, nombre_archivo)


def crear_marcos(nombre_pdf, dir_marcos='marcos', regenerar=False):
    # Genera (si hace falta) un PNG transparente por grupo. Devuelve la
    # lista de rutas absolutas, en el orden de los metadatos (a, b, c...).
    ruta_meta = metadatos.ruta_metadata(nombre_pdf, dir_marcos)
    if not os.path.exists(ruta_meta):
        raise FileNotFoundError('Metadatos no encontrados: {0}. Ejecuta antes el analizador.'.format(ruta_meta))
    datos = metadatos.cargar(ruta_meta)
    rutas = []
    for g in datos['grupos']:
        ruta = ruta_marco(dir_marcos, nombre_pdf, g['letra'], g['ancho_px'], g['alto_px'])
        valido = False
        if not regenerar and os.path.exists(ruta):
            try:
                with Image.open(ruta) as img:
                    valido = img.size == (g['ancho_px'], g['alto_px'])
            except Exception:
                valido = False
        if not valido:
            os.makedirs(os.path.dirname(ruta), exist_ok=True)
            lienzo = Image.new('RGBA', (g['ancho_px'], g['alto_px']), (0, 0, 0, 0))
            lienzo.save(ruta, format='PNG')
        rutas.append(os.path.abspath(ruta))
    return rutas
