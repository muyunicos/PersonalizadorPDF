# Contract: Personalizacion del grupo (`default`, `value`, `preset`, `config`)

**Feature**: 007-pmu-pdf-layout | **Version**: 2 (campos planos, id = color hex sin `#`)

Define como se configura cada grupo del PDF. Los campos viven `en linea` dentro de la entrada del
grupo de `metadata.json` (no hay bloque anidado `contenido`).

## Campos

| Campo | Tipo | Obligatorio | Descripcion |
|-------|------|-------------|-------------|
| `default` | string/null | no | Que debe haber en el hueco cuando no hay valor: `null` (nada, hueco intacto), `texto`, `img`, o el slug de un futuro modulo |
| `value` | string/null | no | Plantilla del contenido (ver semantica abajo) |
| `preset` | string/null | no | Slug del preset TextMuy (lo usa el selector del grupo y RenderCore) |
| `config` | string/null | no | Configuracion del modulo activo, opaca para el plugin (hoy TextMuy); puede contener `[campoX]` |

## Semantica de `value` (plantilla)

- Es un string. `[campoX]` = referencia al valor del campo `X` (spec 004).
- Sin corchetes: es un valor literal (caso de la consola: "Juan Perez").
- Con corchetes: se sustituye cada `[campoX]`; si el valor resuelto es un array, sus elementos se
  aplican a cada instancia del grupo en orden (spec 004 FR-4.3).
- Escapado: `\[` representa un corchete literal (nunca se interpreta como referencia).
- `value` vacio o ausente = grupo sin personalizar (hueco intacto, salvo que `default` exija render).

## Semantica de `config`

String de configuracion del modulo activo. Hoy (TextMuy) se entrega como lista de asignaciones
`prop=valor` separadas por coma, y un `[campoX]` reemplaza (override) la asignacion nombrada en su
primera aparicion. El plugin lo trata como opaco: lo recibe, lo sustituye en `[campoX]` cuando
aplica y se lo pasa al modulo. Futuros modulos usan el mismo campo con su propia gramatica.

## Regla de participacion

Un grupo se procesa si `value` no esta vacio **o** si `default` exige generar contenido (`texto`,
`img`, modulo). Si ninguno aplica, el hueco queda como esta y el resumen del proceso lo informa.
No existe `activo` por grupo (el `activo` es del PDF).

## Envio desde la consola (formulario del grupo)

| Campo POST | Mapeo |
|------------|-------|
| `action` | `personalizador_pdf_guardar_texto` (nombre vigente mientras dure la transicion) |
| `archivo` | PDF seleccionado (`{nombre}.pdf`) |
| `id` | Grupo (color hex sin `#`) |
| `default` | `texto` (la consola solo edita contenido texto por ahora) |
| `texto` | Valor -> `value` |
| `preset` | Preset elegido en el selector (vacio = sin preset) |
| `ajax` | `1` para respuesta JSON (autoguardado); si falta, redirige |

## Criterios de aceptacion

- Guardar en el grupo `0000FF` con `texto=Juan` y `preset=neon-glow` deja
  `grupos[?id=0000FF] = {..., "default":"texto", "value":"Juan", "preset":"neon-glow"}`.
- Guardar con `texto` vacio y sin `preset` no deja personalizacion (JSON de error en modo AJAX, sin
  cambios en el archivo).
- `config` preexistente no se pierde al guardar texto desde la consola.