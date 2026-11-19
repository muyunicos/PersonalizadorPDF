# Contrato: catalogo de uploads y endpoints de la biblioteca

**Version**: 1 | **Fecha**: 2026-11-19 | **Spec**: [../spec.md](../spec.md)

## C1 — Archivo `uploads.json`

```json
{
  "version": 1,
  "items": {
    "9f2c41ab0d7e": {
      "ext": "webp",
      "bytes": 412000,
      "w": 900,
      "h": 1200,
      "creado": 1761000000,
      "ultimo_uso": 1761000456,
      "recetas": {
        "FF0000-1532x1145-1": {
          "gid": "FF0000",
          "w": 1532,
          "h": 1145,
          "phsize": 1,
          "params": { "v": 2, "modo": "cubrir", "escala": 1.2, "ox": 0.5, "oy": 0.5, "rot": 0, "fondo": "#ffffff", "transp": "no", "iw": 900, "ih": 1200, "w": 1532, "h": 1145, "phsize": 1, "gid": "FF0000", "forma": "rectangulo" },
          "ts": 1761000123
        }
      }
    }
  }
}
```

Reglas:

- `items` es un **mapa** por `id` (`^[a-f0-9]{12}$`).
- `recetas` es un **mapa** por clave `"{gid}-{w}x{h}-{phsize}"`.
- `params` es la receta v2 **ya validada**; una receta invalida se descarta al escribir.
- El archivo se escribe **atomico** (`.tmp` + `rename`) y se lee **tolerante**: ausente, ilegible o
  `version` desconocida = catalogo inexistente (se reconstruye, sin recetas).
- Las **mutaciones se serializan** con `flock` sobre `uploads.json.lock`, con la lectura **dentro** del
  lock: dos pestanas no se pisan. El listado lee sin lock (el `rename` garantiza una version completa).
- **No se sirve por ruta propia**: no existe URL para este archivo.

## C2 — Miniaturas

- Nombre: `{id}-80x80.webp`, junto al original.
- Forma: 80x80, recorte al centro (cover), WebP q82.
- Si falta: se genera al pedirla y se conserva.
- Viaja con el original al promover el item; se borra con la imagen.

## C3 — `op=listar`

POST `action=personalizador_pdf_biblioteca&op=listar&_wpnonce=...` (`desde` opcional).

Respuesta:

```json
{
  "revision": "a1b2c3d4e5f6",
  "sin_cambios": false,
  "fotos": [
    {
      "id": "9f2c41ab0d7e",
      "url": "…&op=imagen&id=9f2c41ab0d7e…",
      "thumb": "…&op=miniatura&id=9f2c41ab0d7e…",
      "bytes": 412000,
      "w": 900,
      "h": 1200,
      "recetas": { "FF0000-1532x1145-1": { "…params v2…" } }
    }
  ],
  "totales": { "fotos": 1, "bytes": 412000 }
}
```

- Orden: mas nuevas primero (`creado` descendente).
- `sin_cambios: true` cuando `desde` coincide con la `revision` vigente (no viaja la lista).
- **No lee manifiestos ni pedidos ajenos**: se arma desde los catalogos de las carpetas del comprador.
- El cliente elige la receta por **clave** (forma + tamano + phsize); si no hay, encuadre por defecto.

## C4 — `op=imagen` y `op=miniatura`

GET/POST con `_wpnonce`; `id` obligatorio (`item_key` opcional, compatibilidad).

- `op=imagen`: bytes del original.
- `op=miniatura`: bytes WebP 80x80 (o `w` 32..512). Sin GD o ilegible: se sirve el original.
- Resolucion por identidad: cliente -> `orders/{clave}/uploads/`; invitado -> `tmp/sesion-{sid}/uploads/`. **Nunca** una ruta propuesta por el cliente.
- `Cache-Control: private` + `ETag`.

## C5 — `op=borrar` (dos pasos)

POST `id=...`:

1. Si la imagen la referencia **un item de carrito** o **un pedido**, y no vino `confirmar=1`:
   `{"requiere_confirmacion": true, "referencias": {"carrito": N, "pedidos": M}}` (no borra nada).
   El cliente MUST distinguirlos: con `pedidos > 0` el dialogo **advierte** que ese pedido deja de poder
   regenerarse (FR-019).
2. Con `confirmar=1`, o si no hay referencias: elimina original, miniatura y entrada del catalogo, y
   responde `{"borrado": true, "referencias": {"carrito": N, "pedidos": M}}`.

- Los **borradores NO cuentan** como referencia.
- Las imagenes del cliente **viven** en `orders/{uid}/uploads/`: el borrado las elimina **ahi**. Si la
  imagen esta en un pedido, tras la confirmacion se borra igual y ese pedido **deja de poder
  regenerarse** (FR-019, aceptado).
- Idempotente: borrar dos veces no rompe (segunda: `borrado: false`).

## C6 — Errores

| Causa | Cuando |
|---|---|
| `motor:nonce:invalido` | nonce ausente/expirado |
| `foto:ajena` | el `id` no esta en la cadena del comprador |
| `imagen:ausente` | el archivo no existe |
| `op:invalido` | `op` desconocido |
| `api:biblioteca:*` | fallo interno con causa |

## C7 — Invariantes de acceso

- Identidad: cookie `pmu_sid` (invitado) + cuenta logueada.
- El listado jamas incluye imagenes de otro comprador: las carpetas son por sesion o por cliente.
- No se publican rutas crudas de `uploads/`; toda lectura pasa por C4.
- El catalogo comparte la carpeta fisica de los originales y su misma exposicion (FR-013).