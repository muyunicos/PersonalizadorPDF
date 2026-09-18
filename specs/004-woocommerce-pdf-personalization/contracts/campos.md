# Contract: Campos (catalogo global reutilizable)

**Feature**: 004-woocommerce-pdf-personalization | **Version**: 1 (norma 2026-09-17)

Un campo es una pieza reutilizable que define como el cliente ingresa un dato y como se
normaliza para el sistema. Vive en `uploads/pmu/campos.json` (catalogo global, no por PDF).

## Esquema (`campos.json`)

```json
{
  "items": [
    {
      "id": 56,
      "titulo_cliente": "Condimentos",
      "tipo": "texto",
      "etiquetas": ["texto", "lista"],
      "texto_ayuda": "Escribi hasta 12 condimentos, uno por linea",
      "visible": true,
      "array": true,
      "contenido": "<div class=\"pmu-campo-56\"><textarea data-rol=\"entrada\" rows=\"12\"></textarea></div>",
      "css": ".pmu-campo-56 textarea{width:100%;resize:vertical}",
      "script": "function(ctx, root){ var t=root.querySelector('[data-rol=entrada]'); function emitir(){ var v=(t.value||'').split(/\\r?\\n/).filter(function(x){return x.trim()!=='';}); ctx.set(56, {valor:v, cliente:v.join(', ')}); } t.addEventListener('input', emitir); emitir(); return {valor:[], cliente:''}; }"
    }
  ]
}
```

**Sin miniaturas**: a diferencia de los catalogos del editor (`fonts/img/tm-presets`), el
catalogo de campos no lleva sprite `thumbs.webp` ni celdas; cada campo se reconoce por su
`id` numeral (auto, nunca reutilizado). Para campos de imagen, el tamaño final en px (y el
recorte/ajuste) se define por campo/PDF y lo gestiona `selector-pmu`.

## Campos por item

| Campo | Tipo | Regla |
|-------|------|-------|
| `id` | int | auto (hueco mas bajo o max+1); nunca se reutiliza |
| `titulo_cliente` | string | etiqueta visible; vacio = el campo no se pinta (pero su `script` evalua) |
| `tipo` | enum | `texto` \| `imagen` \| `override` |
| `etiquetas` | string[] | categorizacion para filtrar en el admin |
| `texto_ayuda` | string | ayuda breve bajo el campo |
| `visible` | bool | default `true`; `false` = campo derivado (calculado por otros) |
| `array` | bool | default `false`: `true` entrega array (un valor por instancia) |
| `contenido` | string | fragmento HTML con scope `.pmu-campo-{id}` + `data-rol` |
| `css` | string | CSS plano, siempre prefijado por `.pmu-campo-{id}` |
| `script` | string | `function(ctx, root)`; unico punto de escritura del campo |

## Reglas de sandbox (obligatorias)

- `contenido` es fragmento, nunca pagina: prohibidos `id` fijos, `document.getElementById`,
  `DOMContentLoaded` y variables globales.
- Todo acceso al DOM es via `root`; el unico canal de salida es
  `ctx.set(id, {valor, cliente})`.
- `css` no puede usar selectores globales ni `100vh`.
- El `script` se ejecuta solo en el navegador: PHP nunca evalua JS.

## Valor dual (obligatorio)

| Salida | Uso |
|--------|-----|
| `valor` | lo consume el Motor (via plantillas `[campoN]` de `placeholders[id]`) |
| `cliente` | etiqueta legible que se muestra en ficha, carrito y pedido |

Regla: el sistema jamas muestra `valor` crudo al cliente ni procesa `cliente`.

## Arrays

- `array=false`: el mismo `valor` se usa en todas las instancias del grupo.
- `array=true`: el Motor aplica `valor[i]` a la instancia `i` (loop); si `N != M` se informa
  antes de generar (nunca PDF a medias).

## Errores (formato `motor:<op>:<causa>`)

| Causa | Cuando |
|-------|--------|
| `motor:campos:item:ausente` | se referencia un id que no existe en el catalogo |
| `motor:campos:id:no_reutilizable` | intento de crear con un id ya usado |
| `motor:campos:catalogo:invalido` | `campos.json` ilegible (aviso + catalogo vacio) |
| `motor:campos:script:invalido` | `script` no compila (rechazo al guardar) |

## Criterios de aceptacion

- Un mismo campo puede usarse en N PDFs sin duplicar su definicion.
- Registrar el catalogo es atomico y tolerante a lectura (mismo criterio que los catalogos
  del editor).
- El catalogo no se guarda dentro de la carpeta del plugin (Const. IV).