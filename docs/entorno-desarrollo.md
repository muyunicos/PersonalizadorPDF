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

### Comprobación del shell

```powershell
$PSVersionTable.PSVersion
(Get-Process -Id $PID).Path
```

Esperado: `7.x` y una ruta terminada en `pwsh.exe`.

## 2. Herramientas requeridas

| Herramienta | Verificación | Uso |
|---|---|---|
| PowerShell 7 | `$PSVersionTable.PSVersion` | Shell de VS Code/Cline y de los scripts Spec Kit (`ps`). |
| VS Code | `code --version` | IDE; su terminal integrada la usa Cline. |
| Cline | Extensión instalada | Agente (modos Plan/Act). |
| `uv` | `uv --version` / `uv tool list` | Gestor con el que está instalado `specify-cli`. |
| `specify` | `specify version` | Flujo SDD (specify → plan → tasks → implement). |
| Node.js | `node --version` | Solo tests del módulo TextMuy; nunca en el servidor. |
| PHP | `php -v` | Motor y tests `tests/*.php`. |
| Git | `git --version` | Versionado; el deploy lo dispara el push (webhooks Hostinger). |

Comprobación conjunta:

```powershell
Get-Command pwsh, specify, uv, node, php, git | Select-Object Name, Source
specify check
```

## 3. Spec Kit (SDD) en este repositorio

- Integración **predeterminada y única**: `cline`.
- Scripts generados para PowerShell (`--script ps`): `.specify/scripts/powershell/*.ps1`.
  Los workflows (`/speckit-*`) los ejecutan **desde la raíz del repo**.
- Estado actual (2026-10-03):
  - `.specify/init-options.json` → `ai=cline`, `integration=cline`, `script=ps`, `speckit_version=1.1.0`.
  - `.specify/integration.json` → `integration=cline`, `default_integration=cline`,
    `settings.cline.script=ps`.
  - `specify integration status` → `Integration status: OK`, `Default integration: cline`,
    `Installed integrations: cline`, `0` modificados / `0` faltantes.
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
  `terminal.integrated.defaultProfile.windows: "PowerShell"`: VS Code resuelve al perfil
  PowerShell, que usa **`pwsh` cuando PowerShell 6+ está instalado** (y Windows PowerShell
  como respaldo), por lo que la terminal integrada queda en PowerShell 7 en este equipo.
- **Cline hereda ese shell**: su ajuste *Default Terminal Profile* (Cline → Settings →
  Terminal) en valor `Default` usa la configuración global de VS Code; además, si no hay
  perfil configurado, replica el default de VS Code (PowerShell con `pwsh`, nunca `cmd.exe`).
  Opcionalmente se puede fijar ahí mismo el perfil sin tocar VS Code.
- Si Cline reporta *Shell Integration Unavailable*: reabrir la terminal, actualizar VS Code
  y seguir la guía oficial (ver §7).
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
- Cline — *Terminal Quick Fixes*: https://docs.cline.bot/troubleshooting/terminal-quick-fixes
- Cline — *Terminal Integration Guide*: https://docs.cline.bot/troubleshooting/terminal-integration-guide
