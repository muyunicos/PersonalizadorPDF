# Recorrido manual pendiente en WP real (sesion unica)

> Cubre en UNA sesion: T030 (004) + T012-recorrido (005) + T017/T029 (006).
> Requiere: panel WP del administrador con plugin activo + Woo + modulo integrado
> (`modules/textmuy/`) + `uploads/pmu/pdfs/muestra.pdf` (dato de usuario, no versionado).
> Las puertas automaticas ya estan en verde (ver §0); esto es solo verificacion con datos reales.
> Limpieza al cerrar: solo `tmp/sesion-*`, `tmp/muestras/*`, `tmp/orders/*` de prueba.
> **Nunca** `orders/` (entregables), ni `pdfs/`, ni catalogos del editor.

## 0. Puertas automaticas (previas, ya verdes — repetir antes de empezar)

```bash
php -l personalizador-pdf.php
php -l admin/page.php
php -l admin/pdfs.php
php -l admin/campos.php
php -l admin/estilos-texto.php
php -l admin/ayuda.php
php -l engine/Pdf.php
php -l engine/Detector.php
php -l engine/PngWriter.php
php -l engine/Metadata.php
php -l engine/Imagen.php
php -l engine/Overlay.php
php -l engine/Motor.php
php -l inc/class-pmu-uploads.php
php -l inc/class-pmu-galeria.php
php -l inc/class-pmu-sesion.php
php tests/motor_smoke.php
php tests/parity.php
php tests/texto_puente.php validez
php tests/texto_puente.php completados
node tests/validez.js
```

Detalle completo por spec: [004/quickstart.md §1](./004-woocommerce-pdf-personalization/quickstart.md),
[005/quickstart.md §1](./005-pdf-condicionales/quickstart.md),
[006/quickstart.md §1+§2+§7](./006-align-textmuy-motor/quickstart.md).

## 1. Editor + raiz unica (006 T017-parcial, T029-parcial)

1. Pestana "Estilos de Texto": galeria muestra recursos con miniatura, sin errores.
2. Subir 1 imagen + 1 fuente + guardar 1 estilo que las use; recargar: persisten.
3. Secuencia 20 ops (7 altas, 6 renombres, 7 bajas) e inspeccionar `uploads/pmu/`:
   un catalogo + un sprite por ambito, 0 duplicados, 0 entradas a ausentes,
   sin `uploads/tm/` ni `uploads/pmu/tm/` (solo vigente `tm-presets/`).
   (Origen: [006/quickstart.md §3](./006-align-textmuy-motor/quickstart.md).)

## 2. Mockups + mapeo admin (004 T030 §2, 006 §4-parcial, **011 T051**)

1. En PDFs, abrir "Mockups" del PDF de prueba; el editor aparece en **dos columnas**
   con estilos (paneles, lienzo con fondo damero, marco 300x300).
2. Crear vista `fiesta`: **arrastrar una imagen desde el escritorio al lienzo** (se sube y
   queda como capa, sin escribir el nombre) y agregar **2 huecos** desde la lista de
   grupos con un clic.
3. Colocar y alinear **solo con el raton**: arrastrar, redimensionar con los tiradores,
   rotar; comprobar la guia del imán al llegar al centro y la medida en px junto a la
   seleccion. Subir el zoom a 200 % y repetir un arrastre: el resultado es identico.
4. Pulsar **"Probar"** en un grupo con estilo: el lienzo muestra el texto real en las
   capas de ese grupo. Pulsarlo otra vez **no** genera un render nuevo.
5. Mover un slider (p. ej. **gama**, que antes se guardaba y no se aplicaba) y comprobar
   el efecto en vivo; "Restablecer ajustes" vuelve al neutro.
6. Esperar el autoguardado ("Guardado"), **recargar** y comprobar que todo persiste.
   `Ctrl+Z` revierte un movimiento.
7. Guardar y recargar: `config.json:mockups[0].capas` con el orden, `ref` con namespace
   (`pdf:...`, `img:{id}`) y los ajustes; `analisis.json` intacto.
8. Borrar una foto en uso: aparece el conteo de capas afectadas; al confirmar, la capa
   queda **marcada**, no desaparece.
9. "Ver como lo ve el cliente": composicion 300x300 sin marcas de edicion.
   (Origen: [004/quickstart.md §2](./004-woocommerce-pdf-personalization/quickstart.md),
   [006/quickstart.md §4](./006-align-textmuy-motor/quickstart.md),
   [011/quickstart.md §5](./011-editor-mockups-visual/quickstart.md).)

## 3. Validez por producto (005 T012, 004 T030 §3)

1. Asociar 4 PDFs a producto1 con las valideces del ejemplo
   (`campo1` diseno × `campo2` tamano) + `mensaje_html` + `bloquear` OFF.
2. Ficha: elegir "libelulas"+"legal" → galeria solo con mockups de
   `pdf-diseno1-legal`; primer mensaje de fallidas visible; evaluacion <200 ms.
3. Activar `bloquear` + nombre vacio → `add-to-cart` deshabilitado; completar →
   habilitado; combinacion 0-elegibles bloquea aunque todo `bloquear` sea OFF.
   (Origen: [005/quickstart.md §2+§3](./005-pdf-condicionales/quickstart.md).)

## 4. Comprador: vista previa + carrito + pedido (004 T030 §3-§6)

1. Ficha: completar campos → "Vista previa" → galeria 300x300 + flechas;
   pendientes "Generando vista previa" → paralelas → carrito habilitado.
2. `tmp/sesion-{sid}/draft-{uuid}/`: `manifest.json` (`preview_estado=ok`) +
   pool `img/{pdf}-{id}-{n}.png` + `mockup-*.webp`; agregar → rename a
   `{cart_item_key}` mismo `sid`; meta guarda valores + estado.
3. Tolerancia: preset inexistente → vista oculta; 0 vistas → "no hay vista previa"
   + compra habilitada (`sin_vista`); completados filtra `sin_vista` primero.
4. Checkout → staging `tmp/orders/{order_id}/{item_key}/` → pago → rename a
   `orders/...` con `{pdf}_procesado.pdf` + pool + webp; Descargas → "Descargar"
   (reintento silencioso si `sin_vista`, idempotente).
5. Omisible: `preview_omisible=true` → sin vista ni galeria, carrito habilitado,
   `preview_estado=omisible`; PDF al pagar/en Descargas.
   (Origen: [004/quickstart.md §3-§6](./004-woocommerce-pdf-personalization/quickstart.md).)

## 5. Snapshot + auditoria (005 T012, 004 T030)

1. Agregar con 1 elegible declarando a mano un PDF inactivo en el POST →
   inactivo cae a `pdfs_descartados[]`.
2. "Completados": muestra `pdfs[]` + `pdfs_descartados[]`; regeneracion usa solo
   snapshot; "Descargar" una fila por PDF aceptado (descartado no se genera).
3. `pmu_pdfs=[]` → `motor:sesion:snapshot:vacio` sin crear draft.
   (Origen: [005/quickstart.md §4](./005-pdf-condicionales/quickstart.md).)

## 6. Fallos + respaldo (006 T029-resto)

1. Matriz [006/quickstart.md §5](./006-align-textmuy-motor/quickstart.md): catalogo
   ausente/invalido, recurso ausente, sin permisos, formato anterior → cada uno
   causa accionable (`motor:<op>:<motivo>`), sin parciales; restaurar tras cada uno.
2. Copiar `uploads/pmu/` a instalacion limpia → mismos recursos/estilos, <2 min,
   sin carpetas extra. Borrar datos de prueba del recorrido (§limpieza arriba).
   (Origen: [006/quickstart.md §5+§6](./006-align-textmuy-motor/quickstart.md).)

## 7. Cierre

- [ ] §1 raiz unica OK (T017-parcial + T029-parcial)
- [ ] §2 mockups + circuito estilo OK (T030 §2 + T029-parcial)
- [ ] §3 validez/bloqueo OK (T012-parcial: SC-1..SC-4, SC-7)
- [ ] §4 comprador OK (T030 §3-§6: SC-1..SC-6)
- [ ] §5 snapshot/auditoria OK (T012-parcial: SC-5/SC-6)
- [ ] §6 fallos + respaldo OK (T029-resto)
- [ ] Datos de prueba limpiados (solo `tmp/sesion-*`, `tmp/muestras/*`, `tmp/orders/*`)
- [ ] Al cerrar todo: marcar T030/T012/T017/T029 `[X]` en sus `tasks.md` y archivar
      este archivo a `_archivo/` con fecha.
