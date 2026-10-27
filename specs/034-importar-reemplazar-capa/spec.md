# Feature Specification: Importar página/capa y reemplazar capa/grupo manteniendo transformación

**Feature**: 034-importar-reemplazar-capa
**Rama**: (sin rama: el repo despliega desde `main`)
**Estado**: especificada (borrador), sin implementar
**Creada**: 2026-10-26
**Depende de**: 011 (editor de mockups, contrato de capas y perspectiva), 031 (editor de mockups panel), 032 (reemplazo PDF)
**Fuente**: pedido del admin — "funciona reemplazar la capa/grupo seleccionado con otra capa (página PDF o imagen) manteniendo las transformaciones (x/y/w/h/rot/sesgo/filtros/modo/nombre/oculta/bloqueada/envoltura/grupo/grupo_rot/perspectiva); habilitar perspectiva por capa individual (hoy solo grupo); importar pagina + PH pregunta si reemplazar la seleccion actual; destino es la capa/grupo seleccionado (si varias capas no agrupadas, la primera); conserva ubicacion, rotacion y perspectiva"

## 0. Resumen en una frase

Permitir al administrador seleccionar una capa o grupo en el editor de mockups y, al importar una página del PDF o una imagen del catálogo, reemplazar la capa/grupo seleccionado manteniendo posición, tamaño, rotación, sesgo, filtros, nombre, visibilidad, bloqueo, envoltura, grupo, grupo_rot y perspectiva. Cuando no hay selección, el importador se comporta como hoy (agregar como nueva capa/grupo).

## 1. El problema (verificado en el código)

1. **Importar página siempre agrega.** `importarPagina()` (`assets/mockups.js:1628`) crea siempre una capa `img` nueva con `ref: 'mock:<id>'`, encajada en el lienzo 300x300, y un grupo de placeholders nuevo (`grupoId = nuevoIdGrupo()`). No existe forma de reemplazar una capa o grupo existente.
2. **No hay selección consciente en la importación.** La importación ignora `estado.seleccion` / `estado.seleccionados`; siempre crea un grupo nuevo. Si el admin quiere reemplazar una capa existente con otra imagen/página, debe borrar la antigua e importar de nuevo, perdiendo posición, rotación, escala, sesgo, filtros, nombre, ocultar/bloquear, envoltura y perspectiva.
3. **Perspectiva solo por grupo.** La perspectiva (`capa.perspectiva`) y el marco orientado (`marcoOrientadoSeleccion`, `puntosTiradoresPerspectiva`, `asignarPerspectiva`, `puntosPerspectiva`, `perspectivaConvexa`) operan a nivel de grupo en `mockups.js` y `mockup-render.js`. Una capa individual no puede tener perspectiva propia, lo que limita el reemplazo de una sola capa con su deformación.
4. **No hay guía visual de reemplazo.** No hay forma de previsualizar que la nueva imagen ocupará exactamente el lugar de la capa seleccionada.

**Lo que ya existe y se reusa:**
- `puntosTiradoresPerspectiva`, `asignarPerspectiva`, `puntosPerspectiva`, `perspectivaConvexa`, `homografia`, `esquinasCapa`, `marcoItems`, `puntoMarco` en `assets/mockups.js` y `assets/mockup-render.js`.
- `puntoRotacionCapa`, `puntosDeRotacion` (T029, spec 031).
- El contrato de capas (spec 011 v10) ya define `perspectiva`, `grupo`, `grupo_rot`, `envoltura`, filtros, modo, nombre, oculta, bloqueada.
- `mockup-render.js` (`dibujarItem`) ya aplica perspectiva y envoltura por capa.
### US1 (P1) — Reemplazar capa/grupo seleccionado con otra página del PDF

**Given** un mockup con al menos una capa o grupo seleccionado en el editor, **When** el admin elige "Importar página + PH" y selecciona una página, **Then** el sistema pregunta si reemplazar la selección actual; si acepta, la capa (o todas las capas del grupo seleccionado) se sustituye por la página importada manteniendo x/y/w/h/rot/sesgo, filtros, nombre, ocultar/bloquear, envoltura, grupo, grupo_rot y perspectiva; si no hay selección, se comporta como hoy (agregar como nueva capa/grupo).

### US2 (P1) — Reemplazar capa/grupo seleccionado con imagen del catálogo

**Given** una capa o grupo seleccionado, **When** el admin elige una imagen del catálogo `img/`, **Then** ocurre lo mismo que US1 pero usando la imagen del catálogo en lugar de una página PDF.

### US3 (P2) — Habilitar perspectiva por capa individual

**Given** una capa individual seleccionada (no un grupo), **When** el admin accede a los ajustes de capa, **Then** puede ver y editar la perspectiva (cuatro puntos) de esa capa individual, no solo del grupo.

### US4 (P2) — Vista previa de reemplazo

**Given** una selección, **When** el admin elige una página/imagen para reemplazar, **Then** el sistema muestra una guía visual del área que será reemplazada antes de confirmar.

### Edge Cases

- Selección vacía: importar se comporta como hoy (agregar como nueva capa/grupo).
- Selección de múltiples capas que no forman un grupo: tomar la primera como destino (como ya se acordó en la spec 034).
- Capa con perspectiva: la nueva capa hereda la perspectiva del destino.
- Capa bloqueada: no se puede reemplazar (o sí, pero avisar).
- Grupo con capas de tipo distinto (img + placeholder): al reemplazar, ¿qué pasa con cada una?

## 3. Functional Requirements

- **FR-001**: Al importar una página o imagen con una capa o grupo seleccionado, el sistema pregunta si reemplazar la selección actual.
- **FR-002**: Al aceptar, la capa destino (o cada capa del grupo seleccionado) se sustituye por la nueva capa importada manteniendo x/y/w/h/rot/sesgo, filtros, nombre, ocultar/bloquear, envoltura, grupo, grupo_rot y perspectiva.
- **FR-003**: Si no hay selección, importar se comporta como hoy (agregar como nueva capa/grupo).
- **FR-004**: Si la selección son múltiples capas que no comparten grupo, se toma la primera como destino.
- **FR-005**: Una capa individual puede tener perspectiva (cuatro puntos normalizados), no solo un grupo.
- **FR-006**: La persistencia en `config.json:mockups[]` sigue el mismo formato (clave `perspectiva` por capa).
- **FR-007**: La importación sigue usando el catálogo `mockups` para la imagen rasterizada (PDF.js local) y `img/` para imágenes del catálogo.
- **FR-008**: Sin cambios en `analisis.json` ni en `envolturas.json` (salvo que la nueva capa placeholder herede la envoltura del destino).
- **FR-009**: El Motor no cambia; el PDF final es estructuralmente idéntico salvo el contenido de la capa reemplazada.

## 4. Success Criteria

- **SC-001**: Al reemplazar una capa con otra página/imagen, x/y/ancho/alto/rot/sesgo se mantienen idénticos.
- **SC-002**: Al reemplazar un grupo, cada capa miembro conserva su transformación relativa y el grupo mantiene su `grupo_rot`.
- **SC-003**: La perspectiva por capa individual se guarda y renderiza correctamente en el editor y en el PDF final.
- **SC-004**: Sin selección, importar crea una nueva capa/grupo como hoy (no hay regresión).
- **SC-005**: No hay regresiones en las puertas existentes (CONTRATO 147, GEOMETRIA 135, motor_smoke, parity).

## 5. Decisiones

- **D1**: La importación con destino reutiliza la geometría de la capa destino; solo cambia el recurso (`ref`) y, para `img`, el archivo subido al catálogo.
- **D2**: La perspectiva se habilita por capa individual (no solo por grupo), ya que el renderer (`dibujarItem` en `mockup-render.js`) ya aplica perspectiva por capa.
- **D3**: El ref plano (`{color}`) sigue aceptándose como `pdf:{archivo}` (compatibilidad spec 011 v10).
- **D4**: El modal de reemplazo se integra en el flujo actual de "Importar página + PH" (spec 011 v5 / 031).

## 6. Fuera de alcance (otras specs)

- **033 `envoltura-tipos`**: select PowerClip/Círculo/Elipse + offset (solo vista previa, no afecta el PDF).
- **036 `favoritos-vistas`**: estrella en la vista local, catálogo global de favoritos.
- **Motor PHP**: no cambia (ya lee WebP/PNG y encaja 1:1).

## 7. Riesgos

- **Perspectiva por capa individual**: el renderer ya la soporta, pero la UI del editor solo la exponía para grupos. Hay que agregar la UI para capa individual.
- **Reemplazo de grupo con capas heterogéneas**: cada capa mantiene su propia transformación relativa y el grupo mantiene su `grupo_rot`.

## 8. Cómo se probará

- **Puerta nueva**: fase `importar-reemplazar` del arnés `tests/texto_puente.php` (con stubs de WP): reemplazar capa individual, reemplazar grupo, reemplazo sin selección (agrega como nuevo), capa bloqueada, múltiples capas sin grupo (toma la primera).
- **Recorrido en el lab**: reemplazar una capa de `circulo6cm` con otra página/imagen y verificar que posición, tamaño, rotación y perspectiva se mantienen.

