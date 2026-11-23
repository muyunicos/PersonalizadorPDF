# Contract — Recetas por objetivo (spec 047, Fase 6)

## 1. Catalogo (`uploads.json`)

```jsonc
{
  "version": 1,
  "items": {
    "{id}": {
      "id": "e439e82ec506",
      "ext": "webp",
      "bytes": 120000,
      "w": 800, "h": 600,
      "creado": 1795457393,
      "ultimo_uso": 1795457393,
      "recetas": { "{objetivo}": { "modo": "cubrir" } },
      "ajustes": { "objetivo": "{objetivo}", "configuracion": { "modo": "cubrir" } }
    }
  }
}
```

- `recetas`: mapa `objetivo -> configuracion` (delta).
- `ajustes`: última receta aceptada (objeto `{objetivo, configuracion}`).
- Las claves viejas (`{gid}-{w}x{h}-{phsize}`) se **ignoran** al leer.

## 2. Objetivo

```text
objetivo := [0-9]+\.[0-9]{4}-[01]-[0-9]+
```

- `aspecto` = `w/h` con 4 decimales.
- `familia` = `0` rect / `1` redonda.
- `area` = `w*h` resuelto (px²).

## 3. Configuración (delta)

```jsonc
{ "modo": "cubrir", "zoom": 1.25, "rot": 90, "ox": 0.1, "oy": -0.05,
  "fondo": "#ff0000", "transp": "no" }
```

Solo se incluyen las claves distintas del default (`{modo:'cubrir'}`, escala 1, centro,
sin rot, fondo auto, sin desplazamiento).

## 4. `listar` (respuesta)

```jsonc
{
  "success": true,
  "data": {
    "revision": "abc123def456",
    "fotos": [
      { "id": "e439e82ec506", "url": "...", "thumb": "...",
        "recetas": { "1.0000-1-250000": { "modo": "cubrir", "zoom": 1.25 } },
        "ajustes": { "objetivo": "1.0000-1-250000", "configuracion": { "modo": "cubrir", "zoom": 1.25 } } }
    ]
  }
}
```

- `recetas` y `ajustes` se agregan al payload actual (sin romper consumidores).
- `sin_cambios` y `revision` no cambian.

## 5. Subida (params)

El cliente manda la **configuración delta** y el **objetivo**; el servidor deriva la v2:

```text
POST personalizador_pdf_subida
  imagen: archivo (original acotado)
  params: configuracion (delta)
  objetivo: {aspecto}-{familia}-{area}
  sid / item_key / pdf / _wpnonce
```

Respuesta: `{success, data:{id, item_key, receta, params}}`.

- Si falta `objetivo`, el servidor lo deriva de la ranura.
- El hash se calcula **siempre** en el servidor.

## 6. Errores

| Codigo | Causa |
|---|---|
| `motor:receta:objetivo` | objetivo con formato invalido |
| `motor:receta:delta` | delta con claves/rangos invalidos |
| `motor:receta:sin_original` | no hay original para derivar la v2 |
| `motor:receta:vieja` | (informativo) se ignoro una receta con clave vieja |

## 7. Compatibilidad

- Las recetas viejas se **ignoran** (no se migran, no se reutilizan).
- Los items ya guardados conservan su `params` v2 y siguen regenerando el PDF.