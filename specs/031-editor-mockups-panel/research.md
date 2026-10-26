# Research — Spec 031 (rediseno del panel del editor de mockups)

> Fase 0 de `/speckit-plan`. Resuelve los unknowns del Technical Context y fija el **como** de cada
> decision de la spec. Todo se apoya en codigo existente (ver hallazgos con linea).

## R1 — Agrupacion visual de capas por grupo sin alterar el orden z

**Decision**: `pintarCapas` itera igual (orden z global: la ultima del array esta al fondo) pero agrupa
la **salida**: primero la seccion **Sin grupo** (capas sin `capa.grupo`), luego un acordeon por id de
grupo presente (en orden de primera aparicion en el array); dentro de cada acordeon, las miembros en su
orden z relativo. El array de capas **no se reordena**; `moverCapa` (▲▼) sigue operando por indice
global.

**Rationale**: el modelo ya existe — `capa.grupo` (string id, spec 011) lo escribe `agruparSeleccion()`
y el importador de pagina (`importarPagina()`, `grupo: grupoId`). Separar presentacion de datos evita
reescribir el array al expandir/contraer y conserva el invariante documentado en `pintarCapas`
("la ultima del array esta al fondo").

**Alternativas**: reordenar el array al agrupar (rompe z y el historial de deshacer); acordeon con
indice local propio (duplica el modelo); lista plana (no cumple US4).

## R2 — Menu contextual accesible dentro del panel

**Decision**: modulo propio en `mockups.js`: un unico div `.ec-mk-menu-ctx` (`role="menu"`) creado una
vez, posicionado con `left/top` clamped al panel derecho; se abre con `contextmenu` en `.ec-mk-capa`
(fila) o en la cabecera del acordeon de grupo; acciones con `data-ctx` delegadas; cierre por
`pointerdown` fuera, `Escape`, scroll del panel y repintado de la lista; `aria-disabled` en acciones
invalidas (el item **no se elimina**: el contrato lee estructura). Atajos vigentes (T044, mockups.js
2406-2451: Delete, Ctrl+D, [, ], flechas, Ctrl+Z) cubren Quitar/Duplicar/orden; el boton `...` en la
fila abre el mismo menu (fallback sin clic derecho).

**Rationale**: cumple FR-008/009/014 con DOM estable (un solo nodo reutilizado, no se recrea por
apertura → el contrato Node puede indexarlo); patron WAI-ARIA menu basico; el cierre por scroll evita
el menu flotando sobre otra capa.

**Alternativas**: menu nativo del navegador (no estilizable, no indexable); menu en el lienzo (D7:
fuera de alcance); boton expandible en fila sin clic derecho (no cumpre la peticion; queda como
fallback `...`).

## R3 — Cabecera del acordeon de grupo en Capas

**Decision**: la cabecera (`summary`) tiene dos zonas: el triangulo expande/contrae; el resto (marca de
grupo + "N capas") **selecciona el grupo** (equivale a seleccionar todas las miembros). El clic derecho
sobre la cabecera abre el menu contextual con acciones de grupo: **Desagrupar**, **Ocultar/Mostrar
grupo** (todas las miembros), **Quitar grupo** (todas). Los controles numericos y de transformacion
**no** van en la cabecera: ya viven bajo el lienzo (D1) y en el lienzo (tiradores grupales).

**Rationale**: evita duplicar la UI de transformacion (ya existe bajo el lienzo + tiradores); la
seleccion por cabecera es el camino natural para manipular el grupo desde la lista; Alt+clic en miembro
sigue seleccionando individual (vigente).

**Alternativas**: controles numericos duplicados en cabecera (mantenibilidad doble); nombrar grupos
(D4: no, evita nuevo dato en `config.json`).

## R4 — Placeholders en acordeones (importador incluido)

**Decision**: `pintarGrupos` emite `<details class="ec-mk-acordeon">` por grupo: `summary` = swatch +
etiqueta + conteo (`w×h · N instancias`) + boton **Agregar** (clase `.ec-mk-grupo` vigente,
`data-grupo`) alineado a la derecha; cuerpo = lista `.ec-mk-instancias` (botones `.ec-mk-instancia`
con `data-grupo`/`data-instancia`, vigente). El importador de pagina se muda del panel Capas al
acordeon Placeholders (markup + ayuda + estado), con el handler `data-mk="importar-pagina"` intacto
(la delegacion no depende del contenedor).

**Rationale**: conserva los selectores que ya indexa el contrato Node (`.ec-mk-grupo`,
`.ec-mk-instancia`, `data-grupo`, `data-instancia`, `etiquetaInstancia`) y el endpoint
`mockup_pagina`; solo cambia el contenedor.

**Alternativas**: reescribir el chip como `summary` sin boton (rompe el contrato vigente y la
insercion directa); instancias en tooltip (inaccesible por teclado).

## R5 — Superficie prometida: que se rompe y que no

**Decision**: (a) se rompe **a proposito** y se reescribe en el contrato Node: `data-mk="agrupar"` /
`data-mk="desagrupar"` (pasan a `data-ctx` del menu contextual), `data-mk="add-catalogo">+ Imagen` y
`data-mk="add-placeholder"` (eliminados), `.ec-mk-panel-props` como panel derecho (muda al izq; la
clase se conserva), `data-mk="subir"`/`data-mk="bajar"` de la barra (redundantes con los ▲▼
`data-acc="arriba"/"abajo"` de la fila). (b) **no** se tocan: handlers de `pmuPost`, autoguardado,
deshacer, `importarPagina` + `apiMotor('mockup_pagina')`, ni la logica de las fases del arnes
(auditoria previa en F8: `Select-String` de `ec-mk-` y `data-mk` sobre `tests/` para la lista exacta
de anclas a actualizar).

**Rationale**: el contrato Node indexa strings de `mockups.js`; cambiar markup sin actualizar el
contrato deja la puerta roja o (peor) verde falsa. Precedente: spec 013 T010 reescribio checks a la
intencion.

**Alternativas**: conservar botones fantasma para no tocar el contrato (viola la intencion de la
spec); borrar checks (pierde cobertura).

## R6 — Clip del tirador de rotacion de capa (paridad con el grupal)

**Decision**: en `dibujarSeleccion` rama capa (mockups.js 688-706) y en `tiradorEn` (759-763), el
punto `(hx, hy)` pasa por **`G.extremoVisible({x: cx, y: cy}, {x: hx, y: hy}, LIENZO, 7)`** igual que
el grupal (`puntoRotacionGrupo`); la guia se recorta al punto clipado. Dibujo y hit-test usan **la
misma funcion auxiliar nueva** `puntoRotacionCapa(c)` para no desfasarlos.

**Rationale**: `extremoVisible` ya esta probada (geometria 135 checks + puerta de tinta del grupal en
4.22.5); compartir la funcion dibujo/hit elimina la clase de bug "hit acierta, dibujo falla" que se
acaba de arreglar en 4.22.6. La asimetria actual (grupo con clip desde 4.22.5, capa sin clip) nacio
justamente de calcularlos por separado.

**Alternativas**: clip solo en dibujo (hit desfasado — reintroduce la asimetria); radio fijo menor (no
resuelve rotaciones grandes); ocultar el tirador fuera del lienzo (el gesto quedaria inalcanzable).

## R7 — Zoom inicial 100 %

**Decision**: `estado.zoom = 1` (hoy es 2, mockups.js:49); `ZOOMS = [1, 1.5, 2, 3]` ya incluye 1;
`pintarZooms` marca el seleccionado; sin persistencia (transitorio, D2).

**Rationale**: el lienzo logico mide 300 px; con zoom 2 (600 px) el panel izq se desborda o aplasta en
ventanas de 1280 px. Con min-width 300 (FR-002), el zoom 1 garantiza el lienzo entero siempre.

**Alternativas**: auto-fit por resize (D2: rechazado, complejidad y sorpresa); mantener 2 y achicar
el panel derecho (rompe FR-001: el lienzo sigue cortado en ventanas medianas).

## R8 — Bloque de transformacion bajo el lienzo

**Decision**: en `plantilla()`, el contenedor `.ec-mk-panel-props` se muda de `.ec-mk-der` a `.ec-mk-izq`
justo despues de `.ec-mk-lienzo` (antes de `.ec-mk-ayuda`); a continuacion (misma zona) se mudan los
bloques `.ec-mk-alin` y `.ec-mk-dist` del panel Capas. `pintarProps` conserva su logica (toggle
`hidden` + fill, mockups.js 1276-1283) y los handlers delegados (`data-pos`, `data-eje`, inputs de
`.ec-mk-props`) **no dependen del contenedor** → traslado de markup solamente. La particion de
contenido: numericos (x/y/ancho/alto/rot) + alinear + distribuir **bajan**; filtros + encuadre +
perspectiva + restablecer van al acordeon **Ajustes** (D1).

**Rationale**: D1 separa por frecuencia de uso; la delegacion por clase/`data-*` hace que el traslado
sea markup-only (cero riesgo para handlers); el contrato actualiza los checks que indexan contenedores.

**Alternativas**: duplicar controles (ya es la decision D1, pero sin duplicar logica); dejar todo en
el panel derecho (no cumple US2).

## Hallazgos de codigo que sustentan el research

- `estado.zoom = 2` (mockups.js:49) y `ZOOMS = [1, 1.5, 2, 3]` (38) → R7 trivial.
- `pintarProps` toggla `$panelProps.attr('hidden')` (1276-1283) → R8 no toca logica.
- Rama capa de `dibujarSeleccion` (664-706): `hx/hy = centro + radio·cos/sen` **sin clip**; rama
  grupal usa `puntoRotacionGrupo` con `G.extremoVisible` (593, 745) → R6.
- `tiradorEn` rama capa (759-763): mismo calculo sin clip → R6 (paridad dibujo/hit).
- Atajos T044 vigentes (2406-2451): Ctrl+S, Ctrl+Z/Shift+Z, Ctrl+D, Esc, Delete/Backspace, [, ],
  flechas → FR-009 ya cubre Quitar/Duplicar; el menu complementa Agrupar/Desagrupar/Ocultar/Bloquear.
- Handler de confirm de navegacion atrapa `.ec-acordeon > summary` (2460) → clase propia
  `.ec-mk-acordeon` para los acordeones del editor (no disparar el confirm al plegar un panel).
- `contextmenu` vigente (2014) solo previene el menu en ▲▼ → el modulo nuevo unifica y amplia.
- Estilos de acordeon de consola: `.ec-acordeon` / `.ec-acordeon-cab` / `.ec-acordeon-cuerpo`
  (admin.css 59-84) → base del estilo de `.ec-mk-acordeon`.