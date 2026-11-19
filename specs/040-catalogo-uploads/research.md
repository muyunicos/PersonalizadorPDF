# Research: Catalogo de uploads y biblioteca por carpetas

**Fecha**: 2026-11-19 | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

Todas las incognitas del Technical Context quedaron resueltas: no hay `NEEDS CLARIFICATION`.

## D1 — La biblioteca se lista desde las carpetas de originales

- **Decision**: el listado sale de `tmp/sesion-{sid}/uploads/` y, con cuenta, de
  `orders/{uid}/uploads/`; nunca de manifiestos de items ni del arbol completo de pedidos.
- **Rationale**: los archivos ya viven ahi y `resolver_original()` (spec 035 D4) ya resuelve el `id` en
  esa cadena. El costo pasa a depender solo de las fotos del comprador (FR-002, SC-001).
- **Alternatives**: (a) mantener el escaneo de contenedores con tope de 10 — es lo que hoy cuesta
  segundos con historial; (b) indice en base de datos — prohibido por la constitucion (JSON en
  `uploads/pmu/`, sin tablas custom).

## D2 — Catalogo `uploads.json` por carpeta

- **Decision**: un `uploads.json` por ambito de originales, con una entrada por imagen (`ext`, `bytes`,
  `w`, `h`, `creado`) y sus **recetas por contexto** (`gid` + `w`x`h` + `phsize`).
- **Rationale**: el listado necesita medidas y la receta recordada sin abrir cada archivo; el catalogo
  es dato derivado y reconstruible (FR-004, FR-006).
- **Alternatives**: (a) sidecar por imagen (`{id}.json`) — mas archivos y mas `stat` por listado;
  (b) leer los manifiestos — es justo lo que se retira.

## D3 — Miniaturas `{id}-80x80.webp` en la misma carpeta

- **Decision**: se generan al subir (GD, recorte al centro) y se guardan junto al original; si faltan,
  se generan al pedirlas y se conservan.
- **Rationale**: SC-004 (<20 KB por imagen) y cero trabajo por request en el caso normal. Al promover el
  item, la miniatura **viaja con el original** (FR-016).
- **Alternatives**: (a) cache global en `tmp/miniaturas/` — se desincroniza al mover el original y
  necesita su propia poda; (b) redimensionar en cada request — mas CPU y sin cache.

## D4 — Resolucion por `id` en tiempo constante

- **Decision**: `op=imagen` y `op=miniatura` usan `resolver_original($id, $clave, $sid)`; se elimina el
  escaneo de contenedores de esa ruta.
- **Rationale**: hoy cada miniatura dispara un escaneo completo; con la cadena `orders -> tmp` la
  ubicacion es O(1) (FR-008).
- **Alternatives**: cachear el mapa `id -> ruta` — innecesario: la cadena ya son dos `is_file`.

## D5 — Quitar del campo no borra; borrar vive en la galeria

- **Decision**: quitar una foto de una ranura solo elimina la referencia de ese campo. Borrar desde la
  galeria elimina original, miniatura y entrada; antes consulta referencias en items de **carrito** y
  **pedidos** (los borradores no cuentan) y pide confirmacion si hay alguna.
- **Rationale**: la aclaracion del usuario (sesion 2026-11-19). Evita perder fotos que solo se querian
  reemplazar en un campo y, a la vez, protege lo que ya esta en carrito o comprado (FR-011, FR-012,
  FR-014, FR-015). Estado de confirmacion: el mini-dialogo propio del visor (spec 039 D1).
- **Alternatives**: (a) borrar siempre — rompe el carrito o el pedido; (b) confirmar siempre — molesto
  para fotos que solo estan en un borrador.
- **Supersede**: la 039 D3 (borrado en el acto desde el visor del campo) queda superada para el caso
  "quitar".

## D6 — Reconstruccion solo desde archivos

- **Decision**: si falta o esta corrupto el catalogo, se reconstruye una vez con `id`, formato, peso,
  medidas y fecha leidos de los archivos; **sin recuperar recetas**.
- **Rationale**: no bloquea la apertura (FR-006) y evita leer manifiestos en la ruta normal. Las recetas
  se pierden para las imagenes historicas hasta que se vuelvan a usar (aclaracion del usuario).
- **Alternatives**: recuperar recetas desde manifiestos — descartado por el usuario.

## D7 — Escritura atomica y catalogo no publico

- **Decision**: escribir con `.tmp` + `rename`; el catalogo no se sirve por ruta propia (FR-013).
- **Rationale**: constitucion (Data Storage) y la aclaracion de seguridad: comparte la carpeta fisica de
  los originales y su misma exposicion, pero nunca se publica su URL.
- **Alternatives**: servir el JSON por `admin-ajax` — agrega una superficie nueva sin beneficio.

## D8 — Dedupe de la peticion de listado

- **Decision**: `pedir()` comparte la promesa en vuelo y `calentar()` no dispara con copia fresca.
- **Rationale**: hoy el primer gesto + la apertura del modal producen varios `listar` completos
  (SC-002). Es el cambio de menor costo y mayor efecto percibido.
- **Alternatives**: cachear en servidor — complementario, no reemplaza el dedupe del cliente.