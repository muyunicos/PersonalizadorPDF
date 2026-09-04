# -*- coding: utf-8 -*-
'''Compara el PDF generado por PHP con el generado por el pipeline Python.'''
import json
import pymupdf
import sys
import os
import subprocess

BASE = os.path.dirname(os.path.abspath(__file__))
PDF = os.path.join(BASE, '..', '..', 'muestra.pdf')
PHP_OUT = os.path.join(BASE, 'salida_test.pdf')
PYTHON_OUT = os.path.join(BASE, 'salida_python.pdf')

# 1) Ejecutar pipeline Python
print('Ejecutando pipeline Python...')
r = subprocess.run([sys.executable, os.path.join(BASE, '..', '..', 'cli.py'), 'proceso', PDF,
                    '--salida', PYTHON_OUT], capture_output=True, text=True)
print('  stdout:', r.stdout.strip())
print('  stderr:', r.stderr.strip()[-400:] if r.stderr else '')
if r.returncode != 0:
    print('  ERROR en pipeline Python, returncode=', r.returncode)

def analizar(path):
    doc = pymupdf.open(path)
    info = {'pages': len(doc), 'images_per_page': [], 'total_images': 0, 'bytes': os.path.getsize(path)}
    for p in doc:
        n = len(p.get_images(full=True))
        info['images_per_page'].append(n)
        info['total_images'] += n
    doc.close()
    return info

res = {}
for label, path in [('PHP', PHP_OUT), ('Python', PYTHON_OUT)]:
    res[label] = analizar(path)
    print(f"\n{label}: {json.dumps(res[label])}")

# Comparacion
php = res['PHP']
py = res['Python']
ok = php['pages'] == py['pages'] and php['total_images'] == py['total_images']
print("\n" + ('COINCIDE' if ok else 'DIFERE') +
      f": paginas PHP={php['pages']} Py={py['pages']}, imagenes PHP={php['total_images']} Py={py['total_images']}")
sys.exit(0 if ok else 1)