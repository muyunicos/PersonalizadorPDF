# Contract: `metadata.json` (dataset del producto PDF)

**Feature**: 007-pmu-pdf-layout | **Version**: 2 (id = color hex sin `#`, campos de personalizacion planos)

Ubicacion unica: `uploads/pmu/pdfs/{nombre}/metadata.json`. Es a la vez resultado del analisis y
configuracion del administrador (unica fuente del contenido por grupo). Se escribe de forma
atomica y su lectura nunca lanza por contenido ilegible.

## Esquema raiz

| Clave | Tipo | Obligatorio | Descripcion |
|-------|------|-------------|-------------|
| `pdf` | string | si | Nombre saneado del producto (base de la carpeta y del PDF) |
| `dpi_conversion` | int | si | Base de conversion px (200) |
| `creado` | string | si | ISO-8601 UTC del ultimo analisis |
| `activo` | bool | si | Producto activo/inactivo (spec 004 `status`); no existe por grupo |
| `total_grupos` | int | si | Cantidad de entradas de `grupos` |
| `grupos` | object[] | si | Grupos detectados, ordenados por RGB (determinista) |

## Grupo

| Clave | Tipo | Obligatorio | Descripcion |
|-------|------|-------------|-------------|
| `id` | string | si | Color hex sin `#` (p. ej. `0000FF`); clave del grupo en archivos, URLs, formularios y puente |
| `w` / `h` | int | si | Tamano base del grupo en px (base 200 ppp) |
| `cont` | int | si | Instancias del grupo (la usa la validacion del motor) |
| `pgs` | int[] | si | Paginas 0-based (informativo) |
| `default` | string/null | no | `null` = hueco intacto; o `texto`, `img` o slug de modulo |
| `value` | string/null | no | Plantilla del contenido (literal o `[campoX]`) |
| `preset` | string/null | no | Slug de preset TextMuy |
| `config` | string/null | no | Configuracion del modulo activo (string opaco, hoy TextMuy) |

Ejemplo:

```json
{
  "pdf": "circulo6cm",
  "dpi_conversion": 200,
  "creado": "2026-09-15T00:00:00Z",
  "activo": true,
  "total_grupos": 2,
  "grupos": [
    { "id": "0000FF", "w": 463, "h": 463, "cont": 8, "pgs": [0],
      "default": "texto", "value": "Hola [campo3]", "preset": "neon-glow",
      "config": "settings.font.src='Montserrat',[campo1]" },
    { "id": "FF0000", "w": 463, "h": 463, "cont": 7, "pgs": [0], "default": null }
  ]
}
```

## Reglas de escritura

1. **Atomica**: escribir `metadata.json.tmp` en la misma carpeta y `rename()` sobre el destino.
2. **Orden estable**: `grupos` conserva el orden del analisis; al guardar personalizacion no se reordena.
3. **Preservacion en re-analisis**: se conservan los campos de personalizacion (`default`, `value`,
   `preset`, `config`) de los grupos cuyo `id` sigue existiendo; el resto se descarta y se informa.
4. **Sin estado derivado**: no se guardan rutas de placeholders ni copias del PDF. Nada de
   `textos.json` (su contenido viaja a `value`/`preset`/`config`).
5. **Lectura tolerante**: archivo ausente, vacio o invalido = producto sin datos: la consola
   ofrece "Re-analizar" y nunca lanza.

## Criterios de aceptacion

- Guardar la personalizacion del grupo `0000FF` modifica solo esa entrada de `grupos` y reescribe el
  archivo completo de forma atomica.
- "Re-analizar" no pierde `default`/`value`/`preset`/`config` de los ids que siguen existiendo.
- El archivo contiene unicamente las claves del esquema (nada de `letra`, `color`, `color_rgb`,
  `ancho_*`, `num_instancias` ni `paginas`).