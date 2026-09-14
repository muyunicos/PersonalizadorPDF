# contracts/motor-contract.md — Motor PMU Uploads (003)

**Fecha**: 2026-09-13 | **Feature**: 003-galeria-engine

## Endpoint único (HTTP)

`POST admin-post.php?action=pmu_uploads` — campo `op`:

| op | payload | respuesta success |
|---|---|---|
| `listar` | `ambito` | `{catalogo, items}` |
| `alta` | `ambito`, archivo (`imagen`/`fuente`/`txm`), `titulo`, `cats` | `{id, nombre, url}` |
| `baja` | `ambito`, `nombre`/`id` | `{id}` |
| `editar` | `ambito`, `nombre`, `nombreNuevo`, `catsNueva` | `{id, nombre, url}` |
| `sprite` | `ambito`, archivo webp | `{spriteUrl}` |
| `miniatura` | `nombre`, archivo webp | `{url, nombre}` |

## Clase `PMU_Uploads` (API interna PHP)

| Método | Firma | Responsabilidad |
|---|---|---|
| `catalogo($ambito)` | ambito in {fonts, img, pdfs, orders, tmp, tm-presets} | lee JSON (seed lazy si falta); devuelve {thumbs, items} |
| `guardar_catalogo($ambito, $cat)` | escribe JSON canónico | única vía de escritura del catálogo |
| `listar($ambito)` | merge catálogo + físicos | items {id, title, cats, file, url, thumb, enUso} |
| `alta($ambito, $title, $cats, $file)` | tupla vía `tupla_alta` (hueco más bajo / max+1) | devuelve id |
| `baja($ambito, $id)` | tombstone + unlink físico | sin reindexar |
| `editar($ambito, $id, $nuevo...)` | renombra físico + tupla | devuelve item nuevo |
| `sprite($ambito, $blob)` | persiste `tm/{ambito}/thumbs.webp` | borra restos |
| `miniatura($nombre, $blob)` | persiste `img/{nombre}.webp` | para grupos de PDF |

## Seguridad

- **Nonces**: `wp_create_nonce('pmu_uploads')`
- **Capabilities**: `manage_options`
- **Whitelist op**: {listar, alta, baja, editar, sprite, miniatura}
- **Whitelist ambito**: {fonts, img, pdfs, orders, tmp, tm-presets}
- **Sin fallbacks**: Todo rechazo con causa JSON (`motor:<op>:<motivo>`)

## Respuestas de error

| Código | Formato |
|---|---|
| op falta | `motor:op:falta` |
| op inválido | `motor:op:invalido:<op>` |
| ambito inválido | `motor:<op>:ambito:invalido` |
| archivo falta | `motor:<op>:falta:archivo` |
| directorio no escribible | `motor:<op>:directorio:no_escribible` |
| invalid file type | `motor:<op>:tipo:invalido` |
