# Quickstart — Editor de imagen y biblioteca del comprador

**Spec**: 043 | **Fecha**: 2026-11-20

Recorrido minimo para probar la feature de punta a punta en el laboratorio y en las puertas del
repo. Los detalles de contrato estan en `contracts/editor-imagen.md` y
`contracts/biblioteca-visor.md`; las entidades, en `data-model.md`.

## Prerrequisitos

- Laboratorio local (`C:\wp-lab`) levantado: `pwsh C:\wp-lab\arrancar.ps1` (responde en
  `http://localhost:8091`).
- Producto con `_pmu_pdf_slugs` y un PDF activo con al menos un campo de tipo imagen.
- Al menos **una foto** ya subida en la sesion del comprador (biblioteca con 1+).
- Playwright disponible sin tocar el repo:

```powershell
$env:NODE_PATH = "$env:TEMP\pmu-pw\node_modules"
$env:TEXTMUY_CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
```

## E1 — Editar el recorte sin volver a subir (US1/SC-001)

1. Abrir la ficha, subir una foto y dejarla colocada en el campo.
2. Anotar la cantidad de archivos de `uploads/pmu/tmp/sesion-*/uploads/`.
3. Tocar la miniatura del campo -> editar recorte.
4. Cambiar la **escala** y guardar.

**Esperado**: no aparece ningun POST de subida; la carpeta tiene los mismos archivos; el encuadre
del campo es el nuevo. La lista de la galeria sigue mostrando **una** foto.

## E2 — Abrir desde la miniatura (US2/SC-002)

1. Con la foto colocada, tocar su miniatura.

**Esperado**: el editor abre **una sola** vez, con la imagen ya cargada y el mismo encuadre que se ve
en el campo (zoom, posicion y modo). No pide archivo.

## E3 — Cancelar (US3/SC-006)

1. Abrir el editor de una foto existente, moverla y tocar **Cancelar**.
2. Volver a abrir el editor.

**Esperado**: el encuadre es el de antes; no hubo escrituras y no se subio nada.

## E4 — "Ver todas (N)" (US4/SC-004)

1. Abrir el modal de carga de una ranura.
2. Comprobar que al final de la tira esta **"Ver todas (N)"** con el total real.
3. Tocarlo.

**Esperado**: se abre el visor con **todas** las fotos (no solo las visibles). `Elegir` carga la
foto en el lienzo; el visor se cierra.

## E5 — Borrar con y sin uso (US4-US5/SC-005)

1. En el visor, borrar una foto **que no esta en ningun campo ni pedido**.
2. Repetir con una foto **usada por un item de carrito**.

**Esperado**: la primera se borra directo; la segunda muestra el dialogo y solo borra al confirmar.
En ambos casos la tira se repinta y "Ver todas (N)" baja el numero.

## E6 — Regresion de la lectura rapida (042/SC-007)

1. Abrir la galeria por primera vez con 3+ fotos.
2. Cerrar y reabrir dentro de los 5 minutos.

**Esperado**: **1** solicitud `media.php?op=listar`, **0** `admin-post`, **0** miniaturas sueltas;
la reapertura hace **0 solicitudes**.

## Puertas del repo

```powershell
php -l personalizador-pdf.php
Get-ChildItem admin, engine, inc -Filter *.php | ForEach-Object { php -l $_.FullName }
php tests/catalogo_uploads.php      # CATALOGO UPLOADS OK
php tests/media_lectura.php         # MEDIA LECTURA OK
php tests/sin_lectura.php           # SIN_LECTURA OK
php tests/texto_puente.php fotos    # fase fotos: OK
php tests/texto_puente.php receta   # fase receta: OK
php tests/texto_puente.php composicion  # fase composicion: OK
php tests/motor_smoke.php           # SMOKE OK
php tests/parity.php                # PARIDAD OK
node --check assets/selector-pmu.js
node --check assets/cargador-pmu.js
node --check assets/biblioteca-pmu.js
node --check assets/visor-pmu.js
node --check assets/tienda.js
node tests/selector-contrato.test.js    # SELECTOR CONTRATO OK
node tests/biblioteca-contrato.test.js  # BIBLIOTECA CONTRATO OK
node tests/campos-contrato.test.js      # CAMPOS CONTRATO OK
node tests/ficha-pedido.browser.js      # con el lab arriba
```

## Diagnostico rapido

| Sintoma | Causa probable | Donde mirar |
|---|---|---|
| Guardar una existente sube bytes | `declararReceta` no cableado | `cargador-pmu.js` (config del selector) |
| El editor abre sin encuadre | la receta no se resolvio por contexto | `SelectorPMU._recetaDeFoto` / lista rapida |
| "Ver todas" no aparece | la tira no fuerza el chip | `biblioteca-pmu.js` (tira) |
| Borra sin confirmar cuando esta en uso | no se mira `data.referencias` | `op=borrar` + `_quitar` |
| La galeria vuelve a tardar | el fast path se rompio | `media.php` / `biblioteca-pmu.js` |

## Cobertura scriptada (2026-11-22)

E1-E5 de este quickstart estan **scripteados** en `tests/ficha-pedido.browser.js`
(checks `E1 (043/US1)` ... `E5 (043/SC-005)`, gate en verde con 65/65). E5 se corre al
final del recorrido a proposito: borrar la unica foto del comprador rompe la vista previa,
el carrito y el pedido.