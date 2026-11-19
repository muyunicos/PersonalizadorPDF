# Quickstart: validar el catalogo de uploads

**Fecha**: 2026-11-19 | **Spec**: [spec.md](./spec.md) | **Contrato**: [contracts/uploads-catalogo.md](./contracts/uploads-catalogo.md)

## Prerrequisitos

- PHP 7.4+ con **GD + WebP** (requisito del plugin).
- Desde la raiz del repo; PowerShell 7.
- Datos de prueba en `uploads/pmu/` (los tests del arnes crean su entorno aislado en `%TEMP%`).

## 1. Lint

```powershell
php -l personalizador-pdf.php
Get-ChildItem admin, engine, inc -Filter *.php | ForEach-Object { php -l $_.FullName }
node --check assets/biblioteca-pmu.js; node --check assets/cargador-pmu.js; node --check assets/selector-pmu.js
```

Esperado: `No syntax errors detected` en cada archivo.

## 2. Contrato del cliente (JS)

```powershell
node tests/biblioteca-contrato.test.js     # dedupe de listar, tira sin versiones, borrado desde la galeria
node tests/fotos-contrato.test.js          # original acotado + dedupe por sha
node tests/selector-contrato.test.js       # receta recordada (params por contexto)
```

Esperado: `... OK` y salida 0.

## 3. Servidor y catalogo (PHP)

```powershell
php tests/texto_puente.php biblioteca      # listar / imagen / miniatura / borrar (dos pasos)
php tests/sin_lectura.php                  # leer el catalogo NO lo reescribe (RC47)
php tests/motor_smoke.php                 # SMOKE OK
php tests/parity.php                      # PARIDAD OK
```

Esperado:
- `FASE biblioteca OK`.
- `SIN_LECTURA OK` (la reconstruccion es la unica escritura permitida y es explicita).
- `SMOKE OK`, `PARIDAD OK` (el Motor no se toca).

## 4. Escenarios funcionales (harness)

| Escenario | Como se prueba | Esperado |
|---|---|---|
| Listado sin pedidos ajenos | fase `biblioteca` con un pedido de otro cliente en `orders/` | no aparece y no se lee |
| Un solo listado por apertura | dos llamadas concurrentes a `PMU_Biblioteca.pedir()` | **un** fetch |
| Encuadre recordado | subir, declarar receta, listar | la receta aparece en `recetas[clave]` |
| Quitar del campo no borra | quitar la foto de la ranura | el archivo y su entrada siguen |
| Borrar sin referencias | borrar desde la galeria | original + miniatura + entrada eliminados |
| Borrar con carrito/pedido | borrar sin `confirmar` | `requiere_confirmacion: true`; con `confirmar=1` borra |
| Catalogo ausente | borrar `uploads.json` y listar | se reconstruye sin recetas y el listado no falla |
| Miniatura faltante | borrar `{id}-80x80.webp` y pedirla | se genera y se conserva |

## 5. Validacion en el navegador (laboratorio o hosting)

1. Abrir la ficha o el cotizador y **un click** en "Cargar imagen".
2. En Network: **una** peticion `op=listar`; imgs de `op=miniatura` de pocos KB; ninguna foto completa.
3. Elegir una imagen ya usada: el recorte aparece con su encuadre; el primario dice **Usar**.
4. Quitar la foto de un campo y reabrir la galeria: la imagen **sigue** ahi.
5. Borrar desde la galeria una imagen en carrito: aparece la confirmacion; al aceptar desaparece.

Esperado (SC): apertura <300 ms, 1 solicitud, 0 bytes al reutilizar, <20 KB por miniatura.

## 6. Fuera de alcance de esta guia

- No se valida el bundle del cotizador: esta feature no cambia `calculadora` ni el tema.
- No se corre `modules/textmuy/` (sin cambios).