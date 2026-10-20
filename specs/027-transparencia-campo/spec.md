# Spec 027 — Politica de transparencia por campo

> Estado: **en implementacion** (2026-10-20). Release prevista: 4.17.0.
> Ortogonal a la 026 (`imagenes-webp`): el alfa viaja igual en PNG y en WebP.

## 1. Problema

Hoy la transparencia de la foto que sube el comprador la decide **el cliente**, con el
boton "damero" del selector (`assets/selector-pmu.js`). Eso deja el resultado final
en manos de quien compra: el PDF puede salir con un fondo transparente que el
diseno no esperaba, o con un fondo de color plano donde el admin queria transparencia.

El `campo.js` (que escribe el **admin**) es el lugar natural de la decision: es la
declaracion de intencion del campo, igual que `forma`, `min`/`max` o `phsize`.

## 2. Decisiones

| # | Decision |
|---|-----------|
| **D1** | La ranura declara `transp: 'si' \| 'no'`. **Ausente = comportamiento actual** (el cliente decide): el cambio es aditivo y no rompe los campos existentes. |
| **D2** | `transp: 'no'`: el selector **nunca** ofrece el fondo transparente (el boton "damero" se oculta) y el "auto" **nunca** resuelve a transparente. Si la deteccion de bordes dice "transparente", el fondo es **blanco puro** (`#ffffff`); si la deteccion propone un color **solido**, ese color se usa (el cliente elige el color, no la transparencia). |
| **D3** | `transp: 'si'`: se aplica la cadena completa y **solo si se cumplen TODAS** se sube con alfa: (a) el archivo del cliente **soporta** transparencia (PNG/WebP; JPEG no), (b) existe una **capa de transparencia real** (alfa < 250 en **algun** pixel de la imagen, no solo en el perimetro), (c) el "auto" resuelve a **transparente**, (d) el **fondo final** en el momento de subir es transparente. Si falla cualquiera, el fondo es opaco. |
| **D4** | El "auto" con `transp: 'si'` decide mirando **toda** la imagen (muestreada), no solo los 4 bordes: una foto con fondo transparente en el centro tambien cuenta como "capa de transparencia real". |
| **D5** | El color de fondo **elegido a mano** por el cliente siempre gana: con `transp: 'si'`, si toca un color, la condicion (d) deja de cumplirse y la imagen se sube **opaca**. La transparencia es una opcion, no una imposicion. |
| **D6** | La politica es **por ranura** (no por campo): cada ranura puede declararla. `transp` ausente = actual. |
| **D7** | La transparencia viaja en las **dos capas**: `subidas/{id}.{ext}` (la foto original del cliente) y el pool `img/{pdf}-{id}-{n}.{ext}` (el recorte rasterizado). El PDF final la recibe como **SMask** (alpha separado), igual que hoy. |
| **D8** | **Sin migracion**: ningun campo existente se toca. El admin declara `transp` en el `campo.js` cuando quiere la politica. |

## 3. Contrato (ranura)

```js
var RANURAS = [
    { w: 1000, h: 1000, forma: 'auto', min: 1, max: 1, phsize: 1, r: 0,
      transp: 'si' }   // 'si' | 'no' | ausente (= actual)
];
```

## 4. Fuera de alcance

- **No** se toca el Motor (`engine/Imagen.php`): el alfa ya viaja como SMask.
- **No** se toca el servidor: la politica vive en el `campo.js` (spec 020 D4: el
  cargador ya no se valida en PHP; constitution §III: el servidor nunca evalua JS).
- **No** cambia el formato de los archivos (eso es la 026).
