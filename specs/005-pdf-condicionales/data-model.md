# Data Model: 005-pdf-condicionales

**Feature**: 005-pdf-condicionales | **Created**: 2026-09-19

Norma: `constitution` §I+§IV + `research.md` D1–D9. Reutiliza sin cambios las
entidades de 004 (`data-model.md`: PDF, Grupo, Campo, Mockup, Ítem, Pedido).

## Asociación (PDF × producto Woo)

Nueva clave por PDF en `config.json`:

```json
"tienda": {
  "123": {"activo": true, "validez": "campo1 === 'libelulas' && campo2 === 'a4'",
           "mensaje_html": "<b>Ese diseño no viene en ese tamaño.</b>",
           "bloquear": false}
}
```

| Campo | Tipo | Descripción | Validación |
|---|---|---|---|
| `tienda` | object | clave = ID numérico del producto Woo (string) | claves `^[0-9]+$` |
| `activo` | bool | default `true`; `false` = el PDF no existe para el producto (ni campos, ni mockups, ni descarga) | bool |
| `validez` | string | expresión JS opcional (contrato `contracts/validez.md`) | máx 2000 chars; compila en sandbox (causa `motor:campos:script:invalido`) |
| `mensaje_html` | string | HTML opcional (se muestra si la validez da `false`) | allowlist `wp_kses` (p/b/i/strong/em/br/ul/li); máx 2000 chars |
| `bloquear` | bool | default `false`; solo tiene efecto si hay `validez` | bool |

Reglas:

- Sin entrada en `tienda{pid}` = `{activo: true}` (comportamiento 004 intacto).
- `validez` ausente o solo espacios = ausente.
- Normalización al guardar: `activo`/`bloquear` a bool, `validez`/`mensaje_html`
  recortados; lo inválido se rechaza con causa (nunca se guarda a medias).

## Snapshot del ítem (extiende `manifest.json` de 004)

```json
"pdfs": ["pdf-diseno1-legal"],
"pdfs_descartados": ["pdf-diseno1-a4", "pdf-diseno2-a4", "pdf-diseno2-legal"]
```

| Campo | Tipo | Descripción | Validación |
|---|---|---|---|
| `pdfs` | string[] | elegibles saneados y congelados al agregar (1..N) | no vacío; cada uno asociado + activo; sin duplicados |
| `pdfs_descartados` | string[] | declarados por el navegador y no aceptados (auditoría) | informativo |

Reglas:

- Mockups, pool (`img/{pdf}-...`), Motor, Descargas y "Completados" filtran por
  `manifest.pdfs[]` (004 sin snapshot = todos los PDFs del ítem, intacto).
- Meta del ítem Woo espeja ambos (`_pmu_pdfs`, `_pmu_pdfs_descartados`).
- Re-edición del ítem re-declara y re-sanea (el snapshot se reemplaza, nunca se
  fusiona con el anterior).
