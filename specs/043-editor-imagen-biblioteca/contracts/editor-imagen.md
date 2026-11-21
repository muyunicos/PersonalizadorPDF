# Contrato — Editor de imagen (SelectorPMU + CargadorPMU)

**Spec**: 043 | **Version**: 1 (2026-11-20)

Contrato entre el cargador de una ranura (`CargadorPMU`) y el editor de recorte (`SelectorPMU`).
Define como se abre una foto existente, como se guarda **sin subir bytes** y como se cancela.

## 1. Abrir

```js
selector.open({
  archivo: null,           // File para modo "nueva"; null/no para modo "editar"
  tituloContexto: '',      // "Editar imagen #2" o ''
  params: null             // receta del contexto (ver §2); null = defaults
});
```

| Modo | Cuando | `archivo` | `params` | Boton primario |
|---|---|---|---|---|
| `nueva` | "Cargar imagen" o arrastrar | `File` | `null` | **Guardar** |
| `editar` | toque de una miniatura del campo | `null` | receta | **Guardar** |
| `editar` desde biblioteca | toque en el visor | `null` | receta del contexto (si existe) | **Guardar** |

**Regla**: en modo `editar` el selector **debe** abrir con la imagen ya cargada y el encuadre
aplicado; no puede pedir archivo.

## 2. Receta del contexto

```js
params = { w, h, modo, escala, ox, oy, rot, fondo, gid, phsize }
```

- La clave del contexto es `"{gid}-{w}x{h}-{phsize}"`.
- Orden de resolucion: catalogo (`uploads.json recetas[clave]`) → memoria del cargador →
  valores por defecto del campo.
- Si la receta no aplica a la geometria actual, se descarta y se abre con defaults (aviso no
  bloqueante).

## 3. Guardar

```js
selector.config = {
  subirAsync(blob) -> Promise<id>,            // imagen NUEVA (comportamiento actual)
  usarExistente(id, params, url) -> Promise,  // imagen EXISTENTE (0 bytes)
  declararReceta(id, params) -> void          // receta NUEVA de una existente (0 bytes)
};
```

| Caso | Condicion | Resultado |
|---|---|---|
| Existente, receta identica | firma de `params` igual a la previa | `usarExistente` (0 bytes) |
| Existente, receta distinta | firma distinta | `usarExistente` + `declararReceta` (0 bytes) |
| Nuevo archivo | sin `_bib.id` | `subirAsync` (bytes) |

**Obligatorio**: `CargadorPMU` **debe** cablear `declararReceta`. Sin el, el selector cae a subir
bytes (el bug que cierra esta spec).

`declararReceta(id, params)` no manda imagen: registra la receta en el cargador y dispara
`onRecorte(id, url, params)` para que `tienda.js` la envie con el grupo.

## 4. Cancelar

```js
selector.close() // o boton Cancelar / Escape
```

- Descarta `params` en memoria.
- No llama `subirAsync`, ni `usarExistente`, ni `declararReceta`.
- Si habia una imagen nueva elegida sin guardar, **no** queda en la biblioteca.
- Emite `onError({ code: 'CROP_ABORTED' })`; el cargador restaura la miniatura y no cambia nada.

## 5. Acciones visibles

```js
selector.config.acciones = [
  { id: 'editar',   etiqueta: 'Editar recorte', primaria: true },
  { id: 'eliminar', etiqueta: 'Eliminar',       primaria: false }, // solo modo editar
  { id: 'cargar',   etiqueta: 'Cargar imagen',  primaria: false },
  { id: 'ver_todas', etiqueta: 'Ver todas (N)', primaria: false }
];
```

`eliminar` dispara `cargador._quitar(indice, posicion)` (flujo de §6 del contrato del visor).
La lista es **extensible**: agregar `ajustes` o `texto` no cambia el modal ni este contrato.

## 6. Errores

| Codigo | Causa | Que hace el editor |
|---|---|---|
| `UPLOAD_FAILED` | fallo de red al guardar | muestra la causa y deja reintentar sin re-elegir |
| `RECIPE_INVALID` | receta no aplicable | abre con defaults y avisa |
| `IMAGE_GONE` | la foto ya no existe | informa y no re-sube bytes |
| `CROP_ABORTED` | cancelado | cierra sin escrituras |

## 7. Compatibilidad

- Sin `declararReceta` (consumidores viejos, preview del admin): se comporta como hoy (sube bytes).
- Sin `usarExistente`: la biblioteca no carga directo; se mantiene el comportamiento del respaldo.
- El contrato **no** depende de `PMUBiblioteca` ni de `PMUVisor`.