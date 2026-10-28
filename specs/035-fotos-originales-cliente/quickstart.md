# Quickstart — validar la 035 (fotos originales y carpeta del cliente)

> Guia de **validacion**, no de implementacion. Cada escenario dice que correr y que debe salir.
> Los contratos estan en [contracts/fotos-originales.md](./contracts/fotos-originales.md) y las
> entidades en [data-model.md](./data-model.md).

## Prerequisitos

- Repo en `c:\Users\Jonatan\Documents\GitHub\personalizador-pdf`, PowerShell 7 (`pwsh`).
- PHP en PATH (`php -v`), Node en PATH (`node -v`).
- Para E7: Chrome + Playwright en `%TEMP%` y el laboratorio `C:\wp-lab` (ver `docs/entorno-desarrollo.md` §9).
- `uploads/pmu/pdfs/muestra/` con su dataset (datos de usuario, no versionados).

## E1 — Receta v2: 90 y 270 no colisionan

```powershell
node tests/receta-contrato.test.js
php tests/texto_puente.php receta
```

**Esperado**: `RECETA CONTRATO OK` y la fase `receta` en verde. Los vectores 90 y 270 dan **hash
distinto**; la misma composicion por dos caminos da el **mismo** hash; `v:1` se recomputa.

## E2 — Un original, una vez (dedupe por sha)

```powershell
php tests/texto_puente.php carpeta_cliente
```

**Esperado**: al elegir la foto, el original se encola en segundo plano y aparece en
`tmp/sesion-{sid}/uploads/`; dos subidas de los mismos bytes dejan **un** archivo y **una** fila con
`origen: original`; el `id` es `sha12`; una foto de 2500 px se acota a 2000 (o se rechaza con
`motor:subida:tamano` si no hay GD).

## E3 — La misma foto en dos items de la sesion

```powershell
php tests/texto_puente.php carpeta_cliente
```

**Esperado**: 2 items referencian el **mismo** `{id}.webp` (1 archivo, 2 filas). `podar_subidas` no
borra el original mientras algun item lo use.

## E4 — Traslado al pagar (sin staging)

```powershell
php tests/texto_puente.php traslado
```

**Esperado**: al promover, el item queda en `orders/{cliente}/{order_id}/{item_key}/`; los
originales en `orders/{cliente}/uploads/{id}.webp` (rename); **las filas no cambian**
(`origen: original` + `id`); `manifest.cliente` escrito **una** vez; `tmp/orders/` **no** existe;
re-promover es no-op.

## E5 — La descarga no depende del original

```powershell
php tests/texto_puente.php traslado
php tests/motor_smoke.php
```

**Esperado**: con el original borrado, `item_generar_pdfs()` arma el PDF desde
`manifest.archivos[]` (composiciones) y devuelve la ruta; `SMOKE OK`.

## E6 — Refactor de rutas: Pedidos, descargas y regenerar

```powershell
php tests/texto_puente.php rutas
php tests/sin_lectura.php
php tests/estado_pmu.php
```

**Esperado**: `pedidos_completados()` lista `orders/{cliente}/{order_id}/{item}` (3 niveles) y **no**
lista `orders/{cliente}/uploads/`; la descarga y la regeneracion encuentran el item; leer la galeria
no escribe catalogos (`SIN_LECTURA OK`); el estado del espejo corre sin error.

## E7 — Galeria: orden, marca y habilitacion (navegador real)

```powershell
$env:NODE_PATH = "$env:TEMP\pmu-pw\node_modules"
$env:TEXTMUY_CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
pwsh C:\wp-lab\arrancar.ps1     # si el lab esta apagado
node tests/ficha-pedido.browser.js
```

**Esperado**: las vistas **no omisibles** van primero con el aviso "Revisa la vista previa"; el boton
sigue deshabilitado hasta ver la **ultima obligatoria**; recargar conserva la marca
(`localStorage`); una vista fallida no bloquea; el add-to-cart sube original + composicion; con la
cola de subidas vacia **no** muestra "Estamos recibiendo tus archivos", y con pendientes si.

## E8 — Pedido sin `customer_id`

**Antes**: confirmar en Woo que el checkout **exige cuenta** (sin checkout de invitado). Si no,
todo pedido nace con `customer_id = 0` y no se promueve.

```powershell
php tests/texto_puente.php traslado
```

**Esperado**: un pedido con `customer_id = 0` **no** se promueve y deja causa visible
(`motor:sesion:promocion:sin:cliente`); no se crea `orders/0/`.

## E9 — TTL de 30 dias y carpeta compartida

```powershell
php tests/texto_puente.php carpeta_cliente
```

**Esperado**: `limpiar_ttl()` **no** cuenta `tmp/sesion-{sid}/uploads/` como item; con items vivos
no borra los originales; sin items, borra la sesion entera (y los originales con ella).

## Puertas completas (antes de cerrar la spec)

```powershell
php -l personalizador-pdf.php
Get-ChildItem admin, engine, inc -Filter *.php | ForEach-Object { php -l $_.FullName }
node tests/receta-contrato.test.js
php tests/texto_puente.php receta
php tests/texto_puente.php carpeta_cliente
php tests/texto_puente.php traslado
php tests/texto_puente.php rutas
php tests/motor_smoke.php
php tests/parity.php
php tests/sin_lectura.php
php tests/estado_pmu.php
node tests/ficha-pedido.browser.js
```

**Esperado**: todo en verde y `git status` limpio. Si algo falla, la causa esta en el mensaje
(`motor:*` / `api:biblioteca:*`): no se inventa un fallback silencioso.
