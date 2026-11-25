# 02 — Convenciones y comandos

## Estilo de código
- Mensajes, variables e interfaz **estrictamente en español**, sin tildes en código puro (evita problemas de encoding).
- **NO agregar comentarios** salvo pedido explícito.
- **Editar SIEMPRE con la herramienta de edición** (diff exacto). Nunca generar contenido con heredocs,
  `Set-Content` sobre archivo existente, ni scripts que reescriban el archivo entero.
- Anclas de edición de **una línea y sin espacios iniciales**; EOL mixto (CRLF/LF): si un ancla multilínea
  falla, partir en anclas de una línea.
- Tras cada paso: `php -l` / `node --check` (no al final).
- Versión única: cabecera `* Version:` de `personalizador-pdf.php` (no reescribir `define` a mano).

## Manejo de errores
- Errores inline con causa accionable; la consola responde SOLO JSON (`responder()` nunca redirige).
- No exponer/registrar secretos. No tocar DB/credenciales/servicios externos sin aprobación.
- Ante fallo: diagnosticar entorno (shell, directorio, PATH, herramientas) antes de cambiar nada.

## Testing (desde la raíz; módulo TextMuy exige `modules/textmuy/`)
```powershell
php -l personalizador-pdf.php
Get-ChildItem admin, engine, inc -Filter *.php | ForEach-Object { php -l $_.FullName }
php tests/motor_smoke.php            # SMOKE OK (obligatorio tras tocar engine/)
php tests/parity.php                 # PARIDAD OK
php tests/envolturas.php             # ENVOLTURAS OK
php tests/campos_migracion.php       # CAMPOS V3 OK
php tests/certificacion_hoja.php     # CERTIFICACION HOJA OK
node tests/mockup-geometria.test.js  # GEOMETRIA OK
node tests/mockup-contrato.test.js   # CONTRATO OK
node tests/campos-contrato.test.js   # CAMPOS CONTRATO OK
```

## Lint / auditoría (solo desarrollo, NO corre en hosting)
```powershell
php composer.phar run analisis       # PHPStan nivel 4
npx --yes jscpd@4 --config .jscpd.json .   # clones -> docs/jscpd-report.md
php tests/inventario_repo.php        # genera docs/inventario-repo.md
```

## Reglas de oro
- No crear archivos/motores nuevos sin confirmar si ya existe código que resuelva el problema.
- No introducir Python/Node/`exec()` en el runtime desplegable.
- No commitear/pushear/desplegar sin pedido explícito (el push dispara webhooks de Hostinger).
- `modules/textmuy/` se commitea y pushea en SU propio repo.