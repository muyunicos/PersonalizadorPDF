# Spec Delta — texto-textmuy

## Purpose

Integracion del modulo TextMuy: render headless por RenderCore, presets `.txm`,
galerias con sprite certificado y cache-bust `RCn`, con el plugin como consumidor del
contrato publico sin conocer sus internos.

## ADDED Requirements

### Requirement: Contrato RenderCore
El sistema SHALL consumir TextMuy solo por su contrato publico: editor en iframe
same-origin (`index.html`) y motor headless (`render-core.html`) con
`TextMuyAPI.renderBatch(items, {onProgress})`, que renderiza por lote y rechaza ante el
primer fallo.

#### Scenario: Render por lote
- **WHEN** se solicita un lote de textos
- **THEN** `renderBatch` renderiza lote a lote y rechaza si uno falla, sin lote parcial

#### Scenario: Fuente lista antes de renderizar
- **WHEN** se renderiza un texto
- **THEN** `ensureFontReady` garantiza la fuente antes de dibujar

### Requirement: Puente de recursos
El sistema SHALL pasar al iframe un `textmuy-bridge` con `urls`, `nonces` y catalogos desde
`Personalizador_PDF_Plugin::puente_textmuy()`; sin puente el editor no opera y hace cero
peticiones locales.

#### Scenario: Editor sin puente
- **WHEN** el iframe no recibe el puente
- **THEN** muestra un error accionable y no hace peticiones locales

### Requirement: Presets .txm con referencias numericas
El sistema SHALL guardar presets como `tm-presets/{nombre}.txm` (delta v1 con referencias
numericas) y resolver las imagenes por id del catalogo `img.json` al renderizar.

#### Scenario: Imagen por id en el preset
- **WHEN** un `.txm` referencia una imagen
- **THEN** la guarda por id numerico y resuelve la URL al renderizar

### Requirement: Galerias con sprite certificado
El sistema SHALL leer las galerias de `fonts`, `img` y `tm-presets` con
`drawTileCanonico(ambito, id)` y `thumbs.sprite_firma`; con hoja certificada la apertura es
0 descargas de contenido, y si no certifica pinta placeholder y genera los huecos.

#### Scenario: Apertura con hoja certificada
- **WHEN** la galeria abre con `sprite_firma` vigente
- **THEN** no descarga contenido y pinta las celdas del sprite

#### Scenario: Hoja no certificada
- **WHEN** falta o no coincide `sprite_firma`
- **THEN** pinta placeholder y genera los huecos faltantes

### Requirement: Unico cliente que escribe el sprite
El sistema SHALL concentrar la escritura de sprites y miniaturas en `assets/miniaturas.js`
(ThumbEngine) via `op=sprite`/`op=miniatura`, sin botones "Generar miniaturas".

#### Scenario: Escritura concentrada
- **WHEN** se persiste una hoja
- **THEN** solo `miniaturas.js` escribe via `op=sprite` con `firma`

### Requirement: Cache-bust RCn
El sistema SHALL versionar los estaticos del modulo con `?v=RCn` en `index.html` y
`render-core.html`, subiendo el numero al cambiar cualquier JS del modulo.

#### Scenario: Bump de RC al tocar JS
- **WHEN** se modifica un JS del modulo
- **THEN** se sube `?v=RCn` en ambos HTML