# 019 — Ranura adaptativa: `phsize` y aviso de ampliacion

> Estado: **en especificacion** (sin implementar). Origen: consulta del 2026-10-19 sobre
> el cargador de imagenes en la consola de PDFs. Version objetivo: **4.10.0**.
>
> Idea del negocio: que la ranura del cargador pueda **adaptarse al hueco** del grupo
> (`phsize: 0|1|2`) en vez de llevar el tamano escrito a mano, y que el sistema **avise**
> cuando la foto del cliente se va a ampliar. Opcional y sin romper lo que ya existe:
> `phsize: 0` (default) es exactamente el comportamiento de hoy.

## Problema

1. **El tamano se escribe a mano y se desincroniza.** Una ranura declara
   `{ w: 1000, h: 1000 }` y ese numero sale de mirar el hueco del PDF. Si el admin
   re-analiza el PDF (el grupo puede cambiar de tamano), cambia el grupo asociado
   (`campos_envoltura`) o reutiliza el campo en otro PDF, el `w/h` de la ranura queda
   viejo y **nadie lo avisa**: el PNG se recorta al tamano equivocado y el Motor lo
   vuelve a encajar (contain), asi que el resultado se degrada en silencio.
2. **La ampliacion es silenciosa.** Si el cliente sube una foto de 300x300 y la ranura
   pide 1000x1000, el sistema **amplia 3.3x** sin decirlo: la foto sale blanda en el PDF
   y el cliente no sabe que el problema era la resolucion de su archivo.
3. **El servidor ya tiene el dato y no lo usa.** En `panel_ficha()` el plugin ya itera
   campo x grupo y resuelve la forma de la envoltura (`envoltura_defecto()`), y el grupo
   ya lleva `w`/`h` (`personalizador-pdf.php:1174-1178`). Publicar el tamano es una linea;
   hoy no viaja al navegador.

## Decisiones

| | Decision |
|---|---|
| **D1** | **`phsize` es una propiedad de la RANURA** (no del campo): `0` = se usan los `w`/`h` declarados (**default**, comportamiento actual); `1` = se usa el tamano del grupo (placeholder base); `2` = el tamano del grupo **x2** (densidad/impresion). |
| **D2** | **Lo resuelve el sistema, no el `campo.js`.** `PMU_API.montarCargador()` traduce `phsize` a `w/h` finales **antes** de instanciar `CargadorPMU` (ahi ya resuelve la `envoltura` y los `idsIniciales`). El `campo.js` solo declara la intencion. |
| **D3** | **El tamano del grupo viaja en `PMU_FICHA.campos[]`** (`grupo_w`, `grupo_h`, `grupo_gid`) **solo si el campo tiene envoltura asociada en ese PDF** (`config.json:campos_envoltura`). Sin asociacion, `phsize > 0` **degrada a los `w`/`h` declarados** y avisa por `console.warn` (nunca inventa un tamano). |
| **D4** | **Precedencia de la forma**: una `forma` explicita (`circle`/`square`) **gana**; `rect`/`fit` se derivan del hueco (`rect` con el aspecto del grupo). Con `phsize: 0` no cambia nada. |
| **D5** | **Cap de seguridad** por lado (`PH_MAX = 3000` px): si `phsize: 2` excede el cap, el tamano se **acota** y se avisa en la consola. Evita PNGs de varios MB por foto (ya tuvimos `post_max_size`). |
| **D6** | **Aviso de ampliacion** (informativo, **nunca bloquea**): cuando la imagen elegida es menor que el tamano final de la ranura, el selector y la tira del cargador muestran `se amplia Nx`. El admin lo ve al probar; el comprador entiende por que su foto se ve blanda. |
| **D7** | **`escala: 'sin-ampliar'` FUERA DE ALCANCE**: no ampliar la imagen (300x300 -> salida 300x150) exige tocar **tambien el Motor** (`engine/Imagen.php:184` y `tienda.js:rasterizar` amplian hoy), o el Motor re-amplia al encajar. Va como spec aparte, con su puerta. |
| **D8** | **Sin cambios en `engine/` ni `modules/textmuy/`.** Esta spec es del cargador (consola + ficha). |
| **D9** | **`validar_cargador()` conserva `phsize`**: el validador del servidor arma las ranuras con claves nombradas y hoy descartaria la clave nueva, perdiendola en campos legacy. Se agrega a la lista de claves conservadas (1 linea) para que un `cargador` viejo que declare `phsize` no lo pierda al editarse. |

## Historias de usuario

- **US1 (P1) — La ranura sigue al hueco.** Como admin, quiero declarar
  `{ phsize: 1, forma: 'fit' }` y que la ranura tome el tamano del grupo del PDF, para no
  copiar numeros a mano ni quedar desincronizado cuando el PDF cambie.
- **US2 (P2) — Densidad para imprimir.** Como admin, quiero `phsize: 2` en un grupo chico
  (ej. 500x400 -> 1000x800) para que el recorte tenga resolucion de sobra.
- **US3 (P2) — Saber que se amplia.** Como admin (y como comprador), quiero ver
  `se amplia Nx` cuando la foto es mas chica que la ranura, para entender la calidad final
  sin abrir el PDF.


## Requisitos funcionales

- **FR-001** `panel_ficha()` publica en cada campo con envoltura asociada:
  `grupo_w`, `grupo_h` y `grupo_gid` (enteros px del grupo base y su id). Sin asociacion
  (`campos_envoltura` vacio para ese campo en ese PDF) las tres claves van `null`.
- **FR-002** `PMU_API.montarCargador()` resuelve el tamano final de cada ranura:
  `phsize: 0` -> `w`/`h` declarados; `phsize: 1` -> `grupo_w`/`grupo_h`;
  `phsize: 2` -> el doble, acotado por `PH_MAX` (D5).
- **FR-003** Si `phsize > 0` y no hay `grupo_w`/`grupo_h` (campo sin envoltura asociada),
  la ranura usa sus `w`/`h` declarados y deja un `console.warn` accionable (nunca monta
  una ranura de 0x0 ni inventa un tamano).
- **FR-004** Con `phsize > 0`, la `forma` explicita (`circle`/`square`) se respeta; `rect`
  y `fit` se derivan del aspecto del grupo (D4).
- **FR-005** `PH_MAX = 3000`: un tamano final mayor se acota y se avisa (una sola vez por
  ranura).
- **FR-006** El **aviso de ampliacion** aparece cuando la imagen elegida es menor que el
  tamano final de la ranura: se muestra como `se amplia Nx` (una decimal) en el selector y
  en la tira. Es **informativo**: no deshabilita "Aceptar" ni "Listo".
- **FR-007** `validar_cargador()` conserva `phsize` (D9) al normalizar ranuras legacy.
- **FR-008** Cero regresion: un `campo.js` (o un `cargador` legacy) sin `phsize` se comporta
  **exactamente** como hoy; el hash del pool (`valor|preset|settings|WxH`) ya incluye el
  tamano final, asi que dos tamanos distintos no comparten PNG.
- **FR-009** El contrato de la ranura se documenta en `specs/012.../contracts/campos.md`
  (tabla) y en `specs/016.../contracts/selector-visual.md` (aviso).

## Contrato de la ranura (v5, amplia la v4)

| Prop | Valor | Significado |
|---|---|---|
| `w`, `h` | int >= 1 | tamano final en px **cuando `phsize` es 0** (y fallback del resto) |
| `forma` | `circle` \| `square` \| `rect` \| `fit` | recorte; con `phsize > 0` `rect`/`fit` derivan del grupo |
| `min`, `max` | int >= 1 | cuantas imagenes admite la ranura |
| `etiqueta` | string | texto del boton/ranura |
| **`phsize`** | `0` \| `1` \| `2` | **nuevo**: 0 = declarado (default), 1 = tamano del grupo, 2 = x2 del grupo |

Regla de convivencia: `phsize` **no reemplaza** `w`/`h`; los complementa. Un `campo.js`
puede seguir declarando solo `w`/`h` (compatibilidad total) o pedir el hueco y usar
`w`/`h` como respaldo.

## Cambios por archivo (alcance previsto)

| Archivo | Cambio |
|---|---|
| `personalizador-pdf.php` | `campos_panel()`: publicar `grupo_w`/`grupo_h`/`grupo_gid` (FR-001) |
| `assets/tienda.js` | `montarCargador()`: normalizar `phsize` + cap + degradacion con aviso (FR-002/003/005) |
| `assets/cargador-pmu.js` | tira: `se amplia Nx` por ranura (FR-006) |
| `assets/selector-pmu.js` | badge: `se amplia Nx` al confirmar el recorte (FR-006) |
| `inc/class-pmu-uploads.php` | `validar_cargador()`: conservar `phsize` (FR-007) |
| `tests/*` | contrato (Node) + fase `ficha` (grupo_w/h publicados) |
| `specs/012.../contracts/campos.md`, `specs/016.../contracts/selector-visual.md` | contrato v5 + aviso |

## Verificacion

- Node: `node tests/campos-contrato.test.js` (normalizacion de `phsize` en
  `montarCargador`), `node tests/selector-contrato.test.js` (aviso de ampliacion),
  `node tests/mockup-contrato.test.js` y `node tests/conciliacion.js` como regresion.
- PHP: `php -l`, `php tests/texto_puente.php` fases `ficha` (`grupo_w`/`grupo_h`
  publicados y `null` sin asociacion), `campos` (`validar_cargador` conserva `phsize`),
  `campo_subida`, `vista_previa`, `pedido`; `php tests/motor_smoke.php` y
  `php tests/parity.php` (regresion: **el Motor no se toca**).
- Lab sin Woo: un campo con `phsize: 1` sobre un grupo de 800x600 -> la ranura mide
  800x600; `phsize: 2` -> 1600x1200; sin envoltura asociada -> usa `w/h` y avisa; subir una
  foto de 200x200 -> `se amplia 4x`.
- WP real: compra de prueba con `phsize: 1` y verificar el tamano del PNG en el pool y el
  resultado en el PDF.

## Fuera de alcance

- **`escala: 'sin-ampliar'`** (D7): no ampliar la foto; toca el Motor y va en su propia spec.
- **Tamano por instancia**: el grupo tiene N instancias de tamanos distintos; `phsize` usa
  el **base** (la figura mas grande). Elegir una instancia concreta no entra.
- **Editor visual de ranuras** en la consola: sigue fuera (spec 018 D1).
- **Tocar `engine/` o `modules/textmuy/`** (D8).
