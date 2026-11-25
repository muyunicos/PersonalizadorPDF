# pdf-motor Specification

## Purpose

Deteccion y agrupacion de huecos transparentes en un PDF, dataset inmutable
`analisis.json` + editable `config.json`, inyeccion de imagenes con z-order y
transparencia corregida, encajado contain y composicion bajo demanda del original.

## Requirements

### Requirement: Deteccion de placeholders transparentes
El sistema SHALL detectar rectangulos con `fill_opacity` <= 0.001, ya sea por
operador `re` transformado o por cuatro lineas rectas cerradas, incluidos los
rotados (lados opuestos paralelos e iguales), y SHALL descartar figuras menores a
10x5 pt.

#### Scenario: Rectangulo transparente detectado
- **WHEN** el PDF trae un rectangulo con fill_opacity 0 y tamano >= 10x5 pt
- **THEN** el Detector lo reporta como placeholder

#### Scenario: Rotado con lados paralelos
- **WHEN** el placeholder es un rectangulo rotado con lados opuestos paralelos e iguales
- **THEN** se detecta y la instancia conserva su `dev_quad`

#### Scenario: Artefacto minimo descartado
- **WHEN** una figura transparente mide menos de 10x5 pt
- **THEN** no se reporta como placeholder

### Requirement: Agrupacion por color determinista
El sistema SHALL agrupar los placeholders por color RGB con 3 decimales, en orden
determinista, identificando cada grupo por su hex `RRGGBB` sin `#`, y SHALL tomar la
figura de mayor area como base del grupo, con medidas en px a 200 ppp.

#### Scenario: Dos rectangulos del mismo color
- **WHEN** dos placeholders comparten color RGB
- **THEN** quedan en el mismo grupo identificado por su hex sin `#`

#### Scenario: Base del grupo por mayor area
- **WHEN** un grupo tiene varias figuras
- **THEN** la de mayor area define el tamano base `w`/`h` del grupo

### Requirement: Dataset inmutable y config editable
El sistema SHALL persistir la geometria en `analisis.json` (inmutable, generado por el
Detector) y la configuracion editable en `config.json`, sin `textos.json` ni
`metadata.json`.

#### Scenario: Geometria no editable desde la UI
- **WHEN** el admin edita un grupo
- **THEN** solo cambia `config.json` y la geometria de `analisis.json` permanece intacta

### Requirement: Encajado contain sin deformar
El sistema SHALL encajar cada imagen con escala `min(W/iw, H/ih)`, centrada, sin
estirar ni recortar, dejando transparentes los margenes sobrantes.

#### Scenario: Imagen de aspecto distinto al hueco
- **WHEN** la imagen no tiene el mismo aspecto que el hueco
- **THEN** se escala para caber entera y se centra sin deformar ni recortar

### Requirement: Overlay con z-order y transparencia corregida
El sistema SHALL insertar cada imagen en el content stream original justo antes de su
operador de relleno `f`, aislada en su propio bloque `q ... Q`, y SHALL anteponer
`/ECOp1 gs` para que la imagen no herede la opacidad 0 del placeholder.

#### Scenario: Imagen insertada conserva opacidad
- **WHEN** se inyecta una imagen sobre un placeholder con opacidad 0
- **THEN** aparece opaca gracias a `/ECOp1` y no hereda la transparencia

#### Scenario: Ornamentos superpuestos preservados
- **WHEN** hay clips u ornamentos sobre el placeholder
- **THEN** el splice antes de `f` los conserva y cada draw queda aislado en su `q ... Q`

### Requirement: Composicion bajo demanda del original
El sistema SHALL materializar la composicion del original con `engine/Compositor.php`
(GD + WebP) al generar el PDF, a partir del original y la receta, sin que el cliente
suba la composicion.

#### Scenario: Composicion generada al procesar
- **WHEN** se genera el PDF y hay una fila `origen: compuesta`
- **THEN** el servidor la materializa con Compositor desde el original y sus `params`

### Requirement: Orquestacion del Motor
El sistema SHALL orquestar PDF + dataset + imagenes en un unico flujo `Motor::procesar`
que entrega el PDF editado, y SHALL aceptar una lista de imagenes por instancia para
cada grupo.

#### Scenario: Procesar con lista por instancia
- **WHEN** un grupo recibe imagenes indexadas por instancia
- **THEN** el Motor inserta cada imagen en su instancia correspondiente

### Requirement: Reemplazo por swap de archivos
El sistema SHALL reemplazar el PDF de un producto por swap de archivos (`{nombre}.pdf`,
`analisis.json`, `envolturas.json`) con `config.json` reescrito, sin borrar la carpeta del
producto, de modo que fotos, subcarpetas, bonus, productos, campos y mockups sobrevivan.

#### Scenario: Reemplazo conserva la carpeta
- **WHEN** el admin reemplaza el PDF de un producto con personalizacion
- **THEN** solo se swapean los archivos y el resto de `pdfs/{nombre}/` queda intacto

### Requirement: Staging con analisis previo
El sistema SHALL analizar el PDF nuevo en staging antes de tocar el dataset vigente; si el
analisis falla (PDF ilegible o 0 placeholders) el producto SHALL quedar exactamente como
estaba y se informa la causa.

#### Scenario: Analisis fallido no toca el producto
- **WHEN** el PDF nuevo es corrupto o no tiene placeholders
- **THEN** no cambia ningun archivo y se informa la causa

### Requirement: Mapa viejo a nuevo en modal
El sistema SHALL devolver un mapa `iguales`/`sugeridos`/`perdidos`/nuevos y SHALL mostrarlo
en un modal donde el admin decide Migrar o Cancelar; Cancelar no cambia nada.

#### Scenario: Cancelar sin efectos
- **WHEN** el admin cancela el modal de reemplazo
- **THEN** el PDF y los JSON quedan byte-identicos

### Requirement: Remapeo de tres superficies
El sistema SHALL remapear `placeholders{id}` (claves), `envolturas{gid:{forma}}` (indices) y
`mockups[].capas[].ref` (`{gid}` y `{gid}#n`), validando `k` contra las formas nuevas y
dejando `0` (forma por defecto) fuera de rango con aviso.

#### Scenario: Envoltura fuera de rango
- **WHEN** el indice `k` de una envoltura no existe entre las formas nuevas
- **THEN** cae a `0` (forma por defecto) y se avisa

#### Scenario: Ref huerfano sin borrar
- **WHEN** una capa de mockup queda sin `ref` con destino
- **THEN** la capa no se borra: se conserva y se reporta

### Requirement: Re-analisis con el mismo remapeo
El sistema SHALL usar la misma funcion de remapeo en Re-analizar (mismo archivo): revalida
`envolturas{gid}` y remapea o reporta los `ref` de las capas.

#### Scenario: Re-analizar revalida envolturas
- **WHEN** se re-analiza un PDF con formas de envoltura cambiadas
- **THEN** se aplica el mismo remapeo que el reemplazo

### Requirement: Respaldo y recuperacion
El sistema SHALL guardar un respaldo (PDF viejo + los 3 JSON) en
`tmp/reemplazos/{nombre}/{ts}/` fuera del TTL de borradores, SHALL conservar solo el ultimo, y
SHALL restaurarlo completo al recuperar la version anterior.

#### Scenario: Recuperar version anterior
- **WHEN** el admin recupera la version anterior
- **THEN** vuelven el PDF y los 3 JSON byte-identicos al estado previo

#### Scenario: Respaldo fuera del TTL
- **WHEN** corre la purga de borradores
- **THEN** no alcanza `tmp/reemplazos/`
