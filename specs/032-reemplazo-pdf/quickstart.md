# Quickstart: reemplazo del PDF (validacion en el laboratorio local)

**Feature**: 032-reemplazo-pdf · **Fecha**: 2026-10-26

> Recorrido de aceptacion en `C:\wp-lab` (WP real, plugin por *junction*, cambios del repo ya visibles).
> Complementa las puertas del repo (fase `reemplazo` del arnes); **no** las reemplaza.

## Precondiciones

```powershell
pwsh C:\wp-lab\arrancar.ps1                                   # si el lab esta apagado
$P = 'C:\wp-lab\wordpress\wp-content\uploads\pmu\pdfs'
Copy-Item "$P\circulo6cm\config.json" "$P\circulo6cm\config.json.bak-032" -Force   # respaldo de trabajo
```

Producto de prueba: **`circulo6cm`** (2 grupos: `0000FF` y `FF0000`, 15 instancias). Material de los
casos: **copias del PDF** con el color de un grupo cambiado, verificadas con el oraculo del detector
(`php tests/parity.php <ruta>` imprime los grupos y sus ids).

---

## R1 — Preparar SIN cambios (mismo PDF)

**Pasos**: consola → "2. PDFs subidos" → **Reemplazar archivo** en `circulo6cm` → elegir el **mismo** PDF.
**Esperado**: el modal muestra **todos los grupos en "iguales"**, cero sugeridos, cero perdidos.
**Nada aplicado aun**: el producto sigue igual (hash igual al de antes de preparar).

## R2 — Preparar con un grupo de OTRO color (sugerencia por geometria)

**Pasos**: preparar una copia donde el grupo `0000FF` salio con otro color (p.ej. `00FF00`), con los
rectangulos en el **mismo lugar y tamano**.
**Esperado**: ese grupo entra en **"sugeridos"** con `iou` alto (~1) y `color` bajo (el color cambio a
proposito), y el modal lo muestra con su **de → a**. El resto, en "iguales".

## R3 — CANCELAR no cambia nada

**Pasos**: sobre R2, pulsar **Cancelar**.
**Esperado**: el producto queda **byte-identico** (hash de `{nombre}.pdf`, `analisis.json`, `config.json`,
`envolturas.json` iguales) y `tmp/reemplazos/circulo6cm/*/nuevo/` desaparece.

```powershell
Get-FileHash "$P\circulo6cm\config.json"
```

## R4 — MIGRAR conserva y remapea

**Pasos**: repetir R2 y pulsar **Migrar**.
**Esperado**:
- `config.json` **conserva** `productos`, `campos_ids`, `preview_omisible`, `tienda`, `bonus[]` y `mockups[]`
  (comparar con el `.bak-032`).
- `placeholders` del grupo que cambio de color aparecen con la **clave nueva** (`00FF00`), con su `value`/`preset`
  intactos.
- Los `ref` de las capas de los mockups (`0000FF#n` -> `00FF00#n`) quedaron remapeados: la vista previa
  no muestra capas sin recurso (el editor ya no lista "capa(s) sin recurso").
- El PDF del producto es el **nuevo** (hash distinto) y hay respaldo (`tmp/reemplazos/.../anterior/` con 4 archivos).

## R5 — RECUPERAR la version anterior

**Pasos**: tras R4, pulsar **Recuperar la version anterior**.
**Esperado**: los 4 archivos vuelven **byte a byte** al estado previo a R4 (hashes = los guardados antes de
migrar). El respaldo se conserva (se puede recuperar de nuevo, mismo resultado).

## R6 — Un PDF invalido no toca el producto

**Pasos**: preparar un PDF **sin placeholders** (p.ej. la copia con los rectangulos opacos) o un archivo
corrupto.
**Esperado**: error con causa ("No se detectaron placeholders..."), **cero cambios** (hash igual) y sin
modal de migracion.

## R7 — `envolturas{gid}` fuera de rango

**Precondicion**: a mano, en `config.json` poner `"envolturas": {"0000FF": {"forma": 9}}` (no existe).
**Pasos**: preparar y migrar con el mismo PDF.
**Esperado**: el aviso "Envoltura del grupo 0000FF revalidada a la forma por defecto" y, en el `config.json`
resultante, `forma: 0`. El producto sigue funcionando (la vista previa no cambia de forma).

## R8 — `ref` de capa huerfano y `#n` fuera de rango

**Precondicion**: en `config.json`, una capa de `mockups[0]` con `ref: "ABCDEF#3"` (grupo inexistente) y otra
con `ref: "0000FF#99"` (instancia fuera de rango).
**Pasos**: preparar y migrar.
**Esperado**:
- `ABCDEF#3` **no se borra**: la capa se conserva y aparece **reportada** (el editor la marca sin recurso).
- `0000FF#99` se mapea a la instancia 1 (`0000FF`) con aviso.

---

## Puertas del repo (ademas del recorrido)

```powershell
php tests/texto_puente.php reemplazo      # fase nueva: mapa, cancelar/migrar, fallo, recuperar, refs
php tests/texto_puente.php reanalizar     # el remapeo compartido (FR-011)
php tests/texto_puente.php borrado        # borrar producto limpia tambien tmp/reemplazos/
php tests/texto_puente.php subir_conflicto
php tests/motor_smoke.php; php tests/parity.php
node tests/mockup-contrato.test.js; node tests/mockup-geometria.test.js
php -l personalizador-pdf.php
```

## Fallos conocidos (precondiciones del lab)

- **`tmp/reemplazos/` vacio tras un `limpiar_ttl`**: la exclusion del barrido (R6/FR-010) no esta
  implementada todavia -> R5 no encontrara respaldo.
- **El producto no tiene `config.json` personalizado**: R4 no puede demostrar la conservacion; sembrar antes
  (un `placeholders` con `value`, un `bonus[]` y un mockup con capas).