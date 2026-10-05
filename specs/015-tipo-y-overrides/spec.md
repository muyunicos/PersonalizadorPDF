# 015 — Tipo del campo y overrides que funcionan

> Estado: **implementada (2026-10-05)**. Commits `5f7c012` (tipo y limpieza) +
> `7187328` (overrides de punta a punta) + cierre T020-T022. Cierra el diseño
> acordado con el usuario el 2026-10-05. Enmienda la FR-5.2 de la 004, que hasta
> hoy estaba escrita como si funcionara y no era cierto.

## Por que esta spec

En la 012 se creo el concepto de campo reutilizable, y en la 013 se mejoro la
consola. Al usarlo aparecieron dos cosas: la columna **Categorias** nunca se
llego a usar, y la de **Plantilla** mentia (describe de donde salio el campo, no
que es). En su lugar hace falta un **Tipo**. Y al mirarlo de cerca aparecio un
problema mas grave: **la funcion de overrides del placeholder nunca funciono**.

## Hallazgos (verificados en el codigo)

Cada uno con archivo y linea, para poder re-chequearlo.

| # | Hallazgo | Evidencia |
|---|---|---|
| H1 | Los overrides **nunca llegan al render**. `renderBatch` se arma sin `settings` | `assets/tienda.js:831-833` |
| H2 | `resolverPlantilla` solo se aplica a `value`, no a `settings` | `assets/tienda.js:27-38, 77, 87` |
| H3 | TextMUy **ya esta listo**: `renderBatch` acepta `overrides` por item y hace `mergeDeep` sobre el preset | `modules/textmuy/js/api.js:296, 271` |
| H4 | El plugin guarda `settings` como **string**; TextMUy exige **objeto** | `modules/textmuy/js/api.js:43-44` |
| H5 | El navegador es el **unico** que renderiza texto: el Motor solo pega PNGs. La vista previa **es** el PDF final | `engine/Motor.php:29, 183` |
| H6 | `repeat` no existe. La clave real es `repetir` (bool) + `cont` (int) | `assets/tienda.js:64-96` |

**Consecuencia de H3+H5**: esta spec **no toca `modules/textmuy/`**. Sin bump de
`?v=RCn`, sin commit en su repo, sin segundo deploy.

**Consecuencia de H1+H2+H4**: "Overrides del estilo" esta anunciado en la UI
(`admin/pdfs.php`: *"Overrides del estilo; admite [campoN]"*) y **no hace nada**.
El texto literal nunca se sustituye, nunca se envia, y el formato tampoco seria
el correcto.

## Decisiones cerradas

| # | Decision |
|---|---|
| D1 | `repeat` = `repetir` + `cont`. **No hay clave nueva.** |
| D2 | `settings` es **solo una lista de referencias**: `"[campo73] [campo33]"`. Sin texto literal. |
| D3 | Las referencias se resuelven **en orden**, se hace `JSON.parse` de cada `valor` y se **fusionan con `mergeDeep`**; el ultimo pisa al anterior. |
| D4 | `valor` es **siempre string**. Un campo `opciones` publica `JSON.stringify(overrides)`. |
| D5 | Un JSON invalido **no rompe el PDF**: se avisa y se usa el estilo del preset. |
| D6 | El **preview es el PDF final** (H5): no hay un segundo render que sincronizar. |
| D7 | `placeholders[id].campos[]` **no existe**: no hace falta. La referencia ya esta en el propio `value`/`settings`. |
| D8 | Sin cambios en `modules/textmuy/` (H3). |
| D9 | **Categorias fuera** completo: datos, `meta`, CRUD, columna, chips, buscador, modal, tests. |
| D10 | La estrella de Plantilla **fuera** (con su endpoint). Las 3 plantillas base pasan a ser los 3 **tipos**, y rellenan el formulario al elegirlos. |
| D11 | `tipo` **declara la intencion y valida el cableado**. No enruta: enruta el cableado (`value` -> texto/fotos segun el `tipo` del placeholder; `settings` -> overrides). |

### Sobre D11 (correccion)

Durante el diseño se dijo que "Tipo = a que parte del render va el `valor`".
**No es exacto** y conviene no dejarlo escrito asi:

- **El cableado enruta.** `[campoN]` en `value` produce texto o fotos segun el
  `tipo` del *placeholder* (un hecho fisico del PDF). `[campoN]` en `settings`
  produce overrides.
- **El tipo del campo declara** para que sirve, y sirve para **avisar** cuando
  el cableado no coincide: *"el campo 73 es tipo `opciones` pero lo colgaste en
  `value`; va en `settings`"*.

Ese aviso es justamente lo que hoy no existe, y es la diferencia entre un error
de 20 minutos y un PDF con `[object Object]`.

## Modelo

El `valor` de cada tipo, ya sea siempre string (D4):

| Tipo | `valor` (string) | Ejemplo | Va a |
|---|---|---|---|
| `texto` | texto, o JSON si son N valores | `"¡Feliz cumpleaños!"` | `items[].text` |
| `imagen` | JSON de ids que asigno el servidor | `'["3f54...","7fba..."]'` | fotos del grupo |
| `opciones` | JSON del objeto de overrides | `'{"shadow":{"outer":{...}}}'` | `items[].overrides` |

Y el placeholder, sin cambios:

```json
"FF00AA": { "tipo": "texto", "value": "¡Feliz cumpleaños [campo3]!",
            "preset": "neon-glow", "settings": "[campo73] [campo33]",
            "repetir": false }
"FF0000": { "tipo": "imagen", "value": "[campo7]", "preset": "", "settings": "" }
```

`repetir` (H6): si el `valor` del campo trae N valores, un valor por instancia; si
no, el mismo en todas.

## Requisitos funcionales

- **FR-001** `settings` DEBE contener **solo** referencias `[campoN]`. Texto
  literal se descarta con aviso (D2).
- **FR-002** Cada referencia DEBE resolverse con el `valor` del campo, parsearse
  con `JSON.parse` y **fusionarse en orden**, el ultimo sobre el anterior (D3).
- **FR-003** El objeto fusionado DEBE pasar a `renderBatch` como `overrides`
  (D3/D8). `mergeDeep` del modulo lo aplica sobre el preset.
- **FR-004** Un `valor` que no sea JSON valido NO DEBE romper el render: se
  descarta **solo ese** override, se avisa y el resto se aplica (D5).
- **FR-005** El hash del pool (`valor|preset|settings|WxH`) DEBE incluir los
  overrides resueltos. Sin esto, dos compradores con estilos distintos chocan en
  la cache del pool y el segundo recibe el PDF del primero (H1).
- **FR-006** `valor` DEBE ser string en todos los tipos. El sistema NO DEBE hacer
  `String()` sobre un objeto: un `opciones` mal cableado DEBE avisar, no escribir
  `[object Object]` en el PDF (D4/D11).
- **FR-007** El campo DEBE exponer un **tipo** (`texto|imagen|opciones`) que se
  elige **al crear** (como hoy la plantilla) y se muestra en la consola y en el
  PDF (D10).
- **FR-008** Si el tipo del campo y el cableado no coinciden, la consola DEBE
  avisar antes de procesar (D11).
- **FR-009** Categorias DEBE eliminarse por completo del formato y de la UI (D9).
- **FR-010** La plantilla base del tipo `opciones` DEBE existir y DEBE incluir el
  `JSON.stringify` del patron, para que el admin no tenga que descubrirlo.

## Fuera de alcance

- El menu `...` de Acciones (aplazado en la 013, sigue asi).
- La columna `Uso` enlazable a los PDFs.
- Que la fila nueva quede a la vista tras crearla.
- Multiples campos que compitan por un mismo hueco: **no existe**, y no se
  agrega (D7). `[campo73]` y `[campo33]` se fusionan; no se elige uno.

## Verificacion prevista

- Arnes: fase nueva `overrides` (fusion en orden, JSON invalido degrada, hash
  distinto por override) + las de A/B adaptadas al formato v3.
- Puertas: `campos_migracion.php` (v2 -> v3), `campos-contrato.test.js`.
- Lab con navegador real: la vista previa de un campo `opciones` **se ve distinto**
  segun la opcion elegida, y el PDF descargado trae lo mismo que la vista previa
  (esa equivalencia es el requisito de fondo, D6).