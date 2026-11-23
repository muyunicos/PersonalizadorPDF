# Feature Specification: Carga multiple de imagenes

**Feature Branch**: `047-carga-multiple`

**Created**: 2026-11-22

**Status**: Draft — lote implementado (v4.37.0); modelo de recetas (FR-007..FR-014)
pendiente de implementar (v4.38.0).

**Input**: decision del usuario (2026-11-22): reemplazar el "¿Subir otra?" (retirado en
la 046) por **carga multiple**: arrastrar varios archivos al campo o elegir varias en
"Cargar imagen"; con N>1 la edicion es **predeterminada** (`cubrir`) y se suben al
servidor; despues se pueden editar individualmente tocando la miniatura.

## Clarifications

### Session 2026-11-22

- Q: ¿Qué debe hacer la carga múltiple cuando la ranura no declara `gid` (campo sin grupo del PDF asociado)? → A: **no bloquear ni avisar como error**. En productos generales el campo no tiene grupo PDF (no hay vista previa ni PDF final), pero la receta **existe y se aplica al campo**; el `gid` solo hace falta para componer un PDF. Modelo de recetas declarado por el usuario: **catálogo único por cliente** (una imagen + N recetas), reutilización por **relación de aspecto → forma → tamaño** (a la receta más cercana), **"ajustes del cliente"** = última receta usada (se reutiliza al crear otro item) y **"ajustes del item"** = receta congelada por item (PDF, edición del comprador y descarga del admin).
- Q: Cuando el sistema busca "la mejor receta" por tamaño, ¿qué tamaño usa? → A: el
  **tamaño vigente**: si hay `phsize` declarado, ese; si no, el **predeterminado del
  campo** (`w×h` de la ranura). La clave nueva (`aspecto` → `forma` → `tamaño`) se
  **mezcla en la 047** (no va a una 048 aparte); las recetas viejas se ignoran (Q3).
- Q: ¿Cuán "cercana" debe ser la relación de aspecto para reutilizar una receta? → A:
  **la más cercana sin umbral** (siempre la próxima por diferencia de aspecto; sin
  umbral ni recorte mínimo).
- Q: ¿Dónde vive "ajustes del cliente"? → A: en **`uploads.json`** (catálogo por
  identidad), como un campo **`ajustes: {objetivo, configuracion}`** en la entrada de
  la imagen: **"ajustes del cliente" es una receta** (objetivo + configuración).
- Q: ¿Qué hacemos con las recetas guardadas con la clave vieja (`{gid}-{w}x{h}-{phsize}`)? → A: **ignorarlas**. Solo cuenta la clave nueva; no se migran ni se reutilizan (decisión del usuario, 2026-11-22).
- Q: ¿Con qué formato exacto se guarda el "objetivo" de una receta? → A: **`{aspecto}-{familia}-{área}`**: aspecto **decimal con 4 decimales** (`1.5000`), familia **0/1** (`0` = rectángulo, `1` = redonda) y **área en px²** (`300×200` → `60000`); el área es la del `w×h` **resuelto** (con `phsize` aplicado).
- Q: ¿Cómo se canonicaliza la forma (`circulo`/`cuadrado`/`auto`)? → A: se toma el **estado final**: `auto` **no se guarda** (se resuelve al PH/campo); `circulo`/`cuadrado` con aspecto **1**; con aspecto ≠1 pasan a **`ovalo`** y **`rectangulo`**. La clave usa **familia** (`0` = rect, `1` = redonda) + aspecto + área, que derivan las 4 formas.
- Q: ¿Qué guarda la "configuración" de una receta? → A: un **delta** del default (`modo: 'cubrir'`): solo los cambios (`zoom`, `rot`, `ox`/`oy`, `fondo`, `transp`); el default es `{modo:'cubrir'}`. La receta v2 completa se **deriva** para el servidor.
## User Scenarios & Testing *(mandatory)*

### User Story 1 - Arrastrar/elegir varias fotos y subirlas de una (Priority: P1)

**Why this priority**: es el caso real de credenciales y certificados (varias fotos),
y reemplaza al modal "¿Subir otra?" que la 046 retiro.

**Independent Test**: test unitario de `_subirLote` (tope `max`, receta por defecto)
+ puerta de navegador (campo con `max >= 2`, 3 archivos -> 3 miniaturas).

**Acceptance Scenarios**:

1. **Given** una ranura con `max = 3`, **When** arrastro 3 archivos al campo,
   **Then** se suben los 3 y la tira muestra 3 miniaturas.
2. **Given** una ranura con `max = 2`, **When** elijo 3 archivos, **Then** entran 2 y
   se avisa que solo caben 2.
3. **Given** una foto ya cargada, **When** toco su miniatura, **Then** se abre el
   editor con su receta (igual que hoy).

---

### User Story 2 - Edicion predeterminada para el lote (Priority: P1)

**Acceptance Scenarios**:

1. **Given** un lote de N>1, **When** se sube, **Then** cada foto lleva una receta
   v2 por defecto: `modo = cubrir`, `escala = 1`, `ox/oy` al centro, `rot = 0`,
   `fondo` segun `transp`, `gid`/`phsize`/`w`/`h` de la ranura.
2. **Given** el lote subido, **When** toco una miniatura, **Then** el editor abre con
   esa receta y puedo reencuadrar (0 bytes si no cambio nada).
3. **Given** un solo archivo, **When** lo cargo, **Then** se abre el editor como hoy
   (no se saltea).

---

### User Story 3 - Errores y limites visibles (Priority: P2)

**Acceptance Scenarios**:

1. **Given** un archivo que no es imagen, **When** lo arrastro, **Then** se avisa y
   los demas del lote siguen.
2. **Given** una subida que falla, **When** responde el error, **Then** esa miniatura
   queda marcada con "!" y se puede reintentar.
3. **Given** una ranura llena, **When** intento sumar mas, **Then** se avisa el tope.

## Requirements

- **FR-001**: el input de archivo admite `multiple` cuando `max > 1`; el drop del
  campo acepta N archivos.
- **FR-002**: con N>1 se omite el editor y se sube cada archivo con una **receta v2
  por defecto** (`cubrir`, escala 1, centro, sin rotar). Con o sin `gid`: sin grupo
  PDF la receta igual se guarda y aplica al campo.
- **FR-003**: con N=1 se conserva el editor.
- **FR-004**: el lote respeta el `max` de la ranura; si sobran, se avisa.
- **FR-005**: cada archivo del lote tiene su placeholder con spinner y su marca de
  error/reintento.
- **FR-006**: el formato se valida por firma (servidor) y el aviso de archivo ilegible
  es por archivo, sin cortar el lote.
- **FR-007** (modelo de recetas, 2026-11-22): la receta se guarda y reutiliza por
  **relación de aspecto → familia → área** (la más cercana), con **"ajustes del
  cliente"** (última receta usada) y **"ajustes del item"** (receta congelada por
  item). La clave exacta y la tolerancia de "cercana" quedan para la Q2.
- **FR-008**: la receta se guarda con **objetivo canónico** `{aspecto}-{familia}-{área}`
  (aspecto decimal con 4 decimales; familia `0` = rectángulo, `1` = redonda; área en
  px² del `w×h` resuelto). La **forma final** se deriva: `circulo`/`cuadrado` con
  aspecto 1; con aspecto ≠1 → `ovalo`/`rectangulo`. `auto` no se guarda: se resuelve al
  estado final (el PH manda sobre el campo).
- **FR-009** ("mejor receta"): ante una ranura, se resuelve la receta con el aspecto
  **más cercano** (sin umbral) y, a igualdad, por **forma** y **tamaño**; si no hay
  ninguna, se usan los defaults del campo.
- **FR-010** (modelo): una **receta** = **objetivo** + **configuración**.
  **"Ajustes del cliente"** = la última receta aceptada por imagen (objetivo +
  configuración), que se reutiliza al abrir otro campo; **"ajustes del item"** = la
  receta congelada por item (manifest) para el PDF, la edición y la descarga del admin.
  En `uploads.json`: `items[id].ajustes = {objetivo, configuracion}`.
- **FR-011** (compatibilidad): las recetas viejas con `{gid}-{w}x{h}-{phsize}` se
  **ignoran** (no se migran ni se reutilizan): solo cuenta la clave nueva. El item ya
  tiene su receta congelada, así que el PDF no depende de la vieja.
- **FR-012**: la clave nueva se persiste en el catálogo de uploads (`recetas`), se
  sirve por `listar` y la usa el lote de la 047.
- **FR-013** (configuración): se guarda como **delta** del default (`modo: 'cubrir'`,
  escala 1, centro 0.5/0.5, rot 0, fondo auto, sin desplazamiento): solo se persisten
  los cambios (`modo`, `zoom`, `rot`, `ox`, `oy`, `fondo`, `transp`). Default =
  `{modo:'cubrir'}`.
- **FR-014**: la **receta v2** viaja al servidor (la tiene el cliente de la vista
  previa) y el **catalogo** guarda el **delta** derivado (`receta_delta`); el hash lo
  sigue calculando el servidor. `_aplicarParamsIniciales` acepta v2 o delta.

## Success Criteria

- **SC-001**: 3 archivos en una ranura con `max >= 3` -> 3 miniaturas.
- **SC-002**: 3 archivos en una ranura con `max = 2` -> 2 miniaturas + aviso.
- **SC-003**: una miniatura del lote abre el editor con la receta por defecto.
- **SC-004**: las puertas existentes siguen verdes.
- **SC-005**: una foto con receta 1:1 se reutiliza en un campo 1:1 con otra forma o
  tamaño (sin re-subir).
- **SC-006**: una receta vieja (`{gid}-{w}x{h}-{phsize}`) **no** se reutiliza (solo la
  clave nueva).
- **SC-007**: sin `gid`, la receta se guarda y aparece en `listar`.
- **SC-008**: el lote (N>1) y la reutilización por aspecto/forma/tamaño conviven.

## Key Entities

- `_pendientes[indice]`: placeholders de subida (spinner).
- `_subir(indice, blob, posicion, params)`: la receta explicita manda.
- `max` (selector): habilita `multiple` y el tope del lote.
- `recetas[clave]` (catálogo de uploads): `clave = objetivo`; la clave vieja
  `{gid}-{w}x{h}-{phsize}` se ignora.
- **objetivo**: `{aspecto}-{familia}-{área}` (familia `0` = rect, `1` = redonda); de
  ahí salen las 4 formas: `circulo`/`cuadrado` con aspecto 1, `ovalo`/`rectangulo` con
  aspecto ≠1. **configuración**: **delta** del default (`{modo:'cubrir'}`; `zoom`/`rot`/
  `ox`/`oy`/`fondo`/`transp` solo si cambian). `uploads.json:items[id].recetas[objetivo]
  = configuración`.
- **ajustes del cliente** = la última receta de esa imagen; **ajustes del item** =
  receta congelada por item (manifest).

## Assumptions

- El servidor sigue recibiendo el **original** acotado + la receta (spec 035).
- La receta por defecto se arma con las mismas claves v2 (`v,w,h,forma,modo,escala,
  ox,oy,fondo,transp,rot,iw,ih,phsize,gid`).

## Out of Scope

- Cambiar el `Compositor` o el Motor.
- Edicion masiva (mover/rotar N fotos de una).
- Ignorar las recetas viejas: no se migran ni se reutilizan (FR-011).

## Clarifications (2026-11-22)

Quedaban **dos** decisiones abiertas y ambas se cerraron con esta spec (no quedan
marcadores `[NEEDS CLARIFICATION]`):

- **T016 (duplicados en el lote)**: se resolvio por **dedupe de identidad**
  (`nombre|bytes|fecha`) con aviso "se omitio N repetido(s)". Se descarto el hash de
  contenido (crypto en el navegador, HTTP no seguro) y el aviso sin dedupe (el
  comprador ve dos miniaturas iguales). Sin identidad usable no se deduplica.
- **T017 (BMP/SVG)**: se **sacaron** del selector (`ACEPTA`, `TIPOS`, `EXTS`) en vez de
  avisar por archivo: el servidor ya los rechazaba por firma (`firma_imagen`), asi que
  ofrecerlos era prometer algo que falla despues.

Ambas quedaron implementadas y con puerta (`tests/cargador-lote.test.js`, 36 checks).