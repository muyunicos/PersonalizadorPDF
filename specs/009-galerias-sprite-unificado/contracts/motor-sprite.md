# Contract: `op=sprite` (motor único, los tres ámbitos)

**Owner**: plugin — `PMU_Uploads::handle_request()` → `PMU_Uploads::sprite()` (delega física a `PMU_Galeria::sprite()`).
**Consumidor**: módulo TextMuy vía `ThumbEngine.ensureSprite` (`assets/miniaturas.js`, plugin) y `TextMuyAPI.reconstruirSpriteCanonico` (`modules/textmuy/js/api.js`).
**Cambio de este spec**: la validación y la certificación dejan de ser exclusivas de `img`; aplican a `fonts`, `img` y `tm-presets`. El payload **no cambia**.

## Request

`POST {urls.motor}` (`admin-post.php?action=pmu_uploads`), `multipart/form-data`, `credentials: same-origin`:

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `op` | `sprite` | sí | |
| `scope` (o `ambito`) | `fonts` \| `img` \| `tm-presets` | sí | fuera de `AMBITOS_GALERIA` → error de ámbito |
| `archivo` | archivo `thumbs.webp` | sí | WEBP por firma binaria; ≤ 4 MB (`SPRITE_MAX_BYTES`) |
| `firma` | string JSON `[w,h,c,items]` | sí | misma estructura que `catalog.js::firmaCatalogo`; vacía o inválida → rechazo |
| `_wpnonce` | string | sí | `nonces.motor` |

Sin campos nuevos: este es el contrato de 006 (`contracts/motor-resources.md`) con el alcance ampliado.

## Validación server-side (en orden)

El orden refleja la **precedencia vigente del motor** (la que fijan los tests) y se conserva para los tres ámbitos: **firma → dimensiones → tamaño/formato**.

1. Nonce → `motor:nonce:invalido`.
2. `op` y `scope` válidos → `motor:op:*`, `motor:dir_ambito:ambito:invalido`.
3. Archivo presente → `motor:sprite:falta:archivo`.
4. **Firma**: decodificada e igualdad estricta con `[thumbs.w, thumbs.h, thumbs.c, items]` del inventario **en disco** → distinta/ausente → `motor:sprite:catalogo:desactualizado`.
5. **Dimensiones**: `getimagesize(archivo)` con `ancho === c × w` y `alto === ceil(max(1, maxId) / c) × h` de la retícula del ámbito → distinta o ilegible → `motor:sprite:dimensiones:invalidas`.
6. Invalidar (`guardar_catalogo`: elimina `thumbs.sprite_firma` de **los tres ámbitos**) **antes** de reemplazar: un fallo nunca certifica una hoja vieja.
7. Validar y mover el archivo (dentro de `PMU_Galeria::sprite`): tamaño ≤ 4 MB (`SPRITE_MAX_BYTES`) → `motor:sprite:archivo:tamano`; firma binaria WEBP (`RIFF…WEBP`) → `motor:sprite:archivo:formato`; escritura a `uploads/pmu/{ambito}/thumbs.webp` → `motor:sprite:directorio:no_escribible`.
8. Releer el inventario y comparar `items`: si cambiaron durante la operación → `motor:sprite:catalogo:desactualizado`.
9. Escribir `thumbs.sprite_firma = firma` en el inventario (escritura atómica `.tmp` + `rename`) → fallo → `motor:sprite:catalogo:no_escribible`.

## Response

- Éxito: `{ success: true, data: { spriteUrl: ".../thumbs.webp?v={filemtime}", scope } }`.
- Fallo: `{ success: false, data: "motor:..." }` con el mensaje exacto (el cliente lo muestra como causa).

## Efectos garantizados

1. Tras éxito, la hoja queda **certificada**: cualquier lector con `firma === firma(inventario)` la acepta (`api.js::ensureSpriteCanonico`).
2. La URL de respuesta lleva `?v=filemtime`: tras reemplazar el archivo, las copias del navegador se invalidan.
3. Un `alta`/`baja`/`editar` posterior del ámbito elimina `thumbs.sprite_firma` → la hoja vuelve a no usable hasta la próxima generación.

## Garantías del cliente (ver `galeria-sprite.md`)

- Exactamente 1 `POST op=sprite` por ámbito y apertura (reentrancia en cliente).
- Nunca se envía una hoja con celdas sin dibujar (pre-render antes del `POST`).
- Sin escrituras simultáneas del mismo ámbito desde la misma sesión.

## Fora de contrato

- El motor no rasteriza, no conoce familias Google ni renderiza presets: solo valida y persiste.
- No hay lock servidor ni cola: la serialización vive en el cliente.
