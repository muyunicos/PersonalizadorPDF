# Contract: Consola "PDFs" (`admin/pdfs.php`)

**Feature**: 007-pmu-pdf-layout | **Version**: 2 (muestras del panel en `tmp/muestras/{pdf}/`)

La consola es la unica interfaz de administracion del proceso. Debe renderizar siempre y explicar
la causa de cualquier fallo de recursos del motor.

## Estructura de la pagina (misma que hoy, adaptada)

| Seccion | Contenido |
|---------|-----------|
| 1. Subir PDF | Formulario `action=personalizador_pdf_subir_pdf` (sin cambios de campos) |
| 2. PDFs subidos | Tabla con archivo, grupos, instancias y acciones (seleccionar, descargar, borrar) |
| 3. Grupos | Una tarjeta por grupo: cabecera con color, medidas y paginas; marco del placeholder; carga de imagen; personalizacion (default/texto + preset) |
| 4. Procesar | Boton "Procesar PDF" + enlace al ultimo resultado (`tmp/muestras/{pdf}/{nombre}_procesado.pdf`) (sobrescribe) |

### Cambios respecto de la version actual

1. **Marco en lugar de imagen**: el recuadro del placeholder se dibuja como `div` con el tamano
   real (`w` x `h` en px) y un patron tipo tablero; no se pide ninguna imagen de placeholder.
2. **Descarga al vuelo**: el enlace "Descargar placeholder" apunta a
   `admin-post.php?action=personalizador_pdf_descargar&tipo=placeholder&archivo={pdf}&id={0000FF}` y
   el handler genera el PNG con `PngWriter::bytes($w, $h)` y lo sirve como adjunto, sin escribir
   archivo. Se valida que el `id` exista en el dataset.
3. **Personalizacion leida de `metadata.json`**: la tarjeta de cada grupo lee `default`/`value`/`preset`/`config` del dataset (no existe `textos.json`).
4. **Avisos de recursos**: si un recurso del motor falla (catalogos de presets/imagenes/fuentes,
   rutas o permisos), se muestra un `notice notice-warning` con la causa devuelta por el motor y
   la consola sigue operativa (selector de estilos vacio). Aplica a `presets_base()` y al
   inventario del puente.
5. **Nada de excepciones fatales**: cualquier fallo inesperado durante el render se muestra como
   aviso con su mensaje (no como pagina de error critico de WordPress).

## Endpoints usados

| Accion | Tipo | Uso |
|--------|------|-----|
| `personalizador_pdf_subir_pdf` | POST | Subir PDF (nombre repetido: renombrar / sobrescribir) |
| `personalizador_pdf_reanalizar` | POST | Regenerar dataset (preservando `default`/`value`/`preset`/`config`) |
| `personalizador_pdf_subir_imagen` | POST | Imagen del grupo (PC) -> `tmp/muestras/{pdf}/{id}.{ext}` |
| `personalizador_pdf_imagen_galeria` | POST | Imagen del grupo desde la galeria de medios |
| `personalizador_pdf_quitar_imagen` | POST | Quitar la imagen del grupo |
| `personalizador_pdf_guardar_texto` | POST | Contenido del grupo -> `metadata.json` (nombre vigente) |
| `personalizador_pdf_procesar` | POST | Procesar: imagenes/PNGs del puente + motor -> `tmp/muestras/{pdf}/` (sobrescribe) |
| `personalizador_pdf_descargar` | GET | `pdf` (el PDF base), `datos` (metadata.json), `placeholder` (al vuelo), `salida` (ultimo resultado) |
| `personalizador_pdf_ver` | GET | `imagen` (preview del grupo desde `tmp/`); `placeholder` deja de existir como preview |
| `personalizador_pdf_borrar` | POST | Borrar producto: `pdfs/{nombre}/` + `tmp/muestras/{nombre}/` |

## Requisitos de seguridad (sin cambios)

- Capability `manage_options` + nonce por accion (`personalizador_pdf_*`), con la compatibilidad
  historica vigente.
- Sanitizacion de `archivo`, `id`, `png` y `tipo` antes de tocar el sistema de archivos.
- `form.getAttribute('action')` en JS (nunca `form.action`).

## Criterios de aceptacion

- Con `presets.json` de 0 bytes o sin permisos: la pagina responde `200`, muestra la causa y el
  resto de la consola funciona.
- Con un PDF analizado: se ven los grupos, el marco de cada uno y la personalizacion guardada; procesar
  escribe solo en `tmp/muestras/{pdf}/`.
- "Descargar placeholder" entrega un PNG del tamano del grupo y no crea archivos.