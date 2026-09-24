# Quickstart: validación de 005-pdf-condicionales

**Feature**: 005 | **Created**: 2026-09-19 | **Norma**: `constitution` §I+§IV + D1–D9

Recorrido ejecutable. Entidades y formatos: [data-model.md](./data-model.md) y
[contracts/validez.md](./contracts/validez.md). Prerrequisitos: 004 cerrado
(multivínculo `_pmu_pdf_slugs` implementado) + 4 PDFs de prueba asociados a un
producto Woo con las valideces del ejemplo del spec.

## 1. Verificación automática

```bash
php -l personalizador-pdf.php && php -l admin/pdfs.php && php -l inc/class-pmu-uploads.php
php tests/motor_smoke.php      # esperado: SMOKE OK
php tests/parity.php           # esperado: PARIDAD OK
php tests/texto_puente.php validez   # tienda{} + snapshot + saneado
php tests/texto_puente.php ficha_pdfs_previa   # snapshot + descartados
php tests/texto_puente.php ficha_pdfs_vacio    # lista vacía rechazada
php tests/texto_puente.php ficha_pdfs_carrito  # carrito omisible + snapshot
php tests/texto_puente.php completados        # auditoría + regeneración
node tests/validez.js                         # fixture compartida
```

## 2. Escenario: ficha filtra (US2, SC-1/SC-2/SC-7)

1. En la ficha, elegir diseño "libélulas" + tamaño "legal".
2. **Esperado**: galería con solo los mockups de `pdf-diseno1-legal`; mensaje del
   primer fallido; evaluación instantánea (<200 ms sin render).

## 3. Escenario: bloqueo (US3, SC-3/SC-4)

1. Con `bloquear` activo y nombre vacío: `add-to-cart` deshabilitado + mensaje.
2. Completar el nombre: se habilita. Combinación imposible (0 elegibles):
   bloquea aunque todo `bloquear` sea `false`.

## 4. Escenario: snapshot y auditoría (US4, SC-5/SC-6)

1. Agregar con 1 elegible; declarar a mano un PDF inactivo en el POST.
2. **Esperado**: el inactivo cae a `pdfs_descartados[]`; "Completados" muestra
   `pdfs[]` + descartados; la regeneración usa solo el snapshot.
3. En la consola, verificar que "Descargar" ofrece una fila por PDF aceptado y que
   el PDF descartado no se genera.
4. En la prueba automatizada `ficha_pdfs_vacio`, declarar `pmu_pdfs=[]` y verificar
   que la respuesta es `motor:sesion:snapshot:vacio` sin crear draft.

## 5. Matriz de fallos esperados

| Situación | Causa esperada |
|---|---|
| `validez` no compila al guardar | `motor:campos:script:invalido` (rechazo) |
| Snapshot vacío al agregar | rechazo (nunca ítem sin PDFs) |
| `mensaje_html` con etiquetas fuera de allowlist | saneado al guardar (texto conservado) |
| Validez vieja que hoy no compila | `true` + aviso en consola admin |
