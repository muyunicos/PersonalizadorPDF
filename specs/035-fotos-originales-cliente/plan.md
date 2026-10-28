# Plan de implementacion: Fotos originales y carpeta del cliente

**Rama**: (sin rama: el repo despliega desde `main`)
**Spec**: [spec.md](./spec.md)
**Estado**: plan (borrador), sin implementar
**Creada**: 2026-10-27

---

## Summary

Guardar la foto **original** del comprador (acotada a 2000x2000 px) en el navegador hasta el
add-to-cart, subirla **una sola vez** a la carpeta de la sesion (`tmp/sesion-{sid}/uploads/`) y, al
pagarse el pedido, **moverla** a la carpeta del cliente (`orders/{cliente}/uploads/`), con las filas
del manifest referenciandola solo por `id`. La composicion la produce el servidor **bajo demanda** al
generar el PDF (`engine/Compositor.php`, GD), asi que **la vista previa sigue siendo el PDF** en
encuadre.

Incluye ademas: **receta v2** (con `rot`: cierra la colision 90/270), la **marca de "visto" por
navegacion** en la galeria (D11/§3.5) y el **refactor de `orders/` a `orders/{cliente}/{order_id}/`**
con la eliminacion del staging (`tmp/orders/`), que es la parte de mayor riesgo (20 puntos, §5), y el
**compositor PHP** (`engine/Compositor.php`, D9) que materializa la foto bajo demanda.

## Technical Context

- **Lenguaje/stack**: PHP 8 (min. 7.4) en hosting compartido (Hostinger Business: sin `exec`, sin Node/Python en runtime) + JS ES5/jQuery sin build en `assets/`. Motor PHP puro en `engine/`.
- **Dependencias**: WordPress + WooCommerce; GD con WebP (la 026 ya lo exige para leer y convertir); en el cliente, `IndexedDB` y `localStorage` nativos, sin librerias nuevas.
- **Almacenamiento**: archivos en `uploads/pmu/` con `PMU_Uploads` como dueno unico; JSON con escritura atomica (`mutar_manifest_dir`: flock + `.tmp` + `rename`). Sin tablas ni catalogos nuevos.
- **Endpoints**: los `admin_post` vigentes (`personalizador_pdf_subida`, `_pool`, `_vista_previa`, `_biblioteca`, `_item_descargar`, `_item_regenerar`). No se agregan rutas REST.
- **Testing**: puertas del repo (`php -l`, `tests/texto_puente.php` con fases nuevas, `tests/motor_smoke.php`, `parity`, `sin_lectura`, `estado_pmu`, Node `tests/receta-contrato.test.js` nuevo, Playwright `tests/ficha-pedido.browser.js`) + laboratorio `C:\wp-lab`.
- **Target**: navegadores modernos con Canvas 2D + IndexedDB; servidor PHP 8 sin extensiones nuevas.
- **Performance**: cap 2000 px al ingerir (factor uniforme); una subida por original y **ninguna** por composicion (la deriva el servidor, cacheada por nombre de receta); **cero peticiones durante la navegacion de la galeria**; `promover_order` solo hace `rename` del item y de cada original (sin copias ni recompresion).
- **Constraints**: compositor PHP bajo demanda (D9) con GD/WebP; sin migracion (D12); TTL de 30 dias de un item sin pagar = politica (P6 = B); el servidor decodifica imagenes solo para revalidar el cap y para componer (GD).
- **Scale**: no cambia el computo del servidor; baja el peso de `orders/` cuando una foto se usa en varios items (1 archivo + N referencias).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Principio | Estado |
|---|---|---|
| G1 | §I WooCommerce (NON-NEGOTIABLE): mockup obligatorio, sesion por item, `_pmu_pdf_slugs`, snapshot `manifest.pdfs[]` | **PASS** — el mockup sigue siendo obligatorio; cambia **cuando** se marca visto (al mostrarse, §3.5). El snapshot y el vinculo PDF<->producto no se tocan |
| G2 | §II Un dueno por dato | **PASS** — `PMU_Uploads` sigue siendo el dueno de rutas y catalogos; `PMU_Sesion` del ciclo del comprador; `Metadata` del dataset. La carpeta del cliente es un ambito del mismo dueno |
| G3 | §III Render en navegador + inyeccion server-side; PHP nunca evalua JS | **ENMIENDA APLICADA (2026-10-28)** — el texto sigue en el navegador; la **foto** la compone el servidor bajo demanda desde original + receta declarativa (datos, nunca JS). "La vista previa es el PDF" pasa a **mismo encuadre**. Ver Complexity Tracking |
| G4 | §IV Estructura PMU (`orders/{order_id}/{item_key}`) | **ENMIENDA APLICADA (2026-10-28, constitution 3.0.0)** — pasa a `orders/{cliente}/{order_id}/{item_key}` y `tmp/orders/` (staging) **desaparece**. Ver Complexity Tracking |
| G5 | §V No backward compatibility | **PASS** — sin migracion (D12): no hay items ni pedidos previos |
| G6 | Technical Constraints (PHP puro, JSON solo en `uploads/pmu/`, escritura atomica, GD con WebP) | **PASS** — GD con WebP pasa a **requisito** (verificado en el hosting 2026-10-28); sin extensiones nuevas

## Project Structure

### Documentacion (esta spec)

```
specs/035-fotos-originales-cliente/
├── spec.md        (D1-D14, §3 contrato, §3.5 visto, §5 inventario, §7 P1-P8)
├── plan.md        (este archivo)
├── research.md    (Phase 0: R1-R13)
├── data-model.md  (entidades: original, fila, manifest, receta, vista)
├── contracts/
│   └── fotos-originales.md   (receta v2, fila, carpeta del cliente, marca de visto)
├── quickstart.md  (escenarios E1-E9)
└── tasks.md       (Phase 2: /speckit-tasks, NO se crea aca)
```

### Codigo (que se toca y que no)

```
personalizador-pdf.php
├─ pedido_staging_crear()          2928  ELIMINAR + su hook woocommerce_checkout_order_processed
├─ pedido_promover()               2965  pasa customer_id; 0 = no promover + causa
├─ manifest_item()                 3050  dir_order(); sin fallback tmp/orders
├─ item_generar_pdfs()             3185  dir_order(); sin fallback tmp/orders
├─ item_regenerar()                3347  dir_order()
├─ pedidos_completados()           3291  escaneo de 3 niveles + `cliente` en la fila
├─ biblioteca_contenedores()       2047  escaneo de 3 niveles
├─ biblioteca_peso_identidades()   1951  escaneo de 3 niveles
├─ panel_ficha()                    545  publica `preview_omisible` por PDF para el orden de §3.5
├─ handle_subida()                 1784  originales a `tmp/sesion-{sid}/uploads/` + `origen: original`
└─ handle_pool_png()               1644  composiciones (sin cambios de formato)
inc/class-pmu-uploads.php
├─ dir_order()                     1073  firma ($cliente, $order_id, $crear)
├─ dir_tmp_order()                 1056  ELIMINAR
├─ ruta_order_pdf()                1091  ELIMINAR (codigo muerto)
└─ dir_sesion_uploads()            NUEVO carpeta compartida de originales de la sesion
inc/class-pmu-sesion.php
├─ staging_order()                 1191  ELIMINAR
├─ promover_order()                1211  ($order_id, $cliente, $sid, $item) + originales + manifest.cliente
├─ limpiar_ttl()                   1242  excluir `uploads/` del conteo por item
├─ guardar_subida()                 843  dedupe por sha en la carpeta de la sesion
├─ podar_subidas()                  582  ELIMINAR (`subidas/` no existe)
└─ receta_de()                     1322  v2 (v, rot, phsize, gid, ox/oy normalizados)
assets/
├─ selector-pmu.js                 1117  _params() -> receta v2 (+rot)
├─ tienda.js                        445  bloqueos.vistas por navegacion; no omisibles primero
├─ tienda.js                       1012  registrarFotos: objectURL local (no descarga del servidor)
└─ fotos-pmu.js                    NUEVO IndexedDB (cap 2000, dedupe por sha, recuperacion)
engine/
└─ Compositor.php                  NUEVO caja/salida (paridad con escalaBase/escalaSalida) + componer()
tests/
├─ receta-contrato.test.js         NUEVO receta v2 completa y validacion
├─ compositor.php                  NUEVO compositor (GD): modos, rot, fondo, transp, alfa
├─ compositor-paridad.test.js      NUEVO matriz caja/salida JS vs PHP
├─ texto_puente.php                fases `receta`, `carpeta_cliente`, `traslado`, `rutas`
└─ ficha-pedido.browser.js         galeria: orden, marca, habilitacion, recarga
NO se toca: engine/{Pdf,Detector,Metadata,PngWriter,Imagen,Overlay,Motor}.php, modules/textmuy/*,
assets/mockup-render.js (mockup -> spec 036)
```

**Structure Decision**: plugin WordPress unico (monolito PHP + JS vanilla). La feature vive en
`personalizador-pdf.php`, `inc/` y `assets/`; los datos, en `uploads/pmu/` (nunca en el plugin).

## Complexity Tracking

| Violacion | Por que es necesaria | Alternativa simple descartada |
|---|---|---|
| §IV: `orders/{cliente}/{order_id}/{item_key}` en lugar de `orders/{order_id}/{item_key}` | El negocio pide una carpeta por cliente con sus originales y la cuenta es obligatoria al comprar. Sin el nivel de cliente, la biblioteca de originales no tiene un lugar estable fuera del pedido | Un ambito hermano `clientes/{uid}/`: evita la enmienda pero duplica el arbol de datos del cliente |
| §III: la foto se compone en el SERVIDOR (bajo demanda) en lugar de subirse compuesta | Sin compositor, el comprador sube un PNG por grupo y por prueba de encuadre, y la receta queda sin uso real. Con el original ya en el servidor, el bitmap es derivado y cacheable por nombre | Seguir subiendo el bitmap: mas red, mas bytes en el pedido y la receta como dato muerto |
| §IV: `tmp/orders/` (staging) **desaparece** | El item vive en `tmp/sesion-{sid}/` hasta el pago y ahi se mueve; copiar al crear el pedido es I/O y bytes duplicados. La perdida por TTL es politica aceptada (P6 = B) | Mantener el staging: protege pedidos `on-hold` > 30 dias, pero duplica el arbol y contradice la decision del negocio |

**Severidad de la enmienda**: **MAJOR**, **APLICADA el 2026-10-28** (`constitution` 2.3.0 ->
**3.0.0**, con Sync Impact Report): se enmiendan dos principios (§III: compositor y "mismo encuadre";
§IV: la carpeta del cliente) y se elimina una etapa del ciclo de vida (la decision 2026-09-17, linea
64, que fija el staging). No es un cambio de datos: no hay migracion (D12).

## Fases (orden de ejecucion)

| Fase | Contenido | Depende de | Puerta |
|---|---|---|---|
| **F0** | Receta v2 (`receta_de` + `_params` + validacion, con `ox/oy`) | — | `node tests/receta-contrato.test.js` + `texto_puente.php receta` |
| **F0.5** | Compositor (`engine/Compositor.php`): `caja`/`salida` + `componer` (GD) | F0 | `php tests/compositor.php` + `node tests/compositor-paridad.test.js` |
| **F1** | Original en el navegador (`assets/fotos-pmu.js`, cap 2000, IndexedDB) + **subida en segundo plano** al elegir la foto (cola + dedupe por sha) | F0 | `node tests/fotos-contrato.test.js` (nuevo) + navegador |
| **F2** | Carpeta de sesion compartida (`tmp/sesion-{sid}/uploads/`) + `origen: original` + pool `img/foto-` + poda/TTL | F1 | `texto_puente.php carpeta_cliente` + `sin_lectura` |
| **F3** | Refactor de rutas (`orders/{cliente}/{order_id}/`), `manifest.cliente`, traslado al pagar, sin staging | F2 | `texto_puente.php rutas|traslado` + `ficha-pedido.browser.js` |
| **F4** | Marca de "visto" por navegacion (§3.5) | — (ortogonal) | `ficha-pedido.browser.js` |
| **F5** | Docs: `constitution` §IV, `AGENTS.md` §2/§5/§7, 030 (supersesion), INDICE, version | F3 | `php -l` + inventarios |

F4 es ortogonal: se puede adelantar a F1 si conviene cerrar la UX antes.

## Riesgos y mitigaciones

| # | Riesgo | Mitigacion |
|---|---|---|
| R1 | El refactor de rutas toca 20 puntos (Pedidos, descargas, regenerar, biblioteca) | Fase propia (F3), commit aislado, puertas `rutas`/`traslado`, `customer_id` congelado en el manifest |
| R2 | El `ref` de la 030 asume la misma profundidad antes y despues de promover | Las fotos del cliente usan **solo `id`** (sin `ref`) y se resuelven por cadena; `ref` queda solo para `origen: ref` entre pedidos |
| R3 | IndexedDB desalojado o modo privado: no hay original en el navegador | **Mitigado por la subida en segundo plano** (el servidor ya lo tiene). Si aun falta, el add-to-cart bloquea con causa accionable ("volve a elegir la foto") |
| R4 | `limpiar_ttl()` borra `tmp/sesion-{sid}/uploads/` como si fuera un item | Excluirla del conteo (como `draft-`) y podar por sesion; puerta en `texto_puente.php carpeta_cliente` |
| R5 | Pedido `on-hold` pagado despues de 30 dias pierde la personalizacion | Aceptado (P6 = B); Pedidos muestra `motor:descarga:item:ausente` |
| R6 | Pedido con `customer_id = 0` | No se promueve; causa visible (P7) |
| R7 | Doble escritura de la fila al promover (item + originales) | `promover_order` idempotente: si el destino existe, no repite; el manifest se escribe **una** vez |
| R8 | Varias subidas en vuelo (5 fotos) al pulsar add-to-cart | Cola FIFO de a 2 con `sha` como clave; el add-to-cart espera la cola y muestra el aviso solo si queda algo pendiente; 2 reintentos con backoff |
| R9 | `orders/{cliente}/uploads/` crece sin techo (sin cuota en esta entrega) | Medicion continua (smoke "peso por identidad" + `estado_pmu`); el limite se fija con datos (030 P2). El cap de 2000 px acota el peso por archivo |
| R10 | Divergencia JS<->PHP en la caja de dibujo | `tests/compositor-paridad.test.js`: matriz de casos con tolerancia +-1 px; `escalaBase`/`escalaSalida` son la referencia |
| R11 | Sin GD o sin WebP en el hosting -> no hay fotos | Verificado en el hosting (2026-10-28); el smoke lo chequea y falla visible con `motor:compositor:gd` |
| R12 | `imagewebp` pierde el alfa | `tests/compositor.php` cubre `transp:'si'` y fondo transparente (alfa en toda la imagen) |
| R13 | El comprador espera la composicion | Se compone en la **descarga** (post-pago), no en la ficha: no bloquea la venta. El cache por nombre evita recomponer |

## Gates (definicion de terminado del plan)

- [ ] `php -l` en `personalizador-pdf.php`, `inc/`, `engine/` (sin errores)
- [ ] `node tests/receta-contrato.test.js` (NUEVO) en verde
- [ ] `php tests/compositor.php` + `node tests/compositor-paridad.test.js` (NUEVOS) en verde
- [ ] `php tests/texto_puente.php receta|carpeta_cliente|traslado|rutas` en verde
- [ ] `php tests/motor_smoke.php` + `php tests/parity.php` en verde (el Motor no cambia)
- [ ] `php tests/sin_lectura.php` + `php tests/estado_pmu.php` en verde
- [ ] `node tests/ficha-pedido.browser.js` en verde (galeria + traslado + descarga)
- `constitution` §III **y** §IV **y** la decision 2026-09-17 (ciclo de vida unico) enmendadas, con
  Sync Impact Report y version **3.0.0** (MAJOR) — **APLICADO el 2026-10-28**

## Re-check post-design (Phase 1)

| Gate | Re-evaluacion | Estado |
|---|---|---|
| G1 §I | El contrato C6 (visto por navegacion) no cambia el snapshot ni el vinculo PDF<->producto | **PASS** |
| G2 §II | `datos.json` lo escribe `PMU_Uploads` via `mutar_manifest_dir`; no hay segundo escritor | **PASS** |
| G3 §III | La enmienda esta aplicada (2026-10-28): el compositor produce el archivo que el Motor ya sabe inyectar; PHP valida la receta sin evaluar JS | **ENMIENDA APLICADA** |
| G4 §IV | La enmienda esta **aplicada** (`constitution` 3.0.0, 2026-10-28) | **ENMIENDA APLICADA** |
| G5 §V | C7.4: sin migracion | **PASS** |
| G6 | GD con WebP es **requisito** y esta verificado en el hosting (2026-10-28) | **PASS** |

**Conclusion**: el diseno no agrega violaciones nuevas. La unica (G4) es una decision del negocio
(`orders/{cliente}/{order_id}/` + sin staging) y esta justificada. Se puede pasar a `/speckit-tasks`.
