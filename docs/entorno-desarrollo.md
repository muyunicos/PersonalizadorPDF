# Entorno de desarrollo — Personalizador PDF

> Jerarquía documental: `.specify/memory/constitution.md` > `AGENTS.md` > resto.
> Este documento operativiza `AGENTS.md` §8–§10 para el entorno real de trabajo.
> Verificado el 2026-10-03. **Laboratorio local (`C:\wp-lab`) documentado el 2026-10-24: ver §9.**

## 1. Plataforma y shell

- **Windows** con **PowerShell 7 (`pwsh`)** como shell activo, **VS Code** y la extensión
  **Cline** como agente.
- No se asume Bash, WSL, `cmd` ni Windows PowerShell 5.1 en ningún paso.
- Todos los comandos se ejecutan desde la **raíz del proyecto** (esta carpeta, que es la
  carpeta del plugin en WordPress), salvo los tests del módulo TextMuy, que exigen
  `modules/textmuy/` como directorio actual.
- `modules/textmuy/` es el **repositorio propio del módulo** (`muyunicos/textmuy`, el
  original; no un clon): se edita directamente, pero sus commits y push van EN ESE repo
  (el plugin solo registra el commit del módulo).

### Comprobación del shell

```powershell
$PSVersionTable.PSVersion
(Get-Process -Id $PID).Path
```

Esperado: `7.x` y una ruta terminada en `pwsh.exe`.

## 2. Herramientas requeridas

| Herramienta | Verificación | Uso | Versión verificada (2026-10-03) |
|---|---|---|---|
| PowerShell 7 | `$PSVersionTable.PSVersion` | Shell de VS Code/Cline y de los scripts Spec Kit (`ps`). | 7.6.6 |
| VS Code | `code --version` | IDE; su terminal integrada la usa Cline. | 1.140.0 |
| Cline | `code --list-extensions --show-versions` | Agente (modos Plan/Act). | `saoudrizwan.claude-dev@4.1.22` |
| `uv` | `uv --version` / `uv tool list` | Gestor con el que está instalado `specify-cli`. | 0.12.3 |
| `specify` | `specify version` | Flujo SDD (specify → plan → tasks → implement). | 1.1.0 |
| Node.js | `node --version` | Solo tests del módulo TextMuy; nunca en el servidor. | 22.20.0 |
| PHP | `php -v` | Motor y tests `tests/*.php`. | 8.5.9 |
| Git | `git --version` | Versionado; el deploy lo dispara el push (webhooks Hostinger). | 2.48.1 |

Las versiones son un **snapshot** del 2026-10-03: la fuente de verdad es el comando de la
columna *Verificación*.

Comprobación conjunta:

```powershell
Get-Command pwsh, specify, uv, node, php, git | Select-Object Name, Source
specify check
```

## 3. Spec Kit (SDD) en este repositorio

- Integración **predeterminada y única**: `cline`.
- Scripts generados para PowerShell (`--script ps`): `.specify/scripts/powershell/*.ps1`.
  Los workflows (`/speckit-*`) los ejecutan **desde la raíz del repo**. El juego
  `.specify/scripts/bash/*.sh` también existe pero **no se usa**.
- Estado actual (2026-10-03):
  - `.specify/init-options.json` → `ai=cline`, `integration=cline`, `script=ps`, `speckit_version=1.1.0`.
  - `.specify/integration.json` → `integration=cline`, `default_integration=cline`,
    `integration_settings.cline` → `script=ps`, `invoke_separator="-"`.
  - `specify integration status` → `Integration status: OK`, `Default integration: cline`,
    `Installed integrations: cline`, `Multi-install safe: yes`, `Shared templates target
    alignment: cline`, `Modified managed files: 0`, `Missing managed files: 0`,
    `Invalid manifest paths: 0`, `Unchecked manifests: 0`.
  - `specify check` → `Specify CLI is ready to use!` (Cline figura como *IDE-based, no CLI
    check*; VS Code como disponible).
  - Los hashes gestionados viven en `.specify/integrations/*.manifest.json`;
    `specify integration status` los contrasta contra el disco.
  - El módulo (`modules/textmuy/`) tiene su propio Spec Kit (misma integración `cline` +
    `ps`); allí `.specify/` y `.clinerules/` **sí están versionados** y su estado también es OK.
- **`.specify/` y `.clinerules/` están en `.gitignore`** (tooling local, no versionado):
  sus cambios **no** aparecen en `git status` ni en `git diff`. La verificación real es
  `specify integration status` (campos *Modified managed files* / *Missing managed files*).
- No editar a mano `.clinerules/workflows/*` ni `.specify/scripts/*`: son archivos
  gestionados por el CLI (un cambio local hace que `upgrade` los bloquee).
- Actualizar/regenerar la integración (diff-aware):

```powershell
specify integration status                      # antes: debe dar OK
specify integration upgrade cline --script ps   # --force solo si el cambio local es deliberado
specify integration status                      # después: 0 modificados / 0 faltantes
```

- Actualizaciones del CLI: `specify self check`.

## 4. Terminal de VS Code y Cline

- `.vscode/settings.json` (versionado) fija
  `terminal.integrated.defaultProfile.windows: "PowerShell"`: VS Code resuelve ese perfil a
  **`pwsh` cuando PowerShell 6+ está instalado** (con 6+ presente, Windows PowerShell no se
  lista por defecto), por lo que la terminal integrada queda en PowerShell 7 en este equipo.
- **Cline hereda esa terminal**: su ajuste *Default Terminal Profile* (Cline → Settings →
  Terminal) en valor `Default` no impone un shell propio y usa el perfil por defecto de VS
  Code; opcionalmente se puede fijar ahí mismo el perfil sin tocar VS Code. Verificado el
  2026-10-03: los comandos de la sesión de Cline corren en `pwsh` 7.6.6.
- Si Cline reporta *Shell Integration Unavailable*: reabrir la terminal o reiniciar VS Code;
  si persiste en Windows con PowerShell, revisar la política de ejecución
  (`Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser`, como
  administrador) y abrir una terminal nueva.
- Verificación efectiva (en la terminal integrada y en cualquier sesión de Cline):

```powershell
$PSVersionTable.PSVersion      # 7.x
(Get-Process -Id $PID).Path    # ...\pwsh.exe
Get-Location                   # raíz del proyecto
```

## 5. Diagnóstico ante fallos (orden obligatorio)

Antes de diagnosticar o cambiar el entorno:

1. **Shell activo**: `$PSVersionTable.PSVersion` (7.x) y `(Get-Process -Id $PID).Path` (`pwsh.exe`).
2. **Directorio actual**: `Get-Location` (debe ser la raíz del proyecto).
3. **PATH y herramientas**: `Get-Command pwsh, specify, uv, node, php, git` y `specify check`.
4. Recién entonces, diagnosticar el comando puntual (leyendo el error real).

No cambiar perfiles, PATH ni versiones sin evidencia de los pasos 1–3.

## 6. Límites (sin aprobación explícita del usuario)

- No modificar **bases de datos**, **credenciales** ni **servicios externos**.
- No **desplegar a producción**: el deploy es el botón *Implementar* de Hostinger (webhooks
  declarados en `AGENTS.md` §2); antes de hacer `push` a los repos conectados, confirmar.
- No ejecutar comandos destructivos (borrados masivos, migraciones, instalaciones) sin
  pedirlo antes.

## 7. Referencias

- `AGENTS.md` §8–§10 (canónico técnico) y `.specify/memory/constitution.md` (jerarquía).
- VS Code — *Terminal Profiles*: https://code.visualstudio.com/docs/terminal/profiles

## 8. Cómo editar código en este repo sin romperlo

Añadido 2026-10-03 tras una sesión en la que se rompieron 8 ficheros. La causa **no
fue el shell**: fue escribir ficheros con scripts de shell dentro de PowerShell.

### Reglas

- **Editar con la herramienta de edición** (diff exacto). Es lo único que no sufre
  escapado de shell.
- **Nunca** escribir ficheros del repo con heredocs de bash, `Set-Content` sobre un
  fichero existente, ni scripts de Node/PowerShell que reescriban el fichero entero.
- Cambios grandes: pasos pequeños, con `php -l` / `node --check` **después de cada
  paso**.
- La terminal sirve para **leer, buscar y verificar**, no para escribir código.
- Si algo se rompe: `git checkout -- <fichero>` y rehacerlo con el editor.

### Por qué bash no es una opción aquí

`bash.exe` del equipo (Git Bash) **falla**: avisa `could not find /tmp`. La
terminal de VS Code y de Cline está fijada a **PowerShell** (`.vscode/settings.json`)
y los scripts de Spec Kit se generan para `ps`. Usar sintaxis de bash aquí produce
scripts que fallan de formas distintas en cada intento.

### Equivalencias (lo único que hace falta recordar)

| En vez de | Usar |
|---|---|
| `grep -r` | `Select-String -Path <ficheros> -Pattern '<texto>'` |
| `find . -name` | `Get-ChildItem -Recurse -Include <ext>` |
| `ls` | `Get-ChildItem` |
| `cat f` | `Get-Content f` |
| `/tmp/x` | `$env:TEMP\x` |
| `cmd1 && cmd2` | `cmd1; cmd2` (o `&&`, que sí funciona en pwsh 7) |

## 9. Laboratorio local de WordPress (`C:\wp-lab`)

> **Alcance**: entorno **de esta máquina** (rutas absolutas), no normativa del repo. La regla que sí
> es normativa: *los recorridos de aceptación se corren **scripteados** contra este laboratorio,
> con evidencia y capturas; el hosting productivo solo confirma el deploy.*

### 9.1 Qué es y para qué sirve

WordPress + WooCommerce **reales** en local, con el plugin montado por **junction** al checkout
(`wp-content/plugins/personalizador-pdf` → `C:\Users\Jonatan\Documents\GitHub\personalizador-pdf`)
y el tema del sitio real (`generatepress-child` → `C:\Users\Jonatan\Documents\GitHub\muyunicos`,
también por junction). Sirve para:

- Correr los recorridos de aceptación (specs 004/009/012/014/017/022/029/030) **sin deploy**.
- Reproducir bugs con el **puente real** del plugin (iframe del editor, `PMU_FICHA`, admin-ajax).
- Medir red, archivos en disco y geometría, y dejar capturas + JSON como evidencia.

**No** reemplaza al hosting: los emails no se pueden probar (no hay mailer) y los datos de
`uploads/pmu` del lab son **una copia propia**, no el espejo de despliegue.

### 9.2 Arranque y parada

```powershell
# Base (MariaDB portable, 127.0.0.1:3306)
Start-Process 'C:\wp-lab\mariadb\mariadb-11.8.9-winx64\bin\mariadbd.exe' `
  -ArgumentList @('--datadir=C:\wp-lab\mariadb-data','--port=3306','--console') `
  -RedirectStandardOutput 'C:\wp-lab\mariadb.out.log' -RedirectStandardError 'C:\wp-lab\mariadb.err.log' -WindowStyle Hidden

# Web (PHP embebido, 8091). OJO: -d sube los limites de subida (el php.ini del equipo trae 2M/8M)
Start-Process 'C:\Users\Jonatan\php\php.exe' `
  -ArgumentList @('-d','upload_max_filesize=64M','-d','post_max_size=64M','-d','memory_limit=512M',
                  '-S','localhost:8091','-t','C:\wp-lab\wordpress','C:\wp-lab\wordpress\router.php') `
  -WorkingDirectory 'C:\wp-lab\wordpress' -RedirectStandardOutput 'C:\wp-lab\srv-lab.out.log' -RedirectStandardError 'C:\wp-lab\srv-lab.err.log' -WindowStyle Hidden

# Parada: Get-Process php,mariadbd | Stop-Process -Force
```

- Panel: `http://localhost:8091/wp-admin/admin.php?page=personalizador-pdf&tab=textos`
- Credenciales: **`lab` / `labpass123`** (usuario `lab`, id 1).
- Log: `C:\wp-lab\wordpress\wp-content\debug.log` (`WP_DEBUG`+`WP_DEBUG_LOG` activos).
- Si el front muestra la portada en vez de la ficha, faltan rewrite rules: `php C:\wp-lab\wordpress\flush.php`.

### 9.3 Estructura del laboratorio

| Ruta | Qué es |
|---|---|
| `C:\wp-lab\wordpress\` | WP core + `wp-config.php` (MariaDB) + `router.php` (URLs limpias para `php -S`) |
| `…\wp-content\plugins\personalizador-pdf` | **Junction** al repo del plugin |
| `…\wp-content\themes\generatepress-child` | **Junction** al repo del tema (`muyunicos`, padre `generatepress`) |
| `…\wp-content\uploads\pmu\` | Datos propios del lab (`fonts`, `tm-presets`, `pdfs/{circulo6cm,sincampos}`, `campos` 1-2, `tmp`, `orders`) |
| `C:\wp-lab\mariadb\` + `C:\wp-lab\mariadb-data\` | MariaDB 11.8.9 portable + datadir (`my.ini` generado por `mariadb-install-db`) |
| `C:\wp-lab\*.cjs`, `probe*.cjs` | Recorridos y probes (§9.5) |
| Raíz de WP | Helpers: `install.php`, `activate.php`, `plug.php`, `tema.php`, `config-lab.php`, `seed-lab.php`, `preset-lab.php`, `flush.php`, `refrescar-campo.php`, `diag-ficha.php`, `diag-carrito.php` |
| `C:\wp-lab\capturas\` | Capturas + JSON de resultados |
| `C:\wp-lab\{wp.zip, sqlite.zip, pmu-backup-*.zip, mariadb-*.zip, woocommerce.zip, generatepress.zip}` | Insumos para recrear |
| `C:\wp-lab\_backup-sqlite\` | Backup del modo SQLite anterior (`lab.sqlite` + `db.php` + `wp-config.php`) |

### 9.4 Recreación desde cero (si se pierde la máquina)

1. WP core en `C:\wp-lab\wordpress` (de `wp.zip` o descarga oficial) + `router.php`.
2. **MariaDB portable**: descomprimir en `C:\wp-lab\mariadb`;
   `mariadb-install-db.exe --datadir=C:\wp-lab\mariadb-data --port=3306`; arrancar y crear
   `wordpress` + usuario `lab`/`labpass123`.
   *(Alternativa histórica: SQLite con `sqlite-database-integration` + `db.php` — respaldo en
   `_backup-sqlite`; **Woo necesita MySQL real**.)*
3. `wp-config.php` con `DB_HOST='127.0.0.1:3306'`, `DB_NAME=wordpress`, `DB_USER=lab`, salts propias,
   `WP_DEBUG`+log.
4. `php install.php` (alta no interactiva) y `php activate.php` (activa el plugin).
5. Junction del plugin; **GeneratePress** (padre) desde wp.org + junction del child `muyunicos`;
   `php tema.php` (activa el child y verifica `mu_update_item_files`).
6. `php plug.php woocommerce` → `php config-lab.php` (ARS, AR:B, **COD**, envío gratis, **HPOS legacy**)
   → `php seed-lab.php` (productos con `_pmu_pdf_slugs`, páginas de carrito/checkout **clásicas**)
   → `php flush.php`.
7. Datos: descomprimir `pmu-backup-*.zip` en `wp-content/uploads/` (o sembrar `fonts/` y `tm-presets/`).

### 9.5 Recorridos y probes (scripteados con Chrome + Playwright)

Playwright **no se instala en el repo** (no hay `node_modules` versionado): se usa uno en `%TEMP%`.

```powershell
# Una sola vez:
$env:PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD='1'; npm i --prefix "$env:TEMP\pmu-pw" playwright

# Cada corrida:
$env:NODE_PATH = "$env:TEMP\pmu-pw\node_modules"
$env:TEXTMUY_CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
node C:\wp-lab\recorrido-009.cjs             # galerias y hojas de la spec 009
node C:\wp-lab\recorrido-ficha-pedido.cjs    # ficha -> foto -> vista previa -> carrito -> checkout -> descargas
node C:\wp-lab\probe-ficha.cjs               # volcado del DOM de la ficha (diagnostico)
node C:\wp-lab\probe-modal.cjs               # volcado del modal del cargador
```

**Estado de los recorridos (2026-10-24)**

- `recorrido-009.cjs`: **33/33 OK** (SC-001/002/003/004/005/006/007/009 + FR-009). Evidencia:
  `capturas/e*.png` y `capturas/recorrido-009.json`.
- `recorrido-ficha-pedido.cjs`: **29/29 OK** (2026-10-24). Ciclo completo: ficha con panel y formulario,
  `PMU_FICHA` (2 PDFs / 2 campos), campos montados, **cargador subiendo la foto** (queda `.webp` en
  `subidas/`, spec 026), **mínimo de fotos bloqueando el carrito** con su aviso (spec 022), **Vista
  previa** (`admin-ajax`) con la **galería 300x300 y el canvas del mockup** (spec 011), **pool `img/`**
  (spec 029) y **`mockup-{id}.webp` congelado** al agregar (spec 004), carrito con la personalización,
  checkout con COD y el resumen, **pedido creado** (`order-received/22`) y **`orders/{id}/{item}/`** con
  `manifest.json` + `subidas/` + `img/` + **`{pdf}_procesado.pdf` (119 KB)** al descargar.
  **Investigación de la galería del mockup (a pedido)**: **no era un defecto del plugin** —el motor daba
  la causa exacta y desbloquear la venta mostrando "No hay vista previa disponible" es la conducta
  documentada en T021—, era **dato viejo del lab**: sus presets son **v1** y el módulo exige **v2**
  (`presets:neon-glow:formato:version (archivo v1, se esperaba v2)`); sin ese render no hay PNG, ni
  canvas, ni mockup. Se resolvió con `php preset-lab.php lab-v2 circulo6cm 0000FF` (escribe el `.txm`
  v2, lo da de alta en el catálogo y repunta el hueco del PDF).

**Lecciones que costaron tiempo** (aplican a cualquier recorrido nuevo):

1. **`blog_public = 0` tapa todo el front**: un sitio "privado" dispara la pantalla **"Coming soon"**
   (landing de Woo con sus `patterns`) y la ficha no renderiza. El lab queda con `blog_public = 1`.
2. **Modal de país del tema**: intercepta los clics. Se desactiva con las cookies
   `muyu_geo_country=AR` **y** `muyu_stay_here=localhost` (o cerrando `#muyu-country-close`).
   Ojo: el modal **reaparece** si sólo se lo cierra a mano.
3. **Medir sin el ruido de la carga**: asentar la página (~2,5 s) y **limpiar el espía después**;
   si no, se miden descargas propias de la página (p. ej. la fuente del `index.html` del editor).
4. **Cachés del cliente por escenario**: al cambiar de escenario hay que invalidar
   `invalidarCatalogo` / `invalidarSpriteCanonico` / `invalidarDibujados`, o el núcleo no regenera
   (firma vieja memoizada).
5. **El iframe del editor se recrea**: re-adquirir el frame en cada escenario (si no, "Frame was
   detached").
6. **La vista previa y el carrito van por `admin-ajax.php`** (no `admin-post.php`): el espía debe
   mirar **ambos** y leer `action` del cuerpo o de la URL.
7. **Windows**: no hay `chmod -w`; para simular un directorio no escribible se usa `attrib +R <archivo>`
   (verificado: hace fallar el `rename` del motor con "Acceso denegado").
8. **Higiene de datos**: backup antes de un escenario que muta (`fonts.json` → `.bak-e1`), reset
   reproducible al empezar y **restaurar el lab** al terminar (el recorrido de la 009 ya lo hace solo).
9. **Plantillas de campo viejas**: un campo del lab creado antes de un cambio de plantilla usa nombres
   que ya no existen (p. ej. `PMUCargador`); se refresca con `php refrescar-campo.php <id> <tipo>`
   (equivale al botón "Cargar la plantilla de este tipo" del drawer).
10. **El push dispara deploy** (webhooks de Hostinger): el lab **no** lo necesita.
11. **El tema restringe los productos FÍSICOS** en hosts restringidos ("we only sell digital products
    here"): los productos de prueba del lab deben ser **virtuales + descargables** (`seed-lab.php` ya
    lo hace). Con el carrito en ese estado, el aviso del tema es "Productos no disponibles".
12. **COD y pedidos virtuales**: `woocommerce_cod_settings['enable_for_virtual'] = 'yes'`, si no no
    aparece ningún medio de pago y `#place_order` no hace nada (`config-lab.php` ya lo setea).
13. **El checkout del tema tiene 2 pasos**: primero "¿Cómo quieres continuar?" → **"Continuar como
    invitado"**, y recién después los campos. El nombre va en **`#billing_full_name`** ("Nombre y
    Apellido"); `#billing_first_name/_last_name` existen pero no se usan.
14. **Email único por corrida** en el checkout (`comprador-lab+<timestamp>@…`): la primera compra
    **registra la cuenta** y la siguiente falla con "An account is already registered…".
15. **`?add-to-cart=ID` por GET no agrega** en este entorno (el carrito queda vacío) y `/?p=ID` no
    renderiza la ficha: usar el **permalink** del producto y el **botón** de la ficha.
16. **El `_procesado.pdf` se genera al descargar**, no al pagar: el pagó deja el pedido en `orders/`
    con `manifest.json` + `subidas/` + `img/`, y el PDF aparece cuando el comprador baja su archivo.
17. **Los presets del dataset viejo son v1 y el módulo exige v2** (`presets:<nombre>:formato:version`):
    sin eso **no se renderiza el hueco**, la vista queda sin canvas y la ficha muestra "No hay vista
    previa disponible" + desbloquea el carrito (conducta documentada: T021, la venta no se bloquea).
    Se siembra un preset v2 con **`php preset-lab.php lab-v2 circulo6cm 0000FF`** (crea el `.txm` v2,
    lo da de alta en el catálogo y repunta el hueco del PDF). Spec 020: no hay migración, se regenera.
18. **Para diagnosticar la ficha conviene mirar la consola**: el motor informa la causa exacta por
    `console.warn`/`console.error` (el recorrido la captura sólo si filtra `type() === 'error'`; contar
    *todos* los logs marca falsos negativos con JQMIGRATE y los avisos del tema).
