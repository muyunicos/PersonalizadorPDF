# 014 — El comprador invitado (checkout sin cuenta)

> Estado: **implementada**. Requisito del negocio: con checkout sin cuenta —el
> default de WooCommerce— el visitante tiene que poder armar el pedido entero.
> No cambia el formato de datos ni el motor.

## Problema

Los cuatro endpoints del comprador exigian `current_user_can('read')`:

| Endpoint | Que hace |
|---|---|
| `personalizador_pdf_vista_previa` | crea/actualiza el borrador del pedido |
| `personalizador_pdf_pool` | guarda los PNG renderizados del navegador |
| `personalizador_pdf_subida` | sube la foto del comprador |
| `personalizador_pdf_subida_url` | resuelve el id de una foto a su URL |

Los cuatro YA estaban registrados con `wp_ajax_nopriv_`: el invitado llegaba
hasta el handler y se topaba con la capacidad. Con la tienda en modo invitado,
**el flujo completo estaba roto**: sin vista previa, sin fotos, sin botón
"Listo". No lo introdujo la spec 012: viene de la 004.

## Decision: la identidad es la cookie, no la cuenta

Quitar el `current_user_can` a secas habria sido un agujero. La identidad pasa a
ser la cookie `pmu_sid` (httponly, `SameSite=Lax`, 30 dias, UUID v4), que es lo
que `PMU_Sesion::sid_actual()` ya emitia y lo que **ya delimita** el modelo de
capacidades que el admin acepta para los archivos (`AGENTS.md` §5).

### El agujero que se cierra de paso

Los handlers leian el `sid` **del POST**:

```php
$sid = sanitize_text_field(wp_unslash((string)($_POST['sid'] ?? '')));
```

El nonce `personalizador_pdf_vista_previa` va impreso en la ficha, o sea que es
**publico**: cualquiera que abra un producto lo tiene. Con solo el nonce, un
cualquiera podia pasar un `sid` inventado y escribir (o leer) en la sesion de otro
comprador. Ese hueco existia **tambien para los usuarios logueados**: el
`read` no protegia nada de eso, porque el `sid` no venia de la sesion.

Ahora el `sid` del POST **se ignora**: manda el de la cookie. Es mas estricto
para todos, no mas laxo.

## Requisitos funcionales

- **FR-001** Los cuatro endpoints del comprador DEBEN funcionar sin cuenta de
  WordPress (`current_user_can` no se consulta).
- **FR-002** El nonce `personalizador_pdf_vista_previa` se verifica **antes** de
  tocar la sesion: un request sin nonce valido no lee ni escribe nada.
- **FR-003** La identidad DEBE salir de la cookie `pmu_sid`. El `sid` del POST se
  ignora por completo (no se compara, no se usa: no se usa).
- **FR-004** Con `item_key` no vacio, el item DEBE existir bajo ese sid; si no,
  `motor:sesion:item:ajeno`. Sin esto un `item_key` inventado crearia carpetas.
- **FR-005** Un usuario **logueado** tambien se autoriza por cookie, no por
  capacidad: el cambio no abre nada a los que ya tenian cuenta.

## Fuera de alcance

- La **descarga** del PDF ya era `nopriv` con su propia comprobacion
  (`handle_item_descargar`); no se toca.
- **WooCommerce real**: el lab no lo tiene. La verificacion es con el shortcode
  `[pmu_personalizar]` y un navegador sin sesion.

## Verificacion

- Arnes: fases nuevas `invitado` (sin cuenta sube al pool) e `invitado_ajeno`
  (item de otra sesion rechazado), y `pool`/`pool_reem` actualizados a fijar la
  cookie. **24 fases, 0 fallos.**
- Lab, navegador real **sin loguearse** (`smoke-invitado.js`): monta la ficha,
  emite la cookie, sube 2 fotos, `Listo` se habilita al cumplir el minimo, y los
  archivos aparecen en `tmp/sesion-{sid}/{item}/subidas/`.
- `smoke-ficha.js` (logueado) sigue en verde: no se rompio el que ya funcionaba.