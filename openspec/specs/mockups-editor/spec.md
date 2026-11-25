# mockups-editor Specification

## Purpose

Editor visual de mockups del admin: composicion por capas sobre lienzo 300x300,
grupos, envolturas PowerClip, perspectiva, importacion de pagina PDF y aplanado
fondo/frente para la ficha del comprador.

## Requirements

### Requirement: Nucleo de render compartido
El sistema SHALL componer el mockup con un unico nucleo `assets/mockup-render.js`
(`PMUMockup.componer/contener/filtroCss/esValida`) usado por el editor y por la ficha,
sin duplicar la logica de render.

#### Scenario: Editor y ficha usan el mismo nucleo
- **WHEN** el editor o la ficha componen un mockup
- **THEN** ambos llaman a `PMUMockup.componer` del mismo modulo

### Requirement: Capas con namespace y transformaciones
El sistema SHALL representar cada capa con `ref` namespaced (`pdf:{archivo}` o
`mock:{id}`) y SHALL conservar `x`/`y`/`w`/`h`/`rot`/`filtros`/`modo`/`nombre`/
`oculta`/`bloqueada`/`envoltura`/`grupo`/`grupo_rot` y perspectiva opcional.

#### Scenario: Ref con namespace obligatorio
- **WHEN** se guarda una capa
- **THEN** su `ref` lleva namespace `pdf:` o `mock:`; un ref plano no se acepta en el cliente

#### Scenario: Filtros no default persisten
- **WHEN** una capa tiene filtros distintos del default
- **THEN** se persisten `brillo`/`gama`/`contraste`/`saturacion`/`opacidad`/`desenfoque`/`tono`

### Requirement: Grupos y manipulacion conjunta
El sistema SHALL permitir agrupar capas para seleccionar, mover, redimensionar y rotar
juntas, conservando la orientacion comun en `grupo_rot`, y SHALL permitir Alt+clic para
manipular un miembro sin cambiar su pertenencia.

#### Scenario: Mover un grupo
- **WHEN** se arrastra una capa perteneciente a un grupo
- **THEN** se mueven todas las capas del grupo juntas

#### Scenario: Alt+clic sobre miembro
- **WHEN** se hace Alt+clic sobre un miembro del grupo
- **THEN** se manipula solo ese miembro sin sacarlo del grupo

### Requirement: Envolturas PowerClip deduplicadas
El sistema SHALL leer las envolturas desde `envolturas.json` (formas deduplicadas con
`usos`, `defecto` y `mapa` por pagina), reglas `0` = sin envoltura, y SHALL aplicar la
forma representativa del grupo con excepciones usadas.

#### Scenario: Forma por defecto del grupo
- **WHEN** un grupo tiene envoltura y no hay excepcion para una pagina
- **THEN** se aplica la forma `defecto` del grupo

### Requirement: Perspectiva por grupo o capa
El sistema SHALL aplicar una homografia de cuatro puntos convexos al grupo o a una capa
individual a traves del render compartido, solo para el mockup, sin modificar los PNG
del pool ni el PDF final.

#### Scenario: Perspectiva sobre el mockup
- **WHEN** se definen cuatro puntos convexos
- **THEN** el render los aplica al mockup sin alterar el pool ni el PDF

### Requirement: Importar pagina del PDF
El sistema SHALL importar una pagina elegida del PDF como imagen del catalogo `mockups`
con su proporcion natural y sus placeholders con envolturas, rasterizando con PDF.js
local y consultando la geometria al motor PHP.

#### Scenario: Importar pagina con placeholders
- **WHEN** el admin elige importar una pagina del PDF
- **THEN** se rasteriza con PDF.js y los placeholders entran en el mismo grupo inicial

### Requirement: Aplanado fondo y frente
El sistema SHALL exportar en cada guardado hasta dos WebP: fondo (`{id}.webp`, blanco
opaco con capas `img` bajo el primer PH) y frente (`{id}-frente.webp`, transparente
con capas `img` sobre el ultimo PH), y SHALL avisar cuando un mockup no es aplaneable.

#### Scenario: Mockup aplaneable
- **WHEN** no hay capa `img` intercalada entre PHs ni modo de fusion delante de un PH
- **THEN** se exportan fondo y, si corresponde, frente

#### Scenario: Mockup no aplaneable
- **WHEN** hay una `img` intercalada o una capa con modo de fusion delante de un PH
- **THEN** el editor avisa y la ficha cae a composicion por capas
