# Contrato — Visor de la biblioteca (PMUBiblioteca + PMUVisor)

**Spec**: 043 | **Version**: 1 (2026-11-20)

Contrato de la tira del modal de carga y de su visor completo. La tira permite elegir una foto; el
visor permite elegir **o borrar** cualquier foto de la biblioteca.

## 1. Tira

```js
PMUBiblioteca.tira(contenedor, {
  onElegir(foto) {},     // carga directo en el editor
  onVerTodas(indice) {}, // abre el visor (nuevo destino del chip)
  limite: null           // opcional; por defecto, lo que entra en el ancho
});
```

- Cada celda es una **foto** (no una familia ni una version).
- Al final va **siempre** el chip **"Ver todas (N)"**, con el total real de fotos.
- Si la biblioteca esta vacia: estado vacio, sin chip accionable ("Ver todas (0)" no abre nada).
- La tira se repinta tras elegir, subir o borrar (invalidacion local + `revision` de la spec 042).

## 2. Visor

```js
PMUBiblioteca.verTodas({ indice: 0 });
PMUBiblioteca.visor(indice); // alias de compatibilidad
```

Se abre con `PMUVisor.abrir({ items, indice, titulo: 'Mi biblioteca', acciones })`:

| Accion | Clase | Efecto |
|---|---|---|
| `Elegir` | `button-primary` | cierra el visor y llama `onElegir(foto)` |
| `Eliminar` | `pmu-visor-peligro` | flujo de borrado (§3) |

- `items[i] = { url, etiqueta }`; `url` sale del camino rapido (o del respaldo).
- El visor muestra **todas** las fotos, no solo las visibles en la tira.
- Sin `PMUVisor` (tema sin visor y plugin sin visor propio): se avisa con la causa y la tira sigue
  funcionando; el contrato es **dependencia blanda**.

## 3. Borrado en dos pasos

```js
PMU_API.borrarFoto(id)            // 1) sin confirmar
PMU_API.borrarFoto(id, true)      // 2) con confirmar=1
```

| Respuesta | Significado | UI |
|---|---|---|
| `success: true` | borrada (no estaba en uso) | sin dialogo; se quita de la tira y del visor |
| `success: false, data.referencias` | esta en uso (carrito/pedidos) | dialogo del visor: "Esta imagen esta en uso. Borrar igual?" + lista |
| otro error | red o servidor | se muestra la causa y **no** se quita |

- El dialogo usa el mini-dialogo existente (`confirmar: true`, `pregunta`, `textoOk`, `Cancelar`).
- Cancelar no borra nada.
- Tras borrar: no se reabre el visor con la posicion corrida; si quedan fotos, se reposiciona; si
  era la ultima, se cierra y se vuelve a la tira.

## 4. Seleccionar desde el visor

`Elegir` -> `SelectorPMU.cargarDesdeBiblioteca(foto)`:

1. Toma `foto.id` y la receta del **contexto** (`foto.recetas[clave]`), si existe.
2. Baja la imagen por `media.php?op=imagen` (1 GET; cache HTTP 7 dias + ETag) con respaldo autom.
3. Carga en el lienzo con la receta aplicada.
4. Al guardar: **0 bytes** (existente) o subida (nueva).

## 5. Contadores

- `N` del chip = cantidad de fotos de la biblioteca **vigente** (la misma que pinta la tira).
- Si la lista cambia (subida o borrado), el chip se recalcula sin recargar la pagina.
- El numero se muestra tal cual; no se abrevia ("Ver todas (12)", nunca "Ver todas (10+)").

## 6. Fuera de contrato

- Edicion de imagen avanzada (filtros/texto): otro contrato futuro.
- Reordenar o multi-seleccion: no soportado.
- Borrado masivo ("borrar todas"): no existe en la 043.