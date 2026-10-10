# Requirements checklist: editor-visual-fotos

**Feature**: 016-editor-visual-fotos | **Fecha**: 2026-10-10

> **Que mide este checklist**: que **cada requisito de la spec este especificado
> y cubierto por alguna tarea** de `tasks.md`. NO mide que este implementado.
> `[X]` = el requisito esta especificado y asignado a una tarea · `[ ]` = falta.
>
> **Estado de implementacion**: **F0 terminada** (T001-T003); F1-F5 pendientes.

## Historias de usuario

- [X] **US1** Modal comodo: full-screen movil, dialogo escritorio, drop zone, camara, estados (FR-001…FR-006 -> T004-T007)
- [X] **US2** Ajuste gestual en tiempo real: pan, pinch, doble tap, rotar (FR-007…FR-011 -> T008-T012)
- [X] **US3** Marco visual: tercios, zona atenuada, badge en vivo, fit con tablero (FR-012…FR-014 -> T013-T015)
- [X] **US4** Tira visual: miniaturas reales, quitar/cambiar, restauracion al re-editar (FR-015…FR-018 -> T016-T018)
- [X] **US5** Contrato y compatibilidad: consumidores intactos, puerta, contrato enmendado (FR-019…FR-021 -> T019-T021)

## Vendor y encolado (F0)

- [X] Cropper.js 1.6.2 vendoreado con hash SHA256 verificado y ORIGEN.md (D7/D8)
- [X] Handle `personalizador-pdf-cropper` (script + estilo) encolado antes que selector-pmu (D10)
- [X] Nunca CDN; nunca editar el minificado a mano
- [X] Puerta Node que congela el contrato publico de selector-pmu (FR-020)

## Decisiones de diseño

- [X] Evolucionar `SelectorPMU` en el mismo archivo, sin componente nuevo (D1)
- [X] Pointer Events como unico modelo de entrada; gestos multi-tacto de Cropper (D2)
- [X] El preview en vivo ES la salida (`getCroppedCanvas(finalW, finalH)`) (D3)
- [X] Gancho `ajustes:[]` reservado; filtros fuera de alcance (D4)
- [X] Cero cambios de servidor (D5)
- [X] Formas de ranura = presentacion; recorte rectangular (D6)
- [X] Hibrido crop/fit: `fit` conserva el canvas actual (D9)
- [X] Degradacion sin `window.Cropper` (FR-006)

## Fuera de alcance (declarado)

- [X] Filtros (reservados, T023)
- [X] Servidor, `modules/textmuy/`, galeria del admin (spec 009)
- [X] Recortes no rectangulares, reordenar en la tira, multi-seleccion
