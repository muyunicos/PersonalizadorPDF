# Entorno de desarrollo — Personalizador PDF

> Jerarquía documental: `.specify/memory/constitution.md` > `AGENTS.md` > resto.
> Este documento operativiza `AGENTS.md` §8–§10 para el entorno real de trabajo.
> Verificado el 2026-10-03.

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
