# Quickstart: validacion de 007-pmu-pdf-layout

**Feature**: 007-pmu-pdf-layout | **Date**: 2026-09-15

Recorrido ejecutable para comprobar que la feature funciona de punta a punta. Detalles de
entidades y formatos: [data-model.md](./data-model.md) y [contracts/](./contracts/);
las tareas de implementacion viven en `tasks.md` (fase 2).

## Prerequisitos

- PHP CLI disponible (`php -v`) y acceso al panel de WordPress.
- Dato de usuario: `uploads/pmu/pdfs/muestra.pdf` (o cualquier PDF con rectangulos 100%
  transparentes) y al menos un preset en `uploads/pmu/tm-presets/` para el puente TextMuy.
- Estado inicial conocido: `uploads/pmu/` con `{fonts,img,tm-presets}` validos.

## 1. Verificacion automatica (obligatoria tras tocar `engine/`, `inc/` o `admin/`)

```bash
php -l personalizador-pdf.php
php -l admin/page.php && php -l admin/pdfs.php && php -l admin/estilos-texto.php && php -l admin/ayuda.php
php -l engine/Pdf.php && php -l engine/Detector.php && php -l engine/PngWriter.php \
  && php -l engine/Metadata.php && php -l engine/Imagen.php && php -l engine/Overlay.php && php -l engine/Motor.php
php -l inc/class-pmu-uploads.php && php -l inc/class-pmu-galeria.php

php tests/motor_smoke.php      # esperado: SMOKE OK
php tests/parity.php           # esperado: PARIDAD OK

php tests/texto_puente.php setup
php tests/texto_puente.php guardar_ajax
php tests/texto_puente.php guardar_vacio
php tests/texto_puente.php procesar
php tests/texto_puente.php rechazo
php tests/texto_puente.php nonce
php tests/texto_puente.php nonce cap
# fases nuevas de esta feature:
php tests/texto_puente.php contenido
php tests/texto_puente.php placeholder
php tests/texto_puente.php admin
```

Cada fase es un proceso propio (los handlers terminan en `exit`) y termina con `FASE <x> OK`.

## 2. Escenario: layout del producto (US2)

1. En `admin.php?page=personalizador-pdf&tab=pdfs`, subir un PDF (`circulo6cm.pdf`).
2. **Esperado**: `uploads/pmu/pdfs/circulo6cm/` contiene solo `circulo6cm.pdf` y `metadata.json`; ningun archivo nuevo bajo
   `uploads/personalizador-pdf/`; ningun PNG de placeholder en la carpeta.
3. Verificar que el selector de la consola lista el PDF y que `uploads/pmu/pdfs/muestra.pdf`
   (suelto) **no** aparece.
4. Verificar el aviso de subida: `grupos` e `instancias` coinciden con el dataset.

## 3. Escenario: contenido por grupo en `metadata.json` (US3)

1. En la tarjeta del grupo `0000FF`: marcar "Usar texto", escribir un nombre, elegir un preset y
   guardar (o esperar el autoguardado).
2. **Esperado**: `uploads/pmu/pdfs/circulo6cm/metadata.json` con
   `grupos[?id=0000FF] = {..., "default":"texto", "value":"...", "preset":"..."}`; ningun
   `textos.json` en `uploads/pmu/` (busqueda global: cero resultados).
3. Pulsar "Re-analizar": la personalizacion del grupo `0000FF` sigue presente si el grupo sigue
   existiendo.
4. Procesar: el resumen indica el grupo aplicado y el PDF de muestra esta en
   `uploads/pmu/tmp/muestras/circulo6cm/circulo6cm_procesado.pdf`.

## 4. Escenario: placeholder al vuelo (US4)

1. En la tarjeta del grupo, pulsar "Descargar placeholder".
2. **Esperado**: descarga un PNG transparente del tamano `w` x `h` (px) (`file` reporta
   PNG, las dimensiones coinciden); contar archivos en `uploads/pmu/pdfs/circulo6cm/` antes y
   despues: sin cambios.
3. Probar con un id inexistente (`id=ZZZZZZ`): respuesta de rechazo, sin archivo.

## 5. Escenario: muestras del panel y ciclo carrito → pedido (US5)

### 5a. Muestras del panel (US5)

1. Cargar una imagen para el grupo `FF0000` (PC o galeria de medios) y procesar.
2. **Esperado**: `uploads/pmu/tmp/muestras/circulo6cm/FF0000.png` (o la extension cargada) y la muestra en
   `uploads/pmu/tmp/muestras/circulo6cm/circulo6cm_procesado.pdf`; nada nuevo en `pdfs/circulo6cm/`.
3. Procesar de nuevo sin cambiar nada: los mismos archivos, actualizados (sobrescritura, sin duplicados).
4. Borrar el PDF desde la consola: desaparecen `pdfs/circulo6cm/` y `tmp/muestras/circulo6cm/`;
   `uploads/pmu/orders/` y `tmp/cart/` no se tocan.

### 5b. Dos personalizaciones del mismo PDF en el carrito (US5)

1. Personalizar `etiqueta-abuela` (foto A + nombre A). **Esperado**: borrador en
   `uploads/pmu/tmp/cart/{sesion}/{pdf}/` con aplicados + personalizacion canonica.
2. Agregar al carrito. **Esperado**: la sesion se adopta como `tmp/cart/{linea1}/{pdf}/` con
   `manifest.json` (`pdf`, personalizacion, `pmu_hash`, cantidad 1, `creado`, motor).
3. Volver a personalizar el mismo PDF (foto B + nombre B) y agregar de nuevo.
   **Esperado**: existe una segunda linea `tmp/cart/{linea2}/{pdf}/` independiente de la primera.
4. Reenviar una personalizacion identica a la linea 1. **Esperado**: no se crea una tercera linea;
   la linea 1 pasa a cantidad 2 (mismo `pmu_hash`, FR-018).
5. Eliminar la linea 2 del carrito. **Esperado**: `tmp/cart/{linea2}/` desaparece; la linea 1 queda intacta.

### 5c. Pedido simulado en staging (US5)

1. Con dos lineas en el carrito, crear el pedido de prueba. **Esperado**: staging en
   `uploads/pmu/tmp/orders/{order_id}/{pdf}/` (una subcarpeta por PDF de linea).
2. Confirmar el pago de prueba. **Esperado**: `uploads/pmu/tmp/orders/{order_id}/` pasa a
   `uploads/pmu/orders/{order_id}/` (rename) con `{pdf}_procesado.pdf` + aplicados + resumen por linea.
3. Limpieza: los borradores `tmp/cart/` huerfanos y el staging sin pago caducan por TTL (`creado`);
   `orders/` nunca se toca.

## 6. Escenario: consola que nunca da 500 (US1)

| Escenario | Como provocarlo | Esperado |
|-----------|-----------------|----------|
| Catalogo vacio | `echo -n '' > uploads/pmu/tm-presets/presets.json` | Consola `200`, aviso con `motor:listar:catalogo:invalido:tm-presets`, selector de estilos vacio |
| Catalogo sin permisos | `chmod 000 uploads/pmu/tm-presets/presets.json` (o quitar escritura a la carpeta y borrar el archivo) | Consola `200`, aviso con la causa (`no_escribible`), consola operativa |
| Escritura concurrente | Abrir "Estilos de Texto" (dispara sprites/miniaturas) y recargar "PDFs" en paralelo varias veces | Consola `200` siempre; el catalogo nunca queda truncado |
| Excepcion en el render | Forzar temporalmente un `throw` en `presets_base()` | Aviso con el mensaje real, sin pagina de error critico |

Tras cada prueba: restaurar `presets.json` y recargar la consola (el aviso debe desaparecer).

## 7. Escenario: migracion unica (US6)

1. Colocar datos heredados: `uploads/personalizador-pdf/pdfs/x.pdf` +
   `uploads/personalizador-pdf/datos/x/{metadata.json,textos.json}`.
2. Abrir la consola una vez.
3. **Esperado**: `uploads/pmu/pdfs/x/x.pdf` + `uploads/pmu/pdfs/x/metadata.json` con `contenido`
   derivado de `textos.json`; la carpeta heredada intacta; bandera de migracion presente en `pmu/`.
4. Recargar: no se repite la migracion ni se duplican carpetas. Con un destino ya existente, se
   informa el conflicto y no se pisa.

## 8. Matriz de fallos esperados (mensajes del motor)

| Situacion | Mensaje/causa esperada |
|-----------|------------------------|
| Ambito invalido | `motor:<op>:ambito:invalido:<ambito>` |
| Carpeta no escribible | `motor:<op>:directorio:no_escribible` |
| Catalogo ilegible | `motor:listar:catalogo:invalido:<ambito>` (aviso, sin fatal) |
| Letra fuera del dataset | rechazo del handler (sin escribir nada) |
| PNG supera limites del servidor | "No se pudo recibir el texto renderizado del grupo X" |
| Preset inexistente al procesar | proceso cancelado con aviso (nunca PDF a medias) |

## 9. Criterios de cierre (mapeo a Success Criteria)

- SC-001: escenario 6 completo en verde.
- SC-002: escenario 2 (conteo de archivos exacto).
- SC-003: escenario 4 (0 archivos nuevos + PNG valido).
- SC-004: escenario 3 + busqueda global de `textos.json` sin resultados en codigo, tests y docs.
- SC-005: escenario 5a/5b/5c (todo en su subdestino, sin residuos tras borrar; promocion por rename).
- SC-006: seccion 1 completa en verde.
- SC-007: escenario 7 (la migracion preserva el 100% y no se repite).

## 10. Datos generados por las pruebas

Las verificaciones manuales crean datos de usuario en `uploads/pmu/` (PDFs, `tmp/muestras/`, `tmp/cart/`, catalogos).
Antes de una demostracion o de un commit, revisar que no queden restos de prueba
(`uploads/pmu/tmp/muestras/*`, `tmp/cart/*`) y que los catalogos del editor (`{fonts,img,tm-presets}`) esten validos.
Los datos de usuario no se versionan (`.gitignore`).