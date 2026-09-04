# -*- coding: utf-8 -*-
'''
cli - Linea de comandos del Extractor Corel.

Comandos:
    py cli.py analizar   archivo.pdf
    py cli.py marcos     archivo.pdf
    py cli.py reemplazar archivo.pdf [--marcos m1.png m2.png] [--salida out.pdf] [--sin-optimizar]
    py cli.py proceso    archivo.pdf [--salida out.pdf] [--sin-optimizar]

El nombre del PDF (sin extension) define la carpeta de marcos y metadatos:
    marcos/{nombre_pdf}/metadata.json y marcos/{nombre_pdf}/{letra}-{w}x{h}.png
'''
import argparse
import os
import sys
from core import analizador, guardador, marcos, metadatos, reemplazador


def _dir_marcos(args):
    return getattr(args, 'dir_marcos', 'marcos') or 'marcos'


def _resumen_grupos(resultado):
    lineas = []
    for g in resultado['grupos']:
        lineas.append('  [{0}] color {1} - {2}x{3} px - {4} instancias - paginas: {5}'.format(
            g['letra'], g['color'], g['ancho_px'], g['alto_px'],
            g['num_instancias'], g['paginas']))
    return lineas


def cmd_analizar(args):
    nombre = metadatos.nombre_desde_archivo(args.pdf)
    resultado = analizador.analizar_pdf(args.pdf)
    grupos = resultado['grupos']
    if not grupos:
        print('No se detectaron placeholders (rectangulos 100% transparentes).')
        return 1
    datos = metadatos.generar(nombre, grupos)
    ruta_meta = metadatos.guardar(datos, metadatos.ruta_metadata(nombre, _dir_marcos(args)))
    print('PDF: {0} - {1} paginas - {2} grupos - {3} instancias'.format(
        args.pdf, resultado['total_paginas'], len(grupos),
        sum(g['num_instancias'] for g in grupos)))
    for linea in _resumen_grupos(resultado):
        print(linea)
    print('Metadatos: {0}'.format(ruta_meta))
    return 0


def cmd_marcos(args):
    nombre = metadatos.nombre_desde_archivo(args.pdf)
    rutas = marcos.crear_marcos(nombre, _dir_marcos(args))
    for r in rutas:
        print(r)
    print('Total: {0} marcos'.format(len(rutas)))
    return 0


def cmd_reemplazar(args):
    nombre = metadatos.nombre_desde_archivo(args.pdf)
    if getattr(args, 'marcos', None):
        rutas = [os.path.abspath(m) for m in args.marcos]
    else:
        rutas = marcos.crear_marcos(nombre, _dir_marcos(args))
    doc, resumen = reemplazador.reemplazar(args.pdf, rutas)
    salida = args.salida or (nombre + '_procesado.pdf')
    guardador.guardar(doc, salida, optimizar=not args.sin_optimizar)
    doc.close()
    print('Grupos aplicados: {0} - sin marco: {1} - marcos insertados: {2}'.format(
        ', '.join(resumen['grupos_aplicados']) or '-',
        ', '.join(resumen['grupos_sin_marco']) or '-',
        resumen['marcos_insertados']))
    print('PDF generado: {0}'.format(salida))
    return 0


def cmd_proceso(args):
    codigo = cmd_analizar(args)
    if codigo != 0:
        return codigo
    codigo = cmd_marcos(args)
    if codigo != 0:
        return codigo
    return cmd_reemplazar(args)


def main(argv=None):
    parser = argparse.ArgumentParser(description='Extractor Corel - pipeline de placeholders')
    sub = parser.add_subparsers(dest='comando', required=True)
    funcs = {'analizar': cmd_analizar, 'marcos': cmd_marcos, 'reemplazar': cmd_reemplazar, 'proceso': cmd_proceso}
    for nombre in ('analizar', 'marcos', 'reemplazar', 'proceso'):
        p = sub.add_parser(nombre)
        p.add_argument('pdf', help='ruta del PDF')
        p.add_argument('--dir-marcos', default='marcos', help='carpeta base de marcos y metadatos')
        if nombre in ('reemplazar', 'proceso'):
            p.add_argument('--salida', help='ruta del PDF resultante')
            p.add_argument('--sin-optimizar', action='store_true', help='guardar sin optimizaciones')
        if nombre == 'reemplazar':
            p.add_argument('--marcos', nargs='+', help='rutas de marcos (si se omite, se generan solos)')
        p.set_defaults(func=funcs[nombre])
    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == '__main__':
    sys.exit(main())
