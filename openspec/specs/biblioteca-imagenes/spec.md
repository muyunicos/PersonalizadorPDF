# biblioteca-imagenes Specification

## Purpose

Biblioteca de imagenes del comprador: catalogo `uploads.json` por carpeta de originales,
miniaturas 80x80, lectura liviana sin WordPress (`media.php`), e identidad por sesion o
cuenta con TTL/retencion.

## Requirements

### Requirement: Catalogo de uploads por carpeta
El sistema SHALL mantener `uploads.json` dentro de cada carpeta de originales
(`tmp/sesion-{sid}/uploads/` invitado; `orders/{uid}/uploads/` cliente) con una entrada
por imagen y sus recetas por contexto; es dato derivado y reconstruible sin recetas.

#### Scenario: Catalogo ausente se reconstruye
- **WHEN** falta o esta corrupto `uploads.json`
- **THEN** se arma una vez desde los archivos, sin recetas

#### Scenario: Escritura serializada y atomica
- **WHEN** se escribe el catalogo
- **THEN** corre bajo `flock` con lectura dentro del lock y `rename` atomico

### Requirement: Miniaturas 80x80
El sistema SHALL generar miniaturas `{id}-80x80.webp` junto al original (cover 80x80) y la
tira del modal SHALL pedir la miniatura, nunca la foto completa.

#### Scenario: Tira pide miniatura
- **WHEN** se muestra la tira de la biblioteca
- **THEN** cada item solicita su `{id}-80x80.webp`

### Requirement: Lectura liviana sin WordPress
El sistema SHALL servir listado, imagen y miniatura por `media.php` sin WordPress, con
identidad por cookie `pmu_sid` (invitado) o `pmu_uid` firmada (cliente), y el camino
`admin-post` queda como respaldo y unico camino de escritura.

#### Scenario: Listado por camino liviano
- **WHEN** se pide el listado con credencial valida
- **THEN** `media.php` responde sin arrancar WordPress

#### Scenario: Credencial invalida
- **WHEN** la credencial es invalida o ausente
- **THEN** responde 403 sin datos

### Requirement: Miniaturas embebidas e invalidacion
El sistema SHALL embeber miniaturas (hasta 10) en la lista, usar `revision` para que las
reaperturas hagan 0 solicitudes e invalidar al subir o borrar.

#### Scenario: Reapertura sin solicitudes
- **WHEN** se reabre la galeria sin cambios
- **THEN** no se hacen solicitudes de contenido

### Requirement: Borrado en dos pasos
El sistema SHALL pedir confirmacion al borrar una imagen en uso (carrito o pedido) y
advertir que ese pedido deja de poder regenerarse; quitar de un campo no borra.

#### Scenario: Borrar imagen en uso
- **WHEN** se borra una imagen referenciada por un carrito o pedido
- **THEN** se pide confirmacion y se advierte la consecuencia

### Requirement: TTL y retencion
El sistema SHALL purgar `tmp/` por TTL (drafts 24 h, carrito 30 dias) con `limpiar_ttl`, y
SHALL materializar filas `origen: ref` antes de cualquier purga de `orders/`.

#### Scenario: Purgar tmp por TTL
- **WHEN** un draft supera su TTL
- **THEN** `limpiar_ttl` lo elimina sin contar `uploads/` como item
