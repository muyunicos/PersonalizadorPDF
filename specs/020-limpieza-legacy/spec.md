# 020 — Limpieza de legacy (el repo en desarrollo no arrastra compatibilidad)

> Estado: **en especificacion** (sin implementar). Origen: decision del negocio 2026-10-19.
> Version objetivo: **4.11.0**.

## Decision del negocio (la regla)

En desarrollo, el admin **borra los campos viejos y regenera los PDFs** en cada cambio de
esquema. Por lo tanto:

- **No hay migraciones ni retrocompatibilidad de datos de usuario.**
- El codigo no carga ramas de compatibilidad para formatos que ya no se producen.
- Prioridad: **claridad y tamano** por encima de "no romper" a datos que nadie conserva.

Esto NO aplica a: la **norma ex-008** (constitucion §IV: `analisis.json` + `config.json`,
`tmp/sesion-{sid}/{item_key}/`), que es contrato vigente, ni a las **features** (validez por
producto, `preview_omisible`, bonus, mockups, TextMuy).

## Decisiones

| | Decision |
|---|---|
| **D1** | **`protegido` se ELIMINA como feature**: sale de `datos.json`, de `campos_panel()` (el filtro que hoy impide que un campo protegido viaje a la ficha) y de la documentacion (FR-040 de la 012). |
| **D2** | **`array` sale del almacen**: lo calcula el cargador en runtime (`esArray()` sobre las ranuras). Se borra de `datos.json`, de los normalizadores y de la tupla. |
| **D3** | **`texto_ayuda` sale del formato**: no tenia input ni consumidor. |
| **D4** | **El cargador LEGACY se elimina**: `datos.json:cargador`, la regla `cargador && !campo.js` (`tienda.js:montarCargadores`, `admin.js` en el preview), la red de seguridad de la plantilla (`cargador => 'size:1000 max:6'`) y `PMU_Uploads::validar_cargador()` (con `cargador_desde_texto`). El cargador vive **solo** en el `campo.js` (spec 018 D1). |
| **D5** | **`datos_con_legacy()` (write-through) se elimina**: existia para no perder D1-D4 al editar. Sin esas claves no hay nada que arrastrar. |
| **D6** | **Los puentes de tupla v1 se eliminan**: el array de 10 slots en `campo_alta()`/`campo_editar()` y el adaptador v1 en `cargar_campos()`/`campos_panel()`. El formato vigente es la fila v2 (`datos` + `htm`/`css`/`js`). |
| **D7** | **Se eliminan los demas formatos muertos**: el filtro del id fantasma `'Array'` en `tienda.js:idsDe()` (bug de 4.6.6), la lectura de `envolturas.json` **v1** (dedupe al leer), el `ref` **plano** de `mockups[]` (namespace `pdf:` implicito) y la migracion del layout viejo de `bonus` por PDF. |
| **D8** | **NO se toca**: la norma ex-008, `validez`/`mensaje_html`/`bloquear` (005), `preview_omisible`, `bonus[]` (formato vigente), el catalogo de campos v3, ni `modules/textmuy/`. |
| **D9** | Cada bloque **borra su cobertura del arnes** en el mismo commit (`tests/texto_puente.php` fases `campos`, `config`, `tienda`, `pedido`, `mockup*`, `bonus`) y actualiza `AGENTS.md` §5/§11 y los contratos de la 012/011. |
| **D10** | **Bloques, no big bang**: cada bloque cierra con la bateria completa en verde (`php -l`, 5 puertas Node, `campos_migracion`, `motor_smoke`, `parity` y las fases del arnes). Si un bloque deja algo en rojo, no se sigue. |

## Problema (lo que hoy sobra)

| Donde | Que arrastra |
|---|---|
| `personalizador-pdf.php` | `datos_con_legacy()`, el filtro `protegido` de `campos_panel()`, el puente v1 en `campo_desde_post`/`campo_editar`, la red de seguridad del cargador en `plantilla_campo()` |
| `inc/class-pmu-uploads.php` | `validar_cargador()` + `cargador_desde_texto()`, el puente v1 en `campo_alta()`/`campo_editar()`, `texto_ayuda`/`array`/`protegido` en `normalizar_datos_campo()`, la lectura v1 de `envolturas.json` |
| `assets/tienda.js` | `montarCargadores()` (todo el camino legacy), el filtro `'Array'` de `idsDe()`, `campo.array` |
| `assets/admin.js` | el montaje legacy del cargador en el preview (`campo.cargador && !campo.js`) |
| `assets/mockup-render.js` | `ref` plano sin namespace |
| `tests/texto_puente.php` | fases y checks que solo prueban esos caminos |

## Verificacion

- Por bloque: `php -l` de lo tocado + las 5 puertas Node (`campos-contrato`, `selector-contrato`,
  `mockup-contrato`, `conciliacion`, `validez`) + `php tests/campos_migracion.php` +
  `php tests/motor_smoke.php` + `php tests/parity.php` + las fases del arnes que el bloque toque.
- Al cierre: la bateria completa del §9 de `AGENTS.md` en verde y el arnes sin fases muertas.
- Manual (una sola vez al final): crear un campo con la plantilla **Imagen (cargador)**,
  asociarlo a un PDF, subir foto, vista previa y PDF. Sin campos viejos en el catalogo.

## Fuera de alcance

- **Spec 009** (galerias sprite unificado) y **spec 010** (API WordPress).
- **`escala: 'sin-ampliar'`** (no ampliar la foto): toca el Motor; va en su propia spec.
- **Norma ex-008** (constitucion §IV) y cualquier feature en uso.
