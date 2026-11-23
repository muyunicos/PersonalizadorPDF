# Sintomas del comprador (relevamiento)

> Fecha: 2026-11-22. Fuente: relevamiento del usuario sobre
> `https://muyunicos.com/ojo-turco-protector-sticker/`.
> Objetivo: clasificar cada sintoma (bug / UX / tema) y llevarlo a un spec.
> Conviven con la auditoria `docs/auditoria-cargador.md` (A1-A8).

## Clasificacion

### Bugs (cambian comportamiento, hay que arreglar con puerta)

- **B1 (ALTA) "Ver en grande" no hace nada** en el editor. `_abrirVisorCompartido`
  resuelve las URLs SOLO con `config.urlDe(id)` (pool del item); una foto de la
  biblioteca que no esta en el item da 404 y el visor no abre. Debe usar
  `_urls[id]` (URL ya resuelta) antes de `urlDe`.
- **B2 (MEDIA) miniatura de baja resolucion al canvas**. Al tocar una miniatura de
  la tira del modal, a veces entra al canvas la miniatura (80x80) en vez del
  original: `cargarDesdeBiblioteca` acepta `foto.thumb` como URL primaria. Debe
  usar `foto.url` y, si falta, el respaldo `admin-post op=imagen` (original);
  `thumb` solo como ultimo recurso.
- **B3 (MEDIA) editar una foto de la biblioteca que no esta en el item** no abre
  el editor (`_editar` resuelve la URL por `config.urlDe` y obtiene '', asi que
  retorna false). Mismo fix que B1: `_urls` + cache de la biblioteca.

### UX (decisiones de diseno -> spec 046)

- **U1 avisos duplicados**: `cpmu-falta` ("Faltan 1 imagen(es) por cargar.") +
  `pmu-minimos-aviso` ("Faltan 1 foto(s) por cargar."). En la ficha debe quedar
  uno solo (el global de `tienda.js`); el del cargador se mantiene en el preview
  del admin.
- **U2 titulo del modal**: "Ajuste la imagen" -> algo mas claro ("Editar imagen",
  "Ajustar foto").
- **U3 boton primario por contexto**:
  | contexto | etiqueta |
  |---|---|
  | cargar imagen nueva | Subir |
  | editar sin cambios | Aceptar |
  | editar con cambios | Guardar |
  | elegir otra de la biblioteca | Cambiar |
  | reemplazar desde el visor | Cambiar |
- **U4 boton "Cargar imagen" dentro del modal**: pasa a "Cambiar imagen" cuando ya
  hay una imagen cargada (o icono de subir).
- **U5 acciones sobre la imagen existente**: `Eliminar` (que el usuario no pidio)
  y `Ver en grande` (hoy no hace nada -> B1). Mantener `Eliminar` con confirmacion
  y arreglar `Ver en grande`.
- **U6 titulo "Reemplazando imagen #1"**: cuando solo se ajusta la edicion, no
  reemplaza; usar "Imagen #X".
- **U7 carga en segundo plano**: hoy el modal se queda abierto con el indicador
  "cargando" hasta que el servidor responde. El usuario quiere que el modal cierre
  y el indicador quede en la miniatura (`cpmu-mini`) correspondiente, con marca de
  error/reintento si falla.
- **U8 "Todas (N)" siempre al final de la tira** (`mu-gal-linea`): hoy el chip
  `+X` solo aparece cuando la tira se llena. Es del **tema**
  (`C:\Users\Jonatan\Documents\GitHub\muyunicos`, repo aparte), no del plugin.

### Fuera de alcance del plugin

- **T1** `mu-gal-linea` / `mu-gal-item-abrir`: el tema `muyunicos` (junction en el
  lab). El plugin ya pasa `chipAccion:'abrir'`, `onChip` y `tope`; el tema debe
  pintar el chip **siempre** y respetar la delegacion.

## Propuesta

- **Spec 045 (en curso)**: B1, B2, B3 (bugs del cargador) + A1/A2 ya corregidos.
- **Spec 046 (UX del modal y tira)**: U1-U7, con la tabla de etiquetas y el
  indicador en la miniatura.
- **Tema (repo muyunicos)**: T1/U8.

## Pendiente de confirmar

- Confirmar la tabla de etiquetas (U3) y el texto de U2.
- Confirmar U7: modal cierra al instante y el progreso queda en la miniatura.
- Reproducir B2 en el lab (hace falta el caso exacto: tira del tema vs tira propia).