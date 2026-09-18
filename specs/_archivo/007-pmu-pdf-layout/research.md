# Research: Layout PMU de PDFs y contenido por grupo en metadata

**Feature**: 007-pmu-pdf-layout | **Date**: 2026-09-15

Todas las incognitas del Technical Context quedan resueltas aqui. Cada decision indica
motivo y alternativas evaluadas; no queda ningun `NEEDS CLARIFICATION`.

## D1. Esquema del grupo: id = color hex, campos planos de personalizacion

**Decision**: Cada grupo de `metadata.json.grupos[]` usa su **color hex sin `#`** como `id`
(la agrupacion ya es por RGB exacto en `Detector::agruparPorColor`), y la personalizacion son
**campos planos** en la propia entrada, sin bloque `contenido` anidado:

```json
{
  "id": "0000FF",
  "w": 463, "h": 463, "cont": 8, "pgs": [0],
  "default": "texto",
  "value": "Hola [campo3]",
  "preset": "neon-glow",
  "config": "settings.font.src='Montserrat',[campo1]"
}
```

Desaparecen `letra`, `color`, `color_rgb`, `ancho_px/alto_px` (-> `w`/`h` en px),
`ancho_pt/alto_pt` (solo display; se eliminan), `num_instancias/paginas` (-> `cont`/`pgs`)
y el `activo` por grupo (-> `activo` del PDF). `cont` se conserva porque participa en
`Motor::validarDataset` y en el contador del resumen; `pgs` es informativo de la UI.

Semantica:
- `default`: `null` (hueco intacto) o `texto` / `img` / slug de modulo (strings, no enteros).
- `value`: plantilla string; `[campoX]` = referencia a campo (spec 004); sin corchetes es literal;
  `\[` escapa corchete literal; array resuelto -> loop por instancias (FR-4.3).
- `preset`: slug del preset TextMuy (clave propia: la usa el selector del grupo y RenderCore como
  parametro separado `{id, text, preset, width, height}`).
- `config`: string opaco de configuracion del modulo activo (hoy TextMuy), con `[campoX]` para
  overrides en su primera aparicion.
- Requisito 1:1 con spec 004: `value`/`config` absorben `field_ids`/`transform_script`/`overrides`
  (el flujo de pedidos consume los mismos campos sin traduccion).
- Participacion: se procesa si `value` no esta vacio o `default` exige generar contenido; si no,
  el hueco queda como esta (resumen lo informa).

**Rationale**: Un solo concepto de grupo (su color) como clave natural evita el par
`letra`+`color` redundante; los campos planos eliminan un nivel de anidamiento sin perder
expresividad; `id` = hex sin `#` es seguro para archivos y URLs. El momento es adecuado porque
la feature 007 aun no se implementa: no hay datos que migrar a esta clave y el oraculo de
paridad se ajusta en la misma implementacion.

**Alternatives considered**:
- Mantener `letra` (a, b, c...) como clave operativa y `color` como dato: dos claves para el mismo
  concepto y mas campos (descartado por decision del administrador: id = color hex sin `#`).
- Bloque `contenido` anidado con `tipo` discriminante (`texto`/`campo`/`codigo`): mas verbose;
  `value` + `default` + `preset` + `config` cubren lo mismo de forma plana (superado en esta revision).
- `preset` dentro de `config`: obligaria a parsear un string para alimentar el selector y RenderCore
  (descartado: `preset` es clave propia).
- `activo` por grupo: contradice spec 004 (`status` del producto) y agrega estado innecesario
  (descartado: participacion inferida de `value`/`default`).

## D2. `metadata.json` como unica fuente del contenido por grupo

**Decision**: Se elimina `textos.json`. La personalizacion de cada grupo (campos planos
`default`/`value`/`preset`/`config`) vive en `metadata.json`, que se reescribe de forma atomica al
guardar un grupo.

**Rationale**: Un solo archivo por PDF para todo lo que define el producto; el dataset ya
se lee en cada render de la consola, asi que no se agrega I/O.

**Alternatives considered**: mantener `textos.json` (estado duplicado, ya genero divergencias);
un `content.json` separado (mismo problema con otro nombre).

## D3. Placeholders: sin almacenamiento, marco en pantalla y descarga al vuelo

**Decision**: No se escribe ningun PNG de placeholder. La consola dibuja un marco (`div`)
con el tamano real del grupo y la descarga genera el PNG en el momento y lo sirve por
stream, sin tocar disco. `engine/PngWriter.php` **ya expone** `bytes($w, $h)` (lineas 26-44,
PNG RGBA 8-bit transparente con `gzcompress`, sin GD), asi que no hace falta codigo nuevo: el
handler llama `PngWriter::bytes($w, $h)` y emite los bytes.

**Rationale**: Hoy subir un PDF escribia un PNG por grupo (`circulo6cm`: 8 archivos) que
solo se usaba para el preview y la descarga; el tamano ya esta en `metadata.json`.
Elimina estado, permisos y limpieza. La generacion es la misma que ya corre sin GD.

**Alternatives considered**: seguir almacenando (estado redundante y borrado extra);
generar en el navegador con canvas (el PNG debe ser exacto al hueco y el servidor ya sabe hacerlo);
depender de GD (el proyecto exige PHP puro sin dependencias nativas obligatorias).

## D4. Muestras, carrito y pedidos: `tmp/muestras/`, `tmp/cart/`, `tmp/orders/`, `orders/`

**Decision**: Cuatro destinos con roles distintos (ver spec.md US5 y contratos `rutas-pmu.md`):
1. `uploads/pmu/tmp/muestras/{pdf}/` — muestras del panel admin (`{id}.{ext}` +
   `{nombre}_procesado.pdf`); cada Procesar **sobrescribe** (idempotente, pedido tuyo).
2. `uploads/pmu/tmp/cart/{linea}/{pdf}/` + `manifest.json` — borrador de personalizacion por
   sesion, adoptado como linea del carrito; se reescribe al editar; una linea = un directorio
   (el mismo PDF dos veces = dos lineas). Al eliminar la linea se borra su directorio.
3. `uploads/pmu/tmp/orders/{order_id}/{pdf}/` — staging de trabajo al crearse el pedido.
4. `uploads/pmu/orders/{order_id}/{pdf}/` — resultado final: aplicados + `{pdf}_procesado.pdf` +
   resumen; se llega por **rename atomico** desde el staging SOLO al confirmarse el pago
   (el cableado a hooks Woo vive en spec 004).

**Rationale**: Es la Constitucion IV con subambitos de `tmp/` (`muestras` idempotentes del panel,
`cart`/`orders` transitorios con TTL) y `orders/` solo por linea confirmada. Responde a tus tres
casos: re-editar reescribe el mismo borrador; personalizar dos veces el mismo producto crea dos
lineas; eliminar una linea borra solo la suya. Separar borrador de linea permite ademas fusionar
por `pmu_hash` identico (cantidad + 1, FR-018) sin duplicar directorios ni perder trazabilidad.

**Alternatives considered**: `tmp/{pdf}/` unico para muestras y cliente (mezcla admin con
comprador y no escala a dos personalizaciones del mismo PDF — era el esquema anterior de la spec,
reemplazado); `orders/{order_id}/` sin subdirectorio por PDF (rompe multi-PDF por linea/producto);
generar el PDF en el momento del pago en vez de staging (pierde la vista previa y falla con picos
de trafico: mejor promover un resultado ya calculado).

## D5. Rutas resueltas por el motor unico `PMU_Uploads`

**Decision**: `PMU_Uploads` expone accesos por PDF sobre los ambitos ya declarados
(`pdfs`, `tmp`, `orders`): `dir_pdf($nombre)`, `dir_tmp($pdf)`, `dir_order($id)` y
`ruta_pdf($nombre)` (`{dir_pdf}/{nombre}.pdf`), `ruta_metadata($nombre)`. La clase principal
deja de calcular rutas por su cuenta (se retiran `base()`/`subdir()` heredados).

**Rationale**: Const. II: una sola verdad de almacenamiento. Ademas concentra la creacion
de carpetas, el saneo del nombre y los mensajes de error (`motor:...:directorio:no_escribible`).

**Alternatives considered**: que el plugin siga armando rutas con `wp_upload_dir()`
(duplica la verdad y fue el origen de las rutas contradictorias); crear una clase nueva
para los datos del PDF (contradice "no crear archivos/duplicados sin necesidad").

## D6. Blindaje de la consola (el 500 observado en produccion)

**Decision**: Tres capas complementarias:
1. `PMU_Uploads::guardar_catalogo()` escribe a `{catalogo}.tmp` y renombra sobre el destino:
   ningun lector puede ver un catalogo truncado.
2. `PMU_Uploads::catalogo()` deja de lanzar por contenido ilegible: archivo de 0 bytes, JSON
   invalido o estructura ajena se reportan como `aviso` no bloqueante con catalogo vacio (solo se
   mantiene el rechazo cuando la causa es irrecuperable: directorio no escribible y archivo
   inexistente que no se puede sembrar).
3. El render de la consola no puede terminar en excepcion fatal: `presets_base()` se llama dentro
   de `try/catch` en `admin/pdfs.php` (patron de `admin/estilos-texto.php:34-42`) y `render_page()`
   envuelve el `include` mostrando el mensaje real en un aviso; `enqueue_assets()` protege su unica
   llamada al motor (`url_ambito('img')`).

**Rationale**: El 500 aparecio al renderizar la consola despues de subir un PDF; el log de la
sesion muestra POSTs concurrentes de sprite/miniatura del modulo sobre el mismo catalogo
(`presets.json` con `file_put_contents` no atomico) mientras la pagina lo leia. La pestaña
"Estilos de Texto" no falla porque ya captura la excepcion.

**Alternatives considered**: solo `try/catch` (el catalogo sigue corrompiendose y se pierde el
inventario); solo escritura atomica (otras causas -permisos, JSON editado a mano- volverian a
tumbar la pagina); reintentos con `usleep` (parche, no elimina la carrera); pagina de error propia
(oculta la causa y complica el diagnostico).

## D7. Migracion unica de la raiz heredada

**Decision**: Un unico paso de migracion, con bandera persistida dentro de `pmu/`
(`pmu/.migrado-007`), disparado al abrir la consola:
`uploads/personalizador-pdf/pdfs/{archivo}.pdf` -> `uploads/pmu/pdfs/{nombre}/{nombre}.pdf`;
`datos/{nombre}/metadata.json` -> `pdfs/{nombre}/metadata.json`; `datos/{nombre}/textos.json` ->
`default`/`value`/`preset` de cada grupo (mapeando por la clave de grupo vigente en textos.json).
No se migran `placeholders/`, `imagenes/` ni `salidas/`
(material descartable). No se sobreescribe un destino existente: se informa el conflicto. La raiz
heredada nunca se borra.

**Rationale**: Constitucion V admite la excepcion "cuando sea explicitamente necesario": en
produccion hay un PDF ya analizado con su contenido por grupo. La bandera evita repetir el trabajo
y el respaldo evita perdidas.

**Alternatives considered**: sin migracion (el administrador debe volver a subir y re-analizar);
migracion en cada carga (trabajo repetido y riesgo de duplicados); boton manual en la Ayuda (agrega
UI y una decision innecesaria).

## D8. Preservar el `contenido` al re-analizar

**Decision**: `analizar_y_guardar()` genera los grupos detectados y, antes de escribir, fusiona los
campos de personalizacion (`default`/`value`/`preset`/`config`) del dataset anterior por `id`. Los
grupos que desaparecen pierden su personalizacion y se informan en el resumen.

**Rationale**: El dataset es a la vez resultado del analisis y configuracion del administrador; sin
merge, "Re-analizar" borraria el trabajo de configuracion.

**Alternatives considered**: sobrescribir siempre (perdida silenciosa); guardar el contenido aparte
(es lo que D2 elimina).

## D9. Listado de PDFs: carpetas, no archivos sueltos

**Decision**: El selector lista `uploads/pmu/pdfs/*/{nombre}.pdf` y omite los `.pdf` sueltos en
`pdfs/`. `uploads/pmu/pdfs/muestra.pdf` (fixture de `motor_smoke.php` y `parity.php`) queda como
archivo suelto y no aparece en la consola.

**Rationale**: El producto es la carpeta con su dataset; un PDF suelto no tiene metadata y no es
operativo. Mantener el fixture suelto evita tocar los tests del motor.

**Alternatives considered**: listar tambien sueltos y ofrecer "Re-analizar" (ruido y riesgo de mover
el fixture); mover `muestra.pdf` a su carpeta (rompe las rutas de los tests existentes).

## D10. Borrado y limpieza

**Decision**: Borrar un PDF elimina `pdfs/{nombre}/` completo y `tmp/muestras/{nombre}/`. Un borrador
o staging huerfano (`tmp/cart/`, `tmp/orders/`) caduca por TTL (`creado` en `manifest.json` o fecha
de directorio). La limpieza de linea es quirurgica: solo su `tmp/cart/{linea}/`. `orders/` nunca
se toca desde mantenimiento.

**Rationale**: FR-014 y FR-019; la consola solo gestiona `pdfs/` y `muestras/` (regla 9 del contrato
de rutas). `tmp/cart/` y `tmp/orders/` se limpian por antigüedad, no por borrado de producto, para
no romper compras en curso de otros articulos.

**Alternatives considered**: borrar `tmp/cart/` al borrar el PDF (romperia carritos activos);
borrar todo `tmp/` (arrastraria muestras y sesiones ajenas); limpieza sin TTL inmediata
(romperia el flujo de compra en curso).

## D11. Tests y documentacion

**Decision**: `tests/texto_puente.php` se actualiza al layout nuevo (`preparar_entorno()` y sus
verificaciones) y suma fases: `contenido` (guardado y relectura del bloque en `metadata.json`),
`placeholder` (descarga al vuelo: PNG valido y cero archivos nuevos) y `admin` (render de
`admin/pdfs.php` con catalogo corrupto: sin fatal y con aviso). `motor_smoke.php` y `parity.php` se
mantienen. Documentacion con un solo valor por dato: `AGENTS.md` (§3, §5, §7), `admin/ayuda.php`
(parrafo de almacenamiento) y `readme.txt` (datos guardados, migracion, historial).

**Rationale**: AGENTS.md §9/§10 exige correr el smoke del motor y mantener una sola verdad
documental; los tests son la unica puerta automatica del proyecto (no hay CI).

**Alternatives considered**: dejar los tests con rutas heredadas (probarian algo que ya no existe);
crear un arnes nuevo (duplicaria `texto_puente.php`).