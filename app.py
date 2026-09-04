# -*- coding: utf-8 -*-
'''
app - Capa web Flask del Extractor Corel.

Orquesta los modulos de core/ para el flujo completo:
    1. /analyze  -> analizador + metadatos
    2. /marcos   -> creador de marcos PNG
    3. /replace  -> reemplazador + guardador (descarga del PDF optimizado)
'''
import json
import os
from flask import Flask, jsonify, render_template, request, send_file, send_from_directory
from core import analizador, guardador, marcos, metadatos, reemplazador

app = Flask(__name__)
BASE = os.path.dirname(os.path.abspath(__file__))
app.config['UPLOAD_FOLDER'] = os.path.join(BASE, 'uploads')
app.config['DIR_MARCOS'] = os.path.join(BASE, 'marcos')
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)


def _ruta_sesion(session_id):
    return os.path.join(app.config['UPLOAD_FOLDER'], session_id + '.json')


def _cargar_sesion(session_id):
    'Devuelve (sesion, None) o (None, mensaje_de_error).'
    if not session_id:
        return None, 'No session ID provided'
    ruta = _ruta_sesion(session_id)
    if not os.path.exists(ruta):
        return None, 'Session expired, please re-upload the PDF'
    with open(ruta, 'r', encoding='utf-8') as f:
        return json.load(f), None


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/analyze', methods=['POST'])
def analyze():
    # Recibe el PDF, detecta los grupos por color y guarda los metadatos.
    if 'pdf' not in request.files:
        return jsonify({'error': 'No PDF file provided'}), 400
    pdf_file = request.files['pdf']
    if pdf_file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    session_id = os.urandom(8).hex()
    nombre_pdf = metadatos.nombre_desde_archivo(pdf_file.filename)
    pdf_path = os.path.join(app.config['UPLOAD_FOLDER'], session_id + '.pdf')
    pdf_file.save(pdf_path)
    try:
        resultado = analizador.analizar_pdf(pdf_path)
    except Exception:
        if os.path.exists(pdf_path):
            os.remove(pdf_path)
        return jsonify({'error': 'El archivo no es un PDF valido'}), 400
    grupos = resultado['grupos']
    if not grupos:
        os.remove(pdf_path)
        return jsonify({'error': 'No se detectaron placeholders. Asegurate de exportar desde Corel con rectangulos 100% transparentes en las posiciones de los nombres.'}), 400
    datos = metadatos.generar(nombre_pdf, grupos)
    metadatos.guardar(datos, metadatos.ruta_metadata(nombre_pdf, app.config['DIR_MARCOS']))
    sesion = {'pdf': pdf_path, 'nombre_pdf': nombre_pdf, 'total_paginas': resultado['total_paginas']}
    with open(_ruta_sesion(session_id), 'w', encoding='utf-8') as f:
        json.dump(sesion, f)
    return jsonify({
        'session_id': session_id,
        'nombre_pdf': nombre_pdf,
        'total_pages': resultado['total_paginas'],
        'total_grupos': len(grupos),
        'total_instancias': sum(g['num_instancias'] for g in grupos),
        'grupos': grupos,
    })


@app.route('/marcos', methods=['POST'])
def crear_marcos_view():
    # Genera (o reutiliza) los PNG de marcos de la sesion actual.
    sesion, error = _cargar_sesion(request.form.get('session_id'))
    if error:
        return jsonify({'error': error}), 400
    rutas = marcos.crear_marcos(sesion['nombre_pdf'], app.config['DIR_MARCOS'])
    items = []
    for r in rutas:
        rel = os.path.relpath(r, app.config['DIR_MARCOS']).replace(chr(92), '/')
        items.append({'archivo': os.path.basename(r), 'ruta': rel, 'url': '/marcos/' + rel})
    return jsonify({'total': len(items), 'marcos': items})


@app.route('/replace', methods=['POST'])
def replace():
    # Aplica los marcos al PDF y devuelve el PDF optimizado como descarga.
    sesion, error = _cargar_sesion(request.form.get('session_id'))
    if error:
        return jsonify({'error': error}), 400
    try:
        rutas_marcos = marcos.crear_marcos(sesion['nombre_pdf'], app.config['DIR_MARCOS'])
        if not rutas_marcos:
            return jsonify({'error': 'No hay marcos generados'}), 400
        doc, resumen = reemplazador.reemplazar(sesion['pdf'], rutas_marcos)
    except Exception as exc:
        return jsonify({'error': 'Error al procesar el PDF: ' + str(exc)}), 500
    salida = os.path.join(app.config['UPLOAD_FOLDER'], 'output_' + request.form.get('session_id') + '.pdf')
    guardador.guardar(doc, salida)
    doc.close()
    return send_file(salida, as_attachment=True, download_name='resultado.pdf')


@app.route('/marcos/<path:filename>')
def servir_marco(filename):
    # Sirve los PNG de marcos para previsualizarlos en la interfaz.
    return send_from_directory(app.config['DIR_MARCOS'], filename)


if __name__ == '__main__':
    app.run(debug=True, port=5000)
