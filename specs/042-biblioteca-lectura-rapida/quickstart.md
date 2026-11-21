# Quickstart: validar la lectura rapida de la biblioteca

**Fecha**: 2026-11-19 | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) |
**Contratos**: [media.md](./contracts/media.md), [cliente-biblioteca-rapida.md](./contracts/cliente-biblioteca-rapida.md)

## Prerrequisitos

- PHP 7.4+ con GD + WebP; PowerShell 7; desde la raiz del repo.
- Laboratorio local `C:\wp-lab` (WP + Woo) con el plugin por junction, si se corre la puerta de navegador.
- Una ficha con panel, un comprador con 10 fotos y un item de carrito con 6 fotos de ranura
  (`origen: original`) para la re-edicion.
- El hosting respeta `.htaccess` (Hostinger/LiteSpeed); en produccion, HTTPS.
- Playwright fuera del repo: `$env:NODE_PATH = "$env:TEMP\pmu-pw\node_modules"` y
  `$env:TEXTMUY_CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'`.

## 1. Lint

```powershell
php -l personalizador-pdf.php
php -l media.php
Get-ChildItem admin, engine, inc -Filter *.php | ForEach-Object { php -l $_.FullName }
node --check assets/biblioteca-pmu.js
node --check assets/tienda.js
node --check assets/cargador-pmu.js
node --check assets/selector-pmu.js
```

Esperado: `No syntax errors detected` en cada archivo.

## 2. Puertas CLI (sin WordPress)

```powershell
php tests/media_lectura.php                 # nuevo: listar, revision, thumb_data, guards, HMAC (304: §7)
php tests/catalogo_uploads.php              # paridad del lector con PMU_Uploads
php tests/sin_lectura.php                   # el endpoint no escribe catalogos
```

La cobertura HTTP del endpoint (304/cookies/503/403/404) se agrega en T023/T048; §7 la verifica
manualmente mientras tanto.

Esperado:

- `MEDIA LECTURA OK (N checks)`.
- `CATALOGO UPLOADS OK`.
- `SIN_LECTURA OK`.

## 3. Puertas PHP con WordPress (arnes)

```powershell
php tests/texto_puente.php biblioteca       # listar/imagen/miniatura/borrar + identidad/revision/thumb_data
php tests/texto_puente.php ficha            # PMU_FICHA.biblioteca.rapido/revision/identidad y urls de ranura
php tests/texto_puente.php red_carga        # la ficha no pide la biblioteca al cargar
php tests/motor_smoke.php                   # el Motor no se toca
php tests/parity.php                        # el Motor no se toca
```

Esperado: cada fase termina en `OK` y `SMOKE OK`/`PARIDAD OK`.

## 4. Contrato del cliente (Node)

```powershell
node tests/biblioteca-contrato.test.js      # cache v3, thumb_data, revision/identidad, fast/fallback
```

Esperado: `BIBLIOTECA CONTRATO OK (N checks)`.

## 5. Puerta de navegador en el laboratorio

```powershell
if (-not (Test-NetConnection localhost -Port 8091 -InformationLevel Quiet)) { pwsh C:\wp-lab\arrancar.ps1 }
$env:NODE_PATH = "$env:TEMP\pmu-pw\node_modules"
$env:TEXTMUY_CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
node tests/ficha-pedido.browser.js
```

Esperado (ademas de los checks actuales):

1. Primera apertura: **1** `media.php?op=listar`; **0** lecturas por `admin-post`; **0** `op=miniatura`.
2. La tira se pinta con las miniaturas embebidas; la lista de 10 no supera 60 KB.
3. Cerrar y reabrir dentro de 5 min sin cambios: **0** solicitudes y <100 ms; despues de 5 min, 1 revalidacion liviana.
4. Abortar `media.php` con Playwright: la galeria sigue funcionando por `admin-post` (fallback).
5. Re-editar el item con 6 fotos `origen: original`: **0** `personalizador_pdf_subida_url`; las fotos
   cargan por `media.php`; las filas no originales siguen por la URL actual.
6. Invitado y cliente: cada uno ve solo sus fotos; dos navegadores no se mezclan.

Tiempos esperados en el sitio real: `media.php` TTFB ~0,2-0,3 s (vs ~0,9-1,1 s caliente y ~4 s frio de
`admin-post`); primera apertura <1 s (p95); reapertura 0 solicitudes.

## 6. Escenarios funcionales

| Escenario | Como se prueba | Esperado |
|---|---|---|
| Config ausente | borrar `uploads/pmu/.media/config.json` y abrir | 503 + fallback; el endpoint actual recrea el config; la proxima apertura es liviana |
| `.htaccess` no escribible | quitar permisos al directorio `.media` | `rapido` no se publica; la galeria funciona por el respaldo |
| Credencial vencida/alterada | modificar `pmu_uid` en DevTools | 403 + fallback; `template_redirect`/respaldo reemite la cookie |
| Invitado -> login | subir una foto como invitado e iniciar sesion | originales migrados; identidad `u...`; copia local descartada |
| Logout | cerrar sesion | `pmu_uid` borrada; identidad de invitado/copia descartada |
| Subida | subir una foto y reabrir | catalogo y `revision` cambian; copia invalidada; la foto aparece |
| Borrado | borrar desde la galeria | `revision` cambia; copia invalidada; la foto desaparece |
| Mas de 10 fotos | biblioteca con 11+ | solo 10 miniaturas embebidas; el resto por el visor y `op=imagen` |
| Miniatura faltante | borrar `{id}-80x80.webp` y pedirla | se genera y se conserva; si no se puede, se sirve el original |
| Traversal / id invalido | `id=../...`, `id=ZZZ`, extension rara | 400/404; no se sirve ningun archivo |
| Dos identidades | dos navegadores/perfiles en la misma maquina | cada uno ve solo sus fotos; la cache no se mezcla |
| Pagina cacheada | servir la ficha cacheada a otro comprador | identidad distinta -> respaldo; no mezcla |
| Rotacion del secreto | borrar `.media/config.json` | todas las credenciales de lectura vencen; respaldo; el config se recrea |
| Clicks rapidos | abrir/cerrar la galeria varias veces | una sola peticion en vuelo; sin listados duplicados |
| Red lenta | throttling en DevTools | se pinta la copia si existe; si no, el estado de carga actual |

## 7. Verificacion de seguridad y privacidad

```powershell
# El secreto NO se sirve por URL (debe ser 403)
curl.exe -s -o NUL -w "%{http_code}\n" 'https://SITIO/wp-content/uploads/pmu/.media/config.json'

# Salud y TTFB del camino liviano (sin identidad no lista, pero responde rapido)
curl.exe -s -o NUL -w "media: %{http_code} ttfb=%{time_starttransfer}s\n" 'https://SITIO/wp-content/plugins/personalizador-pdf/media.php?op=ping'

# Comparacion con el endpoint actual (nonce invalido: mide el arranque)
curl.exe -s -o NUL -w "admin-post: %{http_code} ttfb=%{time_starttransfer}s\n" 'https://SITIO/wp-admin/admin-post.php?action=personalizador_pdf_biblioteca&op=listar'
```

Esperado:

- `.media/config.json` -> **403**; nunca 200.
- `media.php?op=ping` -> **200**, TTFB ~0,2-0,3 s.
- `admin-post` -> ~0,9-1,1 s caliente / ~4 s frio.
- En DevTools: `pmu_uid`/`pmu_sid` son `HttpOnly`, `Secure` (HTTPS) y `SameSite=Lax`; la pagina y el JS
  no contienen el secreto.
- Solo se piden `/uploads/pmu/tmp/sesion-*` u `/uploads/pmu/orders/{uid}/uploads`; nunca entregables,
  manifiestos, ideas ni PDFs.

## 8. Despliegue y verificacion en produccion

1. Commit + push: el webhook de Hostinger despliega el plugin (incluye `media.php` y las clases nuevas).
2. Abrir una ficha: WordPress crea `uploads/pmu/.media/config.json` (y su `.htaccess`).
3. `media.php?op=ping` -> 200; si da 503, revisar permisos/config; el respaldo sigue funcionando.
4. Verificar el asset: `pwsh scripts/verificar-deploy.ps1 -Url <biblioteca-pmu.js servido> -Local assets/biblioteca-pmu.js`.
5. Purga de cache + Ctrl+F5; abrir la galeria y revisar Network: **1** `media.php?op=listar`, **0**
   lecturas por `admin-post`, **0** `op=miniatura`; reabrir dentro de 5 min sin cambios: **0** solicitudes; despues de 5 min, 1 revalidacion liviana.
6. Version `4.35.0` en la cabecera, `?ver=` actualizado y changelog en `readme.txt`.

## 9. Fuera de alcance de esta guia

- Carga de la ficha, generacion de vistas previas/pool, Motor/PDF, consola del admin y cotizador.
- Miniaturas publicas/CDN.
- Migracion de datos existentes (no hay ninguna).