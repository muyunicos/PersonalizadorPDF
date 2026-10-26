# Feature Specification: Reemplazar el PDF de un producto sin perder la personalización

**Feature**: 032-reemplazo-pdf
**Rama**: (sin rama: el repo despliega desde `main`)
**Estado**: especificada (borrador), sin implementar
**Creada**: 2026-10-26
**Depende de**: 011 (editor de mockups, contrato de capas), 005 (productos/tienda), 020 (limpieza legacy: sin migraciones en desarrollo)
**Fuente**: pedido del admin — "En '2. PDFs subidos' agregar la posibilidad de reemplazar un Archivo (para actualizar una versión sin perder su Personalización, Mockups, Bonus, etc.), re-analizar y re-asociar sus conexiones en lo posible de manera automática, avisando si hay inconvenientes, con la posibilidad de abortar y recuperar la versión anterior."

---

## 0. Resumen en una frase

Subir una **versión nueva** del PDF de un producto conservando `config.json` completo (personalización, mockups, bonus, tienda, campos) y re-asociando los grupos por color con **sugerencias** para los que cambien, mostrando el mapa en un modal para **migrar o abortar**, con **respaldo y recuperación** de la versión anterior.

---

## 1. El problema (verificado en el código)

1. **Hoy reemplazar destruye los datos.** `handle_subir_pdf` (`personalizador-pdf.php`, 6361-6385) con `modo=sobrescribir` llama `limpiar_datos_de($nombre)` **antes** de mover el archivo: `limpiar_datos_de` (6438-6452) borra `pdfs/{nombre}/` (PDF + `analisis.json` + `config.json` + `envolturas.json` + cualquier foto del producto) y `tmp/muestras/{nombre}/`. Si el `move_uploaded_file` o el análisis fallan, el handler hace `@unlink` del PDF nuevo y responde error: **el producto queda vacío**. No hay vuelta atrás.
2. **El re-análisis conserva a medias.** `analizar_y_guardar` (6114-6180) regenera `analisis.json` + `envolturas.json`, conserva `config.json` **por id de color**, poda los `placeholders` huérfanos y reporta `personalizacion_perdida`. Pero **no** revalida:
   - `config.envolturas{gid:{forma:k}}` → `k` es un índice a `formas[]` de `envolturas.json`, que se regenera: si cambia el nº/orden de formas, el índice apunta a **otra forma** o a ninguna (bug latente ya hoy).
   - `mockups[].capas[].ref` → los refs de placeholder (`{color}` / `{color}#n`) huérfanos siguen dentro de las vistas: la vista previa muestra el hueco sin recurso.
3. **No hay sugerencias.** Si el color del grupo cambia (el diseñador rediseñó el PDF), la personalización se pierde aunque el hueco esté en el mismo lugar.
4. **No hay respaldo ni recuperación.**

**Lo que NO se pierde hoy si se conserva `config.json`**: `productos`, `campos_ids`, `preview_omisible`, `mockups[]`, `tienda{product_id}`, `bonus[]` (la biblioteca vive en `uploads/pmu/bonus/` + catálogo global: `config.json` solo guarda `{archivo, titulo}` / `{url, titulo}`), `activo`. **Conclusión: conservar `config.json` = conservar Bonus, productos, campos y mockups.**

---

## 2. User Scenarios & Testing

### US1 (P1) — Reemplazar conservando todo

**Given** un producto con personalización, mockups, bonus y productos asociados, **When** el admin sube una versión nueva del PDF desde "2. PDFs subidos" → "Reemplazar archivo", **Then** el PDF se reemplaza, `analisis.json`/`envolturas.json` se regeneran, y `config.json` conserva `activo`, `productos`, `campos_ids`, `preview_omisible`, `mockups[]`, `tienda`, `bonus[]` y los `placeholders` de los grupos cuyo color **se mantiene**.

### US2 (P1) — El mapa se muestra antes de decidir

**Given** un PDF nuevo donde algunos grupos cambiaron de color, **When** el análisis termina, **Then** el admin ve un **modal** con: grupos que se reasocian solos (mismo color), grupos **sugeridos** (por geometría y/o color) y grupos que **se pierden**; y puede **Migrar** o **Cancelar**. Si cancela, **nada** cambió en el producto.

### US3 (P1) — Abortar y recuperar la versión anterior

**Given** un reemplazo ya aplicado, **When** el admin pulsa "Recuperar la versión anterior", **Then** vuelven el PDF viejo, `analisis.json`, `config.json` y `envolturas.json` tal como estaban antes del reemplazo.

### US4 (P2) — Re-analizar arregla el remapeo (mismo motor que el reemplazo)

**Given** un PDF re-analizado (mismo archivo) donde cambiaron las formas de envoltura o desaparecieron grupos, **When** el admin pulsa "Re-analizar", **Then** se aplica **el mismo remapeo** que el reemplazo: `envolturas{gid}` se revalida y los `ref` de las capas de los mockups se remapean o se reportan.

### US5 (P2) — El fallo del análisis no toca el producto

**Given** un PDF nuevo corrupto o sin placeholders, **When** el admin intenta reemplazar, **Then** el producto queda **exactamente** como estaba y el error se informa con su causa.

### Edge cases

- **PDF con distinta cantidad de páginas** que el viejo: válido; los grupos huérfanos se reportan.
- **Mismo color, distinta geometría** (el hueco se movió): se reasocia por color (id) y se reporta "mismo id, geometría distinta" en el modal (informativo, no bloqueante).
- **Nuevo color para el mismo hueco** (mismo lugar, color distinto): sugerencia por IoU.
- **Varios candidatos** con score parecido: se propone el mejor y se informa que hay otros (el admin puede cancelar y rehacer el PDF si no le sirve).
- **PDF sin placeholders**: aborta (ya lo hace `analizar_y_guardar`: lanza excepción).
- **Reemplazo sin cambios** (mismo PDF re-subido): el mapa sale todo "igual"; migrar es inocuo.
- **Reemplazo mientras hay un reemplazo previo sin resolver**: solo se conserva el último backup (D6).
- **El PDF está asociado a productos activos**: el reemplazo no toca `tienda`/`productos` (sobreviven en `config.json`); si un grupo se pierde, la ficha puede quedar sin ese hueco (el sistema ya tolera grupos sin recurso).

---

## 3. Functional Requirements

- **FR-001**: La lista de "2. PDFs subidos" ofrece **Reemplazar archivo** por cada PDF (además del modal de conflicto del paso 1, cuya opción `sobrescribir` se reescribe a "Reemplazar (conserva la personalización)").
- **FR-002**: El reemplazo **nunca** borra la carpeta del producto: es un swap de **archivos** (`{nombre}.pdf`, `analisis.json`, `envolturas.json`) con `config.json` reescrito. Todo lo demás de `pdfs/{nombre}/` (fotos del producto, subcarpetas) queda intacto.
- **FR-003**: El PDF nuevo se analiza **antes** de tocar el dataset vigente (staging). Si el análisis falla (PDF ilegible, 0 placeholders), el producto queda **exactamente** como estaba y se informa la causa.
- **FR-004**: Al terminar el análisis, el sistema devuelve el **mapa** viejo→nuevo: `iguales` (mismo id), `sugeridos` (con su score y motivo), `perdidos` (con personalización) y los **nuevos sin personalización**.
- **FR-005**: El admin ve ese mapa en un **modal** y decide **Migrar** o **Cancelar**. Cancelar no cambia **nada** (ni el PDF ni los JSON).
- **FR-006**: Al **Migrar**: se respalda, se reemplaza el PDF, se escriben `analisis.json` y `envolturas.json` nuevos y se reescribe `config.json` remapeado.
- **FR-007**: El remapeo cubre **tres** superficies: `placeholders{id}` (claves), `envolturas{gid:{forma}}` (índices) y `mockups[].capas[].ref` (`{gid}` y `{gid}#n`).
- **FR-008**: Antes del swap se guarda un **respaldo** (PDF viejo + los 3 JSON). "Recuperar la versión anterior" lo restaura completo.
- **FR-009**: Se conserva **un solo** respaldo (el del último reemplazo); el siguiente lo reemplaza.
- **FR-010**: El respaldo vive en `tmp/reemplazos/{nombre}/{timestamp}/` y **no** es alcanzado por el TTL de borradores de la spec 030.
- **FR-011**: `handle_reanalizar` (mismo archivo) usa **el mismo** remapeo: `envolturas{gid}` revalidado y `ref` de capas remapeados o reportados.
- **FR-012**: Las capas de mockup cuyo `ref` no tenga destino **no se borran**: se dejan y se reportan (el editor ya marca "capa(s) sin recurso").
- **FR-013**: El comprador no cambia en nada: no hay endpoint nuevo para la ficha, ni dato nuevo en `panel_ficha`.
- **FR-014**: Todo el flujo es **JSON sin recargas** (patrón `pmuPost`/`responder`); los errores se pintan inline con su causa.
- **FR-015**: Los pedidos ya pagados no se tocan: si el cliente vuelve a generar el PDF, se genera con la **versión nueva**, sin aviso adicional (decision D9).

## 4. Success Criteria

- **SC-001**: Tras un reemplazo migrado, `config.json` conserva `activo`, `productos`, `campos_ids`, `preview_omisible`, `mockups[]`, `tienda` y `bonus[]` (comparacion estructural campo por campo).
- **SC-002**: Con el **100%** de los ids iguales (mismo PDF, otra exportacion), no se pierde ninguna personalizacion.
- **SC-003**: Con un grupo cambiado de color y el resto igual, el modal sugiere el destino correcto (IoU/ΔE) en todos los casos construidos en la puerta.
- **SC-004**: **Cancelar** deja el producto byte-identico (hash de PDF + los 3 JSON sin cambios).
- **SC-005**: **Recuperar** deja los 4 archivos byte-identicos al estado previo al reemplazo.
- **SC-006**: Un analisis fallido produce **0** cambios (hash) y un error con causa.
- **SC-007**: Puertas en verde (`php -l`, contrato Node, geometria, motor smoke, fases del arnes) + recorrido en el laboratorio local.

---

## 5. Decisiones

- **D1**: swap **por archivo**, nunca por carpeta (FR-002). Es lo que hace que Bonus/fotos/productos sobrevivan sin logica extra.
- **D2**: **staging + analisis previo**; el dataset vigente no se toca hasta confirmar (FR-003).
- **D3**: **dos pasos** (preparar -> modal -> confirmar) porque el mapa debe verse antes de decidir (FR-004/005).
- **D4**: mapa **1:1** con umbrales (IoU de bboxes + ΔE de color) y **sin** N:1 (dos grupos viejos -> uno nuevo es ambiguo: no se puede saber que personalizacion gana). Sin candidato = "se pierde" y se informa.
- **D5**: una **sola** funcion de remapeo compartida por reemplazo y re-analisis (FR-011).
- **D6**: respaldo en `tmp/reemplazos/` (FR-008/009/010), fuera de la carpeta del producto para no ensuciar el listado de PDFs ni el ambito de datos del producto.
- **D7**: `ref` sin destino: se **conserva** la capa y se reporta (FR-012). Borrar seria destructivo y el admin puede querer reasignarla a mano.
- **D8**: `envolturas{gid}`: si el gid sobrevive se revalida `k` contra las formas nuevas; fuera de rango -> `0` (la forma por defecto) y se avisa.
- **D9**: pedidos pagados: **nada especial** (FR-015, decision del usuario: si el cliente vuelve a generar el PDF, usa la version nueva; no se lo avisa).
- **D10**: la opcion del modal de conflicto del paso 1 (`sobrescribir`) **pasa a ser este flujo** (FR-001): no quedan dos caminos distintos para "reemplazar".

---

## 6. Fuera de alcance (otras specs)

- **033 `envoltura-tipos`**: select PowerClip/Circulo/Elipse + offset (mm -> px reales). **Decision del usuario (2026-10-26): todo eso es SOLO para la vista previa y NO afecta al PDF final** (el PDF sigue funcionando igual elijas lo que elijas) -> se cae el clip circular/elipsoidal en el Motor y el offset del PNG.
- **034 `perspectiva-y-importacion`**: perspectiva por **capa individual** (se hace **primero**: hoy solo aplica a grupos y bloquea lo demas) + "Importar pagina + PH" con **reemplazo de la seleccion** conservando lugar, rotacion y perspectiva del destino.
- **036 `favoritos-vistas`**: estrella en la vista local (la vista queda como esta) + catalogo global de favoritos (**referencia viva** `{pdf, vista}`: al marcar una vista se anota su id; al consultar el catalogo se buscan las imagenes de esos mockups y, si una no aparece, se borra la entrada: **poda perezosa con auto-sanado**) + toggle vistas/favoritos + duplicar con remapeo de refs al PDF actual.

## 7. Riesgos

- **Sugerencia equivocada** (IoU/ΔE parecidos): mitigado por umbrales + modal obligatorio + Cancelar sin efectos.
- **Respaldo y espacio**: es 1 PDF + 3 JSON por producto; se conserva solo el ultimo (FR-009).
- **`tmp/reemplazos` y el TTL**: hay que excluir esa ruta del barrido de borradores (FR-010) o el respaldo desaparece a las 24 h.
- **Remapeo de `ref` con `#n`**: si cambia la cantidad de instancias de un grupo, `{gid}#n` puede quedar fuera de rango -> se mapea a la instancia 1 (`{gid}`) y se reporta.
- **Reemplazo con productos activos**: si un grupo con personalizacion desaparece y no hay candidato, la ficha deja de mostrar ese hueco (comportamiento vigente para grupos sin recurso); el modal es la ultima red.

## 8. Como se probara

- **Puerta nueva**: fase `reemplazo` del arnes `tests/texto_puente.php` (con stubs de WP, en `%TEMP%`): preparar con ids iguales, preparar con un color cambiado, cancelar (hash intacto), migrar (config conservado + remapeado), fallo de analisis (0 cambios), recuperar (hash del estado previo), `envolturas{gid}` fuera de rango y `ref` huerfano reportado.
- **Puerta de mapa**: `PURO`/motor puro para el score (IoU + ΔE) testeado con casos construidos (mismo bbox / desplazado / color distinto / sin candidato).
- **Recorrido en el lab**: reemplazar el PDF de `circulo6cm` por una copia con un color cambiado, ver el modal, cancelar y migrar, y comprobar los hashes y el `config.json` resultante.