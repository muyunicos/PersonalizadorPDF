# Tareas — 020 Limpieza de legacy

> Regla: **no marcar `[X]` por aproximacion**. Estado: **en especificacion** (0/22).
> Version objetivo: 4.11.0. Un bloque = un commit con la bateria en verde (D10).

## B1 — Las 3 claves que salieron de la consola (D1-D3)

- [ ] **T001** `normalizar_datos_campo()`: fuera `protegido`, `array` y `texto_ayuda`.
- [ ] **T002** `campos_panel()`: fuera el filtro de `protegido` y el campo `array`.
- [ ] **T003** `campo_desde_post()`: fuera `protegido`/`array`/`texto_ayuda`.
- [ ] **T004** `assets/tienda.js`: fuera `campo.array` del estado (nadie lo lee).
- [ ] **T005** Arnés: quitar los checks de esas claves (`campos_migracion.php`, fase `campos`) y
  agregar el check de que `datos.json` **no** las tiene.

## B2 — `datos_con_legacy()` y el write-through (D5)

- [ ] **T006** Borrar `PMU_Uploads::datos_con_legacy()` y su llamada en `campo_editar()`.
- [ ] **T007** Fase `campos`: los checks "spec 018" de write-through se reemplazan por uno de
  "editar no arrastra claves muertas" (el `datos.json` queda exactamente con lo que se mando).

## B3 — El cargador legacy (D4)

- [ ] **T008** `plantilla_campo('imagen')`: `cargador => null` (sin red de seguridad).
- [ ] **T009** `assets/tienda.js`: borrar `montarCargadores()` y su llamada; `campo.cargador` deja
  de existir en `PMU_FICHA`.
- [ ] **T010** `campos_panel()`: fuera la clave `cargador` (y el `data-cargador` de la fila si ya no
  se usa en `admin.js`).
- [ ] **T011** `assets/admin.js`: el preview monta **solo** lo que declare el `campo.js` (fuera el
  bloque `campo.cargador && !campo.js`).
- [ ] **T012** `inc/class-pmu-uploads.php`: borrar `validar_cargador()` + `cargador_desde_texto()` y
  sus llamadas; fuera `cargador` del formato.
- [ ] **T013** Arnés: fuera los checks del cargador legacy (`campos`, `ficha`, `admin`) y el
  `data-cargador` de `fila_campo_html()`; puertas Node: la plantilla `imagen` **no** declara
  `cargador` y el legacy ya no existe en el JS.

## B4 — Los puentes de tupla v1 (D6)

- [ ] **T014** `campo_alta()`/`campo_editar()`: fuera el `if (is_array($tipo))` y el `isset($datos[1])`.
- [ ] **T015** `cargar_campos()`/`campos_panel()`: fuera el adaptador de tupla v1 (solo filas v2).
- [ ] **T016** Arnés: las fases que llaman con tupla (`campos`, `config`, `tienda`, `pedido`,
  `campo_subida`) pasan a la firma v2 (`campo_alta($tipo, $datos, $htm, $css, $js)`).

## B5 — Formatos muertos del cliente y de datos (D7)

- [ ] **T017** `assets/tienda.js`: fuera el filtro del id fantasma `'Array'` de `idsDe()`.
- [ ] **T018** `PMU_Uploads`: fuera la lectura de `envolturas.json` v1 (solo v2).
- [ ] **T019** `assets/mockup-render.js`: fuera el `ref` plano (namespace obligatorio `pdf:`/`mock:`)
  y su check en `mockup-contrato`.
- [ ] **T020** `PMU_Uploads`/`admin/pdfs.php`: fuera la migracion del layout viejo de `bonus`
  (`pdfs/{nombre}/bonus/` -> `uploads/pmu/bonus/`).

## B6 — Docs y cierre

- [ ] **T021** `AGENTS.md` §5 (formatos sin las claves muertas), §7 (entrada del 020) y §11 (quitar
  las filas de errores que ya no pueden ocurrir); contratos de la 012 (`campos.md`) y de la 011.
- [ ] **T022** Bateria completa del §9 en verde + recorrido manual minimo (un campo nuevo de imagen
  de punta a punta) y `readme.txt`/version **4.11.0**.

## Nota

Si al borrar un bloque aparece un consumidor real de la clave, **el bloque se frena** y se decide
con el usuario: la regla es no dejar codigo a medias.
