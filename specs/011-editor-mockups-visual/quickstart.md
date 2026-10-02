# Quickstart: validacion de editor-mockups-visual

**Feature**: 011-editor-mockups-visual | **Date**: 2026-10-01

Guia de validacion ejecutable. No contiene codigo de implementacion: los detalles viven en
[plan.md](./plan.md), [data-model.md](./data-model.md) y [contracts/mockup-capas.md](./contracts/mockup-capas.md).

## 0. Prerrequisitos

- PHP CLI disponible (el arnes `texto_puente.php` **aborta si `PHP_SAPI !== 'cli'`**).
- Node disponible **solo para tests** (nunca en el servidor).
- Para la parte manual: un WordPress+WooCommerce con el plugin desplegado, un PDF subido con al
  menos 1 grupo, y el PDF de muestra en `uploads/pmu/pdfs/` (dato del admin, no versionado).

## 1. Puertas automaticas (orden de la cadena)

```bash
php -l personalizador-pdf.php && php -l admin/*.php && php -l engine/*.php && php -l inc/*.php
php tests/motor_smoke.php           # debe imprimir SMOKE OK
php tests/parity.php                # debe imprimir PARIDAD OK
node tests/mockup-geometria.test.js # NUEVO: debe imprimir GEOMETRIA OK
```

## 2. Arnes PHP por fases (una fase por proceso)

Las fases existentes de mockups **deben seguir en verde**; las nuevas cubren el contrato ampliado.

```bash
php tests/texto_puente.php mockups          # normalizacion de capas y omisible (existente)
php tests/texto_puente.php mockups_guardar  # guardado parcial del editor (existente)
php tests/texto_puente.php mockup_foto      # subida de foto de mockup (existente)
php tests/texto_puente.php mockup_foto_baja # borrado quirurgico (existente)
php tests/texto_puente.php mockup_capas     # NUEVO: contrato ampliado
php tests/texto_puente.php mockup_preview   # NUEVO: preview_omisible sin pisar el resto
```

Resultado esperado: cada fase termina con `OK` y el proceso sale con codigo 0; un fallo imprime la
causa (`motor:*` o la del assert) y sale distinto de 0.

## 3. Validacion del contrato de datos (sin navegador)

Sobre un `config.json` de prueba, comprobar que:

1. Un mockup **previo** (con `ref` plano, sin namespace y sin los campos nuevos) se relee igual:
   mismo `ref`, misma geometria, `filtros` intactos.
2. `ref: "img:3"` se conserva y se resuelve a la URL del item 3 del catalogo `img.json`.
3. `filtros` con `gama`, `opacidad`, `desenfoque`, `tono` se conservan; los valores fuera de rango se
   clampean; un valor igual al default **se borra**.
4. `modo`, `nombre`, `oculta`, `bloqueada` se conservan; ausentes toman el default.
5. Guardar mockups **no** toca `activo`, `productos`, `campos_ids`, `placeholders` ni `tienda` del
   mismo `config.json`.
6. `analisis.json` queda byte-identico antes y despues de guardar.
7. Sin mockups, `preview_omisible` queda `false` y el control sigue deshabilitado.

## 4. Test de geometria (Node)

```bash
node tests/mockup-geometria.test.js
```

Cubre: acotado de posicion y tamano al area 300x300, imanes (centro, bordes) con su tolerancia,
redimensionado desde los 8 tiradores con y sin modificador, ajuste a proporcion natural, puntos de
rotacion, `acertarCapa` (que capa esta bajo el puntero, respetando `oculta` y `bloqueada`), alinear
(6 posiciones) y distribuir. Entrada y salida deterministas, sin DOM.

## 5. Recorrido manual en el sitio real (consola -> PDFs -> Mockups)

Orden de un mockup completo (valida SC-001 a SC-008):

1. **Abrir la seccion**: el editor aparece en **dos columnas** con estilos aplicados (paneles,
   lienzo con fondo damero, marco 300x300). Si se ve texto plano, FR-002 falla.
2. **Foto**: arrastrar un archivo de imagen del escritorio al area de trabajo -> la foto se sube,
   aparece en la galeria **y** queda anadida como capa que cubre todo el lienzo, **sin** pedir el
   nombre.
3. **Hueco**: elegir un grupo de la lista (id, tamano real, instancias) -> el hueco aparece
   encuadrado a escala y seleccionado. Repetir para un segundo hueco.
4. **Manipulacion**: arrastrar y redimensionar con los tiradores; al llegar al centro debe aparecer
   la guia y pegar exacto. Verificar la medida en pixeles junto a la seleccion. **Ningun numero
   escrito a mano.**
5. **Zoom**: subir a 200 % y repetir un arrastre; el resultado debe ser identico al de 100 %.
6. **Preview real**: en el panel del grupo, pulsar **Probar** -> las capas de ese grupo pasan a
   mostrar el render del texto. Un segundo "Probar" con el mismo texto **no** genera un render nuevo.
7. **Ajustes**: mover los sliders de brillo, contraste, saturacion, **gama**, opacidad, desenfoque y
   tono, mas el modo de fusion; el lienzo responde en vivo. "Restablecer" vuelve al neutro.
8. **Orden y alineacion**: mover una capa en la lista, ocultarla, alinearla al centro, duplicarla.
9. **Persistencia**: esperar el autoguardado (estado "Guardado"), **recargar** y comprobar que todo
   sigue igual. Luego `Ctrl+Z` varias veces y verificar que se revierte.
10. **Referencias rotas**: borrar una foto en uso -> aparece el conteo de capas afectadas antes de
    confirmar; si se confirma, la capa queda **marcada**, no desaparece, y el aviso dice que falta
    el recurso.
11. **Salir con cambios**: con un cambio pendiente, cambiar de PDF -> aparece la confirmacion.

## 6. Recorrido manual en la ficha (cliente)

1. En el producto de Woo vinculado, pulsar **Vista previa** y recorrer las vistas generadas.
2. Comparar la imagen 300x300 que ve el cliente con la composicion del editor: deben coincidir en
   posicion, tamano, orden y ajustes (SC-003).
3. Un hueco con proporcion distinta de la del encuadre debe verse **encajado, no deformado**
   (regla `contain`).
4. Agregar al carrito y comprobar que el PNG congelado `mockup-{id}.webp` se genera como antes (la
   paridad no debe cambiar el entregable salvo por la correccion de deformacion).

## 7. Puertas de no-regresion

```bash
# El modulo TextMuy NO se toca en esta feature (no hay bump ?v=RCn):
grep -o "?v=RC[0-9]*" modules/textmuy/index.html | sort -u   # version sin cambios
ls modules/textmuy/tests/*.test.js | wc -l                     # numero de suites sin cambios
# Sin rutas construidas fuera del dueno unico de datos:
grep -rn "uploads/pmu" assets/*.js                              # sin literales nuevos
```

Si cualquiera de estas falla, la feature se salio de alcance: revisar antes de seguir.

## 8. Criterio de "listo"

| Puerta | Quien |
|---|---|
| `php -l` en plugin, `admin/`, `engine/`, `inc/` | automatica |
| `motor_smoke` = SMOKE OK, `parity` = PARIDAD OK | automatica |
| `node tests/mockup-geometria.test.js` = GEOMETRIA OK | automatica |
| Todas las fases de `texto_puente.php` (incluidas las 2 nuevas) en verde | automatica |
| Pestana **Test** -> smoke test del sitio real sin FALLAs | manual (boton) |
| Recorrido del punto 5 (consola) y del punto 6 (ficha) | manual |
| `modules/textmuy/` intacto (mismo `?v=RCn` y mismo numero de suites) | automatica (grep) |

Al terminar, el recorrido manual se anota en `specs/MANUAL-PENDIENTE-WP-REAL.md` (indice en
`specs/INDICE.md`), igual que las specs 004/005/006.

