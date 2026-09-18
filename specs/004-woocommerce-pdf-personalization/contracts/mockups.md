# Contract: Mockups (plantillas de vista previa)

**Feature**: 004-woocommerce-pdf-personalization | **Version**: 1 (norma 2026-09-17)

Un mockup es la "fotografia" simulada del producto en uso (300x300 px): NO muestra el PDF
ni el placeholder aislado, muestra el producto final en escena (foto de fondo + capas +
filtros) con la personalizacion del cliente superpuesta. Es lo que el cliente aprueba.

## Almacenamiento

- Composicion: `pdfs/{nombre}/config.json:mockups[]` (editable, versionable con el producto).
- Fotos del admin: `pdfs/{nombre}/mockups/{archivo}` (subida directa, datos de usuario).
- Fotos reutilizables: catalogo `uploads/pmu/img/` (id del catalogo `img.json`).
- Sin miniaturas guardadas: la galeria del admin renderiza al vuelo.
- N mockups por PDF y N capas por mockup SIN limite (los administra el admin).

## Esquema

```json
{
  "id": "fiesta",
  "titulo": "Fiesta",
  "creado": "2026-09-17T14:00:00Z",
  "capas": [
    {"tipo": "img", "ref": "fondo-fiesta", "x": 0, "y": 0, "w": 300, "h": 300,
     "rot": 0, "sesgo": 0, "filtros": {"brillo": 95, "contraste": 110}},
    {"tipo": "placeholder", "ref": "0000FF#0", "x": 96, "y": 60, "w": 110, "h": 180,
     "rot": -3, "sesgo": 0.05, "filtros": {}},
    {"tipo": "img", "ref": "marco-madera", "x": 90, "y": 54, "w": 122, "h": 192,
     "rot": -3, "sesgo": 0.05, "filtros": {}}
  ]
}
```

| Campo | Tipo | Regla |
|-------|------|-------|
| `id` | string | `[a-z0-9_-]+`, unico por PDF |
| `titulo` | string | etiqueta de la vista (opcional) |
| `capas[]` | array | orden = z-order (indice 0 = mas al fondo); >= 1 |
| `capas[].tipo` | enum | `img` (foto/marco) o `placeholder` (hueco personalizado) |
| `capas[].ref` | string | `img`: id del catalogo `img/` o `mockups/{archivo}`; `placeholder`: `{grupo_id}` o `{grupo_id}#{indice}` |
| `capas[].x/y` | int | 0..300 (canvas fijo) |
| `capas[].w/h` | int | > 0; el placeholder se contiene sin deformar |
| `capas[].rot` | number | grados, -360..360 |
| `capas[].sesgo` | number | -1..1 (skew/perspectiva) |
| `capas[].filtros` | object | brillo/gama/contraste/saturacion 0..200 % |

## Reglas

1. **Filtros solo en el mockup**: el PNG del pool y el PDF final van limpios (el Motor no
   aplica filtros).
2. **Capas en cualquier orden**: el admin puede poner el placeholder detras de un marco con
   agujero (uso principal del sistema de capas).
3. **Subset de placeholders**: el admin elige que grupos/instancias incluir; puede repetir
   el mismo `id` N veces (util para campos array). El mockup refleja las decisiones de
   diseño del PDF: no define loops ni comportamiento (eso vive en `placeholders[id]`).
4. **Fotografia final, sin marcas de editor**: si un valor viene vacio o el array es mas
   corto, el hueco queda limpio (nunca marcos punteados ni avisos superpuestos).
5. **Render**: siempre al vuelo (cliente, motor TextMuy/Canvas-WebGL); nunca PNG fijo de
   plantilla.
6. **`preview_omisible`** (bool, default `false`): solo se ofrece cuando ya existe al menos
   un mockup. Con `false`, sin vistas listas no hay `add-to-cart`; con `true` el PDF se
   genera al pagar/en Descargas.

## Flujo cliente (ficha)

1. Estado inicial: campos + boton "Vista previa" + leyenda "verifica tu personalizacion
   antes de continuar con la compra".
2. Al pulsar: se oculta el boton y aparece la galeria (espacio 300x300 fijo, sin CLS;
   flechas si hay >1 mockup; si el producto tiene N PDFs, se concatenan los mockups).
3. Render en paralelo: las vistas pendientes muestran "Generando vista previa" (imagen en
   blanco + texto centrado, navegable) y se reemplazan al completarse.
4. Cuando todas las vistas + el pool estan en la sesion, el boton de carrito se habilita.
5. NO hay boton "aprobar": el visto bueno ES agregar al carrito.
6. Si el cliente edita un campo: se oculta la galeria y vuelve el boton; al re-pulsar se
   regeneran solo los campos editados (comparacion por hash).
7. Si una vista falla: se oculta esa vista y quedan las demas. Si no queda ninguna: galeria
   oculta + mensaje "no hay vista previa" + compra habilitada (`sin_vista`).

## Criterios de aceptacion

- Guardar mockups nunca modifica `analisis.json`.
- La galeria del admin y la del cliente usan el mismo render (una sola funcion).
- El mockup congelado al agregar es 300x300 webp, uno por vista generada.
- En Descargas NO se muestra mockup (solo el PDF final).