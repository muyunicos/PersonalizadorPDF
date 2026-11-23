# Research — Modelo de recetas (spec 047, Fase 6)

## R1 — Formato del objetivo

**Decision**: `{aspecto}-{familia}-{area}`.
- `aspecto`: decimal con **4 decimales**, redondeo half-up (`300/200` → `1.5000`).
- `familia`: `0` = rectangulo, `1` = redonda.
- `area`: entero px² del `w×h` **resuelto** (con `phsize` aplicado).

**Rationale**: `aspecto + area` determinan `w×h` (w = √(area·aspecto), h = w/aspecto),
asi que no se pierde informacion y la clave queda corta. El aspecto con 4 decimales
evita que el redondeo cambie la clave entre versiones.

**Alternatives**: `{gid}-{w}x{h}-{phsize}` (actual; atado al PDF y no reutilizable entre
campos); `{aspecto}-{forma}-{w}x{h}` (redundante); aspecto decimal sin truncar (clave
inestable).

## R2 — Configuracion como delta

**Decision**: se guarda solo lo que cambia del default (`{modo:'cubrir'}`, escala 1,
centro 0.5/0.5, rot 0, fondo auto, sin desplazamiento). Claves: `modo`, `zoom`,
`rot`, `ox`, `oy`, `fondo`, `transp`.

**Rationale**: el default es el 90% de los casos; el catalogo queda legible y chico
(un objeto de 1-3 claves). La receta v2 completa se **deriva** al subir.

**Alternatives**: v2 completa (15 claves; redundante); delta + defaults explicitos
(ruido).

## R3 — "Mejor receta"

**Decision**: se resuelve por **aspecto mas cercano sin umbral**; a igualdad, por
**familia** y **area**. Sin coincidencia -> defaults del campo.

**Rationale**: "cercana" sin umbral evita que una diferencia minima (1.5000 vs 1.5001)
quede sin reutilizar; la familia y el area desempatan.

**Alternatives**: umbral ±5% (descartado por pedido del usuario); coincidencia exacta
(descarta casos muy cercanos).

## R4 — Compatibilidad

**Decision**: las recetas viejas (`{gid}-{w}x{h}-{phsize}`) se **ignoran** (no se
migran ni se reutilizan). El item conserva su receta congelada en el manifest, asi
que el PDF no depende del catalogo viejo.

**Rationale**: §V de la constitucion (sin compatibilidad hacia atras) y el catalogo es
derivado. El item ya tiene su `params` v2.

**Alternatives**: fallback de lectura (descartado); migracion (descartada).

## R5 — Derivacion de la v2 y hash

**Decision**: la v2 que viaja al servidor se arma con delta + objetivo (`w/h` del
area+aspecto) + `iw/ih` del original + `gid`/`phsize` del contexto. El hash
(`PMU_Sesion::receta_de`) lo sigue calculando el **servidor** sobre las 15 claves.

**Rationale**: el cliente manda datos declarativos; el hash es irreversible y el
servidor es la autoridad (spec 035 D9, constitucion §III).

**Alternatives**: hashear en el cliente (prohibido: hash irreversible); guardar la v2
completa en el catalogo (redundante).

## R6 — Donde vive el catalogo

**Decision**: `uploads.json` por identidad (invitado `tmp/sesion-{sid}/uploads/`,
cliente `orders/{uid}/uploads/`), con:
- `items[id].recetas[objetivo] = configuracion`
- `items[id].ajustes = {objetivo, configuracion}` (ultima receta aceptada)

**Rationale**: es dato del cliente, sobrevive a la pagina y viaja con la identidad
(spec 040). "Ajustes del cliente" es una **receta**, no un concepto aparte.

**Alternatives**: campo global del plugin (compartido entre compradores); item
(manifest) y copiar (fragil).

## R7 — Canonicalizacion de la forma

**Decision**: se toma el **estado final** (el PH manda sobre el campo). `auto` no se
guarda: se resuelve antes. `circulo`/`cuadrado` con aspecto 1; con aspecto ≠1 pasan a
`ovalo`/`rectangulo`.

**Rationale**: la forma declarada es una intencion; el PH puede cambiarla. La clave
usa familia + aspecto, que derivan las 4 formas.

**Alternatives**: guardar la forma declarada (poco fiable); 4 valores + auto (ruido).

## R8 — Area vs `w×h` (redondeo)

**Decision**: el area es la del `w×h` **resuelto** (entero). Para claves se usa el
aspecto redondeado a 4 decimales y el area exacta; no se derivan `w/h` para hashear
(los manda la ranura).

**Rationale**: `aspecto + area` con enteros es reversible salvo redondeo del 4to
decimal; la receta v2 lleva `w/h` reales, asi que no se pierde nada.

**Alternatives**: area con decimales (ruido); `w×h` (redundante con el aspecto).

## Resumen de decisiones

| # | Tema | Decision |
|---|---|---|
| R1 | objetivo | `{aspecto 4 dec}-{familia 0/1}-{area}` |
| R2 | configuracion | delta del default `{modo:'cubrir'}` |
| R3 | mejor receta | aspecto mas cercano sin umbral -> familia -> area |
| R4 | compatibilidad | ignorar recetas viejas (sin migracion) |
| R5 | v2 + hash | derivar v2 en el servidor; hash server-side |
| R6 | catalogo | `uploads.json` + `ajustes` |
| R7 | forma | estado final (PH); `auto` no se guarda |
| R8 | area | `w×h` resuelto; aspecto 4 decimales |