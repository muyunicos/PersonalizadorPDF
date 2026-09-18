# Quickstart: validacion de 004-woocommerce-pdf-personalization

**Feature**: 004 | **Reescrito**: 2026-09-17 | **Norma**: `constitution` §I+§IV

Recorrido ejecutable de punta a punta. Entidades y formatos: [data-model.md](./data-model.md)
y [contracts/](./contracts/).

## Prerequisitos

- PHP CLI (`php -v`) y acceso al panel WP; WooCommerce activo.
- Dato de usuario: `uploads/pmu/pdfs/{nombre}/{nombre}.pdf` (con rectangulos 100%
  transparentes), al menos un preset en `uploads/pmu/tm-presets/` y una imagen de fondo en
  `uploads/pmu/img/` para el mockup.
- Producto Woo de prueba con `postmeta _pmu_pdf_slug` apuntando al PDF.

## 1. Verificacion automatica (obligatoria tras tocar `engine/`, `inc/` o `admin/`)

```bash
php -l personalizador-pdf.php
php -l admin/page.php && php -l admin/pdfs.php && php -l admin/campos.php
php -l admin/estilos-texto.php && php -l admin/ayuda.php
php -l engine/Pdf.php && php -l engine/Detector.php && php -l engine/PngWriter.php \
  && php -l engine/Metadata.php && php -l engine/Imagen.php && php -l engine/Overlay.php \
  && php -l engine/Motor.php
php -l inc/class-pmu-uploads.php && php -l inc/class-pmu-galeria.php && php -l inc/class-pmu-sesion.php

php tests/motor_smoke.php      # esperado: SMOKE OK
php tests/parity.php           # esperado: PARIDAD OK

php tests/texto_puente.php setup
php tests/texto_puente.php guardar_ajax
php tests/texto_puente.php procesar
php tests/texto_puente.php rechazo
php tests/texto_puente.php nonce
php tests/texto_puente.php nonce cap
php tests/texto_puente.php contenido
php tests/texto_puente.php placeholder
php tests/texto_puente.php admin
php tests/texto_puente.php mockups     # nuevo: mockups + mapeo con repetir sin pisar analisis
php tests/texto_puente.php sesion      # nuevo: sid/item/pool/manifest/preview_estado
php tests/texto_puente.php conciliacion # nuevo: analisis intacto + preview obligatoria
php tests/texto_puente.php campos      # nuevo: catalogo global + valor dual
```

Cada fase es un proceso propio (los handlers terminan en `exit`) y cierra con `FASE <x> OK`.

## 2. Escenario: mockups del admin (US1)

1. En `admin.php?page=personalizador-pdf&tab=pdfs`, seleccionar el PDF y abrir "Mockups".
2. Crear mockup `fiesta`; agregar capa `img` (fondo del catalogo) y dos capas
   `placeholder` (`0000FF#0` detras del marco, `FF0000` delante); ajustar tamano, posicion,
   rotacion/sesgo y filtros.
3. Guardar y recargar.

**Esperado**: `config.json:mockups[0].capas` con el orden elegido; la galeria del admin
renderiza al vuelo (sin miniaturas guardadas); ninguna marca de editor en el resultado.

## 3. Escenario: sesion del comprador (US2)

1. En la ficha, completar campos y pulsar "Vista previa" (leyenda "verifica tu
   personalizacion antes de continuar con la compra").
2. **Esperado**: aparece la galeria 300x300 con flechas; las vistas pendientes muestran
   "Generando vista previa" y se completan en paralelo; el boton de carrito se habilita al
   estar todas las vistas.
3. Inspeccionar `uploads/pmu/tmp/sesion-{sid}/draft-{uuid}/`: `manifest.json` con
   `preview_estado=ok`, pool `img/{pdf}-{id}-{n}.png` y `mockup-{id}.webp` (300x300).
4. Agregar al carrito.

**Esperado**: la carpeta se renombra a `{cart_item_key}` SIN cambiar de `sid`; el item
conserva `manifest.json` + pool + webp; la meta del item guarda valores + `preview_estado`.

## 4. Escenario: tolerancia a fallos (US3)

1. Con un preset inexistente en el grupo, pulsar "Vista previa".
2. **Esperado**: esa vista se oculta; las demas se muestran. Si no queda ninguna, la
   galeria se oculta y aparece "no hay vista previa" con la compra habilitada.
3. Agregar al carrito y verificar `preview_estado=sin_vista` en el manifest/meta.
4. En "completados" (admin), el pedido aparece con el filtro `sin_vista` primero.

## 5. Escenario: pedido y descarga (US4)

1. Completar el checkout de prueba.
2. **Esperado**: staging en `uploads/pmu/tmp/orders/{order_id}/{item_key}/`; al confirmarse
   el pago pasa a `uploads/pmu/orders/{order_id}/{item_key}/` (rename) con
   `{pdf}_procesado.pdf`, pool y `mockup-*.webp`.
3. En `mi-cuenta/descargas/`, pulsar "Descargar" en la fila del PDF.

**Esperado**: descarga el PDF final; si el item llego con `sin_vista`, el boton reintenta el
render del pool antes de pedir el PDF al Motor (sin intervencion del admin) y el reintento
es idempotente (segunda pulsacion no duplica archivos).

## 6. Escenario: omisible sin mockup (US5)

1. PDF con `preview_omisible=true` (visible solo si hay mockups creados).
2. **Esperado**: no aparece "Vista previa" ni galeria; el boton de carrito esta habilitado;
   al agregar, `preview_estado=omisible`.
3. El PDF final se genera al pagar o en Descargas (mismo flujo de US4).

## 7. Matriz de fallos esperados

| Situacion | Mensaje/causa esperada |
|-----------|------------------------|
| Ambito/ruta invalida | `motor:<op>:ambito:invalido` / `motor:<op>:directorio:no_escribible` |
| Catalogo ilegible | `motor:listar:catalogo:invalido:<ambito>` (aviso, sin fatal) |
| Grupo fuera del dataset | rechazo del handler (sin escribir nada) |
| PNG supera limites del servidor | "No se pudo recibir la vista del grupo X" |
| Preset inexistente | esa vista se oculta; sin vistas ⇒ `sin_vista` + compra habilitada |
| Rename de promocion a medias | flag `.promocionando` y reintento en la siguiente accion |

## 8. Criterios de cierre (mapeo a SC)

- SC-1/SC-2: recorridos 2 y 3 completos (admin y cliente).
- SC-3: recorrido 5 (PDF tras el pago, pool ya generado).
- SC-4: recorrido 3 (vista paralela <5 s).
- SC-5: recorrido 4 (fallo no bloquea la venta).
- SC-6: repetir el recorrido 3 tres veces con valores distintos y comprobar 3 carpetas de
  item intactas.
- SC-7: recorrido 2 + verificar que `analisis.json` no cambia al guardar mockups.

## 9. Datos generados por las pruebas

Las pruebas manuales crean datos en `uploads/pmu/` (PDFs, muestras, sesiones, pedidos).
Antes de un commit: revisar `uploads/pmu/tmp/` y que los catalogos del editor sigan validos.
Los datos de usuario no se versionan.