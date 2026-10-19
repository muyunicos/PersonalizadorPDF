# 018 — Consola de Campos v4: el campo manda

> Estado: **implementada 2026-10-19** (T021/T022/T024 pendientes: recorrido manual y release
> 4.9.0). Origen: revision de la consola
> de Campos (drawer `ec-c-drawer-panel`) del 2026-10-19. Version objetivo: **4.9.0**.
>
> Decision del negocio: la fila **"Cargador de imagenes"** no se aprueba como
> opcion aparte. El cargador se declara en el **HTML/CSS/JS del campo**, igual
> que el resto del campo: un contenedor en el HTML y un `campo.js` que monta el
> componente con `PMU_API`. **Sin migracion de datos** (los campos viejos siguen
> funcionando por compatibilidad de lectura). Se permite adaptar las demas piezas
> (`tienda.js`, `admin.js`, `cargador-pmu.js`) para sostenerlo.

## Problema

1. **Dos modelos mentales.** Todo campo es `campo.htm` + `campo.css` + `campo.js`,
   salvo el cargador: se declara en `datos.json:cargador` (textarea de atajos
   como `1_size:1024x768 2_min:2`, `personalizador-pdf.php:3675-3679`) y lo monta
   el sistema desde `tienda.js:440-481`. El admin no puede elegir donde va el
   boton, que HTML lo rodea ni reutilizar el patron en otro campo.
2. **Datos muertos en el editor.** `array` se guarda y **no se lee** en ningun
   lado: el runtime ya concilia listas solo (`PURO.conciliarGrupo`) y el cargador
   calcula su propio `array` (`tienda.js:474`). `texto_ayuda` se guarda
   (`inc/class-pmu-uploads.php:1535`) pero no tiene input ni consumidor: se pisa
   con vacio en cada guardado.
3. **`protegido` engana.** Hace algo real (el campo no se monta en la ficha,
   `personalizador-pdf.php:420-423`, FR-040 de la 012), pero no sirve como "valor
   por defecto": si no viaja el HTML tampoco viaja el JS, y el `[campoN]` queda
   **vacio**. La etiqueta "nunca va al comprador" no explica ese efecto.
4. **El tipo es de solo lectura** (`personalizador-pdf.php:3630-3651`, 015 D10) y
   no se puede corregir un alta mal tipada. El tipo **declara, no enruta**
   (015 D11): solo alimenta la columna, el orden y los avisos de cableado
   (`avisos_cableado():4020-4063`).
5. **Titulo del drawer sucio.** `assets/admin.js:203` lee `.ec-c-nombre`, que
   incluye el `.ec-c-sub` con `Cliente: …` y la nota interna
   (`personalizador-pdf.php:3541-3549`); lo mismo en el titulo del modal de vista
   previa (`admin.js:1278`).
6. **La subida no es del campo.** `subirFoto()` (`assets/tienda.js:388-408`) usa
   nonce + cookie `pmu_sid` + `item_key` y vive dentro del closure: un `campo.js`
   ve `window.CargadorPMU` pero **no** puede subir nada. `PMU_API` ademas se crea
   **despues** de montar los campos (`tienda.js:1196` -> `:1207`).

## Decisiones

| | Decision |
|---|---|
| **D1** | **El cargador se declara en el campo.** El HTML trae un contenedor `[data-pmu-cargador]` y el `campo.js` monta `CargadorPMU` con `PMU_API.montarCargador(...)`. Desaparece la fila "Cargador de imagenes" de la consola. |
| **D2** | **`PMU_API` es la API publica del sistema para el campo**: `subirFoto`, `urlDeSubida` y `montarCargador` (con `subir`, `urlDe`, `idsIniciales` y `envoltura` ya resueltos). Se crea **antes** de montar los campos y sobrevive a la re-edicion. |
| **D3** | **Sin migracion.** Los campos que ya tienen `cargador` en `datos.json` se siguen leyendo y montando por el sistema **solo si no tienen `campo.js`** (`cargador && !campo.js`). Cuando el admin pegue el HTML/JS nuevo, el cargador del sistema se apaga solo. `cargador` no se escribe desde la UI y **no se pisa** al editar. |
| **D4** | **Tipo editable.** Declara, no enruta (015 D11). Guardar actualiza `items[].tipo` del indice y `datos.json`, **sin** reescribir HTML/CSS/JS. La consola ofrece "Cargar la plantilla de este tipo" (cliente, sin servidor). |
| **D5** | **Fuera del editor los datos muertos**: `array`, `texto_ayuda` y `protegido` salen del formulario. El lector sigue siendo tolerante si existen en `datos.json` viejos. |
| **D6** | **Titulos limpios**: el drawer y el modal de vista previa usan el nombre del campo (`.ec-c-nombre-txt`), sin `Cliente:` ni nota interna. |
| **D7** | **Se pueden adaptar otras piezas** (`tienda.js`, `admin.js`, `cargador-pmu.js`, `campo-montar.js`) para sostener D2, sin duplicar el motor de render ni la subida. |
| **D8** | Para campos nuevos el servidor **deja de validar ranuras** (constitution §III: PHP no evalua JS). Red de seguridad: plantilla escrita, boton **Probar** y `console.warn` si falta el componente. `PMU_Uploads::validar_cargador()` se conserva para los campos legacy. |
| **D9** | **El preview del admin corre el mismo `campo.js`** que la ficha, con un stub de `PMU_API` (puente same-origin, subida simulada). "Probar" sigue siendo la garantia de "lo que ves es lo que compra". |
| **D10** | **N campos de imagen por producto/PDF.** `campos_ids` es una lista y cada campo monta su cargador en su propio `.pmu-campo-{id}`; no hay singleton ni estado compartido salvo la sesion del item. El spec lo declara como requisito (no queda implicito). |

## Historias de usuario

- **US1 (P1) — El cargador es del campo.** Como admin, quiero poner un contenedor
  en el HTML y montar el cargador desde el JS del campo, para tener un solo
  modelo (HTML + CSS + JS) y controlar donde aparece.
- **US2 (P1) — Corregir el tipo.** Como admin, quiero cambiar el tipo de un campo
  existente sin recrearlo, porque el tipo declara la intencion y dispara avisos.
- **US3 (P2) — Consola sin ruido.** Como admin, no quiero ver opciones que no
  hacen nada (`array`, `texto_ayuda`) ni una casilla cuyo efecto no entiendo
  (`protegido`).
- **US4 (P2) — Titulo correcto.** Como admin, quiero que el editor diga solo el
  nombre del campo, sin el `Cliente: …` ni la nota interna.
- **US5 (P3) — El comprador no nota nada.** Como comprador, el cargador sigue
  funcionando igual (selector visual, `min`/`max`, tiras, re-edicion) sin que el
  `campo.js` pueda romper la sesion ni la subida.

## Requisitos funcionales

- **FR-001** `PMU_API.subirFoto(blob, campo)` sube al item del comprador (lo crea
  o lo reusa como hoy, D7 de la 012), actualiza `PMU_API.sesion` y devuelve
  `{id, file, mime, bytes}`. La identidad sigue saliendo de la cookie (014).
- **FR-002** `PMU_API.montarCargador(el, {campo, ranuras, onChange, envoltura})`
  instancia `CargadorPMU` con `subir` (FR-001), `urlDe` (miniaturas por id),
  `idsIniciales` (desde `PMU_FICHA.valores[campo]`), la `envoltura` del grupo
  asociado (desde `PMU_FICHA.campos`) y espeja `listo`/`array` en el estado.
  Devuelve la instancia o `null` si faltan dependencias.
- **FR-003** `PMU_API` existe **antes** de `PMUCampo.montar()` y conserva
  `pdf`, `sesion` y `valores()`. Un `campo.js` puede usarlo en el montaje y en
  los clicks.
- **FR-004** La plantilla `imagen` trae HTML real (`<p class="pmu-et">…</p>` +
  contenedor `[data-pmu-cargador]`) y un `campo.js` de montaje; su `cargador`
  queda en `null`.
- **FR-005** El editor no muestra la fila "Cargador de imagenes"; `cargador` no se
  escribe desde la UI y **no se pisa** al guardar un campo que ya lo tenia (D3).
- **FR-006** Una sola via de montaje por campo: con `campo.js` manda el campo;
  sin `campo.js` y con `cargador`, monta el sistema como hoy. Nunca las dos.
- **FR-007** El tipo es un `<select>` en edicion; guardarlo actualiza
  `campos.json:items[].tipo` y `datos.json:tipo`, y los avisos de cableado usan
  el valor nuevo. No reescribe HTML/CSS/JS (D4).
- **FR-008** Sin `array`, `texto_ayuda` ni `protegido` en el formulario; los
  `datos.json` viejos con esas claves se leen sin romper (D5).
- **FR-009** El titulo del drawer y el del modal de vista previa usan
  `.ec-c-nombre-txt` (D6).
- **FR-010** El preview del admin ejecuta el `campo.js` con un `PMU_API` simulado
  que **no hace peticiones** (sin nonce, sin endpoint, sin item) y dibuja el
  cargador igual que la ficha (D9). El stub se instala **en la pagina del admin**
  (`apiPreview()` + `activarApiPreview()`), porque `campo-montar.js` ejecuta el
  `campo.js` con `new Function` en ese realm y no dentro del `srcdoc`.
- **FR-011** Si faltan `CargadorPMU` o `PMU_API`, `montarCargador` devuelve `null`
  y deja un `console.warn` accionable; la ficha no se rompe (el resto de los campos
  sigue montandose).
- **FR-012** Cero regresion en carrito, vista previa, pool, pedido y Motor: las
  fotos siguen siendo `manifest.subidas[]` (`subidas/{uuid12}.{ext}`) y el Motor
  recibe `id => [rutas]`.
- **FR-013** Con N campos de imagen en el mismo producto/PDF, cada uno monta su
  cargador dentro de su propio `.pmu-campo-{id}` y publica su lista en
  `estado[id].valor`; ningun estado se comparte salvo la sesion del item (D10).
- **FR-014** Con N campos, el carrito y el pedido muestran una linea por campo
  con su `titulo_cliente`; un campo sin titulo cae al texto por defecto
  ("Campo N") sin romper (D10).

## Contrato `PMU_API` (publico para `campo.js`)

| Miembro | Firma | Que hace |
|---|---|---|
| `subirFoto` | `(blob, campo) => Promise<{id,...}>` | Sube el recorte al item (crea/reusa) y refresca `PMU_API.sesion`. |
| `urlDeSubida` | `(id) => Promise<string\|null>` | URL de una subida del item, resuelta contra el manifest. |
| `montarCargador` | `(el, {campo, ranuras, onChange, envoltura}) => CargadorPMU\|null` | Monta el cargador con todo el cableado del sistema (FR-002). |
| `valores` | `() => estado` | Estado dual por campo (`{valor, cliente}`). |
| `sesion` | `{sid, item_key}` | Identidad vigente del comprador (se actualiza al primer envio). |

Notas de uso (para el `campo.js`):
- El `campo.js` corre en el ambito de la pagina (`campo-montar.js:76-86`), asi que
  `window.PMU_API` y `window.CargadorPMU` estan disponibles.
- El sandbox del servidor exige que el JS empiece con `function` y prohibe
  `document.getElementById/querySelector` y atributos `id=` en el script
  (`inc/class-pmu-uploads.php:1219-1234`): usar `root.querySelector(...)`.
- El contenedor se busca **dentro de `root`**, que ya esta scopeado al campo.

## Cambios al formato del campo (sobre v3)

| Clave | Antes | Despues |
|---|---|---|
| `tipo` | elegido al crear, solo lectura | editable en el editor (indice + `datos.json`) |
| `cargador` | declarado en la UI (textarea) | **legacy**: se lee si existe; no se escribe desde la UI; no se pisa al editar |
| `array` | checkbox + `datos.json` | fuera de la UI y del formato nuevo (lectura tolerante) |
| `protegido` | checkbox + `datos.json` | fuera de la UI (lectura tolerante: un campo protegido sigue sin montarse) |
| `texto_ayuda` | guardado sin UI | fuera de la UI y del formato nuevo |

Sin migracion: los archivos existentes no se tocan. Un campo legacy con
`cargador` y sin `campo.js` sigue igual; al pegarle la plantilla nueva entra en
el modo del campo.

## Fuera de alcance

- **Migracion / convertidor / boton "Convertir"**: no hay. D3 es tolerancia, no
  proceso.
- **Editor visual de ranuras en la consola**: se descarta con la fila.
- **Cambiar el contrato del hueco** (`value` / `settings`) o el tipo del
  placeholder.
- **Tocar `engine/` o `modules/textmuy/`**.

## Verificacion

- Node: `node tests/campos-contrato.test.js` (contrato de `PMU_API`, plantilla,
  una sola via de montaje, preview simulado) y `node tests/conciliacion.js`.
- PHP: `php -l` sobre los archivos tocados, `php tests/texto_puente.php` fases
  `campos` (sin `array`, `cargador` legacy conservado), `admin`, `ficha`,
  `vista_previa`, `campo_subida`, `pedido`; `php tests/motor_smoke.php` y
  `php tests/parity.php` como regresion.
- Lab sin Woo (`[pmu_personalizar]`): campo de imagen nuevo (2 fotos, re-editar y
  ver las minis), **dos** campos de imagen en el mismo PDF (FR-013/014) y
  "Probar" sin peticiones (FR-010).
- WP real: compra de prueba con un campo de imagen (vista previa, carrito, PDF).

## Lo que NO se toca

- El **motor** (`engine/`): deteccion, overlay y encajado.
- La **sesion, el pool y el pedido**: mismas rutas y mismo manifest.
- `modules/textmuy/` ni su contrato RenderCore.
- Los hooks Woo y la entrega (017).
