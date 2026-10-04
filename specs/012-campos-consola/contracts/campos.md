# Contract: Campos (montaje en la ficha del comprador)

**Feature**: 012-campos-consola | **Version**: 2 (enmienda la v1 de la norma 2026-09-17)

> **Enmenda**: la v1 (004) definiia el catalogo y su montaje. Esta v2 cambia **quien** decide el
> tipo de salida (lo decide el placeholder, no el campo), separa **nombre de admin** de
> **titulo cliente**, y agrega el cargador de imagenes. El formato de datos nuevo esta en
> `data-model.md`; la UI del admin, en `contracts/campos-consola.md`.

Un campo es una pieza reutilizable que el sistema muestra al comprador. Publica el **valor dual**
(`valor` para el Motor, `cliente` para el comprador). Es **agnostico del PDF**: el admin decide a
donde va el `valor` (placeholder, settings, Validez).

## Los tres textos

| Dato | Para quien | Donde se ve |
|------|-----------|-------------|
| `nombre` | admin | pestana Campos, "3. Personalizacion -> Campos", buscadores |
| `descripcion` | admin | solo la pestana Campos |
| `titulo_cliente` | comprador | carrito, checkout, resumen, pedido |

**El titulo que ve el comprador en la ficha NO es un dato del campo**: es HTML que el admin
escribe en `campo.htm`. El sistema **ya no inyecta** ningun titulo por encima del campo (se
elimina `.pmu-campo-titulo`, `tienda.js:259-262`).

## Sin `tipo`

El campo **no tiene `tipo`**. La salida la define:
- el placeholder (`Placeholders -> Tipo`: texto / codigo / foto), y
- la plantilla con la que se creo el campo.

El enum viejo (`text|textarea|select|img|override`) y el campo `visible` **se eliminan**.

## Montaje (`assets/campo-montar.js`)

El montaje es **un modulo compartido** que consumen **la ficha y el preview del admin**, para que
lo que el admin prueba sea exactamente lo que ve el comprador (D2).

```js
PMUCampo.montar(raiz, campos, inicial) -> { valorPorId: {id: {valor, cliente}} }
```

Por cada campo monta:
```html
<div class="pmu-campo pmu-campo-{id}" data-campo="{id}">
  <style>{campo.css}</style>       <!-- opcional -->
  {campo.htm}
</div>
```

**Reglas de salida** (en este orden):
1. Si el campo tiene `campo.js`: se ejecuta con `function(ctx, root)` (sandbox de `validar_script_campo()`);
   su `ctx.set(id, {valor, cliente})` manda. Un error de ejecucion marca el campo `{valor:null,
   cliente:''}` sin romper la pagina.
2. Sin `js`: se leen los `[data-rol]` del HTML:
   - `data-rol="valor"` -> `valor` (su `value` si es input, su `textContent` si no).
   - `data-rol="cliente"` -> `cliente` (su `textContent`).
3. Sin ningun `data-rol`: primer `input/textarea/select` (compatibilidad con campos v1 migrados).
4. Si hay `valor` pero **no** hay `cliente` en ninguno de los pasos anteriores: **`cliente` queda
   vacio**. El sistema **no traduce nada por si mismo** (D21): no hay tabla ni `traducir()`. El
   comprador veria una linea vacia en el carrito, y el admin lo resuelve escribiendo la regla en su
   `global.js` o en el `campo.js` del campo.

**Campos protegidos**: los que tienen `protegido: true` **no se montan en la ficha** (nunca viajan
al HTML publico). Son utilissimos para valores por defecto del admin o pruebas internas.

**Campos invisibles**: un campo cuyo HTML no muestra nada al comprador sigue publicando su
## Cargador de imagenes (`assets/cargador-pmu.js`)

Un campo con `cargador` muestra botones que abren el `CargadorPMU`, uno por **ranura**:

| Prop | Valor | Significado |
|---|---|---|
| `w`, `h` | int >= 1 | tamano final en px del recorte |
| `forma` | `circle` \| `square` \| `rect` \| `fit` | recorte circular, cuadrado, rectangulo o encajar |
| `min`, `max` | int >= 1 | cuantas imagenes admite esa ranura |

Flujo (FR-030…FR-035, D14, D16):
1. El comprador toca el boton -> se abre el modal de `SelectorPMU` (canvas `w x h`, zoom,
   `crop`/`fit`).
2. Acepta **arrastrando** el archivo o con clic.
3. Al confirmar el recorte, el `CargadorPMU` sube el blob **WebP** (formato del sistema; el Motor lo
   decodifica por GD) al item del comprador (`tmp/sesion-{sid}/{item_key}/subidas/{id}.webp`, con
   fila en `manifest.subidas[]`).
4. El campo publica `valor = [id1, id2, ...]` (o `valor = id1` si `max = 1`).
5. Si `max > 1`, el campo es `array` y publica una lista (un valor por instancia del placeholder).

**`min` es la validacion real (D16)**: "Aceptar" permanece **deshabilitado** hasta que la ranura
tenga al menos `min` imagenes. El comprador no puede dejar el item a medias.

El componente **no envia nada al Motor**: solo al item del comprador, antes de la vista previa.

## Placeholder tipo imagen

Un placeholder con tipo `imagen` y `value = [campoN]` (D11):
1. Toma `valor` del campo N (una lista de ids).
2. Resuelve cada id contra `manifest.subidas[]` (si un id no existe -> error; **nunca** una ruta
   arbitraria).
3. **El placeholder NO exige N = cont y el sistema NUNCA bloquea la compra (D17/D18/D19)**, igual que
   con el texto:
   - con `repetir`: el `idx` **cicla** modulo el largo del array (4 fotos en 8 instancias ->
     1,2,3,4,1,2,3,4; 1 foto -> la misma en las 8);
   - sin `repetir`: las N fotos van a las primeras N instancias y **las sobrantes quedan vacias**
     (el hueco conserva su transparencia). No hay aviso ni error: es un informe normal.
4. En el navegador, cada id se rasteriza a un PNG del tamano exacto del hueco y sube al pool del
   grupo, para que la vista previa y el PDF usen **la misma imagen**.
5. El Motor recibe `id => [ruta1, …, rutaN]` (una por instancia; retrocompatible con `id => ruta`).

## Valor dual (obligatorio, sin cambios)

| Salida | Uso |
|--------|-----|
| `valor` | lo consume el Motor (plantillas `[campoN]`) o el placeholder tipo imagen |
| `cliente` | el **resultado** que eligio el comprador ("sal, oregano, pimienta...") |
| `titulo_cliente` | la **etiqueta** que el admin le dio a esa personalizacion ("Seleccion") |

En el carrito, el pedido y el resumen, cada campo se pinta como **una linea**:

```
Producto: "Etiquetas para condimentos"     <- nombre del producto Woo (NO es un campo)
Seleccion: sal, oregano, pimienta...       <- titulo_cliente + ": " + cliente
Modelo: Rosas                             <- otro campo, misma regla
```

Regla (sin cambios): el sistema **jamas** muestra `valor` crudo al comprador ni procesa `cliente`.
**No** inventa traducciones: si `cliente` queda vacio, la linea sale vacia (D21).

## Arrays (sin cambios)

- `array = false`: el mismo `valor` se usa en todas las instancias del grupo.
- `array = true`: el Motor aplica `valor[i]` a la instancia `i`; si N != M se informa antes de
  generar (nunca un PDF a medias).

## Sandbox del `campo.js` (obligatorio, sin cambios)

- Empieza con `function`; prohibidos `document.getElementById` / `document.querySelector`,
  `DOMContentLoaded` e `id=""`.
- El unico acceso al DOM es via `root`; el unico canal de salida es `ctx.set(id,{valor,cliente})`.
- `css` no puede usar selectores globales ni `100vh`.
- El `script` corre **solo en el navegador**: PHP nunca evalua JS.

## Criterios de aceptacion

- Un mismo campo se usa en N PDFs sin duplicar su definicion.
- El comprador ve exactamente lo que el admin probo (mismo modulo de montaje).
- Un campo con cargador devuelve ids reales de la sesion del comprador y el Motor los coloca en los
  huecos correctos.
- El sistema jamas muestra `valor` crudo ni procesa `cliente`.
- El catalogo no se guarda dentro de la carpeta del plugin (Const. IV).

`valor` via `campo.js`. Sirven como helpers (ej.: un campo que lee otro y devuelve "hola " + valor).
