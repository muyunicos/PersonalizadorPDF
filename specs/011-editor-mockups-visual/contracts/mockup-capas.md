# Contract: Capas de mockup y render compartido

**Feature**: 011-editor-mockups-visual | **Version**: 8 (enmienda `004-woocommerce-pdf-personalization/contracts/mockups.md`; v3 envolturas PowerClip, v4 dedup de formas + forma representativa + guia del cargador, v5 grupos e importacion de paginas PDF, v6 transformaciones fuera del lienzo, v7 perspectiva y propiedades de grupo, v8 marco orientado y giro sin salto)

Contrato de la composicion de un mockup (`config.json:mockups[]`) y del **nucleo de render
compartido** que la usan el editor del admin y la ficha del cliente. Especificacion: [../spec.md](../spec.md).

## 1. Composicion persistida

```json
{
  "id": "fiesta",
  "titulo": "Fiesta",
  "creado": "2026-10-01T14:00:00Z",
  "capas": [
    {"tipo": "img", "ref": "pdf:fondo-fiesta", "x": 0, "y": 0, "w": 300, "h": 300,
     "rot": 0, "sesgo": 0, "nombre": "Fondo", "modo": "normal",
     "filtros": {"brillo": 95, "contraste": 110}},
    {"tipo": "placeholder", "ref": "0000FF#1", "x": 96, "y": 60, "w": 110, "h": 180,
     "rot": -3, "sesgo": 0.05, "oculta": false, "modo": "normal",
     "filtros": {"opacidad": 90}, "grupo": "g-pagina-1", "grupo_rot": 0,
     "perspectiva": {"puntos": [{"x": 0.08, "y": 0}, {"x": 1, "y": 0.12},
       {"x": 0.92, "y": 1}, {"x": 0, "y": 0.88}]}}
  ]
}
```

### 1.1 Campos de capa

| Campo | Regla | Cambio vs 004 |
|---|---|---|
| `tipo` | `img` \| `placeholder`; otro valor se descarta al guardar | = |
| `ref` | `{ambito}:{valor}`; `pdf:{archivo}` (foto del PDF) o `img:{id}` (id numerico del catalogo). **Sin `:` se lee como `pdf:`** | **ampliado** |
| `x`,`y`,`w`,`h` | int; `x,y` entre -3000 y 3000; `1 <= w,h <= 1200`; espacio logico 300x300. El contenido fuera del area se recorta en el lienzo de salida | ampliado |
| `rot` | float -360..360 (grados) | = |
| `sesgo` | float -1..1 | = |
| `filtros` | object; claves de §1.4; ausente = neutro | **ampliado** |
| `modo` | `normal` \| `multiply` (extensible); default `normal` | **nuevo** |
| `nombre` | string <= 60; default = derivado del `ref` | **nuevo** |
| `oculta` | bool; default `false` | **nuevo** |
| `bloqueada` | bool; default `false` | **nuevo** |
| `envoltura` | bool; default `false`; **solo** `tipo=placeholder` (en `img` el saneo fuerza `false`). Recorta la capa al clip vectorial del hueco en el PDF (PowerClip) | **nuevo (v3)** |
| `grupo` | opcional; id `g-` + 1..36 caracteres `[a-z0-9_-]`; agrupa capas para seleccion, movimiento y rotacion conjuntos en el editor. Sin efecto en el render de la ficha | **nuevo (v5)** |
| `grupo_rot` | float -360..360; orientacion compartida del marco del grupo; saneada y persistida en cada miembro para que los tiradores sigan la rotacion. Sin efecto si no hay perspectiva | **nuevo (v8)** |
| `perspectiva` | opcional; `puntos` tiene exactamente cuatro puntos normalizados `(x,y)` en 0..1, en orden arriba-izquierda, arriba-derecha, abajo-derecha, abajo-izquierda. Solo se persiste si el cuadrilatero es convexo y no neutro. Debe repetirse en los miembros del grupo; la deformacion compone el grupo como una sola pieza en el mockup | nuevo (v7) |

### 1.3 Grupos e importacion de pagina PDF — v6

- Agrupar asigna el mismo `grupo` a todas las capas seleccionadas; desagrupar elimina ese campo
  de sus miembros. Al seleccionar cualquier miembro, el editor selecciona el grupo completo.
- El movimiento conserva las posiciones relativas; la rotacion conjunta se aplica alrededor del
  centro del marco del grupo y suma el mismo angulo a cada capa. Las capas y grupos pueden
  sobrepasar cualquier borde del area 300x300; el contenido fuera del area queda recortado solo al
  dibujar la salida. Las coordenadas se limitan a ±3000 px como proteccion frente a valores extremos.
- El marco de un grupo seleccionado ofrece ocho tiradores de escala uniforme alrededor de su
  centro y permite dimensiones de hasta 1200 px; las capas bloqueadas impiden transformar el grupo. El control de rotacion permanece
  dentro del lienzo cuando el borde superior o inferior coincide con el limite.
- El marco de grupo se calcula en los ejes de `grupo_rot`; el rectangulo, los ocho tiradores,
  el control de rotacion, el hit-test y los cuatro puntos de perspectiva comparten esa misma
  transformacion. La rasterizacion temporal de perspectiva usa el mismo marco orientado.
- El tirador de rotacion de una capa individual aplica el delta angular desde el inicio del gesto
  a la rotacion existente; tomar el control no cambia el angulo por si solo. `Shift` ajusta a 15°.
- Al insertar una imagen del catalogo, la caja inicial usa sus dimensiones naturales y conserva
  la proporcion, centrada y ajustada al lienzo; no se selecciona una caja cuadrada distinta de
  los limites visibles de la imagen.
- Las propiedades X/Y/ancho/alto/rotacion actuan sobre el grupo seleccionado. El lienzo presenta
  cuatro tiradores rojos para transformar la perspectiva de todo el grupo; la salida del editor y
  la ficha usan el render deformado. La transformacion no altera el PDF procesado ni los PNG del pool.
- La perspectiva rasteriza temporalmente el grupo y lo proyecta mediante una malla de triangulos
  Canvas 2D; conserva transparencia, z-order y PowerClip del mockup. Cuadrilateros cruzados o
  degenerados no se aceptan. Restablecer perspectiva vuelve los cuatro puntos al rectangulo original.
- La seleccion automatica de grupo se puede anular temporalmente con **Alt+clic** sobre una capa,
  tanto en el lienzo como en la lista. Asi se mueve, redimensiona o rota un miembro sin cambiar su
  pertenencia al grupo; seleccionar normalmente vuelve a expandir el grupo.
- En los botones ▲/▼ de la lista, un clic mueve la capa seleccionada un nivel. Mantener el boton
  pulsado durante 1 segundo la envia al extremo superior/inferior; en una seleccion de grupo se
  reordena el conjunto como bloque. El gesto se cancela al mover el puntero o soltar antes, y se
  registra como una sola accion de deshacer.
- **Importar pagina + PH** recibe el numero de pagina. PDF.js, servido localmente desde el plugin,
  rasteriza esa pagina como una imagen de catalogo; el motor PHP devuelve las instancias de
  placeholders de esa pagina usando el `Detector`. Se crean una capa de imagen y una capa por
  instancia, con referencias PH reales y su estado PowerClip, y todas reciben un mismo `grupo`.
- La importacion no modifica `analisis.json` ni `envolturas.json`; los datos de geometria y
  envoltura se consultan bajo demanda. La operacion es local al navegador y al servidor WordPress,
  sin subir el PDF a un servicio externo.

### 1.4 Ajustes (`filtros`)

| Clave | Rango | Default | Mecanismo |
|---|---|---|---|
| `brillo`, `contraste`, `saturacion` | 0..200 (%) | 100 | `ctx.filter` |
| `gama` | 0..200 (%) | 100 | `ctx.filter: grayscale()` |
| `opacidad` | 0..100 (%) | 100 | `ctx.globalAlpha` |
| `desenfoque` | 0..20 (px) | 0 | `ctx.filter: blur()` |
| `tono` | -180..180 (grados) | 0 | `ctx.filter: hue-rotate()` |

Valor = default -> se borra al guardar. **`gama` hoy se acepta y no se aplica**: este contrato
obliga a aplicarla (bug corregido: `class-pmu-uploads.php:729` lo acepta, `filtroCss()` lo ignora).

### 1.5 Enmienda explicita al contrato 004

El contrato 004 declaraba `capas[].ref` = "id del catalogo `img/` o `mockups/{archivo}`", formato que
el validador hacia **imposible** (rechazaba cualquier `ref` con `/`, `class-pmu-uploads.php:723`).
Este contrato lo reemplaza por el namespace `pdf:` / `img:` y aclara la misma regla: el recurso del
catalogo se referencia por **id numerico**, no por nombre de archivo (el nombre puede cambiar en una
edicion del catalogo; el id no). `ref` plano se tolera como `pdf:`.

### 1.6 Envolturas (PowerClip del PDF) — v4

Un placeholder puede venir **recortado dentro de una forma vectorial** en el PDF (PowerClip de
CorelDRAW: corazon, estrella, etc.). El procesado ya lo respeta en el PDF final (`Overlay`
splicea la imagen dentro del clip activo, AGENTS §4.5); aqui se define su **previsualizacion**: en
el mockup (recorte de la capa) y en el cargador del comprador (guia al subir la foto).

- **Extraccion**: `Detector` captura el clip activo (`W`/`W*` + `q`/`Q`, tambien dentro de Form
  XObjects) al detectar cada instancia; `Metadata::generarEnvolturas` lo normaliza al marco del
  rect y lo escribe en el archivo **derivado** `pdfs/{nombre}/envolturas.json`
  (regenerado en Subir PDF / Re-analizar; **nunca** vive en `analisis.json`):

  ```json
  { "version": 2, "pdf": "muestra", "creado": "...",
    "grupos": { "0000FF": {
        "formas": [ {"par":0, "usos":598, "subs":[ {"m":[0.5,-0.2], "s":[["c",1,0.5,1,1,0,1]], "c":1} ]} ],
        "defecto": 1,
        "mapa": { "1": 1, "2": 1, "37": 2, "42": 0 } } } }
  ```

  - **`formas`**: las formas **DISTINTAS** con sus `usos` (una sola copia por forma: un grupo de
    600 instancias con el mismo marco ocupa ~12 KB, no 600 copias ni 100 truncadas);
  - **`defecto`**: la forma **mas usada** (empate -> la primera); es la "representativa" del grupo;
  - **`mapa`**: `n -> k` para **TODAS** las instancias (k=0 = sin envoltura). Es completo (ints,
    barato) para que el override del admin no falsee la geometria real de cada instancia;
  - `par`: 1 = even-odd (`W*`), 0 = non-zero (`W`); `subs[].m` + segmentos planos
    `["l",u,v]` / `["c",u1,v1,u2,v2,u3,v3]`; `c` cierra la subruta;
  - coordenadas **normalizadas 0..1** sobre el rect del placeholder, con `v` ya en espacio canvas;
  - topes: `Metadata::ENV_MAX` (100) **formas distintas** por grupo y `Metadata::ENV_SEG_MAX`
    (5000) segmentos por forma;
  - **`grupos` vacio = "analizado sin envolturas"**; archivo ausente = analizado con una version
    sin soporte (Re-analizar). Un archivo **v1** (una entrada por instancia) se deduplica EN
    MEMORIA al leer: nada se rompe antes de re-analizar.
- **Forma representativa (config editable)**: `config.json:envolturas{gid:{forma:k}}` — el admin
  la elige en la cabecera del grupo (consola: "Envoltura: [1..N]", deshabilitado con "sin
  envolturas"). `0`/ausente = la detectada. Resolucion de `gid#n`:
  **`mapa[n]` > override > `defecto`** (el override cambia la representativa —guia del cargador y
  relleno del mockup—, nunca la geometria real de una instancia).
- **Envio al navegador (sin superficie publica nueva)**: `datos_pdf_render` publica por grupo
  `env_defecto` (la forma por defecto, **UNA vez**) + `env_exc` (`{n:k}`, solo lo que difiere del
  defecto) + `env_formas` (N) + `envs` (geometria de las **excepciones usadas** en los mockups
  guardados) + `envolturas:{disponible,formas,defecto,usos,excepciones}`. Con eso, una instancia
  que usa la forma por defecto **no pide nada**; una excepcion pide su geometria via
  **`op=envoltura`** (`admin_post_pmu_uploads`, nonce + capability; respuesta
  `{archivado, forma, envoltura|null}`) y se cachea en `estado.envs`.
- **Capa del mockup**: `envoltura: true` en una capa placeholder. `envolturaDeRef(ref, grupos)`
  resuelve **excepcion > geometria resuelta > forma por defecto** (una excepcion pendiente NUNCA
  cae a la default). `componer` traza la envoltura (`comandosEnvoltura` + `trazarEnvoltura`) y
  aplica `ctx.clip(regla)` ANTES de dibujar; afecta igual al editor y a la ficha.
- **Guia del cargador (spec 019 F2)**: la guia se **DEDUCE** del **cableado del hueco**
  (`[campoN]` en `value`/`settings` del grupo con envoltura) y, si el PDF tiene un solo grupo con
  envoltura y el campo declara tipo `imagen`, de ese (`campos_envoltura_deducida()`). **No hay
  `<select>` por campo**: `config.json:campos_envoltura` dejo de usarse (se limpia al guardar la
  config y se elimina del formato en la spec 020). `panel_ficha` resuelve la forma por defecto del
  grupo y la publica en el campo (`envoltura` + `envoltura_gid`);
  `cargador-pmu.js` dibuja un canvas de guia por ranura (`_guia`, reusa `comandosEnvoltura`). El
  PNG del pool va **sin cortar**: el corte real lo hace el clip del PDF (evita doble corte).
- **Degradacion**: sin envoltura la capa compone sin clip y el editor informa la causa
  diferenciada: **sin archivo** -> "pulsa Re-analizar para extraerlas"; **instancia con `k=0`** ->
  "esta instancia no tiene envoltura en el PDF"; **con archivo pero sin forma** -> "no esta
  recortado en ninguna forma". Si el pedido falla (red/servidor), la capa se desmarca **por `ref`**
  con aviso posterior al `refrescar()`.

## 2. Nucleo de render compartido

`assets/mockup-render.js` expone `PMUMockup`:

| Miembro | Contrato |
|---|---|
| `componer(ctx, capas, resolver, opciones)` | Dibuja `capas` en orden. `resolver(ref)` devuelve `{url, w, h}` o `null`. **Es la unica funcion de render del sistema** (criterio 004). |
| `contener(destino, recurso)` | Encaja el recurso en la caja **sin deformar** (regla `contain` vigente) y devuelve el rectangulo usado + si hubo discrepancia de proporcion. |
| `homografia(puntos, u, v)` | Puro: proyecta una coordenada normalizada del cuadrado unidad a un cuadrilatero de cuatro puntos. |
| `perspectivaConvexa(puntos)` | Puro: valida que los cuatro puntos formen un cuadrilatero convexo no degenerado. |
| `filtroCss(filtros, modo)` | Traduce ajustes a `ctx.filter` + `globalAlpha` + `globalCompositeOperation`. |
| `esValida(capa, contexto)` | Dice si la capa resuelve (foto en `fotos`/catalogo, grupo existente, indice dentro de `cont`). |
| `envolturaDeRef(ref, grupos)` | Envoltura (clip del PDF) de una capa placeholder segun su `ref` (v3). `null` = sin envoltura. |
| `comandosEnvoltura(env, caja)` | Puro: comandos `M/L/C/Z` de la envoltura mapeados 0..1 al rect de la capa. |
| `trazarEnvoltura(ctx, comandos)` | Trazado sobre el ctx (canvas path, sin Path2D). |

Reglas:

1. **Orden**: indice 0 al fondo. Las capas `oculta` se saltan (conservan geometria).
2. **Proporcion**: si la proporcion de la caja difiere de la del recurso, `contener()` encaja
   (**nunca estira**) y devuelve informacion de discrepancia para que el editor avise (FR-023/024).
   El cliente no avisa, solo encaja.
3. **Transformacion**: rotacion y sesgo se aplican alrededor del centro de la caja; cada capa se
   aisla con `save`/`restore` (mismo criterio que `Overlay` en el motor, AGENTS §4.4). Si un grupo
   trae `perspectiva`, el nucleo compone sus miembros en una superficie temporal y proyecta el
   resultado completo; las capas fuera de ese grupo conservan su orden normal.
4. **Degradacion**: si `resolver` devuelve `null`, la capa se dibuja como caja neutra con su
   `ref`; la composicion nunca falla (mismo criterio que la ficha actual).
5. **Ajustes**: solo afectan a la composicion; **nunca** al PNG del pool ni al PDF (contrato 004
   regla 1; constitution §III).
6. **Salida**: siempre 300x300 px. El zoom del editor es una lupa; el backing store escala, la
   geometria no.

## 3. Preview de grupo (store cliente)

`PersonalizadorPDF.previews[grupoId] = {url, w, h, hash, ts}`; evento `pmu:preview-listo` con
`{id, url, w, h}`. Detalle en [../data-model.md](../data-model.md). Regla dura: el editor **no**
renderiza; solo consume lo que produce `.ec-probar` (D2, FR-017/021).

## 4. Superficie del editor (contrato UI)

| Elemento | Contrato |
|---|---|
| Lienzo | ampliable (100/150/200/300 %), resolucion logica 300x300, fondo damero, marco 300x300 visible |
| Seleccion | tiradores (8) + tirador de rotacion + guias de imanes + etiqueta con medidas y nombre |
| Lista de capas | miniaturas, reordenable, con acciones (renombrar, duplicar, ocultar, bloquear, eliminar) y marca de invalida |
| Recursos | galeria de fotos del PDF (arrastrar archivo = sube y anade), catalogo `img/` con busqueda y categorias, lista de grupos con id/tamano/instancias |
| Galeria de mockups | miniaturas en vivo; crear, duplicar, renombrar, eliminar, reordenar |
| Teclado | flechas mueven (1 px; 10 px con modificador), Supr elimina, Ctrl+Z / Ctrl+Shift+Z deshace/rehace, Ctrl+D duplica, Ctrl+S guarda, `[`/`]` orden, Esc deselecciona |
| Estado | "Sin guardar" / "Guardando" / "Guardado" siempre visible |

Regla: **ningun flujo principal** usa `window.prompt`/`alert` (FR-042). `confirm` solo para bajas
irreversibles, con el conteo de capas afectadas (FR-016).

## 5. Puntos de aplicacion (checklist de FR-025)

Un ajuste nuevo debe estar en los **dos** lados, o el cliente ve distinto a lo que compone el admin:

- [ ] `PMU_Uploads::config_mockups` (allowlist + clamp) **y** `handle_mockups_guardar` (saneo)
- [ ] `PMUMockup.filtroCss` (aplicacion unica, compartida por editor y ficha)
- [ ] envolturas: `Detector` (captura del clip) **y** `Metadata::generarEnvolturas` +
      `agruparFormas` (dedup: `analizar_y_guardar` escribe `envolturas.json`); `PMU_Uploads`
      (`ruta_envolturas` + `leer_envolturas` + `envoltura_claves`/`envoltura_datos`/
      `envoltura_defecto` + `op=envoltura`); config `envolturas` y `campos_envoltura` (allowlist);
      `datos_pdf_render` (forma por defecto + excepciones usadas + claves) **y** `PMUMockup.componer`
      (clip via `envolturaDeRef`/`comandosEnvoltura`); `panel_ficha` (guia del cargador) **y**
      `cargador-pmu.js` (`_guia`)

## 6. Criterios de verificacion

- Guardar mockups nunca modifica `analisis.json`; solo escribe `mockups` + `preview_omisible`.
- Un mockup existente sin campos nuevos se abre y se compone **identico** (SC-011).
- Editor y ficha producen la misma composicion (posicion, tamano, orden, ajustes) (SC-003).
- El hueco se encaja sin deformar; la proporcion distinta genera aviso en el editor (FR-023/024).
- `gama` guardado se aplica al componer (bug corregido).
- El editor no escribe en `img.json` ni en ningun sprite (unico escritor: `assets/miniaturas.js`).
- `ref` plano (mockup previo) se sigue composing igual (compatibilidad).
- Una capa placeholder con `envoltura: true` y `envs` en el contexto recorta con `ctx.clip` ANTES
  de dibujar; sin `envs` (sin archivo o sin esa clave) compone sin clip y el editor informa la
  causa diferenciada.
- `analisis.json` **nunca** lleva `envs` (formato original intacto); `envolturas.json` con
  `grupos` vacios = analizado sin envolturas (distinto de archivo ausente = Re-analizar).
- **Dedup**: 60 instancias con el mismo marco -> **1 forma** (`usos: 60`) + `mapa` de 60 entradas
  (< 4 KB); dos marcos distintos -> 2 formas y `mapa` {1:1, 2:2}.
- Un archivo que declara grupos pero **sin `formas` utilizables** se **descarta** (no se inventa
  geometria ni se convierte nada): se informa como **no disponible** y la consola guia a
  **Re-analizar**. `grupos` vacios = analizado sin envolturas (estado valido, sin aviso).
- La forma por defecto **viaja una vez** por grupo (`env_defecto`): una instancia default no pide
  nada; una excepcion pide su geometria (y nunca cae a la default mientras no llega).
- El cargador del comprador dibuja la guia de la forma representativa del grupo asociado
  (`campos_envoltura`) y el PNG del pool sigue **sin cortar** (el clip lo aplica el PDF).
- El chequeo del toggle/lazy del editor, del saneo PHP y del endpoint viven en
  `tests/mockup-contrato.test.js`; la extraccion, en `tests/envolturas.php` (PDF sintetico:
  W, W*, Q, Form XObject y forma densa > ENV_SEG_MAX); el endpoint, en la fase
  `envoltura_op` de `tests/texto_puente.php`.
