# Research — 016 Editor visual de fotos

Pregunta: ¿codigo propio para los gestos y el marco, o libreria open-source?

## Opciones evaluadas

| Criterio | Propio (patron 011) | Croppie | **Cropper.js v1.6.2** |
|---|---|---|---|
| Pan/pinch/rotacion tactil | a escribir y mantener | parcial (zoom/move, sin marco editable completo) | **nativo, probado en produccion** |
| Marco con tiradores + guias de tercios + zona atenuada | a escribir (la 011 tiene la matematica de tiradores, pero es para capas del mockup, no para recorte de foto) | no | **incluido** |
| Rotacion en la salida | a escribir | no | `rotate()` + `getCroppedCanvas` |
| Tamaño | 0 KB | ~15 KB min | **37,4 KB min (~11 KB gzip) + 3,8 KB css** |
| Licencia | — | MIT | **MIT** |
| Formato de distribucion | — | UMD | **UMD** (script plano, sin npm ni build) |
| Mantenimiento | nuestro | bajo (repo menos activo) | activo (v1 estable; v2 en main) |
| Testeable con el arnes Node del repo | total | medio (minificado) | **la puerta testea NUESTRA cola; la lib se confia** |

## Decision

**Cropper.js v1.6.2 vendoreado** (`assets/vendor/cropper/`), con un esquema
hibrido (D9): Cropper cubre el modo `crop` (el 95% del uso: una ranura de foto
se recorta al marco) y el modo `fit` (contain con margenes transparentes, no
nativo de Cropper) conserva el canvas actual de `selector-pmu.js`.

- **Por que v1 y no v2**: v1 es la linea estable documentada, con build UMD
  cargable con un `<script>`; v2 (rama `main`) exige ESM/modern-build, y este
  repo no tiene pipeline de build (los assets son JS plano, el deploy es push a
  git; verificado: sin `package.json`/webpack/gulp/vite en el plugin).
- **Por que no CDN**: hosting compartido y sin dependencia de terceros en
  produccion. El archivo viaja en el repo y se versiona con el plugin.
- **Integridad**: descarga verificada contra los hashes SHA256 que publica
  jsDelivr para 1.6.2 (documentados en `assets/vendor/cropper/ORIGEN.md`):
  - `cropper.min.js`: `6290A3FA581B17CCF4692CF3EC617A74AE65DE88D9140C72D492AE9B47707EFB`
  - `cropper.min.css`: `23679F552CE73499F817DE22B5DCDD9E1E5A1E50CD9D77E34BBD31BF65A85186`
- **Que se testea igual**: la puerta Node no testea la lib (minificada, sin
  require), testea nuestra cola: que el vendor este integro, que se encolen en
  orden, que el contrato publico de `SelectorPMU` no cambie y que la
  degradacion sin `window.Cropper` exista (FR-006).

## Referencias

- Repo: https://github.com/fengyuanchen/cropperjs (rama `v1`)
- README v1: opciones (44), metodos (27), eventos (7): `cropstart/cropmove/cropend`,
  `zoom` (con `touchmove`, pinch), `dblclick` (v1.6), `rotate`, `getCroppedCanvas`.
- `getCroppedCanvas({width, height, imageSmoothingQuality})` -> canvas al tamaño
  EXACTO de salida; soporta Exif (`checkOrientation`, default true).
- Navegadores: ultimos Chrome/Firefox/Safari/Opera/Edge; IE9+ (irrelevante hoy,
  pero la degradacion FR-006 cubre cualquier ausencia).
