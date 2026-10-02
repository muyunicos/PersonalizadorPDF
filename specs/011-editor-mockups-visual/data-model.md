# Data Model: editor-mockups-visual

**Feature**: 011-editor-mockups-visual | **Date**: 2026-10-01

Amplia el contrato de `config.json:mockups[]` de forma **retrocompatible** (todos los campos nuevos
son opcionales). No hay entidades persistidas nuevas, ni rutas nuevas, ni tablas (constitution §IV).
Detalle normativo campo a campo: [contracts/mockup-capas.md](./contracts/mockup-capas.md).

## Resumen de cambios

| Cambio | Tipo | Compatibilidad |
|---|---|---|
| `capas[].ref` con namespace `{ambito}:{valor}` | ampliacion + lectura tolerante | `ref` plano (sin `:`) se lee como `pdf:{ref}` |
| `capas[].filtros`: + `opacidad`, `desenfoque`, `tono` (y `gama` pasa a aplicarse) | ampliacion | ausente = neutro; `gama` ya se aceptaba y solo faltaba aplicar |
| `capas[].modo` (modo de fusion) | campo nuevo | ausente = `normal` |
| `capas[].nombre`, `oculta`, `bloqueada` | campos nuevos | ausentes = nombre derivado del ref, visible, editable |
| `mockups[].orden` | campo nuevo (derivado del indice) | el indice del array **es** el orden; no se persiste campo |

## Mockup

Persiste en `uploads/pmu/pdfs/{nombre}/config.json:mockups[]`. **Sin cambios** en su forma.

| Campo | Tipo | Regla | Origen |
|---|---|---|---|
| `id` | string | `[a-z0-9_-]+` (`nombre_seguro`), unico por PDF | vigente |
| `titulo` | string | etiqueta de la vista, max 200; vacio permitido | vigente |
| `creado` | string | ISO 8601 UTC, max 32 | vigente |
| `capas` | array | **orden = z-order** (indice 0 = mas al fondo); puede estar vacio (mockup en creacion) | vigente + FR (editor debe poder crear y guardar vacio) |

**Relaciones**: un Mockup pertenece a un PDF (`{nombre}`) y contiene N Capas. La galeria del editor
presenta los mockups de un PDF; la ficha los concatena si el producto tiene varios PDFs (vigente).

## Capa

Tipo: `img` (foto) | `placeholder` (hueco del PDF). Vive en `Mockup.capas[]`.

| Campo | Tipo | Regla | Cambio |
|---|---|---|---|
| `tipo` | enum | `img` \| `placeholder`; otro valor se descarta | vigente |
| `ref` | string | `{ambito}:{valor}`, max 128. `ambito` = `pdf` (nombre de archivo en `pdfs/{nombre}/mockups/`) o `img` (id numerico del catalogo `img.json`). Sin `:` = `pdf:` (tolerado) | **ampliado** |
| `x`, `y` | int | posicion del borde superior izquierdo en el lienzo logico 300x300 | vigente |
| `w`, `h` | int | `>= 1`; tamano de la caja de la capa | vigente |
| `rot` | float | grados, -360..360 | vigente |
| `sesgo` | float | -1..1 | vigente |
| `filtros` | object | ver tabla de ajustes; clave ausente = neutro | **ampliado** |
| `modo` | string | `normal` \| `multiply` (extensible); default `normal` | **nuevo** |
| `nombre` | string | etiqueta legible de la capa, max 60; default = derivado del `ref` | **nuevo** |
| `oculta` | bool | no se dibuja en la composicion; conserva geometria | **nuevo** |
| `bloqueada` | bool | no seleccionable ni arrastrable en el lienzo (sigue ordenable por lista) | **nuevo** |

### Ajustes (`capas[].filtros`)

| Clave | Tipo | Rango | Default | Efecto en Canvas 2D |
|---|---|---|---|---|
| `brillo` | int | 0..200 (%) | 100 (ausente) | `brightness()` |
| `contraste` | int | 0..200 (%) | 100 (ausente) | `contrast()` |
| `saturacion` | int | 0..200 (%) | 100 (ausente) | `saturate()` |
| `gama` | int | 0..200 (%) | 100 (ausente) | `grayscale()` |
| `opacidad` | int | 0..100 (%) | 100 (ausente) | `globalAlpha` (**no** va en `ctx.filter`) |
| `desenfoque` | number | 0..20 (px) | 0 (ausente) | `blur()` |
| `tono` | float | -180..180 (grados) | 0 (ausente) | `hue-rotate()` |

Regla: un valor igual al default se **borra** al guardar (normalizacion, como hoy con `brillo: 100`).
Los ajustes **solo** afectan a la vista previa: el PNG del pool y el PDF final van limpios
(constitution §III; contrato 004 regla 1).

## Preview del grupo (estado de sesion, no persistido)

Existe solo en el navegador mientras se edita; no se guarda.

| Campo | Tipo | Regla |
|---|---|---|
| `id` | string | id de grupo hex 6 (clave) |
| `url` | string | `blob:` URL del PNG renderizado (propiedad del store) |
| `w`, `h` | int | tamano exacto del hueco en px (base 200 ppp) |
| `hash` | string | `sha1(texto\|preset\|settings\|w\|h)`: la cache valida si coincide |
| `ts` | string | ISO 8601 UTC de la generacion |

**Regla de ciclo de vida**: un cambio en tipo/estilo/codigo/campo produce un `hash` distinto -> la
entrada queda invalida; el siguiente "Probar" vuelve a renderizar. Al revocar una URL anterior se
libera la entrada. El editor **nunca** genera esta entrada por su cuenta (FR-017, D2).

## Estados del editor (sesion)

| Estado | Transicion | Efecto |
|---|---|---|
| `guardado` | al abrir con `config.json` leido, o tras un guardado OK | el boton de guardar queda inactivo salvo atajo |
| `sin_guardar` | cualquier mutacion confirmada (capa/mockup, incluida geometria arrastrada) | agenda autoguardado (debounce 1.5 s) y habilita el aviso de salir |
| `guardando` | durante el POST | boton deshabilitado; el lienzo sigue siendo editable |
| `error` | fallo de red o respuesta con `success != true` | vuelve a `sin_guardar` (no pierde contenido) y muestra causa |

## Invariantes

1. Guardar mockups **nunca** modifica `analisis.json` (contrato 004; FR-042).
2. El guardado del editor escribe **solo** `mockups` y `preview_omisible` de ese PDF; nunca `activo`,
   `productos`, `campos_ids`, `placeholders` ni `tienda` (`handle_mockups_guardar`).
3. `preview_omisible` sin mockups = `false` y control deshabilitado (regla vigente, `config_omisible`).
4. La geometria se guarda en el espacio logico 300x300, **independiente del zoom** del lienzo.
5. Una capa invalida (foto borrada, grupo inexistente, instancia fuera de rango) **se conserva** al
   guardar y se marca en el editor (FR-038); nunca se poda en silencio.
6. Ningun dato del admin sale de `uploads/pmu/`; el editor no escribe catalogos ni sprites (FR-045).
