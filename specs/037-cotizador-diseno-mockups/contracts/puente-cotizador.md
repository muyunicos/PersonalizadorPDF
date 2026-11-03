# Contrato — Puente Cotizador (spec 037)

> Normativo para la implementacion. Nombres de campo, claves y rutas estables.
> Contexto: [spec.md](../spec.md) §2 (D5) y [research.md](../research.md) R1/R2/R7.

## C0 — Que inyecta el consumidor

El cotizador (calculadora de stickers) monta su paso de diseno dentro de:

```html
<div data-pmu-panel data-pmu-contexto="cotizador" id="mu-cotizador-diseno"></div>
```

y garantiza, antes de usar los modulos del plugin, este objeto (el que ya leen todos los modulos):

```js
window.PMU_TIENDA = {
  version: '...',
  ajaxUrl: '.../wp-admin/admin-ajax.php',
  postUrl: '.../wp-admin/admin-post.php',
  nonceVistaPrevia: '...',
  contexto: 'cotizador'
};
```

Reglas:
- `contexto` es **informativo**: no otorga permisos ni cambia validaciones (§III).
- Sin `PMU_TIENDA.nonceVistaPrevia` valido, los endpoints responden `motor:nonce:invalido`.
- Los modulos se cargan **solo** cuando el paso se abre (D10); el plugin no los encola en la
  pagina del cotizador.

## C1 — Fachada publica `PMU_Cotizador`

`inc/class-pmu-cotizador.php`. No es un dispatcher nuevo: **delega** en `PMU_Sesion` y
`PMU_Uploads` (un dueno por dato, §II).

| Miembro | Firma | Que hace |
|---|---|---|
| `activo` | `() -> bool` | lee `apply_filters('pmu_cotizador_activo', true)` |
| `contexto` | `() -> array` | `{activo, contexto, postUrl, ajaxUrl, nonce, prefijoItem: 'cot-'}` |
| `assets` | `() -> void` | encola **solo** `mockup-render`, `selector`, `visor`, `biblioteca`, `cargador`, `fotos`; **nunca** `tienda.js` ni `campo-montar.js` |
| `listar_ideas` | `() -> array` | customs de la identidad (invitado: `tmp`; cliente: `orders/{cliente}/customs/`) + `favoritos.json` de items de la tienda |
| `guardar_idea` | `(array $idea) -> array` | valida y escribe `customs/{idea_id}/idea.json` + promueve el snapshot |
| `favorito` | `(string $tipo, string $ref, bool $valor) -> bool` | estrella sobre **cualquier** item (custom → `idea.json`; tienda/historial → `favoritos.json`) |
| `borrar_idea` | `(string $idea_id) -> array` | borra `idea.json` + su `mockup.webp` (nunca el original compartido) |
| `promover_linea` | `(int $order_id, string $item_key) -> string` | mueve el item y sus originales **sin** `entregar_por_tema()` ni bonus |

- Todos los metodos validan `activo()`; si esta apagado responden vacio/`false` sin tocar disco.
- `assets()` respeta `PERSONALIZADOR_PDF_URL` / `PERSONALIZADOR_PDF_VERSION`.

## C2 — Endpoint unico `admin_post_pmu_cotizador`

Registro: `admin_post_pmu_cotizador` + `admin_post_nopriv_pmu_cotizador`.
Nonce: `personalizador_pdf_vista_previa`. Identidad: **cookie** `pmu_sid` (+ `uid` si hay sesion),
nunca el `sid` del POST (014). Respuesta JSON. Causas: `cotizador:<motivo>`.

| `op` | args | ok | errores |
|---|---|---|---|
| `listar` | — | `{ideas:[...], favoritos:[...], revision}` | — (lista vacia no es error) |
| `guardar` | `idea` (JSON), `mockup` (imagen) | `{idea}` | `cotizador:idea:*`, `cotizador:ideas:tope` |
| `favorito` | `tipo` (`custom`\|`tienda`\|`historial`), `ref`, `valor` | `{tipo, ref, favorito}` | `cotizador:favorito:tipo` |
| `borrar` | `idea_id` | `{borrado:true, archivos:N}` | `cotizador:idea:ajena`, `cotizador:idea:ausente` |
| `historial` | — | `{pedidos:[{order_id, order_code, fecha, diseno}]}` | — |

- Ninguna operacion acepta rutas: `idea_id`, `ref` y `dsid` se validan por regex y el archivo se
  resuelve con `is_file()`/`realpath` dentro de `uploads/pmu/` (§III).
- `guardar` es **idempotente** por `idea_id`: re-guardar la misma idea la reemplaza (no duplica).
- `op=historial` lee Woo (`wc_get_orders` por `customer_id`) y no persiste copia.

### Ejemplo — `op=guardar`

```http
POST /wp-admin/admin-post.php
Content-Type: multipart/form-data

action=pmu_cotizador&op=guardar&_wpnonce=...
idea={"id":"idea-1761000000-a1b2","order":"v1.m11.s60.q15.f1.d0",
      "titulo":"Circulos 6 cm - Vinilo","descripcion":"...","favorito":true,
      "precio":{...},"diseno":{"id":"9f2c41ab0d7e","itemKey":"cot-2f7c9a1b","sid":"b0f8225e",
      "w":709,"h":709,"receta":"a1b2c3d4e5f6"}}
mockup=<archivo webp 300x300>
```

Respuesta:

```json
{"ok": true, "idea": {"id": "idea-1761000000-a1b2", "favorito": true,
 "mockup": {"id": "5c1d77e0a9b3", "w": 300, "h": 300, "mockupId": "mk-circulares"}}}
```

- Si el snapshot ya existia (mismo sha), se **reusa** el `id` (dedupe de la 035).

## C3 — Promocion

- Disparo: `woocommerce_order_status_processing` / `_completed` (los mismos hooks que hoy).
- Recorre solo line items con `_mu_origen = 'cotizador'`; valida `_pmu_sid` + `_pmu_item_key`
  contra el manifest (si no resuelve, se ignora y se loguea la causa).
- `promover_linea()`:
  1. escribe `manifest.cliente = customer_id` **antes** del movimiento;
  2. mueve los originales a `orders/{cliente}/uploads/{id}.webp`;
  3. renombra el item a `orders/{cliente}/{order_id}/{item_key}/`;
  4. adopta los customs del invitado a `orders/{cliente}/customs/` (idempotente);
  5. **no** llama a `entregar_por_tema()` ni `congelar_bonus_item()`.
- Sin `customer_id > 0` **no** se promueve (035 D5) y queda causa visible en el log del pedido.

## C4 — Errores (nomenclatura)

| Causa | Cuando |
|---|---|
| `motor:nonce:invalido` | nonce ausente o vencido |
| `cotizador:inactivo` | `pmu_cotizador_activo` en `false` |
| `cotizador:idea:id` | `idea_id` fuera de regex |
| `cotizador:idea:ajena` | la idea no pertenece a la identidad |
| `cotizador:idea:ausente` | no existe el `idea.json` |
| `cotizador:ideas:tope` | supera 60 ideas |
| `cotizador:mockup:ausente` | el snapshot no resuelve a un archivo |
| `params:invalidos` | receta fuera de rango (`receta_validar`) |
| `motor:sesion:promocion:sin:cliente` | pedido con `customer_id = 0` |

Ningun error se convierte en un fallback silencioso: el cliente recibe la causa y la UI degrada
(D9).