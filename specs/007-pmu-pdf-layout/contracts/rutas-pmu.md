# Contract: Mapa de rutas del motor (`PMU_Uploads`)

**Feature**: 007-pmu-pdf-layout | **Version**: 2 (subambitos `tmp/`: `muestras/`, `cart/`, `orders/`;
resultado final por linea en `orders/{order_id}/{pdf}/`)

Unica fuente de verdad de almacenamiento (Constitucion II). Ninguna ruta se arma fuera de esta
clase. Raiz unica: `wp-content/uploads/pmu/`.

## Ambitos

| Ambito | Carpeta | Proposito | Catalogo |
|--------|---------|-----------|----------|
| `pdfs` | `uploads/pmu/pdfs/` | Productos PDF (una carpeta por PDF con sus datos) | no |
| `tmp` | `uploads/pmu/tmp/` | Ambito de trabajo transitorio (con subambitos) | no |
| — `muestras` | `uploads/pmu/tmp/muestras/` | Muestras del panel admin: idempotentes, se sobrescriben por PDF | no |
| — `cart` | `uploads/pmu/tmp/cart/` | Borradores y lineas activas del carrito (`tmp/cart/{linea}/`, TTL) | no |
| — `orders` | `uploads/pmu/tmp/orders/` | Staging de pedidos en preparacion (`tmp/orders/{order_id}/`) | no |
| `orders` | `uploads/pmu/orders/` | Resultados de pedidos WooCommerce confirmados (por linea) | no |
| `fonts` | `uploads/pmu/fonts/` | Tipografias del editor | `fonts.json` |
| `img` | `uploads/pmu/img/` | Recursos reutilizables del editor | `img.json` |
| `tm-presets` | `uploads/pmu/tm-presets/` | Presets TextMuy | `presets.json` |

## Accesos publicos requeridos

| Metodo | Devuelve | Ejemplo |
|--------|----------|---------|
| `dir_ambito($ambito, $crear = false)` | Carpeta del ambito | `uploads/pmu/pdfs` |
| `dir_pdf($nombre, $crear = false)` | Carpeta del producto | `uploads/pmu/pdfs/circulo6cm` |
| `ruta_pdf($nombre)` | Archivo del producto | `uploads/pmu/pdfs/circulo6cm/circulo6cm.pdf` |
| `ruta_metadata($nombre)` | Dataset del producto | `uploads/pmu/pdfs/circulo6cm/metadata.json` |
| `dir_tmp_muestras($pdf, $crear = false)` | Temporales de muestras del panel | `uploads/pmu/tmp/muestras/circulo6cm` |
| `ruta_aplicado($pdf, $id, $ext)` | Imagen aplicada de un grupo (muestra) | `uploads/pmu/tmp/muestras/circulo6cm/0000FF.png` |
| `ruta_salida_tmp($pdf)` | PDF procesado de muestra | `uploads/pmu/tmp/muestras/circulo6cm/circulo6cm_procesado.pdf` |
| `dir_tmp_cart($linea, $crear = false)` | Borrador/linea del carrito | `uploads/pmu/tmp/cart/{linea}/etiqueta-abuela` |
| `manifest_cart($linea)` | Manifiesto de la linea | `uploads/pmu/tmp/cart/{linea}/manifest.json` |
| `dir_tmp_order($order_id, $crear = false)` | Staging del pedido | `uploads/pmu/tmp/orders/1523/etiqueta-abuela` |
| `dir_order($order_id, $crear = false)` | Carpeta del pedido confirmado | `uploads/pmu/orders/1523` |
| `ruta_order_pdf($order_id, $pdf)` | Salida final de una linea | `uploads/pmu/orders/1523/etiqueta-abuela/etiqueta-abuela_procesado.pdf` |
| `url_ambito($ambito)` | URL publica del ambito | `https://sitio/wp-content/uploads/pmu/pdfs/` |

## Reglas

1. Los ambitos escriturables son `pdfs`, `tmp`, `orders`, `fonts`, `img` y `tm-presets`; un ambito
   desconocido produce `motor:<op>:ambito:invalido`.
2. `$nombre` (PDF), `$linea` (carrito: cart item key) y `$order_id` (pedido) se sanean con el mismo
   criterio para datos (`nombre_seguro` / `Metadata::nombreDesdeArchivo`): minusculas,
   `[a-z0-9_-]`, sin extension, no vacio. Los cart item keys de Woo no contienen `/` y son seguros
   como nombre de directorio; aun asi pasan por el mismo saneo.
3. Crear carpeta cuando no existe y los permisos fallan produce
   `motor:<op>:directorio:no_escribible` (excepcion con causa); nunca se silencia.
4. `pdfs/` puede contener archivos sueltos (fixture `muestra.pdf`): no son productos y el listado
   de la consola los ignora (solo se listan `pdfs/*/{nombre}.pdf`).
5. Sin rutas heredadas: `uploads/personalizador-pdf/` y `uploads/extractor-corel/` no se leen
   nunca (salvo el paso unico de migracion de la feature 007).
6. Sin archivos generados dentro de la carpeta del plugin.
7. Una linea de carrito = una personalizacion (clave unica, FR-018): `tmp/cart/{linea}/`. Si la
   personalizacion canonica y su `pmu_hash` coinciden con una linea existente de la misma sesion,
   se fusiona (cantidad + 1) en vez de crear un directorio nuevo.
8. Staging -> entregable: `tmp/orders/{order_id}/` se promueve SOLO por confirmacion de pago a
   `orders/{order_id}/` mediante `rename()` atomico; el cableado a hooks Woo vive en spec 004
   (FR-020).
9. Limpieza por alcance: la consola admin solo toca `pdfs/` y `tmp/muestras/`; lo demas se limpia
   por linea (FR-019) o por TTL (`creado`) en `tmp/cart/` y `tmp/orders/`, nunca en `orders/`.

## Criterios de aceptacion

- Ningun archivo bajo `pdfs/`, `tmp/` u `orders/` se crea o borra fuera de estos accesos.
- Subir un PDF crea `pdfs/{nombre}/{nombre}.pdf` y `pdfs/{nombre}/metadata.json` y nada mas.
- Procesar desde la consola escribe solo en `tmp/muestras/{pdf}/` (sobrescribiendo).
- `orders/{order_id}/` queda intacto para cualquier operacion de la consola.