# Spec 029 — El pool solo guarda lo que se genera (las fotos se referencian)

> Estado: **implementada** (2026-10-20). Release: 4.20.0.
> Aprovecha la D11 de la **028** (el PNG del comprador ya mide el lienzo) y la
> 026 (WebP por firma). **El Motor y el formato del pedido no cambian.**

## 1. Problema

Al pulsar **Vista previa** se creaban cientos de archivos en `{item}/img/`, y eran
**copias** de alguna imagen de `{item}/subidas/`. Dos causas que se multiplican:

1. `PURO.conciliarGrupo()` (`assets/tienda.js`) devuelve, cuando el campo publica
   **un solo valor**, una **copia por instancia** del grupo (`M = cont`). El cliente
   iteraba esa lista y subia **una vez por instancia**: fotos (`subirFotos`) y texto
   (`pendientes`).
2. Cada entrada se convertia en un archivo: la foto se **descargaba**, se
   **rasterizaba** al hueco y se **subia** al pool (`img/{pdf}-{gid}-{n}.{ext}`,
   `n` incrementando); el texto se **renderizaba N veces** en TextMuy y se subia N veces.

Con 1 grupo x 100 instancias y una foto + un texto: **200 archivos**, ~12 MB
subidos por la red movil y ~12 MB en disco **para una sola foto**. Y no hacian
falta: `item_generar_pdfs` **ya replica** una sola fila a todo el grupo
(`count === 1 ? reset : array_values`).

Ademas, con la D11 de la 028 la subida **es** la imagen compuesta (mide el lienzo),
asi que el rasterizado del pool era un **re-encode WebP→WebP de la misma imagen**:
no agregaba informacion.

**Hallazgo lateral**: la fila guardaba `indice` = **numero de archivo** (`$n - 1`),
y las instancias 2..N de un grupo subian **en paralelo** → con dos fotos distintas
en un grupo, el orden de las filas podia no coincidir con el de las instancias y el
PDF asignaba la foto equivocada.

## 2. Decisiones

| # | Decision |
|---|----------|
| **D1** | **Las fotos del comprador se REFERENCIAN, no se copian**: la fila de `manifest.archivos[]` apunta a `subidas/{id}.{ext}` (el archivo que ya subio). El cliente manda los **ids por instancia** (un POST por grupo, **sin bytes**); el servidor los valida contra `manifest.subidas[]` (nunca arma una ruta con lo que manda el cliente) y escribe la fila. Cero descargas, cero rasterizado, cero copias. El mockup usa la URL de la subida (`urlDeSubida`). |
| **D2** | **El pool (`img/`) guarda solo lo que se GENERA** (el texto, que solo el navegador puede renderizar) y **una sola vez por grupo**: si todas las instancias llevan el mismo hash, se renderiza y se sube **una** vez y la fila queda con `indice` 0 (el Motor la replica). La dedup es **por grupo y total**: la lista que consume el Motor es **posicional**, asi que con textos distintos hace falta una fila por instancia. |
| **D3** | **`indice` = POSICION de la instancia (0-based)**, no el numero de archivo: lo manda el cliente (`indice` en el POST del pool) y lo usa el Motor como orden. Arregla el hallazgo lateral. |
| **D4** | La fila lleva **`origen`**: `'subida'` (referenciada de `subidas/`) o `'texto'` (generada en `img/`). Hace el manifest auto-explicativo (auditoria, inventarios). |
| **D5** | **Sin compatibilidad**: nada de lo guardado se migra (no hay datos en produccion). Re-registrar un grupo **reemplaza** sus filas (idempotente): no acumula. |
| **D6** | **El Motor, el servidor de descargas y el formato del pedido no cambian**: el arbol del item viaja entero (`copiar_arbol` + `promover_order` por `rename`), asi que `subidas/` esta en `orders/{id}/{item}/` cuando el PDF se arma. |

## 3. Contrato (fila de `manifest.archivos[]`)

```json
{ "pdf": "muestra", "grupo_id": "0000FF", "indice": 0,
  "file": "subidas/9f2c41ab0d7e.webp", "hash": "", "origen": "subida" }
```

- `file` es **relativo al item** (el Motor arma `$dir . '/' . file`).
- `origen: 'subida'` → la foto del comprador (el id sale de `manifest.subidas[]`).
- `origen: 'texto'` → el render de TextMuy (`img/{pdf}-{grupo}-{n}.{ext}`, con
  `hash` para el render parcial).
- `indice` = posicion de la instancia; **una sola fila** (indice 0) cuando el
  contenido es el mismo en todo el grupo.

## 4. Efecto

| caso (1 grupo, 100 instancias, 1 foto + 1 texto) | Antes | Ahora |
|---|---|---|
| archivos del item | 200 (100 fotos + 100 textos) | **2** (1 subida + 1 texto) |
| red en la vista previa | ~12 MB (bajar + subir 100 fotos) | **~0** (1 POST de ids) |
| renders de TextMuy | 100 | **1** |
| re-encodes WebP→WebP | 100 | **0** |

El PDF sale **identico**: con `phsize: 1` (lo que trae la plantilla) el lienzo es el
hueco y el encaje del Motor sigue siendo 1:1.

## 5. Puertas

- Arnés `texto_puente.php`, fase **`fotos`** (8 checks): uniforme → 1 fila que apunta
  a `subidas/` y `img/` **vacio**; el archivo referenciado **existe**; mixto → una
  fila por instancia con el indice de instancia; un id desconocido se **omite**;
  re-registrar **reemplaza**; el endpoint (`fotos` = JSON) deja la fila con
  `origen: 'subida'` y el Motor recibe una **ruta real**.
- `node tests/selector-contrato.test.js`: la foto se registra (sin `rasterizar` ni
  `subirFotos` en el cliente), el texto uniforme se colapsa (`repite`) y el texto
  del pool lo sigue convirtiendo el servidor a WebP q0.92.

## 6. Fuera de alcance

- **Subidas huerfanas**: al reemplazar una foto se crea un id nuevo y el archivo
  viejo queda. Queda pendiente (limpieza en el reemplazo).
- **No** se toca el Motor, `item_generar_pdfs` ni los formatos de la 026/027/028.
