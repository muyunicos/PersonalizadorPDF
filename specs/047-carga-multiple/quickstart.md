# Quickstart — Validacion del modelo de recetas (spec 047, Fase 6)

## Precondiciones

- Lab local: `pwsh C:\wp-lab\arrancar.ps1` (WP + Woo, `127.0.0.1:8091`).
- Producto con `_pmu_pdf_slugs`, campo imagen con `max >= 2`.
- `php tests/media_lectura.php`, `node tests/cargador-lote.test.js` en verde.

## E1 — Lote de 3 fotos (objetivo nuevo)

1. Abrir la ficha, "Cargar imagen", seleccionar 3 archivos.
2. Esperar a que la tira muestre 3 miniaturas.
3. Verificar en `uploads.json`:
   - `items[id].recetas` tiene 3 objetivos con formato `^\d+\.\d{4}-[01]-\d+$`.
   - `items[id].ajustes.objetivo` existe en `recetas`.
   - `configuracion` es `{modo:'cubrir'}` (delta por defecto).

**Esperado**: 3 ids, 3 recetas, 0 errores.

## E2 — Editar una miniatura (0 bytes)

1. Tocar una miniatura de la tira.
2. Mover/zoom; Guardar.
3. Verificar:
   - No hay POST de subida (`personalizador_pdf_subida`).
   - La receta del objetivo cambio (delta) y `ajustes` se actualizo.
   - La cantidad de fotos no cambio.

**Esperado**: 0 bytes, misma foto, receta nueva.

## E3 — Reapertura (ajustes del cliente)

1. Cerrar y volver a abrir el modal.
2. Tocar la miniatura.
3. Verificar: el editor abre con la **última** receta (objetivo + delta), no con defaults.

**Esperado**: encuadre identico al guardado.

## E4 — Reutilización por aspecto (sin umbral)

1. Mismo `id` en un campo 1:1 con otra forma (círculo) y otro tamaño.
2. Abrir el editor.
3. Verificar: se aplico la receta con el aspecto **más cercano** (1.0000), aunque la
   forma/tamaño sean distintos; si no hay, defaults del campo.

**Esperado**: la receta 1:1 se reutiliza.

## E5 — Recetas viejas ignoradas

1. Dejar en `uploads.json` una clave vieja (`{gid}-{w}x{h}-{phsize}`).
2. Abrir la biblioteca.
3. Verificar: esa receta **no** se reutiliza; la tira sigue funcionando.

**Esperado**: sin error, sin reutilización.

## Puertas

```powershell
php tests/texto_puente.php receta
php tests/texto_puente.php fotos
php tests/texto_puente.php biblioteca
node tests/cargador-lote.test.js
node tests/receta-contrato.test.js
node tests/biblioteca-contrato.test.js
node tests/ficha-pedido.browser.js
```