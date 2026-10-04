# Quickstart: campos-consola

**Feature**: 012-campos-consola | **Fecha**: 2026-10-04

Referencia rapida. Para el detalle, `spec.md` (historias), `contracts/` (contratos),
`data-model.md` (formatos), `plan.md` (orden de fases), `tasks.md` (tarea por tarea).

## Donde vive

| Que | Donde |
|-----|-------|
| Indice de campos + metadatos | `uploads/pmu/campos.json` |
| Un campo | `uploads/pmu/campos/{id}/` (`datos.json`, `campo.htm`, `campo.css`, `campo.js`) |
| CSS/JS global | `uploads/pmu/campos/global.css`, `global.js` |
| Imagenes del comprador | `tmp/sesion-{sid}/{item_key}/subidas/{id}.webp` |
| PDF->campos (asociacion) | `uploads/pmu/pdfs/{nombre}/config.json:campos_ids[]` |
| Donde va el valor | `config.json:placeholders[id]` (`value` con `[campoN]`, `settings`, `tipo`) |

## Modelo mental (lo unico que hay que recordar)

- Un **campo** es UI para el comprador, reutilizable en N PDFs. Publica `{valor, cliente}`.
- El campo **no tiene `tipo`**: el tipo de salida lo declara el **placeholder**.
- **nombre** = para el admin. **titulo_cliente** = para el comprador (carrito/checkout/pedido).
  Lo que el comprador ve arriba del campo es **HTML**, no un dato.
- El `valor` decide el destino **a mano**: `[campoN]` en `value` (texto) o `settings`
  (overrides), o `Validez` (que PDF se entrega).
- **Global** = CSS/JS comun a todas las fichas; **propio** = CSS/JS de un campo excepcional.

## Crear un campo de texto (lo mas comun)

1. Pestana **Campos** -> "Nuevo campo" -> plantilla `texto`.
2. Se crea con un input y su `data-rol="valor"` (editable).
3. Opcional: el CSS va al **global** (lo normal), no al campo.
4. En la consola del PDF: elegir el campo en `Campos`, y en el placeholder poner
   `value = [campo56]` (o `settings` si es un override de estilo).
5. "Probar" en la pestana Campos para ver exactamente lo que vera el comprador.

## Crear un campo de imagenes (el caso "6 fotos polaroid")

1. Plantilla `imagen` -> en `datos.json`, `cargador.ranuras = [{w,h,forma,min,max}]`.
   (O el atajo de texto: `size:1000 max:6`.)
2. El HTML trae el boton; `campo.js` monta `CargadorPMU` y publica `valor = [ids]`.
3. El placeholder: `tipo = "imagen"`, `value = [campo55]`, y `cont = 6` en el grupo.
4. El Motor recibe `id => [6 rutas]` y coloca una por instancia (F7).

## Conectar un valor a un destino

| Destino | Como | Ejemplo |
|---|---|---|
| Texto del hueco | `value = [campoN]` | `[campo1] Hola [campo2]` |
| Override de estilo | `settings = [campoN]` | color/tamano del cliente |
| Que PDF se entrega | `Validez`: `campo1 === 'a4'` | A4 vs Carta |
| Imagen del hueco | `tipo=imagen` + `value = [campoN]` | 6 fotos en 6 huecos |

## Reglas del sandbox (obligatorias)

- `campo.js` empieza con `function`; prohibidos `document.getElementById` /
  `document.querySelector` / `DOMContentLoaded` / `id=""`.
- Unico acceso al DOM: `root`. Unica salida: `ctx.set(id, {valor, cliente})`.
- El HTML no puede traer `<script>`, `<iframe>`, `<form>` ni `id=""`.
- Limite 20 000 caracteres por archivo.
- **PHP nunca evalua JS**: los scripts corren solo en el navegador.

## Puertas (todas obligatorias)

```
php -l (plugin + admin/ + engine/ + inc/)
php tests/motor_smoke.php          -> SMOKE OK
php tests/parity.php               -> PARIDAD OK
php tests/texto_puente.php <fase>  -> todas las fases
node --check (js tocados)
node tests/mockup-contrato.test.js -> GEOMETRIA/CONTRATO OK
node tests/campos-contrato.test.js -> CONTRATO CAMPOS OK
```

## Errores frecuentes

| Sintoma | Causa |
|---|---|
| `motor:campos:script:invalido` | el `campo.js` rompe el sandbox |
| El campo no muestra nada en la ficha | es `protegido`, o no hay >=1 campo (el global no carga), o el `campo.js` falla |
| La imagen del comprador no aparece en el PDF | N ids != `cont` del grupo (se avisa y se bloquea) |
| El preview no carga estilos | el iframe solo enlaza las hojas ya encoladas en el admin |
| Un campo cambia y el comprador lo ve viejo | falta subir `?v=` con `meta.modificado` |

## Editar el codigo (seccion 10.ter de AGENTS.md)

Editar **siempre** con la herramienta de edicion (nunca heredocs ni scripts que reescriban el
archivo). Validar (`php -l`, `node --check`) **despues de cada paso**, no al final. Si algo se
rompe: `git checkout -- <archivo>` y rehacerlo.
