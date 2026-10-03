# Personalizador PDF

Plugin de WordPress que detecta *placeholders* (rectángulos 100 % transparentes) en PDFs
exportados desde CorelDRAW, los agrupa por color, permite cargar una imagen por grupo y
devuelve un PDF editado (encajado, sin deformar ni recortar). Motor 100 % PHP, sin Python
ni Node en el servidor. Integra el editor de estilos de texto **TextMuy** (client-side) y el
ciclo de compra de WooCommerce (spec 004); la API de compra (spec 010) está especificada.

## Documentación

| Documento | Qué es |
|---|---|
| `AGENTS.md` | Contexto obligatorio del proyecto: arquitectura, contratos, pruebas y reglas de trabajo. |
| `docs/entorno-desarrollo.md` | Entorno de desarrollo: Windows + PowerShell 7, Spec Kit + Cline, verificaciones y diagnóstico. |
| `specs/INDICE.md` | Índice y estado de las specs (flujo SDD de Spec Kit). |
| `readme.txt` | Metadatos del plugin para WordPress.org. |

Jerarquía documental: `.specify/memory/constitution.md` > `AGENTS.md` > resto.

## Entorno de desarrollo (resumen)

- Windows + **PowerShell 7 (`pwsh`)** + VS Code + extensión **Cline**.
- **Spec Kit** con integración `cline` (predeterminada y única) y scripts `ps`.
- Los comandos se ejecutan desde la **raíz del proyecto**; no se asume Bash, WSL, `cmd` ni
  Windows PowerShell 5.1 como shell activo. Detalle y verificaciones:
  `docs/entorno-desarrollo.md`.

## Pruebas (desde la raíz del proyecto)

```powershell
php tests/motor_smoke.php            # esperado: SMOKE OK
php tests/parity.php                 # esperado: PARIDAD OK
node tests/mockup-geometria.test.js  # esperado: GEOMETRIA OK
node tests/mockup-contrato.test.js   # esperado: CONTRATO OK
```

Suite completa (arnés de fases, módulo TextMuy, verificación en el sitio real): `AGENTS.md` §9.
