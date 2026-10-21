# Contrato: los 3 modos de encaje (spec 028)

> **Fuente unica de verdad.** La reflejan cuatro lugares y ninguno puede
> divergir: (1) el docblock de `escalaBase` en `assets/selector-pmu.js`,
> (2) este archivo, (3) la UI (`ICO_MODO` + `TITULO_MODO` + `admin/ayuda.php`),
> (4) los tests **por propiedad** de `tests/selector-contrato.test.js` (F2b/F2f).

## La tabla

| `id` | Etiqueta | Icono | `object-fit` | ¿deforma? | ¿deja fondo? | ¿recorta? |
|---|---|---|---|---|---|---|
| `cubrir` | **Cubrir** | imagen que desborda el marco | `cover` | NO | NO | **si** |
| `encajar` | **Encajar** | foto entera + marco con margenes | `contain` | NO | **si** | NO |
| `estirar` | **Estirar** | imagen = marco | `fill` | **si** | NO | NO |

**El invariante que hay que leer bien** (asi se leyo mal en la spec 025): lo que
distingue `cubrir` de `encajar` **NO es "deformar"** (ninguno de los dos
deforma): es **que hace con el sobrante**. `cubrir` **recorta** la foto hasta
tapar el marco; `encajar` conserva la foto entera y **deja fondo** a los
costados.

## Formulas (`escalaBase(modo, iw, ih, W, H)`)

| modo | escala | caja (`dw`, `dh`) | resultado |
|---|---|---|---|
| `cubrir` | `e = max(W/iw, H/ih)` | `iw·e`, `ih·e` | tapa el marco (≥ `W` y ≥ `H`); recorta |
| `encajar` | `e = min(W/iw, H/ih)` | `iw·e`, `ih·e` | entra (≤ `W` y ≤ `H`); deja fondo |
| `estirar` | — | `W`, `H` | el marco exacto; deforma |

Los tres tocan al menos un eje (el resultado es el **minimo/maximo** que
corresponde: no sobra escala).

## LIENZO y PNG

- **Lienzo** = `W x H`, el tamano del hueco del PDF, resuelto por `phsize` en
  `PMU_API.montarCargador` / `PURO.normalizarRanura` (`assets/tienda.js`):
  `phsize: 1` -> el grupo base de `analisis.json`; `0` -> los `w`/`h`
  declarados; `2` -> x2 (cap `PH_MAX = 3000`).
- **El PNG mide el LIENZO acotado a la resolucion de la foto** (D6 + D11) y se
  dibuja con `_pintarImagenEnContexto` (centrado en el lienzo, mas el
  desplazamiento y la Escala del comprador).

### Tope de resolucion (D11)

```
k = min(1, max(iw,ih) / max(caja))     // el lado mayor de la foto no crece
PNG = round(W*k) x round(H*k)          // escalaSalida(), pura y testeada
```

| foto | lienzo | modo | caja | `k` | PNG |
|---|---|---|---|---|---|
| 400x300 | 1000x1000 | `cubrir` | 1333x1000 | 0,30 | **300x300** |
| 400x300 | 1000x1000 | `encajar` | 1000x750 | 0,40 | **400x400** |
| 400x300 | 1000x1000 | `estirar` | 1000x1000 | 0,40 | **400x400** |
| 400x300 | 1000x1000 | `cubrir` (Escala 4x) | 5333x4000 | 0,075 | **75x75** |
| 4000x3000 | 1000x1000 | cualquiera | — | **1** | **1000x1000** |

- **Nunca supera el lienzo** (`k <= 1`) y **nunca amplia la foto**: no inventa
  pixeles, sin piso de calidad (una foto de 100x100 en un marco de 3000 da
  **100x100**).
- **El factor es uniforme** -> el PNG conserva el **aspecto del lienzo**, asi
  que el Motor lo escala de forma **uniforme** al insertarlo y el **encuadre es
  el mismo** (modo, Escala y desplazamiento intactos). Solo baja la resolucion.
- La **Escala** multiplica la caja: acercar **baja** `k` (se usan menos pixeles
  de la foto y el PDF se ve igual que la vista previa).
- El **pool** (`assets/tienda.js: rasterizar`) recibe un PNG del mismo aspecto y
  menor o igual al hueco, asi que lo dibuja **1:1 sin remuestrear**.
- El **Motor** (`engine/Imagen.php: encajado`) encaja con contain+centrado: con
  un PNG del tamano del hueco el encaje es **1:1**, y con uno acotado por `k` es
  una escala uniforme `1/k`: **el encuadre se conserva entero**. Por eso **la
  vista previa es el PDF**.
- Si el PNG tuviera otro aspecto que el hueco, el Motor lo reencajaria y la
  composicion (modo, Escala, desplazamiento) se perderia. De ahi el aviso de
  `phsize: 0` (spec 028 D9).

## Regla del 5% y re-encuadre

| caso | botones | accion |
|---|---|---|
| aspecto difiere **>5%** | **3**: Cubrir · Encajar · Estirar | elige modo (la Escala vuelve a 1x: spec 024 D4) |
| aspecto coincide **<=5%** | **1**: **"Ajustar al marco"** | **RE-ENCUADRA**: modo del caso + Escala 1x + sin desplazamiento |

`superaCincoPorciento()` (`assets/selector-pmu.js`) decide el caso y se
recalcula **al girar** (D8). Se conserva de la spec 021/024.

## Alias aceptados

`modoCanonico()` (pura, exportada en `SelectorPMU.puro`):

| entra | sale |
|---|---|
| `cubrir`, `cover`, cualquier otra cosa, `undefined` | `cubrir` (**default**) |
| `encajar`, `ajustar`, `contain`, `fit` | `encajar` |
| `estirar`, `fill`, `stretch` | `estirar` |
