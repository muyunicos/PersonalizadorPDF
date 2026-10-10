# Cropper.js 1.6.2 (vendoreado)

- Fuente: https://github.com/fengyuanchen/cropperjs (rama v1)
- Version clavada: **1.6.2** (npm `cropperjs@1.6.2`)
- Licencia: MIT (archivo `LICENSE`, incluido)
- Build: UMD (`cropper.min.js`) — se carga con `<script>` plano, sin npm ni build.
- Archivos en esta carpeta (NO editar el minificado a mano; para actualizar,
  re-descargar los tres y verificar los hashes):
  - `cropper.min.js`  — 37 369 bytes
  - `cropper.min.css` — 3 795 bytes
  - `LICENSE`
- Integridad (SHA256, publicados por jsDelivr para 1.6.2):
  - `cropper.min.js`:  `6290A3FA581B17CCF4692CF3EC617A74AE65DE88D9140C72D492AE9B47707EFB`
  - `cropper.min.css`: `23679F552CE73499F817DE22B5DCDD9E1E5A1E50CD9D77E34BBD31BF65A85186`
- Se sirve desde el propio plugin (`wp_enqueue_script`/`wp_enqueue_style` con
  handle `personalizador-pdf-cropper`), **nunca CDN** (hosting compartido, sin
  dependencia de terceros en produccion).
- Consumidor: `assets/selector-pmu.js` (spec 016, editor visual de fotos).
  La decision de usarlo y la evaluacion de alternativas estan en
  `specs/016-editor-visual-fotos/research.md`.
