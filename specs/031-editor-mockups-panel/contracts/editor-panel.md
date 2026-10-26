# Contrato de UI — Editor de mockups (spec 031)

> Superficie de selectores y markup **prometida** a los tests (`tests/mockup-contrato.test.js`), a las
> fases del arnes y a la ayuda. Regla (precedente 013 T010): los checks indexan la **intencion**; si el
> rediseno mueve un bloque de contenedor, el selector o el `data-*` se conservan y el check se reescribe
> a la intencion, nunca se borra sin reemplazo.

## 1. Superficie prometida (por zona)

| Zona | Superficie | Promesa |
|---|---|---|
| Lienzo | `.ec-mk-lienzo canvas` | 300 px logicos; zoom inicial **100 %** (`estado.zoom = 1`); panel izq con **min-width 300 px** de contenido; padding horizontal 0 si el ancho util < 325 px (FR-001/002) |
| Transformacion bajo el lienzo | `.ec-mk-panel-props` + `.ec-mk-props` + `.ec-mk-alin[data-pos]` (izquierda/centro_h/derecha/arriba/centro_v/abajo) + `.ec-mk-dist[data-eje]` (x/y) | contenedor **nuevo** (bajo el lienzo, arriba de `.ec-mk-ayuda`); **clases y data-* invariables**; visible solo con seleccion (FR-003) |
| Panel derecho | 5 `details.ec-mk-acordeon` en orden fijo: vistas-del-pdf, capas, ajustes, imagenes, placeholders | cerrados por defecto; independientes; no persistentes (FR-004) |
| Vistas del PDF | `.ec-mk-mockups`, `.ec-mk-titulo`, `.ec-mk-omisible`, `data-mk="nuevo\|duplicar\|eliminar-mockup"` | titulo arriba, galeria en el medio, acciones al pie (FR-005) |
| Capas | `ul.ec-mk-capas`, `.ec-mk-sueltas` (nueva), `.ec-mk-grupo-capas` (nueva), `.ec-mk-capa[data-i]`, `.ec-mk-capa-btn[data-acc]` | agrupacion visual por `capa.grupo`; ▲▼◻🔒 vigentes; boton `...` (`.ec-mk-capa-ias`, nuevo) abre el menu contextual (FR-006/010) |
| Ajustes | `.ec-mk-ajustes` (nuevo) | filtros por capa + encuadre + perspectiva + restablecer (FR-011) |
| Imagenes | `.ec-mk-buscar-catalogo`, `ul.ec-mk-minis.ec-mk-catalogo`, `.ec-mk-mini`, `.ec-mk-mini-x` | vigente (FR-013) |
| Placeholders | `ul.ec-mk-grupos`, `details.ec-mk-acordeon`, `.ec-mk-grupo[data-grupo]`, `.ec-mk-instancia[data-grupo][data-instancia]`, `.ec-mk-importar`, `.ec-mk-num-pagina`, `data-mk="importar-pagina"` | selectores de chip/instancia **vigentes** (ya indexados por el contrato); importador mudado aca (FR-012) |
| Menu contextual | `.ec-mk-menu-ctx` (`role="menu"`), items `[data-ctx="duplicar\|quitar\|agrupar\|desagrupar\|ocultar\|bloquear"]` | nodo unico; `aria-disabled` cuando no aplica; cierre por fuera/Esc/scroll (FR-008/014) |

## 2. Selectores eliminados (con su reemplazo)

| Eliminado | Reemplazo |
|---|---|
| `data-mk="add-catalogo"` (`+ Imagen`) | clic en miniatura de `.ec-mk-mini` (vigente; la galeria Imagenes es la puerta de alta) |
| `data-mk="add-placeholder"` (`+ Placeholder`) | clic en `.ec-mk-grupo` / `.ec-mk-instancia` (vigente; la lista de Placeholders es la puerta de alta) |
| `data-mk="agrupar"` / `data-mk="desagrupar"` (botones de barra) | `data-ctx="agrupar"` / `data-ctx="desagrupar"` del menu contextual (y cabecera de grupo) |
| `data-mk="subir"` / `data-mk="bajar"` (botones de barra) | `data-acc="arriba"` / `data-acc="abajo"` de la fila (ya existen; los de barra eran duplicados) |
| `data-mk="duplicar-capa"` / `data-mk="borrar-capa"` (botones de barra) | `data-ctx="duplicar"` / `data-ctx="quitar"` del menu contextual + atajos Ctrl+D / Delete (T044) |

## 3. Reglas de comportamiento (numeradas, al estilo del contrato de capas de la 011)

- **C-1 (clip del tirador, paridad)**: el tirador de rotacion de **capa individual** y el de **grupo**
  se dibujan y se hit-testean con la misma regla: `G.extremoVisible(centro, punto, LIENZO, 7)`. Dibujo
  y hit-test comparten funcion auxiliar (`puntoRotacionCapa` / `puntoRotacionGrupo`): nunca se calcula
  el punto dos veces (la clase de bug arreglada en 4.22.6).
- **C-2 (agrupacion visual)**: agrupar/contraer acordeones en la lista de capas **nunca** muta el
  array de capas ni el historial; el orden z de datos y el de presentacion son independientes (INV-1).
- **C-3 (menu contextual)**: se abre solo desde la lista de capas (filas y cabeceras de grupo), nunca
  desde el lienzo (D7); cada item ejecuta la funcion vigente (INV-2); se cierra con clic fuera, Esc,
  scroll del panel o repintado.
- **C-4 (acordeones)**: `details` independientes; abrir uno no cierra otro; su estado no persiste; la
  clase es `.ec-mk-acordeon` (propia, no `.ec-acordeon`) para no disparar el confirm de cambios sin
  guardar de mockups.js:2460.
- **C-5 (traslado de bloques)**: los handlers son delegados por clase/`data-*` y **no dependen del
  contenedor**: mover la transformacion bajo el lienzo o el importador a Placeholders es markup-only.
- **C-6 (zoom)**: el zoom es transitorio y arranca en 100 %; no hay auto-fit (D2).
- **C-7 (dataset)**: ninguna accion del panel escribe una clave nueva en `config.json` (FR-017); el
  formato de `mockups[]`/`capas[]`/`grupo` no cambia.

## 4. No prometido (libre de cambiar)

- Estilos visuales internos de los acordeones y del menu (colores, sombras).
- Textos de ayuda y etiquetas (salvo los titulos de los 5 acordeones, que promete la spec).
- Orden interno de los items del menu contextual y sus iconos.
- Estructura interna de inputs del bloque de transformacion (prometidos son sus
  contenedores/atributos, no su markup).

## 5. Fronteras

- El contrato **no** promete el panel de la ficha del comprador (no se toca, FR-018).
- El contrato **no** promete persistencia de UI (acordeones, zoom) entre sesiones (D2/D5).
- La superficie prometida se verifica en `tests/mockup-contrato.test.js` (checks estructurales
  actualizados) y en las fases del arnes (auditoria R5).