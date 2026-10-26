# Quickstart — Spec 031 (validacion end-to-end en el lab)

> Guia runnable de validacion (no repetir contratos: ver `contracts/editor-panel.md` y `data-model.md`).
> Entorno: Windows + PowerShell 7 desde la raiz del repo; lab local `C:\wp-lab` (WP+Woo reales, plugin
> por junction). Playwright instalado fuera del repo (`$env:NODE_PATH="$env:TEMP\pmu-pw\node_modules"`;
> `$env:TEXTMUY_CHROME='C:/Program Files/Google/Chrome/Application/chrome.exe'`).

## Precondiciones

1. Lab arrancado: `pwsh C:\wp-lab\arrancar.ps1` (si esta apagado); consola en
   `http://localhost:8091/wp-admin`.
2. PDF de muestra con grupos y mockup con capas: `circulo6cm` (config en
   `C:\wp-lab\wordpress\wp-content\uploads\pmu\pdfs\circulo6cm\config.json` — **siempre hacer backup
   antes y restaurar al final**; nunca `process.exit` dentro de `try`).
3. Un mockup con grupo importado (pagina + PH) para verificar acordeones de grupo en Capas.
4. Puertas de codigo previas (deben estar en verde antes de abrir el navegador):
   `node --check assets/mockups.js`, `node tests/mockup-contrato.test.js`,
   `node tests/mockup-geometria.test.js`, `php -l personalizador-pdf.php`.

## Escenarios

- **E1 — Lienzo siempre cabe (SC-001)**: abrir el editor; medir el ancho del panel izq y del canvas:
  el lienzo de 300 px se ve entero, sin corte, a zoom 100 %; el select de zoom marca "100 %".
  Repetir en ventana de 1280 y 1366 px y en el degradado a una columna (< 1100 px).
- **E2 — Transformacion bajo el lienzo (US2)**: seleccionar una capa → el bloque x/y/ancho/alto/rot +
  alinear + distribuir aparece **debajo del lienzo** (arriba de la ayuda); cambiar un numero redibuja;
  deseleccionar lo oculta; con 3 capas (Ctrl+clic) Centro H y Distribuir H producen la geometria
  esperada.
- **E3 — 5 acordeones (US3)**: al abrir el editor los 5 estan cerrados (Vistas del PDF, Capas,
  Ajustes, Imagenes, Placeholders); abrir dos a la vez es posible; el contenido de cada uno es el
  vigente reubicado; en Vistas del PDF el titulo esta arriba y las acciones al pie.
- **E4 — Capas agrupadas (US4)**: con el grupo importado, Capas muestra la seccion Sin grupo arriba y
  un acordeon por grupo con sus miembros dentro; clic en la cabecera selecciona el grupo (marco
  orientado en el lienzo); Alt+clic en un miembro lo selecciona solo; ▲▼ de una miembro reordena en z
  global; **no existen** + Imagen / + Placeholder; agregar imagen desde Imagenes y placeholder desde
  Placeholders funciona con un clic.
- **E5 — Menu contextual y atajos (US5)**: clic derecho en una fila → menu con Duplicar/Quitar/
  Agrupar/Desagrupar/Ocultar/Bloquear segun estado; Delete quita la capa seleccionada; Ctrl+D la
  duplica; el boton `...` abre el mismo menu; el menu se cierra con clic fuera, Esc y scroll; con 1
  sola capa Agrupar aparece deshabilitado; Desagrupar solo si hay grupo.
- **E6 — Clip del tirador de capa (SC-006)**: capa grande rotada cuyo tirador natural quedaria fuera
  del lienzo → el tirador se dibuja en el borde (clip radial), igual que el grupal; medir tinta azul
  en la zona del borde (probe adaptado de `probe-tirador-rotacion.cjs` / `probe-tirador-dibujo.cjs`);
  el hit-test agarra en el mismo punto.
- **E7 — Dataset intacto y ayuda (SC-005/FR-016)**: guardar; diff de `config.json` `mockups[]`
  (mismas claves que antes del rediseno); reabrir el editor y continuar la edicion; la ayuda de la
  consola (Ayuda) documenta menu contextual, atajos, acordeones y el recorte de grupos grandes.

## Puertas (despues de los escenarios)

```powershell
node --check assets/mockups.js
node tests/mockup-contrato.test.js        # CONTRATO OK (con checks actualizados)
node tests/mockup-geometria.test.js       # GEOMETRIA OK (135, sin cambios)
php -l personalizador-pdf.php
php tests/texto_puente.php mockups        # fases del editor
php tests/texto_puente.php mockup_capas
php tests/texto_puente.php mockup_pagina
php tests/texto_puente.php mockup_preview
node tests/ficha-pedido.browser.js        # regresion del flujo comprador (editor no se toca desde la ficha)
```

## Esperado

- E1-E7 en verde con sus criterios medibles (tinta en el borde para E6; cero requests nuevos en todos).
- Puertas en verde; `config.json` del lab restaurado; commit por fase verificada (norma §10.ter);
  version 4.23.0 en la cabecera (unica fuente) para el cache-bust del editor.

## Si algo falla

- El editor no monta (ni galeria ni lienzo): falta `mockup-render.js` o `mockup-geometria.js` en el
  servidor (dependencia dura; ver tabla §11 de AGENTS.md).
- El menu contextual no cierra: verificar el cierre por scroll del panel (C-3) y el repintado.
- Un check del contrato falla por markup: re-escribirlo a la intencion (precedente 013 T010), nunca
  borrarlo; la lista de anclas a actualizar esta en research R5.
- El tirador de capa sigue fuera del lienzo: `puntoRotacionCapa` debe aplicar `G.extremoVisible`
  **antes** de dibujar y **antes** del hit-test (C-1); la puerta es E6 con tinta, no el codigo.