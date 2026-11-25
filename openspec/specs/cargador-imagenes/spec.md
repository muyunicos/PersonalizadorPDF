# cargador-imagenes Specification

## Purpose

Selector/cargador/visor de imagenes del comprador: recorte visual, receta v2 con rot,
modos de encaje, politica de transparencia por campo, carga multiple y estado entre
aperturas.

## Requirements

### Requirement: Receta v2 del recorte
El sistema SHALL emitir una receta v2 con `rot` al guardar el recorte y SHALL recomputar
siempre el hash de la receta en el servidor (`receta_de`); el cliente manda los `params`,
no el hash.

#### Scenario: Cliente manda params
- **WHEN** el selector guarda un recorte
- **THEN** envia `params` v2 y el servidor deriva el hash irreversible

### Requirement: Modos de encaje inequivocos
El sistema SHALL exponer tres modos anclados a `object-fit`: Cubrir=`cover`,
Encajar=`contain`, Estirar=`fill`, con alias de los ids viejos; lo que separa Cubrir de
Encajar es que hace con el sobrante (recortar vs. dejar fondo), no deformar.

#### Scenario: Alias de ids viejos
- **WHEN** llega un id viejo `rellenar` o `ajustar`
- **THEN** `modoCanonico()` lo mapea a `cover`/`contain`

#### Scenario: PNG mide el lienzo acotado
- **WHEN** se rasteriza el recorte
- **THEN** el PNG mide el lienzo `W x H` acotado a la resolucion de la foto (factor uniforme `k`)

### Requirement: Politica de transparencia por campo
El sistema SHALL leer `transp: 'si'|'no'` de la ranura (ausente = actual); con `no` el
fondo nunca es transparente, con `si` se respeta el alfa real de toda la imagen; el color
elegido a mano siempre sale opaco.

#### Scenario: transp no oculta damero
- **WHEN** una ranura declara `transp:'no'`
- **THEN** se oculta el boton damero y el fondo nunca es transparente

#### Scenario: Color manual opaco
- **WHEN** el comprador elige un color de fondo
- **THEN** la imagen resultante sale opaca

### Requirement: Carga multiple
El sistema SHALL permitir arrastrar o elegir varias fotos de una en un campo con `max > 1`,
omitiendo el editor con receta por defecto (`cubrir`, escala 1, centro) cuando N>1, y
SHALL topar al maximo de la ranura.

#### Scenario: N fotos de una
- **WHEN** se eligen varias fotos en un campo `max > 1`
- **THEN** se suben con receta por defecto y quedan editables desde la tira

#### Scenario: Tope de la ranura
- **WHEN** se intenta cargar mas fotos que el `max`
- **THEN** se rechazan las excedentes con aviso

### Requirement: Estado entre aperturas
El sistema SHALL reabrir el selector limpio (`_resetEstado` en `open()`) y SHALL limpiar el
reemplazo armado al editar y guardar, de modo que la siguiente foto no pise la editada.

#### Scenario: Reabrir limpio
- **WHEN** se reabre el selector
- **THEN** no muestra la foto anterior ni acciones sobre una imagen que no es la actual

### Requirement: Miniatura abre editor con su receta
El sistema SHALL abrir el editor con la receta vigente al tocar la miniatura; guardar una
existente no sube bytes (una foto = un id, N recetas), y "Ver todas (N)" abre el visor de
la biblioteca.

#### Scenario: Editar sin resubir
- **WHEN** se edita una foto ya cargada y se guarda
- **THEN** no se suben bytes nuevos y se conserva el mismo id

### Requirement: Avisos solo al comprar
El sistema SHALL mostrar avisos de faltantes solo al comprar (boton clicable con
`aria-disabled` + guard del submit), con titulo "Imagen #X" y primario por contexto.

#### Scenario: Intento de comprar incompleto
- **WHEN** se pulsa comprar con campos incompletos
- **THEN** se muestran los avisos de faltantes y no se agrega al carrito
