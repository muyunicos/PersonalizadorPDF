# Extractor Corel - Documentacion de funcionalidad

Version 2.0 (arquitectura modular). Documenta la aplicacion tras la refactorizacion en modulos independientes.

## Descripcion general

Aplicacion web Flask + CLI que automatiza el reemplazo de placeholders en PDFs exportados desde CorelDRAW. Cuando Corel exporta un documento con marcos vacios donde iran las imagenes o nombres (credenciales, certificados, etc.), esos huecos llegan al PDF como rectangulos vectoriales con transparencia total. Esta app los detecta, los agrupa por color, genera un PNG (marco) por grupo con las dimensiones exactas y los superpone sobre el PDF original, entregando un PDF optimizado listo para descargar.

## Flujo general

1. **Analizar**: el usuario sube el PDF. El analizador busca todas las formas rectangulares con transparencia 100 y las agrupa por color de relleno. De cada grupo se toma la medida de la figura mas grande (por area).
2. **Metadatos**: se genera un registro por grupo con el formato nombredelpdf-letra-anchoxalto y se guarda en marcos/{nombre_pdf}/metadata.json.
3. **Marcos**: se crea un PNG totalmente transparente por grupo, con las dimensiones exactas del grupo, en marcos/{nombre_pdf}/{letra}-{w}x{h}.png.
4. **Reemplazar**: se vuelven a detectar los placeholders y se superpone cada marco sobre el area (bbox) de cada instancia de su grupo.
5. **Guardar**: el PDF resultante se guarda con optimizaciones (compresion, deduplicacion, limpieza) y se descarga como resultado.pdf.

## Arquitectura

```
Extractor Corel/
|-- app.py               Capa web Flask (solo orquesta, sin logica)
|-- cli.py               Interfaz de linea de comandos
|-- core/                Los 5 modulos independientes del pipeline
|   |-- analizador.py    1. Deteccion por transparencia + agrupacion por color
|   |-- metadatos.py     2. Genera y guarda el JSON de metadatos
|   |-- marcos.py        3. Crea los PNG transparentes por grupo
|   |-- reemplazador.py  4. Superpone los marcos sobre los placeholders
|   `-- guardador.py     5. Guardado optimizado del PDF
|-- templates/index.html Interfaz web (4 pasos)
|-- uploads/             PDFs de trabajo (runtime, se crea sola)
|-- marcos/              Marcos y metadatos por PDF (runtime)
|-- requirements.txt
`-- .gitignore
```

Las capas web (app.py) y CLI (cli.py) solo orquestan; toda la logica vive en core/ y cada modulo puede usarse por separado desde Python.

## Regla de medidas: siempre en pixeles (base 200 ppp)

Los PDF miden en puntos (1 pt = 1/72 pulgada). La app convierte TODAS las medidas a pixeles con la base fija de 200 ppp:

    px = pt * 200 / 72    (redondeo medio arriba)

Ejemplos: 100 pt -> 278 px, 200 pt -> 556 px, 50 pt -> 139 px. Estas medidas en pixeles son las que aparecen en los ids de metadatos, en los nombres de archivo de los marcos y en el tamano real (px) de cada PNG.

## Modulos (core/)

### 1. analizador.py - Deteccion y agrupacion

API principal:

- detectar_instancias(doc) -> lista de instancias {page, bbox, w, h, color, color_hex}
- agrupar_por_color(instancias) -> lista de grupos con letra, color, medidas e instancias
- analizar_pdf(ruta_pdf) -> {'total_paginas': int, 'grupos': [...]}
- pt_a_px(valor_pt), rgb_a_hex(rgb), letra_grupo(indice): utilidades

Criterio de deteccion (en orden):

1. El path debe tener relleno definido (fill; tipos f o fs de PyMuPDF).
2. fill_opacity debe ser 0 (transparencia total; tolerancia 0.001).
3. Forma rectangular: items de tipo re, o 4 lineas rectas cerradas que forman el rectangulo del bbox.
4. Tamano minimo anti-artefactos: 10 pt de ancho y 5 pt de alto.

Agrupacion:

- Clave de grupo: color de relleno (RGB redondeado a 3 decimales).
- Los grupos se ordenan por su tupla RGB (orden determinista, independiente del contenido) y reciben letras: a, b, c... z, aa, ab...
- Medida representativa: la figura MAS GRANDE del grupo (por area), de la que se extraen ancho y alto (convertidos a pixeles, base 200 ppp).
- Cada grupo incluye el detalle de todas sus instancias (pagina y bbox).

### 2. metadatos.py - Guardado de metadatos

API: generar(nombre_pdf, grupos), guardar(datos, ruta), cargar(ruta), nombre_desde_archivo(ruta), ruta_metadata(nombre_pdf, dir_marcos).

| Campo | Contenido |
|---|---|
| id | nombredelpdf-{letra}-{ancho_px}x{alto_px} |
| letra | a, b, c... (orden RGB determinista) |
| color | #RRGGBB del relleno |
| ancho_px / alto_px | medidas del marco en pixeles (200 ppp) |
| ancho_pt / alto_pt | medidas originales en puntos (referencia) |
| num_instancias | cuantas veces aparece el grupo en el PDF |
| paginas | paginas donde aparece (base 0) |
| ruta_marco | ruta relativa convencional del PNG |

Salida: marcos/{nombre_pdf}/metadata.json (UTF-8, con fecha de creacion y dpi_conversion=200).

### 3. marcos.py - Creador de marcos

API: crear_marcos(nombre_pdf, dir_marcos='marcos', regenerar=False)

- Lee metadata.json y genera un PNG RGBA TOTALMENTE TRANSPARENTE por grupo, con el tamano exacto del grupo en pixeles: marcos/{nombre_pdf}/{letra}-{ancho_px}x{alto_px}.png
- Es idempotente: si el PNG ya existe con el tamano correcto no se regenera (salvo regenerar=True).
- Devuelve la lista de rutas absolutas en el orden de los metadatos (a, b, c...). Esa lista ordenada es la que consume el reemplazador.

### 4. reemplazador.py - Reemplazo en el PDF

API: reemplazar(ruta_pdf, rutas_marcos) -> (doc, resumen)

- Obtiene la letra de grupo de cada nombre de archivo de marco (patron letra-anchoxalto.png).
- Vuelve a detectar los placeholders con el MISMO criterio del analizador (misma funcion), garantizando coincidencia exacta.
- Superpone cada marco sobre el bbox de cada instancia de su grupo con page.insert_image(..., keep_proportion=False): la imagen cubre el hueco exacto aunque la instancia tenga otra proporcion.
- Devuelve el documento EN MEMORIA (sin guardar) y un resumen: grupos aplicados, grupos sin marco y total de marcos insertados.

### 5. guardador.py - Guardado optimizado

API: guardar(doc, ruta_salida, optimizar=True) -> ruta

- Con optimizar=True: incrusta subconjuntos de fuentes (subset_fonts), deduplica objetos (garbage=4), comprime flujos (deflate, deflate_images, deflate_fonts) y limpia estructuras (clean=True).
- No cierra el documento: el llamador decide cuando cerrarlo.

## Convenciones de nombres

- Carpeta por PDF: marcos/{nombre_pdf}/ (nombre del archivo sin extension, saneado: los caracteres fuera de A-Z a-z 0-9 _ - se sustituyen por _).
- Metadatos: marcos/{nombre_pdf}/metadata.json
- Marcos: marcos/{nombre_pdf}/{letra}-{ancho_px}x{alto_px}.png
- Identificador de grupo: nombredelpdf-{letra}-{ancho_px}x{alto_px}

## Ejemplo de metadata.json

```
{
  "pdf": "credenciales",
  "dpi_conversion": 200,
  "creado": "2026-08-27T12:00:00+00:00",
  "total_grupos": 2,
  "grupos": [
    {
      "id": "credenciales-a-556x139",
      "letra": "a",
      "color": "#0000FF",
      "color_rgb": [0.0, 0.0, 1.0],
      "ancho_px": 556,
      "alto_px": 139,
      "ancho_pt": 200.0,
      "alto_pt": 50.0,
      "num_instancias": 4,
      "paginas": [0, 1, 2, 3],
      "ruta_marco": "marcos/credenciales/a-556x139.png"
    }
  ]
}
```

## Capa web (app.py)

| Ruta | Metodo | Funcion |
|---|---|---|
| / | GET | Interfaz web (templates/index.html) |
| /analyze | POST | Analiza el PDF y guarda metadatos |
| /marcos | POST | Genera (o reutiliza) los marcos de la sesion |
| /replace | POST | Reemplaza, optimiza y devuelve el PDF |
| /marcos/{ruta} | GET | Sirve un PNG de marco para previsualizarlo |

- /analyze: campo pdf (multipart). Devuelve session_id, nombre_pdf, total_pages, total_grupos, total_instancias y el detalle de grupos (letra, color, medidas px/pt, instancias con bbox). Guarda el PDF en uploads/{session_id}.pdf y el estado de la sesion en uploads/{session_id}.json.
- /marcos y /replace: campo session_id. /replace descarga resultado.pdf.
- Limite de subida: 16 MB. Sin placeholders detectados o PDF invalido: respuesta 400 con mensaje. Errores de reemplazo: 500.

## CLI (cli.py)

    py cli.py analizar   archivo.pdf        detecta grupos y guarda metadatos
    py cli.py marcos     archivo.pdf        genera los PNG de marcos
    py cli.py reemplazar archivo.pdf        aplica marcos y guarda
        [--marcos a.png b.png] [--salida out.pdf] [--sin-optimizar]
    py cli.py proceso    archivo.pdf        pipeline completo
        [--salida out.pdf] [--sin-optimizar]

- --dir-marcos permite cambiar la carpeta base (por defecto marcos).
- Si no se indican --marcos, se generan automaticamente desde los metadatos.
- Salida por defecto: {nombre_pdf}_procesado.pdf en el directorio actual.

## Como ejecutar

1. Instalar dependencias (Python 3.10 o superior): pip install -r requirements.txt
   - flask (web), pymupdf (manipulacion de PDF), pillow (generacion de PNG)
2. Web: py app.py -> abre http://127.0.0.1:5000
3. CLI: py cli.py proceso archivo.pdf

Flujo web: subir PDF -> Analizar (grupos con su color y medidas) -> Generar marcos (previsualizacion con fondo de cuadros porque son transparentes) -> Reemplazar y descargar.

## Constantes configurables (core/analizador.py)

| Constante | Valor | Significado |
|---|---|---|
| DPI | 200 | base de conversion de puntos a pixeles |
| PT_TO_PX | 2.7778 | factor: px = pt * PT_TO_PX |
| MIN_ANCHO_PT | 10 | ancho minimo de un placeholder (puntos) |
| MIN_ALTO_PT | 5 | alto minimo de un placeholder (puntos) |
| TOL_OPACIDAD | 0.001 | fill_opacity menor o igual se considera 0 |
| TOL_GEO | 0.01 | tolerancia geometrica (rectangulos de lineas) |

## Manejo de errores

| Situacion | Capa | Resultado |
|---|---|---|
| PDF corrupto o ilegible | web | 400 - El archivo no es un PDF valido |
| Sin placeholders transparentes | ambas | 400 / exit code 1 con mensaje |
| Marcos sin metadatos previos | ambas | FileNotFoundError con instruccion |
| Sesion inexistente o expirada | web | 400 - re-subir el PDF |
| Subida mayor de 16 MB | web | 413 (limite de Flask) |
| Nombre de marco no valido | ambas | ValueError (formato esperado) |

## Limitaciones y notas

- La carpeta marcos/ crece con cada PDF analizado; los metadatos se sobrescriben si se vuelve a analizar un PDF con el mismo nombre.
- Los archivos uploads/{session_id}.pdf y output_{session_id}.pdf no se limpian automaticamente.
- Los grupos se mapean por COLOR: si dos tipos de placeholder comparten color de relleno se tratan como un solo grupo (se usa la figura mas grande como representante y el marco se estira en cada instancia).
- app.py arranca con debug=True y puerto 5000: para produccion, usar un servidor WSGI.
- El PDF de entrada conserva sus dibujos: los marcos solo se superponen (capa superior), no se borran los rectangulos originales.
