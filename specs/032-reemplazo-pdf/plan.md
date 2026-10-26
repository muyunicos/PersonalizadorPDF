# Plan de implementacion: Reemplazar el PDF sin perder la personalizacion

**Rama**: (sin rama: el repo despliega desde `main`)
**Spec**: [spec.md](./spec.md)
**Estado**: plan (borrador), sin implementar
**Creada**: 2026-10-26

---

## Summary

Convertir "reemplazar el PDF" en un flujo **transaccional de dos pasos**: (1) **preparar** — el PDF nuevo se
analiza en un temporal y se calcula el **mapa** viejo->nuevo (ids iguales + sugerencias IoU/DeltaE), sin
tocar el dataset vigente; (2) **confirmar** — con el ok del admin en el modal, se respalda, se hace el
**swap por archivo** (PDF + `analisis.json` + `envolturas.json`) y se reescribe `config.json` **remapeado**
(`placeholders{id}`, `envolturas{gid}` y `mockups[].capas[].ref`). Incluye **Cancelar** (cero cambios) y
**Recuperar la version anterior** (restauracion del respaldo). El mismo remapeo se aplica a "Re-analizar",
que hoy deja `envolturas{gid}` y los `ref` de capa desactualizados.

**Se conserva por construccion**: `config.json` completo (productos, campos, tienda, `preview_omisible`,
`mockups[]`, **bonus**) porque **no se borra la carpeta del producto** (D1).

## Technical Context

- **Lenguaje/stack**: PHP 8 (plugin WP, hosting compartido, sin dependencias nativas ni Composer en runtime) + JS ES5/jQuery en el admin. Motor PHP puro (`engine/`).
- **Almacenamiento**: archivos en `uploads/pmu/` (`PMU_Uploads` como dueno unico): `pdfs/{nombre}/` (producto) y `tmp/reemplazos/{nombre}/{ts}/` (respaldos). Sin tablas propias.
- **Endpoints**: handlers `admin_post` de la consola con `seguridad('personalizador_pdf_*')` y respuesta **JSON** por `responder()` (patron vigente; sin recargas, errores inline).
- **Testing**: puertas del repo (`php -l`, `tests/texto_puente.php` fase nueva `reemplazo`, `tests/motor_smoke.php`, `parity`, contrato Node, geometria) + recorrido en `C:\wp-lab`.
- **Sin nuevas dependencias**. Sin cambios en el comprador (`panel_ficha`, `tienda.js`, `PMU_Sesion`).
- **Formatos**: `config.json` **no cambia de forma** (mismo `envolturas{gid}` y `mockups[].capas[].ref`); se agrega un **ambito** `tmp/reemplazos/` (dato de trabajo, no catalogo).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Principio | Estado |
|---|---|---|
| G1 | §I WooCommerce (NON-NEGOTIABLE): mockup obligatorio, sesion por item, `_pmu_pdf_slugs`, snapshot `manifest.pdfs[]` | **PASS** — no toca la ficha, el carrito, la validacion, el snapshot ni la promocion a pedido (FR-013). Los pedidos pagados conservan su archivo en `orders/`; si el cliente **vuelve a generar** el PDF, se genera con la version nueva y sin aviso (FR-015, D9) |
| G2 | §II Arquitectura modular: un dueno por dato y por ruta | **PASS** — el swap **reutiliza** los caminos vigentes: `Metadata::guardar` (analisis/envolturas) y `PMU_Uploads::guardar_config` (config). El mapa se calcula en `Metadata` (helper puro, mismo dueno del dataset). No hay endpoints REST nuevos ni un segundo camino de escritura |
| G3 | §III Render en navegador + inyeccion server-side; PHP nunca evalua JS | **PASS** — el mapa (IoU/ΔE) es **PHP puro** sobre el dataset y los colores; el modal es UI del admin. El servidor no renderiza texto ni geometria del diseno |
| G4 | §IV Estructura PMU: `uploads/pmu/`, JSON solo ahi, sin tablas, escritura atomica | **PASS** — todo vive en `uploads/pmu/` (producto + `tmp/reemplazos/`); se respeta la escritura atomica vigente (`guardar_config`). Sin tablas ni catalogos nuevos |
| G5 | §V No backward compatibility (desarrollo, sin migraciones) | **PASS** — sin migraciones; el formato de `config.json` no cambia, solo se **remapean valores**. Los productos existentes siguen abriendo igual |

## Project Structure

### Documentacion (esta spec)

```
specs/032-reemplazo-pdf/
├── spec.md        (US, FR-001..015, SC-001..007, D1..D10, riesgos)
├── plan.md        (este archivo)
├── research.md    (Phase 0: decisiones de score, respaldo y atomicidad)
├── data-model.md  (el mapa como estructura de datos; el respaldo)
├── contracts/
│   └── reemplazo.md   (ops, JSON de ida/vuelta, invariantes del swap)
├── quickstart.md  (casos R1..R8 en el laboratorio)
└── tasks.md       (T001..T0NN)
```

### Codigo (que se toca y que no)

```
personalizador-pdf.php
├─ handle_reemplazar_preparar()   NUEVO   analiza en staging y devuelve el mapa (no toca nada)
├─ handle_reemplazar_confirmar()  NUEVO   respaldo + swap por archivo + config remapeado
├─ handle_reemplazar_recuperar()  NUEVO   restaura el ultimo respaldo
├─ analizar_y_guardar()           6114    EXTRAER de aca el remapeo (compartido) y el mapa
├─ handle_subir_pdf()             6337    modo `sobrescribir` -> delega en preparar+confirmar (D10)
├─ handle_reanalizar()            6388    pasa a usar el MISMO remapeo (FR-011)
└─ limpiar_datos_de()             6438    NO se llama mas desde el reemplazo (D1); sigue en Borrar
inc/class-pmu-uploads.php
├─ dir_reemplazo($nombre, $ts, $crear)  NUEVO helper de ruta (dueno unico de datos)
└─ limpiar_ttl()                        EXCLUIR `tmp/reemplazos/` del barrido de borradores (FR-010)
engine/Metadata.php
├─ Metadata::mapaDeReemplazo($previos, $nuevos)   NUEVO, PURO: ids iguales + sugerencias (IoU/DeltaE)
└─ Metadata::remapearConfig($config, $mapa)       NUEVO, PURO: placeholders + envolturas{gid} + refs
admin/pdfs.php
├─ seccion "2. PDFs subidos" (93)   boton "Reemplazar archivo" por fila
├─ modal de conflicto (793-802)     opcion `sobrescribir` reescrita (D10)
└─ modal del mapa                   grupos iguales / sugeridos (con score) / perdidos + Migrar|Cancelar
assets/admin.js, assets/admin.css   el flujo (preparar -> modal -> confirmar/cancelar/recuperar)
tests/texto_puente.php              fase `reemplazo` (mapa, cancelar/migrar, fallo, recuperar, refs)
tests/  (NO se crean archivos nuevos de codigo; el mapa se prueba en la fase del arnes)
```

**No se toca**: `engine/Detector.php`, `engine/Overlay.php`, `engine/Motor.php`, `engine/Imagen.php`,
`inc/class-pmu-sesion.php`, `assets/tienda.js`, `assets/campo-montar.js`, `modules/textmuy/`,
`personalizador-pdf.php::panel_ficha()` (FR-013).

### Structure Decision

Sin archivos nuevos de codigo: el **mapa** y el **remapeo** son funciones **puras** de `Metadata`
(el dueno del dataset), testeables con `php -r` y desde la fase del arnes; el respaldo y el swap se apoyan
en `PMU_Uploads` (dueno de rutas/catalogos). El flujo de UI vive en `admin/pdfs.php` + `assets/admin.js`.

## Complexity Tracking

> **Sin violaciones** al Constitution Check (G1-G5 PASS).

Complejidad **intrinseca** que el diseno asume a proposito:

- **Dos pasos asincronicos** (preparar -> confirmar) en vez de uno: es lo que permite *ver el mapa antes de
  decidir* y *cancelar sin efectos* (FR-005). Un flujo de un paso obligaria a aplicar y luego deshacer.
- **El remapeo es heuristica** (IoU/DeltaE) y por eso **nunca decide solo**: el modal es obligatorio (D4).

## Fases

- **F0 Setup**: puertas base en verde (`php -l`, contrato Node 147, geometria 135, `motor_smoke`, `parity`) y
  **auditoria de anclas**: que fases del arnes y checks del contrato indexan `sobrescribir`,
  `limpiar_datos_de`, `handle_reanalizar` y `personalizacion_perdida` (fases `subir_conflicto`, `reanalizar`,
  `borrado`).
- **F1 Mapa puro**: `Metadata::mapaDeReemplazo()` (IoU de bboxes + DeltaE de color, umbrales, 1:1, sin
  candidato = perdido) + casos construidos en la fase del arnes (mismo bbox / desplazado / color distinto /
  sin candidato).
- **F2 Remapeo compartido**: `Metadata::remapearConfig()` (`placeholders`, `envolturas{gid}` con revalidacion
  de `k`, `mockups[].capas[].ref` con `#n` fuera de rango) + `handle_reanalizar` pasa a usarlo (FR-011/012).
- **F3 Preparar**: staging del PDF nuevo + analisis previo + respuesta con el mapa. **Cero cambios** en el
  producto si el analisis falla (FR-003/FR-004).
- **F4 Confirmar**: respaldo + swap **por archivo** + `config.json` remapeado (FR-006/FR-007).
- **F5 Recuperar**: restauracion del respaldo + retencion de **un solo** respaldo + exclusion del TTL
  (FR-008/009/010).
- **F6 UI**: boton por fila, modal del mapa (Migrar/Cancelar), boton Recuperar, modal de conflicto reescrito;
  JSON sin recargas e informacion inline (FR-001/FR-014).
- **F7 Legado**: `handle_subir_pdf` modo `sobrescribir` delega en el flujo nuevo (D10) y se elimina el camino
  que borra antes de mover (FR-002).
- **F8 Puertas**: lint, contrato Node, geometria, `motor_smoke`, `parity`, fases `reemplazo`/`reanalizar`/
  `borrado`/`subir_conflicto` + recorrido R1-R8 en `C:\wp-lab` con hashes.
- **F9 Cierre**: AGENTS §5 (ambito `tmp/reemplazos/`) y §7 (decision del reemplazo sin perdida), `admin/ayuda.php`,
  tasks.md al dia, bump de version y push (previo visto bueno: el push despliega).