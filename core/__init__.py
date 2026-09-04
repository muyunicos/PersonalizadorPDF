# -*- coding: utf-8 -*-
'''
Extractor Corel - nucleo modular.

Pipeline de 5 modulos independientes:

    1. analizador   -> detecta placeholders (rectangulos 100% transparentes)
       y los agrupa por color de relleno
    2. metadatos    -> genera y guarda el JSON de metadatos por grupo
    3. marcos       -> crea los PNG transparentes (marcos) por grupo
    4. reemplazador -> superpone los marcos sobre los placeholders del PDF
    5. guardador    -> guarda el PDF resultante con optimizaciones

Convencion de medidas: SIEMPRE en pixeles, convertidos desde puntos PDF
(1 pt = 1/72 pulgada) a base 200 ppp (ver core.analizador.DPI).
'''

__version__ = '2.0.0'
