# Contract — Cliente de la biblioteca (spec 030)

Modulo: `assets/biblioteca-pmu.js` (**nuevo**). Lo cargan la ficha (`assets_ficha`) y el preview de la consola.
Depende de `PMU_API` (spec 018) y del endpoint `admin_post_personalizador_pdf_biblioteca` (D19).
Contrato del servidor: [biblioteca.md](./biblioteca.md).

## API publica

| Miembro | Firma | Que hace |
|---|---|---|
| `PMUBiblioteca.abrir` | `(opts)` -> `void` | dibuja la **tira** de imagenes en `opts.contenedor` |
| `PMUBiblioteca.cache` | `()` -> `{version, fotos, ts}` | estado vigente de la cache (diagnostico y puertas) |
| `PMUBiblioteca.invalidar` | `()` -> `void` | descarta la copia local (tras subir o borrar) |
| `PMUBiblioteca.visor` | `(indice)` -> `void` | abre el visor fullscreen en modo biblioteca |

`opts`: `{contenedor, onElegir(fuente), tecnico}`. `onElegir` recibe la foto elegida (con su blob) para que
el modal de recorte la cargue como fuente.

Sin endpoint (consola o preview) `abrir()` **no dibuja nada** y avisa por `console.warn`: nunca rompe la ficha.

## Cache (D23 / R8)

- Identificador `pmu_bib_v1` en `sessionStorage` (fallback `localStorage`); valor `{version, fotos[], ts}`.
- **Solo metadatos**: nunca blobs (las imagenes son URLs del endpoint -- `op=imagen` -- con `Cache-Control: private`).
- **Una sola instancia por pagina**, **compartida por todos los campos/ranuras** de la ficha.
- Se pide **una vez**; despues cada `listar` manda `desde=<revision>` y, si el servidor contesta
  `sin_cambios:true`, se reusa la copia local (0 bytes).
- Invalidacion: **tras subir o borrar una imagen se vuelve a pedir la lista** al servidor (nunca se parchea a mano).
- Tope de **10 contenedores** por respuesta (lo aplica el servidor).

## Tira (`pmu-bib-tira`)

- **Una imagen por familia** (nunca por version): la `base` (el `.webp` que ya existe, servido por `op=imagen`; **sin miniaturas derivadas**), con badge `N versiones` y, si
  aplica, `en tu carrito` o `compra #N` (sale de `usos`).
- Orden: **por fecha, las mas nuevas primero**, **sin filtro** por compatibilidad con el hueco (D27): las
  que no encajan se recomponen al elegirlas.
- Se monta **dentro del modal de recorte** (`spmu-modal`); **no** se dibuja en la ranura del campo (D28).
- La tira pinta **hasta 10 fotos**; el visor muestra **todas** las que devolvio la respuesta.
- Se abre con el boton **Elegir ya subida** del modal de recorte.
- Si no hay fotos, la tira **no se dibuja** (la ficha no muestra estados vacios).
- Con `tecnico: true` (preview de la consola) suma las causas (`sin endpoint`, `sin identidad`).

## Visor (`pmu-bib-visor`)

- Fullscreen, flechas, swipe (mismo patron que el visor de la ranura, spec 021 D9).
- Acciones: **Elegir** (devuelve la fuente al modal) y **Borrar** (D25).
- `Borrar` pide primero la **situacion en vivo** (`op=usos`: versiones, bytes, carrito, pedidos), la muestra en el aviso y,
  al confirmar, llama a `op=borrar` e **invalida la cache**. El cliente **no** decide si se puede borrar: no hay bloqueos (D17).

## Elegir vs Subir (D8)

| Situacion | Boton | Resultado |
|---|---|---|
| la receta del hueco es igual a la de la foto | **Elegir** | `op=usar` con la `madre`: el servidor **referencia** (0 bytes) |
| la receta difiere (proporcion, modo, escala, desplazamiento, fondo o giro) | **Subir** | se abre el recorte con esa fuente y se sube la **version** `{madre}-{n}` |
| la fuente vive en `tmp/` | segun receta | el servidor **copia** al item (D9): `tmp` nunca se referencia |
