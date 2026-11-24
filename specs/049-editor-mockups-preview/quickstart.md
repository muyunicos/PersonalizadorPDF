# Quickstart de validación: Editor de Mockups — vista previa integrada

## Prerrequisitos
- Laboratorio local WP+Woo (`C:\wp-lab`) con el plugin montado por junction, o el sitio real.
- Un PDF subido con grupos analizados (al menos uno de tipo imagen con campo, uno de texto, y uno con `cont>1`).
- Chrome + Playwright en `%TEMP%` para la puerta de navegador (si se corre el lab).

## Puertas de código (rápidas, sin navegador)
```powershell
node --check assets/admin.js
node --check assets/mockups.js
node tests/mockup-contrato.test.js
node tests/mockup-geometria.test.js
node tests/campos-contrato.test.js
node tests/selector-contrato.test.js
php -l admin/pdfs.php
php tests/motor_smoke.php
```

## Escenarios de aceptación (consola)
1. **Acordeón + ayuda (US1)**: abrir pestaña PDFs → el acordeón se llama "Editor de mockups"; el icono "?" a la derecha muestra la ayuda por hover y por teclado (Tab+Enter) sin plegar el acordeón; no hay título interno duplicado.
2. **Vista previa imagen (US2)**: grupo imagen con campo → cargar foto en el recuadro → se ve el recorte/encuadre real; el `Procesar PDF` de muestra refleja ese recorte.
3. **Multi-instancia (US2)**: grupo con `cont>1` → aparecen flechas ‹ ›; cada flecha alterna instancia con su propio contenido; la instancia activa alimenta el mockup; 0 recargas.
4. **Vista previa texto (US2)**: grupo texto con "Probar" → el recuadro muestra el render (igual que el mockup).
5. **Alternar PH (US3)**: con contenido listo, "Alternar PH" activo dibuja el contenido en la capa; desactivado dibuja caja neutra; el contenido coincide con el recuadro del grupo.
6. **Fallo visible**: forzar un render/recorte inválido → aparece la causa y la consola sigue operativa.

## Puerta de navegador (lab, opcional)
```powershell
$env:NODE_PATH = "$env:TEMP\pmu-pw\node_modules"
$env:TEXTMUY_CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
node tests/aplanado.browser.js
```
Verifica que el editor sigue montando bajo `.ec-acordeon-mockups` y que el mockup se compone.

## Criterio de éxito
- 100% de grupos con contenido disponible lo muestran; alternar instancia en 1 clic; capa placeholder == vista previa; 0 regresiones en flujo clásico; ayuda accesible sin plegar.