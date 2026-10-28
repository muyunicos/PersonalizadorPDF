# Spec 035 — Fotos originales: navegador primero, carpeta del cliente al pagar

> Estado: **borrador** (2026-10-27). Release prevista: 4.27.0.
> Construye sobre la 012 (subidas del item), la 014 (identidad por cookie), la 026
> (WebP), la 027 (transparencia), la 028 (modos y lienzo), la 029 (la foto se
> referencia) y la 030 (biblioteca = vista sobre contenedores).
> **El Motor no se toca.** No hay compositor PHP: la vista previa sigue siendo el
> bitmap que compone el navegador (028 D6).
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
| **D1** | **Receta v2, completa y versionada**: `v,w,h,forma,modo,escala,dx,dy,fondo,transp,rot,iw,ih,phsize,gid`. `dx/dy` se normalizan al lienzo. El servidor la **revalida** (enum de modo, `escala` 0.25-4, `PH_MAX`, cotas de `dx/dy`) y sigue siendo el unico que calcula el hash (`receta_de`, `inc/class-pmu-sesion.php:1322`). Cierra la colision 90/270. |
| **D2** | **El original se acota a 2000x2000 px al ingerir** (constante unica cliente/servidor, revalidada en el servidor), se guarda en IndexedDB con dedupe por sha y alimenta la vista previa por `objectURL` (0 red). **La subida arranca en segundo plano** al elegir la foto: el navegador es la cache, no el unico lugar. |
| **D3** | **El original NACE en `tmp/sesion-{sid}/uploads/`** (carpeta de la sesion, compartida por sus items) **en segundo plano desde que se elige la foto**, con dedupe por sha: una foto usada en 3 items se guarda **una vez** y no se reenvia al probar encuadres. La composicion por receta va a `tmp/sesion-{sid}/{item_key}/subidas/` al add-to-cart. El add-to-cart **espera solo las subidas pendientes** (aviso "Estamos recibiendo tus archivos, espera..."; en el caso normal no hay espera visible). |
| **D4** | **Al pagarse, el servidor MUEVE**: el item `tmp/sesion-{sid}/{item_key}/` pasa a `orders/{cliente}/{order_id}/{item_key}/` (rename) y los originales a `orders/{cliente}/uploads/` (dedupe por sha); las filas pasan a `origen: 'cliente'` con `id` + `clave`. Se **congela `manifest.cliente`** para que la descarga no dependa de Woo. Idempotente y **nunca bloquea el pago** (`try/catch` + `log_pedido`, reintento en cada cambio de estado). |
| **D5** | **La composicion viaja CON el pedido; el original se REFERENCIA** por `id` + `clave`. El PDF sale de la composicion (inmutable), asi que **borrar un original no rompe ningun pedido**: solo pierde la reedicion. Resuelve el P3 de la 030 sin materializar. |
| **D6** | **Sin staging**: `tmp/orders/` **no existe ni existira**. El item vive en `tmp/sesion-{sid}/` hasta el pago y ahi se mueve. El TTL de 30 dias de un item sin pagar es **politica deseada** (P6 = B): si un pedido `on-hold` se paga despues, la personalizacion ya no existe y Pedidos lo muestra con su causa. |
| **D7** | **La biblioteca sigue siendo una VISTA** (030 D1): escanea los contenedores del comprador (`tmp/sesion-*` y `orders/{cliente}/{order_id}/*`) y muestra **una entrada por original** (`madre` = sha), no una por composicion. `orders/{cliente}/uploads/` solo aporta lo ya comprado; el escaneo de `orders/` pasa a **3 niveles**. |
| **D8** | **Sin fusion invitado -> cuenta**: la cuenta es **obligatoria al comprar**, asi que en `pedido_promover()` ya existe `$order->get_customer_id()` y el traslado usa ese `uid`. Un pedido con `customer_id = 0` (manual del admin o historico de invitado) **no se promueve** y queda con causa visible en Pedidos. |
| **D9** | **Sin compositor PHP.** La vista previa es client-side y el PDF usa el bitmap que compuso el navegador: **"la vista previa es el PDF" se mantiene byte a byte**. La receta se guarda para el futuro (API 010, reparacion), no se usa para imprimir. |
| **D10** | **Mockup: fuera de esta spec** (va a la 036): `objectURL` local + pintado progresivo, y plano de 2 caras solo con medicion previa. Aca no se toca el camino de mockup de `assets/tienda.js` ni `assets/mockup-render.js`. |
| **D11** | **La vista se marca al MOSTRARSE, no al pulsar un boton**: cada vista de la galeria queda como vista cuando la galeria la muestra (la inicial cuenta); el add-to-cart se habilita cuando **todas las vistas obligatorias** fueron mostradas. Las vistas **no omisibles** van **primero**, con el mensaje "Revisa la vista previa"; las `preview_omisible` (por PDF) no exigen haber sido vistas. La marca vive en el cliente y se persiste en el add-to-cart con el webp congelado (`mockup_vistas`), sin un POST por navegacion. |
| **D12** | **Sin migracion y sin compatibilidad de rutas**: no hay pedidos previos (desarrollo con control total), asi que el arbol viejo `orders/{order_id}/` **no** se lee: los 4 puntos de lectura usan solo `orders/{cliente}/{order_id}/`. Las filas viejas (`origen: subida/ref/texto`) si se siguen leyendo. |
| **D13** | **La carpeta de sesion compartida no rompe el barrido**: `limpiar_ttl()` **excluye** `tmp/sesion-{sid}/uploads/` del conteo por item (como ya hace con `draft-`), la poda de originales es **por sesion** (¿algun item lo referencia?) y `borrar_item()` no se lleva la carpeta compartida mientras otro item la use. |
| **D14** | **Aislamiento de `orders/`**: los dos niveles son numericos (`{cliente}` y `{order_id}`) y los escaneos exigen `ctype_digit`; `orders/{cliente}/uploads/` **nunca** se lista como pedido. Ninguna purga futura de `orders/` puede tocar `orders/{cliente}/uploads/`. |

## 3. Contrato

### 3.1 Receta v2 (`manifest.subidas[].receta` y `archivos[].hash`)

```json
{ "v": 2, "w": 463, "h": 463, "forma": "cuadrado", "modo": "cubrir",
  "escala": 1.25, "dx": -0.031, "dy": 0.014, "fondo": "transparent",
  "transp": "no", "rot": 90, "iw": 1600, "ih": 1200, "phsize": 1, "gid": "0000FF" }
```

- `dx/dy` en fraccion del lienzo (independiente de la resolucion).
- `rot` en `0|90|180|270`; `v` obliga a recomputar (`receta_de` v2).
- El servidor **deriva** el lienzo de `analisis.json` + `phsize` para validar; el
  `w/h` de la receta es solo el snapshot con el que se compuso (sirve ante un
  Re-analizar o un reemplazo de PDF, spec 032).

### 3.2 Fila de `manifest.subidas[]`

| Campo | Regla |
|---|---|
| `origen` | `subida` (composicion en el item), `sesion` (original en `tmp/sesion-{sid}/uploads/`), `cliente` (original ya comprado en `orders/{cliente}/uploads/`) o `ref` (archivo de otro pedido, 030) |
| `id` | `{sha12}` del original (estable entre items y pedidos) |
| `clave` | solo con `origen: cliente`: el `uid` del pedido (`manifest.cliente`); el servidor arma `orders/{clave}/uploads/{id}.webp` |
| `madre` | familia = el original; **inmutable** |
| `file` / `ref` | `file` solo con `origen: subida` (`subidas/{id}.webp`); `origen: cliente` **no** usa `ref`: el servidor arma la ruta desde `id` + `clave`; `ref` queda para la 030 (`origen: ref`) |
| `receta`, `sha`, `mime`, `bytes`, `creado` | igual que hoy |

Invariantes: una fila `cliente` **no** protege ningun archivo local (la poda de la
029 no cambia); `resolver_ref()` (`inc/class-pmu-sesion.php:1299`) valida el `ref`
con `realpath` dentro de `uploads/pmu/`; al promover, las filas `sesion` pasan a
`cliente` en la **misma** escritura del manifest (nunca quedan apuntando a `tmp/`).

### 3.3 Carpeta del cliente (`orders/{cliente}/`)

```
uploads/pmu/
├── tmp/sesion-{sid}/
│   ├── uploads/{id}.webp            originales de la sesion (1 por sha, compartidos)
│   └── {item_key}/                  manifest + subidas/ (composiciones) + img/ + mockups
└── orders/{cliente}/                uid congelado en manifest.cliente
    ├── datos.json                   {version:1, items:[{id,nombre,w,h,bytes,mime,sha,creado,ultimo_uso,favorito}], opciones:{}}
    ├── uploads/{id}.webp            original acotado a 2000 px; `id` = 12 hex del sha
    └── {order_id}/{item_key}/       entregable (sin cambios internos)
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
- `borrar_item()` (`inc/class-pmu-sesion.php:1178`) sigue borrando el arbol del
  item en `tmp`; lo que ya se traslado a `orders/{cliente}/uploads/` no se toca, y la
  carpeta compartida `tmp/sesion-{sid}/uploads/` **no** se borra mientras otro item la use.

### 3.4 Flujo

```
1. Elige foto      -> cap 2000 px, WebP q0.85, IndexedDB (0 red)
                      + SUBIDA EN SEGUNDO PLANO del original a tmp/sesion-{sid}/uploads/ (1 por sha)
2. Ajusta/Guarda   -> composicion en canvas; el original no se reenvia (ya esta o viaja en segundo plano)
3. Add-to-cart     -> espera solo lo pendiente ("Estamos recibiendo tus archivos, espera...")
                      + COMPOSICION por receta + textos del pool; registra filas; congela mockups
4. Pago            -> pedido_promover: rename tmp/sesion-{sid}/{item} -> orders/{cliente}/{order_id}/{item}
                      + mueve originales a orders/{cliente}/uploads/ + filas 'cliente' (id + clave)
5. Descarga        -> Motor con la composicion del pedido (no depende del original)
6. Reedicion       -> original desde orders/{cliente}/uploads/ (o IndexedDB si aun no pago)
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
- **Fuera de esta spec**: montar la galeria automaticamente al completar los campos (sin boton)
  es de la 036; aca el disparo no cambia.

## 4. Puertas

- `node tests/receta-contrato.test.js` (NUEVO): receta v2 completa; `rot` 90 != 270;
  la misma composicion por dos caminos da la misma receta; rangos fuera de contrato
  se rechazan (`modo`, `escala`, `PH_MAX`, cotas de `dx/dy`).
- `php tests/texto_puente.php receta|carpeta_cliente|traslado` (fases NUEVAS): el traslado es
  idempotente; dedupe por sha; las filas quedan en `origen: cliente`; **borrar el
  original no rompe `item_generar_pdfs`**; el pedido se descarga con traslado pendiente;
  un `clave` fuera de `/^\d{1,12}$/` se rechaza y un `id` inexistente deja el hueco transparente.
- `node tests/ficha-pedido.browser.js` (ampliada): el add-to-cart sube original +
  composicion; recargar la ficha recupera del servidor; reedicion desde el carrito.
- `php tests/sin_lectura.php` + `php tests/estado_pmu.php`: leer la galeria no escribe
  catalogos; el ambito nuevo aparece en el estado del espejo.
- `php tests/texto_puente.php rutas|carpeta_cliente` (NUEVAS) cubre el **refactor de `orders/`**:
  los dos escaneos listan `orders/{cliente}/{order_id}/{item}` con `ctype_digit` y
  **no** listan `orders/{cliente}/uploads/` como pedido; `cliente_valido()` exige
  `/^\d{1,12}$/`; `promover_order()` mueve el item y escribe `manifest.cliente`; un
  pedido con `customer_id = 0` **no** se promueve y deja causa visible.
- `node tests/ficha-pedido.browser.js`: la galeria pone primero las vistas no omisibles, navegar
  las marca, el boton se habilita al ver la **ultima obligatoria** y no antes; recargar conserva
  la marca (`localStorage`); una vista fallida no bloquea.
- `php tests/motor_smoke.php` y `php tests/parity.php` en verde: **el Motor no cambia**.

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

## 6. Fuera de alcance

- **Compositor PHP** (D9): no se compone en el servidor; el Motor sigue recibiendo
  bitmaps ya compuestos.
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
| P8 | Mockup optimizado | **CERRADA**: va a la spec 036, fuera de esta |

