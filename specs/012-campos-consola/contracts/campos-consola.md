# Contract: Consola de Campos (UI + handlers)

**Feature**: 012-campos-consola | **Version**: 1 | **Fecha**: 2026-10-04

Este contrato define la **interfaz** de la pestana Campos y los handlers del admin. El formato de
datos y su migracion estan en `data-model.md`; el montaje en la ficha, en `contracts/campos.md`.

## 1. Superficie de la pestana

Orden de arriba abajo (fijo):

| Orden | Bloque | Que hace |
|---|---|---|
| 1 | **Estilos globales / Script global** | edita `uploads/pmu/campos/global.css` y `global.js` (una sola vez) |
| 2 | **Nuevo campo** | elige plantilla (`texto`, `select`, `imagen`) o "usar como plantilla" de un campo existente |
| 3 | **Tabla de campos** | buscador, filtros de categoria, selector de orden, filas |
| 4 | **Panel de prueba** | aparece al pulsar "Probar" en una fila |

## 2. Tabla de campos

Columnas: `id` · `nombre` · `titulo_cliente` · `categorias` · `plantilla` · `protegido` ·
`usado en N PDF(s)` · acciones (`Probar`, `Editar`, `Duplicar`, `Marcar plantilla`, `Baja`).

**Controles**: buscador de texto (nombre, descripcion, titulo cliente, categorias) + chips de
categoria + selector de orden (`mas recientes` / `por modificacion` / `por id`).

**Reglas**:
- El orden de la tabla **NO altera** el panel del comprador (manda `config.json:campos_ids[]`).
- Los campos dados de baja **no se listan**; se ven solo en el panel "Dados de baja" con `Restaurar`.
- La columna de uso se calcula leyendo `campos_ids[]` de cada `config.json` y contando
  apariciones de `[campoN]` en `value`/`settings`.

## 3. Editor en linea (FR-001…FR-003)

- `Editar` **no navega**: la fila se convierte en formulario (`data-editando="1"`).
- `Guardar` hace `pmuPost('personalizador_pdf_campo', …)` y devuelve `ok|error` + el campo
  guardado; la fila se repinta con los valores reales.
- `Cancelar` restaura la fila sin escribir.
- Alta: `pmuPost('personalizador_pdf_campo', …)` sin `id`; devuelve el `id` nuevo y la fila se
  agrega arriba.
- Toda respuesta es JSON (`responder()`); **nunca** hay una pagina de error ni una recarga.

## 4. Handlers nuevos

Todos con `seguridad('personalizador_pdf_campo')` (nonce + capability) y respuesta JSON.

| `action` | Entrada | Salida |
|---|---|---|
| `personalizador_pdf_campo` | edicion: `id` + `datos[nombre]`, `datos[titulo_cliente]`, `datos[descripcion]`, `datos[texto_ayuda]`, `datos[array]`, `datos[protegido]`, `datos[categorias][]`, `cargador[ranuras]`, `html`, `css`, `js` | `{id}` |
| `personalizador_pdf_campo` | alta: sin `id` (desde plantilla o vacio) | `{id}` (nuevo) |
| `personalizador_pdf_campo_plantilla` | `id`, `plantilla` (`""`\|`imagen`\|`select`\|`texto`) | `{ok}` |
| `personalizador_pdf_campo_duplicar` | `id` | `{id}` (nuevo) |
| `personalizador_pdf_campo_baja` | `id` | `{ok}` (queda `baja:true` en el indice) |
| `personalizador_pdf_campo_restaurar` | `id` | `{ok}` (vuelve a `baja:false`, conserva archivos) |
| `personalizador_pdf_campo_global` | `global_css`, `global_js` | `{ok}` |
| `personalizador_pdf_campo_uso` | — | `{usos: {id: [pdfs…]}}` (detalle de la columna) |

**Reglas comunes**:
- Los datos de texto llegan con `wp_unslash()` **antes** de `json_decode` (magia de comillas de
  WordPress; ver `AGENTS.md` §11).
- El sandbox del `campo.js` se valida en el servidor (`validar_script_campo()`), siempre.
- Ninguna operacion escribe si alguna validacion falla.

## 5. ~~Importar / exportar~~ (FR-021, FR-022) — FUERA DE ALCANCE

**Seccion retirada** por D22 (2026-10-04, decision del usuario): exportar/importar el catalogo de
campos no es necesario. No hay `admin_post` de export ni de import, ni forms, ni handlers: el
codigo de `b146952` se removio. El unico backup es una **copia de `uploads/pmu/`**, igual que para
los PDFs, las imagenes y los presets.

## 6. Panel de prueba (FR-004…FR-009)

- Se abre con `Probar` sobre una fila o un campo en edicion.
- Es un `<iframe srcdoc>` de **350px** de ancho (el `max-width` real de `.pmu-panel`).
- El `srcdoc` lleva: el HTML del campo, su `campo.css`, el `global.css` con el prefijo
  `[data-pmu-panel]` inyectado, `<link>` a los `<link rel=stylesheet>` **ya presentes** en la
  pagina del admin (fidelidad de tema sin inventar URLs), y un `<script>` con el `campo.js`.
- `window.PMU_CAMPO` (traduccion) se simula dentro del iframe.
- El panel muestra, en vivo, el par `{valor, cliente}` que el campo publica.
- Un `campo.js` que lanza excepcion -> el panel muestra el error; **la consola nunca se rompe**.
- Para un campo con cargador, `Probar` dibuja las **ranuras** (marco, tamano, forma, min/max) y
  **no sube nada** (el admin no tiene sesion de comprador).

## 7. Cargar el global (FR-023…FR-027)

- El admin guarda `uploads/pmu/campos/global.css` y `global.js` desde la pestana.
- En la ficha (`assets_ficha()`), si el panel tiene >= 1 campo no protegido:
  - se inyecta `<style>[data-pmu-panel]{...}</style>` con el `global.css` prefijado;
  - se encola el `global.js` defining `window.PMU_CAMPO` **antes** de montar los campos.
- Si no hay campos, no se carga nada.

**`window.PMU_CAMPO`** (D21): es el **espacio de trabajo del admin**, no una API del sistema.
`global.js` es codigo libre; el sistema solo garantiza que se ejecuta **antes** de montar los
campos. El admin puede colgar ahi sus propias funciones, listeners y reglas (ej.: su `f-color`
que convierte `0000FF` en "Azul").

**Lo que el sistema NO provee**: ni `traducir()`, ni `tablas`, ni auto-deteccion. La regla de salida
de `cliente` es de **dos** escalones: `campo.js` > `data-rol`; si no hay ninguno, `cliente` queda
**vacio** y la linea del carrito sale vacia (FR-026, FR-027). Nunca cae a `valor` en automatico.
