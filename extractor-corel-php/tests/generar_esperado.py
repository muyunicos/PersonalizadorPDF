# -*- coding: utf-8 -*-
'''Genera tests/expected_muestra.json con el resultado EXACTO del analizador Python.
La paridad de la rama PHP se mide contra este archivo.'''
import json
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
from core.analizador import analizar_pdf

if __name__ == '__main__':
    resultado = analizar_pdf('muestra.pdf')
    ruta = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'expected_muestra.json')
    with open(ruta, 'w', encoding='utf-8') as f:
        json.dump(resultado, f, indent=2, ensure_ascii=False)
    print('OK: %d paginas, %d grupos' % (resultado['total_paginas'], len(resultado['grupos'])))