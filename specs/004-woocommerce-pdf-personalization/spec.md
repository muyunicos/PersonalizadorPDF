# Personalización de Productos PDF para WooCommerce

> **Estado (2026-09-17)**: reescrito a norma vigente (`constitution` §I+§IV +
> decisiones 2026-09-17). Tasks viejas en `_archivo-tasks-2026-09-13.md`.

**Branch**: `004-woocommerce-pdf-personalization` | **Created**: 2026-09-13 | **Reescrito**: 2026-09-17

## Contexto

Plugin WordPress que asocia PDFs con placeholders a productos WooCommerce. El cliente
personaliza en ficha, aprueba vía mockup ("Vista previa") y descarga el PDF tras el pago.
Norma tecnica: `constitution` §I+§IV (mockup obligatorio salvo `preview_omisible`,
sesion por item, pool dedicado, `preview_estado`).

---

## Descripción del Producto

Admin: sube PDFs (grupos por color, `id` hex) → asocia a N productos Woo
(`postmeta _pmu_pdf_slug` + espejo `config.json`) → define campos reutilizables
→ mapea grupos (`value`/`settings` con `[campoN]`, array = loop) → compone N mockups
(editor 300x300, capas + filtros) → decide `preview_omisible` (default `false`).

Cliente: completa campos → "Vista previa" (galeria 300x300 + flechas) →
agrega al carrito (el visto bueno ES agregar; cantidad 1) → paga →
descarga desde lista Woo nativa (boton "Descargar": render cliente + Motor).

## Roles de Usuario (norma 2026-09-17)

### Administrador (WordPress)
- Sube PDFs, activa/desactiva (`config.json:activo`), asocia a productos Woo.
- Crea campos reutilizables (texto, imagen con `selector-pmu`, override; valor dual).
- Mapea grupos (`placeholders[id]`: `tipo`/`preset`/`value`/`settings`) + comportamiento array.
- Compone mockups (`config.json:mockups[]`), sube fotos (`pdfs/{nombre}/mockups/` o `img/`), decide `preview_omisible`.
- Revisa "completados" (filtro `preview_estado`) y regenera si hace falta.

### Cliente (WooCommerce)
- Completa campos, pulsa "Vista previa", navega mockups, agrega al carrito.
- Edita item desde carrito (misma carpeta, re-render in-place).
- Descarga PDFs desde lista nativa Woo post-pago.

## User Scenarios & Testing (norma 2026-09-17)

### Escenario 1: Admin configura producto (P1)
Sube PDF → 2 grupos → mapea campos → compone 2 mockups → asocia a producto Woo.
**Aceptacion**: `analisis.json` + `config.json` listos; ficha muestra campos + "Vista previa".

### Escenario 2: Cliente con mockup (P1)
Completa → "Vista previa" (paralelo) → agrega → paga → descarga.
**Aceptacion**: `preview_estado=ok`; pool + webp en sesion; PDF en `orders/`.

### Escenario 3: Omisible sin mockup (P2)
`preview_omisible=true`: agrega directo; PDF se genera al pagar/en Descargas.
**Aceptacion**: `preview_estado=omisible`.

### Escenario 4: Fallo no frena venta (P2)
Vista rota → se oculta; sin vistas → "no hay vista previa" + compra habilitada.
**Aceptacion**: `preview_estado=sin_vista`; reintento silencioso en Descargas.

### Escenario 5: Admin revisa "completados" (P2)
Filtra por estado, ve webp + valores, regenera.
**Aceptacion**: filtro OK, prueba visible, regeneracion OK.

## Funcionalidades Requeridas (norma 2026-09-17)

### FR-1: PDFs
- FR-1.1: Subir → `pdfs/{nombre}/{nombre}.pdf` + `analisis.json` inmutable.
- FR-1.2: Deteccion (opacidad ≤0.001, min 10x5pt, `id` hex, orden lexicografico).
- FR-1.3: Activar/desactivar. FR-1.4: Borrar (nunca `orders/` ni sesiones ajenas).

### FR-2: Vinculo Woo
- FR-2.1: 1 PDF → N productos (`postmeta _pmu_pdf_slug` + espejo `config.json`).
- FR-2.2: Panel en ficha solo si activo y asignado. FR-2.3: Remover asignacion.
- FR-2.4: Cantidad 1 + `unique_key=uuid` (jamas fusionar lineas).

### FR-3: Campos
- FR-3.1: CRUD `campos.json` (id auto, nunca reutilizado; sin miniaturas, se reconocen por id numeral).
- FR-3.2: texto/imagen/override; `titulo_cliente`; HTML/CSS con scope; `script(ctx,root)` sandbox.
- FR-3.3: Valor dual; array o unico lo define el campo.
- FR-3.4: Imagen `selector-pmu` (subida + recorte/ajuste en Canvas): el **tamaño final en px lo define el campo/PDF**; sin límite de peso: el cliente edita la imagen y al aceptar el ajuste al marco se guarda en el servidor la versión recortada al tamaño indicado.

### FR-4: Mapeo
- FR-4.1: `placeholders[id]={tipo,preset,value,settings,repetir}` (`[campoN]`); `repetir` = checkbox `[v] Repetir por placeholder` (por campo/código).
- FR-4.2: Un campo → N grupos. FR-4.3: Si el resultado es array (o `repetir` activo), un valor por instancia en loop; `N≠M` se avisa y bloquea la generación (nunca PDF a medias).
- FR-4.4: `manifest.archivos[]={pdf,grupo_id,indice,file}` (Motor lee indice). Si falta un archivo del indice, el item queda `sin_vista` (el estado no cambia; la causa parcial queda en el detalle del manifest/meta para el admin).

### FR-5: TextMuy
- FR-5.1: Preset + overrides por grupo. FR-5.2: Render cliente → PNG al pool.
- FR-5.3: Editor mockups reutiliza TextMuy (iframe/modo, bump `?v=RCn`).

### FR-6: Mockups
- FR-6.1: N mockups (`config.json:mockups[]`), capas en cualquier orden, filtros por capa (solo mockup).
- FR-6.2: "Vista previa" + leyenda; galeria 300x300 + flechas; "Generando..." paralelo sin CLS.
- FR-6.3: `preview_omisible` default false, visible solo con mockups.
- FR-6.4: Re-edicion oculta galeria; regeneracion parcial por hash.
- FR-6.5: Multi-PDF: carrito con todos los no-omisibles listos; carrusel concatena.

### FR-7: Sesion
- FR-7.1: `sid` UUID propio (cookie 30 dias); `draft-{uuid}/` → `{cart_item_key}/` → `tmp/orders/` → `orders/`.
- FR-7.2: Pool dedicado (`img/{pdf}-{id}-{n}.png`); webp 300x300 al agregar (todos).
- FR-7.3: Editar in-place; borrar quirurgico; TTL individual (drafts 24h).
- FR-7.4: Meta canonica + espejo sesion (Motor nunca lee meta Woo).

### FR-8: Pedidos
- FR-8.1: `rename()` → `orders/{order_id}/{item_key}/` (+ `{pdf}_procesado.pdf`).
- FR-8.2: Lista Woo nativa (fila por PDF; sin ZIP).
- FR-8.3: "Descargar" = render + Motor (reintentable); `sin_vista` → reintento silencioso.
- FR-8.4: `preview_estado` en meta; "completados" filtra (`sin_vista` primero).
- FR-8.5: Sin vistas → "no hay vista previa" + compra habilitada.

## Criterios de Éxito
- SC-1: Admin configura en <10 min. SC-2: Cliente compra en <5 min.
- SC-3: PDF <10 s tras pagar. SC-4: Vista <5 s (paralelo).
- SC-5: 0 ventas perdidas por fallo render.
- SC-6: 3 agregados del mismo producto con distintos valores conservan cada uno sus valores, pool y webp (0 lineas pisadas).
- SC-7: 100% configs sin pisar analisis.

## Casos Borde (norma 2026-09-17)
- Sin placeholders: sin panel. Campo compartido: una vez. N≠M: se avisa y bloquea la generacion de ese PDF.
- Imagen opcional vacia: hueco intacto (foto final, sin marcos).
- Imagen del cliente: se guarda la version recortada al tamaño indicado (sin rechazo por peso); tipos no validos se rechazan con mensaje comprensible.
- Preset invalido en vista: se oculta; sin vistas → `sin_vista` + venta OK.
- Re-edicion: re-render in-place.

## Supuestos
- Placeholders transparentes (CorelDRAW). TextMuy integrado; PHP nunca evalua JS.
- Woo activo; `uploads/pmu/` raiz unica; sin tablas custom ni datos en plugin.
- Pool PNG (Motor) + webp (prueba); fotos en `pdfs/{nombre}/mockups/` o `img/`.
- Sin limites de mockups/capas; imagen del cliente sin limite de peso (se guarda la version recortada al tamaño indicado).

## Límites
- Sin edicion avanzada (recorte + filtros mockup). Sin "re-comprar" (futuro).
- Sin retencion auto de `orders/` (la programa el admin). Sin animacion.

---
--- HISTORICO 2026-09-13 (derogado por norma 2026-09-17, se conserva abajo) ---

### Cliente (WooCommerce) [HISTORICO 2026-09-13, derogado arriba]
- Ve campos de personalización en la página del producto
- Ingresa textos, selecciona opciones (color, fuente, ajustes, etc.) y sube imágenes según lo permitido
- Ve la vista previa del resultado sobre el mockup al tocar el botón de generar vista previa
- Compra el producto personalizado
- Descarga el PDF desde la página de éxito y por email

---

## User Scenarios & Testing [HISTORICO 2026-09-13, derogado arriba]

### Escenario 1 [HISTORICO]: Administrador configura producto

**Flujo:**
1. Admin sube PDF base (ej: `Etiquetas-condimentos-con-logo.pdf`)
2. Sistema detecta dos grupos de placeholders automáticamente
3. Admin crea o selecciona campos existentes:

```text
---
id: 56
title: Condimentos
type: text
desc: Campo para que el cliente ingrese hasta 12 condimentos
content: <div>Escribe la lista de condimentos:<textarea id="campo56" rows="12"></textarea></div>
script (opcional): document.getElementById("campo56").value.split(/\r?\n/)
---
id: 33
title: Logo
type: img
desc: logo del cliente 500x500
content: <div>Carga tu logo o selecciona una imagen (opcional):<button onclick="selector-pmu('campo33','500','500',0,'c','logos-hogar')">Personalizar Logo</button></div>
script (opcional): (vacio)
```

4. Admin asigna el PDF al producto "Etiquetas para condimentos con Logo Personalizado"
5. Admin mapea el grupo 2 de placeholders al campo 56 y el grupo 1 al campo 33
6. Admin asigna el preset "condimentos" de TextMuy
7. Admin define el mockup (imagen de fondo para la vista previa)
8. Admin configura los placeholders para imagen (el mockup muestra dos frascos de condimentos; el admin coloca dos placeholders de cada grupo y los alinea a las posiciones correspondientes)

**Criterios de aceptación:**
- PDF aparece en el listado de productos PDF
- Placeholder visible en el panel de configuración
- Producto WooCommerce muestra panel de personalización
- Campos definidos aparecen en el producto
- La vista previa del cliente muestra el mockup con la personalización superpuesta

### Escenario 2: Cliente personaliza producto

**Flujo:**
1. Cliente entra a la página de producto con personalización
2. Ve los campos de personalización debajo de la descripción
3. Ingresa texto en los campos disponibles; selecciona color, fuente y otros overrides si están disponibles
4. Sube imagen mediante `selector-pmu`: ajusta el recorte al espacio disponible y guarda los cambios (la imagen se sube al servidor en el tamaño definido con el recorte que decidió el cliente)
5. Puede ver la vista previa del resultado (al tocar el botón de generar vista previa)
6. Agrega al carrito y completa la compra
7. En la página de éxito, ve el link para descargar el PDF
8. Recibe email con el link de descarga

**Criterios de aceptación:**
- Los campos aparecen correctamente en el producto
- La vista previa se genera con los datos ingresados (colores, fuentes, textos, imágenes, etc.)
- El PDF se genera tras el pago
- Los links de descarga funcionan
- Las imágenes del cliente quedan guardadas en el servidor en formato `.webp`

### Escenario 3: Administrador revisa sesión

**Flujo:**
1. Pedido WooCommerce se completa
2. Sistema crea carpeta `uploads/pmu/orders/{order_id}/`
3. Se guardan datos de campos, imágenes (.webp) y PDF generado
4. Admin puede revisar en el panel del plugin

**Criterios de aceptación:**
- Carpeta de la sesión existe
- Archivos generados están presentes
- Datos de personalización son accesibles

---

## Funcionalidades Requeridas [HISTORICO 2026-09-13, derogado arriba]

### FR-1 [HISTORICO]: Gestión de Productos PDF
- FR-1.1: Administrador puede subir PDFs base
- FR-1.2: Sistema detecta placeholders automáticamente
- FR-1.3: Administrador puede activar/desactivar PDFs (para que se muestren o no en las páginas de productos)
- FR-1.4: Administrador puede administrar y eliminar PDFs

### FR-2: Asignación Producto-PDF
- FR-2.1: Administrador puede asociar un PDF a uno o más productos WooCommerce
- FR-2.2: El producto WooCommerce muestra el panel de personalización si tiene un PDF asignado y activo
- FR-2.3: Administrador puede remover la asignación

### FR-3: Gestión de Campos
- FR-3.1: Administrador puede crear campos reutilizables (ID único)
- FR-3.2: Cada campo tiene tipo (texto, imagen, override), title (nombre de la opción visible al usuario), desc (descripción del campo para el admin), content (contenido html), script (script de transformación opcional) y script-cliente (cómo se muestra al cliente el valor de la opción)
- FR-3.3: Los campos pueden reutilizarse en múltiples PDFs
- FR-3.4: Para imágenes, el admin define transparencia (sí/no), tamaño en px y opciones del editor simple de recorte/ajuste

### FR-4: Mapeo de Placeholders
- FR-4.1: Administrador puede mapear un placeholder a campos y/o expresiones (script opcional)
- FR-4.2: Un campo puede mapearse a múltiples placeholders
- FR-4.3: Si un campo o expresión devuelve un array, los elementos del array se aplican a cada uno de los placeholders del grupo en loop

### FR-5: Integración TextMuy
- FR-5.1: Administrador puede asignar un preset de TextMuy a un placeholder de tipo texto
- FR-5.2: Administrador puede definir campos y/o expresiones para los overrides de un preset asignado a un placeholder (fuente, color, etc.)
- FR-5.3: Los presets están disponibles desde la galería de TextMuy

### FR-6: Vista Previa del Mockup
- FR-6.1: El cliente ve el mockup con la personalización superpuesta, renderizado en el navegador
- FR-6.2: La vista previa se genera cuando el cliente ingresa los datos y toca el botón de generar vista previa
- FR-6.3: Administrador puede subir uno o más mockups para cada PDF, o no subir ninguno

### FR-7: Procesamiento de Pedidos
- FR-7.1: Al completar el pedido, el sistema genera el PDF personalizado
- FR-7.2: El PDF generado se almacena en `uploads/pmu/orders/{order_id}/`
- FR-7.3: Los datos de campos, las imágenes (.webp) y los archivos generados se guardan con la sesión

### FR-8: Entrega al Cliente
- FR-8.1: El cliente ve el link de descarga en la página de éxito
- FR-8.2: El cliente recibe un email con el link de descarga
- FR-8.3: El link permite descargar el PDF personalizado

### FR-9: Límites y Validaciones
- FR-9.1: Administrador puede definir límites mediante expresiones personalizadas y la integración con `selector-pmu` (gestor de subidas a desarrollar)

---

## Criterios de Éxito

### SC-1: Configuración de Producto
- Un administrador puede configurar un producto con personalización en menos de 5 minutos

### SC-2: Experiencia del Cliente
- Un cliente puede completar la personalización y la compra en menos de 3 minutos

### SC-3: Generación de PDF
- El PDF personalizado está disponible en menos de 10 segundos tras completar el pedido

### SC-4: Vista Previa
- La vista previa está disponible en menos de 1 segundo tras tocar el botón de generar vista previa

### SC-5: Soporte
- El sistema debe permitir configurar al menos 5 tipos de campos diferentes por producto

---

## Entidades Clave [HISTORICO 2026-09-13, derogado arriba]

### PDF
- ID (automático, único)
- Archivo (ruta en `uploads/pmu/pdfs/`)
- Estado (activo/inactivo)
- Productos asociados (array de IDs de WooCommerce)
- Mockups (ruta en la carpeta del PDF, con `mckp.json` para los ajustes de los mockups)
- Placeholders

### Campo
- ID (automático, único)
- Tipo (texto, imagen, override)
- Contenido (objeto html)
- script (script de transformación opcional)
- titulo-cliente (nombre de la opción para el cliente; si está vacío, se oculta al cliente)
- valor-cliente (script normalizador opcional del valor mostrado)
- Texto de ayuda
- Etiquetas (categorías para reutilización)

### Placeholder
- ID (dentro del PDF)
- Posición en el PDF
- Campos mapeados (array de IDs de campos y/o script)
- Expresiones de transformación
- Preset TextMuy asignado y overrides (array de IDs de campos y/o script)

### Sesión
- Número de pedido WooCommerce
- Datos de campos (por producto)
- Imágenes subidas (.webp)
- PDF generado
- Archivos temporales

---

## Casos Borde [HISTORICO 2026-09-13, derogado arriba]

- PDF sin placeholders detectados: el producto no muestra panel de personalización
- Producto con más de un PDF asignado y un campo compartido: el campo se muestra una sola vez
- Array de N elementos y grupo con M placeholders (N distinto de M): el sistema informa el desajuste antes de generar el PDF
- PDF sin mockup y sin disposición de placeholders definida: el botón de vista previa no se muestra al cliente
- Campo de imagen opcional sin archivo subido: se genera el PDF sin esa imagen
- Imagen que supera el tamaño o el recorte definido por el campo: se rechaza con un mensaje comprensible
- Preset o script inválido al generar el PDF final: la sesión queda marcada y el admin recibe el detalle del error

---

## Clarificaciones [HISTORICO 2026-09-13]

### Sesión 2026-09-13

- Q: ¿Cómo se gestionan los campos de personalización? → A: Admin técnico gestiona campos reutilizables con código HTML/CSS en una pestaña dedicada del plugin
- Q: ¿Qué estructura tiene un campo? → A: id (auto), title, desc (opcional), content (HTML del cliente), script (opcional), texto de ayuda, valor-cliente, categoría
- Q: ¿Cómo se genera el nombre del archivo? → A: Admin define un patrón con campos normalizados (ej: `etiquetas-personalizadas-{campo1}-{campo2}.pdf`)
- Q: ¿Los campos se repiten por PDF? → A: No, los campos seleccionados se muestran una vez por producto incluso si tiene múltiples PDFs
- Q: ¿Cómo se procesan placeholders con array? → A: Si el campo o script devuelve un array, cada placeholder del grupo se procesa con cada ítem en loop
- Q: ¿La vista previa es automática o por botón? → A: Por botón, el cliente toca para generar la vista previa (no se actualiza automáticamente)
- Q: ¿Qué alcance debe tener el componente `selector-pmu` en esta feature? → A: Incluir en scope como feature básica (subida + recorte simple)

## Supuestos [HISTORICO 2026-09-13, derogado arriba]


- Los placeholders en los PDF se detectan como rectángulos transparentes
- TextMuy está disponible en `modules/textmuy/`
- WooCommerce está instalado y activo
- PHP 8.5.4 disponible en el servidor
- La vista previa se renderiza en el navegador del cliente
- Las imágenes del cliente se convierten a `.webp` en el servidor
- `selector-pmu` es un componente a desarrollar: gestiona la subida, el recorte y el guardado de las imágenes del cliente
- El mockup es opcional: cada PDF puede tener 0, 1 o varios

---

## Límites [HISTORICO 2026-09-13, derogado arriba]

- No incluye edición avanzada de imágenes (solo recorte/ajuste básico)
- No incluye animación de los PDF generados
