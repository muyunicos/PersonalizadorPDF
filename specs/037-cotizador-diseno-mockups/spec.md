# Spec 037 — Cotizador: diseno del cliente, mockup y favoritos

> Estado: **borrador** (2026-11-03). Release prevista: **4.29.0**.
> Construye sobre la 011 (nucleo de render compartido `assets/mockup-render.js`), la 012/018
> (cargador de imagenes y montaje de campos), la 021 (selector de recorte), la 030 (biblioteca
> del comprador), la 035 (original + receta v2 + `orders/{cliente}/`) y la 036 (cola de subida,
> gate del boton, mockup aplanado). **El Motor no se toca** (`engine/Pdf`, `Detector`,
> `Overlay`, `Motor`).
> **Consumidor**: la calculadora de stickers (sitio `muyunicos.com`, tema
> `generatepress-child`), que hoy calcula el precio y **no** recibe arte.
> **Alcance**: (1) **contexto de uso "cotizador"** para un consumidor externo, con ajustes
> minimos y explicitos; (2) el comprador **sube su arte** desde el cotizador y **ve un mockup
> 300x300**; (3) el **diseno viaja con el pedido** y el taller lo recupera; (4) el comprador
> **guarda favoritos** y ve su **historial** en una sola tira.
> **Fuera**: la vista de plancha A4 y el PDF de produccion (fase posterior); el arte compuesto
> por el cliente como entregable (constitution §III: viaja el ORIGINAL + receta).
> **Gobernanza**: **no** enmienda principios. Agrega `orders/{cliente}/customs/` al mapa de
> datos de §IV (patch MINOR) y su linea en `AGENTS.md` §5: es la tarea **T000** del plan y se
> documenta **antes** de implementar (regla de governance).

## Clarifications

### Session 2026-11-03

- Q: "opcion 1, 2, 3" son tres propuestas comparables del mismo pedido? → A: **No**. Es **un
  diseno por pedido**; las "opciones" son las **tarjetas de la tira**. La tira mezcla en una
  sola superficie los items de la tienda, los **customs del comprador** y su **historial**, con
  el mismo formato de tarjeta; cualquier item es favoritable y la estrella lo mueve al inicio
  (FR-019, FR-020, D4).
- Q: Cuenta obligatoria o carpeta propia del cotizador para invitados? → A: **Nadie compra sin
  ser cliente**. El invitado guarda en su navegador y en el almacenamiento temporal del
  servidor; en su primera compra **se adopta todo** a su carpeta de cliente y al pedido
  (FR-029, FR-030, FR-031, D6).
- Q: Precio del favorito congelado o recalculado? → A: **Recalculado al cargar**; la tarjeta
  solo se actualiza cuando el numero cambia. El mockup y la configuracion **no** cambian por un
  cambio de precio (FR-027, D7).
- Q: Resolucion insuficiente y sangrado? → A: **No se avisa ni se bloquea** en la primera
  version. **Fondo blanco solido** por defecto para todas las formas (sin transparencia)
  (FR-012, FR-013, D8).
- Q: Como se entera el plugin de que lo usa el cotizador? → A: Se **reusa el contexto
  existente** (`data-pmu-panel` + `PMU_TIENDA`) y se agrega **una** clave en el manifest
  (`contexto`). **No** se reusa `subidas[].origen`, que es vocabulario de la 035 (D5).

## 1. El problema (verificado en el codigo)

1. **El cotizador no recibe arte.** Calcula precio, material, forma, tamano y planchas, pero la
   imagen del cliente viaja por WhatsApp o queda para despues del pago. El pedido nace sin
   diseno y el taller lo persigue.
2. **El comprador elige a ciegas.** Forma y tamano se eligen sin ver como queda el sticker
   terminado: no hay mockup en el cotizador.
3. **La tira "Ideas (opcional)" es solo del admin.** No hay lugar para lo que el comprador ya
   probo (sus propias propuestas) ni para lo que ya compro (historial).
4. **El plugin no sabe que lo usa otro producto del sitio.** Su ciclo de pedido asume un PDF con
   placeholders (`item_key`, promocion, entrega) y su carga de assets esta atada a la ficha de
   producto (`assets_ficha_condicional()` en `is_product()`).
5. **Lo necesario ya existe**: selector con guia de forma, visor, biblioteca, nucleo de mockup
   300x300, cola de subida con dedupe y promocion al pedido. Falta el **contexto** y el
   **puente**, no un segundo motor.

## 2. Decisiones

| # | Decision |
|---|---|
| **D1** | **Un solo diseno por pedido.** El comprador puede crear, guardar y comparar cuantas tarjetas quiera en la tira, pero el pedido lleva **un** arte. |
| **D2** | **El arte viaja como ORIGINAL + receta declarativa** (constitution §III): el navegador compone **solo la vista previa** y el servidor compone el arte a imprimir. Nada de bitmaps compuestos por el cliente como entregable. |
| **D3** | **El mockup es una simulacion 300x300** (constitution §I): foto de escena + hueco con la forma y la proporcion reales. No es el PDF. |
| **D4** | **Una sola tira, tres origenes:** items de la tienda, customs del comprador e historial, con **el mismo formato de tarjeta**. La estrella es una accion de **cualquier** item y ordena al inicio. El nombre visible de la tira es configurable (propuesta: "Ideas y favoritos"). |
| **D5** | **Contexto explicito y minimo:** `data-pmu-panel` + `data-pmu-contexto="cotizador"` en el DOM, `PMU_TIENDA.contexto` en JS y `manifest.contexto` en los datos. **No** se reusa `subidas[].origen` (vocabulario de la 035). Una fachada publica (`PMU_Cotizador`) expone solo lo necesario y un filtro permite apagarla sin deploy. El contexto **nunca es seguridad**: no habilita capacidades, solo decide ciclo de vida y entrega. |
| **D6** | **Invitado = navegador + temporal; cliente = carpeta.** Mientras no haya compra, los customs viven en el navegador y en `tmp/sesion-{sid}/customs/`; en la **primera compra** se promueven a `orders/{cliente}/customs/` y el pedido queda con su diseno. **Nadie compra sin ser cliente** (sin `customer_id` no hay promocion: 035 D5). |
| **D7** | **Precio vivo:** el precio de una tarjeta se **recalcula al cargar** con el catalogo vigente y solo se actualiza cuando cambia. El precio guardado es una **foto** con fecha, para mostrar "actualizado". |
| **D8** | **Blanco por defecto, sin avisos de calidad:** `transp: 'no'` + fondo `#ffffff` para todas las formas; ninguna advertencia ni bloqueo por resolucion en la primera version. |
| **D9** | **El fallo nunca frena la venta** (036 D5): si el puente, la subida o el mockup fallan, el comprador sigue cotizando y comprando, y se le ofrece mandar el arte por otro canal. |
| **D10** | **Carga diferida:** el cotizador abre con **0 KB** de los modulos de diseno; se cargan al abrir el paso y, el resto, al tocar "Cargar imagen" (Anexo B). |

## User Scenarios & Testing *(mandatory)*

### User Story 1 - El admin define el mockup del producto (Priority: P1)

El administrador elige, para una categoria de forma (y opcionalmente para un tamano), una foto
de escena y el hueco donde se ubicaria el sticker, con la forma y la proporcion reales del
producto. Ve una vista previa con una imagen de muestra antes de publicarlo.

**Why this priority**: sin mockup no hay nada que mostrarle al comprador; es el cimiento de la
historia 2 y del valor de la feature.

**Independent Test**: se prueba solo: el admin arma fondo + hueco, guarda, recarga y la vista
previa coincide con lo guardado. Entrega valor interno (el equipo ve exactamente lo que vera el
comprador).

**Acceptance Scenarios**:

1. **Given** un catalogo con categorias de forma, **When** el admin define un mockup para una
   categoria con foto de escena y hueco, **Then** queda guardado y aplica solo a esa categoria.
2. **Given** un mockup sin hueco o sin fondo, **When** el admin intenta publicarlo, **Then** el
   sistema no lo publica y muestra la causa.
3. **Given** un mockup con override por tamano, **When** el comprador elige ese tamano,
   **Then** se usa el mockup especifico; con otro tamano se usa el de la categoria.

### User Story 2 - Subir el arte y verlo en el producto (Priority: P1)

El comprador, desde el cotizador, sube su diseno (o lo elige de sus imagenes ya subidas), ajusta
el encuadre contra la forma real del corte y ve el mockup del producto con su arte.

**Why this priority**: es el corazon de la feature: elimina el ida y vuelta por WhatsApp y
muestra el resultado antes de pagar.

**Independent Test**: con un mockup definido se prueba solo: subir una imagen, encuadrarla, ver
el mockup, cambiar de forma o tamano y ver que el hueco se re-ajusta.

**Acceptance Scenarios**:

1. **Given** un pedido con forma y tamano elegidos, **When** el comprador abre el paso de
   diseno, **Then** se le ofrece subir una imagen con una guia que respeta la forma y la
   proporcion real del sticker.
2. **Given** una imagen subida, **When** el comprador confirma el encuadre, **Then** ve el
   mockup con su arte y puede ampliarlo.
3. **Given** el comprador cambio de tamano despues de subir, **When** vuelve al paso, **Then**
   el mockup se re-encuadra sin pedirle la imagen de nuevo.
4. **Given** una imagen ya subida antes (biblioteca), **When** la elige, **Then** no se sube de
   nuevo.
5. **Given** que el diseno no esta disponible (plugin inactivo o falla), **When** el comprador
   llega al paso, **Then** puede seguir cotizando y comprar, y se le ofrece otro canal.

### User Story 3 - El diseno llega con el pedido (Priority: P2)

Al confirmarse la compra, el arte queda guardado y asociado al pedido; el taller lo descarga
desde la consola y el comprador lo vuelve a encontrar en su cuenta.

**Why this priority**: sin esto lo anterior se pierde al vencer la sesion y el pedido sale sin
arte (riesgo de negocio).

**Independent Test**: hacer un pedido con diseno en el laboratorio y recuperar el archivo desde
el pedido, sin abrir el cotizador.

**Acceptance Scenarios**:

1. **Given** un pedido pagado con diseno, **When** el admin abre el pedido, **Then** ve el
   diseno con acceso al original y al mockup aprobado.
2. **Given** un pedido ya promovido, **When** el estado se vuelve a guardar, **Then** no se
   duplican archivos ni se pierde el diseno.
3. **Given** un pedido con diseno, **When** el comprador entra a su cuenta, **Then** puede
   descargarlo y reusar la configuracion.
4. **Given** un invitado que nunca compro, **When** vuelve en el mismo navegador, **Then** sus
   customs siguen ahi (aunque el temporal del servidor haya vencido).

### User Story 4 - Ideas, favoritos e historial en una sola tira (Priority: P3)

En el lugar donde hoy estan las "Ideas (opcional)", el comprador ve **una sola tira** con los
items de la tienda, **sus customs** y su **historial**. Puede marcar con estrella cualquier item
para moverlo al inicio, borrar sus propios customs y reusar cualquiera con un toque.

**Why this priority**: fideliza y acorta la segunda compra, pero no bloquea la primera.

**Independent Test**: guardar un custom con su mockup, recargar y verlo en la tira; marcarlo y
ver que pasa al inicio; borrarlo y ver que desaparece sin dejar archivos huerfanos.

**Acceptance Scenarios**:

1. **Given** un custom con su mockup, **When** el comprador lo guarda, **Then** aparece en la
   tira con su mockup, una descripcion automatica y su precio.
2. **Given** cualquier item de la tira, **When** el comprador lo marca con estrella, **Then**
   queda como favorito y pasa al inicio; al desmarcarlo vuelve a su lugar.
3. **Given** un favorito, **When** el comprador lo toca, **Then** el cotizador se carga con esa
   configuracion y ese arte listos para comprar.
4. **Given** un custom propio, **When** el comprador lo borra, **Then** desaparece de la tira y
   su mockup deja de existir en el servidor.
5. **Given** un pedido ya realizado, **When** el comprador abre la tira, **Then** aparece en el
   historial con la misma tarjeta y las mismas acciones.
6. **Given** que el catalogo cambio de precio, **When** el comprador abre la tira, **Then** ve
   el precio vigente y un aviso de "actualizado" cuando difiere.

### Edge Cases

- El plugin de personalizacion esta inactivo, desactualizado o el puente responde error.
- La subida falla a mitad de camino y el comprador intenta comprar.
- El comprador sube la misma imagen dos veces (una sola copia).
- Imagen con transparencia, sin transparencia y logo con fondo blanco (siempre fondo blanco).
- Imagen de 200 px para un sticker de 10 cm (se acepta, sin aviso: D8).
- El comprador cambia de forma, tamano o material despues de subir.
- El comprador recarga, vuelve con Atras o abre dos pestanas con el mismo pedido.
- El comprador borra un favorito que esta usando en el carrito.
- El invitado nunca compra y el temporal del servidor vence.
- El admin despublica o borra el mockup de una categoria en uso.
- El archivo supera el limite permitido.
- El comprador ya tiene un custom con el mismo arte y la misma configuracion (no se duplica).

## Requirements *(mandatory)*

### Functional Requirements

**Contexto y compatibilidad**

- **FR-001**: El sistema DEBE permitir que otro producto del sitio (el cotizador) se declare como
  consumidor y DEBE exponerle solo las capacidades necesarias para ese uso.
- **FR-002**: El sistema DEBE distinguir los elementos creados por el cotizador de los de una
  ficha de producto, para no aplicarles el ciclo de entrega de PDF.
- **FR-003**: El sistema DEBE poder desactivar el uso desde el cotizador sin desplegar codigo.
- **FR-004**: El contexto declarado NO DEBE habilitar ninguna capacidad ni permiso.

**Diseno del comprador**

- **FR-005**: El comprador DEBE poder subir una imagen desde el cotizador con una guia que respete
  la forma y la proporcion real del sticker elegido.
- **FR-006**: El comprador DEBE poder ajustar el encuadre (modo de encaje, tamano, desplazamiento y
  giro) sin deformar la imagen.
- **FR-007**: El sistema DEBE aceptar un solo diseno por pedido.
- **FR-008**: El comprador DEBE ver un mockup del producto con su arte y poder ampliarlo.
- **FR-009**: El comprador DEBE poder reutilizar una imagen ya subida sin volver a subirla.
- **FR-010**: El sistema DEBE guardar una sola copia de cada imagen aunque se suba varias veces.
- **FR-011**: El arte a imprimir DEBE componerse en el servidor a partir del ORIGINAL del comprador
  y su encuadre declarado.
- **FR-012**: El fondo del sticker DEBE ser blanco solido por defecto en todas las formas.
- **FR-013**: El sistema NO DEBE advertir ni bloquear por resolucion insuficiente.

**Pedido**

- **FR-014**: El boton de compra DEBE permanecer deshabilitado solo mientras haya subidas en curso
  y DEBE habilitarse al vaciarse la cola.
- **FR-015**: Al confirmarse el pedido, el sistema DEBE conservar el arte y asociarlo a la linea del
  pedido, de forma recuperable aunque la sesion del comprador venza.
- **FR-016**: El sistema DEBE mostrar el diseno en el pedido (admin y comprador) con acceso a la
  descarga.
- **FR-017**: Re-guardar el estado de un pedido NO DEBE duplicar ni perder archivos.
- **FR-018**: Un fallo en cualquier punto del diseno NO DEBE impedir la compra.

**Tira, favoritos e historial**

- **FR-019**: La tira DEBE mezclar en una sola superficie los items de la tienda, los customs del
  comprador y su historial, con el mismo formato de tarjeta.
- **FR-020**: Cualquier item de la tira DEBE poder marcarse como favorito, y los favoritos DEBEN
  mostrarse al inicio.
- **FR-021**: El comprador DEBE poder borrar sus propios customs.
- **FR-022**: Tocar un item DEBE cargar el cotizador con su configuracion y, si tiene diseno, con su
  arte.
- **FR-023**: El historial DEBE listar los pedidos del comprador con su configuracion y su diseno,
  listos para reusar.
- **FR-024**: El comprador DEBE ver unicamente sus propios customs, favoritos e historial.
- **FR-025**: Un custom borrado NO DEBE dejar archivos huerfanos en el servidor.
- **FR-026**: Un custom guardado por el comprador DEBE incluir su mockup, una descripcion automatica
  y su precio.
- **FR-027**: El precio de una tarjeta DEBE recalcularse al cargar con el catalogo vigente y DEBE
  avisarse cuando difiere del guardado.
- **FR-028**: El nombre visible de la tira DEBE ser configurable por el admin.

**Identidad**

- **FR-029**: Un invitado NO DEBE poder completar la compra sin convertirse en cliente.
- **FR-030**: Mientras no compre, los customs del invitado DEBEN vivir en su navegador y en el
  almacenamiento temporal del servidor.
- **FR-031**: En la primera compra, el sistema DEBE adoptar los customs del invitado a su carpeta de
  cliente y al pedido, sin intervencion manual.
- **FR-032**: El sistema DEBE definir y respetar una ventana de retencion para customs temporales, y
  NO DEBE borrar un favorito de un cliente por vencimiento de borradores.

**Administracion del mockup**

- **FR-033**: El admin DEBE poder definir, por categoria de forma (con override por tamano), la foto
  de escena y el hueco donde se ubica el sticker.
- **FR-034**: El admin DEBE ver una vista previa fiel antes de publicar.
- **FR-035**: Un mockup incompleto NO DEBE publicarse al comprador y DEBE informar la causa.

### Key Entities

- **Propuesta de diseno (custom)**: intento de arte del comprador para un pedido. Incluye la imagen
  original, el encuadre declarado, el mockup resultante, las opciones del pedido y su precio del
  momento.
- **Mockup de producto**: foto de escena + hueco + forma + tamano al que aplica; lo define el admin
  por categoria, con override por tamano.
- **Favorito**: marca sobre **cualquier** item de la tira (de la tienda, un custom o el historial)
  que lo ordena al inicio.
- **Entrada de historial**: pedido ya realizado, con su configuracion y su diseno; se deriva de los
  pedidos del comprador.
- **Diseno del pedido**: vinculo entre una linea del pedido y el arte conservado (original +
  composicion + mockup aprobado).
- **Identidad del comprador**: quien puede ver y borrar sus customs; el invitado tiene identidad
  temporal (cookie + navegador) y se convierte en cliente con su primera compra.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El 90% de los compradores que suben un arte lo completan en menos de 2 minutos desde
  que abren el paso de diseno.
- **SC-002**: El 100% de los pedidos con diseno permiten recuperar el arte desde el pedido, incluso
  30 dias despues.
- **SC-003**: El mockup aparece en menos de 2 segundos en el 90% de los casos despues de confirmar
  el encuadre.
- **SC-004**: La pagina del cotizador muestra el precio sin descargar ninguna herramienta de diseno
  hasta que el comprador abre ese paso.
- **SC-005**: El 98% de las subidas se completan en el primer intento.
- **SC-006**: Cero archivos huerfanos despues de borrar un custom (verificado por muestreo en la
  consola de inventario).
- **SC-007**: Baja al menos un 50% las consultas "como paso el diseno" respecto del mes previo a la
  salida.
- **SC-008**: El 30% de los pedidos con diseno reutiliza una configuracion previa (favorito o
  historial) a los 90 dias de la salida.

## Assumptions

- El comprador usa un navegador moderno con almacenamiento local disponible; sin el, los customs del
  invitado viven solo en el temporal del servidor.
- El arte a imprimir se compone en el servidor; el navegador solo arma la vista previa (constitution
  §III).
- La calidad no se controla en esta version: no hay aviso ni bloqueo por resolucion (D8); el admin lo
  ve en el pedido.
- El plugin esta activo y actualizado en el sitio; si no, el cotizador degrada sin romperse (FR-018,
  D9).
- El mockup es una simulacion 300x300 del producto en uso, no el PDF final (constitution §I).
- Los customs y favoritos son privados del comprador; el admin los ve solo en el contexto del pedido
  o de su consola.
- El catalogo del cotizador (materiales, formas, precios) sigue siendo la unica fuente de precios;
  esta feature no lo duplica ni lo cachea en el servidor.
- `orders/{cliente}/customs/` se documenta en `constitution` §IV y `AGENTS.md` §5 antes de
  implementar (T000).
- La primera version usa **rectangulo** como forma para la categoria "Formas"; el campo `forma` por
  categoria queda listo para precisar despues.
- El nombre de la tira lo define el admin (propuesta: "Ideas y favoritos").

## Anexo A — Datos y rutas (normativo para la implementacion)

```
uploads/pmu/
├── tmp/sesion-{sid}/
│   ├── uploads/{id}.webp                 originales del comprador (035, existe)
│   ├── cot-{uuid}/                       item del cotizador: manifest.contexto='cotizador'
│   └── customs/                          idea.json + {idea_id}.webp (SIN manifest.json)
└── orders/{cliente}/                     (035, existe)
    ├── datos.json
    ├── uploads/{id}.webp
    ├── customs/{idea_id}/idea.json + mockup.webp      NUEVO (T000: §IV + AGENTS §5)
    └── {order_id}/{item_key}/            entregable del pedido (035, existe)
```

- `customs/` **no lleva `manifest.json`**: si lo llevara, `biblioteca_contenedores()` lo levantaria
  como item de sesion. `pedidos_completados()` y `biblioteca_contenedores()` ya exigen nivel
  numerico y lo saltean solos (verificado el 2026-11-03 sobre el codigo vigente).
- `idea.json` (una entrada): `id`, `creado`, `favorito`, `orden`, `titulo`, `descripcion`, `order`
  (codigo v1 del cotizador), `precio` (foto + `ts`), `diseno` (`id`, `itemKey`, `sid`, `w`, `h`,
  `receta`) y `mockup` (`id`, `w`, `h`, `mockupId`).
- El mockup del custom se guarda como WebP por el mismo camino que un original (cap 2000 px, dedupe
  por sha); `mockup.id` es el `id` de la fila.
- Retencion: `tmp` como hoy (drafts 24 h, items de carrito 30 d); `customs/` de un cliente **no** se
  toca por TTL de borradores (FR-032).
- El contexto viaja en `manifest.contexto = 'cotizador'` y en `data-pmu-contexto="cotizador"`; **no**
  se toca `subidas[].origen` (vocabulario de la 035).

## Anexo B — Carga en el cotizador (D10)

| Momento | Descarga | gzip |
|---|---|---|
| Cargar el cotizador | nada: el mockup vacio es `<img>` + hueco por CSS | **0 KB** |
| Abrir el paso de diseno | `mockup-render` (8,1) + `selector` (24,1), con **preload** al abrir | **32 KB** |
| Tocar "Cargar imagen" | `cargador` (9,7) + `biblioteca` (5,5) + `visor` (3,4) + `fotos` (4,6) | **23 KB** |
| Reusar un favorito | ya cargado | 0 KB |

- **No** se encolan `tienda.js` (107 KB) ni `campo-montar.js` (7 KB).
- Los tamanos estan **medidos** (raw / gzip) el 2026-11-03. El subconjunto cliente completo es
  186 KB raw ≈ **51 KB gzip**.

## Anexo C — Parametros de la tira

| Parametro | Valor inicial | Dueno |
|---|---|---|
| Nombre visible | "Ideas y favoritos" | Admin (config del cotizador) |
| Orden | favoritos primero; despues customs; despues tienda; historial al final | Producto |
| Estrella | sobre cualquier item (tienda, custom o historial) | Producto |
| Borrado | solo sobre customs propios | Producto |
| Retencion de customs de invitado | la del temporal vigente (24 h / 30 d) | Tecnico |

---

*Spec 037 generada con `/speckit-specify` (2026-11-03). Las preguntas de alcance quedaron cerradas
en Clarifications. Plan y tareas en [plan.md](./plan.md) y [tasks.md](./tasks.md) (T000 primero);
se implementa con `/speckit-implement`.*
## Enmienda v2 (2026-11-03) — PDF de produccion y mockups reusados

> Corrige la spec con lo definido por el negocio despues de la primera implementacion.
> **Supersede** (solo lo que dice aca): D3 (`preview_estado = omisible` pasa a ser **solo cuando no hay
> plantilla**), la parte de D6 que hacia del mockup un requisito, y el "fuera de alcance" del Anexo A
> sobre la plancha.

### D11 — El arte se sube SIEMPRE; el mockup es accesorio

Subir el diseno **no depende** de que exista un mockup ni una plantilla: el mockup solo ilustra. Sin mockup
el paso se muestra con un marco neutro y el comprador sube, compra y el taller recibe el archivo igual.**FR-036**.

### D12 — PDF de produccion POR CATEGORIA + TAMANO (importado, no generado)

El cotizador usa el **Motor** del plugin con un PDF **importado** desde la consola (flujo existente "Subir
PDF"): una plantilla por opcion (ej. `circulares-6cm`). El original del comprador entra en el placeholder y
el Motor entrega el **PDF listo para imprimir** (composicion server-side, §III). La plantilla se asocia a
**categoria + tamano** en el catalogo del cotizador. **Rectangulares / A Medida**: la plancha "al vuelo"
queda para una fase posterior (hoy se sube el arte y se entrega la imagen procesada). **FR-037/38/42**.

### D13 — Los mockups del cotizador SON los del "Editor de mockups"

No hay editor nuevo: el admin define los mockups en el **Editor de mockups** del PDF importado (capas,
filtros, **placeholders inteligentes con envolturas automaticas**) y el cotizador los **consume** por
`op=mockups` con la misma forma que `datos_pdf_render()`. La **forma del hueco es siempre automatica**.
**FR-039**.

### D14 — Catalogo "Mockups del cotizador"

Cada entrada: `id`, `titulo` (visible al cliente), `categoria` (**Circulares | Rectangulares | Formas/A
Medida**), `pdf` (plantilla importada, opcional), `rango` opcional (`minX,maxX,minY,maxY` en cm) que la
hace aplicable **solo** a los tamanos dentro del rango (los intermedios se resuelven solos), `visible` y
`orden`; se puede **duplicar** y **reordenar**. **FR-040/FR-041**.

### Functional Requirements (nuevos)

- **FR-036**: subir el arte nunca depende de un mockup ni de una plantilla.
- **FR-037**: si categoria+tamano tiene plantilla, el item nace con `manifest.pdfs = [plantilla]` y el
  pedido entrega **PDF** con el flujo normal del Motor; sin plantilla, `pdfs = []` y `preview_estado = omisible`.
- **FR-038**: desde el resumen del pedido (cliente y admin) se descargan **la imagen procesada** (siempre) y
  el **PDF** (solo si el item tiene plantilla), sin exponer rutas absolutas.
- **FR-039**: el mockup que ve el comprador es el del Editor de mockups del PDF (capas + envolturas),
  servido por `op=mockups`; la forma del hueco es automatica.
- **FR-040**: cada entrada del catalogo tiene titulo, categoria, plantilla opcional, rango opcional en X
  e Y, `visible` y `orden`.
- **FR-041**: duplicar y reordenar entradas del catalogo desde el admin.
- **FR-042**: sin plantilla, el PDF de produccion se genera al vuelo (rectangulares / A Medida).
  **Fuera de esta entrega**: fase posterior.

### Criterios de exito (nuevos)

- **SC-009**: un comprador sin mockup configurado sube su arte, compra y el vendedor descarga la imagen
  procesada: 0 pasos extra, 0 errores.
- **SC-010**: con plantilla, el PDF del pedido se descarga desde el resumen y tiene el arte compuesto en el
  placeholder (no el bitmap del cliente).
