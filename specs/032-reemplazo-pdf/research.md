# Research: Reemplazar el PDF sin perder la personalizacion

**Feature**: 032-reemplazo-pdf · **Fecha**: 2026-10-26

---

## R1 — Como se mide la "geometria" de un grupo (el score del mapa)

**Hallazgo**: `analisis.json` guarda **solo** `{id, w, h, cont, pgs}` por grupo (verificado en el
producto real del lab): **no hay posiciones**. Las bboxes viven en el **momento del analisis**
(`Detector::analizarPdf()['grupos'][i]['instancias'][n]['dev_bbox']`, `Detector.php:731`) y no se
persisten.

**Decision**: el paso **preparar** **re-analiza los DOS PDFs** — el nuevo (staging) y **el viejo**
(que sigue en disco hasta el swap) — y el mapa compara **instancias** con **IoU** de sus `dev_bbox`
normalizadas por el **box de la pagina** (el CropBox/MediaBox que ya resuelve `Pdf.php:887-892` y que
`op=mockup_pagina` ya devuelve como `box`, `class-pmu-uploads.php:194`).

**Rationale**: dos grupos pueden tener el mismo tamano (`w`,`h`) y distinto lugar; solo la posicion
normalizada distingue "el hueco se movio" de "es otro hueco". Y el costo es bajo: `mockup_pagina` ya
instancia el `Detector` bajo demanda y el arnes lo corre seguido.

**Alternativas**: (a) comparar solo `w/h/cont/pgs` — barato pero no distingue huecos iguales en
lugares distintos; (b) persistir las bboxes en `analisis.json` — cambia el formato de un archivo
declarado "inmutable" (§5) para un dato que se puede recalcular. **Se descartan.**

**Fallback**: si una instancia no tiene `dev_bbox` comparable, el score cae a `w`, `h`, `cont`, `pgs`.

## R2 — Como se mide la "distancia de color"

**Decision**: distancia **euclidea normalizada en RGB**: los grupos se identifican por un color
**plano** (`id` = hex `RRGGBB`, el `fill` del rectangulo), asi que
`d = sqrt((Δr² + Δg² + Δb²) / 3) / 255` (0 = identico, 1 = blanco vs negro). Se usa
`Metadata::distanciaColor()`.

**El color NO se usa como filtro, solo como PESO del score (ver R3)**. Aprendido en la puerta T004:
un filtro `d <= 0,15` mataba el caso principal (un rediseno cambia el color **a proposito**: azul
`0000FF` -> verde `00FF00` da `d = 0,816`).

**Rationale**: no hace falta ΔE perceptual: el color del placeholder es **exacto y plano** (no hay
gradientes ni perfiles), y el caso real es "el mismo hueco con otro color de relleno", donde la
distancia euclidea separa bien. ΔE/Lab agregaria conversion y dependencia sin ganar precision util.

**Alternativas**: (a) ΔE76/CIEDE2000 en Lab — mas caro y sin ventaja para colores planos; (b) solo
igualdad exacta — pierde el caso "mismo hueco, color levemente distinto". **Se descartan.**

## R3 — Umbrales y direccion del mapa (1:1)

**Decision**: **el filtro es geometrico**: un grupo viejo se propone como **sugerido** si el mejor
`IoU >= 0,5`. El **color no filtra**: entra en el `score = 0,6 * IoU + 0,4 * (1 - d)` para
**desempatar** entre candidatos geometricamente parecidos. Cada grupo nuevo se usa **como maximo una
vez** (**1:1**): al elegir el mejor par se excluyen ambos y se sigue. Sin candidato que pase el IoU
= **perdido** (se informa y no se toca su personalizacion: el admin decide).

**Rationale**: 1:1 evita la ambiguedad de "dos personalizaciones viejas al mismo hueco nuevo" (no hay
regla para elegir cual gana). El **IoU** manda porque el rediseno puede cambiar el color a proposito
(era el error de la primera version: filtrar por `d <= 0,15` descartaba azul->verde con el hueco en el
mismo lugar, justo el caso que el feature existe para resolver).

**Nota de implementacion (trampa de PHP)**: PHP castea a **int** las claves de array con forma
numerica, asi que un color como `112233` entra como int; el mapa devuelve ids **siempre string**
(`(string)`) para que el contrato se cumpla y el JS los use como claves. Lo cubre la puerta T004.

**Alternativas**: N:1 (descartado: ambiguo), y "todo manual" (descartado: el caso comun es que **todos**
los ids coincidan y no hay nada que decidir).

## R4 — Donde vive el staging y el respaldo

**Decision**: una **sola** carpeta por reemplazo: `uploads/pmu/tmp/reemplazos/{nombre}/{ts}/` con
`{nombre}.pdf` (el nuevo), `analisis.json` y `envolturas.json` (nuevos) — es el **staging** de
"preparar" — y, al confirmar, se suman `config.json`, `analisis.json`, `envolturas.json` y
`{nombre}.pdf` **viejos** como **respaldo** (subcarpeta `anterior/`). Un `ultimo.json` por producto
apunta al `{ts}` recuperable.

**Rationale**: preparar y respaldar comparten carpeta (no hay dos flujos de temporales); el respaldo
queda **fuera** de `pdfs/{nombre}/` para no ensuciar el listado de PDFs de la consola ni el ambito de
datos del producto (que se despliega completo).

**Alternativas**: (a) `pdfs/{nombre}/.reemplazos/` — riesgo de aparecer en el listado y viaja al
servidor con el producto; (b) dos carpetas separadas (staging y backups) — dos rutas donde una basta.

## R5 — Atomicidad y no perder nada en el swap

**Hallazgo**: el proyecto ya escribe **atomico** (`.tmp` + `rename`): `PMU_Uploads` tiene el helper de
JSON (`1115-1128`) y `guardar_config` (`2036`) lo usa; la subida de archivos tambien mueve con `rename`
(`2233`).

**Decision**: el swap **reutiliza** esos caminos: `Metadata::guardar()` para los dos JSON derivados y
`PMU_Uploads::guardar_config()` para `config.json`. El PDF nuevo se mueve con `rename` (mismo sistema de
archivos) **despues** de haber copiado el viejo al respaldo. **Nunca** se borra la carpeta del producto.

**Rationale**: `handle_subir_pdf` borraba la carpeta **antes** de mover (el origen del problema); con el
respaldo hecho primero y escrituras atomicas, un fallo a mitad deja el producto **consistente**.

## R6 — Retencion: el respaldo y el TTL de la spec 030

**Hallazgo**: la 030 purga `tmp/` con `limpiar_ttl` (drafts 24 h / carrito 30 dias, cron diario).

**Decision**: **excluir** `tmp/reemplazos/` de ese barrido (prefijo propio, no `sesion-*`/`draft-*`) y
retener **un solo** respaldo por producto: el siguiente reemplazo reemplaza la carpeta anterior (lo dice
`ultimo.json`). Borrar el producto (`handle_borrar`) **si** limpia su `tmp/reemplazos/`.

**Rationale**: 24 h es demasiado poco para "me di cuenta una semana despues"; y un solo respaldo acota
el disco (1 PDF + 3 JSON).

## R7 — Que pasa con los `ref` de mockup y las envolturas

**Decision**:
- `placeholders{id}`: clave vieja -> clave nueva si el id sobrevivio o si hay sugerencia **aceptada**
  (el mapa lo confirma el admin); si no hay destino, el mapeo se **poda** (como hoy) y se reporta.
- `envolturas{gid:{forma:k}}`: si el `gid` sobrevive se **revalida `k`** contra `formas[]` nuevo; fuera
  de rango o sin formas -> `0` (la forma por defecto) + aviso. Si el `gid` no sobrevive: se remapea al
  sugerido (si lo hay) o se descarta.
- `mockups[].capas[].ref` (`{gid}` y `{gid}#n`): se remapea al destino; si `#n` queda fuera del rango
  nuevo (`cont` menor) -> se mapea a la instancia 1 (`{gid}`) + aviso; si no hay destino -> la capa
  **se conserva** y se reporta (D7: no se borra nada del trabajo del admin).

**Rationale**: es el bug latente que el re-analisis ya tiene hoy (envolturas `k` y refs de capa se
quedan viejos); resolverlo en una funcion **compartida** arregla reemplazo **y** Re-analizar (FR-011).

## R8 — El flujo de dos pasos y el estado entre pasos

**Decision**: `preparar` y `confirmar` son **dos POST** (JSON) con la carpeta `{ts}` como punto de
union; el `{ts}` viaja en la respuesta y vuelve en el confirmar. Si el admin **cancela** (o abandona),
el staging se descarta: `preparar` de un `{ts}` nuevo **borra los staging previos** del producto (el
respaldo `anterior/` **no** se toca). No hay estado en sesion ni en opciones de WP (el `tmp/` ya es el
estado).

**Rationale**: el plugin no guarda estado de UI en la base (§IV: sin tablas); y el `tmp/` ya es el
lugar de los trabajos (specs 029/030). El confirmar valida que el `{ts}` exista y sea del producto.

**Alternativas**: (a) un solo POST que aplique y ofrezca deshacer — obliga a aplicar antes de ver
(contradice FR-005); (b) guardar el mapa en un transient de WP — estado en la base para algo que vive
mejor en `tmp/`. **Se descartan.**