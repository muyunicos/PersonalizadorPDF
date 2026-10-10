# Quickstart — 016 Editor visual de fotos

## Puertas automaticas (tras cada cambio)

```powershell
php -l personalizador-pdf.php
node --check assets/selector-pmu.js
node --check assets/cargador-pmu.js
node tests/selector-contrato.test.js   # SELECTOR CONTRATO OK (F0)
node tests/campos-contrato.test.js     # CAMPOS CONTRATO OK (contrato intacto)
php tests/texto_puente.php campo_subida  # servidor intacto (D5)
```

## Probar F0 hoy (sin navegador)

1. `assets/vendor/cropper/` trae los 4 archivos con pesos exactos
   (37 369 / 3 795 / LICENSE / ORIGEN.md) y hash SHA256 clavado en `ORIGEN.md`.
2. En una ficha de producto con campos, el HTML debe encolar
   `assets/vendor/cropper/cropper.min.css` + `cropper.min.js` y luego
   `assets/selector-pmu.js` (dependencia `personalizador-pdf-cropper`).
3. `window.Cropper` debe existir en la consola del navegador en esa ficha.

## Probar F1-F5 (cuando se implementen)

En un lab (shortcode `[pmu_personalizar pdf="slug"]` sin Woo) y en WP real:

1. **Movil (DevTools emulado)**: tocar una ranura -> modal full-screen; cargar
   por camara y por drop zone; pan con 1 dedo, pinch 2 dedos (1x-8x), doble tap
   (alterna encajar/100%), rotar 90°, aceptar. El badge muestra "Salida WxH px"
   en vivo.
2. **Escritorio**: mismo ajuste con mouse + rueda; el PNG final debe ser
   identico en tamaño al de movil.
3. **Tira**: la miniatura es la foto (mascara circle/square segun la ranura);
   tocarla -> quitar / cambiar (reemplaza, no suma); `min`/`max` siguen igual.
4. **Re-edicion**: agregar al carrito, "Editar" -> las fotos ya cargadas
   aparecen en las ranuras (ids del manifest -> `personalizador_pdf_subida_url`).
5. **Vista previa + PDF**: la foto ajustada llega al hueco correcto (flujo 012
   intacto).
6. **Degradacion**: bloquear `cropper.min.js` en DevTools -> el modal vuelve al
   comportamiento viejo (canvas + slider) y avisa; la ficha no se rompe.

## Origen

Spec: `spec.md` (D1-D10, FR-001..FR-021) · Plan: `plan.md` · Tareas: `tasks.md`
(F0 hecha, F1-F5 pendientes) · Contrato: `contracts/selector-visual.md`
(enmienda del contrato 004 selector-pmu) · Research: `research.md`
(por que Cropper.js 1.6.2 y no codigo propio).
