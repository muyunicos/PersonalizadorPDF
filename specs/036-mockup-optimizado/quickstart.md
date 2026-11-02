# Quickstart (036) — Validacion de la ficha optimizada

> Recorrido de aceptacion. Se corre **scripteado** en el laboratorio local (`C:\wp-lab`) y el hosting
> solo confirma el deploy (`AGENTS.md` §9). Puertas automaticas primero; recorrido despues.

## 0. Puertas automaticas (previas)

```powershell
php -l personalizador-pdf.php
Get-ChildItem admin, engine, inc -Filter *.php | ForEach-Object { php -l $_.FullName }
node --check assets/tienda.js; node --check assets/fotos-pmu.js; node --check assets/mockups.js
node tests/mockup-contrato.test.js
node tests/mockup-geometria.test.js
node tests/vistas-contrato.test.js
php tests/motor_smoke.php
php tests/parity.php
```

## 1. Red al cargar (D7) — E1

1. Abrir la ficha de un producto con **campos de imagen** y **sin** campo de tipo `texto`, con Network
   abierto.
2. Esperado: **0** peticiones de imagenes del cliente y **0** carga de `render-core.html`.
3. Abrir el modal de carga de imagenes: recien ahi aparecen las miniaturas (las del comprador).
4. Repetir con un campo de tipo `texto`: el motor de texto aparece **solo** cuando hay ese campo.

## 2. Mockup aplanado (D10) — E2

1. En el admin, abrir el editor de mockups de un PDF con mockups y guardar.
2. Esperado: aparece **1** archivo `pdfs/{nombre}/mockups/{mockup_id}.webp` (aplanado).
3. Abrir la ficha: **1** sola descarga por mockup; el mockup se ve **igual** que en el editor.
4. Editar las capas y guardar: el `.webp` se **regenera**; la ficha muestra la version nueva.
5. Borrar el `.webp` a mano y abrir la ficha: degrada con **causa visible** (no rompe).

## 3. Cola y gate del boton (D8/D9) — E3

1. Cargar **varias** imagenes y varios textos (multiples opciones).
2. Esperado: las subidas van en segundo plano; el boton "Agregar al carrito" queda **deshabilitado**
   mientras `pendientes() > 0` y se habilita **al vaciarse**.
3. Cambiar un texto ya subido: la **ultima version reemplaza** (el pool no queda con dos versiones) y
   al soltar el cambio el boton sigue habilitado solo con la cola vacia.
4. Cortar la red a mitad de una subida: la cola **reintenta** y no deja el boton trabado.

## 4. Auto-montaje (D3/D4) — E4

1. Completar los `min` de las ranuras: la galeria se monta **sola** (sin boton) y muestra la vista.
2. Editar un campo con la galeria abierta: se **repinta** en el lugar (no se oculta ni vuelve un boton).
3. Provocar un fallo de montaje: la venta **no** se bloquea (aviso actual, D5).

## 5. Evidencia

- Capturas en `C:\wp-lab\capturas\`; registrar en `specs/036-mockup-optimizado/quickstart.md` §5.
- Higiene: limpiar solo `tmp/sesion-*` y `tmp/muestras/*` de prueba; **nunca** `orders/` ni `pdfs/`.