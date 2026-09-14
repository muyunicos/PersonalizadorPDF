# Research: align-textmuy-motor

**Feature**: 006-align-textmuy-motor | **Fecha**: 2026-09-14

Este documento resuelve las incógnitas técnicas del plan. No quedan `NEEDS CLARIFICATION`: todas las decisiones se apoyan en la constitución del plugin, el contrato ya documentado por el módulo (v3.1.0), el spec 003 (Galeria Engine) y los datos reales presentes en `uploads/pmu/`.

---

## R1. Un solo motor de recursos

**Decision**: Un único responsable de la verdad de almacenamiento —rutas, catálogos, altas/bajas/ediciones y el único `handle_request()`— en la pieza que ya atiende el endpoint registrado (`PMU_Uploads`). La segunda pieza (`PMU_Galeria`) se conserva como ayudante puro de miniaturas: cálculo de celdas, composición del `thumbs.webp`, validación de `webp` y saneo de nombres. No tiene rutas propias, ni catálogos, ni dispatcher: todo dato (directorio, dimensiones de celda, archivo subido) lo recibe por parámetros desde `PMU_Uploads`.

**Rationale**: La constitución del plugin (II) declara "motor unico ... que delega a PMU_Galeria para operaciones complejas": una sola verdad con delegación de trabajo, no dos motores. La constitución del módulo (VII, “responsabilidad única”) prohíbe un responsable doble por operación, y eso se cumple porque el único que decide rutas y escribe catálogos es `PMU_Uploads`. Hoy `PMU_Galeria` actúa como segundo motor con su propia raíz (`uploads/pmu/tm/…`, carpeta que **no existe** en la instalación) y su propio criterio de nombres, mientras el endpoint escribe en `uploads/pmu/…`: dos verdades contradictorias para el mismo dato. Sanear la frontera (quitarle rutas/catálogo/dispatcher, dejarle solo utilidades de sprite) conserva la separación de archivos sin duplicar la verdad.

**Alternatives considered**:
- *Eliminar `PMU_Galeria` y meter todo en `PMU_Uploads`*: rechazada, concentra demasiado en una sola clase y pierde la separación de mantenimiento que el autor buscó (archivos/subidas vs. miniaturas).
- *Mantener la delegación actual y solo corregir las rutas de ambos*: rechazada, deja dos implementaciones de catálogo/alta/baja (duplicación permanente) y vuelve a divergir ante el próximo cambio.
- *Nombrar canónico al delegado y envolver al endpoint actual*: rechazada, obliga a mover datos y agrega indirección sin eliminar duplicación; el endpoint registrado y usado por el panel es el otro.
- *Un motor nuevo*: rechazada por el mandato explícito de no crear piezas nuevas cuando ya existe código que resuelve el problema.

---

## R2. Raíz de datos y nombres canónicos

**Decision**: `uploads/pmu/` como raíz única. Ámbitos del editor: `fonts/` (catálogo `fonts.json`), `img/` (catálogo `img.json`) y `tm-presets/` (catálogo `presets.json`, archivos `{nombre}.txm`). Un único sprite `thumbs.webp` por ámbito, junto a su catálogo. El nombre del catálogo **no** se deriva del nombre de la carpeta: se resuelve con un mapa explícito por ámbito.

**Rationale**: Es exactamente lo que declara la constitución del plugin (IV) y el modelo de datos del spec 003 (`fonts.json`, `img.json`, `presets.json`), y coincide con los archivos realmente presentes en disco (`uploads/pmu/tm-presets/presets.json` + 11 `.txm`, `uploads/pmu/img/img.json`, `uploads/pmu/fonts/fonts.json`). La derivación actual (`{ambito}.json`) produce `tm-presets/tm-presets.json`, que no existe.

**Alternatives considered**:
- *Renombrar los archivos de datos a `tm-presets.json`*: rechazada, pisa datos del usuario, contradice el spec 003 y rompe la lectura actual del editor.
- *Mantener `uploads/pmu/tm/{...}`*: rechazada, la carpeta no existe y duplica la raíz.

---

## R3. Forma del puente plugin → editor

**Decision**: `postMessage` con `{type:'textmuy-bridge', bridge:{urls:{motor, miniaturas, presetsBase, fuentesBase, imagenesBase}, nonces:{motor}, presets, imagenes, fuentes}}`, enviado en los 3 momentos (carga del iframe, aviso `textmuy-ready` del módulo y envío inmediato). Las bases se construyen desde el motor único, nunca desde una segunda raíz.

**Rationale**: Es la forma que el plugin ya emite y que el editor ya consume parcialmente (`preset-manager.js` lee `bridge.urls.miniaturas`; `miniaturas.js` recibe `endpoint` + `nonce` + `op=sprite`). Mantenerla evita cambios innecesarios en el lado del editor y cumple el contrato documentado del módulo (v3.1.0).

**Alternatives considered**:
- *Puente plano por claves sueltas*: rechazada, rompe al editor actual y al módulo documentado.
- *Un endpoint por operación*: rechazada por la constitución (VIII: cero rutas dobles; endpoint único con `op`).

## R4. Protocolo de operaciones

**Decision**: Un único `POST` a `urls.motor` (`admin-post.php?action=pmu_uploads`) con `_wpnonce` (`nonces.motor`), verificación de capacidad en servidor y `op` en whitelist fija: `listar`, `alta`, `baja`, `editar`, `sprite`, `miniatura`. El payload identifica el ámbito y los datos de la operación. Todo rechazo responde JSON con causa `motor:<op>:<motivo>`; nunca un estado intermedio.

**Rationale**: Ya está implementado y registrado; satisface FR-002, FR-009 y el principio de firmeza fail-fast del módulo. El editor no conoce handlers ni rutas físicas.

**Alternatives considered**: *REST de WordPress*: rechazada, agregaría otro camino de escritura (contradice “punto único”). *Handlers sueltos por operación*: rechazada por la constitución del plugin (VIII).

---

## R5. Nombre del ámbito de estilos guardados

**Decision**: El ámbito del motor para estilos guardados se llama `tm-presets` (carpeta y `scope` de las operaciones) y su catálogo es `presets.json`. El editor mapea su ámbito interno de presets a ese `scope` al hablar con el motor; **no** se aceptan alias en el servidor.

**Rationale**: `tm-presets` es el nombre declarado en la constitución (IV) y en el whitelist real del motor; `presets.json` es el archivo real del disco. Los alias están prohibidos por la norma de cero legado.

**Alternatives considered**: *Aceptar `presets` como alias*: rechazada (alias = compatibilidad prohibida). *Renombrar la carpeta a `presets/`*: rechazada (contradice la constitución y obliga a mover datos).

---

## R6. Miniaturas: sprite por ámbito y miniaturas de grupos

**Decision**: Dos operaciones distintas: `op=sprite` (hoja `thumbs.webp` de un ámbito, generada por el cliente y persistida por el servidor) y `op=miniatura` (miniatura de un grupo de PDF, `{pdf}-{letra}.webp`, dentro del ámbito `img`). La base de lectura de miniaturas que recibe la consola (`imagenesBase`) apunta al ámbito `img` de la raíz única.

**Rationale**: `assets/miniaturas.js` ya envía `op=sprite` + `scope` + `archivo` + `_wpnonce` y falla de forma visible si no hay endpoint; el defecto real está en la base de lectura (`uploads/tm/img/`) y en la carpeta donde el servidor persiste. Corregir base y persistencia satisface FR-008 sin reescribir el cliente.

**Alternatives considered**: *Generar miniaturas en servidor*: prohibida por la constitución del módulo (el render de miniaturas es del cliente). *Un archivo por miniatura en vez de sprite*: rechazada por ruido de peticiones y por el formato vigente.

## R7. Cliente del editor: contrato del motor

**Decision**: El cliente deja de usar claves por operación (`guardarPreset`, `borrarPreset`, `subirImagen`, `borrarImagen`, `guardarSprite`, `cambiarImagen`, `subirFuente`, `borrarFuente`, `cambiarFuente`, `guardarMiniatura`) y pasa a un cliente único que envía `POST urls.motor` con `op` + payload. Se eliminan las bases de respaldo (`presets/`, `fonts/`, `img/`), la descarga de `.txm` sin puente, las imágenes embebidas como data-URL, la migración de presets locales y la carga local embebida. Se sube la versión de caché `?v=RCn` en los dos HTML del módulo.

**Rationale**: Cumple FR-002/FR-003/FR-004 y los principios III y VII del módulo; el editor ya no recibe esas claves en el puente actual, por lo que hoy esas rutas de código están muertas para el plugin y son falsas en la documentación.

**Alternatives considered**: *Mantener las claves viejas y que el servidor las acepte*: rechazada (alias/compatibilidad prohibida y duplica el protocolo). *Doble soporte temporal*: rechazada por el principio de cero legado (la purga va en la misma entrega).

---

## R8. Alcance de la purga

**Decision**: Se eliminan en la misma entrega: los 8 handlers ya no registrados de estilos/imágenes/fuentes, los ayudantes privados que apuntan a la carpeta anterior (rutas de presets/imágenes/fuentes, catálogo, alta y baja de tuplas, resolución de archivos), el armado de listados desde esa carpeta, y las rutas propias, los catálogos propios y el dispatcher propio de `PMU_Galeria` (la clase se conserva como ayudante puro de miniaturas según R1). La guía de importación del módulo (`modules/LEEME.md`), hoy referenciada pero ausente del disco, se restaura con el flujo vigente —o se eliminan sus referencias si el usuario prefiere no reponerla.

**Rationale**: FR-011/FR-012 y el principio de cero legado; las referencias a un archivo inexistente rompen FR-013 y la experiencia de despliegue (US4).

**Alternatives considered**: *Dejar el código heredado sin uso*: rechazada explícitamente por la norma (la redundancia se elimina, no se documenta). *Papelera o migración automática de `uploads/tm/`*: rechazada por la constitución del plugin (V: sin migraciones ni compatibilidad).

---

## R9. Sincronización documental

**Decision**: Un solo valor por dato en toda la documentación vigente: raíz `uploads/pmu/`, ámbitos `fonts`/`img`/`tm-presets`, catálogos `fonts.json`/`img.json`/`presets.json`, endpoint único `pmu_uploads` y la versión de caché real del módulo. Se corrigen los dos puntos contradictorios del `AGENTS.md` del plugin, la ayuda del panel, `readme.txt` y las referencias a archivos inexistentes. La documentación del módulo (AGENTS.md + constitución v3.1.0) ya describe el contrato destino: se verifica que coincida con lo implementado y no se vuelve a tocar salvo contradicción.

**Rationale**: FR-013 y US4; la verificación se hace por búsqueda (SC-003) para que no dependa de lectura humana.

**Alternatives considered**: *Documentar la convivencia de rutas*: rechazada, normalizaría el defecto y contradice la constitución.

---

## R10. Verificación del resultado

**Decision**: Puertas de calidad obligatorias al cierre: (1) búsqueda de control sin coincidencias de la carpeta y los nombres anteriores en código y documentación; (2) `php -l` de todos los archivos PHP del plugin; (3) `php tests/motor_smoke.php` y `php tests/parity.php` en verde; (4) `node --check` de los JS tocados y las 10 suites Node del módulo en verde (incluida la de carga de presets, que hoy falla por ruta); (5) recorrido manual integrado del `quickstart.md` (alta de imagen, guardado de estilo, aplicación a un grupo y procesado) verificando persistencia tras recargar y ausencia de archivos duplicados.

**Rationale**: SC-001..SC-008 son medibles exactamente con estas puertas; la prueba integrada es la única válida (no existe modo standalone).

**Alternatives considered**: *Confiar solo en pruebas manuales*: rechazada, SC-003 exige verificación objetiva de la ausencia de rutas alternativas.

---

## Resumen de resolución de incógnitas

| Incógnita del plan | Resolución |
|---|---|
| ¿Un motor o dos? | Uno solo (R1) |
| ¿Dónde viven los datos? | `uploads/pmu/{fonts,img,tm-presets}` (R2) |
| ¿Cómo se llama el catálogo de estilos? | `presets.json` dentro de `tm-presets/` (R2, R5) |
| ¿Qué forma tiene el puente? | `urls` + `nonces` + inventarios iniciales (R3) |
| ¿Cómo se escribe? | `POST` al endpoint único con `op` (R4) |
| ¿Cómo se generan miniaturas? | Cliente + `op=sprite` / `op=miniatura` (R6) |
| ¿Qué pasa con el cliente viejo? | Migra al contrato único; se purga lo demás (R7) |
| ¿Qué se borra? | Handlers, ayudantes, listados y las rutas/catálogos/dispatcher propios de `PMU_Galeria` (la clase queda como ayudante de miniaturas, R8) |
| ¿Y la documentación? | Un valor por dato + guía de importación repuesta (R9) |
| ¿Cómo se comprueba? | 5 puertas objetivas (R10) |
