# Tasks — Spec 028 (los 3 modos de encaje y el lienzo de salida)

> Estado: **cerradas** (2026-10-20, v4.19.0). Pendiente solo el recorrido manual
> en WP real (T011).

## Nucleo (`assets/selector-pmu.js`)

- [X] **T001** — `escalaBase()` con los modos clasicos: `cubrir` = `e = max(W/iw, H/ih)`,
      `encajar` = `e = min(W/iw, H/ih)`, `estirar` = `W x H`. Docblock con la **tabla
      normativa** y la frase del invariante (deforma vs. sobrante).
- [X] **T002** — `modoCanonico()` (pura) + alias `rellenar`/`ajustar` y
      `cover`/`contain`/`fill`; default `cubrir`. Exportada en `SelectorPMU.puro`.
- [X] **T003** — `_generarLienzoSalida()`: el PNG mide **el lienzo** (`W x H`), sin
      `min(caja, lienzo)` ni `setTransform(k)` (D6).
- [X] **T004** — `_setZoom()` 0.25x–4x + slider `min="-100" max="100"` (D5).
- [X] **T005** — Botones con **icono SVG + etiqueta** (`ICO_MODO`) y `title`
      (`TITULO_MODO`): Cubrir / Encajar / Estirar (D1).
- [X] **T006** — `_cargar()`: default por caso (>5% `cubrir`; <=5% `estirar`) y reset del
      slider (D8).
- [X] **T007** — `_actualizarControlesModo()`: caso <=5% -> **un** boton
      "Ajustar al marco" (`data-accion="reencuadrar"`), activo solo si la composicion esta
      por defecto (D7).
- [X] **T008** — `_reencuadrar()`: modo del caso + Escala 1x + desplazamiento 0; el click lo
      distingue por `data-accion` (D7).
- [X] **T009** — `_rotar()`: recalcula el 5% y **siempre** refresca los controles (el boton
      unico puede pasar a 3 modos y al reves).
- [X] **T010** — `_badge()`: lienzo + modo + Escala (el badge es `tecnico`, solo consola).

## Config y avisos (`assets/tienda.js`)

- [X] **T011** — `PURO.normalizarRanura()`: aviso cuando `phsize: 0` y el lienzo declarado no
      es el hueco del grupo (D9).
- [X] **T012** — **Fix de la 027**: `PURO.normalizarRanura()` **devuelve `transp`**. Sin esto
      `CargadorPMU` la recibia vacia y la politica del campo se perdia **en la ficha**
      (el normalizador de `cargador-pmu.js` la leia de un objeto que ya no la traia).

## Puertas

- [X] **T013** — `tests/selector-contrato.test.js`: F2b reescrito con **propiedades** (Cubrir no
      deja huecos / Encajar entra / Estirar es el marco / el invariante), los casos del negocio,
      el PNG = lienzo, la Escala 4x, el aviso D9 y el `transp` (fix 027).
- [X] **T014** — `tests/selector-contrato.test.js` F2f: **vocabulario** (`modoCanonico` con
      alias, ids ↔ etiquetas ↔ iconos, default por caso, boton unico del <=5%) y F1 actualizado.
- [X] **T015** — `tests/campos-contrato.test.js`: `phsize: 0` usa lo declarado **y avisa** si no
      es el hueco (la expectativa vieja exigia `aviso === ''`).

## Docs y release

- [X] **T016** — `specs/028-modos-lienzo/` (spec + `contracts/modos.md` + tasks) e
      `specs/INDICE.md` (025 marcada como **SUPERADA**).
- [X] **T017** — `AGENTS.md` §5/§7 + `admin/ayuda.php` (seccion de los 3 modos con la tabla).
- [X] **T018** — Version 4.19.0 (cabecera de `personalizador-pdf.php` + `readme.txt`).

## Tope de resolucion del PNG (D11)

- [X] **T020** — `escalaSalida(modo, iw, ih, W, H, zoom)` (pura, exportada en `puro`):
      `k = min(1, max(iw,ih)/max(caja))` y el PNG mide `round(W·k) x round(H·k)`.
- [X] **T021** — `_generarLienzoSalida()`: canvas `med.w x med.h` + `setTransform(med.k, ...)`
      con la composicion del lienzo entero (sin `k` no se toca el contexto). Sin foto: el lienzo.
- [X] **T022** — `_badge()`: tamano **real** del PNG + `(N% del hueco)` cuando `k < 1`.
- [X] **T023** — Puerta: propiedades del tope (nunca supera el lienzo / nunca amplia la foto /
      conserva el aspecto del lienzo) + los casos del negocio (400x300 en 1000x1000 → 300x300 /
      400x400 / 400x400), la Escala 4x (75x75) y la foto grande (k=1 → 1000x1000).
- [X] **T024** — Contrato (`contracts/modos.md`), `AGENTS.md`, `admin/ayuda.php`, changelog e indice.
- [ ] **T019** — **Recorrido manual en WP real**: ficha con un campo de imagen; foto con aspecto
      distinto (>5%) y foto con aspecto casi igual (<=5%); probar los 3 modos, la Escala hasta 4x,
      el arrastre y "Ajustar al marco"; comprobar que el PDF final es igual a la vista previa.
