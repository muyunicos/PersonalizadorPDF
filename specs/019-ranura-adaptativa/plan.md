# Plan — 019 Ranura adaptativa (`phsize` + aviso de ampliacion)

> Version objetivo: **4.10.0**. Estado: **en especificacion** (0/16 implementadas).
> Alcance: cargador de imagenes (consola + ficha). **No toca `engine/` ni `modules/textmuy/`.**

## Alcance

Que la ranura del cargador pueda **tomar el tamano del hueco** del grupo (`phsize`) en vez
de llevarlo escrito a mano, y que el sistema **avise** cuando la foto del cliente se va a
ampliar. Todo **opt-in**: `phsize: 0` (default) es el comportamiento de hoy.

Fuera: `escala: 'sin-ampliar'` (toca el Motor; spec aparte), tamano por instancia, editor
visual de ranuras.

## Fases

### F1 — Servidor: publicar el tamano del grupo (`personalizador-pdf.php`)

- `campos_panel()`: cuando el campo tiene envoltura asociada en ese PDF
  (`config.json:campos_envoltura`), publicar `grupo_w`, `grupo_h` y `grupo_gid` en la fila
  del campo. Sin asociacion: las tres claves en `null` (FR-001/FR-003).
- El dato ya esta a mano en `panel_ficha()` (`envoltura_defecto()` + el `$gid` del mapeo);
  hay que **pasarlo** hasta `campos_panel()`, que hoy recibe solo los campos elegidos.
  Riesgo: la firma de `campos_panel()` cambia -> revisar sus llamadores y el arnes.
- `inc/class-pmu-uploads.php`: `validar_cargador()` conserva `phsize` al normalizar
  (D9/FR-007).

### F2 — Cliente: resolver `phsize` (`assets/tienda.js`)

- `montarCargador()`: antes de instanciar `CargadorPMU`, normalizar cada ranura:
  `w/h` finales segun `phsize`, cap `PH_MAX` (FR-005), degradacion con `console.warn` si
  no hay `grupo_w/h` (FR-003) y derivacion de la forma (FR-004).
- Extraer la normalizacion a una funcion pura (`normalizarRanura(ranura, defCampo)`) para
  poder testearla sin DOM, en la linea de `PURO` de la 012.

### F3 — Aviso de ampliacion (`assets/selector-pmu.js`, `assets/cargador-pmu.js`)

- `selector-pmu.js`: calcular el factor de ampliacion al confirmar el recorte
  (`min(lado_x/ancho, lado_y/alto)`) y mostrarlo como badge `se amplia Nx` cuando es > 1
  (FR-006). Informativo: no toca el flujo de "Aceptar".
- `cargador-pmu.js`: el mismo aviso en la tira de la ranura, junto al badge de medidas que
  ya existe.
- Sin imagen cargada no hay aviso (no se inventa nada).

### F4 — Tests

- `tests/campos-contrato.test.js`: `phsize` 0/1/2 -> tamano final; cap; degradacion sin
  grupo; precedencia de `forma`. (La normalizacion es pura: se testea directo.)
- `tests/selector-contrato.test.js`: el aviso de ampliacion existe y es informativo.
- `php tests/texto_puente.php` fase `ficha`: `grupo_w`/`grupo_h`/`grupo_gid` publicados con
  asociacion y `null` sin ella; fase `campos`: `validar_cargador` conserva `phsize`.
- Regresion: `motor_smoke`, `parity`, `mockup-contrato`, `conciliacion`, `campos_migracion`.

### F5 — Docs y cierre

- `specs/012.../contracts/campos.md`: tabla de ranura v5 (`phsize`).
- `specs/016.../contracts/selector-visual.md`: el aviso de ampliacion.
- `AGENTS.md` §5 (contrato de ranura) y §11 (fila nueva: "la ranura quedo del tamano
  viejo" -> `phsize`), `specs/INDICE.md`.
- `readme.txt` (changelog 4.10.0) + bump de `* Version:` (fuente unica).

## Orden de implementacion

1. F1 + F4 parcial (el servidor publica el tamano; el test de la fase `ficha` lo fija).
2. F2 + F4 parcial (normalizacion pura + checks Node). Esto ya habilita US1 y US2.
3. F3 + F4 parcial (aviso). US3.
4. F5 (docs + release).

## Riesgos

- **`campos_panel()` cambia de firma**: es la funcion que alimenta `PMU_FICHA.campos[]` en la
  ficha **y** en el preview de la consola. Preferible: pasar el mapa de grupos por parametro
  (no leer el PDF dentro) y cubrir ambos llamadores con la fase `ficha` y `admin`.
- **`phsize: 2` con grupos grandes**: el cap `PH_MAX` evita PNGs enormes, pero el aviso debe
  ser visible para que el admin no crea que el tamano pedido se respeto.
- **Aviso de ampliacion en el comprador**: es informacion util, pero **no** debe parecer un
  error (ni bloquear). Redaccion neutra (`se amplia 3.3x`) y color informativo, no rojo.
- **Legacy**: un `cargador` viejo en `datos.json` sin `phsize` no cambia de comportamiento;
  `validar_cargador` solo **conserva** la clave nueva (no la inventa).
