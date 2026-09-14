# Quickstart: align-textmuy-motor

**Feature**: 006-align-textmuy-motor | **Fecha**: 2026-09-14

Guía para demostrar que la alineación funciona de punta a punta. Los detalles de formato están en [contracts/](./contracts/) y [data-model.md](./data-model.md); acá solo hay pasos y resultados esperados.

## Prerrequisitos

- WordPress con el plugin activo y el módulo del editor importado en `modules/textmuy/`.
- Acceso de administrador al panel del plugin (pestaña de PDFs y pestaña del editor de estilos).
- Carpeta de datos del administrador presente (`uploads/pmu/` con `fonts/`, `img/`, `tm-presets/`).
- Consola del navegador disponible para leer avisos y errores.

## 1. Verificaciones automáticas (sin tocar la interfaz)

```bash
# 1.1 Sintaxis PHP del plugin
php -l personalizador-pdf.php && php -l admin/*.php && php -l engine/*.php && php -l inc/*.php

# 1.2 Motor de PDF (no debe cambiar por esta feature)
php tests/motor_smoke.php      # esperado: SMOKE OK
php tests/parity.php           # esperado: PARIDAD OK

# 1.3 Editor: sintaxis y suites Node (en el repositorio del módulo)
cd modules/textmuy
node --check js/*.js
node tests/catalog-unified.test.js && node tests/fonts-catalog.test.js && node tests/img-refs.test.js
node tests/preset-cache.test.js && node tests/preset-delta.test.js && node tests/preset-load.test.js
node tests/distort-engine.test.js && node tests/flag-wave.test.js && node tests/pattern-block-box.test.js
node tests/controls-init.test.js
```

**Resultado esperado**: 0 errores de sintaxis, `SMOKE OK`, `PARIDAD OK` y las 10 suites del editor en verde (incluida la de carga de estilos guardados, que antes fallaba por ruta).

## 2. Verificación de ausencia de rutas alternativas (objetivo de SC-003)

```bash
# 2.1 Código y documentación del plugin: no debe haber referencias a la carpeta anterior
#     (excluye artefactos de especificacion en specs/ y el historial del modulo en
#     modules/textmuy/here/, que mencionan rutas viejas a titulo documental)
grep -rn "uploads/tm/" --include=*.php --include=*.js --include=*.md --include=*.txt . | grep -v "uploads/pmu/tm-presets" | grep -v "specs/" | grep -v "textmuy/here/"

# 2.2 Raíz propia alternativa del ayudante de miniaturas (objetivo de SC-003)
#     (mismas exclusiones; el == Changelog == de readme.txt es historial y no
#     cuenta como documentacion normativa -> se excluye readme.txt entero aqui;
#     la coherencia del readme normativo se verifica en la seccion 7)
grep -rn "pmu/tm/" --include=*.php --include=*.js --include=*.md --include=*.txt . | grep -v "pmu/tm-presets" | grep -v "specs/" | grep -v "textmuy/here/" | grep -v "^./readme.txt"

# 2.3 Claves del puente por operacion (no deben existir en el editor; las
#     funciones internas de UI con nombres parecidos no cuentan)
grep -rnE "nonces[.](guardar|borrar|subir|cambiar)|urls[.](guardar|borrar|subir|cambiar)" modules/textmuy/js
```

**Resultado esperado**: los tres comandos sin coincidencias.
(La ruta vigente `uploads/pmu/tm-presets/` no cuenta como coincidencia: el filtro `grep -v` la excluye.)

## 3. Verificación de la raíz única de datos (objetivo de SC-002)

1. Ejecutar una secuencia de 20 operaciones en la pestaña del editor: 7 altas (imagen, tipografía, estilo), 6 renombres y 7 bajas.
2. Inspeccionar la carpeta de datos.

**Resultado esperado**:
- Un único catálogo y un único sprite por ámbito, junto a los archivos físicos.
- Ninguna carpeta `uploads/tm/` ni `uploads/pmu/tm/` (la ruta vigente `uploads/pmu/tm-presets/` sí existe y es la de estilos guardados).
- Ningún archivo residual de los recursos dados de baja y ninguna entrada que apunte a un archivo ausente.
- Tras recargar el panel, la galería muestra exactamente los recursos vigentes con su miniatura.

## 4. Recorrido integrado del circuito principal (US1, objetivo de SC-001 y SC-008)

1. Abrir la pestaña del editor de estilos.
   **Esperado**: la galería muestra los recursos del administrador con miniaturas; sin errores en consola por archivos inexistentes.
2. Subir una imagen nueva y una tipografía nueva.
   **Esperado**: ambas aparecen de inmediato y siguen apareciendo tras recargar la página.
3. Guardar un estilo que use la imagen y la tipografía subidas.
   **Esperado**: el estilo queda listado con su miniatura; el archivo del estilo existe en la carpeta de estilos guardados.
4. Ir a la pestaña de PDFs, elegir un PDF y asignar a un grupo el estilo guardado; procesar.
   **Esperado**: el PDF resultante incorpora el texto estilizado con los recursos elegidos; ningún grupo informa recursos ausentes.
5. Borrar la imagen subida en el paso 2 y recargar.
   **Esperado**: desaparece de la galería, su archivo físico ya no está y ningún catálogo conserva una entrada con archivo inexistente.

## 5. Comportamiento ante fallos (US3, objetivo de SC-004)

| Escenario | Cómo provocarlo | Resultado esperado |
|---|---|---|
| Catálogo ausente | Renombrar temporalmente el catálogo de un ámbito | Aviso con causa en la galería; sin recursos sustitutos |
| Catálogo inválido | Escribir una entrada que no sea tupla de 4 | La galería salta la entrada con aviso y contador; el render la rechaza con causa |
| Recurso ausente | Borrar el archivo físico de un recurso referenciado por un estilo | El procesado del grupo se detiene informando el recurso faltante; sin resultados parciales |
| Sin permisos de escritura | Quitar temporalmente el permiso de escritura a un ámbito | La operación informa el motivo; el catálogo no queda a medias |
| Formato anterior | Usar un estilo con referencias por nombre de archivo | Rechazo pidiendo volver a guardarlo desde el editor |

Restaurar el estado original después de cada escenario.

## 6. Despliegue y respaldo (US2/US4, objetivo de SC-006 y SC-007)

1. Copiar la carpeta de datos completa (`uploads/pmu/`) a una instalación limpia con el plugin y el módulo.
2. Abrir la pestaña del editor y la pestaña de PDFs.
   **Esperado**: los mismos recursos y estilos están disponibles; el editor opera sin errores.
3. Seguir la guía de importación del módulo desde cero y verificar cada archivo y ruta que menciona.
   **Esperado**: todos existen; ninguna referencia queda sin resolver.

**Resultado esperado global**: la restauración toma menos de 2 minutos y no requiere ninguna carpeta adicional a `uploads/pmu/`.

## 7. Revisión de documentación coherente (objetivo de SC-003)

Buscar cada dato en toda la documentación vigente y confirmar un único valor por dato:

| Dato | Valor vigente |
|---|---|
| Raíz de datos | `uploads/pmu/` |
| Ámbitos del editor | `fonts`, `img`, `tm-presets` |
| Catálogos | `fonts.json`, `img.json`, `presets.json` |
| Endpoint de recursos | `admin-post.php?action=pmu_uploads` con `op` |
| Versión de caché del módulo | la declarada en los dos HTML del módulo |

**Resultado esperado**: ninguna contradicción y ninguna referencia a archivos inexistentes.

## Criterios de aceptación del recorrido

- [ ] Verificaciones automáticas en verde (sección 1)
- [ ] Cero rutas alternativas y cero claves de puente por operación (sección 2)
- [ ] Un catálogo y un sprite por ámbito, sin residuos (sección 3)
- [ ] Circuito principal completo al primer intento y persistente tras recargar (sección 4)
- [ ] Todos los fallos muestran causa accionable (sección 5)
- [ ] Despliegue y guía de importación sin referencias rotas (sección 6)
- [ ] Documentación con un único valor por dato (sección 7)
