# Auditoria del pipeline de carga/subida (Fase 0)

> Fecha: 2026-11-22. Alcance: **solo lectura**, sin cambios de codigo.
> Estado: **A1 y A2 corregidos** en v4.36.1 (spec `045-bugs-cargador`, con puerta
> `tests/cargador-estado.test.js`). A3-A8 siguen pendientes (spec 044).
> Objetivo: mapa del pipeline del comprador, deuda estructural y hallazgos
> verificados por lectura de codigo, para decidir despues el spec (044/045).
> Jerarquia: `constitution` > `AGENTS.md` > resto.

## 1. Metodo

- Lectura completa de `assets/cargador-pmu.js` (1.014 lineas) y
  `assets/biblioteca-pmu.js` (456), mas los tramos criticos de
  `assets/selector-pmu.js` (2.043) y `assets/tienda.js` (2.169).
- Verificacion de los contratos en PHP: `inc/class-pmu-sesion.php`
  (`clave_receta`, `guardar_subida`), `inc/class-pmu-lectura.php` (`listar`),
  `media.php`.
- Puertas ejecutadas hoy: `media_lectura` 75, `biblioteca-contrato` 81,
  `selector-contrato` (F0-F5), `campos-contrato`, `motor_smoke`, `parity`,
  `texto_puente` (12 fases) y `ficha-pedido.browser.js` **53/53**.
- **No** es una auditoria de comportamiento en produccion: los hallazgos son
  estaticos y **hay que reproducirlos** antes de darlos por bugs.

## 2. Mapa del pipeline

```
campo.js (del comprador)
  └─ PMU_API.montarCargador(el, {ranuras})          assets/tienda.js:2090
       ├─ PURO.normalizarRanura(r, defCampo)        assets/tienda.js:41      (normalizador 1)
       └─ new CargadorPMU(el, {...})                assets/cargador-pmu.js:203
            ├─ normalizarRanuras(ranuras)           assets/cargador-pmu.js:59   (normalizador 2)
            ├─ _bloque() / _pintar()                ranuras, miniaturas, aviso
            ├─ _abrir() -> new SelectorPMU(...)     assets/selector-pmu.js:540
            │    ├─ open() / _cargar() / _dibujar()  recorte Canvas 2D
            │    ├─ _params()                        receta v2 (w/h/modo/escala/ox/oy/rot/fondo/gid/phsize)
            │    ├─ subirAsync(blob) -> _subir()     assets/cargador-pmu.js:515
            │    ├─ usarExistente(id, params, url)   assets/cargador-pmu.js:640  (0 bytes)
            │    └─ declararReceta(id, params)       assets/cargador-pmu.js:432  (0 bytes, spec 043)
            ├─ _editar() / _cambiar() / _quitar()    miniatura -> editor / visor / baja
            └─ onChange(estadoActual())              -> tienda.js (minimos, galeria)
  └─ api.subirFoto(blob, cid, ctx)                   assets/tienda.js:1972
       └─ POST personalizador_pdf_subida (original + receta)
            └─ PMU_Sesion::guardar_subida()          inc/class-pmu-sesion.php:919
                 ├─ id = sha1(bytes)[:12]            (dedupe por contenido)
                 ├─ clave_receta(params)             inc/class-pmu-sesion.php:907
                 └─ catalogo (uploads.json) + miniatura 80x80

Biblioteca (tira del modal y "Ver todas"):
  assets/biblioteca-pmu.js
    ├─ pedirRapido()  GET  media.php?op=listar      (sin WordPress)
    ├─ pedirWp()      POST admin-post (respaldo)
    ├─ cache localStorage `pmu_bib_v3` (TTL 20 min, frescura 5 min)
    ├─ pintarTira() / delegarTira()  (tema `MU.coleccion`, blando)
    └─ verTodas() -> PMUVisor (assets/visor-pmu.js) -> MU.visor del tema (blando)
```

## 3. Hallazgos

### A1 (ALTA) `_reemplazo` sobrevive al guardar desde la biblioteca
- Donde: `assets/cargador-pmu.js:800` (`_editar` lo setea), `:640`
  (`_usarExistente` **no** lo limpia), `:417-419` (solo `_subir` lo limpia),
  `:469-471` (se limpia al cancelar).
- Que pasa: editar una foto desde la miniatura y pulsar **Guardar** deja
  `_reemplazo` cargado. La **siguiente** foto nueva de una ranura con `max>1`
  entra por `_subir(indice, blob, reemplazo.posicion)` y **pisa** la foto editada
  en vez de agregarse.
- Repro: campo imagen con `min 1 / max 2` -> subir A -> tocar la miniatura ->
  Guardar -> "Cargar imagen" -> subir B -> B reemplaza a A (la tira sigue con 1).
- Impacto: perdida silenciosa de una foto del carrito.

### A2 (MEDIA) `open()` no reinicia el estado visual del selector
- Donde: `assets/selector-pmu.js:653` (`open`), `:2003` (`close`), `:1011`
  (`_prepararNuevaCarga`, el unico que limpia `imagen`/`_bib`).
- Que pasa: la instancia del selector se reutiliza por ranura
  (`cargador-pmu.js:397`). Al reabrir, `this.imagen` sigue siendo la ultima foto y
  `_bib` sigue cargado: el modal muestra la foto anterior con **Eliminar** y
  **Ver en grande** activos sobre una imagen que no es la actual.
- Repro: abrir el editor desde una miniatura -> cerrar con la X -> "Cargar imagen"
  -> el modal muestra la foto anterior.
- Impacto: el comprador cree que la foto nueva no se cargo; puede borrar la
  anterior sin querer.

### A3 (MEDIA, deuda) dos normalizadores de ranura
- `assets/tienda.js:41` (`PURO.normalizarRanura`) y `assets/cargador-pmu.js:59`
  (`normalizarRanuras`).
- Ya esta documentado (`tienda.js:94`, "anti-divergencia") y hay puerta
  (`campos-contrato`): cualquier clave nueva hay que ponerla en los dos.

### A4 (MEDIA) el respaldo se vuelve pegajoso
- `assets/biblioteca-pmu.js:39` (`modo='auto'`) y `:128/:132/:137/:148`
  (`modo='wp'`), sin volver nunca a `auto`.
- Un solo fallo de `media.php` (o una identidad distinta) baja toda la sesion al
  camino pesado.

### A5 (MEDIA) `config()` cachea endpoint/nonce de la ficha
- `assets/biblioteca-pmu.js:41-56`: `if (cfg && cfg.url) return cfg;`
- Si `PMU_FICHA` cambia (otro item, carrito re-renderizado, AJAX), se sigue usando
  el `nonce`/`item_key` viejo.

### A6 (BAJA) `f.base` no existe en el payload
- `PMU_Lectura::listar` no emite `base`, pero `biblioteca-pmu.js:301` y `:353` lo
  usan: codigo muerto (cae siempre a `f.url`).

### A7 (BAJA, perf) `verTodas` pide miniaturas por URL
- `biblioteca-pmu.js:215`: `f.thumb_data || f.thumb || f.url`; con mas de 10 fotos
  las que no traen `thumb_data` hacen 1 request cada una (contradice el "0
  miniaturas sueltas" de la 042).

### A8 (BAJA) estado en memoria
- `_fallos` (`cargador-pmu.js:239`), `_urls` (`:242`) y `recetas` (`:243`) viven en
  la pestaña: al recargar se pierden (documentado para `_fallos`).

## 4. Ambiguedades de comentarios y docs

- `selector-pmu.js:663-665` dice "039 D6: el primario dice SIEMPRE `Guardar` y
  SIEMPRE viajan bytes", pero la rama `_bib` (`:1804`) hace **0 bytes** (040 A6 +
  043 US1). El comentario quedo viejo y contradice el codigo.
- `INDICE.md`, `AGENTS.md` y `readme.txt` quedaron al dia hoy (042/043, 53/53,
  `media_lectura` 75). Resta revisar `docs/errores.md` y `docs/decisiones.md`.

## 5. Que spec manda hoy

- 016 (editor visual): motor superado por 021; 043 agrega recetas.
- 021 (selector): vigente, con 024 (modal), 027 (transparencia), 028 (modos).
- 030 (biblioteca): enmendada por 039 (sin familias), 042 (lectura rapida) y 043
  (visor).
- 035 (originales + receta v2) y 036 (mockup optimizado): vigentes.
- 039 (friccion): D2/D3/D6 vigentes. 040 (catalogo): vigente.
- 042 (lectura rapida) y 043 (editor + biblioteca): vigentes.
- 023 y 025: SUPERADAS (solo historial).

## 6. Propuesta

- **Spec 044 (limpieza/orden)**: unificar el normalizador de ranura en un unico
  modulo compartido; retirar `f.base` y el codigo muerto; decidir el futuro del
  respaldo (`modo` sticky) y de `config()`; actualizar comentarios y docs. Todo con
  puertas verdes antes y despues, un commit por bloque.
- **Spec 045 (bugs del cargador)**: A1 y A2, con puertas que **fallan antes** y
  **pasan despues**; mas los sintomas que aporte el usuario.
- **Orden**: si los sintomas son bloqueantes, 045 primero; si no, 044 primero
  (limpiar con red) y 045 despues.

## 7. Sintomas a confirmar (plantilla)

- Pagina + accion exacta + esperado/recibido + consola F12 + request de Network.
- Si es foto: como se cargo (nueva / biblioteca / editar receta) y si habia otra.