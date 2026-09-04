# -*- coding: utf-8 -*-
'''
analizador - Deteccion de placeholders en un PDF.

Criterio: formas rectangulares con transparencia 100% (relleno definido y
fill_opacity == 0), que CorelDRAW exporta como dibujos vectoriales.

Las instancias se AGRUPAN POR COLOR de relleno. De cada grupo se toma el
ancho/alto de la figura MAS GRANDE (por area) como medida representativa.

Todas las medidas se entregan en PIXELES, convertidas desde puntos PDF
(1 pt = 1/72 pulgada) con la base fija de 200 ppp:
    px = pt * 200 / 72   (redondeo medio arriba)
'''
import pymupdf as fitz

DPI = 200
PT_TO_PX = DPI / 72.0
MIN_ANCHO_PT = 10.0
MIN_ALTO_PT = 5.0
TOL_OPACIDAD = 0.001
TOL_GEO = 0.01


def pt_a_px(valor_pt):
    'Puntos PDF a pixeles (base 200 ppp), redondeo medio arriba.'
    return int(valor_pt * PT_TO_PX + 0.5)


def rgb_a_hex(rgb):
    'Tupla (r, g, b) en floats 0..1 a color #RRGGBB.'
    canales = []
    for c in rgb:
        canales.append(max(0, min(255, int(round(c * 255)))))
    return '#{0:02X}{1:02X}{2:02X}'.format(*canales)


def letra_grupo(indice):
    '0=a, 1=b, ... 25=z, 26=aa, 27=ab, ...'
    if indice < 26:
        return chr(97 + indice)
    return chr(97 + indice // 26 - 1) + chr(97 + indice % 26)


def _es_rectangulo_de_lineas(items, rect):
    'True si 4 lineas rectas cerradas forman el rectangulo del bbox.'
    if len(items) != 4:
        return False
    horizontales = []
    verticales = []
    for it in items:
        if it[0] != 'l':
            return False
        p1 = it[1]
        p2 = it[2]
        horizontal = abs(p1.y - p2.y) <= TOL_GEO
        vertical = abs(p1.x - p2.x) <= TOL_GEO
        if horizontal and not vertical:
            if abs(min(p1.x, p2.x) - rect.x0) > TOL_GEO:
                return False
            if abs(max(p1.x, p2.x) - rect.x1) > TOL_GEO:
                return False
            horizontales.append(p1.y)
        elif vertical and not horizontal:
            if abs(min(p1.y, p2.y) - rect.y0) > TOL_GEO:
                return False
            if abs(max(p1.y, p2.y) - rect.y1) > TOL_GEO:
                return False
            verticales.append(p1.x)
        else:
            return False
    if len(horizontales) != 2 or len(verticales) != 2:
        return False
    if abs(min(horizontales) - rect.y0) > TOL_GEO:
        return False
    if abs(max(horizontales) - rect.y1) > TOL_GEO:
        return False
    if abs(min(verticales) - rect.x0) > TOL_GEO:
        return False
    if abs(max(verticales) - rect.x1) > TOL_GEO:
        return False
    return True


def _es_rectangulo(items, rect):
    'True si el path es un rectangulo: items tipo re o 4 lineas cerradas.'
    items = items or []
    if not items:
        return False
    for it in items:
        if it[0] != 're':
            return _es_rectangulo_de_lineas(items, rect)
    return True


def detectar_instancias(doc):
    # Detecta instancias de placeholder en un documento abierto.
    # Devuelve dicts con: page (base 0), bbox [x0, y0, x1, y1] en puntos,
    # w, h en puntos, color (RGB redondeado) y color_hex (#RRGGBB).
    instancias = []
    for num_pagina in range(len(doc)):
        for d in doc[num_pagina].get_drawings():
            fill = d.get('fill')
            if fill is None:
                continue
            opacidad = d.get('fill_opacity')
            if opacidad is None or opacidad > TOL_OPACIDAD:
                continue
            rect = d['rect']
            ancho = rect.x1 - rect.x0
            alto = rect.y1 - rect.y0
            if ancho < MIN_ANCHO_PT or alto < MIN_ALTO_PT:
                continue
            if not _es_rectangulo(d.get('items'), rect):
                continue
            instancias.append({
                'page': num_pagina,
                'bbox': [rect.x0, rect.y0, rect.x1, rect.y1],
                'w': ancho,
                'h': alto,
                'color': (round(fill[0], 3), round(fill[1], 3), round(fill[2], 3)),
                'color_hex': rgb_a_hex(fill),
            })
    return instancias


def agrupar_por_color(instancias):
    # Agrupa las instancias por color y asigna letras por orden RGB.
    # - Orden determinista: los grupos se ordenan por su tupla RGB,
    #   independiente del contenido del PDF: a, b, c...
    # - Medida representativa: la figura MAS GRANDE por area.
    # - Todas las medidas se convierten a pixeles (base 200 ppp).
    por_color = {}
    for inst in instancias:
        por_color.setdefault(inst['color'], []).append(inst)
    ordenados = []
    for color, insts in por_color.items():
        mayor = max(insts, key=lambda i: i['w'] * i['h'])
        ordenados.append((color, mayor, insts))
    ordenados.sort(key=lambda t: t[0])
    grupos = []
    for indice, (color, mayor, insts) in enumerate(ordenados):
        paginas = []
        for i in insts:
            if i['page'] not in paginas:
                paginas.append(i['page'])
        grupos.append({
            'letra': letra_grupo(indice),
            'color': rgb_a_hex(color),
            'color_rgb': list(color),
            'ancho_px': pt_a_px(mayor['w']),
            'alto_px': pt_a_px(mayor['h']),
            'ancho_pt': round(mayor['w'], 2),
            'alto_pt': round(mayor['h'], 2),
            'num_instancias': len(insts),
            'paginas': sorted(paginas),
            'instancias': [
                {'page': i['page'], 'bbox': i['bbox'],
                 'w': round(i['w'], 2), 'h': round(i['h'], 2)}
                for i in insts
            ],
        })
    return grupos


def analizar_pdf(ruta_pdf):
    # Abre el PDF, detecta y agrupa placeholders, y cierra el documento.
    # Devuelve un dict con total_paginas y grupos.
    doc = fitz.open(ruta_pdf)
    try:
        return {
            'total_paginas': len(doc),
            'grupos': agrupar_por_color(detectar_instancias(doc)),
        }
    finally:
        doc.close()
