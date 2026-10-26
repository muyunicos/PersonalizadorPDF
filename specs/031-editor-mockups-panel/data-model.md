# Data Model — Spec 031 (rediseno del panel del editor de mockups)

> Fase 1 de `/speckit-plan`. **No hay entidades de almacenamiento nuevas**: el rediseño es de UI del
> editor del admin. `config.json:mockups[]` conserva su formato vigente (FR-017; constitucion §IV).
> Las entidades de aqui son de **presentacion**; lo unico que cambia de estado de sesion es el zoom
> inicial (2 → 1, R7).

## 1. Editor (raiz `.ec-mk`)

| Campo | Tipo | Reglas |
|---|---|---|
| `mockups` | lista | dataset vigente (normalizarMockup); sin cambios |
| `actual` | int | indice de la vista en edicion; vigente |
| `seleccion` / `seleccionados` | int / lista | seleccion vigente (1..N con Ctrl); el bloque de transformacion y el menu contextual actuan sobre ella |
| `zoom` | float | **default 1** (era 2, R7); transitorio; sin persistencia (D2) |
| `verTexto`, `guardado`, `pila`, `redo`, `avisoCapa`, `arrastre`, `guias`, `envs` | — | vigentes, sin cambios |

## 2. Panel izquierdo (`.ec-mk-izq`)

| Zona | Contenido | Regla |
|---|---|---|
| barra del lienzo | zoom (select), Ver texto real, marcas | vigente; zoom arranca en 100 % |
| lienzo | `.ec-mk-lienzo` con canvas 300 logico | **min-width 300 px de contenido** del panel; padding horizontal 0 si el ancho util < 325 px (FR-001/002) |
| transformacion | `.ec-mk-panel-props` (x/y/ancho/alto/rot) + `.ec-mk-alin[data-pos]` (6) + `.ec-mk-dist[data-eje]` (2) | **bajo el lienzo**, arriba de `.ec-mk-ayuda`; visible solo con seleccion (toggle `hidden` vigente de `pintarProps`) |
| ayuda / alertas / acciones | `.ec-mk-ayuda`, `.ec-mk-alertas`, Ver como lo ve el cliente | vigente |

## 3. Panel derecho (`.ec-mk-der`): 5 acordeones

| # | Acordeon (`.ec-mk-acordeon`, `<details>`) | Contenido |
|---|---|---|
| 1 | Vistas del PDF | titulo de la vista (arriba), galeria `.ec-mk-mockups`, al pie Nueva/Duplicar/Eliminar + omisible |
| 2 | Capas | lista agrupada (§4) |
| 3 | Ajustes | filtros por capa (AJUSTES: brillo/contraste/saturacion/gama/opacidad/tono), encuadre (modo/escala/desplazamiento), perspectiva 4 puntos + restablecer |
| 4 | Imagenes | buscador `.ec-mk-buscar-catalogo` + galeria `.ec-mk-catalogo` (vigente) |
| 5 | Placeholders | importador de pagina (§6) + grupos de placeholders en acordeones (§6) |

Reglas: **cerrados por defecto**; **independientes** (abrir uno no cierra otro); **no persistentes**
(D5); clase propia `.ec-mk-acordeon` (no `.ec-acordeon`) para no disparar el confirm de navegacion
(mockups.js:2460).

## 4. Fila de capa (`.ec-mk-capa[data-i]`) y acordeon de grupo (`.ec-mk-grupo-capas`)

| Campo | Regla |
|---|---|
| fila | miniatura + nombre + detalle + ▲▼◻🔒 (`.ec-mk-capa-btn[data-acc=arriba\|abajo\|ocultar\|bloquear]`, vigente) + boton `...` (`.ec-mk-capa-ias`, nuevo) que abre el menu contextual |
| acordeon de grupo | `summary` = marca de grupo + "N capas" (zona de seleccion del grupo) + cuerpo con las filas miembro; clic derecho en summary o fila abre el menu contextual |
| seccion Sin grupo | `.ec-mk-sueltas`: capas sin `grupo`, arriba de los acordeones de grupo |

**Invariante INV-1**: la agrupacion es **solo de presentacion**; el orden z del array, el historial de
deshacer y `moverCapa` (por indice global) **no cambian**.

## 5. Menu contextual (`.ec-mk-menu-ctx`)

| Item (`data-ctx`) | Habilitado cuando | Efecto |
|---|---|---|
| `duplicar` | hay capa/grupo seleccionable | `duplicarCapa()` (vigente) |
| `quitar` | seleccion valida (guardas de `borrarCapa`) | `borrarCapa()` (vigente) |
| `agrupar` | 2+ capas seleccionables | `agruparSeleccion()` (vigente) |
| `desagrupar` | la seleccion pertenece a un grupo | `desagruparSeleccion()` (vigente) |
| `ocultar` / `bloquear` | capa o grupo | toggla el estado de las miembros (logica vigente de fila) |

Reglas: nodo unico reutilizado; `role="menu"` / items `role="menuitem"`; `aria-disabled` (no se elimina
el item) cuando no aplica; cierre por clic fuera, Esc, scroll del panel y repintado (FR-014).
**INV-2**: cada accion produce el mismo efecto y la misma guarda que la via vigente; el menu no
introduce logica nueva.

## 6. Acordeon de grupo de placeholders (`.ec-mk-grupos` > `details.ec-mk-acordeon`)

| Zona | Contenido |
|---|---|
| summary | swatch de color + etiqueta del grupo + `w×h · N instancias` + boton Agregar (`.ec-mk-grupo[data-grupo]`, vigente) |
| cuerpo | lista `.ec-mk-instancias` con `.ec-mk-instancia[data-grupo][data-instancia]` (vigente) |

El importador de pagina (`.ec-mk-importar` + `.ec-mk-num-pagina` + `data-mk="importar-pagina"` +
ayuda + estado) vive en el acordeon **Placeholders** (D6); el handler y el endpoint
`apiMotor('mockup_pagina')` no cambian.

## 7. Seleccion

Vigente (`estado.seleccion` + `seleccionados`); Alt+clic en miembro y clic en cabecera de acordeón de
grupo seleccionan miembro y grupo respectivamente (R3).

## Invariantes

- **INV-1**: presentacion agrupada ≠ orden de datos (nunca se muta el array por plegar/agrupar).
- **INV-2**: el menu contextual reutiliza la logica vigente (cero logica nueva de negocio).
- **INV-3**: `config.json` no cambia; ninguna entidad de este modelo persiste (FR-017).
- **INV-4**: hit-test y dibujo del tirador de rotacion (capa y grupo) usan la misma funcion de clip
  (`puntoRotacionCapa` / `puntoRotacionGrupo` con `G.extremoVisible`) → misma posicion, misma
  tolerancia (R6).
- **INV-5**: la superficie de selectores prometida a los tests es `contracts/editor-panel.md`; los
  tests indexan esa superficie, no el contenedor de los bloques.