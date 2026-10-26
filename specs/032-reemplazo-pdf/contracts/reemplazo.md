# Contrato: reemplazo del PDF (ops de consola)

**Feature**: 032-reemplazo-pdf · **Version**: 1 · **Fecha**: 2026-10-26

> Superficie **externa** del feature: las tres acciones `admin_post` que consume `assets/admin.js`.
> No es la API publica del negocio (spec 010): esto es la **consola del admin**.

---

## 1. Acciones

| Accion (`admin_post_*`) | Nonce (`seguridad`) | Que hace | Toca datos |
|---|---|---|---|
| `personalizador_pdf_reemplazar_preparar` | `personalizador_pdf_reemplazar_preparar` | sube el PDF a staging, lo analiza y devuelve el **mapa** | **no** (solo `tmp/reemplazos/{pdf}/{ts}/nuevo/`) |
| `personalizador_pdf_reemplazar_confirmar` | `personalizador_pdf_reemplazar_confirmar` | respalda, hace el **swap por archivo** y reescribe `config.json` remapeado | **si** (producto + respaldo) |
| `personalizador_pdf_reemplazar_recuperar` | `personalizador_pdf_reemplazar_recuperar` | restaura el ultimo respaldo | **si** (producto) |

Todas exigen `manage_options` (via `seguridad()`) y responden **JSON** con el patron vigente
(`responder($ok, $data, $mensaje)`). **Sin recargas** (FR-014).

## 2. `reemplazar_preparar`

**Request** (`multipart/form-data`)

| Campo | Tipo | Requerido | Detalle |
|---|---|---|---|
| `pdf` | archivo | si | el PDF nuevo (`$_FILES['pdf']`, **nunca** `$_POST`) |
| `archivo` | string | si | nombre del producto destino (`{nombre}.pdf`), saneado |

**Response OK**

```json
{ "ok": true,
  "data": { "ts": "20261026-181501-a3f1",
            "pdf": "circulo6cm.pdf",
            "mapa": {
              "grupos_previos": 2, "grupos_nuevos": 2,
              "iguales": { "0000FF": "0000FF" },
              "sugeridos": [ { "de": "FF0000", "a": "00FF00",
                               "iou": 0.98, "color": 0.72, "score": 0.87 } ],
              "perdidos": [], "nuevos": [], "avisos": [] } } }
```

**Response error** (ejemplos)

| Causa | `mensaje` | Estado del producto |
|---|---|---|
| no hay archivo | `no_file` | intacto |
| no es PDF | `tipo` | intacto |
| el producto no existe | `pdf_inexistente` | — |
| PDF ilegible | `No se pudo leer el PDF: <detalle>` | **intacto** |
| sin placeholders | `No se detectaron placeholders...` (texto vigente de `analizar_y_guardar`) | **intacto** |

**Invariantes**

- **C-1**: preparar **no** modifica `pdfs/{nombre}/` (ni el PDF, ni los JSON). Se verifica por hash.
- **C-2**: preparar **borra** los staging previos del mismo producto (R8); **nunca** el `anterior/`.
- **C-3**: el `ts` devuelto es la unica llave para confirmar; caduca cuando un preparar lo reemplaza.
- **C-4**: el mapa viaja **solo** con lo necesario para decidir (nada de paths del servidor).

## 3. `reemplazar_confirmar`

**Request** (`application/x-www-form-urlencoded` o JSON con `wp_unslash`)

| Campo | Tipo | Requerido | Detalle |
|---|---|---|---|
| `archivo` | string | si | el producto |
| `ts` | string | si | el staging a confirmar (C-3) |
| `pares` | JSON array de `{de,a}` | no | lo que el admin acepta. Ausente = todos los `iguales` + `sugeridos` |
| `migrar` | bool | no | `false` o ausente = **cancelar** (equivale a `reemplazar_cancelar`) |

**Response OK**

```json
{ "ok": true,
  "data": { "pdf": "circulo6cm.pdf",
            "grupos": 2, "instancias": 15,
            "migrados": { "0000FF": "0000FF", "FF0000": "00FF00" },
            "perdidos": [], "avisos": [ "Envoltura del grupo 00FF00 revalidada a la forma por defecto" ],
            "respaldo": "20261026-181501-a3f1" } }
```

**Invariantes**

- **C-5**: antes del swap existe **siempre** `anterior/` con los 4 archivos (si el respaldo no se pudo
  escribir, **aborta** y el producto queda intacto).
- **C-6**: el swap es **por archivo**: la carpeta del producto **no** se borra (Bonus/fotos/productos viven
  en `config.json` y en el resto de la carpeta; FR-002).
- **C-7**: el servidor **revalida** `pares` contra el analisis previo/nuevo (INV-1 del data-model): un par
  con `de`/`a` inexistente se **ignora** y se reporta; el cliente no manda la verdad.
- **C-8**: cancelar (o `migrar:false`) **no** cambia nada del producto y descarta `{ts}/nuevo/`.
- **C-9**: al confirmar un `{ts}` nuevo se **borra** el `{ts}` anterior (INV-5).

## 4. `reemplazar_recuperar`

**Request**: `{ archivo }`. **Response OK**: `{ ok:true, data:{ pdf, respaldo, restaurado:true } }`.

**Invariantes**

- **C-10**: restaura `{nombre}.pdf`, `analisis.json`, `config.json` y `envolturas.json` del `anterior/`
  **byte a byte** (SC-005), y **no** toca el resto de la carpeta.
- **C-11**: tras recuperar, el respaldo **se conserva** (se puede re-reemplazar); una segunda recuperacion
  da el mismo resultado.
- **C-12**: sin respaldo -> error con causa (`motor:reemplazo:respaldo:ausente`) y el producto intacto.

## 5. Lo que este contrato **no** promete

- La forma del **modal** y sus textos (UI interna; la cubre el quickstart y la puerta de lab).
- Ningun endpoint, dato ni comportamiento para el **comprador** (FR-013).
- Cambios en el formato de `config.json`/`analisis.json`/`envolturas.json` (D5/§IV).
- El **contenido** del mapa mas alla de los campos de la tabla (los `avisos` son texto legible, sin
  formato estable).