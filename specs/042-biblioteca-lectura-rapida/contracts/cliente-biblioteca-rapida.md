# Contract: cliente de la biblioteca rapida

**Fecha**: 2026-11-19 | **Spec**: [spec.md](../spec.md) | **Plan**: [plan.md](../plan.md)

**Complementa** el contrato del cliente de la 040 y el comportamiento actual de
`assets/biblioteca-pmu.js`; no cambia las escrituras ni el contrato del cargador.

## `PMU_FICHA.biblioteca`

```js
biblioteca: {
  endpoint: 'https://sitio/wp-admin/admin-post.php', // respaldo (nonce)
  nonce: '...',
  rapido: 'https://sitio/wp-content/plugins/personalizador-pdf/media.php', // opcional
  revision: 'a1b2c3d4e5f6',   // 12 hex o ''
  identidad: 'u123'           // o 's8f3a1c2d'
}
```

- `rapido` se publica **solo** si el config existe, el `.htaccess` se pudo escribir y el camino liviano
  esta habilitado.
- `revision` se calcula al render de la ficha desde `uploads.json` (mtime + ids); `''` si no hay catalogo.
- `identidad` es `u{uid}` o `s{sha1(sid)[0:8]}`; es un discriminador de cache, no un token.
- En modo edicion (`?pmu_item_key=`), el mapa `urls` usa la URL liviana **solo** para las filas
  `subidas[]` con `origen: original` y **solo** si la cookie de identidad esta presente; el resto conserva
  `url_biblioteca_imagen` (item).

## `PMUBiblioteca` (`assets/biblioteca-pmu.js`)

### Cache

- Clave: **`pmu_bib_v3`**; valor `{revision, identidad, fotos[], ts}`.
- `fotos[]` incluye `thumb_data` (hasta 10) y las URLs estables del camino liviano.
- Si `identidad` no coincide con `PMU_FICHA.biblioteca.identidad`, la copia se descarta.
- Frescura: 5 minutos sin `revision`; con `revision` + `identidad` iguales, **0 solicitudes**.
- En modo privado o sin almacenamiento, la copia vive solo en memoria.

### `pedir()`

1. Si hay `rapido` y `modo !== 'wp'`: `GET <rapido>?op=listar[&desde=<revision>]` con
   `credentials:'same-origin'`; sin nonce.
2. Si la respuesta es `fallback:true`, error HTTP/red, o `data.identidad` no coincide con
   `PMU_FICHA.biblioteca.identidad`: se pasa a `modo='wp'` y se usa el endpoint actual.
3. Endpoint actual: `POST` con `action=personalizador_pdf_biblioteca`, `op=listar`, `_wpnonce`, `desde`
   (igual que hoy).
4. Se guarda `{revision, identidad, fotos, ts}`.

- Una sola promesa en vuelo (`enVuelo`) para deduplicar `calentar()` + `tira()` + doble apertura.
- La copia envenenada (`sin_cambios` + `fotos:[]`) conserva el auto-sanado actual: se re-pregunta una vez
  sin `desde`.

### `tira(el, opts)`

1. Si hay copia, se pinta **ya**.
2. Si `previa.revision === rapido.revision` y `previa.identidad === rapido.identidad` y la copia es fresca (menos de 5 min): **no se pide nada**.
3. Si no: `pedir()` una vez y se repinta.
4. Si `pedir()` falla, se mantiene la copia si existe; si no, estado vacio (sin errores tecnicos).

- La tira propia y la delegacion en `MU.coleccion` usan `f.thumb_data || f.thumb || f.url`.

### `elegir(indice)`

- Carga `foto.url` (camino liviano).
- Si la imagen falla, reintenta **una vez** con la URL del endpoint actual construida desde `endpoint` +
  `nonce` + `id`; si tambien falla, muestra el error actual del cargador.
- No cambia el contrato de `cargarDesdeBiblioteca(foto)`.

### `invalidar()`

- Borra `pmu_bib_v3` y la copia en memoria.
- Se llama: al subir una foto (nuevo), al borrar desde la galeria (existente) y al cambiar de identidad.

### `cache()`

- Devuelve la copia vigente o `null`; la ficha y el cargador no la modifican.

## Ranuras de la re-edicion (`assets/tienda.js` + `assets/cargador-pmu.js`)

- `PMU_FICHA.urls[id]`:
  - fila `origen: original` + cookie de identidad + camino habilitado -> `media.php?op=imagen&u=...&id=...`;
  - fila con `file`/`ref`/`compuesta` -> `url_biblioteca_imagen` (item, `admin-post` + nonce);
  - sin cookie o sin camino habilitado -> la URL actual (funciona, solo mas lento).
- `urlDeSubida(id)` sigue igual: primero el recorte local de la pestaña (0 POST), despues el mapa
  `PMU_FICHA.urls`, despues `personalizador_pdf_subida_url` (respaldo por foto).
- `cargador-pmu.js` conserva sus blobs locales y miniaturas marcadas; si una imagen de ranura liviana falla,
  reintenta la URL actual una vez.
- El cargador no cambia su API publica (`urlDe`, `onSubida`, etc.).

## Invalidacion despues de subir

- En el punto donde `personalizador_pdf_subida` responde OK, se llama `PMUBiblioteca.invalidar()` si esta
  disponible (una linea, sin await).
- El borrado (`api.borrarFoto`) ya invalida; se conserva.
- El login/logout no necesita una llamada explicita: la `identidad` de la ficha cambia y la copia se
  descarta al comparar.

## Respaldo y errores

- `modo='wp'` vive en memoria durante la pagina; no se persiste.
- No hay reintentos en bucle: 1 intento liviano + 1 intento actual como maximo.
- El comprador no ve causas tecnicas: si ambos caminos fallan, se muestra el estado vacio/error actual del
  cargador.
- Las escrituras (subida, borrado, vista previa, pool, pedido) no cambian.

## Restricciones

- Sin secretos en JS ni en el HTML; la cookie de lectura es `HttpOnly`.
- `localStorage` guarda solo metadatos y hasta 10 miniaturas; nunca fotos completas.
- La delegacion `MU.coleccion` recibe los mismos items; no se cambia su API.
- `selector-pmu.js` no cambia su contrato; solo se beneficia de la tira y del fallback de imagen.

## Pruebas del contrato

- `node tests/biblioteca-contrato.test.js`: clave v3, prioridad `thumb_data`, salto por revision/identidad,
  fast/fallback, ausencia de nonce en el camino liviano, invalidacion.
- `node tests/ficha-pedido.browser.js`: 1 `media.php?op=listar` en la primera apertura, 0 lecturas por
  `admin-post`, 0 `op=miniatura`, reapertura con 0 solicitudes, fallback abortando `media.php`, item con 6
  fotos de ranura sin `personalizador_pdf_subida_url` para las originales.