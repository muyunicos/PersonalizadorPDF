# 00 - Flujo operativo de Cline (personalizador-pdf)

Este archivo **no repite** normas del proyecto: solo dice **como trabajar**. El contexto
(objetivo, arquitectura, formatos, decisiones cerradas, errores conocidos) vive en
`AGENTS.md`, que Cline ya carga como reglas del workspace. Jerarquia:
`constitution` > `AGENTS.md` > resto.

## Herramientas de esta version (Cline v4.1.26)

- Edicion de archivos: **`editor`** (con `old_text`/`new_text`, o `insert_line`). Es la
  unica tool de edicion de la sesion; `apply_patch` es la alternativa y **nunca coexisten**.
- Nombres **legacy que ya no existen**: `write_to_file`, `replace_in_file`,
  `execute_command`. Si un doc o una memoria los nombra, traducirlos:
  `write_to_file` -> `editor` (archivo nuevo), `replace_in_file` -> `editor`
  (`old_text`/`new_text`), `execute_command` -> `run_commands`.
- **Plan mode no edita**: si la tarea requiere escribir, pedir Act mode. No intentar
  escribir por `run_commands` (redirecciones y `Set-Content` estan bloqueados).
- `run_commands` es para **leer, buscar, testear y verificar**, nunca para escribir
  archivos del repo (AGENTS.md §10.ter, regla 3).

## Donde viven las reglas (verificado 2026-10-27, v4.1.26)

- Cline lee reglas de `AGENTS.md` (raiz), `.clinerules/` y `.cline/rules/`. El escaneo **no es
  recursivo** y solo toma `.md`/`.markdown`/`.txt`: `.clinerules/workflows/` **no** entra como
  regla (son slash commands de Spec Kit).
- Este archivo vive en `.cline/rules/` **porque se versiona**: `.clinerules/` esta en `.gitignore`
  y lo gestiona Spec Kit (hashes en `.specify/integrations/cline.manifest.json`).
- Esta version **no soporta reglas condicionales** (`paths:`): no inventarlas. Para bajar costo se
  acorta `AGENTS.md`, no se agregan archivos.

## Triage de errores de herramienta

1. `text not found` / el `old_text` no matchea: **no es un limite de contexto** y **no se
   arregla con un script**. Releer el fragmento exacto (`read_files` con rango), usar un
   ancla de **UNA linea y sin espacios iniciales** (AGENTS.md §10.ter, regla 6) y
   reintentar **una** vez.
2. Si vuelve a fallar: mostrar el fragmento objetivo y **esperar instruccion**. No dividir
   a ciegas ni reescribir el archivo entero.
3. `Invalid input` / `expected string, received undefined` / JSON cortado: el tool-call se
   trunco (`maxTokens: 8192`). Partir la edicion en pasos mas chicos.
4. **Dos intentos fallidos = parar.** Explicar la causa y proponer otro enfoque; no loop.

## Presupuesto de contexto

- `AGENTS.md` pesa ~119 KB (~30k tokens) y se carga en **cada** request: no se relee
  entero, se lee la seccion que la tarea necesita. `modules/textmuy/AGENTS.md` (129 KB) no
  se auto-carga: se lee solo si se toca el modulo.
- Alrededor del **70%** de la ventana: cerrar con un resumen (estado, archivos tocados,
  pruebas corridas, proximo paso) y continuar en tarea nueva (`/newtask`). Para no perder
  el hilo dentro de la misma tarea, `/smol`.
- No volcar logs completos, historiales ni diffs enteros.

## Alcance y verificacion

- Una tarea = un alcance acotado (una spec, un bug, un refactor, un grupo de tests).
- Despues de **cada** paso verificado: `php -l` o `node --check` y la puerta del area
  (los comandos exactos estan en `AGENTS.md` §9). Nunca todo el lint al final.
- Antes de crear codigo nuevo: buscar si ya existe (AGENTS.md, regla de oro "no crear
  duplicados").

## Limites que no se negocian

- **No** crear ni editar archivos dentro de `.clinerules/` ni `.specify/`: los gestiona
  Spec Kit y sus hashes estan en `.specify/integrations/cline.manifest.json`.
- **No** duplicar normas de `AGENTS.md` en archivos de reglas.
- **No** commitear con el lint en rojo; **no** hacer `push` sin aprobacion explicita
  (el push dispara deploy a Hosting).
- Mensajes, variables e interfaz en espanol, sin tildes en codigo puro.
