# Contrato — WebP en el pool y las subidas (spec 026)

## 1. Formato (siempre por FIRMA, nunca por nombre)

| Bytes | Extension | `mime` |
|---|---|---|
| `RIFF....WEBP` | `webp` | `image/webp` |
| `\x89PNG\r\n\x1a\n` | `png` | `image/png` |
| `\xFF\xD8\xFF` | `jpg` | `image/jpeg` |
| `GIF87a` / `GIF89a` | `gif` | `image/gif` |

`PMU_Sesion::firma_imagen()` ya es la fuente unica de esta tabla. **JPEG** puede
entrar en `subidas/` (es una foto del cliente) pero **nunca** en el pool del
texto renderizado (no tiene alfa).

## 2. Archivos

| Zona | Ruta | Contenido |
|---|---|---|
| Pool del item | `img/{pdf}-{grupo_id}-{n}.{ext}` | el recorte rasterizado al hueco |
| Subida del comprador | `subidas/{id}.{ext}` | la foto original del cliente |

`n` es correlativo **por grupo** y cuenta **todos** los formatos (si no, un PNG
y un WebP del mismo grupo se pisarian).

## 3. Calidades

| Contenido | Calidad | Motivo |
|---|---|---|
| Fotos del comprador (`subidas/`) | `0.85` | unseen al usuario; ahorro maximo |
| Pool del texto renderizado | `0.92` | los bordes con antialias no deben degradarse |
| Conversion del servidor (red de seguridad) | `0.92` | conservadora |

## 4. Fallbacks

| Situacion | Que pasa |
|---|---|
| El navegador no codifica WebP | `toBlob` cae a **PNG en silencio** -> se acepta PNG (D2) |
| El servidor no tiene GD o `imagewebp` | se guarda el **original** (fail-safe) |
| El archivo no es una imagen valida | `motor:subida:formato:invalido` / `motor:pool:png:invalido` |

## 5. Lo que NO cambia

- Las **dimensiones** (D7): el PNG mide `min(recorte, hueco)` y el WebP lo mismo.
- El **alfa**: PNG y WebP lo transportan igual (verificado con GD: `alfa_esq=127`,
  `alfa_centro=40`).
- El **PDF final**: el Motor arma el mismo spec `raster` (rgb + alpha -> SMask).
- Los **items viejos**: los PNG ya guardados se siguen leyendo (D8).
