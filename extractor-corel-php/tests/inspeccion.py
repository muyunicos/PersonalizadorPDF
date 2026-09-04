# -*- coding: utf-8 -*-
'''Inspecciona la estructura interna de muestra.pdf para guiar el parser PHP.
Segunda pasada: vuelca los content streams descomprimidos y los recursos.'''
import pymupdf

doc = pymupdf.open('muestra.pdf')

for p in doc:
    print('===== PAGE', p.number, '=====')
    for xref in p.get_contents():
        stream = doc.xref_stream(xref)
        print('--- content stream object %d (%d bytes, octetos crudos primeros 12: %s)' % (
            xref, len(stream), stream[:12]))
        try:
            texto = stream.decode('latin-1')
        except Exception as e:
            print('   (no decodificable: %s)' % e)
            texto = ''
        if len(texto) > 12000:
            print(texto[:6000])
            print('...[recortado %d bytes]...' % len(texto))
            print(texto[-2000:])
        else:
            print(texto)
    # Recursos de la pagina (resuelto)
    print('--- Claves de la pagina %d:' % p.number, doc.xref_get_keys(p.xref))
    print('--- Resources brutos (formato) de la pagina %d:' % p.number, doc.xref_get_key(p.xref, 'Resources'))

# Objetos ExtGState en el documento
print('===== BUSQUEDA ExtGState / gs =====')
for i in range(1, doc.xref_length()):
    if doc.xref_is_stream(i):
        st = doc.xref_stream(i)
        try:
            t = st.decode('latin-1')
            if 'gs' in t or 'ca' in t or '/GS' in t:
                print('  objeto stream %d usa gs/ca: %s' % (i, t[:200].replace('\n', ' | ')))
        except Exception:
            pass
print('fin2')