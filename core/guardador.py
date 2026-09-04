# -*- coding: utf-8 -*-
'''
guardador - Guardado del PDF resultante con optimizaciones.

Aplica (si optimizar=True): incrustacion de subconjuntos de fuentes,
deduplicacion de objetos (garbage collection), compresion de flujos y
limpieza de estructuras de contenido.
'''


def guardar(doc, ruta_salida, optimizar=True):
    'Guarda el documento y devuelve la ruta escrita. No cierra el documento.'
    if optimizar:
        try:
            doc.subset_fonts()
        except Exception:
            pass
        doc.save(ruta_salida, garbage=4, deflate=True, deflate_images=True, deflate_fonts=True, clean=True)
    else:
        doc.save(ruta_salida)
    return ruta_salida
