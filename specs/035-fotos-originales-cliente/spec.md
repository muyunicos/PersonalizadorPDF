# Spec 035 — Fotos originales: navegador primero, carpeta del cliente al pagar

> Estado: **borrador** (2026-10-27). Release prevista: 4.27.0.
> Construye sobre la 012 (subidas del item), la 014 (identidad por cookie), la 026
> (WebP), la 027 (transparencia), la 028 (modos y lienzo), la 029 (la foto se
> referencia) y la 030 (biblioteca = vista sobre contenedores).
> **El Motor no se toca** (`Pdf`/`Detector`/`Overlay`/`Motor`). Se agrega
> `engine/Compositor.php`: el navegador manda original + receta y el servidor compone
> la foto bajo demanda al generar el PDF (D9, enmienda 2026-10-28).
> **Alcance**: receta v2 + original en el navegador y en la sesion + carpeta del
> cliente + **refactor de `orders/` a `orders/{cliente}/{order_id}/`** (§5) + **sin
> staging** (`tmp/orders/` no existe). El mockup optimizado va a la spec 036.

## Clarifications

### Session 2026-10-27

- Q: ¿Que debe pasar con los pedidos que ya existen hoy en `orders/{order_id}/` cuando el codigo empiece a buscar en `orders/{cliente}/{order_id}/`? → A: **Nada (D)**: no hay pedidos previos (desarrollo con control total). Sin migracion ni fallback de lectura.
- Q: Si el navegador ya no tiene el original (IndexedDB desalojado, modo privado o cambio de dispositivo) al pulsar "Anadir al carrito", ¿que debe hacer el sistema? → A: **Subida en segundo plano**: el original se sube mientras el comprador ajusta (arranca al elegir la foto, dedupe por sha); el add-to-cart espera solo lo pendiente con el aviso "Estamos recibiendo tus archivos, espera..." y, en el caso normal, no hay espera visible.
- Q: ¿Debe haber un limite de fotos o de peso por cliente en `orders/{cliente}/uploads/` en esta entrega, o se mide primero? → A: **Sin cuota (A)**: solo medicion (smoke/`estado_pmu`); el limite se define despues con datos reales (030 P2). El cap de 2000 px ya acota el peso por archivo.

## 1. Problema

Hoy, al aceptar el recorte, el navegador compone la imagen y **sube el resultado**
(`assets/tienda.js:485` → `handle_subida` → `guardar_subida`,
`inc/class-pmu-sesion.php:843`). Consecuencias:

1. **La foto original se descarta**: solo queda la composicion al tamano del hueco
   (la 030 §5 lo declara fuera de alcance). No se puede reeditar a otra resolucion
   ni reutilizar la misma foto en otro producto sin volver a subirla.
2. **Cada prueba de encuadre cuesta red**: cada recorte distinto es una subida
   (la poda borra la anterior, pero el byte ya viajo).
3. **La biblioteca guarda composiciones**, no fotos: de ahi `versiones`, `base` por
   area y el `Elegir` vs `Subir` de la 030. El modelo es mas complicado de lo que
   el negocio necesita.
4. **La receta no es reproducible**: `_params()` (`assets/selector-pmu.js:1117`)
   omite `rot`; 90 y 270 grados producen la misma receta con distinto bitmap, asi
   que `Elegir` puede reusar una composicion girada al reves.
5. **El arbol de pedidos no tiene carpeta de cliente**: hoy es `orders/{order_id}/{item_key}/`.
   Con la cuenta obligatoria al comprar y una biblioteca por cliente, la estructura
   natural es `orders/{cliente}/{order_id}/{item_key}/` + `orders/{cliente}/uploads/`,
   y `tmp/orders/` (el staging) deja de existir.

## 2. Decisiones

| # | Decision |
|---|----------|
| **D1** | **Receta v2, completa y versionada**: `v,w,h,forma,modo,escala,ox,oy,fondo,transp,rot,iw,ih,phsize,gid`. `ox/oy` = **centro de dibujo normalizado** al lienzo (`0.5` = centro del lienzo; incluye el centro de la forma principal y el desplazamiento ya escalado por la Escala), que es lo que necesita el compositor sin portar `geometriaEscena` a PHP. El servidor la **revalida** (enum de modo, `escala` 0.25-4, `PH_MAX`, cotas de `ox/oy` en [0,1]) y sigue siendo el unico que calcula el hash (`receta_de`, `inc/class-pmu-sesion.php:1322`). Cierra la colision 90/270. |
| **D2** | **El original se acota a 2000x2000 px al ingerir** (constante unica cliente/servidor, revalidada en el servidor), se guarda en IndexedDB con dedupe por sha y alimenta la vista previa por `objectURL` (0 red). **La subida arranca en segundo plano** al elegir la foto: el navegador es la cache, no el unico lugar. |
| **D3** | **El original NACE en `tmp/sesion-{sid}/uploads/`** (carpeta de la sesion, compartida por sus items) **en segundo plano desde que se elige la foto**, con dedupe por sha: una foto usada en 3 items se guarda **una vez** y no se reenvia al probar encuadres. La composicion **no se sube**: el add-to-cart manda `{id, receta}` y el servidor la materializa bajo demanda (D9). El add-to-cart **espera solo las subidas pendientes** (aviso "Estamos recibiendo tus archivos, espera..."; en el caso normal no hay espera visible). |
| **D4** | **Al pagarse, el servidor MUEVE (sin copias)**: el item `tmp/sesion-{sid}/{item_key}/` pasa a `orders/{cliente}/{order_id}/{item_key}/` (rename) y cada original `tmp/sesion-{sid}/uploads/{id}.webp` a `orders/{cliente}/uploads/{id}.webp` (rename idempotente: si ya existe en la fija, no se repite). Las filas **no cambian**: siguen con `origen: original` + `id`. Se **congela `manifest.cliente`** para que la descarga no dependa de Woo. **Nunca bloquea el pago** (`try/catch` + `log_pedido`, reintento en cada cambio de estado). |
| **D5** | **La composicion se materializa en el item; el original se REFERENCIA solo por `id`.** El PDF sale de la composicion, asi que tras la **primera** generacion el original no hace falta: moverlo sin copias y borrarlo no rompe la regeneracion. Borrarlo **antes** de esa primera generacion deja el hueco con `motor:original:ausente`. Resuelve el P3 de la 030 sin materializar. |
| **D6** | **Sin staging**: `tmp/orders/` **no existe ni existira**. El item vive en `tmp/sesion-{sid}/` hasta el pago y ahi se mueve. El TTL de 30 dias de un item sin pagar es **politica deseada** (P6 = B): si un pedido `on-hold` se paga despues, la personalizacion ya no existe y Pedidos lo muestra con su causa. |
| **D7** | **La biblioteca sigue siendo una VISTA** (030 D1): escanea los contenedores del comprador (`tmp/sesion-*` y `orders/{cliente}/{order_id}/*`) y muestra **una entrada por original** (`madre` = `id` del original), no una por composicion. `orders/{cliente}/uploads/` solo aporta lo ya comprado; el escaneo de `orders/` pasa a **3 niveles**. |
| **D8** | **Sin fusion invitado -> cuenta**: la cuenta es **obligatoria al comprar**, asi que en `pedido_promover()` ya existe `$order->get_customer_id()` y el traslado usa ese `uid`. Un pedido con `customer_id = 0` (manual del admin o historico de invitado) **no se promueve** y queda con causa visible en Pedidos. |
| **D9** | **Compositor PHP bajo demanda** (DEROGA la version anterior de D9, 2026-10-28): el cliente manda **original + receta**, nunca el bitmap compuesto. `engine/Compositor.php` (GD, requisito) materializa `img/foto-{pdf}-{gid}-{receta}.webp` **al generar el PDF** (descarga y regeneracion), con nombre **determinista por receta**: el nombre **es** el cache (si existe, no recompone) y dos instancias con la misma foto+receta comparten archivo. "La vista previa es el PDF" pasa a **mismo encuadre**, no byte a byte. El texto sigue llegando como PNG del navegador. |
| **D10** | **Mockup: fuera de esta spec** (va a la 036): `objectURL` local + pintado progresivo, y plano de 2 caras solo con medicion previa. Aca no se toca el camino de mockup de `assets/tienda.js` ni `assets/mockup-render.js`. |
| **D11** | **La vista se marca al MOSTRARSE, no al pulsar un boton**: cada vista de la galeria queda como vista cuando la galeria la muestra (la inicial cuenta); el add-to-cart se habilita cuando **todas las vistas obligatorias** fueron mostradas. Las vistas **no omisibles** van **primero**, con el mensaje "Revisa la vista previa"; las `preview_omisible` (por PDF) no exigen haber sido vistas. La marca vive en el cliente y se persiste en el add-to-cart con el webp congelado (`mockup_vistas`), sin un POST por navegacion. |
| **D12** | **Sin migracion y sin compatibilidad de rutas**: no hay pedidos ni items previos (desarrollo con control total), asi que el arbol viejo `orders/{order_id}/` **no** se lee: los 4 puntos de lectura usan solo `orders/{cliente}/{order_id}/`. |
| **D13** | **La carpeta de sesion compartida no rompe el barrido**: `limpiar_ttl()` **excluye** `tmp/sesion-{sid}/uploads/` del conteo por item (como ya hace con `draft-`), la poda de originales es **por sesion** (¿algun item lo referencia?) y `borrar_item()` no se lleva la carpeta compartida mientras otro item la use. |
| **D14** | **Aislamiento de `orders/`**: los dos niveles son numericos (`{cliente}` y `{order_id}`) y los escaneos exigen `ctype_digit`; `orders/{cliente}/uploads/` **nunca** se lista como pedido. Ninguna purga futura de `orders/` puede tocar `orders/{cliente}/uploads/`. |

## 3. Contrato

### 3.1 Receta v2 (`manifest.subidas[].receta` y `archivos[].hash`)

```json
{ "v": 2, "w": 463, "h": 463, "forma": "cuadrado", "modo": "cubrir",
  "escala": 1.25, "ox": 0.484, "oy": 0.507, "fondo": "transparent",
  "transp": "no", "rot": 90, "iw": 1600, "ih": 1200, "phsize": 1, "gid": "0000FF" }
```

- `ox/oy` = centro de dibujo en fraccion del lienzo (`0.5` = centro), ya con el centro
  de la forma y el desplazamiento escalado por la Escala: el compositor dibuja ahi sin
  conocer la geometria de la envoltura.
- `rot` en `0|90|180|270`; `v` obliga a recomputar (`receta_de` v2).
- El servidor **deriva** el lienzo de `analisis.json` + `phsize` para validar, y
  **recalcula** `k` y el tamano del PNG (`escalaSalida`: `k = min(1, max(iw,ih)/max(caja))`);
  no los recibe, para que haya una sola fuente de verdad.

### 3.2 Fila de `manifest.subidas[]`

| Campo | Regla |
|---|---|
| `origen` | `original` (la foto del comprador), `compuesta` (el bitmap que imprime el Motor, en el pool) o `ref` (archivo de otro pedido, 030) |
| `id` | `{sha12}` del original (estable entre items y pedidos) |
| `madre` | familia = el `id` del original; **inmutable** |
| `file` | solo con `origen: compuesta`: `img/foto-{pdf}-{gid}-{receta}.webp` (**determinista**: la escribe el servidor, no el cliente) |
| `ref` | solo con `origen: ref`: relativo al item, validado con `realpath` |
| `receta`, `sha`, `mime`, `bytes`, `creado` | igual que hoy |

Invariantes: la fila `original` lleva **solo `id`** (sin `file`, sin `ref`, sin `clave`): el
servidor resuelve la cadena de ubicaciones. `resolver_ref()` (`inc/class-pmu-sesion.php:1299`)
valida el `ref` con `realpath` dentro de `uploads/pmu/`. Al promover, las filas **no se reescriben**
(el `id` no cambia).
**Resolucion por cadena** (`resolver_original($id, $clave, $sid)`): `orders/{clave}/uploads/{id}.webp`
(fija) -> `tmp/sesion-{sid}/uploads/{id}.webp` (temporal) -> causa `motor:original:ausente`.
`handle_subida_url()`, `biblioteca_ruta_imagen()` e `item_generar_pdfs()` la usan.
**Pool**: `{item}/img/txt-{pdf}-{gid}-{n}.webp` (texto, lo sube el navegador) y
`{item}/img/foto-{pdf}-{gid}-{receta}.webp` (composicion, la materializa el servidor);
`siguiente_n()` y `limpiar_grupo()` filtran por prefijo.
**Materializacion** (D9): la fila `compuesta` la escribe `item_generar_pdfs()` (y
`item_regenerar()`) justo antes de llamar al Motor, solo si el archivo con ese nombre **no
existe**: el nombre por receta es el cache. El cliente nunca sube una composicion.

### 3.3 Carpeta del cliente (`orders/{cliente}/`)

```
uploads/pmu/
├── tmp/sesion-{sid}/
│   ├── uploads/{id}.webp            ORIGINALES de la sesion (1 por sha, compartidos)
│   └── {item_key}/                  manifest + img/ (pool: txt- y foto-) + mockups
└── orders/{cliente}/                uid congelado en manifest.cliente
    ├── datos.json                   {version:1, items:[{id,nombre,w,h,bytes,mime,sha,creado,ultimo_uso,favorito}], opciones:{}}
    ├── uploads/{id}.webp            ORIGINALES comprados (el pago los mueve aca)
    └── {order_id}/{item_key}/       entregable: manifest + img/ (foto- y txt-) + mockups
```

- El **nombre original** vive en `datos.json`, nunca en el filesystem (PII,
  colisiones entre clientes, dedupe).
- Escritura con `mutar_manifest_dir()` (flock + `tmp` + `rename`), no con un
  escritor nuevo.
- `limpiar_ttl()` **no** lo toca: la purga es por uso y por cuota (030 P2).
- **Aislamiento de `orders/`** (D14): los dos niveles son numericos y
  los escaneos de `orders/` se reescriben a **3 niveles** con `ctype_digit`:
  `biblioteca_contenedores()` y `pedidos_completados()`; se agrega `cliente_valido()`
  (`/^\d{1,12}$/`) y **ninguna** purga futura de `orders/` puede tocar
  `orders/{cliente}/uploads/`.
- `borrar_item()` (`inc/class-pmu-sesion.php:1178`) borra el arbol del item en `tmp` (manifest +
  pool + mockups); los **originales** de `tmp/sesion-{sid}/uploads/` no se tocan mientras otro item
  de la sesion los use, y los ya movidos a `orders/{cliente}/uploads/` tampoco.

### 3.4 Flujo

```
1. Elige foto      -> cap 2000 px, WebP q0.85, IndexedDB (0 red)
                      + SUBIDA EN SEGUNDO PLANO del original a tmp/sesion-{sid}/uploads/ (1 por sha)
2. Ajusta/Guarda   -> la vista previa compone en canvas (solo para ver); se guarda la RECETA
3. Add-to-cart     -> espera solo lo pendiente ("Estamos recibiendo tus archivos, espera...")
                      + {id, receta} por grupo + TEXTOS al pool (img/txt-); filas; congela mockups
4. Pago            -> pedido_promover: rename del item y de cada original (tmp -> orders/{cliente})
                      + manifest.cliente (las filas no cambian: el id no cambia)
5. Descarga        -> el Compositor materializa img/foto-{...}-{receta}.webp (si falta) y el Motor
                      arma el PDF desde el pool
6. Reedicion       -> original por id: cache -> orders/{cliente}/uploads -> tmp/sesion-*/uploads
```

### 3.5 Marca de "visto" (galeria)

- **Que cuenta**: una vista queda `visto` cuando la galeria la **muestra** (incluye la inicial).
- **Orden**: primero las vistas de PDFs **no omisibles** (las que bloquean), despues las omisibles.
- **Mensaje**: mientras falten obligatorias, la galeria muestra "Revisa la vista previa".
- **Habilitacion**: `bloqueos.vistas` (`assets/tienda.js:445`) pasa a `false` cuando no queda
  ninguna obligatoria sin ver; `preview_omisible` por PDF sigue eximiendo.
- **Persistencia**: `localStorage` por `item_key` + `mockup_id` (sobrevive la recarga); el servidor
  lo confirma al congelar (`manifest.mockup_vistas`), sin peticiones durante la navegacion.
- **Vista fallida**: una vista podada por error (`fallida`) **no** cuenta como obligatoria.
- **`preview_estado`**: se sigue escribiendo en `carrito_promover` — `ok` si se congelaron los
  mockups de las vistas obligatorias, `sin_vista` si falto alguna; `omisible` no cambia (030).
- **Clave local**: si el item pasa de `draft-{uuid}` a `cart_item_key`, la entrada de
  `localStorage` se migra en el mismo paso (no se pierde la marca por el rename).
- **Fuera de esta spec**: montar la galeria automaticamente al completar los campos (sin boton)
  es de la 036; aca el disparo no cambia.

## 4. Puertas

- `node tests/receta-contrato.test.js` (NUEVO): receta v2 completa; `rot` 90 != 270;
  la misma composicion por dos caminos da la misma receta; rangos fuera de contrato
  se rechazan (`modo`, `escala`, `PH_MAX`, cotas de `ox/oy`).
- `php tests/compositor.php` (NUEVO, CLI + GD): 3 modos x 4 rotaciones x fondo x `transp`;
  el alfa se preserva; el PNG mide el lienzo acotado (`escalaSalida`); sin GD falla con causa.
- `node tests/compositor-paridad.test.js` (NUEVO): matriz `caja`/`salida` JS vs PHP con
  tolerancia de +-1 px (`escalaBase`/`escalaSalida` del selector son la referencia).
- `php tests/texto_puente.php receta|carpeta_cliente|traslado` (fases NUEVAS): el traslado es
  idempotente; dedupe por sha; las filas quedan en `origen: original`; **borrar el
  original tras la 1a generacion no rompe `item_generar_pdfs`** (antes de ella deja
  `motor:original:ausente`); el pedido se descarga con traslado pendiente;
  un `id` inexistente deja el hueco transparente con `motor:original:ausente`.
- `node tests/ficha-pedido.browser.js` (ampliada): el add-to-cart sube original +
  composicion; recargar la ficha recupera del servidor; reedicion desde el carrito.
- `php tests/sin_lectura.php` + `php tests/estado_pmu.php`: leer la galeria no escribe
  catalogos; el ambito nuevo aparece en el estado del espejo.
- `php tests/texto_puente.php rutas|carpeta_cliente` (NUEVAS) cubre el **refactor de `orders/`**:
  los dos escaneos listan `orders/{cliente}/{order_id}/{item}` con `ctype_digit` y
  **no** listan `orders/{cliente}/uploads/` como pedido; `cliente_valido()` exige
  `/^\d{1,12}$/`; `promover_order()` mueve el item y los originales y escribe `manifest.cliente`; un
  pedido con `customer_id = 0` **no** se promueve y deja causa visible.
- `node tests/ficha-pedido.browser.js`: la galeria pone primero las vistas no omisibles, navegar
  las marca, el boton se habilita al ver la **ultima obligatoria** y no antes; recargar conserva
  la marca (`localStorage`); una vista fallida no bloquea.
- `php tests/motor_smoke.php` y `php tests/parity.php` en verde: **el Motor no cambia**
  (el compositor es codigo nuevo en `engine/`; `Pdf`/`Detector`/`Overlay`/`Motor` intactos).

## 5. Inventario de cambios (el refactor de `orders/`)

Son 20 puntos, no un buscar-y-reemplazar ciego: cambian firmas y hay que reescribir
los escaneos.

| Archivo | Punto | Cambio |
|---|---|---|
| `inc/class-pmu-uploads.php` | `dir_order` (`1073`) | Firma nueva `($cliente, $order_id, $crear)` → `orders/{cliente}/{order_id}` |
| | `dir_tmp_order` (`1056`) | **Eliminar** (no hay staging) |
| | `ruta_order_pdf` (`1091`) | **Eliminar** (codigo muerto: cero usos) |
| `inc/class-pmu-sesion.php` | `staging_order` (`1191`) | **Eliminar** |
| | `promover_order` (`1211`) | `($order_id, $cliente, $sid, $item)`: mueve el item y los originales; escribe `manifest.cliente` |
| | `limpiar_ttl` (`1242`) | Excluir `tmp/sesion-{sid}/uploads/` del conteo por item |
| `personalizador-pdf.php` | `pedido_staging_crear` (`2928`) + hook | **Eliminar** |
| | `pedido_promover` (`2965`) | Pasa `$order->get_customer_id()`; `0` = no promover + causa |
| | `manifest_item` (`3050`) | `dir_order`; sin fallback `tmp/orders` |
| | `item_generar_pdfs` (`3185`) | `dir_order`; sin fallback `tmp/orders` |
| | `item_regenerar` (`3347`) | `dir_order` |
| | `pedidos_completados` (`3291`) | Escaneo de **3 niveles** + `cliente` en la fila |
| | `biblioteca_contenedores` (`2047`) | Escaneo de 3 niveles |
| | `biblioteca_peso_identidades` (`1951`) | Escaneo de 3 niveles |
| | `admin/pedidos.php` | Columna de cliente (viene de `pedidos_completados`) |
| Docs | `constitution.md` §IV | `orders/{cliente}/{order_id}/{item_key}` |
| | `AGENTS.md` §2/§5/§7 | Rutas + ambito de originales |
| | `specs/030/spec.md` + `contracts/` | Nota de supersesion (profundidad del `ref`) |
| Tests | `tests/texto_puente.php` | `1401`, `1415`, `2261`, `2487-2530`, `3713-3714`, `4741-4745` |
| | `tests/ficha-pedido.browser.js` | `568` (ruta del PDF) |
| | `tests/estado_pmu.php`, `inventario_pmu.php`, `sin_lectura.php` | Escaneos de `orders/` |

### 5.b Cambios del pool (`subidas/` -> `img/`)

| Archivo | Punto | Cambio |
|---|---|---|
| `inc/class-pmu-sesion.php` | `guardar_subida()` (`843`) | Escribe el **original** en `tmp/sesion-{sid}/uploads/{id}.webp` (dedupe por `id`); ya no escribe `subidas/` |
| | `guardar_imagen()` (`384`) | Acepta `origen` (`texto`/`compuesta`) y prefija el nombre: `img/txt-…` / `img/foto-…` |
| | `siguiente_n()` (`355`) y `limpiar_grupo()` (`654`) | Filtran por prefijo (`txt-`/`foto-`) para no mezclar textos y composiciones del mismo grupo |
| | `podar_subidas()` (`582`) y `registrar_fotos()` (`509`) | **Eliminar** (`subidas/` no existe; la composicion va al pool) |
| | `handle_pool_png()` (`1644`) | **No cambia**: el pool solo recibe TEXTO (la composicion la escribe el servidor) |
| | `handle_subida()` (`1784`) | Solo originales: devuelve `{id, sha, w, h, url}` |
| `engine/Compositor.php` | NUEVO | `caja()`/`salida()` (paridad con `escalaBase`/`escalaSalida`) + `componer($original, $receta)`: fondo, rotacion, escala, `ox/oy`, alfa, WebP q0.85 (D9) |
| `inc/class-pmu-sesion.php` | `item_generar_pdfs()` / `item_regenerar()` | Materializan las composiciones que falten antes del Motor |

## 6. Fuera de alcance

- **Pagina "Mis imagenes"** en Mi cuenta: spec aparte (como en la 030).
- **Favoritos y "ultimo uso"**: `datos.json` deja los campos; la UI va en spec aparte.
- **Mockup optimizado** (D10): va a la **spec 036** (`objectURL` + pintado progresivo + plano de 2 caras).
- **Cuota por cliente**: **sin cuota en esta entrega** (2026-10-27): solo se mide con el smoke y
  `estado_pmu`; el limite se define despues con datos reales (030 P2). El cap de 2000 px ya acota el
  peso por archivo.
- **Invalidar la marca de visto al editar un mockup**: requiere una firma del mockup que hoy no
  existe; si el admin cambia las capas, el comprador que ya vio la version anterior no vuelve a verla.
- **Recuperacion de fotos de un invitado** que perdio la cookie: solo afecta a `tmp/`
  (vence a los 30 dias); spec aparte.

## 7. Pendientes y decisiones cerradas

| # | Pendiente | Propuesta |
|---|---|---|
| P1 | Ruta destino | **CERRADA (2026-10-27)**: item en `orders/{cliente}/{order_id}/{item_key}/` y originales en `orders/{cliente}/uploads/` |
| P2 | Cuenta obligatoria al comprar | **CERRADA**: es obligatoria (config de Woo). La 014 sigue vigente para la navegacion previa al login |
| P3 | Invitado que pierde la cookie | Solo afecta a `tmp/` (vence a los 30 dias): no hay carpeta de invitado en `orders/`. Recuperacion al registrarse: spec aparte |
| P4 | TTL de un original no comprado | **CERRADA (P6 = B)**: vence con el item a los 30 dias; se acepta la perdida |
| P5 | Marca de "visto" | **CERRADA (2026-10-27)**: se marca al mostrarse en la galeria (no con un boton); las no omisibles van primero con el aviso y el add-to-cart se habilita al ver la ultima obligatoria (§3.5) |
| P6 | Pedido `on-hold` pagado despues de 30 dias | **CERRADA = B**: se acepta la perdida de la personalizacion y Pedidos muestra la causa (`motor:descarga:item:ausente`) |
| P7 | Pedido con `customer_id = 0` | **CERRADA**: no se promueve y queda con causa visible (no se inventa un cliente `0`) |
| P8 | Compositor PHP (D9 derogada) | **CERRADA (2026-10-28)**: `engine/Compositor.php` compone bajo demanda al generar el PDF; GD con WebP pasa a requisito (verificado en el hosting). "La vista previa es el PDF" = mismo encuadre |
| P8 | Mockup optimizado | **CERRADA**: va a la spec 036, fuera de esta |

