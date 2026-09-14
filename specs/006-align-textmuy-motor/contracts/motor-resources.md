# Contrato: Motor de recursos (align-textmuy-motor)

**Fecha**: 2026-09-14 | **Feature**: 006-align-textmuy-motor

Único punto de lectura y escritura de los recursos del editor. Reemplaza a cualquier esquema de handlers sueltos y a cualquier segunda raíz de datos.

## Endpoint

`POST admin-post.php?action=pmu_uploads`

| Aspecto | Regla |
|---|---|
| Seguridad | Capacidad `manage_options` verificada en servidor en `handle_pmu_uploads()` + `_wpnonce` de la acción `pmu_uploads` verificado en servidor al inicio de `handle_request()`, antes de cualquier `op` |
| Orden de rechazo | capacidad → nonce → `op` → ámbito → payload |
| Campos comunes | `op` (obligatorio), `scope`/ámbito según la operación |
| Respuesta | JSON con `success` y, en error, causa con el formato fijo del contrato |
| Causa de error | `motor:<op>:<motivo>` (por ejemplo `motor:alta:ambito:invalido`) |
| Sin fallbacks | Nunca responde éxito con datos sustitutos ni deja el estado a medias |

## Whitelist

- `op`: `listar`, `alta`, `baja`, `editar`, `sprite`, `miniatura`
- Ámbitos del motor: `fonts`, `img`, `pdfs`, `orders`, `tmp`, `tm-presets`
- Ámbitos del editor (subconjunto): `fonts`, `img`, `tm-presets` — sin alias

## Operaciones

Params canónicos: `scope` (alias aceptado `ambito`), `title` (alias `titulo`), `file` (alias `archivo`); `sprite` usa `scope`; `miniatura` usa `nombre`. Los alias se normalizan en un punto de `handle_request()`.

| `op` | Payload | Éxito | Efecto en disco |
|---|---|---|---|
| `listar` | `scope` (o ámbito) | `{catalogo, items}` con `items` = `{id,title,cats,file,url}` | Ninguno (crea catálogo vacío si falta) |
| `alta` | `scope`, `title`/`titulo`, `cats`, `file`/`archivo` | `{id, nombre}` | Guarda archivo físico + entrada en el catálogo |
| `baja` | `scope`, `id` (o `file`) | `{id}` | Elimina el archivo físico + vacía la entrada sin reindexar |
| `editar` | `scope`, `id`, campos nuevos (`title`, `cats`, `file`) | `{id, nombre}` | Renombra el archivo si cambió el nombre + actualiza la entrada |
| `sprite` | `scope`, archivo `thumbs.webp` | `{spriteUrl}` | Persiste el sprite del ámbito y limpia restos anteriores |
| `miniatura` | `nombre`, archivo `webp` | `{url, nombre}` | Persiste la miniatura dentro del ámbito `img` |

## Reglas de resolución de rutas

1. Raíz única: `uploads/pmu/`.
2. Directorio de un ámbito: `uploads/pmu/<scope>/`.
3. Catálogo de un ámbito: nombre **explícito** por ámbito (`fonts.json`, `img.json`, `presets.json`); el nombre del archivo no se deriva del nombre del directorio.
4. Sprite: `uploads/pmu/<scope>/thumbs.webp`.
5. Miniaturas de grupos: `uploads/pmu/img/{pdf}-{letra}.webp`.
6. Prohibido: cualquier ruta que resuelva a `uploads/tm/` o a `uploads/pmu/tm/` salvo la vigente `uploads/pmu/tm-presets/`.

## Errores tipificados de referencia

| Situación | Causa esperada |
|---|---|
| `op` ausente | `motor:op:falta` |
| `op` fuera de la whitelist | `motor:op:invalido:<op>` |
| Ámbito inválido | `motor:<op>:ambito:invalido` |
| Datos obligatorios ausentes | `motor:<op>:falta:<campo>` |
| Directora no escribible | `motor:<op>:directorio:no_escribible` |
| Archivo con formato no admitido | `motor:<op>:tipo:invalido` |
| Capacidad insuficiente | `motor:capacidad:invalida` |
| Nonce ausente o inválido | `motor:nonce:invalido` |

## Propagación al editor

El motor alimenta directamente el puente: las bases de lectura (`presetsBase`, `fuentesBase`, `imagenesBase`) y los inventarios iniciales se construyen con las mismas rutas de este contrato. Cualquier divergencia entre el puente y este documento es un defecto, no una variante.
