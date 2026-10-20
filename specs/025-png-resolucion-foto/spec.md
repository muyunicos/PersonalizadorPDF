# 025 — PNG a resolución de la foto (el cargador nunca amplía)

> Estado: **en implementacion (2026-10-20)** — reemplaza el modelo de la spec 023: `escala` deja
> de ser una propiedad de la ranura y pasa a ser **regla general** del sistema.
>
> Objetivo del negocio: que el navegador **nunca** agrande la foto. El PNG del comprador se genera
> a la **resolución real del recorte** (acotada por el hueco), de modo que:
> (a) se sube/descarga/procesa **menos** y ocupa **menos disco**;
> (b) la **única** ampliación posible la hace el **Motor** al encajar en el hueco (un solo paso, y
> a futuro con un método de calidad tipo Lanczos), en vez de una ampliación previa y rudimentaria
> en el navegador que después se vuelve a escalar en el PDF.

## Regla (verificada con ejemplos del negocio)

> **El PNG mide `lienzo × min(1, factor)`**: el **recorte a escala natural**, acotado por el hueco.
> Nunca amplía y nunca guarda más píxeles que el hueco.

| Caso | Foto | Lienzo | Modo | Recorte a escala 1 | PNG |
|---|---|---|---|---|---|
| E1 | 200×300 | 1000×1000 | Estirar | 300×300 (lado mayor) | **300×300** |
| E2 | 600×400 | 600×300 | Rellenar (2:1) | 600×300 | **600×300** |
| E3 | 1000×2000 rotada (2000×1000) | 1000×2000 | Rellenar (1:2) | 500×1000 | **500×1000** |
| E4 | 300×200 | 500×500 | Rellenar (1:1) | 200×200 | **200×200** |
| E5 | 4000×2000 | 1000×500 | Rellenar (2:1) | 4000×2000 | **1000×500** (acotado) |
| E6 | 1100×901 | 463×463 (`phsize:1`) | Rellenar (1:1) | 901×901 | **463×463** |

## Decisiones

| # | Decision |
|---|---|
| **D1** | **`escala` deja de ser propiedad de ranura**: el cap a `1x` es **regla general** (se elimina del contrato, de los normalizadores y del `campo.js`). |
| **D2** | **Estirar** mantiene el **lado mayor** de la foto (el que no se estira) y adapta el otro al aspecto del lienzo. |
| **D3** | **Rellenar** = **recortar al aspecto del lienzo sin ampliar** (`rw = min(aw, ah·ratio)`, `rh = min(ah, aw/ratio)`). Ya no es "cover con ampliación". |
| **D4** | **Ajustar** = contain **capado a 1** (la foto entera, a tamaño natural o reducida). |
| **D5** | **El PNG mide `min(lienzo, caja)`** por eje, manteniendo el aspecto (el recorte tiene el mismo aspecto que el lienzo). |
| **D6** | **El Motor no se toca**: `Imagen::normalizar` ya lee el tamaño real del PNG y lo encaja a `W×H`; la ampliación final es **una sola**, ahi. |
| **D7** | **El pool no re-amplía**: `rasterizar()` (contain a `g.w×g.h`) pasa a **capar a 1**. |
| **D8** | **Lanczos** (ampliación de calidad en el Motor) queda **fuera de alcance**: etapa siguiente. |

## Alcance

| Archivo | Cambio |
|---|---|
| `assets/selector-pmu.js` | `escalaBase(modo, iw, ih, W, H)` sin flag (D2/D3/D4); `_generarLienzoSalida` con lienzo `W·k × H·k` y `ctx.scale(k)`; quitar `escala`/`sinAmpliar` del config, `_setZoom` (max 1), `_actualizarControlesModo`, `_cargar` y `_badge` |
| `assets/tienda.js` | `rasterizar()` capado a 1; quitar `escala` del normalizador |
| `assets/cargador-pmu.js` | quitar `escala` de la ranura |
| `personalizador-pdf.php` | **sin cambios** (`handle_pool_png` ya acepta cualquier tamaño y solo limita 8 MB) |
| `engine/*` | **sin cambios** |
| `tests/*` | E1–E6 como checks + normalizacion |
| `specs/012.../contracts/campos.md` (v7), `AGENTS.md` §7, `readme.txt` (4.16.0) | docs |

## Verificacion

- Node: `node tests/selector-contrato.test.js` (E1–E6 + la regla de no ampliar), `campos-contrato`,
  `mockup-contrato`, `conciliacion` (regresion).
- PHP: `php -l`, `php tests/texto_puente.php ficha` / `campo_subida` / `vista_previa` / `pedido` /
  `completados` (el Motor **no** cambia: regresion), `motor_smoke`, `parity`.
- WP real: subir una foto de 1100×901 en un hueco de 463 → el PNG de `subidas/` mide **463×463**
  (no 1000), pesa menos y el PDF se ve igual o mejor (una sola ampliacion, en el Motor).
