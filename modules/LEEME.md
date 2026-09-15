# LEEME — Modulo integrado TextMuy (v4.2)

> Canonico tecnico: `AGENTS.md` §2.1 (contrato RenderCore + puente) y §5 (rutas).
> Este archivo es solo ficha operativa del modulo; si discrepa, vale `AGENTS.md`.

## Que es

**TextMuy vive integrado en este repositorio** (`modules/textmuy/`), bajo control total
del plugin. Ya NO existe un repositorio hermano ni flujo de importacion manual: se edita
directo aca, se corren sus tests Node y se hace bump `?v=RCn` en `index.html` y
`render-core.html` al tocar cualquier JS del modulo.

## Estructura

```
modules/textmuy/
├── index.html           <- Editor completo (iframe same-origin desde "Estilos de Texto")
├── render-core.html     <- Motor de render headless (API renderBatch, iframe off-screen)
├── js/                  <- editor, controls, preset-manager, catalog, api, fonts, galeria...
├── css/
├── tests/               <- 10 suites Node (NO corren en el servidor productivo de WP)
└── AGENTS.md            <- Contexto propio del modulo (constitucion v3.1.0)
```

## Datos (fuera de la carpeta del plugin)

Todo dato o recurso del administrador vive en la raiz unica **`uploads/pmu/`**:

| Ambito | Contenido | Catalogo | Sprite |
|---|---|---|---|
| `fonts/` | Tipografias (fisicas + familias Google) | `fonts.json` | `thumbs.webp` 180x30 c4 |
| `img/` | Imagenes (fondos, iconos...) + miniaturas de grupo `{pdf}-{id}.webp` (id = hex sin `#`) | `img.json` | `thumbs.webp` 100x100 c8 |
| `tm-presets/` | Estilos guardados `{nombre}.txm` (delta `textmuy-project` v1, refs por id) | `presets.json` | `thumbs.webp` 200x100 c4 |

Los ambitos `pdfs/`, `orders/` y `tmp/` son datos del motor de PDF, sin catalogo ni sprite.

## Puente plugin <-> modulo

`admin/estilos-texto.php` envia por postMessage `{type:'textmuy-bridge', bridge}` en 3
momentos (carga del iframe, aviso `textmuy-ready`, envio inmediato):

- `urls`: `motor` (endpoint unico `admin-post.php?action=pmu_uploads`), `miniaturas`
  (`assets/miniaturas.js`), y las bases de lectura `presetsBase` / `fuentesBase` / `imagenesBase`.
- `nonces`: UNA credencial `motor` (accion `pmu_uploads`).
- `presets` / `imagenes` / `fuentes`: inventarios iniciales generados por el motor
  (`PMU_Uploads::listar_todo()`).

Toda escritura es `POST urls.motor` con `op=` (`listar`, `alta`, `baja`, `editar`,
`sprite`, `miniatura`). Sin puente el editor NO opera: error accionable y cero
peticiones locales (sin bases de respaldo, sin data-URL, sin migraciones).

## Despliegue

1. Subir la carpeta del plugin completa a `wp-content/plugins/personalizador-pdf/`
   (el modulo ya viene incluido).
2. Subir `uploads/pmu/` COMPLETA a `wp-content/uploads/` (incluye `{fonts,img,tm-presets}`
   con sus catalogos: son los datos del administrador).
3. Despliegue automatico (webhooks Hostinger, ver AGENTS.md §2): el modulo TextMuy tiene
   su propio webhook de implementacion al hosting, separado del del plugin.
