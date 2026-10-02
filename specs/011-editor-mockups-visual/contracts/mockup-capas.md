# Contract: Capas de mockup y render compartido

**Feature**: 011-editor-mockups-visual | **Version**: 2 (enmienda `004-woocommerce-pdf-personalization/contracts/mockups.md`)

Contrato de la composicion de un mockup (`config.json:mockups[]`) y del **nucleo de render
compartido** que la usan el editor del admin y la ficha del cliente. Especificacion: [../spec.md](../spec.md).

## 1. Composicion persistida

```json
{
  "id": "fiesta",
  "titulo": "Fiesta",
  "creado": "2026-10-01T14:00:00Z",
  "capas": [
    {"tipo": "img", "ref": "pdf:fondo-fiesta", "x": 0, "y": 0, "w": 300, "h": 300,
     "rot": 0, "sesgo": 0, "nombre": "Fondo", "modo": "normal",
     "filtros": {"brillo": 95, "contraste": 110}},
    {"tipo": "placeholder", "ref": "0000FF#1", "x": 96, "y": 60, "w": 110, "h": 180,
     "rot": -3, "sesgo": 0.05, "oculta": false, "modo": "normal",
     "filtros": {"opacidad": 90}}
  ]
}
```

### 1.1 Campos de capa

| Campo | Regla | Cambio vs 004 |
|---|---|---|
| `tipo` | `img` \| `placeholder`; otro valor se descarta al guardar | = |
| `ref` | `{ambito}:{valor}`; `pdf:{archivo}` (foto del PDF) o `img:{id}` (id numerico del catalogo). **Sin `:` se lee como `pdf:`** | **ampliado** |
| `x`,`y`,`w`,`h` | int; `w,h >= 1`; espacio logico 300x300 | = |
| `rot` | float -360..360 (grados) | = |
| `sesgo` | float -1..1 | = |
| `filtros` | object; claves de §1.2; ausente = neutro | **ampliado** |
| `modo` | `normal` \| `multiply` (extensible); default `normal` | **nuevo** |
| `nombre` | string <= 60; default = derivado del `ref` | **nuevo** |
| `oculta` | bool; default `false` | **nuevo** |
| `bloqueada` | bool; default `false` | **nuevo** |

### 1.2 Ajustes (`filtros`)

| Clave | Rango | Default | Mecanismo |
|---|---|---|---|
| `brillo`, `contraste`, `saturacion` | 0..200 (%) | 100 | `ctx.filter` |
| `gama` | 0..200 (%) | 100 | `ctx.filter: grayscale()` |
| `opacidad` | 0..100 (%) | 100 | `ctx.globalAlpha` |
| `desenfoque` | 0..20 (px) | 0 | `ctx.filter: blur()` |
| `tono` | -180..180 (grados) | 0 | `ctx.filter: hue-rotate()` |

Valor = default -> se borra al guardar. **`gama` hoy se acepta y no se aplica**: este contrato
obliga a aplicarla (bug corregido: `class-pmu-uploads.php:729` lo acepta, `filtroCss()` lo ignora).

### 1.3 Enmienda explicita al contrato 004

El contrato 004 declaraba `capas[].ref` = "id del catalogo `img/` o `mockups/{archivo}`", formato que
el validador hacia **imposible** (rechazaba cualquier `ref` con `/`, `class-pmu-uploads.php:723`).
Este contrato lo reemplaza por el namespace `pdf:` / `img:` y aclara la misma regla: el recurso del
catalogo se referencia por **id numerico**, no por nombre de archivo (el nombre puede cambiar en una
edicion del catalogo; el id no). `ref` plano se tolera como `pdf:`.

## 2. Nucleo de render compartido

`assets/mockup-render.js` expone `PMUMockup`:

| Miembro | Contrato |
|---|---|
| `componer(ctx, capas, resolver, opciones)` | Dibuja `capas` en orden. `resolver(ref)` devuelve `{url, w, h}` o `null`. **Es la unica funcion de render del sistema** (criterio 004). |
| `contener(destino, recurso)` | Encaja el recurso en la caja **sin deformar** (regla `contain` vigente) y devuelve el rectangulo usado + si hubo discrepancia de proporcion. |
| `filtroCss(filtros, modo)` | Traduce ajustes a `ctx.filter` + `globalAlpha` + `globalCompositeOperation`. |
| `esValida(capa, contexto)` | Dice si la capa resuelve (foto en `fotos`/catalogo, grupo existente, indice dentro de `cont`). |

Reglas:

1. **Orden**: indice 0 al fondo. Las capas `oculta` se saltan (conservan geometria).
2. **Proporcion**: si la proporcion de la caja difiere de la del recurso, `contener()` encaja
   (**nunca estira**) y devuelve informacion de discrepancia para que el editor avise (FR-023/024).
   El cliente no avisa, solo encaja.
3. **Transformacion**: rotacion y sesgo se aplican alrededor del centro de la caja; cada capa se
   aisla con `save`/`restore` (mismo criterio que `Overlay` en el motor, AGENTS §4.4).
4. **Degradacion**: si `resolver` devuelve `null`, la capa se dibuja como caja neutra con su
   `ref`; la composicion nunca falla (mismo criterio que la ficha actual).
5. **Ajustes**: solo afectan a la composicion; **nunca** al PNG del pool ni al PDF (contrato 004
   regla 1; constitution §III).
6. **Salida**: siempre 300x300 px. El zoom del editor es una lupa; el backing store escala, la
   geometria no.

## 3. Preview de grupo (store cliente)

`PersonalizadorPDF.previews[grupoId] = {url, w, h, hash, ts}`; evento `pmu:preview-listo` con
`{id, url, w, h}`. Detalle en [../data-model.md](../data-model.md). Regla dura: el editor **no**
renderiza; solo consume lo que produce `.ec-probar` (D2, FR-017/021).

## 4. Superficie del editor (contrato UI)

| Elemento | Contrato |
|---|---|
| Lienzo | ampliable (100/150/200/300 %), resolucion logica 300x300, fondo damero, marco 300x300 visible |
| Seleccion | tiradores (8) + tirador de rotacion + guias de imanes + etiqueta con medidas y nombre |
| Lista de capas | miniaturas, reordenable, con acciones (renombrar, duplicar, ocultar, bloquear, eliminar) y marca de invalida |
| Recursos | galeria de fotos del PDF (arrastrar archivo = sube y anade), catalogo `img/` con busqueda y categorias, lista de grupos con id/tamano/instancias |
| Galeria de mockups | miniaturas en vivo; crear, duplicar, renombrar, eliminar, reordenar |
| Teclado | flechas mueven (1 px; 10 px con modificador), Supr elimina, Ctrl+Z / Ctrl+Shift+Z deshace/rehace, Ctrl+D duplica, Ctrl+S guarda, `[`/`]` orden, Esc deselecciona |
| Estado | "Sin guardar" / "Guardando" / "Guardado" siempre visible |

Regla: **ningun flujo principal** usa `window.prompt`/`alert` (FR-042). `confirm` solo para bajas
irreversibles, con el conteo de capas afectadas (FR-016).

## 5. Puntos de aplicacion (checklist de FR-025)

Un ajuste nuevo debe estar en los **dos** lados, o el cliente ve distinto a lo que compone el admin:

- [ ] `PMU_Uploads::config_mockups` (allowlist + clamp) **y** `handle_mockups_guardar` (saneo)
- [ ] `PMUMockup.filtroCss` (aplicacion unica, compartida por editor y ficha)

## 6. Criterios de verificacion

- Guardar mockups nunca modifica `analisis.json`; solo escribe `mockups` + `preview_omisible`.
- Un mockup existente sin campos nuevos se abre y se compone **identico** (SC-011).
- Editor y ficha producen la misma composicion (posicion, tamano, orden, ajustes) (SC-003).
- El hueco se encaja sin deformar; la proporcion distinta genera aviso en el editor (FR-023/024).
- `gama` guardado se aplica al componer (bug corregido).
- El editor no escribe en `img.json` ni en ningun sprite (unico escritor: `assets/miniaturas.js`).
- `ref` plano (mockup previo) se sigue composing igual (compatibilidad).

