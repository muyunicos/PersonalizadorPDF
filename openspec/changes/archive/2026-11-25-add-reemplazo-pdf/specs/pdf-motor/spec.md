# Spec Delta — pdf-motor (reemplazo de PDF)

## ADDED Requirements

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