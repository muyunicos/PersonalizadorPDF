# Quickstart: Importar página/capa y reemplazar capa/grupo (validación en el laboratorio local)

**Feature**: 034-importar-reemplazar-capa · **Fecha**: 2026-10-26

> Recorrido de aceptación en `C:\wp-lab` (WP real, plugin por *junction*, cambios del repo ya visibles). Complementa las puertas del repo (fase `importar-reemplazar`); **no las reemplaza**.

## Precondiciones

```powershell
pwsh C:\wp-lab\arrancar.ps1   # si el lab está apagado
```

Producto de prueba: **`circulo6cm`** (grupos `0000FF` y `FF0000`). Antes de empezar, respaldá el config:

```powershell
$P = 'C:\wp-lab\wordpress\wp-content\uploads\pmu\pdfs\circulo6cm'
Copy-Item "$P\config.json" "$P\config.json.bak-034" -Force
```

---

## R1 — Importar página sobre una capa individual

**Pasos**: consola → PDFs → acordeón Mockups → clic en una capa de la lista (selección simple) → anotar sus `x/y/w/h/rot` en el bloque de propiedades → acordeón Placeholders → "Importar página + PH" → página 1.

**Esperado**: la capa se sustituye por la página importada **en el mismo lugar y tamaño**; `x/y/w/h/rot` no cambian; `ref` pasa a `mock:<id>`; el número de capas no cambia.

**Medición**: leer los inputs `data-geo` antes y después; deben ser iguales.

---

## R2 — Importar página sobre un grupo

**Pasos**: clic en la cabecera del acordeón del grupo (selecciona el grupo completo) → "Importar página + PH" → página 1.

**Esperado**: cada capa miembro conserva su geometría relativa y el grupo su `grupo_rot`; el número de capas no cambia; todas las capas del grupo apuntan a `mock:<id>`.

**Medición**: `config.json:mockups[0].capas[]` — los `grupo` siguen iguales y `grupo_rot` no cambia.

---

## R3 — Importar sin selección (no regresión)

**Pasos**: clic en el lienzo vacío (deseleccionar) → "Importar página + PH" → página 1.

**Esperado**: comportamiento actual: se agrega una capa `img` nueva + el grupo de placeholders; la cantidad de capas **aumenta**.

**Medición**: `.ec-mk-capas .ec-mk-capa` antes vs después.

---

## R4 — Perspectiva por capa individual

**Pasos**: seleccionar **una** capa → acordeón Ajustes.

**Esperado**: aparecen los controles de perspectiva (cuatro puntos) para esa capa individual (hoy solo se mostraban para grupos). Al mover un punto y aplicar, la capa se deforma y `config.json` guarda `perspectiva` en **esa** capa.

**Medición**: `config.json:mockups[0].capas[i].perspectiva.puntos.length === 4`.

---

## R5 — Importar sobre una capa con perspectiva

**Pasos**: seleccionar una capa que tenga `perspectiva` → importar página → aceptar.

**Esperado**: el `ref` cambia pero la `perspectiva` se mantiene; la nueva imagen se deforma igual que la anterior.

**Medición**: comparar `perspectiva` antes/después (debe ser idéntica).

---

## R6 — Fallo del importador

**Pasos**: importar una página inexistente (p. ej. `999`).

**Esperado**: error con causa ("El PDF tiene N paginas."); **cero cambios** en el mockup.

**Medición**: hash de `config.json` igual antes/después.

---

## R7 — Varias capas seleccionadas sin grupo

**Pasos**: Ctrl+clic en dos capas **sueltas** (sin `grupo`) → importar página → aceptar.

**Esperado**: solo se reemplaza **la primera**; la segunda conserva su `ref`.

**Medición**: `config.json` — la segunda capa mantiene su `ref` original.

---

## R8 — Capa bloqueada

**Pasos**: marcar una capa como bloqueada (🔒) → seleccionarla → importar página.

**Esperado**: el sistema avisa y **no** reemplaza. (Estado actual: la verificación de bloqueo en el importador es un refinamiento pendiente de F2; si no avisa, el `ref` cambia igual — registrar el hallazgo.)

**Medición**: `ref` de la capa bloqueada.

---

## Puertas del repo (además del recorrido)

```powershell
node --check assets/mockups.js
node tests/mockup-contrato.test.js      # CONTRATO 147
node tests/mockup-geometria.test.js     # GEOMETRIA 135
php tests/motor_smoke.php               # SMOKE OK
php tests/parity.php                    # PARIDAD OK
php tests/texto_puente.php importar-reemplazar   # fase nueva
```

## Higiene al terminar

```powershell
Copy-Item "$P\config.json.bak-034" "$P\config.json" -Force
Remove-Item "$P\config.json.bak-034"
```
