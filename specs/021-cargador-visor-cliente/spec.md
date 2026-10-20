# 021 — Cargador intuitivo en móvil/PC y visor de colección del comprador

> Estado: **en implementación (2026-10-19)** — evoluciona la experiencia de
> carga y revisión de fotos del comprador (`assets/selector-pmu.js`,
> `assets/cargador-pmu.js`, `assets/tienda.js`). 100% cliente: el servidor y el
> Motor PDF no cambian.

## Objetivo

Hacer que la carga de imágenes del comprador sea inmediata, intuitiva y cómoda
para cualquier persona en **móvil** (uso principal) y en **PC**:
1. Abrir directamente el selector de archivos al tocar para cargar.
2. Lienzo `spmu-escena` con la misma relación de aspecto del placeholder, hasta
   `1000x1000 px`, adaptado al viewport disponible y con un **10% de margen
   interno** alrededor del marco secundario (placeholder `W x H`) y del marco
   principal (forma / envoltura posicionada con `size`, `ox`, `oy`).
3. **3 modos** (`Rellenar`, `Ajustar`, `Estirar`) con **regla automática del
   5%**: si la relación de aspecto de la imagen difiere `<= 5%` de la del
   lienzo, se usa directo **Modo 3 — Estirar** y se ocultan tanto el selector de
   modo como el botón **Girar**.
4. Control **Reducir / Ampliar** siempre disponible (con botón de reset al
   centro), arrastre libre de la imagen, **color de fondo** autodetectado por
   los bordes de la imagen (o transparente si los bordes tienen transparencia)
   editable por el usuario, y botón **Girar** habilitable por ranura (`{ r: 1 }`)
   cuando la diferencia de aspecto supera el 5%.
5. Flujo de subida claro: botón **"Subir"** con aviso **"Subiendo imagen..."**
   y, si quedan espacios en la ranura, modal que pregunta si desea subir otra
   imagen (abriendo directo el selector de archivos al elegir "Sí").
6. **Mini galería / visor fullscreen (`cpmu-visor`)** al hacer click en las
   miniaturas subidas: flechas para recorrer la colección, **Eliminar** y
   **Reemplazar** (indicando qué imagen reemplaza y volviendo a la galería si
   cancela).

## Decisiones cerradas

| # | Decisión |
|---|---|
| **D1** | **El PNG exportado siempre se corta al rectángulo del placeholder (`W x H`)**. La forma/envoltura principal y el marco secundario son **guías visuales** en el editor; el recorte real del archivo entregado al servidor es el rectángulo `W x H` del placeholder con su color de fondo + la imagen transformada, sin líneas guía. |
| **D2** | **Geometría de `spmu-escena` con margen del 10%**: para un placeholder `W x H`, la escena lógica mide `(W * 1.2) x (H * 1.2)` (el placeholder `W x H` está a 10% de distancia de cada borde: `0.1 * W` a izq/der, `0.1 * H` arriba/abajo). En pantalla ocupa hasta `1000x1000 px`, achicándose proporcionalmente al espacio vertical/horizontal disponible sin perder jamás la relación `W : H`. |
| **D3** | **Doble guía de recorte**: (a) **Recorte secundario** = el rectángulo del placeholder `W x H`; (b) **Recorte principal** = la forma o envoltura dentro del placeholder, posicionada con `size` (`1` = encaja perfecto en el placeholder) y offsets `ox`, `oy` en porcentaje (`0` = centrado). |
| **D4** | **Formas de ranura (`forma`)**: `'rectangulo'` (clásico), `'circulo'` (círculo perfecto `min(W,H)`), `'cuadrado'` (cuadrado perfecto `min(W,H)`), `'ovalo'` (círculo estirado a `W x H`), `'auto'` (default: usa la `envoltura` del placeholder si existe; si no, `'rectangulo'`). Se aceptan como alias retrocompatibles `rect` -> `rectangulo`, `circle` -> `circulo`, `square` -> `cuadrado`, `fit` -> `auto`. |
| **D5** | **Regla del 5% y los 3 modos**: sea `rLienzo = W / H` y `rImg = imgW / imgH`. Si la imagen encaja perfecto o estirando hasta un **5%** horizontal o vertical (`Math.abs(rImg - rLienzo) / rLienzo <= 0.05` / factor `<= 1.05`), se aplica **Modo 3 — Estirar**, se ocultan los 3 botones de modo y se oculta **Girar**. Si supera el 5%, se muestran los 3 botones: **Rellenar** (`cover` proporcional), **Ajustar** (`contain` proporcional + fondo), **Estirar** (`fill` a `W x H`). |
| **D6** | **Girar condicional (`{ r: 1 }`)**: el botón **Girar** (90°) solo está disponible cuando se cumplen **ambas** condiciones: la ranura declara `{ r: 1 }` **y** la imagen supera el 5% en relación de aspecto. |
| **D7** | **Reducir / Ampliar + Mover + Color de fondo por bordes**: siempre hay un control **Reducir / Ampliar** con slider centrado en `0` (escala base `1x` del modo activo: izquierda reduce hasta `0.25x`, derecha amplía hasta `4x`) y un botón chiquito de reset (`↺`) para volver al medio `(0)` y centrar la imagen. Al cargar la imagen se muestrean sus 4 bordes: si hay transparencia se elige **transparente**; si son opacos se toma el **color predominante de los bordes** (editable en el modal o fijable en la ranura con `fondo`). |
| **D8** | **Controles y textos limpios**: se quitan **Cámara** y **Reintentar**; el botón de archivo dice **"Cargar imagen"** si no hay imagen y **"Cambiar imagen"** si ya hay una; **Aceptar** pasa a **"Subir"** con estado **"Subiendo imagen..."** bloqueando toques repetidos; al abrir el cargador se dispara directo el diálogo de archivos. Si tras subir quedan espacios libres en la ranura (y no era un reemplazo), un modal pregunta si quiere subir otra imagen (al tocar "Sí" abre directo el diálogo de archivos). |
| **D9** | **Mini galería (`cpmu-visor`)**: tocar una miniatura subida abre un visor modal fullscreen oscuro con flechas `‹` / `›` para recorrer la colección, botón **Eliminar** y botón **Reemplazar** (que abre el cargador avisando qué imagen reemplaza, y si el cliente cancela vuelve intacto al visor con la foto actual). |
