# Tasks — Spec 029 (el pool solo guarda lo que se genera)

> Estado: **cerradas** (2026-10-20, v4.20.0). Pendiente solo el recorrido manual (T010).

## Servidor

- [X] **T001** — `PMU_Sesion::fila_archivo()` (un solo lugar para la forma de la fila) con
      `origen` (D4).
- [X] **T002** — `guardar_imagen(..., $indice = null)`: la fila lleva `origen: 'texto'` y el
      `indice` que manda el cliente (posicion de instancia); sin el, se conserva el numero de
      archivo (D3).
- [X] **T003** — `PMU_Sesion::registrar_fotos($sid, $item, $pdf, $grupo, array $ids)`: valida los
      ids contra `manifest.subidas[]`, escribe **una fila** si la foto es la misma en todo el
      grupo (D2) o una por instancia con el indice de instancia, y **reemplaza** las filas del
      grupo (idempotente, D5).
- [X] **T004** — `handle_pool_png`: rama `fotos` (JSON de ids por instancia, **sin bytes**) y
      `indice` en la subida de texto.

## Cliente (`assets/tienda.js`)

- [X] **T005** — `registrarFotos()` (reemplaza `subirFotos`): un POST por grupo con los ids por
      instancia + la URL de la subida por instancia para el mockup (una resolucion por id).
      **Se elimino `rasterizar()`** (quedo sin uso).
- [X] **T006** — `dedupPendientes()` (`repite`): el texto uniforme se renderiza y se sube **una
      vez por grupo** (D2).
- [X] **T007** — `subirPool()` manda `indice` (0 si la entrada colapsa el grupo) y
      `pngsPorGrupo` repite el recurso de la entrada colapsada y usa la URL de la subida en los
      grupos de foto (D1/D2).

## Puertas

- [X] **T008** — Fase `fotos` del arnes (8 checks): uniforme/mixto/id desconocido/re-registro/
      endpoint/ruta real (D1-D5).
- [X] **T009** — `tests/selector-contrato.test.js`: se retiro el check de `rasterizar` (spec 026)
      y entraron los de la 029 (foto registrada, texto colapsado, q0.92 del servidor).

## Docs y release

- [X] **T010** — `specs/029-pool-sin-copias/` + `specs/004.../contracts/sesion-item.md` +
      `AGENTS.md` (§5/§7/§9) + `specs/INDICE.md` + changelog y version 4.20.0.
- [ ] **T011** — **Recorrido manual en WP real**: ficha con un campo de imagen (varias
      instancias), subir 1 foto, "Vista previa" y comprobar que `{item}/img/` **no** tiene
      archivos de fotos y que el PDF sale igual; despues 2 fotos distintas en el mismo grupo.
