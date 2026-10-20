# Spec 028 — Los 3 modos de encaje y el lienzo de salida

> Estado: **implementada** (2026-10-20). Release: 4.19.0.
> **Supersede a la 025** (`png-resolucion-foto`): revierte sus D1–D5 (los modos y
> el tamano del PNG), no las ajusta.
> Ortogonal a la 026 (`imagenes-webp`) y a la 027 (`transparencia-campo`):
> el formato y el alfa no cambian; cambia **como se compone** la imagen.

## 1. Problema

La spec 025 redefinio los 3 modos con otras palabras ("Rellenar = recortar al
aspecto **sin ampliar**", "Ajustar = contain capado a 1", "Estirar = lado
mayor") y el PNG como `min(caja, lienzo)`. El resultado en la practica:

1. **Cubrir dejaba huecos**: con una foto mas chica que el marco, la caja
   dibujada era mas chica que el marco (`dw = min(iw, ih·ratio)`), asi que se
   veia el fondo donde el negocio esperaba la foto.
2. **El PNG salia corrido**: la ventana media `min(caja, lienzo)` pero el
   dibujo se centraba en el **lienzo**; cuando la caja tenia otro aspecto que el
   lienzo, la ventana y el centro no coincidian (con un lienzo no cuadrado el
   recorte salia desplazado y el Motor lo reencajaba).
3. **La Escala no ampliaba** (tope 1x): con `cubrir` no se podia ajustar el
   recorte.

**Causa raiz**: las palabras elegidas ("Rellenar", "Ajustar") describen
acciones y son ambiguas; la 025 las leyo de una forma defendible y **codifico
esa lectura en los tests con ejemplos** (E1–E6), asi que pasarlos no probaba
nada. Lo que separa a los dos modos que no deforman nunca estuvo escrito: no es
"deformar", es **que hace con el sobrante**.

## 2. Decisiones

| # | Decision |
|---|----------|
| **D1** | **Los 3 modos se anclan al estandar CSS `object-fit`** y se renombran a verbos inequivocos: `cubrir` (`cover`), `encajar` (`contain`), `estirar` (`fill`). Los ids viejos (`rellenar`, `ajustar`) y los nombres de `object-fit` (`cover`, `contain`, `fill`) quedan como **alias** en `modoCanonico()`. |
| **D2** | **`cubrir` = `cover`**: la caja es la **menor** con el aspecto de la foto que **tapa el marco entero** (`e = max(W/iw, H/ih)`). No deforma y **recorta** el sobrante: **nunca deja huecos**. Es el **default**. |
| **D3** | **`encajar` = `contain`**: la caja es la mayor con el aspecto de la foto que **entra** en el marco (`e = min(W/iw, H/ih)`). No deforma y **deja fondo**: **nunca recorta**. **Sin tope de ampliacion** (si la foto es mas chica que el marco, amplia hasta tocar un eje). |
| **D4** | **`estirar` = `fill`**: la caja es el marco exacto (`dw = W, dh = H`). Es el unico modo que **deforma**. |
| **D5** | **La Escala vuelve al rango completo 0.25x–4x** (la base la fija el modo; la Escala es del comprador y el fondo tapa los huecos). |
| **D6** | **El PNG mide SIEMPRE el lienzo (`W x H`)** = el tamano del hueco del PDF (el que resuelve `phsize`). El Motor encaja con contain+centrado (`Imagen::encajado`), asi que un PNG del tamano del hueco pasa **1:1**: la **vista previa es el PDF** (modo, Escala y desplazamiento incluidos). Se retira la ventana `min(caja, lienzo)` de la 025. |
| **D7** | **Regla del 5% (se conserva)**: si el aspecto de la foto ya coincide con el marco (<=5%) los 3 modos hacen casi lo mismo, asi que no se le dan opciones que no hacen nada: queda **UN boton, "Ajustar al marco"**, que **no es un modo sino un RE-ENCUADRE** (vuelve al encaje por defecto: modo del caso + Escala 1x + sin desplazamiento). Con >5% se muestran los 3 modos. |
| **D8** | **Default por caso**: >5% -> `cubrir`; <=5% -> `estirar` (llena el marco exacto con una deformacion imperceptible). Al girar se recalcula el 5% y, si la foto estaba en `estirar` y el aspecto paso a diferir, pasa a `cubrir` (no deformar sin querer). |
| **D9** | **Aviso de configuracion**: con `phsize: 0` y un lienzo declarado **distinto** del hueco del grupo, la ficha avisa por consola al montar (el Motor reencajara la composicion: lo que se ve no es lo que sale). La solucion es `phsize: 1`. |
| **D10** | **Sin migracion**: nada de lo guardado cambia (los ids viejos entran por `modoCanonico`). El Motor, el servidor y los datos del admin **no se tocan**. |

## 3. Contrato (ranura y modos)

```js
var RANURAS = [
    { w: 1000, h: 1500, forma: 'cuadrado', min: 1, max: 4, phsize: 1, r: 0, transp: 'no' }
    // phsize: 1 -> el lienzo es el HUECO del grupo (463x463), no 1000x1500.
];
```

Tabla normativa (fuente unica: el docblock de `escalaBase` y
`contracts/modos.md`):

| id | etiqueta | `object-fit` | deforma | deja fondo | recorta |
|---|---|---|---|---|---|
| `cubrir` | Cubrir | `cover` | NO | NO | **si** |
| `encajar` | Encajar | `contain` | NO | **si** | NO |
| `estirar` | Estirar | `fill` | **si** | NO | NO |

## 4. Puertas

- `node tests/selector-contrato.test.js` (F2b, **por propiedad**):
  *Cubrir nunca deja huecos y no deforma*, *Encajar siempre entra y no deforma*,
  *Estirar es el marco exacto*, *el invariante (Cubrir recorta / Encajar deja
  fondo)*, *el PNG mide el lienzo*, *el aviso de `phsize: 0`* y el **test de
  vocabulario** (ids ↔ etiquetas ↔ iconos ↔ alias).
- `node tests/campos-contrato.test.js`: `phsize: 0` usa lo declarado **y avisa**
  si no es el hueco.

## 5. Fuera de alcance

- **No** se toca `engine/`: el Motor ya encaja con contain+centrado.
- **No** se toca el servidor ni los formatos (026) ni la politica de
  transparencia (027).
- **No** se agrega un `modo` declarable por ranura (el default por caso alcanza;
  queda como candidato si un logo necesita arrancar en `encajar`).
