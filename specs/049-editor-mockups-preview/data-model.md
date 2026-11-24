# Data Model: Editor de Mockups — vista previa integrada

## Entidades

### Grupo de placeholder (existente, extendido)
- `id`: hex 6 sin `#` (clave).
- `w`, `h`: tamaño base en px (200 ppp).
- `cont`: cantidad de instancias (ahora expuesto como `data-cont` en `.ec-panel-grupo`).
- `tipo`: `texto` | `imagen` | (futuro) — declara la intención, no enruta.
- `campo_id`: campo asociado (opcional); `phsize` (0|1|2) y `envoltura` deducida del cableado.
- `pgs`: páginas.
- **Nuevo (derivado en UI)**: `instancias[]` con contenido por instancia (recorte/receta local), 1..`cont`.

### Vista previa del grupo (nueva, estado cliente)
- `grupoId`, `instanciaActiva` (0..cont-1).
- `contenido`: `{url, w, h, hash, ts, origen: 'recorte'|'texto'|'subida'|'fallback'}`.
- Fuente única compartida con el mockup (capa placeholder).
- Reglas: `texto` lee `cfg.previews[gid]`; `imagen` prioriza recorte local (`onRecorte`) y cae a imagen subida; tipo desconocido → fallback genérico. Un fallo no bloquea otros grupos.

### Capa placeholder del mockup (existente)
- `tipo:'placeholder'`, `ref:'{gid}'` o `'{gid}#{n}'` (instancia).
- Contenido visual = vista previa del grupo/instancia si "Alternar PH" activo; si no, caja neutra.

### Receta por instancia (dato de prueba)
- `receta v2` por instancia (modo, escala, ox, oy, rot, phsize, gid), la misma forma que la del comprador.
- Alimenta el "Procesar PDF" de muestra; NO persiste en el entregable del cliente.

### Ayuda contextual (nueva, estática)
- Texto de descripción del mockup expuesto desde `.ec-ayuda-icon` en la cabecera del acordeón.

## Transiciones de estado (vista previa)
- vacío → (monta cargador) → recorte listo → `onRecorte` publica contenido → mockup repinta.
- cambio de `instanciaActiva` → contenido de esa instancia (0 POST si ya cargada).
- cambio de tipo/estilo/campo → invalida `cfg.previews[gid]` (hash distinto) → siguiente "Probar" regenera.

## Validaciones
- `instanciaActiva` acotada a `[0, cont-1]`.
- `cont<=1` → sin flechas.
- Grupo sin campo imagen → no monta cargador (comportamiento clásico).
- Desajuste tipo/campo → aviso, no bloquea.
- Fallo de render/recorte → causa visible, consola operativa.